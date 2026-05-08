// -----------------------------------------------------------------------------
// Enemy "species" definitions. Per-wave HP / reward / speed scaling lives in
// `enemies.js`'s spawnEnemy — this file is just the species template.
// -----------------------------------------------------------------------------

export const ENEMIES = {
  grunt:  { hp: 50,   speed: 60,  reward: 5,   damage: 1,  color: '#a83232', size: 11, name: 'Grunt'  },
  runner: { hp: 28,   speed: 115, reward: 4,   damage: 1,  color: '#c89028', size: 9,  name: 'Runner' },
  tank:   { hp: 280,  speed: 36,  reward: 18,  damage: 3,  color: '#5a4a28', size: 15, name: 'Tank'   },
  swarm:  { hp: 18,   speed: 85,  reward: 3,   damage: 1,  color: '#a85a32', size: 7,  name: 'Swarm'  },
  boss:   { hp: 2200, speed: 28,  reward: 120, damage: 10, color: '#3a0a3a', size: 22, name: 'Boss'   },
};
