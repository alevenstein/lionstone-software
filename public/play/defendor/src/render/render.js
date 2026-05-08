// -----------------------------------------------------------------------------
// Top-level render orchestrator. Draws the cached map, world entities, and
// finally the HUD + any modal overlays. Keeps the per-frame draw order in
// one place so it's easy to scan.
// -----------------------------------------------------------------------------
import { W, H, GAME_W, GAME_H, TOWER_RADIUS } from '../constants.js';
import { state } from '../state.js';
import { TOWERS } from '../data/towers.js';
import { mapBg, isBuildableAt } from '../map.js';
import { moveCost } from '../tower-build.js';
import { drawTower, drawBeam } from './tower-sprites.js';
import { drawEnemy } from './enemy-sprite.js';
import { drawProjectile } from './projectile-sprite.js';
import { drawEffect } from './effect-sprites.js';
import {
  drawHUD,
  drawCenterMsg,
  drawEndScreen,
  drawHelpModal,
  drawNewTowersPopup,
} from './ui.js';

export function render() {
  const ctx = state.ctx;
  ctx.clearRect(0, 0, W, H);

  // Cached map at native DPR — destination is in logical coords so it lines
  // up 1:1 with the main context's DPR transform.
  ctx.drawImage(mapBg, 0, 0, GAME_W, GAME_H);

  drawSpawnMarker(ctx, state.pathPoints[0].x, state.pathPoints[0].y);
  drawBase(ctx, state.base.x, state.base.y);
  drawAuraRanges(ctx);
  drawRoadBlocks(ctx);
  drawFirePatches(ctx);
  drawBlackDoors(ctx);
  drawPlacementPreview(ctx);
  drawMovingPreview(ctx);
  drawSelectionRing(ctx);

  for (const tower of state.towers) drawTower(ctx, tower);
  for (const enemy of state.enemies) drawEnemy(ctx, enemy);

  // Beams drawn after enemies so they sit visibly on top.
  for (const tower of state.towers) {
    if (tower.def.isBeam && tower.target) drawBeam(ctx, tower);
  }

  for (const proj of state.projectiles) drawProjectile(ctx, proj);
  for (const dino of state.dinosaurs) drawDinosaur(ctx, dino);
  for (const fx of state.effects) drawEffect(ctx, fx);

  drawHUD(ctx);

  if (state.message)  drawCenterMsg(ctx, state.message, GAME_H * 0.18);
  if (state.paused)   drawCenterMsg(ctx, 'PAUSED', GAME_H * 0.5, 36);
  if (state.gameOver) drawEndScreen(ctx, 'DEFEAT', '#a82828');
  if (state.victory)  drawEndScreen(ctx, 'VICTORY', '#28a828');
  if (state.showHelp) drawHelpModal(ctx);
  if (state.newTowersPopup) drawNewTowersPopup(ctx);
}

// ----- Spawn marker + base -----------------------------------------------------

function drawSpawnMarker(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#3a1a0a';
  ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a0805';
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  // Pulsing arrow indicating direction of travel
  const pulse = (Math.sin(state.time * 4) + 1) * 0.5;
  ctx.fillStyle = `rgba(220, 80, 60, ${0.4 + pulse * 0.5})`;
  ctx.beginPath();
  ctx.moveTo(-2, -8);
  ctx.lineTo(8, 0);
  ctx.lineTo(-2, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBase(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 4, 18, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a4a2a'; ctx.fillRect(-16, -14, 32, 26);
  ctx.fillStyle = '#5a6a3a'; ctx.fillRect(-14, -12, 28, 8);
  ctx.fillStyle = '#1a2418'; ctx.fillRect(-4, 0, 8, 12);            // door
  ctx.fillStyle = '#f0e0a0'; ctx.fillRect(-12, -10, 24, 6);          // sign bg
  ctx.fillStyle = '#3a2a18';
  ctx.font = 'bold 6px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BASE', 0, -7);
  drawBaseHpBar(ctx);
  ctx.restore();
}

function drawBaseHpBar(ctx) {
  const w = 32;
  const frac = state.lives / 20;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(-w / 2, -22, w, 4);
  ctx.fillStyle =
    frac > 0.5  ? '#3aa838' :
    frac > 0.25 ? '#d8a830' :
                  '#d83030';
  ctx.fillRect(-w / 2, -22, w * Math.max(0, frac), 4);
}

// ----- Placement preview + selection -------------------------------------------

/** Green/red ghost tower + range circle while the player is placing. */
function drawPlacementPreview(ctx) {
  if (!state.selectedType || !state.hoverPos) return;
  const towerDef = TOWERS[state.selectedType];
  const cx = state.hoverPos.x;
  const cy = state.hoverPos.y;
  const ok = isBuildableAt(cx, cy) && state.cash >= towerDef.cost;

  ctx.save();
  // Footprint disc
  ctx.fillStyle   = ok ? 'rgba(80,200,80,0.22)' : 'rgba(220,60,60,0.28)';
  ctx.beginPath(); ctx.arc(cx, cy, TOWER_RADIUS, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = ok ? 'rgba(80,200,80,0.85)' : 'rgba(220,60,60,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, TOWER_RADIUS, 0, Math.PI * 2); ctx.stroke();
  // Range ring
  ctx.fillStyle   = ok ? 'rgba(255,255,255,0.06)' : 'rgba(255,80,80,0.08)';
  ctx.beginPath(); ctx.arc(cx, cy, towerDef.range, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = ok ? 'rgba(255,255,255,0.4)' : 'rgba(255,120,120,0.55)';
  ctx.beginPath(); ctx.arc(cx, cy, towerDef.range, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

/** Corpses dropped by dmg-maxed cannons that block the path. */
function drawRoadBlocks(ctx) {
  for (const block of state.roadBlocks) {
    const fade = Math.min(1, block.t / Math.min(1.5, block.totalT));
    ctx.save();
    ctx.translate(block.x, block.y);
    // Smushed shadow under the corpse
    ctx.fillStyle = `rgba(0, 0, 0, ${0.55 * fade})`;
    ctx.beginPath();
    ctx.ellipse(0, 2, block.size * 1.4, block.size * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body — flattened ellipse in the alien's color
    ctx.fillStyle = block.color;
    ctx.globalAlpha = 0.85 * fade;
    ctx.beginPath();
    ctx.ellipse(0, 0, block.size * 1.2, block.size * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    // Dark blood stain
    ctx.fillStyle = `rgba(80, 0, 0, ${0.65 * fade})`;
    ctx.beginPath();
    ctx.ellipse(2, 1, block.size * 1.05, block.size * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tiny X eyes
    ctx.strokeStyle = `rgba(20, 0, 0, ${0.85 * fade})`;
    ctx.lineWidth = 1;
    const eo = block.size * 0.35;
    for (const ex of [-eo, eo]) {
      ctx.beginPath();
      ctx.moveTo(ex - 1.5, -1.5); ctx.lineTo(ex + 1.5,  1.5);
      ctx.moveTo(ex + 1.5, -1.5); ctx.lineTo(ex - 1.5,  1.5);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** T-rex sprite for the laser-dmg-maxed dinosaur powerup. */
function drawDinosaur(ctx, dino) {
  const fade = Math.min(1, dino.life / Math.min(1.5, dino.totalLife));
  const bob  = Math.sin(dino.bobPhase) * 0.6;
  ctx.save();
  ctx.translate(dino.x, dino.y + bob);
  // ~2× overall size — applied as a uniform scale so all the body parts
  // (tail/body/head/legs/teeth) blow up together.
  ctx.scale(2, 2);
  // Drop shadow
  ctx.fillStyle = `rgba(0,0,0,${0.4 * fade})`;
  ctx.beginPath();
  ctx.ellipse(0, 7, 8, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.scale(dino.facing, 1);
  ctx.globalAlpha = fade;
  // Tail
  ctx.fillStyle = '#3a7a40';
  ctx.beginPath();
  ctx.moveTo(-9, -1);
  ctx.lineTo(-4, -3);
  ctx.lineTo(-3, 2);
  ctx.lineTo(-9, 3);
  ctx.closePath();
  ctx.fill();
  // Body
  ctx.fillStyle = '#4ea050';
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Spine spikes
  ctx.fillStyle = '#2a5828';
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 2 - 1, -4);
    ctx.lineTo(i * 2 + 1, -4);
    ctx.lineTo(i * 2,     -7);
    ctx.closePath();
    ctx.fill();
  }
  // Legs (stomping)
  ctx.fillStyle = '#3a7a40';
  ctx.fillRect(-2, 3, 2, 4 + bob);
  ctx.fillRect( 1, 3, 2, 4 - bob);
  // Head + jaw
  ctx.fillStyle = '#5ab058';
  ctx.beginPath();
  ctx.ellipse(7, -2, 4.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eye (small white dot with red pupil)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(8, -3, 1.0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c81818';
  ctx.beginPath(); ctx.arc(8.3, -3, 0.5, 0, Math.PI * 2); ctx.fill();
  // Teeth
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(9, -0.4, 2.5, 0.8);
  ctx.fillRect(9.5, 0.6, 1.5, 0.6);
  // Tiny arms
  ctx.fillStyle = '#3a7a40';
  ctx.fillRect(2, -1, 2, 1.2);
  ctx.restore();
}

/** Animated fire patches left by rate-maxed cannons. */
function drawFirePatches(ctx) {
  for (const fire of state.firePatches) {
    const fade = Math.min(1, fire.t / Math.min(1.5, fire.totalT));
    ctx.save();
    ctx.translate(fire.x, fire.y);
    // Charred ground halo
    ctx.fillStyle = `rgba(40, 16, 8, ${0.55 * fade})`;
    ctx.beginPath(); ctx.arc(0, 0, fire.radius, 0, Math.PI * 2); ctx.fill();
    // Inner glow
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, fire.radius);
    grad.addColorStop(0,    `rgba(255, 220, 80, ${0.85 * fade})`);
    grad.addColorStop(0.55, `rgba(255, 100, 30, ${0.65 * fade})`);
    grad.addColorStop(1,    `rgba(120, 30, 10, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, fire.radius * 0.92, 0, Math.PI * 2); ctx.fill();
    // Flame tongues — pseudo-random per-frame jitter so it animates
    ctx.shadowColor = '#ff6020';
    ctx.shadowBlur = 6;
    const tongues = 7;
    const baseLife = fire.totalT - fire.t;  // grows over time
    for (let i = 0; i < tongues; i++) {
      const ang = (i / tongues) * Math.PI * 2;
      const wob = Math.sin(baseLife * 8 + i * 1.3);
      const len = fire.radius * (0.45 + 0.20 * (Math.sin(baseLife * 6 + i) * 0.5 + 0.5));
      const tx = Math.cos(ang) * len;
      const ty = Math.sin(ang) * len;
      ctx.fillStyle = `rgba(255, 200, 60, ${0.85 * fade})`;
      ctx.beginPath();
      ctx.ellipse(tx * 0.7, ty * 0.7 - 2, 4 + wob, 7 + wob, ang, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** Black-door portals from range-maxed cannons. */
function drawBlackDoors(ctx) {
  for (const door of state.blackDoors) {
    const fade = Math.min(1, door.t / Math.min(1.5, door.totalT));
    const spin = (door.totalT - door.t) * 5;
    ctx.save();
    ctx.translate(door.x, door.y);
    ctx.rotate(spin);
    // Outer purple-black halo
    ctx.shadowColor = '#a060ff';
    ctx.shadowBlur = 12;
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, door.radius * 1.5);
    grad.addColorStop(0,    `rgba(80, 0, 80, ${0.95 * fade})`);
    grad.addColorStop(0.45, `rgba(20, 0, 30, ${0.95 * fade})`);
    grad.addColorStop(1,    `rgba(40, 0, 60, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, door.radius * 1.5, 0, Math.PI * 2); ctx.fill();
    // Black core
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(0, 0, 0, ${fade})`;
    ctx.beginPath(); ctx.arc(0, 0, door.radius, 0, Math.PI * 2); ctx.fill();
    // Inner swirling rim — purple arcs
    ctx.strokeStyle = `rgba(180, 120, 255, ${fade})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, door.radius - 2, 0, Math.PI * 1.5); ctx.stroke();
    ctx.strokeStyle = `rgba(255, 220, 255, ${fade * 0.7})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, door.radius - 5, Math.PI * 0.3, Math.PI * 1.4); ctx.stroke();
    ctx.restore();
  }
}

/** Faint coloured circles for every placed aura tower's effect zone. */
function drawAuraRanges(ctx) {
  for (const tower of state.towers) {
    if (!tower.def.aura) continue;
    const color = tower.def.barrel;
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.07;
    ctx.beginPath(); ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

/**
 * Translucent ghost of a tower being relocated, plus a green/red footprint
 * + range ring at the cursor. The tower itself was already removed from
 * state.towers in initiateMove, so this is the only place it renders.
 */
function drawMovingPreview(ctx) {
  const move = state.movingTower;
  if (!move || !state.hoverPos) return;
  const tower = move.tower;
  const cx = state.hoverPos.x;
  const cy = state.hoverPos.y;
  const cost = moveCost(tower);
  const ok = isBuildableAt(cx, cy) && state.cash >= cost;

  ctx.save();
  // Range ring at the prospective location
  ctx.fillStyle = ok ? 'rgba(255,255,255,0.06)' : 'rgba(255,80,80,0.08)';
  ctx.beginPath(); ctx.arc(cx, cy, tower.range, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = ok ? 'rgba(140,255,140,0.55)' : 'rgba(255,120,120,0.65)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, tower.range, 0, Math.PI * 2); ctx.stroke();
  // Footprint disc + ring
  ctx.fillStyle = ok ? 'rgba(80,200,80,0.22)' : 'rgba(220,60,60,0.28)';
  ctx.beginPath(); ctx.arc(cx, cy, TOWER_RADIUS, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = ok ? 'rgba(80,200,80,0.85)' : 'rgba(220,60,60,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, TOWER_RADIUS, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  // Render the actual tower body translucently at the cursor — temporarily
  // patch its position so drawTower's translate lands at (cx, cy).
  const origX = tower.x;
  const origY = tower.y;
  tower.x = cx; tower.y = cy;
  ctx.save();
  ctx.globalAlpha = 0.7;
  drawTower(ctx, tower);
  ctx.restore();
  tower.x = origX; tower.y = origY;
}

/** Range ring around the currently-selected (already-built) tower. */
function drawSelectionRing(ctx) {
  if (!state.selectedTower) return;
  const tower = state.selectedTower;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath(); ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
