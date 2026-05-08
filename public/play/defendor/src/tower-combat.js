// -----------------------------------------------------------------------------
// Per-frame tower combat: pick a target, smooth-aim the turret, and either
// (a) sustain a laser beam, (b) fire a discrete projectile, or (c) chain
// lightning across enemies.
// -----------------------------------------------------------------------------
import {
  MAX_TRACK_LEVEL,
  RED_MISSILE_CHANCE,
  SILVER_MISSILE_CHANCE,
  MG_TEMP_CHANCE,
  TESLA_NOVA_CHANCE,
  TESLA_NOVA_RADIUS,
  TESLA_LINK_CHANCE,
  TESLA_LINK_DAMAGE_MUL,
  LASER_POWERUP_INTERVAL,
  LASER_FREEZE_CHANCE,
  LASER_FREEZE_DURATION,
  LASER_FREEZE_RADIUS,
  LASER_LIFT_CHANCE,
  LASER_LIFT_DURATION,
  LASER_LIFT_RADIUS,
  LASER_DINO_CHANCE,
  LASER_DINO_DURATION,
} from './constants.js';
import { state } from './state.js';
import { clamp, wrapAngle } from './math.js';
import { sfx } from './audio.js';
import { addEffect } from './effects.js';
import { refreshAuraStats, spawnTempMG } from './tower-build.js';

const TURRET_TURN_RATE     = 8;     // radians per second
const LASER_BEEP_INTERVAL  = 0.15;  // throttle laser sfx so it doesn't repeat too fast
const LASER_RAMP_BONUS     = 0.4;   // how much each unit of heat boosts dps
const LASER_HEAT_COOLDOWN  = 2;     // heat dropped per second when no target
const TESLA_CHAIN_RANGE    = 100;   // distance between successive chain links
const MISSILE_LAUNCH_SPEED = 240;

// ----- Update ------------------------------------------------------------------

/** Run one tick of combat for every tower. */
export function updateTowers(dt) {
  refreshAuraStats();
  let anyExpired = false;
  for (const tower of state.towers) {
    // Temporary towers (MG-rate powerup) tick down + expire.
    if (tower.temp) {
      tower.tempLife -= dt;
      if (tower.tempLife <= 0) { tower.expired = true; anyExpired = true; continue; }
    }
    // Tesla-link glow timers (range-maxed Tesla powerup): red on the
    // activator, green on each linked tower.
    if (tower.redGlowT   > 0) tower.redGlowT   -= dt;
    if (tower.greenGlowT > 0) tower.greenGlowT -= dt;
    if (tower.def.aura) continue;  // aura towers don't shoot.
    tower.target = pickTarget(tower);
    if (tower.target) aimAtTarget(tower, dt);
    runTowerWeapon(tower, dt);
  }
  if (anyExpired) {
    state.towers = state.towers.filter((t) => !t.expired);
    refreshAuraStats();
  }
}

/** Choose the alien furthest along the path within the tower's range. */
function pickTarget(tower) {
  let best = null;
  let bestProgress = -1;
  for (const enemy of state.enemies) {
    if (enemy.airborneT > 0) continue;  // lifted aliens are untargetable
    if (Math.hypot(tower.x - enemy.x, tower.y - enemy.y) > tower.range) continue;
    const progress = enemy.seg + enemy.segT;
    if (progress > bestProgress) { bestProgress = progress; best = enemy; }
  }
  return best;
}

/** Smoothly turn the turret toward its target. */
function aimAtTarget(tower, dt) {
  const desired = Math.atan2(tower.target.y - tower.y, tower.target.x - tower.x);
  const turnLimit = TURRET_TURN_RATE * dt;
  tower.angle += clamp(wrapAngle(desired - tower.angle), -turnLimit, turnLimit);
}

/** Dispatch to the weapon-specific update routine. */
function runTowerWeapon(tower, dt) {
  if (tower.def.isBeam) {
    updateLaser(tower, dt);
    return;
  }
  tower.cooldown -= dt;
  if (tower.target && tower.cooldown <= 0) {
    tower.cooldown = 1 / tower.rate;
    fireTower(tower, tower.target);
  }
}

// ----- Laser -------------------------------------------------------------------

/**
 * Continuous beam. Heat builds while a target is held (rate-track upgrade
 * scales how fast it builds and how high it caps), and the dps scales with
 * the current heat. The laser sfx fires at a throttled rate while held.
 */
function updateLaser(tower, dt) {
  const target = tower.target;
  if (!target) {
    tower.laserHeat = Math.max(0, tower.laserHeat - dt * LASER_HEAT_COOLDOWN);
    return;
  }
  tower.laserHeat = Math.min(tower.laserHeat + dt * tower.heatRate, tower.heatCap);
  const dps = tower.dmg * (1 + tower.laserHeat * LASER_RAMP_BONUS);
  // Detect a kill caused by this beam tick — used by the dmg-maxed dinosaur
  // powerup which is on-kill, not periodic.
  const beforeHp = target.hp;
  target.hp -= dps * dt;
  if (state.time - (tower.lastBeep || 0) > LASER_BEEP_INTERVAL) {
    sfx.laser();
    tower.lastBeep = state.time;
  }
  // Laser Damage powerup: on kill, 5% chance to spawn a dinosaur.
  if (beforeHp > 0 && target.hp <= 0
      && tower.dmgLvl >= MAX_TRACK_LEVEL
      && Math.random() < LASER_DINO_CHANCE) {
    spawnDinosaur(tower);
  }
  // Rate / Range powerups roll on a periodic cadence since the beam is
  // continuous (5% chance per LASER_POWERUP_INTERVAL while a target is held).
  tower.laserPowerupT = (tower.laserPowerupT || 0) - dt;
  if (tower.laserPowerupT <= 0) {
    tower.laserPowerupT = LASER_POWERUP_INTERVAL;
    if (tower.rateLvl  >= MAX_TRACK_LEVEL && Math.random() < LASER_FREEZE_CHANCE) {
      laserFreeze(target);
    }
    if (tower.rangeLvl >= MAX_TRACK_LEVEL && Math.random() < LASER_LIFT_CHANCE) {
      laserLift(target);
    }
  }
}

/** Laser Rate powerup: freeze target + nearby aliens for LASER_FREEZE_DURATION. */
function laserFreeze(target) {
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    if (Math.hypot(enemy.x - target.x, enemy.y - target.y) > LASER_FREEZE_RADIUS) continue;
    enemy.frozenT = LASER_FREEZE_DURATION;
  }
  addEffect({ type: 'frostBurst', x: target.x, y: target.y, t: 0.6, r: LASER_FREEZE_RADIUS });
}

/** Laser Range powerup: lift target + nearby aliens into the air. */
function laserLift(target) {
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    if (Math.hypot(enemy.x - target.x, enemy.y - target.y) > LASER_LIFT_RADIUS) continue;
    enemy.airborneT = LASER_LIFT_DURATION;
  }
  addEffect({ type: 'liftBurst', x: target.x, y: target.y, t: 0.6, r: LASER_LIFT_RADIUS });
}

/** Laser Damage powerup: spawn a dinosaur near the tower. */
function spawnDinosaur(tower) {
  // Don't spawn another if one's already active for this tower.
  for (const dino of state.dinosaurs) {
    if (dino.parent === tower) return;
  }
  state.dinosaurs.push({
    parent: tower,
    x: tower.x + (Math.random() - 0.5) * 20,
    y: tower.y + 22 + Math.random() * 8,
    facing: 1,
    life:        LASER_DINO_DURATION,
    totalLife:   LASER_DINO_DURATION,
    dmg:         tower.dmg,           // bite damage = laser's per-tick damage
    target:      null,
    attackCool:  0,
    bobPhase:    Math.random() * Math.PI * 2,
  });
}

// ----- Firing per type ---------------------------------------------------------

/** Spawn the appropriate projectile or trigger the appropriate effect. */
function fireTower(tower, target) {
  switch (tower.type) {
    case 'cannon':  return fireCannon(tower, target);
    case 'mg':      return fireMg(tower, target);
    case 'missile': return fireMissile(tower, target);
    case 'tesla':   return fireTesla(tower, target);
    // laser is handled in updateLaser as a continuous beam
  }
}

function fireCannon(tower, target) {
  // Cannon powerup tags carried by the shell — see projectiles.js for
  // resolution.
  const dmgMaxed   = tower.dmgLvl   >= MAX_TRACK_LEVEL;
  const rateMaxed  = tower.rateLvl  >= MAX_TRACK_LEVEL;
  const rangeMaxed = tower.rangeLvl >= MAX_TRACK_LEVEL;
  state.projectiles.push({
    kind: 'shell', x: tower.x, y: tower.y,
    vx: 0, vy: 0,
    target, speed: 380,
    dmg: tower.dmg, color: '#2a2018', size: 4, life: 2,
    cannonBlock:    dmgMaxed,
    cannonFire:     rateMaxed,
    cannonDoor:     rangeMaxed,
  });
  sfx.cannon();
}

function fireMg(tower, target) {
  // Powerup tags carried by the bullet — see projectiles.js for resolution.
  // Temp towers don't propagate any powerups (no cascade).
  const dmgMaxed   = !tower.temp && tower.dmgLvl   >= MAX_TRACK_LEVEL;
  const rangeMaxed = !tower.temp && tower.rangeLvl >= MAX_TRACK_LEVEL;
  state.projectiles.push({
    kind: 'bullet', x: tower.x, y: tower.y,
    vx: 0, vy: 0,
    target, speed: 700,
    dmg: tower.dmg, color: '#fff8a0', size: 2, life: 0.6,
    tracer: true,
    mgExplode: dmgMaxed,
    mgPierce:  rangeMaxed,
  });
  sfx.shoot();
  // MG Rate powerup: rate-maxed → 1/50 chance to spawn a temp MG next to
  // the target. Guard with `!tower.temp` so temps can't cascade.
  if (!tower.temp && tower.rateLvl >= MAX_TRACK_LEVEL && Math.random() < MG_TEMP_CHANCE) {
    spawnTempMG(tower, target);
  }
}

function fireMissile(tower, target) {
  // Powerup rolls — see specs/maxUpgradePowerups.md.
  const dmgMaxed   = tower.dmgLvl   >= MAX_TRACK_LEVEL;
  const rangeMaxed = tower.rangeLvl >= MAX_TRACK_LEVEL;
  const rateMaxed  = tower.rateLvl  >= MAX_TRACK_LEVEL;
  const isSilver   = dmgMaxed  && Math.random() < SILVER_MISSILE_CHANCE;
  const isRed      = rateMaxed && Math.random() < RED_MISSILE_CHANCE;

  state.projectiles.push({
    kind: 'missile', x: tower.x, y: tower.y,
    vx: Math.cos(tower.angle) * MISSILE_LAUNCH_SPEED,
    vy: Math.sin(tower.angle) * MISSILE_LAUNCH_SPEED,
    target, speed: MISSILE_LAUNCH_SPEED,
    dmg: tower.dmg, splash: tower.def.splash, color: '#3a3a3a',
    size: 4, life: 4, smokeT: 0,
    silver: isSilver,
    homing: rangeMaxed || isSilver || isRed,   // silver/red always home
    red: isRed,
  });
  sfx.missile();
}

function fireTesla(tower, target) {
  teslaChain(tower, target);
  sfx.tesla();
  // Tesla Rate powerup: 1/100 supernova at the target dealing tower.dmg as
  // splash damage to every alien within TESLA_NOVA_RADIUS px.
  if (tower.rateLvl >= MAX_TRACK_LEVEL && Math.random() < TESLA_NOVA_CHANCE) {
    teslaSupernova(tower, target);
  }
  // Tesla Range powerup: 1/100 multi-tesla strike — every other Tesla within
  // this tower's range fires a single bolt at the target.
  if (tower.rangeLvl >= MAX_TRACK_LEVEL && Math.random() < TESLA_LINK_CHANCE) {
    teslaMultiStrike(tower, target);
  }
}

/** Tesla Rate powerup: AoE blast at target. */
function teslaSupernova(tower, target) {
  for (const enemy of state.enemies) {
    const d = Math.hypot(enemy.x - target.x, enemy.y - target.y);
    if (d >= TESLA_NOVA_RADIUS) continue;
    const fall = Math.max(0.4, 1 - d / TESLA_NOVA_RADIUS);
    enemy.hp -= tower.dmg * fall;
  }
  addEffect({ type: 'nova', x: target.x, y: target.y, t: 1.0, r: TESLA_NOVA_RADIUS });
}

/**
 * Tesla Range powerup: every other Tesla in range fires a single linked bolt.
 * The activator glows red and each linked tesla glows green for
 * `TESLA_LINK_GLOW_DURATION` s. Bolts use the dramatic `megaBolt` effect.
 */
const TESLA_LINK_GLOW_DURATION = 3.0;
function teslaMultiStrike(tower, target) {
  tower.redGlowT = TESLA_LINK_GLOW_DURATION;
  for (const other of state.towers) {
    if (other === tower) continue;
    if (other.type !== 'tesla') continue;
    if (Math.hypot(other.x - tower.x, other.y - tower.y) > tower.range) continue;
    target.hp -= other.dmg * TESLA_LINK_DAMAGE_MUL;
    other.greenGlowT = TESLA_LINK_GLOW_DURATION;
    // Bolt routes linked → activator → target so the firing tower visibly
    // acts as the conduit. drawMegaBolt strokes each consecutive pair.
    addEffect({
      type: 'megaBolt',
      points: [
        { x: other.x,  y: other.y  },
        { x: tower.x,  y: tower.y  },
        { x: target.x, y: target.y },
      ],
      t: 0.8,
    });
  }
}

// ----- Tesla chain lightning ---------------------------------------------------

/**
 * Chain from `firstHit` outward to up to def.chain enemies. Damage falls off
 * each hop by `chainFalloff`. Each strike applies a slow:
 *   - dmg-track maxed → cumulative: stacks +30% per strike, cap 0.95
 *   - otherwise       → ensures at least 0.30 (won't downgrade existing slow)
 * Both reset the slow timer to 0.5 s.
 */
function teslaChain(tower, firstHit) {
  const cumulativeSlow = tower.dmgLvl >= MAX_TRACK_LEVEL;
  const hitSet = new Set();
  const points = [{ x: tower.x, y: tower.y }];
  let dmg = tower.dmg;
  let current = firstHit;
  let count = 0;
  const maxHops = tower.def.chain || 3;

  while (current && count < maxHops) {
    points.push({ x: current.x, y: current.y });
    current.hp -= dmg;
    applyTeslaSlow(current, cumulativeSlow);
    hitSet.add(current);
    dmg *= (tower.def.chainFalloff || 0.7);
    current = nextChainHop(current, hitSet);
    count++;
  }
  addEffect({ type: 'lightning', points, t: 0.18 });
}

function applyTeslaSlow(enemy, cumulative) {
  if (cumulative) {
    enemy.slow = Math.min(0.95, (enemy.slow || 0) + 0.3);
  } else {
    enemy.slow = Math.max(enemy.slow || 0, 0.3);
  }
  enemy.slowT = 0.5;
}

/** Closest live alien within chain range that hasn't been hit yet. */
function nextChainHop(from, hitSet) {
  let best = null;
  let bestDist = TESLA_CHAIN_RANGE;
  for (const enemy of state.enemies) {
    if (hitSet.has(enemy) || enemy.hp <= 0) continue;
    const d = Math.hypot(from.x - enemy.x, from.y - enemy.y);
    if (d < bestDist) { bestDist = d; best = enemy; }
  }
  return best;
}
