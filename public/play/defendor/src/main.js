// -----------------------------------------------------------------------------
// Entry point. Sets up the canvas, runs the splash (which preloads the map +
// audio context and waits for a user gesture), then wires up input and starts
// the requestAnimationFrame loop.
// -----------------------------------------------------------------------------
import { state } from './state.js';
import { setupCanvas } from './canvas.js';
import { setupInput } from './input.js';
import { update } from './update.js';
import { render } from './render/render.js';
import { flash } from './messages.js';
import { showSplash } from './splash.js';

const MAX_FRAME_DT = 0.1;  // hard-cap dt so a paused tab doesn't fast-forward

/** Run the next frame: integrate the world, then render it. */
function loop(timestampMs) {
  const now = timestampMs / 1000;
  if (!state.lastT) state.lastT = now;
  let dt = now - state.lastT;
  state.lastT = now;
  if (dt > MAX_FRAME_DT) dt = MAX_FRAME_DT;

  update(dt);
  render();
  requestAnimationFrame(loop);
}

/** Cold-start: canvas → splash (waits for tap) → input → loop. */
async function init() {
  setupCanvas();
  await showSplash();
  setupInput();
  flash('Tap a tower below, then tap anywhere off the road to build.');
  requestAnimationFrame(loop);
}

init();
