// -----------------------------------------------------------------------------
// Mouse / touch / keyboard input. The pointer handler converts a screen-space
// event into game pixel coordinates, then dispatches: HUD button hit-test,
// tower select, build-at-cursor, or deselect.
// -----------------------------------------------------------------------------
import { GAME_H, GAME_W } from './constants.js';
import { state } from './state.js';
import { TOWER_ORDER, TOWERS } from './data/towers.js';
import { ensureAudio, sfx } from './audio.js';
import { flash } from './messages.js';
import {
  towerAtPixel, tryBuild,
  upgradeAttr, upgradeAttrMax,
  initiateMove, commitMove, cancelMove,
} from './tower-build.js';
import { startNextWave } from './waves.js';
import { togglePause, cycleGameSpeed } from './controls.js';

// ----- Setup -------------------------------------------------------------------

/** Hook up all pointer + keyboard listeners. */
export function setupInput() {
  const cv = state.canvas;
  cv.addEventListener('mousedown',  (e) => onPointerDown(toGamePoint(cv, e)));
  cv.addEventListener('mousemove',  (e) => onPointerMove(toGamePoint(cv, e)));
  cv.addEventListener('touchstart', (e) => {
    ensureAudio();
    onPointerDown(toGamePoint(cv, e));
  }, { passive: false });
  cv.addEventListener('touchmove',  (e) => onPointerMove(toGamePoint(cv, e)), { passive: false });
  window.addEventListener('keydown', onKeyDown);
}

/** Convert a mouse / touch event into the game's logical pixel coordinates. */
function toGamePoint(cv, evt) {
  evt.preventDefault();
  const rect = cv.getBoundingClientRect();
  const t = evt.changedTouches ? evt.changedTouches[0] : evt;
  return {
    x: (t.clientX - rect.left) / state.scale,
    y: (t.clientY - rect.top)  / state.scale,
  };
}

// ----- Pointer dispatch --------------------------------------------------------

/** Called for every click / tap. Routes the click to whichever target wins. */
function onPointerDown(point) {
  // New-towers popup: any tap dismisses it (highest priority).
  if (state.newTowersPopup) {
    state.newTowersPopup = null;
    return;
  }
  // Help modal: any tap dismisses it.
  if (state.showHelp) {
    state.showHelp = false;
    return;
  }
  if (clickedHudButton(point)) return;
  if (point.y >= GAME_H || point.x < 0 || point.x >= GAME_W) return;

  // In-flight relocate: any in-game click attempts to drop the tower here.
  if (state.movingTower) {
    commitMove(point.x, point.y);
    return;
  }

  const tower = towerAtPixel(point.x, point.y);
  if (tower) {
    state.selectedTower = tower;
    state.selectedType = null;
    return;
  }
  if (state.selectedType) {
    tryBuild(point.x, point.y, state.selectedType);
    return;
  }
  state.selectedTower = null;
}

/** Hit-test the HUD's per-frame click rectangles; runs the action if hit. */
function clickedHudButton(point) {
  for (const btn of state.buttons) {
    if (point.x >= btn.x && point.x <= btn.x + btn.w &&
        point.y >= btn.y && point.y <= btn.y + btn.h) {
      btn.action();
      return true;
    }
  }
  return false;
}

/** Track the cursor while a tower type is selected, for the placement preview. */
function onPointerMove(point) {
  const insideGame =
    point.y < GAME_H && point.x >= 0 && point.x < GAME_W;
  state.hoverPos = (insideGame && (state.selectedType || state.movingTower))
    ? { x: point.x, y: point.y } : null;
}

// ----- Keyboard ----------------------------------------------------------------

function onKeyDown(evt) {
  // New-towers popup: any key dismisses it without falling through.
  if (state.newTowersPopup) {
    state.newTowersPopup = null;
    return;
  }
  switch (evt.key) {
    case ' ':       evt.preventDefault(); togglePause(); break;
    case 'Enter':   startNextWave(); break;
    case 'f': case 'F': cycleGameSpeed(); break;
    case 'h': case 'H': case '?': state.showHelp = !state.showHelp; break;
    case 's': case 'S': state.muted = !state.muted; break;
    case 'd': case 'D': tryUpgradeHotkey('dmg',   evt.shiftKey); break;
    case 'r': case 'R': tryUpgradeHotkey('rate',  evt.shiftKey); break;
    case 'g': case 'G': tryUpgradeHotkey('range', evt.shiftKey); break;
    case 'm': case 'M':
      if (state.movingTower) cancelMove();
      else if (state.selectedTower) initiateMove(state.selectedTower);
      break;
    case 'Escape':
      state.showHelp = false;
      state.selectedType = null;
      state.selectedTower = null;
      if (state.movingTower) cancelMove();
      break;
    default:
      if (evt.key >= '1' && evt.key <= '8') selectTowerByHotkey(evt.key);
  }
}

function selectTowerByHotkey(key) {
  const type = TOWER_ORDER[parseInt(key, 10) - 1];
  if (!type) return;
  const towerDef = TOWERS[type];
  if (towerDef.unlockLevel && state.level < towerDef.unlockLevel) {
    sfx.invalid();
    flash(towerDef.name + ' unlocks at level ' + towerDef.unlockLevel);
    return;
  }
  state.selectedType = state.selectedType === type ? null : type;
  state.selectedTower = null;
}

/**
 * D/R/G upgrade hotkeys — only fire when an existing tower is selected.
 * Holding Shift buys as many levels as the player can afford, capped at
 * MAX_TRACK_LEVEL.
 */
function tryUpgradeHotkey(attr, shift) {
  if (!state.selectedTower) return;
  if (shift) upgradeAttrMax(state.selectedTower, attr);
  else       upgradeAttr(state.selectedTower, attr);
}
