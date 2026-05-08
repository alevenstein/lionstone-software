// -----------------------------------------------------------------------------
// Per-frame update orchestration. Runs every subsystem in order and applies
// the global pause / fast-forward / game-over gates.
// -----------------------------------------------------------------------------
import { state } from './state.js';
import { updateSpawning, updateAutoStart } from './waves.js';
import {
  updateEnemies,
  updateRoadBlocks,
  updateFirePatches,
  updateBlackDoors,
  updateDinosaurs,
} from './enemies.js';
import { updateTowers } from './tower-combat.js';
import { updateProjectiles } from './projectiles.js';
import { updateEffects } from './effects.js';

/**
 * Advance the world by `dt` seconds. The function is a no-op while paused,
 * while the help modal is open, or after a win/loss, and scales `dt` by the
 * current game-speed multiplier (1× / 2× / 4×) cycled via the speed button.
 */
export function update(rawDt) {
  if (state.paused || state.gameOver || state.victory || state.showHelp) return;
  const dt = rawDt * state.gameSpeed;
  state.time += dt;

  tickFlashMessage(dt);

  updateSpawning(dt);
  updateEnemies(dt);
  updateRoadBlocks(dt);
  updateFirePatches(dt);
  updateBlackDoors(dt);
  updateTowers(dt);
  updateDinosaurs(dt);
  updateProjectiles(dt);
  updateEffects(dt);
  updateAutoStart(dt);
}

/** Tick down any active centre-screen flash message. */
function tickFlashMessage(dt) {
  if (!state.message) return;
  state.messageT -= dt;
  if (state.messageT <= 0) state.message = null;
}
