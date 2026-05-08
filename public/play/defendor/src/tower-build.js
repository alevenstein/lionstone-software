// -----------------------------------------------------------------------------
// Tower lifecycle: place a tower, upgrade one of its three tracks, sell it,
// and pick a tower at a click point.
// -----------------------------------------------------------------------------
import {
  TOWER_RADIUS, MAX_TRACK_LEVEL, SELL_REFUND_FRAC, MOVE_COST_FRAC,
  MG_TEMP_DAMAGE_FRAC, MG_TEMP_DURATION,
} from './constants.js';
import { state } from './state.js';
import { TOWERS } from './data/towers.js';
import { isBuildableAt } from './map.js';
import { sfx } from './audio.js';
import { flash } from './messages.js';

/** Find the tower closest to (x, y) within click-radius, or null if none. */
export function towerAtPixel(x, y) {
  let best = null;
  let bestDist = TOWER_RADIUS * 1.4;
  for (const tower of state.towers) {
    if (tower.temp) continue;  // temp towers (MG powerup) aren't selectable
    const d = Math.hypot(tower.x - x, tower.y - y);
    if (d <= bestDist) { bestDist = d; best = tower; }
  }
  return best;
}

/**
 * Try to place `type` at pixel (x, y). Charges the cost, plays sfx, or
 * flashes a rejection message and returns silently otherwise.
 */
export function tryBuild(x, y, type) {
  const towerDef = TOWERS[type];
  if (towerDef.unlockLevel && state.level < towerDef.unlockLevel) {
    sfx.invalid();
    flash(towerDef.name + ' unlocks at level ' + towerDef.unlockLevel);
    return;
  }
  if (!isBuildableAt(x, y)) { sfx.invalid(); flash('Cannot build there'); return; }
  if (state.cash < towerDef.cost) { sfx.invalid(); flash('Not enough cash'); return; }
  state.cash -= towerDef.cost;
  state.towers.push(makeTowerInstance(towerDef, type, x, y));
  refreshAuraStats();
  sfx.build();
}

/**
 * Build a fresh tower runtime object from a definition + position.
 *
 * baseDmg / baseRange / baseRate are the un-aura'd values (mutated only by
 * upgrades). dmg / range / rate are the live effective values that combat
 * code reads — they're rederived from the base values + nearby aura towers
 * each frame by refreshAuraStats.
 */
function makeTowerInstance(towerDef, type, x, y) {
  return {
    type,
    def: towerDef,
    x, y,
    angle: -Math.PI / 2,
    cooldown: 0,
    baseDmg:   towerDef.dmg,
    baseRange: towerDef.range,
    baseRate:  towerDef.rate,
    dmg:   towerDef.dmg,
    range: towerDef.range,
    rate:  towerDef.rate,
    dmgLvl: 0,
    rateLvl: 0,
    rangeLvl: 0,
    // Laser-only ramp parameters; harmless on other towers.
    heatRate: 1.0,
    heatCap: 2.5,
    target: null,
    laserHeat: 0,
    spent: towerDef.cost,
  };
}

/** Cost of the next upgrade on the given track. */
export function upgradeCost(tower, attr) {
  const upgradeDef = tower.def.upgrades[attr];
  return Math.floor(upgradeDef.baseCost * Math.pow(upgradeDef.costMul, tower[attr + 'Lvl']));
}

/** Per-track upgrade cap; defaults to MAX_TRACK_LEVEL when unspecified. */
export function maxLevelFor(tower, attr) {
  const upgradeDef = tower.def.upgrades && tower.def.upgrades[attr];
  return (upgradeDef && upgradeDef.maxLevel) || MAX_TRACK_LEVEL;
}

/**
 * Recompute every tower's effective dmg/range/rate from its base values plus
 * any aura towers that cover it. Aura multipliers stack additively across
 * multiple aura towers of the same type. Aura towers themselves don't get
 * buffed (they neither give to nor receive from each other).
 */
export function refreshAuraStats() {
  for (const tower of state.towers) {
    if (tower.def.aura) {
      tower.dmg   = 0;
      tower.range = tower.baseRange;
      tower.rate  = 0;
      continue;
    }
    let dmgMul = 1, rangeMul = 1, rateMul = 1;
    for (const aura of state.towers) {
      if (!aura.def.aura) continue;
      if (Math.hypot(aura.x - tower.x, aura.y - tower.y) > aura.baseRange) continue;
      if      (aura.def.aura === 'dmg')   dmgMul   += aura.def.auraBonus;
      else if (aura.def.aura === 'range') rangeMul += aura.def.auraBonus;
      else if (aura.def.aura === 'rate')  rateMul  += aura.def.auraBonus;
    }
    tower.dmg   = tower.baseDmg   * dmgMul;
    tower.range = tower.baseRange * rangeMul;
    tower.rate  = tower.baseRate  * rateMul;
  }
}

/**
 * Try to upgrade `attr` ('dmg' | 'rate' | 'range') on the given tower.
 * No-op (with feedback) if the tower has no upgrade tracks (aura towers),
 * the track is at the cap, or the player can't afford the cost.
 */
export function upgradeAttr(tower, attr) {
  if (!tower.def.upgrades || !tower.def.upgrades[attr]) {
    sfx.invalid();
    flash('No ' + attr + ' upgrade for ' + tower.def.name);
    return;
  }
  const cap = maxLevelFor(tower, attr);
  if (tower[attr + 'Lvl'] >= cap) {
    sfx.invalid();
    flash('Track at max (Lv ' + cap + ')');
    return;
  }
  const upgradeDef = tower.def.upgrades[attr];
  const cost = upgradeCost(tower, attr);
  if (state.cash < cost) { sfx.invalid(); flash('Not enough cash'); return; }
  state.cash -= cost;
  tower.spent += cost;
  tower[attr + 'Lvl'] += 1;
  applyUpgradeStat(tower, attr, upgradeDef.inc);
  refreshAuraStats();
  sfx.build();
}

/**
 * Upgrade `attr` repeatedly until the player can't afford the next level
 * or the track hits MAX_TRACK_LEVEL. Plays one sfx + one summary flash
 * regardless of how many levels apply, so it doesn't spam feedback.
 */
export function upgradeAttrMax(tower, attr) {
  if (!tower.def.upgrades || !tower.def.upgrades[attr]) {
    sfx.invalid();
    flash('No ' + attr + ' upgrade for ' + tower.def.name);
    return;
  }
  const upgradeDef = tower.def.upgrades[attr];
  const cap = maxLevelFor(tower, attr);
  let count = 0;
  let totalSpent = 0;
  while (tower[attr + 'Lvl'] < cap) {
    const cost = upgradeCost(tower, attr);
    if (state.cash < cost) break;
    state.cash -= cost;
    tower.spent += cost;
    tower[attr + 'Lvl'] += 1;
    applyUpgradeStat(tower, attr, upgradeDef.inc);
    totalSpent += cost;
    count += 1;
  }
  if (count === 0) {
    sfx.invalid();
    flash(tower[attr + 'Lvl'] >= cap
      ? 'Track at max (Lv ' + cap + ')'
      : 'Not enough cash');
    return;
  }
  refreshAuraStats();
  sfx.build();
  flash('+' + count + ' ' + attr + ' (Lv ' + tower[attr + 'Lvl'] + ')  -$' + totalSpent);
}

/** Apply an upgrade increment to the appropriate base stat. */
function applyUpgradeStat(tower, attr, inc) {
  if (attr === 'dmg') {
    tower.baseDmg *= inc;
  } else if (attr === 'range') {
    tower.baseRange *= inc;
  } else if (attr === 'rate') {
    if (tower.def.isBeam) {
      // For lasers the rate-track scales beam ramp speed + ceiling instead.
      tower.heatRate *= inc;
      tower.heatCap  *= inc;
    } else {
      tower.baseRate *= inc;
    }
  }
}

/**
 * Spawn a temporary MG tower next to the target alien (or, if no target,
 * next to the parent) for the MG-rate-maxed powerup. Inherits the parent's
 * base stats × MG_TEMP_DAMAGE_FRAC. Lives for MG_TEMP_DURATION seconds
 * before being culled by updateTowers.
 *
 * Returns true if a buildable spot was found within ~15 attempts. Aura
 * buffs apply automatically (refreshAuraStats picks up the new tower).
 */
export function spawnTempMG(parent, target) {
  const def = TOWERS.mg;
  const cx = target ? target.x : parent.x;
  const cy = target ? target.y : parent.y;
  for (let attempt = 0; attempt < 15; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const r = TOWER_RADIUS * 1.6 + Math.random() * TOWER_RADIUS * 2;
    const tx = cx + Math.cos(angle) * r;
    const ty = cy + Math.sin(angle) * r;
    if (!isBuildableAt(tx, ty)) continue;
    const inst = makeTowerInstance(def, 'mg', tx, ty);
    inst.baseDmg   = parent.baseDmg * MG_TEMP_DAMAGE_FRAC;
    inst.baseRange = parent.baseRange;
    inst.baseRate  = parent.baseRate;
    inst.dmg   = inst.baseDmg;
    inst.range = inst.baseRange;
    inst.rate  = inst.baseRate;
    inst.spent = 0;
    inst.temp  = true;
    inst.tempLife      = MG_TEMP_DURATION;
    inst.tempTotalLife = MG_TEMP_DURATION;
    state.towers.push(inst);
    refreshAuraStats();
    return true;
  }
  return false;
}

// ----- Relocate (the M-hotkey "Move tower" feature) ---------------------------

/** Cost to relocate `tower`, based on cumulative purchase + upgrade spend. */
export function moveCost(tower) {
  return Math.floor(tower.spent * MOVE_COST_FRAC);
}

/**
 * Begin a relocation of `tower`. Pulls the tower out of state.towers so it
 * stops firing / participating in auras, and stores its original location
 * for cancelMove() to restore. No cash is charged here — that happens at
 * commit time. No-op (with feedback) if a move is already in flight or the
 * player can't afford the cost.
 */
export function initiateMove(tower) {
  if (state.movingTower) return;
  const cost = moveCost(tower);
  if (state.cash < cost) {
    sfx.invalid();
    flash('Need $' + cost + ' to move ' + tower.def.name);
    return;
  }
  state.movingTower = {
    tower,
    originalX: tower.x,
    originalY: tower.y,
  };
  state.towers = state.towers.filter((t) => t !== tower);
  state.selectedTower = null;
  state.selectedType = null;
  refreshAuraStats();
  flash('Tap a buildable spot — Esc / M to cancel');
}

/**
 * Commit the in-flight move at (x, y). Charges `moveCost(tower)`, places
 * the tower, refreshes auras. Returns true if successful.
 */
export function commitMove(x, y) {
  const move = state.movingTower;
  if (!move) return false;
  if (!isBuildableAt(x, y)) { sfx.invalid(); flash('Cannot move there'); return false; }
  const cost = moveCost(move.tower);
  if (state.cash < cost) { sfx.invalid(); flash('Not enough cash'); return false; }
  state.cash -= cost;
  move.tower.x = x;
  move.tower.y = y;
  state.towers.push(move.tower);
  state.movingTower = null;
  refreshAuraStats();
  sfx.build();
  return true;
}

/** Abandon the in-flight move and restore the tower to its original spot. */
export function cancelMove() {
  const move = state.movingTower;
  if (!move) return;
  move.tower.x = move.originalX;
  move.tower.y = move.originalY;
  state.towers.push(move.tower);
  state.movingTower = null;
  refreshAuraStats();
}

/** Sell a tower for a fraction of total cash spent on it. */
export function sellTower(tower) {
  const refund = Math.floor(tower.spent * SELL_REFUND_FRAC);
  state.cash += refund;
  state.towers = state.towers.filter((t) => t !== tower);
  state.selectedTower = null;
  refreshAuraStats();
  flash('+$' + refund + ' refund');
  sfx.build();
}
