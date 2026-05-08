// -----------------------------------------------------------------------------
// Tower definitions: base stats, palette, and per-track upgrade costs.
//
// Each tower has a `focus` (its specialty) and three independent upgrade
// tracks — dmg / rate / range. The focus track is cheap and grows fast;
// non-focus tracks are more expensive and grow slowly.
//
//   Cannon  — balanced (no specialty)
//   MG      — focus = rate
//   Laser   — focus = dmg (rate-track scales the beam ramp instead)
//   Missile — focus = range
//   Tesla   — focus = dmg
//
// Per-track entry: { baseCost, costMul (per-level cost growth), inc (per-level
// stat multiplier) }.
// -----------------------------------------------------------------------------

export const TOWERS = {
  cannon: {
    name: 'Cannon', cost: 50, range: 130, dmg: 20, rate: 1.0,
    color: '#5a4628', barrel: '#2a2018',
    desc: 'Balanced single-target shells. No specialty.',
    focus: 'balanced',
    upgrades: {
      dmg:   { baseCost: 60, costMul: 1.55, inc: 1.32 },
      rate:  { baseCost: 70, costMul: 1.55, inc: 1.16 },
      range: { baseCost: 50, costMul: 1.50, inc: 1.10 },
    },
  },
  mg: {
    name: 'MG', cost: 40, range: 100, dmg: 4, rate: 6.0,
    color: '#3a3a36', barrel: '#1a1a16',
    desc: 'Rapid bullets. Specialty: fire rate.',
    focus: 'rate',
    upgrades: {
      dmg:   { baseCost: 70, costMul: 1.60, inc: 1.20 },
      rate:  { baseCost: 35, costMul: 1.40, inc: 1.24 },
      range: { baseCost: 50, costMul: 1.55, inc: 1.08 },
    },
  },
  laser: {
    name: 'Laser', cost: 90, range: 150, dmg: 48, rate: 0,
    color: '#6a1a1a', barrel: '#a83030',
    desc: 'Continuous beam, ramps on held target. Specialty: damage.',
    focus: 'dmg',
    isBeam: true,
    upgrades: {
      dmg:   { baseCost: 70, costMul: 1.45, inc: 1.40 },
      rate:  { baseCost: 90, costMul: 1.60, inc: 1.20 }, // boosts ramp speed/cap
      range: { baseCost: 60, costMul: 1.55, inc: 1.10 },
    },
  },
  missile: {
    name: 'Missile', cost: 130, range: 200, dmg: 44, rate: 0.5,
    color: '#3a5a3a', barrel: '#1a3a1a',
    desc: 'Homing splash rocket. Specialty: range.',
    focus: 'range',
    splash: 55,
    upgrades: {
      dmg:   { baseCost: 110, costMul: 1.60, inc: 1.22 },
      rate:  { baseCost: 120, costMul: 1.60, inc: 1.16 },
      range: { baseCost: 55,  costMul: 1.40, inc: 1.16 },
    },
  },
  tesla: {
    name: 'Tesla', cost: 160, range: 110, dmg: 28, rate: 1.0,
    color: '#3a2a6a', barrel: '#a888d8',
    desc: 'Chain lightning, slows. Specialty: damage.',
    focus: 'dmg',
    chain: 4, chainFalloff: 0.7,
    upgrades: {
      dmg:   { baseCost: 90,  costMul: 1.50, inc: 1.32 },
      rate:  { baseCost: 110, costMul: 1.55, inc: 1.20 },
      range: { baseCost: 80,  costMul: 1.55, inc: 1.10 },
    },
  },
  // Aura towers — unlock at level 6, don't shoot, buff every regular tower
  // within their radius. Per specs/highLevelTowers.md.
  //   Initial radius   = 32 px (= 1 tower width = TOWER_RADIUS × 2).
  //   auraBonus        = 5.0 → +500% (i.e. base × 6 when in range of one).
  //   Multiple auras of the same type stack additively.
  //
  // Each aura tower has exactly one upgrade — its range — at 5× cost
  // (500 000 → 2 500 000), maxLevel = 1, inc = 1.5 → final radius 48 px (=
  // diameter of 3 tower widths = 96 px).
  dmgAura: {
    name: 'DMG', cost: 500000, range: 32, dmg: 0, rate: 0,
    color: '#5a1818', barrel: '#ff5040',
    desc: 'Aura: +500% damage to towers in radius.',
    focus: 'dmg',
    aura: 'dmg', auraBonus: 5.0, unlockLevel: 6,
    upgrades: {
      range: { baseCost: 2500000, costMul: 1, inc: 1.5, maxLevel: 1 },
    },
  },
  rngAura: {
    name: 'RNG', cost: 500000, range: 32, dmg: 0, rate: 0,
    color: '#152858', barrel: '#40b8ff',
    desc: 'Aura: +500% range to towers in radius.',
    focus: 'range',
    aura: 'range', auraBonus: 5.0, unlockLevel: 6,
    upgrades: {
      range: { baseCost: 2500000, costMul: 1, inc: 1.5, maxLevel: 1 },
    },
  },
  rteAura: {
    name: 'RTE', cost: 500000, range: 32, dmg: 0, rate: 0,
    color: '#5a4818', barrel: '#ffd040',
    desc: 'Aura: +500% rate of fire to towers in radius.',
    focus: 'rate',
    aura: 'rate', auraBonus: 5.0, unlockLevel: 6,
    upgrades: {
      range: { baseCost: 2500000, costMul: 1, inc: 1.5, maxLevel: 1 },
    },
  },
};

/** Order tower buttons appear in the HUD bar (also drives hotkeys 1-8). */
export const TOWER_ORDER = [
  'cannon', 'mg', 'laser', 'missile', 'tesla',
  'dmgAura', 'rngAura', 'rteAura',
];
