// -----------------------------------------------------------------------------
// Splash / loading screen shown before the first game frame. Renders a title
// + progress bar on the existing canvas while running the real preload steps
// (buildMap, initAudio), then waits for a user gesture before resolving so
// the AudioContext can be resumed under a real interaction event (browser
// autoplay policy requires a gesture).
// -----------------------------------------------------------------------------
import { W, H } from './constants.js';
import { state } from './state.js';
import { buildMap } from './map.js';
import { initAudio, ensureAudio } from './audio.js';

// Each preload stage is held on screen for at least this long so the user
// can read the label, even if the underlying work finishes instantly.
const MIN_STAGE_MS = 350;

const STAGES = [
  { label: 'Preparing battlefield...', run: buildMap  },
  { label: 'Initialising audio...',    run: initAudio },
];

/** Show the splash; resolves once the user taps to start. */
export function showSplash() {
  return new Promise((resolve) => {
    const startMs = performance.now();
    let stageIdx = -1;
    let progress = 0;
    let displayProgress = 0;
    let ready = false;
    let rafId = 0;

    const advance = () => {
      stageIdx++;
      if (stageIdx >= STAGES.length) { ready = true; return; }
      const stage = STAGES[stageIdx];
      const t0 = performance.now();
      // Defer the work one frame so the new label is visible before we block.
      requestAnimationFrame(() => {
        try { stage.run(); } catch (_err) { /* swallow — splash is best-effort */ }
        const wait = Math.max(0, MIN_STAGE_MS - (performance.now() - t0));
        setTimeout(() => {
          progress = (stageIdx + 1) / STAGES.length;
          advance();
        }, wait);
      });
    };

    const frame = () => {
      displayProgress += (progress - displayProgress) * 0.18;
      const elapsed = (performance.now() - startMs) / 1000;
      const label = (stageIdx >= 0 && stageIdx < STAGES.length)
        ? STAGES[stageIdx].label
        : 'Ready.';
      drawSplash(state.ctx, { elapsed, progress: displayProgress, label, ready });
      rafId = requestAnimationFrame(frame);
    };

    const finish = (evt) => {
      if (!ready) return;
      if (evt && evt.preventDefault) evt.preventDefault();
      state.canvas.removeEventListener('mousedown',  finish);
      state.canvas.removeEventListener('touchstart', finish);
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(rafId);
      // Resume the AudioContext synchronously inside the gesture handler.
      ensureAudio();
      state.ctx.clearRect(0, 0, W, H);
      resolve();
    };
    const onKey = (evt) => {
      if (!ready) return;
      if (evt.key === ' ' || evt.key === 'Enter') finish(evt);
    };

    state.canvas.addEventListener('mousedown',  finish);
    state.canvas.addEventListener('touchstart', finish, { passive: false });
    window.addEventListener('keydown', onKey);

    frame();
    advance();
  });
}

// ----- Drawing -----------------------------------------------------------------

function drawSplash(ctx, { elapsed, progress, label, ready }) {
  drawBackground(ctx, elapsed);
  drawTitle(ctx);
  drawSubtitle(ctx);
  if (ready) drawTapToPlay(ctx, elapsed);
  else       drawProgress(ctx, progress, label);
  drawFooter(ctx);
}

function drawBackground(ctx, elapsed) {
  const grad = ctx.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.42, Math.max(W, H));
  grad.addColorStop(0,    '#4a3318');
  grad.addColorStop(0.55, '#1c1208');
  grad.addColorStop(1,    '#08060a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Drifting dust motes
  ctx.fillStyle = 'rgba(220, 190, 120, 0.08)';
  for (let i = 0; i < 60; i++) {
    const seed = i * 1.7;
    const x = ((seed * 97) + elapsed * (8 + i % 6)) % W;
    const y = ((seed * 41) + elapsed * (3 + i % 4)) % H;
    ctx.beginPath();
    ctx.arc(x, y, 1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTitle(ctx) {
  const cx = W / 2;
  const cy = H * 0.36;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 72px "Impact", "Arial Black", sans-serif';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillText('DEFENDOR', cx + 4, cy + 5);
  const grad = ctx.createLinearGradient(0, cy - 36, 0, cy + 36);
  grad.addColorStop(0, '#f0d890');
  grad.addColorStop(1, '#a87830');
  ctx.fillStyle = grad;
  ctx.fillText('DEFENDOR', cx, cy);
  // Stencil slashes (military look)
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  ctx.fillRect(cx - 150, cy - 6, 300, 3);
  ctx.fillRect(cx - 150, cy + 6, 300, 3);
  ctx.restore();
}

function drawSubtitle(ctx) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c8a868';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('— TOWER DEFENSE —', W / 2, H * 0.36 + 56);
  ctx.restore();
}

function drawProgress(ctx, progress, label) {
  const w = 340, h = 14;
  const x = (W - w) / 2;
  const y = H * 0.7;
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = '#1a1208';
  ctx.fillRect(x, y, w, h);
  const fillGrad = ctx.createLinearGradient(x, 0, x + w, 0);
  fillGrad.addColorStop(0, '#d8a830');
  fillGrad.addColorStop(1, '#f0d860');
  ctx.fillStyle = fillGrad;
  ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * progress), h - 2);
  ctx.fillStyle = '#e8d8a8';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, W / 2, y + h + 18);
  ctx.restore();
}

function drawTapToPlay(ctx, elapsed) {
  const cx = W / 2;
  const cy = H * 0.7 + 7;
  const pulse = 0.55 + 0.45 * (Math.sin(elapsed * 3.5) * 0.5 + 0.5);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = `rgba(240, 220, 140, ${pulse})`;
  ctx.font = 'bold 20px monospace';
  ctx.fillText('▶  TAP TO DEPLOY  ◀', cx, cy);
  ctx.fillStyle = 'rgba(184, 152, 104, 0.65)';
  ctx.font = '11px monospace';
  ctx.fillText('click  •  tap  •  press space', cx, cy + 24);
  ctx.restore();
}

function drawFooter(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(184, 152, 104, 0.4)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('100 waves  ×  10 levels  ×  5 towers', W / 2, H - 14);
  ctx.restore();
}
