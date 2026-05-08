// -----------------------------------------------------------------------------
// Level data. Each level has a name, color theme, and a sequence of waypoints
// (col, row) describing the path. The first waypoint is the alien spawn (often
// off-screen at col -1), the last is the player base (typically col 18, just
// past the right edge so aliens appear to enter the base).
// -----------------------------------------------------------------------------

export const LEVELS = [
  {
    name: 'Sahara Outpost', theme: 'desert',
    sand: '#c8a878', path: '#7a5028', pathInner: '#9a6c3c', deco: '#8a6838',
    waypoints: [[-1,1],[13,1],[13,3],[3,3],[3,5],[15,5],[15,7],[3,7],[3,9],[18,9]],
  },
  {
    name: 'Red Mesa', theme: 'mesa',
    sand: '#c87858', path: '#5a2818', pathInner: '#7a3828', deco: '#6a3018',
    waypoints: [[-1,1],[17,1],[17,5],[1,5],[1,10],[18,10]],
  },
  {
    name: 'Salt Flats', theme: 'salt',
    sand: '#d8c898', path: '#7a6a48', pathInner: '#9a8a68', deco: '#8a7a58',
    waypoints: [[-1,0],[5,0],[5,2],[10,2],[10,4],[5,4],[5,6],[10,6],[10,8],[5,8],[5,10],[18,10]],
  },
  {
    name: 'Volcanic', theme: 'volcanic',
    sand: '#3a2820', path: '#1a0a04', pathInner: '#5a2818', deco: '#7a3818',
    waypoints: [[-1,5],[4,5],[4,1],[8,1],[8,9],[12,9],[12,3],[16,3],[16,8],[18,8]],
  },
  {
    name: 'Frozen Tundra', theme: 'frozen',
    sand: '#b8c8d8', path: '#586878', pathInner: '#788898', deco: '#a8c8e8',
    waypoints: [[-1,1],[16,1],[16,9],[1,9],[1,5],[18,5]],
  },
  {
    name: 'Swamp', theme: 'swamp',
    sand: '#3a4830', path: '#2a1808', pathInner: '#4a3818', deco: '#283418',
    waypoints: [[-1,0],[3,0],[3,2],[6,2],[6,4],[9,4],[9,6],[12,6],[12,8],[15,8],[15,10],[18,10]],
  },
  {
    name: 'Lunar Surface', theme: 'lunar',
    sand: '#8a8a98', path: '#404050', pathInner: '#606070', deco: '#505060',
    waypoints: [[-1,2],[16,2],[16,4],[2,4],[2,6],[16,6],[16,8],[2,8],[2,10],[18,10]],
  },
  {
    name: 'Acid Pools', theme: 'acid',
    sand: '#5a6838', path: '#384818', pathInner: '#586828', deco: '#a8c828',
    waypoints: [[-1,5],[8,5],[8,1],[12,1],[12,9],[4,9],[4,5],[16,5],[16,9],[18,9]],
  },
  {
    name: 'Crystal Caverns', theme: 'crystal',
    sand: '#3a2858', path: '#1a1038', pathInner: '#7858b0', deco: '#c8a8f0',
    waypoints: [[-1,0],[10,0],[10,3],[2,3],[2,6],[15,6],[15,3],[17,3],[17,8],[1,8],[1,10],[18,10]],
  },
  {
    name: 'Final Stand', theme: 'battlefield',
    sand: '#682828', path: '#281010', pathInner: '#481818', deco: '#a83838',
    waypoints: [[-1,1],[5,1],[5,4],[1,4],[1,7],[12,7],[12,2],[16,2],[16,9],[3,9],[3,5],[8,5],[8,10],[18,10]],
  },
];

export const MAX_LEVEL = LEVELS.length;
