// -----------------------------------------------------------------------------
// HUD + UI overlays: status bar, button row (sound / help / fast / pause /
// start-wave), tower-buttons row, the per-tower upgrade panel, the centre
// flash messages, the win/lose end screen, and the help modal.
// -----------------------------------------------------------------------------
import { W, H, GAME_H, HUD_H } from '../constants.js';
import { state } from '../state.js';
import { LEVELS, MAX_LEVEL } from '../data/levels.js';
import { TOWERS, TOWER_ORDER } from '../data/towers.js';
import { WAVES_PER_LEVEL } from '../data/waves.js';
import { clamp } from '../math.js';
import {
  upgradeCost, upgradeAttr, sellTower, maxLevelFor,
  initiateMove, moveCost,
} from '../tower-build.js';
import { startNextWave } from '../waves.js';
import { togglePause, cycleGameSpeed, restart } from '../controls.js';
import { drawTowerButtonIcon } from './tower-sprites.js';

// ----- HUD entry --------------------------------------------------------------

export function drawHUD(ctx) {
  drawHudBackground(ctx);
  drawStatsLine(ctx);
  drawWaveLine(ctx);

  // Click-test rectangles are rebuilt every frame by the button drawers.
  state.buttons = [];

  drawRightSideButtons(ctx);
  drawTowerButtonRow(ctx);
  if (state.selectedTower) drawSelectedPanel(ctx);
}

// ----- HUD background ---------------------------------------------------------

function drawHudBackground(ctx) {
  const top = GAME_H;
  ctx.fillStyle = '#1a1208';
  ctx.fillRect(0, top, W, HUD_H);
  ctx.fillStyle = '#2a1c10';
  ctx.fillRect(0, top, W, 3);
  ctx.fillStyle = 'rgba(255,200,120,0.05)';
  ctx.fillRect(0, top + 3, W, HUD_H - 3);
}

// ----- Status / wave info -----------------------------------------------------

function drawStatsLine(ctx) {
  const y = GAME_H + 14;
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f0d878';
  ctx.fillText('$ ' + state.cash, 10, y);
  ctx.fillStyle = '#e0e0e0';
  ctx.fillText('Lives: ' + state.lives, 100, y);
  ctx.fillStyle = '#a8c8f0';
  ctx.fillText('L' + state.level + '/' + MAX_LEVEL + ' ' + LEVELS[state.level - 1].name, 200, y);
}

function drawWaveLine(ctx) {
  const y = GAME_H + 30;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f0a878';

  // 1-indexed display: before any wave (state.wave === 0) show "1".
  const displayWave = state.wave === 0 ? 1 : state.wave;
  const waveText = state.activeWaves.length > 1
    ? `Wave: ${displayWave} / ${WAVES_PER_LEVEL}  (${state.activeWaves.length} active)`
    : `Wave: ${displayWave} / ${WAVES_PER_LEVEL}`;
  ctx.fillText(waveText, 10, y);

  if (state.autoStartTimer !== null) {
    const seconds = Math.max(0, Math.ceil(state.autoStartTimer));
    ctx.fillStyle = seconds <= 3 ? '#ffaa44' : '#88dd88';
    ctx.fillText(
      `Next wave auto-starts in ${seconds}s`,
      10 + ctx.measureText(waveText).width + 14,
      y,
    );
  }
}

// ----- Right-side button cluster ----------------------------------------------

function drawRightSideButtons(ctx) {
  const top = GAME_H;
  const btnY = top + 5;
  const btnH = 28;

  // Sound on/off
  drawSoundButton(ctx, W - 372, btnY, 30, btnH, () => { state.muted = !state.muted; });
  // Help (red ?)
  drawHelpButton(ctx, W - 336, btnY, 30, btnH, () => { state.showHelp = !state.showHelp; });
  // Speed cycle (1× / 2× / 4×)
  const speedLabel = state.gameSpeed === 4 ? '►►► 4x'
                   : state.gameSpeed === 2 ? '►► 2x'
                   :                         '► 1x';
  drawButton(ctx, W - 300, btnY, 60, btnH, speedLabel, '#6a3a3a', cycleGameSpeed);
  // Pause
  drawButton(ctx, W - 230, btnY, 60, btnH,
    state.paused ? '▶ Play' : '❚❚ Pause',
    '#3a3a6a', togglePause);
  drawStartWaveButton(ctx, W - 160, btnY, 150, btnH);
}

/** "▶ Start Wave N" / "▶▶ Rush" / "Final wave..." / "All clear" button. */
function drawStartWaveButton(ctx, x, y, w, h) {
  const canStart = !state.gameOver && !state.victory && state.wave < WAVES_PER_LEVEL;
  const isRush   = state.activeWaves.length > 0;
  let label;
  if (state.wave >= WAVES_PER_LEVEL) {
    label = state.activeWaves.length > 0 ? 'Final wave...' : 'All clear';
  } else if (isRush) {
    const rushBonus = 15 + (state.wave + 1) * 4;
    label = '▶▶ Rush W' + (state.wave + 1) + ' +$' + rushBonus;
  } else {
    label = '▶ Start Wave ' + (state.wave + 1);
  }
  const color = canStart ? (isRush ? '#a86a28' : '#3a8a3a') : '#444';
  drawButton(ctx, x, y, w, h, label, color, () => { if (canStart) startNextWave(); });
}

// ----- Tower-button row -------------------------------------------------------

function drawTowerButtonRow(ctx) {
  const visibleTowers = TOWER_ORDER.filter((type) => {
    const def = TOWERS[type];
    return !def.unlockLevel || state.level >= def.unlockLevel;
  });
  // Compact dimensions when more than 5 are visible so all 8 fit in the row.
  const compact = visibleTowers.length > 5;
  const tbY = GAME_H + 50;
  const tbH = 38;
  const tbW = compact ? 86 : 92;
  const gap = compact ? 3 : 6;
  const fontSize = compact ? 10 : 11;
  const totalW = tbW * visibleTowers.length + gap * (visibleTowers.length - 1);
  const startX = (W - totalW) / 2;
  for (let i = 0; i < visibleTowers.length; i++) {
    const type = visibleTowers[i];
    const towerDef = TOWERS[type];
    const x = startX + i * (tbW + gap);
    const selected = state.selectedType === type;
    const afford   = state.cash >= towerDef.cost;
    drawTowerButton(ctx, x, tbY, tbW, tbH, type, towerDef, selected, afford, fontSize, () => {
      state.selectedType = state.selectedType === type ? null : type;
      state.selectedTower = null;
    });
  }
}

// ----- Generic + decorated buttons --------------------------------------------

/**
 * Plain button with centered label + click rect registration. fontSize lets
 * compact panels (like the upgrade panel) override the default 13 px text.
 */
export function drawButton(ctx, x, y, w, h, label, color, action, fontSize = 13) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold ' + fontSize + 'px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2);
  state.buttons.push({ x, y, w, h, action });
}

/** Procedural speaker icon (with optional red-X overlay when muted). */
function drawSoundButton(ctx, x, y, w, h, action) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.fillStyle = state.muted ? '#5a3434' : '#3a6a3a';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  // Speaker body + cone
  ctx.fillStyle = '#fff';
  ctx.fillRect(cx - 7, cy - 3, 4, 6);
  ctx.beginPath();
  ctx.moveTo(cx - 3, cy - 6);
  ctx.lineTo(cx + 1, cy - 8);
  ctx.lineTo(cx + 1, cy + 8);
  ctx.lineTo(cx - 3, cy + 6);
  ctx.closePath();
  ctx.fill();
  if (state.muted) {
    ctx.strokeStyle = '#ff7060';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx + 3, cy - 5); ctx.lineTo(cx + 9, cy + 5);
    ctx.moveTo(cx + 9, cy - 5); ctx.lineTo(cx + 3, cy + 5);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx + 1, cy, 5, -Math.PI / 4, Math.PI / 4); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + 1, cy, 8, -Math.PI / 4, Math.PI / 4); ctx.stroke();
  }
  state.buttons.push({ x, y, w, h, action });
}

/** Pulsing red rounded square with a bold "?". */
function drawHelpButton(ctx, x, y, w, h, action) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const pulse = state.showHelp ? 0 : (Math.sin(state.time * 4) + 1) * 0.5;
  ctx.fillStyle = state.showHelp ? '#7a1010' : '#c81818';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = `rgba(255, ${100 + pulse * 80}, ${100 + pulse * 80}, 0.9)`;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', cx, cy + 1);
  state.buttons.push({ x, y, w, h, action });
}

/** Compact tower-buy button: icon left, name + price stacked, hotkey top-right. */
function drawTowerButton(ctx, x, y, w, h, type, towerDef, selected, afford, fontSize, action) {
  ctx.fillStyle   = selected ? '#5a4628' : (afford ? '#2a1c10' : '#1a120c');
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = selected ? '#f0d878' : 'rgba(255,200,120,0.2)';
  ctx.lineWidth   = selected ? 2 : 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  // Icon (left)
  ctx.save();
  ctx.translate(x + 18, y + h / 2);
  drawTowerButtonIcon(ctx, type);
  ctx.restore();

  // Name (top) + price (bottom)
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = afford ? '#fff' : '#888';
  ctx.font = 'bold ' + fontSize + 'px system-ui, sans-serif';
  ctx.fillText(towerDef.name, x + 32, y + 12);
  ctx.fillStyle = afford ? '#f0d878' : '#664';
  ctx.font = (fontSize - 1) + 'px system-ui, sans-serif';
  ctx.fillText(formatCost(towerDef.cost), x + 32, y + 27);

  // Hotkey badge (top-right)
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '9px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('[' + (TOWER_ORDER.indexOf(type) + 1) + ']', x + w - 4, y + 10);

  state.buttons.push({ x, y, w, h, action });
}

/** Abbreviate large costs so "$100000" doesn't overflow the compact button. */
function formatCost(cost) {
  if (cost >= 1000) return '$' + (cost / 1000).toFixed(cost % 1000 === 0 ? 0 : 1) + 'k';
  return '$' + cost;
}

// ----- Selected-tower upgrade panel -------------------------------------------

const FOCUS_LABEL = { dmg: 'DMG', rate: 'RATE', range: 'RNG', balanced: 'BAL' };
const UPGRADE_TRACKS = [
  { key: 'dmg',   label: 'Damage', color: '#ff5040', hotkey: 'D' },
  { key: 'rate',  label: 'Rate',   color: '#ffc030', hotkey: 'R' },
  { key: 'range', label: 'Range',  color: '#40b8ff', hotkey: 'G' },
];

function drawSelectedPanel(ctx) {
  const tower = state.selectedTower;
  const numTracks = tower.def.upgrades ? Object.keys(tower.def.upgrades).length : 0;
  const w = 260;
  // Header (36) + N upgrade rows (26 each) + bulk-buy hint (14 if N > 1) + footer (36).
  const h = 36 + numTracks * 26 + (numTracks > 1 ? 14 : 0) + 36;
  const x = clamp(tower.x - w / 2, 6, W - w - 6);
  let y = tower.y - h - 22;
  if (y < 6) y = tower.y + 22;

  drawPanelBg(ctx, x, y, w, h);
  drawPanelHeader(ctx, tower, x, y, w);
  drawPanelStats(ctx, tower, x, y);
  if (numTracks > 0) drawPanelUpgradeRows(ctx, tower, x, y, w);
  drawPanelFooter(ctx, tower, x, y, w, h);
}

function drawPanelBg(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(20, 14, 6, 0.96)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#f0d878';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function drawPanelHeader(ctx, tower, x, y, w) {
  // Tower name (left)
  ctx.fillStyle = '#f0d878';
  ctx.font = 'bold 12px system-ui';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(tower.def.name, x + 8, y + 6);

  // Focus tag (centred)
  ctx.fillStyle = '#a8a8a8';
  ctx.font = '9px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(FOCUS_LABEL[tower.def.focus] || '', x + w / 2, y + 8);

  // Right-side: per-track levels for upgradeable towers, "AURA" tag otherwise.
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'right';
  if (tower.def.aura) {
    ctx.fillStyle = '#f0d878';
    ctx.fillText('AURA', x + w - 8, y + 8);
    return;
  }
  ctx.fillStyle = '#ff7060';  ctx.fillText('D' + tower.dmgLvl,   x + w - 64, y + 8);
  ctx.fillStyle = '#ffd040';  ctx.fillText('R' + tower.rateLvl,  x + w - 38, y + 8);
  ctx.fillStyle = '#60c0ff';  ctx.fillText('+' + tower.rangeLvl, x + w - 12, y + 8);
}

function drawPanelStats(ctx, tower, x, y) {
  ctx.fillStyle = '#d8d8d8';
  ctx.font = '10px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText(formatTowerStats(tower), x + 8, y + 22);
}

function formatTowerStats(tower) {
  if (tower.def.aura) {
    const pct = Math.round(tower.def.auraBonus * 100);
    const stat = tower.def.aura === 'dmg' ? 'damage'
               : tower.def.aura === 'rate' ? 'fire rate'
               : 'range';
    return `+${pct}% ${stat} • Radius ${Math.round(tower.range)}`;
  }
  if (tower.def.isBeam) {
    const peakDps = Math.round(tower.dmg * (1 + tower.heatCap * 0.4));
    return `DPS ${Math.round(tower.dmg)}→${peakDps} • Rng ${Math.round(tower.range)}`;
  }
  return `DPS ${Math.round(tower.dmg * tower.rate)} • Dmg ${Math.round(tower.dmg)}`
       + ` • ${tower.rate.toFixed(2)}/s • Rng ${Math.round(tower.range)}`;
}

function drawPanelUpgradeRows(ctx, tower, x, y, w) {
  const rowY0 = y + 36;
  const rowH = 26;
  // Only render rows for tracks the tower actually has (aura towers have just
  // a range track, regular towers have all three).
  const tracks = UPGRADE_TRACKS.filter(
    (t) => tower.def.upgrades && tower.def.upgrades[t.key],
  );
  for (let i = 0; i < tracks.length; i++) {
    drawUpgradeRow(ctx, tower, tracks[i], x, rowY0 + i * rowH, w);
  }
  // Discoverability hint only when there's more than one track to bulk-buy.
  if (tracks.length > 1) {
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Hold ⇧ + key to max-buy', x + w / 2, rowY0 + tracks.length * rowH + 8);
  }
}

function drawUpgradeRow(ctx, tower, track, x, rowY, w) {
  const upgradeDef = tower.def.upgrades[track.key];
  const lvl = tower[track.key + 'Lvl'];
  const cap = maxLevelFor(tower, track.key);
  const atMax = lvl >= cap;
  const incPercent = '+' + Math.round((upgradeDef.inc - 1) * 100) + '%';

  // Color swatch
  ctx.fillStyle = track.color;
  ctx.fillRect(x + 8, rowY + 3, 5, 18);
  // Label
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px system-ui';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(track.label, x + 18, rowY + 12);
  // Hotkey hint
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = 'bold 9px system-ui';
  ctx.fillText('[' + track.hotkey + ']', x + 64, rowY + 12);
  // Increment preview / MAX badge
  ctx.fillStyle = atMax ? '#ffd060' : '#a8d8a8';
  ctx.font = 'bold 10px system-ui';
  ctx.fillText(atMax ? 'MAX' : incPercent, x + 82, rowY + 12);

  // Upgrade button (or disabled MAX)
  const btnW = 110;
  const btnX = x + w - btnW - 8;
  if (atMax) {
    drawButton(ctx, btnX, rowY + 1, btnW, 21,
      '★ MAX (Lv ' + cap + ')', '#5a4628', () => {}, 11);
  } else {
    const cost = upgradeCost(tower, track.key);
    drawButton(ctx, btnX, rowY + 1, btnW, 21,
      '▲ Upgrade ' + formatCost(cost),
      state.cash >= cost ? '#3a8a3a' : '#555',
      () => upgradeAttr(tower, track.key),
      11);
  }
}

function drawPanelFooter(ctx, tower, x, y, w, h) {
  const refund = Math.floor(tower.spent * 0.65);
  const move   = moveCost(tower);
  const btnY = y + h - 26;
  drawButton(ctx, x + 8,   btnY, 70, 21,
    '✕ Sell ' + formatCost(refund), '#8a3a3a',
    () => sellTower(tower), 11);
  drawButton(ctx, x + 82,  btnY, 108, 21, // 88
    '↔ Move [M] ' + formatCost(move),
    state.cash >= move ? '#3a6a8a' : '#555',
    () => initiateMove(tower), 11);
  drawButton(ctx, x + w - 58, btnY, 50, 21, 'Close', '#444',
    () => { state.selectedTower = null; }, 11);
}

// ----- Centre messages + end screen -------------------------------------------

export function drawCenterMsg(ctx, message, y, size = 22) {
  ctx.save();
  ctx.font = 'bold ' + size + 'px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const measured = ctx.measureText(message);
  const w = measured.width + 32;
  ctx.fillStyle = 'rgba(20, 14, 6, 0.85)';
  ctx.fillRect(W / 2 - w / 2, y - size / 2 - 10, w, size + 20);
  ctx.strokeStyle = '#f0d878';
  ctx.lineWidth = 2;
  ctx.strokeRect(W / 2 - w / 2 + 1, y - size / 2 - 10 + 1, w - 2, size + 20 - 2);
  ctx.fillStyle = '#fff';
  ctx.fillText(message, W / 2, y);
  ctx.restore();
}

export function drawEndScreen(ctx, label, color) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, W, GAME_H);
  ctx.font = 'bold 64px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(label, W / 2, GAME_H / 2 - 30);
  ctx.fillStyle = '#fff';
  ctx.font = '18px system-ui';
  ctx.fillText(
    'You reached Level ' + state.level + ', Wave ' + state.wave + ' of ' + WAVES_PER_LEVEL,
    W / 2, GAME_H / 2 + 20,
  );
  // Restart button
  const bw = 160;
  const bh = 40;
  drawButton(ctx, W / 2 - bw / 2, GAME_H / 2 + 50, bw, bh, '↻ Play again', '#3a6a3a', restart);
  ctx.restore();
}

// ----- Help modal + new-towers-awarded popup ---------------------------------

const HELP_MODAL_W = 520;
const HELP_HEADER_H = 28;
const HELP_ROW_H = 48;

/**
 * "NEW TOWERS AWARDED" popup shown by waves.js after a level transition that
 * unlocks new tower types. Reuses the same row layout as the help modal so
 * the icon / name / description / cost / hotkey all align.
 */
export function drawNewTowersPopup(ctx) {
  if (!state.newTowersPopup) return;
  const types = state.newTowersPopup;
  const headerH   = 38;
  const subtitleH = 22;
  const footerH   = 26;
  const modalH    = headerH + subtitleH + 4 + types.length * HELP_ROW_H + footerH;

  ctx.save();
  // Dim the whole canvas
  ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
  ctx.fillRect(0, 0, W, H);

  const mx = (W - HELP_MODAL_W) / 2;
  const my = Math.max(4, (H - modalH) / 2);

  // Frame — gold border, slightly thicker than help modal to feel "important"
  ctx.fillStyle = '#1a1208';
  ctx.fillRect(mx, my, HELP_MODAL_W, modalH);
  ctx.strokeStyle = '#f0d878';
  ctx.lineWidth = 3;
  ctx.strokeRect(mx + 1.5, my + 1.5, HELP_MODAL_W - 3, modalH - 3);

  // Celebratory header bar
  ctx.fillStyle = '#3a2a10';
  ctx.fillRect(mx + 3, my + 3, HELP_MODAL_W - 6, headerH);
  const pulse = 0.85 + 0.15 * Math.sin(state.time * 4);
  ctx.fillStyle = `rgba(255, 224, 128, ${pulse})`;
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★  NEW TOWERS AWARDED  ★', mx + HELP_MODAL_W / 2, my + headerH / 2 + 3);

  // Subtitle: current level name (the "Level X: Name" flash gets covered by
  // this modal, so we surface it here too).
  const levelData = LEVELS[state.level - 1];
  ctx.fillStyle = 'rgba(232, 216, 168, 0.85)';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText('Level ' + state.level + ': ' + levelData.name,
               mx + HELP_MODAL_W / 2, my + headerH + subtitleH / 2);

  // Rows — reuse drawHelpRow for layout consistency
  for (let i = 0; i < types.length; i++) {
    drawHelpRow(ctx, types[i], i, mx, my + headerH + subtitleH + 4 + i * HELP_ROW_H);
  }

  // Footer hint
  ctx.fillStyle = 'rgba(240, 216, 120, 0.75)';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText('Tap anywhere or press any key to continue',
               mx + HELP_MODAL_W / 2, my + modalH - footerH / 2 - 1);

  ctx.restore();
}

export function drawHelpModal(ctx) {
  ctx.save();
  // Show only towers the player has unlocked at the current level. Modal
  // height grows when high-level towers come online so all rows fit.
  const visibleTowers = TOWER_ORDER.filter((type) => {
    const def = TOWERS[type];
    return !def.unlockLevel || state.level >= def.unlockLevel;
  });
  const helpModalH = HELP_HEADER_H + 6 + visibleTowers.length * HELP_ROW_H + 6;

  // Dim the whole canvas so a tall modal can extend over the HUD.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
  ctx.fillRect(0, 0, W, H);

  const mx = (W - HELP_MODAL_W) / 2;
  const my = Math.max(4, (H - helpModalH) / 2);

  drawHelpFrame(ctx, mx, my, helpModalH);
  drawHelpHeader(ctx, mx, my);

  for (let i = 0; i < visibleTowers.length; i++) {
    drawHelpRow(ctx, visibleTowers[i], i, mx, my + HELP_HEADER_H + 6 + i * HELP_ROW_H);
  }
  ctx.restore();
}

function drawHelpFrame(ctx, mx, my, helpModalH) {
  ctx.fillStyle = '#1a1208';
  ctx.fillRect(mx, my, HELP_MODAL_W, helpModalH);
  ctx.strokeStyle = '#f0d878';
  ctx.lineWidth = 2;
  ctx.strokeRect(mx + 1, my + 1, HELP_MODAL_W - 2, helpModalH - 2);
}

function drawHelpHeader(ctx, mx, my) {
  ctx.fillStyle = '#2a1c10';
  ctx.fillRect(mx + 2, my + 2, HELP_MODAL_W - 4, HELP_HEADER_H);
  ctx.fillStyle = '#f0d878';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Tower Reference', mx + 12, my + 16);
  ctx.fillStyle = 'rgba(240, 216, 120, 0.65)';
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Tap anywhere to close', mx + HELP_MODAL_W - 12, my + 16);
}

function drawHelpRow(ctx, type, index, mx, rowY) {
  const towerDef = TOWERS[type];
  const hotkeyNum = TOWER_ORDER.indexOf(type) + 1;

  // Alternating row tint
  if (index % 2 === 0) {
    ctx.fillStyle = 'rgba(255, 200, 120, 0.04)';
    ctx.fillRect(mx + 2, rowY, HELP_MODAL_W - 4, HELP_ROW_H - 2);
  }

  drawHelpRowIcon(ctx, type, towerDef, mx + 28, rowY + HELP_ROW_H / 2);
  drawHelpRowText(ctx, towerDef, mx, rowY);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(240, 216, 120, 0.55)';
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText('[' + hotkeyNum + ']', mx + HELP_MODAL_W - 12, rowY + 18);
}

/** Simplified mini-tower icon that uses each tower's color/barrel palette. */
function drawHelpRowIcon(ctx, type, towerDef, ix, iy) {
  ctx.save();
  ctx.translate(ix, iy);
  ctx.fillStyle = '#5a4a36';
  ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7a6a52';
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = towerDef.color;
  ctx.fillRect(-8, -8, 16, 16);
  ctx.fillStyle = towerDef.barrel;
  if (type === 'cannon') {
    ctx.fillRect(0, -3, 20, 6);
  } else if (type === 'mg') {
    ctx.fillRect(0, -3, 15, 2.5);
    ctx.fillRect(0, 0.5, 15, 2.5);
  } else if (type === 'laser') {
    ctx.fillRect(0, -2.5, 20, 5);
    ctx.fillStyle = '#ffaa44';
    ctx.fillRect(17, -1.5, 3, 3);
  } else if (type === 'missile') {
    ctx.fillRect(2, -6, 13, 4);
    ctx.fillRect(2,  2, 13, 4);
  } else if (type === 'tesla') {
    ctx.beginPath(); ctx.arc(9, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d8b8ff';
    ctx.beginPath(); ctx.arc(9, 0, 3, 0, Math.PI * 2); ctx.fill();
  } else if (towerDef.aura) {
    // Concentric pulsing rings + 3-letter glyph for aura towers.
    ctx.strokeStyle = towerDef.barrel;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0,  8, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(towerDef.name, 0, 1);
  }
  ctx.restore();
}

function drawHelpRowText(ctx, towerDef, mx, rowY) {
  // Name + cost
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#f0d878';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(towerDef.name, mx + 60, rowY + 4);
  ctx.fillStyle = '#aaffaa';
  ctx.font = 'bold 11px system-ui, sans-serif';
  const nameWidth = ctx.measureText(towerDef.name).width;
  ctx.fillText(formatCost(towerDef.cost), mx + 60 + nameWidth + 10, rowY + 6);

  // Stats line
  ctx.fillStyle = '#d8d8c8';
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText(formatHelpStats(towerDef), mx + 60, rowY + 19);

  // Description
  ctx.fillStyle = '#a8a89a';
  ctx.font = 'italic 10px system-ui, sans-serif';
  ctx.fillText(towerDef.desc, mx + 60, rowY + 33);
}

function formatHelpStats(towerDef) {
  if (towerDef.aura) {
    const pct = Math.round(towerDef.auraBonus * 100);
    const stat = towerDef.aura === 'dmg' ? 'damage'
               : towerDef.aura === 'rate' ? 'rate of fire'
               : 'range';
    return `Aura: +${pct}% ${stat} • Radius ${towerDef.range}`;
  }
  let stats = towerDef.isBeam
    ? `DPS ${towerDef.dmg} (ramps) • Rng ${towerDef.range} • Beam`
    : `Dmg ${towerDef.dmg} • Rng ${towerDef.range} • ${towerDef.rate.toFixed(1)}/s`;
  if (towerDef.splash) stats += ' • Splash ' + towerDef.splash;
  if (towerDef.chain)  stats += ' • Chain '  + towerDef.chain;
  return stats;
}
