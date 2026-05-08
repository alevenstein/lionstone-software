// -----------------------------------------------------------------------------
// All numeric constants in one place. No runtime logic here.
// -----------------------------------------------------------------------------

// Tile + viewport geometry
export const TILE   = 40;
export const COLS   = 18;
export const ROWS   = 11;
export const GAME_W = COLS * TILE;          // 720 px
export const GAME_H = ROWS * TILE;          // 440 px
export const HUD_H  = 100;
export const W      = GAME_W;
export const H      = GAME_H + HUD_H;       // 540 px

// Tower geometry & placement
export const TOWER_RADIUS   = 16;
export const PATH_CLEARANCE = TILE * 0.5 + 12;
export const BASE_CLEARANCE = 30;

// Upgrade tracks
export const MAX_TRACK_LEVEL = 10;

// Missile powerup tuning
export const KNOCKBACK_DIST        = TOWER_RADIUS * 2 * 5;  // = 160 px
export const RED_MISSILE_CHANCE    = 1 / 50;
export const SILVER_MISSILE_CHANCE = 1 / 50;

// Cannon damage-maxed road-block powerup. Each kill from a dmg-maxed cannon
// has CANNON_BLOCK_CHANCE of leaving a corpse on the path that blocks other
// aliens for CANNON_BLOCK_DURATION seconds.
export const CANNON_BLOCK_CHANCE   = 0.05;
export const CANNON_BLOCK_DURATION = 5;

// Cannon rate-maxed fire-patch powerup. 1/100 shells leave a fire patch at
// the target on the road; aliens within take CANNON_FIRE_DAMAGE_FRAC × shell
// damage per second for CANNON_FIRE_DURATION seconds.
export const CANNON_FIRE_CHANCE       = 1 / 100;
export const CANNON_FIRE_DURATION     = 5;
export const CANNON_FIRE_RADIUS       = 28;
export const CANNON_FIRE_DAMAGE_FRAC  = 0.5;

// Cannon range-maxed black-door powerup. After a kill from a range-maxed
// cannon, CANNON_DOOR_CHANCE chance to open a door on the road for
// CANNON_DOOR_DURATION seconds; any alien crossing it is teleported back to
// the spawn point.
export const CANNON_DOOR_CHANCE   = 0.05;
export const CANNON_DOOR_DURATION = 5;
export const CANNON_DOOR_RADIUS   = 18;

// MG rate-maxed temporary-turret powerup. Each shot from a rate-maxed MG
// has MG_TEMP_CHANCE of spawning a temp MG next to the target alien that
// fires at MG_TEMP_DAMAGE_FRAC × the parent's damage for MG_TEMP_DURATION
// seconds. (Spec sets it to full damage; constant kept for tunability.)
export const MG_TEMP_CHANCE        = 1 / 100;
export const MG_TEMP_DURATION      = 5;
export const MG_TEMP_DAMAGE_FRAC   = 1.0;

// MG damage-maxed: when a target is killed by a dmg-maxed MG, 5% chance the
// corpse explodes, dealing splash damage to aliens within MG_EXPLODE_RADIUS
// at MG_EXPLODE_DAMAGE_FRAC × bullet dmg. Splashed aliens glow orange for
// MG_EXPLODE_GLOW_T seconds so the AoE is readable.
export const MG_EXPLODE_CHANCE       = 0.05;
export const MG_EXPLODE_RADIUS       = 32;
export const MG_EXPLODE_DAMAGE_FRAC  = 0.5;
export const MG_EXPLODE_GLOW_T       = 1.0;

// MG range-maxed: 1/20 hits pierce through to the alien immediately behind
// the target, dealing MG_PIERCE_DAMAGE_FRAC × bullet dmg. The pierced alien
// glows red for MG_PIERCE_GLOW_T seconds.
export const MG_PIERCE_CHANCE        = 1 / 20;
export const MG_PIERCE_DAMAGE_FRAC   = 0.75;
export const MG_PIERCE_SEARCH_RADIUS = 80;
export const MG_PIERCE_GLOW_T        = 1.0;

// Tesla rate-maxed supernova powerup. 1/50 shots emit an AoE blast at the
// target dealing tower.dmg as splash damage within TESLA_NOVA_RADIUS px.
export const TESLA_NOVA_CHANCE = 1 / 50;
export const TESLA_NOVA_RADIUS = 60;

// Tesla range-maxed multi-tesla strike. 1/50 shots from a range-maxed Tesla
// activate every other Tesla within its range; each linked Tesla fires a
// single bolt dealing TESLA_LINK_DAMAGE_MUL × its damage.
export const TESLA_LINK_CHANCE     = 1 / 50;
export const TESLA_LINK_DAMAGE_MUL = 1.25;

// Laser powerup roll cadence. Laser is a continuous beam so "1/50 shots"
// has to be sampled periodically — every LASER_POWERUP_INTERVAL seconds
// while the laser holds a target each maxed track rolls its own chance.
export const LASER_POWERUP_INTERVAL = 0.5;

// Laser rate-maxed: when the laser hits a target, 5% chance to freeze the
// target + nearby aliens for 5 s (rolled at LASER_POWERUP_INTERVAL cadence
// since the beam is continuous, not discrete).
export const LASER_FREEZE_CHANCE   = 0.05;
export const LASER_FREEZE_DURATION = 5;
export const LASER_FREEZE_RADIUS   = 32;

// Laser range-maxed: same cadence/chance — target + nearby lifted into air.
export const LASER_LIFT_CHANCE   = 0.05;
export const LASER_LIFT_DURATION = 5;
export const LASER_LIFT_RADIUS   = 32;

// Laser dmg-maxed: when a dmg-maxed laser kills a target, 5% chance a
// dinosaur appears and attacks aliens for 10 s.
export const LASER_DINO_CHANCE      = 0.05;
export const LASER_DINO_DURATION    = 10;
export const LASER_DINO_SPEED       = 70;
export const LASER_DINO_ATTACK_COOL = 0.55;
export const LASER_DINO_REACH       = 24;

// Tile types (kept numeric for dense Uint8 grids)
export const T_SAND  = 0;
export const T_PATH  = 1;
export const T_BASE  = 2;
export const T_SPAWN = 3;

// Auto-launch the next wave this many seconds after the previous wave's
// last alien spawn, unless the player rushes manually.
export const AUTO_START_DELAY = 20;

// Initial player resources at game start.
export const STARTING_CASH  = 250;
export const STARTING_LIVES = 20;

// Refund fraction when selling a tower.
export const SELL_REFUND_FRAC = 0.65;

// Cost to relocate a tower, expressed as a fraction of the cumulative
// purchase + upgrade cost (`tower.spent`). 0.10 → 10%. Easily retunable.
export const MOVE_COST_FRAC = 0.10;

// Global multiplier on the per-kill cash reward an alien provides. Applied on
// top of the species `reward` and the per-wave reward scaling. Tweak this to
// rebalance economy without touching individual enemy stats.
export const ALIEN_REWARD_MULTIPLIER = 0.50;
