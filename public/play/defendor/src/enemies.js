// -----------------------------------------------------------------------------
// Enemy spawning + per-frame update (path movement, base damage, deaths,
// rewards, kill-cash floater).
// -----------------------------------------------------------------------------
import {
  ALIEN_REWARD_MULTIPLIER,
  LASER_DINO_SPEED,
  LASER_DINO_ATTACK_COOL,
  LASER_DINO_REACH,
  MG_EXPLODE_CHANCE,
} from './constants.js';
import { state } from './state.js';
import { ENEMIES } from './data/enemies.js';
import { gwcOf } from './data/waves.js';
import { dist, lerp } from './math.js';
import { sfx } from './audio.js';
import { addEffect } from './effects.js';
import { mgExplodeAt } from './projectiles.js';

// ----- Spawn -------------------------------------------------------------------

/**
 * Difficulty multipliers as a function of the global wave count. Kept here
 * so the formulas are in one place and easy to retune.
 */
function difficultyForWave(globalWaveCount) {
  console.log("rewardScale 1: " + Math.pow(.75, globalWaveCount - 1) + ", 2: " + Math.pow(1.0069, globalWaveCount - 1) * .75);
  return {
    hpScale:     Math.pow(1.015,  globalWaveCount - 1),
    rewardScale: Math.pow(1.0034, globalWaveCount - 1), // Original: 1.0069
    speedScale:  Math.min(1 + (globalWaveCount - 1) * 0.0002, 1.0),
  };
}

/**
 * Push a new alien onto state.enemies. The species template gives base stats;
 * the wave/level scales them up. waveNum is which wave it belongs to (per-
 * level), used to attribute the kill on wave-clear.
 */
export function spawnEnemy(type, waveNum) {
  const enemyDef = ENEMIES[type];
  const gwc = gwcOf(waveNum, state.level);
  const { hpScale, rewardScale, speedScale } = difficultyForWave(gwc);

  state.enemies.push({
    type, def: enemyDef, waveNum,
    x: state.pathPoints[0].x,
    y: state.pathPoints[0].y,
    seg: 0, segT: 0,
    hp:    enemyDef.hp     * hpScale,
    maxHp: enemyDef.hp     * hpScale,
    speed: enemyDef.speed  * speedScale,
    reward: enemyDef.reward * rewardScale,
    angle: 0,
    slow: 0,
    slowT: 0,
    // Powerup-induced status (timers + colour for the corresponding glow).
    frozenT:   0,
    airborneT: 0,
    glowT:     0,
    glowColor: '#ffffff',
  });
}

// ----- Per-frame update --------------------------------------------------------

/** Advance one alien along the path; returns true if the alien reached base. */
function advanceAlongPath(enemy, dt) {
  const points = state.pathPoints;
  if (enemy.seg >= points.length - 1) return true;

  // Tick down frozen / airborne timers; while either is active the alien
  // doesn't advance, but other timers (slow) still decay.
  if (enemy.frozenT   > 0) enemy.frozenT   -= dt;
  if (enemy.airborneT > 0) enemy.airborneT -= dt;
  if (enemy.frozenT > 0 || enemy.airborneT > 0) {
    if (enemy.slowT > 0) {
      enemy.slowT -= dt;
      if (enemy.slowT <= 0) enemy.slow = 0;
    }
    if (enemy.glowT > 0) enemy.glowT -= dt;
    return false;
  }

  const segStart = points[enemy.seg];
  const segEnd   = points[enemy.seg + 1];
  const segLen   = dist(segStart, segEnd);
  const speed    = enemy.speed * (enemy.slow > 0 ? (1 - enemy.slow) : 1);

  // Find the nearest road block ahead (cannon dmg-maxed corpse). The alien's
  // progress is capped just before it.
  const myProgress = enemy.seg + enemy.segT;
  let blockAhead = Infinity;
  for (const block of state.roadBlocks) {
    const bp = block.seg + block.segT;
    if (bp > myProgress && bp < blockAhead) blockAhead = bp;
  }

  enemy.segT += (speed * dt) / segLen;
  while (enemy.segT >= 1 && enemy.seg < points.length - 1) {
    enemy.segT -= 1;
    enemy.seg += 1;
    if (enemy.seg >= points.length - 1) return true;
  }

  // Cap if we crossed a block this tick.
  if (blockAhead !== Infinity) {
    const newProgress = enemy.seg + enemy.segT;
    if (newProgress >= blockAhead) {
      const capped = Math.max(myProgress, blockAhead - 0.05);
      enemy.seg = Math.floor(capped);
      enemy.segT = capped - enemy.seg;
    }
  }

  // Update visual position + facing
  const a = points[enemy.seg];
  const b = points[enemy.seg + 1];
  enemy.x = lerp(a.x, b.x, enemy.segT);
  enemy.y = lerp(a.y, b.y, enemy.segT);
  enemy.angle = Math.atan2(b.y - a.y, b.x - a.x);

  // Tick down any active slow.
  if (enemy.slowT > 0) {
    enemy.slowT -= dt;
    if (enemy.slowT <= 0) enemy.slow = 0;
  }
  if (enemy.glowT > 0) enemy.glowT -= dt;
  return false;
}

/** When an alien gets through the gauntlet — damage the base, maybe lose. */
function onAlienReachedBase(enemy) {
  state.lives -= enemy.def.damage;
  sfx.baseHurt();
  enemy.dead = true;
  if (state.lives <= 0) {
    state.lives = 0;
    state.gameOver = true;
    sfx.lose();
  }
}

/** Award cash + spawn the kill-cash floater for any newly-dead aliens. */
function rewardDeadEnemies() {
  for (const enemy of state.enemies) {
    if (enemy.hp > 0 || enemy.rewarded) continue;
    enemy.rewarded = true;
    enemy.dead = true;

    const reward = Math.round(enemy.reward);
    state.cash += reward;
    sfx.kill();

    addEffect({ type: 'spark',     x: enemy.x, y: enemy.y, t: 0.4, color: enemy.def.color });
    addEffect({
      type: 'cashFloat',
      x: enemy.x,
      y: enemy.y - enemy.def.size - 4,
      t: 1.0,
      amount: reward,
    });

    // MG Damage powerup: 5% chance the corpse explodes if it had been hit
    // by a maxed-dmg MG before death (regardless of who landed the kill).
    if (enemy.mgExplodeArmed && Math.random() < MG_EXPLODE_CHANCE) {
      mgExplodeAt(enemy, enemy.mgExplodeDmg);
    }
  }
}

/** Move all aliens, handle base-reach + deaths, then prune the list. */
export function updateEnemies(dt) {
  for (const enemy of state.enemies) {
    const reachedBase = advanceAlongPath(enemy, dt);
    if (reachedBase) onAlienReachedBase(enemy);
  }
  rewardDeadEnemies();
  state.enemies = state.enemies.filter((enemy) => !enemy.dead);
}

/** Tick road blocks and prune expired ones. */
export function updateRoadBlocks(dt) {
  for (const block of state.roadBlocks) block.t -= dt;
  state.roadBlocks = state.roadBlocks.filter((b) => b.t > 0);
}

/**
 * Tick fire patches (cannon rate-maxed): damage every alien within radius
 * for `dmgPerSec * dt`, then count down lifetime.
 */
export function updateFirePatches(dt) {
  for (const fire of state.firePatches) {
    fire.t -= dt;
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0) continue;
      if (enemy.airborneT > 0) continue;  // floating above the flames
      if (Math.hypot(enemy.x - fire.x, enemy.y - fire.y) >= fire.radius) continue;
      enemy.hp -= fire.dmgPerSec * dt;
    }
  }
  state.firePatches = state.firePatches.filter((f) => f.t > 0);
}

/**
 * Tick laser-spawned dinosaurs: walk toward the nearest live alien, bite on
 * contact, expire after their lifetime.
 */
export function updateDinosaurs(dt) {
  for (const dino of state.dinosaurs) {
    dino.life -= dt;
    if (dino.attackCool > 0) dino.attackCool -= dt;
    dino.bobPhase += dt * 8;

    // Re-acquire target each frame if missing/dead.
    if (!dino.target || dino.target.hp <= 0) dino.target = nearestLiveAlien(dino);
    const target = dino.target;
    if (!target) continue;

    const dx = target.x - dino.x;
    const dy = target.y - dino.y;
    const d  = Math.hypot(dx, dy) || 1;
    if (d > LASER_DINO_REACH) {
      // Walk toward the target.
      const v = LASER_DINO_SPEED * dt;
      dino.x += (dx / d) * v;
      dino.y += (dy / d) * v;
      dino.facing = dx >= 0 ? 1 : -1;
    } else if (dino.attackCool <= 0) {
      // Bite — laser-tower's per-tick damage; tower may be gone, so use the
      // damage we captured at spawn time.
      target.hp -= dino.dmg;
      dino.attackCool = LASER_DINO_ATTACK_COOL;
      addEffect({ type: 'spark', x: target.x, y: target.y, t: 0.18, color: '#ff4040' });
    }
  }
  state.dinosaurs = state.dinosaurs.filter((d) => d.life > 0);
}

/** Nearest live alien to a point, or null. */
function nearestLiveAlien(point) {
  let best = null;
  let bestD = Infinity;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    const d = Math.hypot(enemy.x - point.x, enemy.y - point.y);
    if (d < bestD) { bestD = d; best = enemy; }
  }
  return best;
}

/**
 * Tick black doors (cannon range-maxed): any alien overlapping a door is
 * teleported back to the spawn point. Doors expire on a timer.
 */
export function updateBlackDoors(dt) {
  for (const door of state.blackDoors) {
    door.t -= dt;
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0) continue;
      if (enemy.airborneT > 0) continue;  // floating above the door
      if (Math.hypot(enemy.x - door.x, enemy.y - door.y) >= door.radius) continue;
      // Teleport to the start of the path.
      enemy.seg = 0;
      enemy.segT = 0;
      const start = state.pathPoints[0];
      enemy.x = start.x;
      enemy.y = start.y;
    }
  }
  state.blackDoors = state.blackDoors.filter((d) => d.t > 0);
}
