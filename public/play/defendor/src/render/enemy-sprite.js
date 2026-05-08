// -----------------------------------------------------------------------------
// Enemy sprite. Body + shading + wiggling legs + eye dots, plus a HP bar
// (only after the alien takes damage) and a blue slow halo when slowed.
// -----------------------------------------------------------------------------
import { state } from '../state.js';
import { clamp } from '../math.js';

export function drawEnemy(ctx, enemy) {
  // Lifted aliens float above the road with their shadow on the ground.
  if (enemy.airborneT > 0) {
    drawAirborneShadow(ctx, enemy);
  }
  if (enemy.glowT > 0) drawPowerupGlow(ctx, enemy);
  drawEnemyBody(ctx, enemy);
  drawEnemyHpBar(ctx, enemy);
  drawSlowHalo(ctx, enemy);
  if (enemy.frozenT > 0)   drawFrozenOverlay(ctx, enemy);
  if (enemy.airborneT > 0) drawAirborneSwirl(ctx, enemy);
}

/**
 * Coloured glow halo for short-lived powerup states (orange = MG splash,
 * red = MG pierce). Sits behind the body, fades over its 1-second lifetime.
 */
function drawPowerupGlow(ctx, enemy) {
  const fade = Math.min(1, enemy.glowT);  // glow durations are 1s
  const lift = enemy.airborneT > 0 ? 20 : 0;
  ctx.save();
  ctx.shadowColor = enemy.glowColor;
  ctx.shadowBlur = 10;
  ctx.fillStyle = enemy.glowColor;
  ctx.globalAlpha = 0.45 * fade;
  ctx.beginPath();
  ctx.arc(enemy.x, enemy.y - lift, enemy.def.size + 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Ground shadow at the alien's path position while it's lifted overhead. */
function drawAirborneShadow(ctx, enemy) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
  ctx.beginPath();
  ctx.ellipse(enemy.x, enemy.y, enemy.def.size * 0.9, enemy.def.size * 0.35,
              0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Ice glaze + frosty glints on a frozen alien. */
function drawFrozenOverlay(ctx, enemy) {
  const lift = enemy.airborneT > 0 ? 20 : 0;
  ctx.save();
  ctx.translate(enemy.x, enemy.y - lift);
  ctx.fillStyle = 'rgba(180, 230, 255, 0.45)';
  ctx.beginPath();
  ctx.ellipse(0, 0, enemy.def.size + 2, enemy.def.size * 0.75 + 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(220, 240, 255, 0.85)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 0, enemy.def.size + 2, enemy.def.size * 0.75 + 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  // A few angular ice crystals
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + state.time * 0.5;
    const r = enemy.def.size * 0.7;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Faint upward-spiralling sparkles on an airborne alien. */
function drawAirborneSwirl(ctx, enemy) {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 220, 120, 0.65)';
  for (let i = 0; i < 4; i++) {
    const phase = state.time * 3 + i * 1.6;
    const r = 8 + (i * 2);
    const sx = enemy.x + Math.cos(phase) * r;
    const sy = enemy.y - 14 - i * 4 - Math.sin(phase) * 2;
    ctx.beginPath(); ctx.arc(sx, sy, 1.3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** Shadow + body + legs + eyes, all rotated to face direction of travel. */
function drawEnemyBody(ctx, enemy) {
  const enemyDef = enemy.def;
  // Airborne aliens rise above the path; their drop shadow is drawn
  // separately by drawAirborneShadow at the path-tracking position.
  const lift = enemy.airborneT > 0 ? 20 : 0;
  ctx.save();
  ctx.translate(enemy.x, enemy.y - lift);

  // Drop shadow on the ground (only when grounded; airborne aliens get a
  // bigger separate shadow at their path position).
  if (lift === 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(1, 2, enemyDef.size, enemyDef.size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.rotate(enemy.angle);

  // Main body
  ctx.fillStyle = enemyDef.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, enemyDef.size, enemyDef.size * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rear-side shading
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(-enemyDef.size * 0.3, 0, enemyDef.size * 0.55, enemyDef.size * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  drawEnemyLegs(ctx, enemyDef, enemy);
  drawEnemyEyes(ctx, enemyDef);

  ctx.restore();
}

/** Three legs each side that wiggle in unison. */
function drawEnemyLegs(ctx, enemyDef, enemy) {
  ctx.strokeStyle = '#1a0808';
  ctx.lineWidth = 1.4;
  // Wiggle phase varies with x so a column of aliens isn't perfectly synced.
  const wig = Math.sin(state.time * 14 + enemy.x * 0.1) * 2;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(0, enemyDef.size * 0.5);
    ctx.lineTo(i * enemyDef.size * 0.6, enemyDef.size * 0.9 + wig);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -enemyDef.size * 0.5);
    ctx.lineTo(i * enemyDef.size * 0.6, -enemyDef.size * 0.9 - wig);
    ctx.stroke();
  }
}

function drawEnemyEyes(ctx, enemyDef) {
  ctx.fillStyle = '#ffe040';
  ctx.beginPath(); ctx.arc(enemyDef.size * 0.55, -enemyDef.size * 0.25, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(enemyDef.size * 0.55,  enemyDef.size * 0.25, 1.6, 0, Math.PI * 2); ctx.fill();
}

/** HP bar appears once the alien is below max HP. */
function drawEnemyHpBar(ctx, enemy) {
  if (enemy.hp >= enemy.maxHp) return;
  const enemyDef = enemy.def;
  const barWidth = enemyDef.size * 2.4;
  const frac = clamp(enemy.hp / enemy.maxHp, 0, 1);
  const barX = enemy.x - barWidth / 2;
  const barY = enemy.y - enemyDef.size - 8;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(barX, barY, barWidth, 3);
  ctx.fillStyle =
    frac > 0.5  ? '#3aa838' :
    frac > 0.25 ? '#e8b830' :
                  '#d83030';
  ctx.fillRect(barX, barY, barWidth * frac, 3);
}

/** Soft blue glow indicating an active slow effect. */
function drawSlowHalo(ctx, enemy) {
  if (enemy.slow <= 0) return;
  ctx.save();
  ctx.fillStyle = 'rgba(120,180,255,0.4)';
  ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemy.def.size + 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
