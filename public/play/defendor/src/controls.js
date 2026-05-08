// -----------------------------------------------------------------------------
// Top-level control toggles + restart. Lives in its own module so input.js,
// ui.js, and main.js can all import these without forming a cycle.
// -----------------------------------------------------------------------------
import { state, resetState } from './state.js';
import { buildMap } from './map.js';

export function togglePause() {
  state.paused = !state.paused;
}

/** Cycle through 1× → 2× → 4× → 1× game-speed multipliers. */
const SPEED_CYCLE = [1, 2, 4];
export function cycleGameSpeed() {
  const i = SPEED_CYCLE.indexOf(state.gameSpeed);
  state.gameSpeed = SPEED_CYCLE[(i + 1) % SPEED_CYCLE.length];
}

/** Reset everything to the start of the game. */
export function restart() {
  resetState();
  buildMap();
}
