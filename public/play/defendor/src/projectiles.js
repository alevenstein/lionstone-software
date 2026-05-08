// -----------------------------------------------------------------------------
// Projectile lifecycle: shells / bullets / homing missiles, plus the explosion
// helper that handles regular, silver-splash, and red-knockback variants.
// -----------------------------------------------------------------------------
import {
  CANNON_BLOCK_CHANCE,
  CANNON_BLOCK_DURATION,
  CANNON_FIRE_CHANCE,
  CANNON_FIRE_DURATION,
  CANNON_FIRE_RADIUS,
  CANNON_FIRE_DAMAGE_FRAC,
  CANNON_DOOR_CHANCE,
  CANNON_DOOR_DURATION,
  CANNON_DOOR_RADIUS,
  KNOCKBACK_DIST,
  MG_EXPLODE_CHANCE,
  MG_EXPLODE_RADIUS,
  MG_EXPLODE_DAMAGE_FRAC,
  MG_EXPLODE_GLOW_T,
  MG_PIERCE_CHANCE,
  MG_PIERCE_DAMAGE_FRAC,
  MG_PIERCE_SEARCH_RADIUS,
  MG_PIERCE_GLOW_T,
} from './constants.js';
import { state } from './state.js';
import { clamp, wrapAngle } from './math.js';
import { knockbackAlongPath } from './pathing.js';
import { sfx } from './audio.js';
import { addEffect } from './effects.js';

const MISSILE_TURN_RATE = 6;     // radians per second
const SHELL_BULLET_TURN = 0;     // unused (homing only re-aims direction)

// ----- Update entrypoint -------------------------------------------------------

/** Advance every active projectile by `dt`, then prune dead ones. */
export function updateProjectiles(dt) {
  for (const proj of state.projectiles) {
    if (proj.kind === 'shell' || proj.kind === 'bullet') {
      updateBallistic(proj, dt);
    } else if (proj.kind === 'missile') {
      updateMissile(proj, dt);
    }
  }
  state.projectiles = state.projectiles.filter((p) => !p.dead);
}

// ----- Shells / bullets --------------------------------------------------------

/** Direct-fire projectile — re-aims at the target each frame and ticks ahead. */
function updateBallistic(proj, dt) {
  // Re-aim toward the live target each frame.
  if (proj.target && proj.target.hp > 0) {
    const dx = proj.target.x - proj.x;
    const dy = proj.target.y - proj.y;
    const len = Math.hypot(dx, dy) || 1;
    proj.vx = (dx / len) * proj.speed;
    proj.vy = (dy / len) * proj.speed;
  }
  proj.x += proj.vx * dt;
  proj.y += proj.vy * dt;
  proj.life -= dt;

  // Hit detection
  if (proj.target && proj.target.hp > 0) {
    const reachDist = proj.target.def.size + 4;
    if (Math.hypot(proj.target.x - proj.x, proj.target.y - proj.y) < reachDist) {
      proj.target.hp -= proj.dmg;
      sfx.hit();
      addEffect({ type: 'spark', x: proj.x, y: proj.y, t: 0.18, color: '#ffe080' });
      // Cannon Damage powerup: 5% chance the corpse blocks the road.
      if (proj.cannonBlock && proj.target.hp <= 0
          && Math.random() < CANNON_BLOCK_CHANCE) {
        spawnRoadBlock(proj.target);
      }
      // Cannon Rate powerup: 1/100 chance to leave a fire patch on the road.
      if (proj.cannonFire && Math.random() < CANNON_FIRE_CHANCE) {
        spawnFirePatch(proj.target, proj.dmg);
      }
      // Cannon Range powerup: on kill, 5% chance to open a black door.
      if (proj.cannonDoor && proj.target.hp <= 0
          && Math.random() < CANNON_DOOR_CHANCE) {
        spawnBlackDoor(proj.target);
      }
      // MG Damage powerup: arm the target so it can explode on death (the
      // roll happens in rewardDeadEnemies). Done on every hit because MG
      // bullets rarely deliver the killing blow themselves.
      if (proj.mgExplode) {
        proj.target.mgExplodeArmed = true;
        proj.target.mgExplodeDmg   = Math.max(proj.target.mgExplodeDmg || 0, proj.dmg);
      }
      // MG Range powerup: 1/20 chance the bullet pierces to the alien
      // immediately behind for half damage.
      if (proj.mgPierce && Math.random() < MG_PIERCE_CHANCE) {
        mgPierceBehind(proj.target, proj.dmg);
      }
      proj.dead = true;
    }
  }
  if (proj.life <= 0) proj.dead = true;
}

// ----- Missiles ----------------------------------------------------------------

/** Re-acquire the nearest live alien if our target is gone. */
function reacquireMissileTarget(proj) {
  let best = null;
  let bestDist = Infinity;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    const d = Math.hypot(enemy.x - proj.x, enemy.y - proj.y);
    if (d < bestDist) { bestDist = d; best = enemy; }
  }
  proj.target = best;
}

/**
 * Turn the missile's velocity vector toward its target at a fixed turn rate
 * and re-set the magnitude to the constant cruise speed (no launch ramp, so
 * every missile flies at the same rate).
 */
function steerMissile(proj, dt) {
  if (!proj.target || proj.target.hp <= 0) return;
  const dx = proj.target.x - proj.x;
  const dy = proj.target.y - proj.y;
  const desired = Math.atan2(dy, dx);
  const currentAng = Math.atan2(proj.vy, proj.vx);
  const turnLimit = MISSILE_TURN_RATE * dt;
  const newAng = currentAng + clamp(wrapAngle(desired - currentAng), -turnLimit, turnLimit);
  proj.vx = Math.cos(newAng) * proj.speed;
  proj.vy = Math.sin(newAng) * proj.speed;
}

/** Trail smoke puffs every ~40 ms while in flight. */
function emitMissileSmoke(proj, dt) {
  proj.smokeT -= dt;
  if (proj.smokeT <= 0) {
    addEffect({ type: 'smoke', x: proj.x, y: proj.y, t: 0.6 });
    proj.smokeT = 0.04;
  }
}

/** Direct hit on a live target → explode and mark the missile dead. */
function tryMissileImpact(proj) {
  if (!proj.target || proj.target.hp <= 0) return false;
  const reachDist = proj.target.def.size + 6;
  if (Math.hypot(proj.target.x - proj.x, proj.target.y - proj.y) >= reachDist) return false;
  explodeAt(proj.x, proj.y, proj.dmg, proj.splash, {
    silver: proj.silver,
    red: proj.red,
    target: proj.target,
  });
  proj.dead = true;
  return true;
}

function updateMissile(proj, dt) {
  // If powered-up (silver/red/range-maxed) and target is gone, find a new one.
  if (proj.homing && (!proj.target || proj.target.hp <= 0)) {
    reacquireMissileTarget(proj);
  }
  steerMissile(proj, dt);
  proj.x += proj.vx * dt;
  proj.y += proj.vy * dt;
  proj.life -= dt;
  emitMissileSmoke(proj, dt);

  if (tryMissileImpact(proj)) return;

  // Out of fuel — fizzle with a weaker boom.
  if (proj.life <= 0) {
    explodeAt(proj.x, proj.y, proj.dmg * 0.5, proj.splash * 0.7, { silver: proj.silver });
    proj.dead = true;
  }
}

// ----- Explosion ---------------------------------------------------------------

/**
 * Apply explosion damage at (x, y) over `radius`. opts:
 *   silver: dmg-track maxed missile (1/20) — 1.5× radius and an additional
 *           100% of dmg on top of the normal falloff splash. Visual: megaboom.
 *   red:    rate-track maxed missile (1/20) — knock the target and surrounding
 *           aliens back along the road, with a small spring effect at impact.
 *   target: the directly-hit alien (used by some powerups).
 */
export function explodeAt(x, y, dmg, radius, opts = {}) {
  const silver = !!opts.silver;
  const red    = !!opts.red;
  const r = silver ? radius * 1.5 : radius;

  for (const enemy of state.enemies) {
    const d = Math.hypot(enemy.x - x, enemy.y - y);
    if (d >= r) continue;
    enemy.hp -= computeSplashDamage(d, dmg, radius, silver);
    if (red && enemy.hp > 0) knockbackAlongPath(enemy, KNOCKBACK_DIST);
  }

  if (silver) addEffect({ type: 'megaboom', x, y, t: 1.2, r: r * 1.6 });
  else        addEffect({ type: 'boom',     x, y, t: 0.45, r });
  if (red)    addEffect({ type: 'spring',   x, y, t: 0.7 });
  sfx.explode();
  if (red) sfx.sproing();
}

/** Damage from one explosion against one alien at distance d. */
function computeSplashDamage(d, dmg, radius, silver) {
  const fall = Math.max(0, 1 - d / radius);
  let hit = dmg * (0.4 + 0.6 * fall);
  if (silver) hit += dmg;     // additional 100% on top of normal splash
  return hit;
}

/**
 * MG Damage powerup: small explosion centered on the just-hit target,
 * dealing 50% bullet-damage splash to nearby aliens (excluding the target,
 * which already took the direct hit).
 */
export function mgExplodeAt(target, bulletDmg) {
  for (const enemy of state.enemies) {
    if (enemy === target || enemy.hp <= 0) continue;
    const d = Math.hypot(enemy.x - target.x, enemy.y - target.y);
    if (d >= MG_EXPLODE_RADIUS) continue;
    const fall = Math.max(0.4, 1 - d / MG_EXPLODE_RADIUS);
    enemy.hp -= bulletDmg * MG_EXPLODE_DAMAGE_FRAC * fall;
    enemy.glowT     = MG_EXPLODE_GLOW_T;
    enemy.glowColor = '#ff8030';   // orange
  }
  // Small firework over the road — celebratory feel per the spec.
  addEffect({
    type: 'firework',
    x: target.x, y: target.y,
    t: 0.7,
    colors: ['#ff4060', '#40c0ff', '#ffd040', '#80ff60', '#ff80ff', '#ffffff'],
  });
  addEffect({
    type: 'boom',
    x: target.x, y: target.y,
    t: 0.35,
    r: MG_EXPLODE_RADIUS * 0.7,
  });
  sfx.hit();
}

/**
 * MG Range powerup: find the alien immediately behind `target` on the path
 * (highest progress strictly less than target's, within search radius) and
 * deal half bullet-damage to it.
 */
function mgPierceBehind(target, bulletDmg) {
  const targetProgress = target.seg + target.segT;
  let best = null;
  let bestProgress = -1;
  for (const enemy of state.enemies) {
    if (enemy === target || enemy.hp <= 0) continue;
    const p = enemy.seg + enemy.segT;
    if (p >= targetProgress) continue;  // not behind
    if (Math.hypot(enemy.x - target.x, enemy.y - target.y) > MG_PIERCE_SEARCH_RADIUS) continue;
    if (p > bestProgress) { bestProgress = p; best = enemy; }
  }
  if (best) {
    best.hp -= bulletDmg * MG_PIERCE_DAMAGE_FRAC;
    best.glowT     = MG_PIERCE_GLOW_T;
    best.glowColor = '#ff3030';   // red
    addEffect({ type: 'spark', x: best.x, y: best.y, t: 0.2, color: '#ff8080' });
  }
}

/**
 * Cannon Rate powerup: leave a burning patch at the alien's last position
 * that damages aliens who walk through. dmgPerSec is calibrated against the
 * shell's damage so it scales with cannon upgrades.
 */
function spawnFirePatch(enemy, shellDmg) {
  state.firePatches.push({
    x: enemy.x,
    y: enemy.y,
    t:        CANNON_FIRE_DURATION,
    totalT:   CANNON_FIRE_DURATION,
    radius:   CANNON_FIRE_RADIUS,
    dmgPerSec: shellDmg * CANNON_FIRE_DAMAGE_FRAC,
  });
}

/** Cannon Range powerup: open a black door at the alien's path position. */
function spawnBlackDoor(enemy) {
  state.blackDoors.push({
    seg:    enemy.seg,
    segT:   enemy.segT,
    x:      enemy.x,
    y:      enemy.y,
    t:      CANNON_DOOR_DURATION,
    totalT: CANNON_DOOR_DURATION,
    radius: CANNON_DOOR_RADIUS,
  });
}

/** Drop a corpse on the path that other aliens can't pass through. */
function spawnRoadBlock(enemy) {
  state.roadBlocks.push({
    seg:  enemy.seg,
    segT: enemy.segT,
    x:    enemy.x,
    y:    enemy.y,
    t:        CANNON_BLOCK_DURATION,
    totalT:   CANNON_BLOCK_DURATION,
    color: enemy.def.color,
    size:  enemy.def.size,
  });
}
