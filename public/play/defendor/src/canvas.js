// -----------------------------------------------------------------------------
// Canvas setup, DPR-aware resize, and a single source of truth for keeping the
// game viewport's aspect ratio inside the browser viewport.
// -----------------------------------------------------------------------------
import { W, H } from './constants.js';
import { state } from './state.js';
import { preRenderMap } from './map.js';

/** Find the canvas element, grab a 2D context, and hook up resize listeners. */
export function setupCanvas() {
  state.canvas = document.getElementById('cv');
  state.ctx = state.canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
}

/**
 * Recompute CSS size, internal pixel size, transform, and (if the device
 * pixel ratio changed) re-render the cached map background at the new
 * native resolution.
 */
export function resize() {
  const cv = state.canvas;
  const newDpr = window.devicePixelRatio || 1;
  const prevDpr = state.dpr;
  state.dpr = newDpr;

  // Fit canvas inside viewport while preserving aspect ratio.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const aspect = W / H;
  let cssW = vw;
  let cssH = vw / aspect;
  if (cssH > vh) {
    cssH = vh;
    cssW = vh * aspect;
  }
  cv.style.width  = cssW + 'px';
  cv.style.height = cssH + 'px';
  cv.width  = Math.round(W * newDpr);
  cv.height = Math.round(H * newDpr);

  // Logical-coord drawing on a DPR-scaled backing buffer.
  state.ctx.setTransform(newDpr, 0, 0, newDpr, 0, 0);
  state.ctx.imageSmoothingEnabled = true;
  state.ctx.imageSmoothingQuality = 'high';
  state.scale = cssW / W;

  // If the DPR changed mid-session (e.g., dragging across monitors), re-render
  // the cached map at the new native resolution. Guarded so it doesn't fire
  // before the first map is built.
  if (state.pathPoints && state.pathPoints.length && prevDpr !== newDpr) {
    preRenderMap();
  }
}
