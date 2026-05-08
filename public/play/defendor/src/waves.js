// -----------------------------------------------------------------------------
// Wave runner: starts waves on demand, parallel-spawns from any number of
// active waves, transitions to the next level / final victory, and runs the
// 20 s post-spawn auto-launch countdown.
// -----------------------------------------------------------------------------
import {
  AUTO_START_DELAY,
  STARTING_LIVES,
} from './constants.js';
import { state } from './state.js';
import { LEVELS, MAX_LEVEL } from './data/levels.js';
import { TOWERS, TOWER_ORDER } from './data/towers.js';
import { WAVES_PER_LEVEL, gwcOf, getWave } from './data/waves.js';
import { spawnEnemy } from './enemies.js';
import { sfx } from './audio.js';
import { flash } from './messages.js';
import { buildMap } from './map.js';

const RUSH_BONUS_BASE  = 15;
const START_BONUS_BASE = 25;
const BONUS_PER_GWC    = 1.5;
const CLEAR_BONUS_BASE = 30;
const CLEAR_BONUS_PER_WAVE = 8;
const CLEAR_BONUS_GROWTH = 1.0055;       // ^(gwc - 1)
const NEXT_LEVEL_BONUS_BASE = 500;
const NEXT_LEVEL_BONUS_PER_LEVEL = 150;

// ----- Manual / rush start -----------------------------------------------------

/**
 * Begin the next wave for the current level. If another wave is already
 * running this counts as a "rush" and grants a smaller bonus. Cancels any
 * pending auto-start countdown.
 */
export function startNextWave() {
  if (state.gameOver || state.victory) return;
  if (state.wave >= WAVES_PER_LEVEL) return;

  state.wave += 1;
  const queue = expandWaveGroups(getWave(state.wave, state.level));
  const isRush = state.activeWaves.length > 0;
  const gwc = gwcOf(state.wave, state.level);
  const bonus = Math.floor((isRush ? RUSH_BONUS_BASE : START_BONUS_BASE) + gwc * BONUS_PER_GWC);

  state.cash += bonus;
  state.activeWaves.push({ num: state.wave, queue, spawnTimer: 0 });
  state.autoStartTimer = null;

  flash(isRush
    ? 'Wave ' + state.wave + ' rushed! +$' + bonus
    : 'Wave ' + state.wave + ' incoming! +$' + bonus);
}

/** Flatten getWave's [{type, count, gap}] groups into a per-spawn queue. */
function expandWaveGroups(groups) {
  const queue = [];
  for (const group of groups) {
    for (let i = 0; i < group.count; i++) queue.push({ type: group.type, gap: group.gap });
  }
  return queue;
}

// ----- Per-frame spawn + clear -------------------------------------------------

/** Spawn pending enemies from each active wave, then resolve cleared waves. */
export function updateSpawning(dt) {
  for (const wave of state.activeWaves) drainSpawnQueue(wave, dt);
  for (let i = state.activeWaves.length - 1; i >= 0; i--) {
    const wave = state.activeWaves[i];
    if (wave.queue.length > 0) continue;
    if (state.enemies.some((enemy) => enemy.waveNum === wave.num)) continue;
    handleWaveCleared(i, wave);
  }
}

/** Pop spawns out of a single wave's queue until the gap timer is positive. */
function drainSpawnQueue(wave, dt) {
  wave.spawnTimer -= dt;
  while (wave.spawnTimer <= 0 && wave.queue.length) {
    const next = wave.queue.shift();
    spawnEnemy(next.type, wave.num);
    wave.spawnTimer += next.gap;
  }
}

/** A wave's queue is empty AND no living enemies belong to it — pay out + advance. */
function handleWaveCleared(waveIndex, wave) {
  const gwc = gwcOf(wave.num, state.level);
  const reward = Math.floor(
    (CLEAR_BONUS_BASE + wave.num * CLEAR_BONUS_PER_WAVE)
    * Math.pow(CLEAR_BONUS_GROWTH, gwc - 1),
  );
  state.cash += reward;
  state.activeWaves.splice(waveIndex, 1);
  flash('Wave ' + wave.num + ' cleared! +$' + reward);

  // Final wave of the level cleared, no parallel waves left → advance.
  if (state.wave >= WAVES_PER_LEVEL && state.activeWaves.length === 0) {
    if (state.level >= MAX_LEVEL) finishGame();
    else nextLevel();
  }
}

/** Player has cleared every wave of every level. */
function finishGame() {
  state.victory = true;
  sfx.win();
  flash('GAME COMPLETE!');
}

// ----- Level transition --------------------------------------------------------

/** Advance to the next map: rebuild map, clear board, hand out bonus + lives. */
export function nextLevel() {
  state.level += 1;
  state.wave = 0;
  state.towers = [];
  state.enemies = [];
  state.projectiles = [];
  state.effects = [];
  state.roadBlocks = [];
  state.firePatches = [];
  state.blackDoors = [];
  state.dinosaurs = [];
  state.activeWaves = [];
  state.autoStartTimer = null;
  state.selectedType = null;
  state.selectedTower = null;
  state.movingTower = null;

  const bonus = NEXT_LEVEL_BONUS_BASE + (state.level - 1) * NEXT_LEVEL_BONUS_PER_LEVEL;
  state.cash += bonus;
  state.lives = Math.max(state.lives, STARTING_LIVES);

  buildMap();
  flash('Level ' + state.level + ': ' + LEVELS[state.level - 1].name + '  •  +$' + bonus, 4.0);
  sfx.win();

  // If this level unlocks any new tower types, queue the awarded-towers popup.
  const newlyUnlocked = TOWER_ORDER.filter(
    (type) => TOWERS[type].unlockLevel === state.level,
  );
  if (newlyUnlocked.length > 0) state.newTowersPopup = newlyUnlocked;
}

// ----- Auto-start countdown ----------------------------------------------------

/**
 * After every active wave's queue is empty, arm a countdown that auto-starts
 * the next wave AUTO_START_DELAY seconds later. The countdown is cancelled
 * when startNextWave fires (manually or auto).
 */
export function updateAutoStart(dt) {
  const canStartNext = !state.gameOver && !state.victory && state.wave < WAVES_PER_LEVEL;
  if (!canStartNext) {
    state.autoStartTimer = null;
    return;
  }
  // Don't auto-start before the player launches the first wave.
  const hasStarted = state.wave >= 1;
  const allDrained = state.activeWaves.every((wave) => wave.queue.length === 0);
  if (hasStarted && allDrained && state.autoStartTimer === null) {
    state.autoStartTimer = AUTO_START_DELAY;
  }
  if (state.autoStartTimer !== null) {
    state.autoStartTimer -= dt;
    if (state.autoStartTimer <= 0) {
      state.autoStartTimer = null;
      startNextWave();
    }
  }
}
