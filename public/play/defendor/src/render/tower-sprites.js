// -----------------------------------------------------------------------------
// Tower sprites: a top-level dispatcher (drawTower) plus one renderer per
// tower type, the laser beam helper, and the small button-icon variants used
// by the HUD. All renderers assume the canvas has been translated to the
// tower's centre.
// -----------------------------------------------------------------------------
import { state } from '../state.js';

// ----- drawTower entry point ---------------------------------------------------

/** Draw a tower at its world position, including its level dots above. */
export function drawTower(ctx, tower) {
  ctx.save();
  ctx.translate(tower.x, tower.y);
  // Temp-tower halo (MG-rate powerup) — pulsing gold ring + body fade so it
  // reads as "this won't be here long".
  if (tower.temp) {
    const fade  = Math.min(1, tower.tempLife / 1.5);
    const pulse = 0.55 + 0.45 * Math.sin(state.time * 8);
    ctx.fillStyle = `rgba(255, 220, 100, ${0.16 * fade * pulse})`;
    ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255, 220, 100, ${0.65 * fade})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.6 + 0.4 * fade;
  }
  // Tesla multi-strike powerup: activator glows red, every linked tesla
  // glows green. Halo behind the body + shadowBlur so the body itself
  // glows in the same colour.
  if (tower.redGlowT > 0) {
    const fade = Math.min(1, tower.redGlowT / 0.4);
    ctx.fillStyle = `rgba(255, 60, 60, ${0.32 * fade})`;
    ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255, 120, 120, ${0.95 * fade})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowColor = '#ff4040';
    ctx.shadowBlur = 14 * fade;
  } else if (tower.greenGlowT > 0) {
    const fade = Math.min(1, tower.greenGlowT / 0.4);
    ctx.fillStyle = `rgba(80, 255, 80, ${0.30 * fade})`;
    ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(140, 255, 140, ${0.95 * fade})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowColor = '#60ff60';
    ctx.shadowBlur = 14 * fade;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(2, 4, 16, 7, 0, 0, Math.PI * 2); ctx.fill();
  drawTowerBody(ctx, tower);
  ctx.restore();
  drawLevelDots(ctx, tower);
}

/** Pick the type-specific renderer. */
function drawTowerBody(ctx, tower) {
  switch (tower.type) {
    case 'cannon':  return drawCannonTower(ctx, tower);
    case 'mg':      return drawMgTower(ctx, tower);
    case 'laser':   return drawLaserTower(ctx, tower);
    case 'missile': return drawMissileTower(ctx, tower);
    case 'tesla':   return drawTeslaTower(ctx, tower);
    case 'dmgAura': return drawAuraTower(ctx, '#5a1818', '#ff5040', 'DMG');
    case 'rngAura': return drawAuraTower(ctx, '#152858', '#40b8ff', 'RNG');
    case 'rteAura': return drawAuraTower(ctx, '#5a4818', '#ffd040', 'RTE');
  }
}

// ----- Aura tower body (DMG / RNG / RTE) --------------------------------------

/**
 * Pulsing pylon for an aura tower. The visible range circle is drawn
 * separately by the world renderer (drawAuraRanges) so it stays visible
 * even when the tower isn't selected.
 */
function drawAuraTower(ctx, dark, bright, letters) {
  const pulse = (Math.sin(state.time * 3) + 1) * 0.5;
  // Hex base
  ctx.fillStyle = '#1a1208';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const px = Math.cos(angle) * 14;
    const py = Math.sin(angle) * 14;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  // Inner hex
  ctx.fillStyle = dark;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const px = Math.cos(angle) * 11;
    const py = Math.sin(angle) * 11;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  // Pulsing core
  ctx.save();
  ctx.globalAlpha = 0.35 + pulse * 0.5;
  ctx.fillStyle = bright;
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Bright center dot
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
  // Letters
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letters, 0, -10);
}

// ----- Per-attribute level dots ------------------------------------------------

/** Coloured streak above a tower indicating per-track upgrade levels. */
function drawLevelDots(ctx, tower) {
  const total = tower.dmgLvl + tower.rateLvl + tower.rangeLvl;
  if (total === 0) return;
  ctx.save();
  ctx.translate(tower.x, tower.y);
  // Tesla extends well above the platform → its dots sit higher.
  const dotY = tower.type === 'tesla' ? -22 : -17;
  let dx = -Math.min(total, 8) * 2;
  const drawColoredRun = (count, color) => {
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(dx, dotY, 1.7, 0, Math.PI * 2); ctx.fill();
      dx += 4;
    }
  };
  drawColoredRun(tower.dmgLvl,   '#ff5040');
  drawColoredRun(tower.rateLvl,  '#ffd040');
  drawColoredRun(tower.rangeLvl, '#40b8ff');
  ctx.restore();
}

// ----- Cannon ------------------------------------------------------------------

function drawCannonTower(ctx, tower) {
  drawCannonBase(ctx);
  ctx.save();
  ctx.rotate(tower.angle);
  drawCannonTurret(ctx);
  ctx.restore();
}

function drawCannonBase(ctx) {
  // Sandbag-rim bunker base
  ctx.fillStyle = '#3a2a16'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a4628'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7a623a'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  // Bolt rivets
  ctx.fillStyle = '#1a1208';
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 12.6, Math.sin(angle) * 12.6, 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke();
}

function drawCannonTurret(ctx) {
  // Recoil block at the rear
  ctx.fillStyle = '#2a1c10'; ctx.fillRect(-7, -5, 6, 10);
  ctx.fillStyle = '#3a2818'; ctx.fillRect(-7, -5, 6, 1.5);
  // Breech / pivot collar
  ctx.fillStyle = '#3a2818'; ctx.beginPath(); ctx.arc(-2, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a3e22'; ctx.beginPath(); ctx.arc(-2, 0, 4.5, 0, Math.PI * 2); ctx.fill();
  // Tapered barrel
  ctx.fillStyle = '#1a1208';
  ctx.beginPath();
  ctx.moveTo(-1, -3.5); ctx.lineTo(15, -3);
  ctx.lineTo(15,  3);   ctx.lineTo(-1,  3.5);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3a2818'; ctx.fillRect(-1, -3.5, 16, 1.2);
  // Reinforcement bands
  ctx.fillStyle = '#0a0805';
  ctx.fillRect(2, -3.5, 1.2, 7);
  ctx.fillRect(8, -3.4, 1.2, 6.8);
  // Muzzle flange + bore
  ctx.fillStyle = '#0a0805'; ctx.fillRect(15, -4.2, 2, 8.4);
  ctx.fillStyle = '#000';    ctx.beginPath(); ctx.arc(16, 0, 1.6, 0, Math.PI * 2); ctx.fill();
}

// ----- MG ----------------------------------------------------------------------

function drawMgTower(ctx, tower) {
  drawMgBase(ctx);
  ctx.save();
  ctx.rotate(tower.angle);
  drawMgTurret(ctx);
  ctx.restore();
}

function drawMgBase(ctx) {
  // Tripod legs + foot pads
  ctx.fillStyle = '#1a1a16';
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + Math.PI / 6;
    ctx.save();
    ctx.rotate(angle);
    ctx.fillRect(5, -1.4, 10, 2.8);
    ctx.fillStyle = '#2a2a26'; ctx.beginPath(); ctx.arc(15, 0, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a16';
    ctx.restore();
  }
  // Sandy platform under the tripod
  ctx.fillStyle = '#4a3a24'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  // Central swivel pad (concentric discs)
  ctx.fillStyle = '#3a3a36'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1a16'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a5a52'; ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, Math.PI * 2); ctx.fill();
}

function drawMgTurret(ctx) {
  // Receiver
  ctx.fillStyle = '#26262a'; ctx.fillRect(-5, -4, 10, 8);
  ctx.fillStyle = '#4a4a50'; ctx.fillRect(-5, -4, 10, 1.5);
  ctx.fillStyle = '#3a3a40'; ctx.fillRect(-5, 2.5, 10, 1.5);
  // Twin barrels with cooling jacket
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(2, -3,   13, 1.8);
  ctx.fillRect(2,  1.2, 13, 1.8);
  ctx.fillStyle = '#5a5a52';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(3 + i * 2.4, -3,   0.8, 1.8);
    ctx.fillRect(3 + i * 2.4,  1.2, 0.8, 1.8);
  }
  ctx.fillStyle = '#7a7a72';
  ctx.fillRect(13.5, -3.4, 1.6, 2.6);
  ctx.fillRect(13.5,  0.8, 1.6, 2.6);
  // Ammo box on the left
  ctx.fillStyle = '#7a5828'; ctx.fillRect(-9, -3.5, 4, 7);
  ctx.fillStyle = '#9a7438'; ctx.fillRect(-9, -3.5, 4, 1.5);
  ctx.fillStyle = '#3a2a14'; ctx.fillRect(-9, -3.5, 4, 7);
  ctx.fillStyle = '#7a5828'; ctx.fillRect(-8.5, -3, 3, 6);
  ctx.fillStyle = '#e8b830';
  for (let i = 0; i < 3; i++) ctx.fillRect(-5, -2.5 + i * 1.8, 2, 1.2);
  // Top sight
  ctx.fillStyle = '#0a0a0a'; ctx.fillRect(-1, -5.5, 1, 1.8);
  ctx.fillStyle = '#7a7a72'; ctx.fillRect(-1.4, -6, 1.8, 0.6);
}

// ----- Laser -------------------------------------------------------------------

function drawLaserTower(ctx, tower) {
  drawLaserBase(ctx);
  ctx.save();
  ctx.rotate(tower.angle);
  drawLaserTurret(ctx);
  ctx.restore();
}

function drawLaserBase(ctx) {
  ctx.fillStyle = '#10121a'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2a2a3a'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4a2a3a'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  // Pulsing red rim vents
  const ventPulse = 0.55 + Math.sin(state.time * 4) * 0.25;
  ctx.fillStyle = `rgba(220, 60, 60, ${ventPulse})`;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    ctx.save();
    ctx.translate(Math.cos(angle) * 12, Math.sin(angle) * 12);
    ctx.rotate(angle);
    ctx.fillRect(-1.4, -0.8, 2.8, 1.6);
    ctx.restore();
  }
  // Inner platform highlight (top half disc)
  ctx.fillStyle = '#5a3a4a';
  ctx.beginPath(); ctx.arc(0, -1, 8, 0, Math.PI); ctx.fill();
}

function drawLaserTurret(ctx) {
  // Heat-sink fins
  ctx.fillStyle = '#1a1a26';
  for (let i = -3; i <= 3; i += 2) ctx.fillRect(-9, i - 0.6, 4, 1.4);
  // Emitter housing
  ctx.fillStyle = '#5a1a1a'; ctx.fillRect(-5, -4, 14, 8);
  ctx.fillStyle = '#a83a3a'; ctx.fillRect(-5, -4, 14, 1.5);
  ctx.fillStyle = '#3a0e0e'; ctx.fillRect(-5,  2.5, 14, 1.5);
  // Energy coil rings
  ctx.fillStyle = '#a83030';
  ctx.fillRect(-2, -4.5, 1.4, 9);
  ctx.fillRect( 2, -4.5, 1.4, 9);
  ctx.fillRect( 6, -4.5, 1.4, 9);
  // Front emitter snout
  ctx.fillStyle = '#2a0a0a'; ctx.fillRect(9, -3.5, 4, 7);
  ctx.fillStyle = '#5a1a1a'; ctx.fillRect(9, -3.5, 4, 1.4);
  // Pulsing crystal lens
  const pulse = 0.55 + Math.sin(state.time * 8) * 0.45;
  ctx.fillStyle = `rgba(255, ${120 + pulse * 100}, ${100 + pulse * 60}, 1)`;
  ctx.beginPath();
  ctx.moveTo(13, -2.6);
  ctx.lineTo(15.5, 0);
  ctx.lineTo(13,  2.6);
  ctx.closePath();
  ctx.fill();
  // Bright core
  ctx.fillStyle = `rgba(255, 240, 200, ${pulse})`;
  ctx.beginPath(); ctx.arc(13.6, 0, 1.3, 0, Math.PI * 2); ctx.fill();
}

// ----- Missile -----------------------------------------------------------------

function drawMissileTower(ctx, tower) {
  drawMissileBase(ctx);
  ctx.save();
  ctx.rotate(tower.angle);
  drawMissileTurret(ctx);
  ctx.restore();
}

function drawMissileBase(ctx) {
  ctx.fillStyle = '#152018'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#384a30'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#506a40'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  // Diamond armour plates
  ctx.fillStyle = '#243a1c';
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    ctx.save();
    ctx.translate(Math.cos(angle) * 12, Math.sin(angle) * 12);
    ctx.rotate(angle + Math.PI / 4);
    ctx.fillRect(-1.6, -1.6, 3.2, 3.2);
    ctx.restore();
  }
  ctx.fillStyle = '#324028'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
}

function drawMissileTurret(ctx) {
  // Targeting radar dish on the rear
  ctx.fillStyle = '#1a2614'; ctx.beginPath(); ctx.arc(-6, 0, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7a8a52'; ctx.beginPath(); ctx.arc(-6, 0, 2.2, -Math.PI / 2, Math.PI / 2); ctx.fill();
  ctx.fillStyle = '#c8d878'; ctx.fillRect(-6.5, -0.4, 5, 0.8);
  // Launcher rack
  ctx.fillStyle = '#1a2818'; ctx.fillRect(-3, -7, 14, 14);
  ctx.fillStyle = '#3a4a30'; ctx.fillRect(-3, -7, 14, 1.5);
  ctx.fillStyle = '#152018'; ctx.fillRect(-3,  5.5, 14, 1.5);
  // 2 visible launch tubes
  for (let row = 0; row < 2; row++) {
    const yOff = row === 0 ? -5 : 1;
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, yOff, 12, 4);
    ctx.fillStyle = '#4068b0'; ctx.fillRect(0.5, yOff + 0.5, 8, 3);
    ctx.fillStyle = '#28407a'; ctx.fillRect(0.5, yOff + 0.5, 8, 1.2);
    ctx.fillStyle = '#a83030';
    ctx.beginPath();
    ctx.moveTo(8.5, yOff + 0.5);
    ctx.lineTo(11,  yOff + 2);
    ctx.lineTo(8.5, yOff + 3.5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5a6a40'; ctx.fillRect(11, yOff - 0.2, 1, 4.4);
  }
  // Centre rivet line
  ctx.fillStyle = '#0a0805'; ctx.fillRect(-3, -0.6, 14, 1.2);
  ctx.fillStyle = '#a8b078';
  for (let i = 0; i < 3; i++) ctx.fillRect(-1 + i * 5, -0.4, 1, 0.8);
}

// ----- Tesla -------------------------------------------------------------------

/** Tesla doesn't rotate — it's omnidirectional. */
function drawTeslaTower(ctx) {
  drawTeslaBase(ctx);
  drawTeslaColumn(ctx);
  drawTeslaSphere(ctx);
  drawTeslaArcs(ctx);
}

function drawTeslaBase(ctx) {
  ctx.fillStyle = '#1a0e26'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a2058'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a3a8a'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7a5aa8'; ctx.beginPath(); ctx.arc(0, -1, 8, Math.PI, Math.PI * 2); ctx.fill();
  // Concentric coil-winding rings
  ctx.strokeStyle = 'rgba(40, 20, 80, 0.6)';
  ctx.lineWidth = 1;
  for (let radius = 4; radius <= 9; radius += 1.8) {
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
  }
  // Grounding rods
  ctx.fillStyle = '#2a1a08';
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 12.5, Math.sin(angle) * 12.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTeslaColumn(ctx) {
  ctx.fillStyle = '#2a1a10'; ctx.fillRect(-3.2, -10, 6.4, 9);
  ctx.fillStyle = '#5a3a18'; ctx.fillRect(-3.2, -10, 6.4, 1.4);
  // Diagonal copper coil winding
  ctx.strokeStyle = '#c87a30';
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 7; i++) {
    const yy = -9.5 + i * 1.3;
    ctx.beginPath();
    ctx.moveTo(-3.2, yy);
    ctx.lineTo( 3.2, yy + 0.7);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(2, -10, 1.4, 9);
}

function drawTeslaSphere(ctx) {
  ctx.fillStyle = '#1a1018'; ctx.beginPath(); ctx.arc(0, -12, 5.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#a8a8c0'; ctx.beginPath(); ctx.arc(0, -12, 4.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d8d8e8'; ctx.beginPath(); ctx.arc(-1.4, -13.2, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#888098'; ctx.beginPath(); ctx.ellipse(0, -10.8, 4.4, 1.2, 0, 0, Math.PI); ctx.fill();
}

function drawTeslaArcs(ctx) {
  const t = state.time;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const seed = Math.sin(t * (5 + i) + i * 1.7);
    const angle = (i / 4) * Math.PI * 2 + t * 0.6 + seed * 0.4;
    const length = 5 + Math.abs(Math.sin(t * 9 + i * 2)) * 4;
    const sx = Math.cos(angle) * 4.2;
    const sy = -12 + Math.sin(angle) * 4.2;
    const ex = Math.cos(angle) * (4.2 + length);
    const ey = -12 + Math.sin(angle) * (4.2 + length);
    const mx = (sx + ex) / 2 + (Math.random() - 0.5) * 2.2;
    const my = (sy + ey) / 2 + (Math.random() - 0.5) * 2.2;
    ctx.strokeStyle = `rgba(180, 140, 255, ${0.45 + Math.abs(seed) * 0.4})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(mx, my); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 + Math.abs(seed) * 0.3})`;
    ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(mx, my); ctx.lineTo(ex, ey); ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

// ----- Laser beam --------------------------------------------------------------

/** Animated laser beam from the tower's barrel tip to its target. */
export function drawBeam(ctx, tower) {
  const target = tower.target;
  const startX = tower.x + Math.cos(tower.angle) * 14;
  const startY = tower.y + Math.sin(tower.angle) * 14;
  ctx.save();
  ctx.lineCap = 'round';
  // Outer beam — flickers slightly with sin-wave alpha
  ctx.strokeStyle = `rgba(255, 80, 60, ${0.7 + Math.sin(state.time * 30) * 0.2})`;
  ctx.lineWidth = 3 + Math.min(2.5, tower.laserHeat);
  ctx.beginPath();
  ctx.moveTo(startX, startY); ctx.lineTo(target.x, target.y); ctx.stroke();
  // Hot core
  ctx.strokeStyle = 'rgba(255, 240, 200, 0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(startX, startY); ctx.lineTo(target.x, target.y); ctx.stroke();
  // Hit glow
  ctx.fillStyle = 'rgba(255, 200, 120, 0.6)';
  ctx.beginPath();
  ctx.arc(target.x, target.y, 6 + Math.sin(state.time * 30) * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ----- HUD button-icon variants ------------------------------------------------

/**
 * Mini tower icon for the HUD button bar. Origin (0,0) is the icon centre;
 * scaled to fit a button slot.
 */
export function drawTowerButtonIcon(ctx, type) {
  switch (type) {
    case 'cannon':  return drawCannonButtonIcon(ctx);
    case 'mg':      return drawMgButtonIcon(ctx);
    case 'laser':   return drawLaserButtonIcon(ctx);
    case 'missile': return drawMissileButtonIcon(ctx);
    case 'tesla':   return drawTeslaButtonIcon(ctx);
    case 'dmgAura': return drawAuraButtonIcon(ctx, '#5a1818', '#ff5040', 'DMG');
    case 'rngAura': return drawAuraButtonIcon(ctx, '#152858', '#40b8ff', 'RNG');
    case 'rteAura': return drawAuraButtonIcon(ctx, '#5a4818', '#ffd040', 'RTE');
  }
}

function drawAuraButtonIcon(ctx, dark, bright, letters) {
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = bright;
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = bright;
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letters, 0, 1);
}

function drawCannonButtonIcon(ctx) {
  ctx.fillStyle = '#3a2a16'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a4628'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7a623a'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1208';
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    ctx.beginPath(); ctx.arc(Math.cos(angle) * 9, Math.sin(angle) * 9, 0.7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#3a2818'; ctx.beginPath(); ctx.arc(-2, 0, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1208'; ctx.fillRect(-1, -2.5, 12, 5);
  ctx.fillStyle = '#3a2818'; ctx.fillRect(-1, -2.5, 12, 1);
  ctx.fillStyle = '#0a0805'; ctx.fillRect(10, -3, 1.6, 6);
  ctx.fillStyle = '#000';    ctx.beginPath(); ctx.arc(11, 0, 1, 0, Math.PI * 2); ctx.fill();
}

function drawMgButtonIcon(ctx) {
  ctx.fillStyle = '#1a1a16';
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + Math.PI / 6;
    ctx.save(); ctx.rotate(angle);
    ctx.fillRect(3, -1, 8, 2);
    ctx.fillStyle = '#2a2a26'; ctx.beginPath(); ctx.arc(11, 0, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a16';
    ctx.restore();
  }
  ctx.fillStyle = '#3a3a36'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1a16'; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#26262a'; ctx.fillRect(-3, -3, 6, 6);
  ctx.fillStyle = '#4a4a50'; ctx.fillRect(-3, -3, 6, 1);
  ctx.fillStyle = '#0a0a0a'; ctx.fillRect(2, -2.4, 9, 1.4); ctx.fillRect(2, 1.0, 9, 1.4);
  ctx.fillStyle = '#5a5a52';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(3 + i * 1.8, -2.4, 0.6, 1.4);
    ctx.fillRect(3 + i * 1.8,  1.0, 0.6, 1.4);
  }
  ctx.fillStyle = '#7a7a72'; ctx.fillRect(10, -2.6, 1.2, 1.6); ctx.fillRect(10, 1.0, 1.2, 1.6);
  ctx.fillStyle = '#7a5828'; ctx.fillRect(-6, -3, 3, 5);
  ctx.fillStyle = '#9a7438'; ctx.fillRect(-6, -3, 3, 1);
  ctx.fillStyle = '#e8b830';
  for (let i = 0; i < 2; i++) ctx.fillRect(-3, -2 + i * 1.6, 1.6, 1.0);
}

function drawLaserButtonIcon(ctx) {
  ctx.fillStyle = '#10121a'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2a2a3a'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4a2a3a'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  const ventPulse = 0.5 + Math.sin(state.time * 4) * 0.3;
  ctx.fillStyle = `rgba(220, 60, 60, ${ventPulse})`;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    ctx.save();
    ctx.translate(Math.cos(angle) * 9, Math.sin(angle) * 9);
    ctx.rotate(angle);
    ctx.fillRect(-1, -0.6, 2, 1.2);
    ctx.restore();
  }
  ctx.fillStyle = '#1a1a26';
  for (let i = -2; i <= 2; i += 2) ctx.fillRect(-7, i - 0.5, 3, 1.1);
  ctx.fillStyle = '#5a1a1a'; ctx.fillRect(-4, -3, 11, 6);
  ctx.fillStyle = '#a83a3a'; ctx.fillRect(-4, -3, 11, 1.1);
  ctx.fillStyle = '#3a0e0e'; ctx.fillRect(-4,  1.9, 11, 1.1);
  ctx.fillStyle = '#a83030';
  ctx.fillRect(-1, -3.3, 1, 6.6);
  ctx.fillRect( 2, -3.3, 1, 6.6);
  ctx.fillRect( 5, -3.3, 1, 6.6);
  const pulse = 0.55 + Math.sin(state.time * 8) * 0.45;
  ctx.fillStyle = `rgba(255, ${120 + pulse * 100}, ${100 + pulse * 60}, 1)`;
  ctx.beginPath();
  ctx.moveTo(7, -2);
  ctx.lineTo(10, 0);
  ctx.lineTo(7,  2);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = `rgba(255, 240, 200, ${pulse})`;
  ctx.beginPath(); ctx.arc(8, 0, 0.9, 0, Math.PI * 2); ctx.fill();
}

function drawMissileButtonIcon(ctx) {
  ctx.fillStyle = '#152018'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#384a30'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#506a40'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#243a1c';
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    ctx.save();
    ctx.translate(Math.cos(angle) * 9, Math.sin(angle) * 9);
    ctx.rotate(angle + Math.PI / 4);
    ctx.fillRect(-1.2, -1.2, 2.4, 2.4);
    ctx.restore();
  }
  ctx.fillStyle = '#1a2614'; ctx.beginPath(); ctx.arc(-5, 0, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7a8a52'; ctx.beginPath(); ctx.arc(-5, 0, 1.6, -Math.PI / 2, Math.PI / 2); ctx.fill();
  ctx.fillStyle = '#c8d878'; ctx.fillRect(-5.4, -0.3, 4, 0.6);
  ctx.fillStyle = '#1a2818'; ctx.fillRect(-2, -5, 11, 10);
  ctx.fillStyle = '#3a4a30'; ctx.fillRect(-2, -5, 11, 1);
  ctx.fillStyle = '#152018'; ctx.fillRect(-2,  4, 11, 1);
  for (let row = 0; row < 2; row++) {
    const yOff = row === 0 ? -3.6 : 0.6;
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, yOff, 9, 3);
    ctx.fillStyle = '#4068b0'; ctx.fillRect(0.5, yOff + 0.4, 6, 2.2);
    ctx.fillStyle = '#28407a'; ctx.fillRect(0.5, yOff + 0.4, 6, 0.8);
    ctx.fillStyle = '#a83030';
    ctx.beginPath();
    ctx.moveTo(6.5, yOff + 0.4);
    ctx.lineTo(8.5, yOff + 1.5);
    ctx.lineTo(6.5, yOff + 2.6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5a6a40'; ctx.fillRect(8.5, yOff - 0.1, 0.8, 3.2);
  }
}

function drawTeslaButtonIcon(ctx) {
  ctx.fillStyle = '#1a0e26'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a2058'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a3a8a'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(40,20,80,0.6)'; ctx.lineWidth = 0.8;
  for (let radius = 3; radius <= 7; radius += 1.4) {
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = '#2a1a10'; ctx.fillRect(-2, -7, 4, 6);
  ctx.fillStyle = '#5a3a18'; ctx.fillRect(-2, -7, 4, 0.9);
  ctx.strokeStyle = '#c87a30'; ctx.lineWidth = 0.7;
  for (let i = 0; i < 5; i++) {
    const yy = -6.5 + i * 1.1;
    ctx.beginPath(); ctx.moveTo(-2, yy); ctx.lineTo(2, yy + 0.5); ctx.stroke();
  }
  ctx.fillStyle = '#1a1018'; ctx.beginPath(); ctx.arc(0, -9, 3.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#a8a8c0'; ctx.beginPath(); ctx.arc(0, -9, 2.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d8d8e8'; ctx.beginPath(); ctx.arc(-1, -9.8, 1.0, 0, Math.PI * 2); ctx.fill();
  // 2 animated arcs
  const t = state.time;
  ctx.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const seed = Math.sin(t * (5 + i) + i * 1.7);
    const angle = i === 0
      ?  0.4 + Math.sin(t * 4) * 0.3
      :  Math.PI - 0.4 - Math.sin(t * 5) * 0.3;
    const sx = Math.cos(angle) * 3, sy = -9 + Math.sin(angle) * 3;
    const ex = Math.cos(angle) * 6, ey = -9 + Math.sin(angle) * 6;
    const mx = (sx + ex) / 2 + (Math.random() - 0.5) * 1.5;
    const my = (sy + ey) / 2 + (Math.random() - 0.5) * 1.5;
    ctx.strokeStyle = `rgba(180, 140, 255, ${0.5 + Math.abs(seed) * 0.4})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(mx, my); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 + Math.abs(seed) * 0.3})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(mx, my); ctx.lineTo(ex, ey); ctx.stroke();
  }
  ctx.lineCap = 'butt';
}
