// -----------------------------------------------------------------------------
// Visual effect sprites. Each effect type has its own dedicated drawer; the
// top-level drawEffect simply dispatches to the right one.
// -----------------------------------------------------------------------------
import { lerp, formatHp } from '../math.js';

export function drawEffect(ctx, fx) {
  ctx.save();
  switch (fx.type) {
    case 'spark':     drawSpark(ctx, fx); break;
    case 'smoke':     drawSmoke(ctx, fx); break;
    case 'boom':      drawBoom(ctx, fx); break;
    case 'megaboom':  drawMegaBoom(ctx, fx); break;
    case 'nova':      drawNova(ctx, fx); break;
    case 'cashFloat': drawCashFloat(ctx, fx); break;
    case 'spring':    drawSpring(ctx, fx); break;
    case 'lightning': drawLightning(ctx, fx); break;
    case 'megaBolt':  drawMegaBolt(ctx, fx); break;
    case 'firework':  drawFirework(ctx, fx); break;
    case 'frostBurst': drawFrostBurst(ctx, fx); break;
    case 'liftBurst':  drawLiftBurst(ctx, fx); break;
  }
  ctx.restore();
}

// ----- Particles ---------------------------------------------------------------

/** Six dots radiating outward from the spawn point. */
function drawSpark(ctx, fx) {
  const alpha = fx.t / 0.4;
  ctx.fillStyle = fx.color;
  ctx.globalAlpha = alpha;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const radius = (1 - alpha) * 14;
    ctx.beginPath();
    ctx.arc(fx.x + Math.cos(angle) * radius, fx.y + Math.sin(angle) * radius, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Thin grey puff fading + expanding (left by missile trails). */
function drawSmoke(ctx, fx) {
  const alpha = fx.t / 0.6;
  ctx.fillStyle = `rgba(160,160,160,${alpha * 0.4})`;
  ctx.beginPath(); ctx.arc(fx.x, fx.y, 4 + (1 - alpha) * 4, 0, Math.PI * 2); ctx.fill();
}

// ----- Explosions --------------------------------------------------------------

/** Standard missile / projectile explosion. */
function drawBoom(ctx, fx) {
  const alpha = fx.t / 0.45;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffaa44';
  ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (1 - alpha) * 1.1, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = alpha * 0.6;
  ctx.fillStyle = '#ffe080';
  ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (1 - alpha) * 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = `rgba(255, 100, 30, ${alpha})`;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (1.2 - alpha), 0, Math.PI * 2); ctx.stroke();
}

/**
 * Nuclear-style explosion for silver-missile direct hits. Three nested
 * shockwave rings, a layered fire core (orange → yellow → white), 16
 * radiating spokes (alternating long/short), a slow-fading smoke ring, and
 * a constellation of debris specks. Lasts MEGABOOM_DURATION seconds.
 */
const MEGABOOM_DURATION = 1.2;
function drawMegaBoom(ctx, fx) {
  const alpha = Math.max(0, fx.t / MEGABOOM_DURATION);
  const inv = 1 - alpha;

  // ---- Three expanding shockwave rings (different speeds + colors) ----
  ctx.shadowColor = '#ff7020';
  ctx.shadowBlur = 18;
  // Outermost — pale yellow, fastest
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = `rgba(255, 230, 140, ${alpha})`;
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (2.2 - alpha * 1.7), 0, Math.PI * 2); ctx.stroke();
  // Middle — bright cream
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = `rgba(255, 240, 200, ${alpha * 0.9})`;
  ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (1.7 - alpha * 1.3), 0, Math.PI * 2); ctx.stroke();
  // Inner — saturated orange-red
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = `rgba(255, 110, 40, ${alpha * 0.85})`;
  ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (1.25 - alpha * 0.9), 0, Math.PI * 2); ctx.stroke();

  // ---- Layered fire core (orange → yellow → white) ----
  ctx.shadowBlur = 14;
  ctx.shadowColor = '#ffaa30';
  ctx.globalAlpha = alpha * 0.95;
  ctx.fillStyle = '#ff5818';
  ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * inv * 1.35, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = Math.pow(alpha, 0.6) * 0.95;
  ctx.fillStyle = '#ffb840';
  ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * inv * 1.05, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = Math.pow(alpha, 1.6);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * inv * 0.65, 0, Math.PI * 2); ctx.fill();

  // ---- 16 radiating spokes, alternating long/short ----
  ctx.shadowBlur = 0;
  ctx.globalAlpha = alpha * 0.95;
  ctx.strokeStyle = `rgba(255, 210, 100, ${alpha})`;
  const numSpokes = 16;
  for (let i = 0; i < numSpokes; i++) {
    const angle = (i / numSpokes) * Math.PI * 2;
    const long = i % 2 === 0;
    const r0 = fx.r * inv * 0.45;
    const r1 = fx.r * (long ? 2.1 : 1.5) * (1 - alpha * 0.45);
    ctx.lineWidth = long ? 2.6 : 1.6;
    ctx.beginPath();
    ctx.moveTo(fx.x + Math.cos(angle) * r0, fx.y + Math.sin(angle) * r0);
    ctx.lineTo(fx.x + Math.cos(angle) * r1, fx.y + Math.sin(angle) * r1);
    ctx.stroke();
  }

  // ---- Trailing smoke ring (dark, fades slowly) ----
  ctx.globalAlpha = alpha * 0.45;
  ctx.strokeStyle = '#2a1408';
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (1.55 - alpha * 0.6), 0, Math.PI * 2); ctx.stroke();

  // ---- Debris specks flying outward ----
  ctx.shadowColor = '#ffaa40';
  ctx.shadowBlur = 5;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffd870';
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + i * 0.31;
    const r = fx.r * (1.7 - alpha * 1.0);
    const px = fx.x + Math.cos(a) * r;
    const py = fx.y + Math.sin(a) * r;
    ctx.beginPath();
    ctx.arc(px, py, 1.4 + 0.6 * (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

// ----- Firework (MG damage powerup) ------------------------------------------

/**
 * Small celebratory firework — bright burst + 12 colored sparks radiating
 * outward, fading and falling slightly. fx.colors holds the per-spark
 * colors (assigned at spawn time).
 */
const FIREWORK_DURATION = 0.7;
function drawFirework(ctx, fx) {
  const alpha = Math.max(0, fx.t / FIREWORK_DURATION);
  const inv = 1 - alpha;
  // Initial bright white burst at the centre, fades fast.
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 8;
  ctx.fillStyle = `rgba(255, 255, 255, ${Math.pow(alpha, 1.5)})`;
  ctx.beginPath(); ctx.arc(fx.x, fx.y, 4 + 6 * Math.pow(alpha, 0.4), 0, Math.PI * 2); ctx.fill();
  // 12 sparks shooting outward with slight gravity drop.
  ctx.shadowBlur = 5;
  const colors = fx.colors || ['#ff4060', '#40c0ff', '#ffd040', '#80ff60', '#ff80ff'];
  const numSparks = 12;
  for (let i = 0; i < numSparks; i++) {
    const angle = (i / numSparks) * Math.PI * 2;
    const dist = inv * 26;
    const drop = inv * inv * 6;       // small parabolic fall
    const px = fx.x + Math.cos(angle) * dist;
    const py = fx.y + Math.sin(angle) * dist + drop;
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(px, py, 1.6 + alpha * 0.8, 0, Math.PI * 2); ctx.fill();
    // Trail dot
    const tx = fx.x + Math.cos(angle) * dist * 0.6;
    const ty = fx.y + Math.sin(angle) * dist * 0.6 + drop * 0.4;
    ctx.globalAlpha = alpha * 0.55;
    ctx.beginPath(); ctx.arc(tx, ty, 1.0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

// ----- Laser freeze / lift bursts --------------------------------------------

const FROST_BURST_DURATION = 0.6;
function drawFrostBurst(ctx, fx) {
  const alpha = Math.max(0, fx.t / FROST_BURST_DURATION);
  const inv = 1 - alpha;
  ctx.shadowColor = '#a8d8ff';
  ctx.shadowBlur = 10;
  // Expanding pale-blue ring
  ctx.strokeStyle = `rgba(220, 240, 255, ${alpha})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (1.2 - alpha * 0.6), 0, Math.PI * 2); ctx.stroke();
  // Soft inner glow
  ctx.fillStyle = `rgba(180, 220, 255, ${alpha * 0.4})`;
  ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * inv * 0.9, 0, Math.PI * 2); ctx.fill();
  // Six radiating crystal slivers
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const r1 = fx.r * (1.0 - alpha * 0.4);
    ctx.beginPath();
    ctx.moveTo(fx.x + Math.cos(angle) * fx.r * 0.3, fx.y + Math.sin(angle) * fx.r * 0.3);
    ctx.lineTo(fx.x + Math.cos(angle) * r1,         fx.y + Math.sin(angle) * r1);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

const LIFT_BURST_DURATION = 0.6;
function drawLiftBurst(ctx, fx) {
  const alpha = Math.max(0, fx.t / LIFT_BURST_DURATION);
  const inv = 1 - alpha;
  ctx.shadowColor = '#ffe080';
  ctx.shadowBlur = 8;
  // Upward-rising sparkles
  ctx.fillStyle = `rgba(255, 230, 140, ${alpha})`;
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const dist = fx.r * 0.8;
    const lift = inv * 22;
    const px = fx.x + Math.cos(angle) * dist * (0.5 + 0.5 * inv);
    const py = fx.y + Math.sin(angle) * dist * 0.4 - lift;
    ctx.beginPath();
    ctx.arc(px, py, 1.6 + alpha * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Glow ring
  ctx.strokeStyle = `rgba(255, 230, 140, ${alpha * 0.7})`;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (1.0 - alpha * 0.4), 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;
}

// ----- Tesla supernova (rate-maxed powerup) -----------------------------------

/**
 * Tesla supernova: cascading purple-white shockwaves + saturated core +
 * jagged lightning spokes + sparkle rim. Designed to be unmissable.
 */
const NOVA_DURATION = 1.0;
function drawNova(ctx, fx) {
  const alpha = Math.max(0, fx.t / NOVA_DURATION);
  const inv = 1 - alpha;

  // ---- Three expanding shockwaves ----
  ctx.shadowColor = '#d8b8ff';
  ctx.shadowBlur = 16;
  // Outermost — bright lavender, fastest
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = `rgba(232, 208, 255, ${alpha})`;
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (2.2 - alpha * 1.6), 0, Math.PI * 2); ctx.stroke();
  // Middle — pinkish-white
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = `rgba(255, 230, 255, ${alpha * 0.9})`;
  ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (1.6 - alpha * 1.1), 0, Math.PI * 2); ctx.stroke();
  // Inner — saturated purple
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = `rgba(170, 110, 255, ${alpha * 0.85})`;
  ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (1.15 - alpha * 0.75), 0, Math.PI * 2); ctx.stroke();

  // ---- Layered energy core (purple → magenta → white) ----
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 14;
  ctx.globalAlpha = alpha * 0.9;
  ctx.fillStyle = '#7038c8';
  ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * inv * 1.3, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = Math.pow(alpha, 0.6) * 0.9;
  ctx.fillStyle = '#c890ff';
  ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * inv * 0.95, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = Math.pow(alpha, 1.7);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * inv * 0.6, 0, Math.PI * 2); ctx.fill();

  // ---- Jagged lightning spokes (3-point per spoke for kinkiness) ----
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#ffffff';
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = `rgba(232, 208, 255, ${alpha})`;
  ctx.lineWidth = 2;
  const numSpokes = 14;
  for (let i = 0; i < numSpokes; i++) {
    const angle = (i / numSpokes) * Math.PI * 2;
    const long = i % 2 === 0;
    const r0 = fx.r * inv * 0.35;
    const r1 = fx.r * (long ? 2.0 : 1.5) * (1 - alpha * 0.45);
    const wobble = (i % 2 === 0 ? 1 : -1) * 0.18;
    const rMid = (r0 + r1) * 0.5;
    ctx.beginPath();
    ctx.moveTo(fx.x + Math.cos(angle) * r0, fx.y + Math.sin(angle) * r0);
    ctx.lineTo(
      fx.x + Math.cos(angle + wobble) * rMid,
      fx.y + Math.sin(angle + wobble) * rMid,
    );
    ctx.lineTo(fx.x + Math.cos(angle) * r1, fx.y + Math.sin(angle) * r1);
    ctx.stroke();
  }

  // ---- Sparkle rim — bright dots on the leading edge ----
  ctx.shadowBlur = 5;
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + (1 - alpha) * 0.6;  // slow rotation
    const r = fx.r * (1.95 - alpha * 1.4);
    ctx.beginPath();
    ctx.arc(fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r,
            1.6 * alpha + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

// ----- Cash floater ------------------------------------------------------------

/** "+$X" floats up + fades from each kill. Same warm yellow + drop shadow. */
function drawCashFloat(ctx, fx) {
  const alpha = fx.t / 1.0;
  const rise = (1 - alpha) * 18;
  const yPos = fx.y - rise;
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = '+$' + formatHp(fx.amount);
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.75})`;
  ctx.fillText(text, fx.x + 1, yPos + 1);
  ctx.fillStyle = `rgba(255, 248, 200, ${alpha})`;
  ctx.fillText(text, fx.x, yPos);
}

// ----- Spring (red-missile knockback indicator) --------------------------------

function drawSpring(ctx, fx) {
  // Larger, more emphatic spring — wider, taller, more peaks, with a glow.
  const dur = 0.7;
  const alpha = Math.max(0, fx.t / dur);
  const phase = Math.sin((1 - alpha) * Math.PI * 7);
  const halfW = 18 + phase * 5;
  const ampl  = 6.5 + phase * 1.5;
  const peaks = 7;
  ctx.translate(fx.x, fx.y - 3);
  // Glow halo (thick outer stroke)
  ctx.shadowColor = '#ffe080';
  ctx.shadowBlur = 8;
  ctx.strokeStyle = `rgba(255, 200, 60, ${alpha * 0.55})`;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  for (let i = 0; i <= peaks * 2; i++) {
    const x = -halfW + (halfW * 2) * (i / (peaks * 2));
    const y = (i % 2 === 0 ? -ampl : ampl);
    if (i === 0) ctx.moveTo(x, y);
    else         ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Bright zigzag core
  ctx.shadowBlur = 4;
  ctx.strokeStyle = `rgba(255, 245, 130, ${alpha})`;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let i = 0; i <= peaks * 2; i++) {
    const x = -halfW + (halfW * 2) * (i / (peaks * 2));
    const y = (i % 2 === 0 ? -ampl : ampl);
    if (i === 0) ctx.moveTo(x, y);
    else         ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Larger end-cap dots
  ctx.shadowBlur = 0;
  ctx.fillStyle = `rgba(255, 245, 180, ${alpha})`;
  ctx.beginPath(); ctx.arc(-halfW, 0, 2.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc( halfW, 0, 2.8, 0, Math.PI * 2); ctx.fill();
}

// ----- Tesla chain lightning ---------------------------------------------------

/**
 * Tesla multi-strike linking bolt — much thicker and brighter than the
 * regular chain lightning, with a wide green halo, mid-glow, and bright
 * white core. Uses shadowBlur for an electric glow.
 */
const MEGA_BOLT_DURATION = 0.8;
function drawMegaBolt(ctx, fx) {
  const alpha = Math.max(0, fx.t / MEGA_BOLT_DURATION);

  const drawJitteredPolyline = (color, width, jitter, segs) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (let i = 0; i < fx.points.length - 1; i++) {
      const a = fx.points[i];
      const b = fx.points[i + 1];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      for (let s = 1; s < segs; s++) {
        const t = s / segs;
        const x = lerp(a.x, b.x, t) + (Math.random() - 0.5) * jitter;
        const y = lerp(a.y, b.y, t) + (Math.random() - 0.5) * jitter;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  };

  // Wide outer halo (greenish-white) — the "glow" around the bolt
  ctx.shadowColor = '#80ff80';
  ctx.shadowBlur = 16;
  drawJitteredPolyline(`rgba(160, 255, 160, ${alpha * 0.7})`, 9, 14, 8);

  // Mid layer
  ctx.shadowBlur = 10;
  drawJitteredPolyline(`rgba(220, 255, 220, ${alpha * 0.95})`, 5, 10, 9);

  // Bright white core
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 6;
  drawJitteredPolyline(`rgba(255, 255, 255, ${alpha})`, 2.4, 6, 10);

  ctx.shadowBlur = 0;
}

/** Polyline from tower → first hit → next hop → … with jittered midpoints. */
function drawLightning(ctx, fx) {
  const alpha = fx.t / 0.18;

  const drawJitteredPolyline = (color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (let i = 0; i < fx.points.length - 1; i++) {
      const a = fx.points[i];
      const b = fx.points[i + 1];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      const segs = 6;
      for (let s = 1; s < segs; s++) {
        const t = s / segs;
        const x = lerp(a.x, b.x, t) + (Math.random() - 0.5) * 8;
        const y = lerp(a.y, b.y, t) + (Math.random() - 0.5) * 8;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  };

  drawJitteredPolyline(`rgba(200, 180, 255, ${alpha})`, 2);

  // Bright white core — straight (no jitter) for a clean centre line.
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < fx.points.length - 1; i++) {
    const a = fx.points[i];
    const b = fx.points[i + 1];
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
}
