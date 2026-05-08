// -----------------------------------------------------------------------------
// The global mutable game state. A single object lives here and is mutated by
// every subsystem. `resetState` puts it back to the start-of-game defaults.
// -----------------------------------------------------------------------------
import { STARTING_CASH, STARTING_LIVES } from './constants.js';

export const state = {
  // Rendering / DPR
  canvas: null,
  ctx: null,
  dpr: 1,
  scale: 1,

  // World grid + path
  grid: null,
  pathTiles: [],
  pathPoints: [],
  pathLength: 0,
  base: null,
  spawn: null,

  // Active entities
  towers: [],
  enemies: [],
  projectiles: [],
  effects: [],
  // Corpses left on the path by dmg-maxed cannons. Each: { seg, segT, x, y,
  // t, color, size }. Aliens behind a block are capped at its progress until t expires.
  roadBlocks: [],
  // Burning fire patches left by rate-maxed cannons. Each: { x, y, t,
  // dmgPerSec, radius }. Damages aliens that walk through.
  firePatches: [],
  // Black portals on the road from range-maxed cannons. Each: { seg, segT,
  // x, y, t, radius }. Any alien stepping in is teleported to seg=0/segT=0.
  blackDoors: [],
  // Dinosaurs spawned by dmg-maxed lasers. Each: { x, y, vx, vy, life,
  // dmg, target, attackCool }. Walks toward nearest alien and attacks.
  dinosaurs: [],

  // Economy / progress
  cash: STARTING_CASH,
  lives: STARTING_LIVES,
  wave: 0,
  level: 1,

  // Wave runner — multiple waves can be active at once when the player rushes.
  // Each entry: { num, queue: [{type, gap}], spawnTimer }.
  activeWaves: [],
  // Seconds until the next wave auto-launches; null = disarmed.
  autoStartTimer: null,

  // Player UI selection
  selectedType: null,
  hoverPos: null,
  selectedTower: null,

  // In-flight tower-move (per the M-hotkey relocate feature). When set:
  // { tower, originalX, originalY }. The tower is pulled from state.towers
  // for the duration of the move; cancelMove restores it.
  movingTower: null,

  // Run flags
  paused: false,
  gameSpeed: 1,  // 1× / 2× / 4× — cycled by cycleGameSpeed()
  gameOver: false,
  victory: false,
  showHelp: false,
  muted: false,

  // Modal popup shown after a level-up that unlocks new tower types. Set to
  // an array of tower-type keys when active; null otherwise.
  newTowersPopup: null,

  // Loop timing
  time: 0,
  lastT: 0,

  // Centre overlay message
  message: null,
  messageT: 0,

  // Click-test rectangles refilled every render frame
  buttons: [],

  // WebAudio context (lazy-initialised)
  audio: null,
};

/** Returns the state object back to its game-start defaults. */
export function resetState() {
  state.towers = [];
  state.enemies = [];
  state.projectiles = [];
  state.effects = [];
  state.roadBlocks = [];
  state.firePatches = [];
  state.blackDoors = [];
  state.dinosaurs = [];
  state.cash = STARTING_CASH;
  state.lives = STARTING_LIVES;
  state.wave = 0;
  state.level = 1;
  state.activeWaves = [];
  state.autoStartTimer = null;
  state.selectedType = null;
  state.selectedTower = null;
  state.movingTower = null;
  state.paused = false;
  state.gameSpeed = 1;
  state.gameOver = false;
  state.victory = false;
  state.showHelp = false;
  state.newTowersPopup = null;
  state.message = null;
  state.time = 0;
}
