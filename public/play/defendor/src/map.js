// -----------------------------------------------------------------------------
// Build the active level: turn its waypoints into a tile grid + a list of
// pixel-space points the aliens follow, and pre-render the static background
// (sand, theme-specific decorations, optional path underglow, road ribbon)
// into an offscreen canvas at native device-pixel resolution.
// -----------------------------------------------------------------------------
import {
  TILE, COLS, ROWS, GAME_W, GAME_H,
  T_SAND, T_PATH, T_BASE,
  TOWER_RADIUS, PATH_CLEARANCE, BASE_CLEARANCE,
} from './constants.js';
import { state } from './state.js';
import { LEVELS } from './data/levels.js';
import { dist, clamp, makeRng } from './math.js';
import { distToPath } from './pathing.js';

// Cached map background canvas. `mapBg.width/height` are device pixels;
// `mapBg.dpr` records the DPR it was rendered at.
export let mapBg = null;
let mapBgRng = makeRng(7);

/**
 * Walk a level's waypoint polyline tile-by-tile, returning the unique list of
 * (col, row) tiles the path traverses (in order, no duplicates).
 */
function walkWaypointTiles(waypoints) {
  const seen = new Set();
  const tiles = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const [ax, ay] = waypoints[i];
    const [bx, by] = waypoints[i + 1];
    const stepX = Math.sign(bx - ax);
    const stepY = Math.sign(by - ay);
    let x = ax, y = ay;
    while (x !== bx || y !== by) {
      const key = x + ',' + y;
      if (!seen.has(key)) { seen.add(key); tiles.push([x, y]); }
      x += stepX;
      y += stepY;
    }
  }
  // Add the final waypoint
  const last = waypoints[waypoints.length - 1];
  const lastKey = last[0] + ',' + last[1];
  if (!seen.has(lastKey)) tiles.push(last);
  return tiles;
}

/** Build the grid + path data for the current level and pre-render the bg. */
export function buildMap() {
  const levelData = LEVELS[state.level - 1];
  const { waypoints } = levelData;

  // Empty grid filled with sand.
  state.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(T_SAND));

  // Mark path tiles into the grid.
  const tiles = walkWaypointTiles(waypoints);
  state.pathTiles = tiles;
  for (const [x, y] of tiles) {
    if (x >= 0 && x < COLS && y >= 0 && y < ROWS) state.grid[y][x] = T_PATH;
  }

  // Base = last waypoint (clamped to grid for rendering, since waypoints can
  // be just past the right edge to make aliens "enter" the base).
  const lastWaypoint = waypoints[waypoints.length - 1];
  const baseCol = clamp(lastWaypoint[0], 0, COLS - 1);
  const baseRow = clamp(lastWaypoint[1], 0, ROWS - 1);
  state.grid[baseRow][baseCol] = T_BASE;
  state.base = {
    col: baseCol, row: baseRow,
    x: baseCol * TILE + TILE / 2,
    y: baseRow * TILE + TILE / 2,
  };

  // Spawn = first waypoint
  state.spawn = { col: waypoints[0][0], row: waypoints[0][1] };

  // Pixel-space waypoints for enemy movement
  state.pathPoints = waypoints.map(([col, row]) => ({
    x: col * TILE + TILE / 2,
    y: row * TILE + TILE / 2,
  }));
  state.pathLength = 0;
  for (let i = 0; i < state.pathPoints.length - 1; i++) {
    state.pathLength += dist(state.pathPoints[i], state.pathPoints[i + 1]);
  }

  preRenderMap();
}

// ----- Background pre-rendering ------------------------------------------------

/**
 * Render sand + texture + decorations + road ribbon into an offscreen canvas.
 * Uses native device-pixel resolution so the cached image isn't nearest-
 * neighbour upscaled on hi-DPI displays.
 */
export function preRenderMap() {
  const levelData = LEVELS[state.level - 1];
  const dpr = state.dpr || 1;
  const widthDev  = Math.round(GAME_W * dpr);
  const heightDev = Math.round(GAME_H * dpr);

  mapBg = document.createElement('canvas');
  mapBg.width  = widthDev;
  mapBg.height = heightDev;

  const ctx = mapBg.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  drawSandWithGrain(ctx, levelData, widthDev, heightDev);
  drawThemeDecorations(ctx, levelData);
  drawPathUnderglow(ctx, levelData);
  drawRoadRibbon(ctx, levelData);
}

/** Fill the sand base color and sprinkle subtle per-pixel grain. */
function drawSandWithGrain(ctx, levelData, widthDev, heightDev) {
  ctx.fillStyle = levelData.sand;
  ctx.fillRect(0, 0, GAME_W, GAME_H);

  // Operate in device-pixel space so the grain stays fine on hi-DPI.
  const img = ctx.getImageData(0, 0, widthDev, heightDev);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 12;
    data[i]     = clamp(data[i]     + noise,        0, 255);
    data[i + 1] = clamp(data[i + 1] + noise * 0.85, 0, 255);
    data[i + 2] = clamp(data[i + 2] + noise * 0.6,  0, 255);
  }
  ctx.putImageData(img, 0, 0);
}

// ----- Theme decorations -------------------------------------------------------
//
// The bg renderer dispatches to one of these per level. Each function paints
// directly onto `ctx` and shares the deterministic mapBgRng so a given level
// always renders identically. See data/levels.js for the theme key.

function drawThemeDecorations(ctx, levelData) {
  mapBgRng = makeRng(7);
  const fn = THEME_DECORATORS[levelData.theme] || drawDesertDunes;
  fn(ctx, levelData);
}

const THEME_DECORATORS = {
  desert:      drawDesertDunes,
  mesa:        drawMesaSilhouettes,
  salt:        drawSaltHexCrust,
  volcanic:    drawVolcanicCracks,
  frozen:      drawIceFractures,
  swamp:       drawSwampPuddles,
  lunar:       drawLunarCraters,
  acid:        drawAcidPools,
  crystal:     drawCrystalShards,
  battlefield: drawScorchedDebris,
};

/**
 * Sand-sea dune system: a stack of long sinusoidal ridge crests crossing
 * the canvas. Between consecutive ridges, a vertical gradient paints the
 * slip-face shadow just below the upper ridge, fading through the trough,
 * up to a lit windward slope just before the next crest. Each ridge gets a
 * bright crest stroke and a darker slip-face stroke. Bleached rocks scatter
 * across the field as small lit-from-the-top-left landmarks.
 */
function drawDesertDunes(ctx, levelData) {
  const numRidges = 6;
  const stride = (GAME_H - 60) / (numRidges - 1);
  const ridges = [];
  for (let i = 0; i < numRidges; i++) {
    ridges.push({
      baseY: 30 + i * stride + (mapBgRng() - 0.5) * 28,
      amp:   12 + mapBgRng() * 18,
      freq:  0.010 + mapBgRng() * 0.010,
      phase: mapBgRng() * Math.PI * 2,
    });
  }
  ridges.sort((a, b) => a.baseY - b.baseY);
  const ridgeAt = (r, x) => r.baseY + Math.sin(x * r.freq + r.phase) * r.amp;

  // Trough fills — gradient between each pair of consecutive ridges.
  for (let i = 0; i < ridges.length - 1; i++) {
    const r1 = ridges[i];
    const r2 = ridges[i + 1];
    const grad = ctx.createLinearGradient(0, r1.baseY, 0, r2.baseY);
    grad.addColorStop(0,    'rgba(60, 32, 10, 0.34)');     // slip face shadow
    grad.addColorStop(0.45, 'rgba(120, 78, 40, 0.05)');    // trough
    grad.addColorStop(1,    'rgba(248, 222, 168, 0.30)');  // lit windward slope
    ctx.fillStyle = grad;
    ctx.beginPath();
    for (let x = -10; x <= GAME_W + 10; x += 6) {
      const y = ridgeAt(r1, x);
      if (x === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    for (let x = GAME_W + 10; x >= -10; x -= 6) {
      ctx.lineTo(x, ridgeAt(r2, x));
    }
    ctx.closePath();
    ctx.fill();
  }

  // Crest highlights + slip-face shadow strokes
  const tracePolyline = (offsetY) => {
    ctx.beginPath();
    let first = true;
    for (let x = -10; x <= GAME_W + 10; x += 4) {
      first = traceTo(ctx, x, ridgeAt(currentRidge, x) + offsetY, first);
    }
    ctx.stroke();
  };
  let currentRidge;
  ctx.save();
  for (const r of ridges) {
    currentRidge = r;
    ctx.strokeStyle = 'rgba(255, 240, 200, 0.55)';
    ctx.lineWidth = 1.4;
    tracePolyline(0);
    ctx.strokeStyle = 'rgba(36, 18, 6, 0.50)';
    ctx.lineWidth = 1;
    tracePolyline(2.5);
  }
  ctx.restore();

  // Bleached rocks
  for (let i = 0; i < 9; i++) {
    drawSandRock(ctx, mapBgRng() * GAME_W, mapBgRng() * GAME_H, 2 + mapBgRng() * 3);
  }

  // Fine sand grain
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = 'rgba(72, 44, 18, 0.45)';
    ctx.beginPath();
    ctx.arc(mapBgRng() * GAME_W, mapBgRng() * GAME_H,
            0.5 + mapBgRng() * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Tiny utility: moveTo on the first point, lineTo after that. */
function traceTo(ctx, x, y, first) {
  if (first) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  return false;
}

/** Small bleached desert rock — drop shadow + body + top-left highlight. */
function drawSandRock(ctx, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(60, 32, 10, 0.55)';
  ctx.beginPath();
  ctx.ellipse(1, 1, r * 1.3, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b08856';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255, 240, 200, 0.7)';
  ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.35, r * 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/**
 * Layered mesa silhouettes with drop shadows, rock striations, sun-lit west
 * edges, shadowed east faces, and an irregular polygonal mud-crack pattern.
 *
 * Mesas are rejection-sampled so none overlap the road — each candidate
 * position must clear the path centerline by `mesaWidth/2 + 30 px`, which
 * keeps the body (and its drop shadow) entirely on the sand.
 */
function drawMesaSilhouettes(ctx, levelData) {
  // Try up to TARGET mesas; retry positions that would overlap the road.
  const TARGET = 5;
  let placed = 0;
  let attempts = 0;
  while (placed < TARGET && attempts < 80) {
    attempts++;
    const w = 70 + mapBgRng() * 80;
    const h = 18 + mapBgRng() * 12;
    const margin = w / 2 + 4;
    const cx = margin + mapBgRng() * (GAME_W - margin * 2);
    const cy = (h + 10) + mapBgRng() * (GAME_H - (h + 10) * 2);
    if (distToPath(cx, cy) < w / 2 + 30) continue;
    drawMesa(ctx, cx, cy, w, h, mapBgRng() > 0.4);
    placed++;
  }

  // Polygonal mud cracks (dried-clay network)
  ctx.save();
  ctx.strokeStyle = 'rgba(40, 16, 8, 0.40)';
  ctx.lineWidth = 0.7;
  const cellSize = 26;
  for (let row = -1; row * cellSize < GAME_H + cellSize; row++) {
    for (let col = -1; col * cellSize < GAME_W + cellSize; col++) {
      const cx = col * cellSize + (row & 1 ? cellSize / 2 : 0) + (mapBgRng() - 0.5) * 6;
      const cy = row * cellSize + (mapBgRng() - 0.5) * 6;
      const sides = 5 + Math.floor(mapBgRng() * 3);
      const r = cellSize * 0.5;
      ctx.beginPath();
      for (let k = 0; k < sides; k++) {
        const a  = (k / sides) * Math.PI * 2 + mapBgRng() * 0.5;
        const rj = r * (0.65 + mapBgRng() * 0.55);
        const x  = cx + Math.cos(a) * rj;
        const y  = cy + Math.sin(a) * rj;
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();

  // Scattered small rocks
  ctx.save();
  ctx.fillStyle = 'rgba(60, 24, 12, 0.65)';
  for (let i = 0; i < 28; i++) {
    ctx.beginPath();
    ctx.arc(mapBgRng() * GAME_W, mapBgRng() * GAME_H, 0.8 + mapBgRng() * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** One trapezoidal mesa with shading + striations. Used by drawMesaSilhouettes. */
function drawMesa(ctx, cx, cy, w, h, hasStep) {
  const inset = 7;
  const halfW = w / 2;

  ctx.save();
  ctx.translate(cx, cy);

  // Drop shadow under the mesa
  ctx.fillStyle = 'rgba(20, 8, 4, 0.45)';
  ctx.beginPath();
  ctx.ellipse(3, h / 2 + 2, halfW, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mesa body — trapezoid
  ctx.fillStyle = '#6a2818';
  ctx.beginPath();
  ctx.moveTo(-halfW, h / 2);
  ctx.lineTo(-halfW + inset, -h / 2);
  ctx.lineTo(halfW - inset, -h / 2);
  ctx.lineTo(halfW, h / 2);
  ctx.closePath();
  ctx.fill();

  // Optional stepped tier on top
  if (hasStep) {
    const stepW = w * 0.32;
    const stepH = h * 0.45;
    const stepX = (mapBgRng() - 0.3) * w * 0.25;
    ctx.fillStyle = '#7a3820';
    ctx.beginPath();
    ctx.moveTo(stepX - stepW / 2, -h / 2);
    ctx.lineTo(stepX - stepW / 2 + 4, -h / 2 - stepH);
    ctx.lineTo(stepX + stepW / 2 - 4, -h / 2 - stepH);
    ctx.lineTo(stepX + stepW / 2, -h / 2);
    ctx.closePath();
    ctx.fill();
  }

  // Horizontal rock striations on the mesa face
  ctx.strokeStyle = 'rgba(28, 10, 4, 0.55)';
  ctx.lineWidth = 0.8;
  for (let j = 1; j < 4; j++) {
    const ratio = j / 4;
    const sy = -h / 2 + h * ratio;
    const widthAt = w - inset * 2 * (1 - ratio);
    ctx.beginPath();
    ctx.moveTo(-widthAt / 2 + 3, sy);
    ctx.lineTo( widthAt / 2 - 3, sy);
    ctx.stroke();
  }

  // East-face shadow (sun from west)
  ctx.fillStyle = 'rgba(15, 6, 3, 0.40)';
  ctx.beginPath();
  ctx.moveTo(halfW - inset, -h / 2);
  ctx.lineTo(halfW, h / 2);
  ctx.lineTo(halfW - 14, h / 2);
  ctx.closePath();
  ctx.fill();

  // West-face highlight
  ctx.strokeStyle = 'rgba(220, 130, 90, 0.55)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-halfW, h / 2);
  ctx.lineTo(-halfW + inset, -h / 2);
  ctx.stroke();

  ctx.restore();
}

/**
 * Salt-flats crust: the canvas is tiled with irregular polygon cells. Each
 * cell is filled with an off-white tone (raised crust) and then stroked
 * darker (recessed cracks between cells). A few mirror-water patches and
 * scattered crystal sparkles complete the Salar de Uyuni feel.
 */
function drawSaltHexCrust(ctx, levelData) {
  // Build a jittered hex grid of irregular cell polygons.
  const hexR = 22;
  const hexW = hexR * Math.sqrt(3);
  const hexH = hexR * 1.5;
  const cells = [];
  for (let row = -1; row * hexH < GAME_H + hexR; row++) {
    for (let col = -1; col * hexW < GAME_W + hexW; col++) {
      const cx = col * hexW + (row & 1 ? hexW / 2 : 0) + (mapBgRng() - 0.5) * 5;
      const cy = row * hexH + (mapBgRng() - 0.5) * 5;
      const verts = [];
      for (let k = 0; k < 6; k++) {
        const a  = (k / 6) * Math.PI * 2 + Math.PI / 6;
        const rj = hexR * (0.82 + mapBgRng() * 0.30);
        verts.push([cx + Math.cos(a) * rj, cy + Math.sin(a) * rj]);
      }
      cells.push(verts);
    }
  }

  // Fill cells — slightly brighter than sand → reads as raised salt crust.
  ctx.save();
  ctx.fillStyle = 'rgba(252, 244, 220, 0.32)';
  for (const verts of cells) {
    ctx.beginPath();
    verts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.closePath();
    ctx.fill();
  }
  // Crack outlines — dark recessed lines between cells.
  ctx.strokeStyle = 'rgba(50, 36, 18, 0.55)';
  ctx.lineWidth = 1.1;
  for (const verts of cells) {
    ctx.beginPath();
    verts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.closePath();
    ctx.stroke();
  }
  // Bright top-edge highlight on each cell (sun from upper-left): only stroke
  // the edges whose midpoint sits above-and-left of the cell centroid.
  ctx.strokeStyle = 'rgba(255, 252, 230, 0.45)';
  ctx.lineWidth = 0.6;
  for (const verts of cells) {
    let cellMidX = 0;
    let cellMidY = 0;
    for (const [vx, vy] of verts) { cellMidX += vx; cellMidY += vy; }
    cellMidX /= verts.length;
    cellMidY /= verts.length;
    for (let i = 0; i < verts.length; i++) {
      const [x1, y1] = verts[i];
      const [x2, y2] = verts[(i + 1) % verts.length];
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      if (midX > cellMidX || midY > cellMidY) continue;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Mirror water patches — rejection-sample so they stay clear of the road.
  let placed = 0;
  let attempts = 0;
  while (placed < 3 && attempts < 30) {
    attempts++;
    const w = 24 + mapBgRng() * 26;
    const h = 14 + mapBgRng() * 14;
    const margin = w + 6;
    const cx = margin + mapBgRng() * (GAME_W - margin * 2);
    const cy = h + 8 + mapBgRng() * (GAME_H - (h + 8) * 2);
    if (distToPath(cx, cy) < w + 12) continue;
    drawSaltMirror(ctx, cx, cy, w, h);
    placed++;
  }

  // Crystal sparkles — small bright dots with subtle glow.
  ctx.save();
  ctx.shadowColor = '#ffffff';
  for (let i = 0; i < 38; i++) {
    const cx = mapBgRng() * GAME_W;
    const cy = mapBgRng() * GAME_H;
    const r  = 0.6 + mapBgRng() * 0.7;
    ctx.shadowBlur = 3;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** Shallow-water mirror patch on the salt flats: pale-blue gradient + bright rim. */
function drawSaltMirror(ctx, cx, cy, w, h) {
  ctx.save();
  ctx.translate(cx, cy);
  // Faint outer rim — slightly darker, suggests the salt edge of the puddle.
  ctx.fillStyle = 'rgba(60, 50, 30, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 1.5, w + 2, h + 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Water body — pale blue, brighter on the upper-left (sun reflection).
  const grad = ctx.createRadialGradient(-w * 0.3, -h * 0.35, 0, 0, 0, w);
  grad.addColorStop(0,    'rgba(232, 244, 252, 0.85)');
  grad.addColorStop(0.55, 'rgba(180, 210, 230, 0.55)');
  grad.addColorStop(1,    'rgba(150, 180, 200, 0.30)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
  ctx.fill();
  // Bright reflective rim arc on the windward side.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.ellipse(0, 0, w, h, 0, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  ctx.restore();
}

/** Glowing lava cracks + dark ash patches. */
function drawVolcanicCracks(ctx, levelData) {
  // Ash patches first (under the cracks)
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = '#0a0604';
  for (let i = 0; i < 8; i++) {
    const cx = mapBgRng() * GAME_W;
    const cy = mapBgRng() * GAME_H;
    const r  = 18 + mapBgRng() * 35;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(8, 4, 2, 0.7)');
    grad.addColorStop(1, 'rgba(8, 4, 2, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Outer cracks (broader red)
  ctx.save();
  ctx.shadowColor = '#ff4818';
  ctx.shadowBlur = 6;
  ctx.strokeStyle = '#c83018';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    drawJaggedLine(ctx, mapBgRng() * GAME_W, mapBgRng() * GAME_H, 70 + mapBgRng() * 80);
  }
  // Bright inner cracks
  ctx.shadowBlur = 4;
  ctx.strokeStyle = '#ffaa30';
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 10; i++) {
    drawJaggedLine(ctx, mapBgRng() * GAME_W, mapBgRng() * GAME_H, 25 + mapBgRng() * 35);
  }
  ctx.restore();
}

/**
 * Frozen tundra: shattered ice surface. Long stress-fracture cracks crossing
 * the map (bright sun-lit outer with shadowBlur + dark inner interior),
 * open-water holes through the ice, elongated snow drifts with directional
 * lighting, six-armed frost crystals, and bright ice glints.
 */
function drawIceFractures(ctx, levelData) {
  // Long ice cracks — generate paths first, then stroke twice with different
  // styles so the bright halo and dark interior align exactly.
  const cracks = [];
  for (let i = 0; i < 7; i++) {
    cracks.push(generateJaggedPath(
      mapBgRng() * GAME_W,
      mapBgRng() * GAME_H,
      80 + mapBgRng() * 80,
    ));
  }
  ctx.save();
  // Outer bright halo — sun glinting off the fracture face.
  ctx.shadowColor = 'rgba(200, 230, 250, 0.75)';
  ctx.shadowBlur = 5;
  ctx.strokeStyle = 'rgba(232, 244, 252, 0.85)';
  ctx.lineWidth = 2;
  for (const path of cracks) strokeJaggedPath(ctx, path);
  // Inner narrow dark stroke — the crack interior.
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(40, 70, 100, 0.65)';
  ctx.lineWidth = 0.7;
  for (const path of cracks) strokeJaggedPath(ctx, path);
  ctx.restore();

  // Open-water holes through the ice (rejection-sampled to clear the road).
  let placed = 0;
  let attempts = 0;
  while (placed < 3 && attempts < 30) {
    attempts++;
    const w = 22 + mapBgRng() * 22;
    const h = 14 + mapBgRng() * 14;
    const margin = w + 6;
    const cx = margin + mapBgRng() * (GAME_W - margin * 2);
    const cy = h + 8 + mapBgRng() * (GAME_H - (h + 8) * 2);
    if (distToPath(cx, cy) < w + 12) continue;
    drawIceHole(ctx, cx, cy, w, h);
    placed++;
  }

  // Snow drifts
  for (let i = 0; i < 7; i++) {
    drawSnowDrift(ctx,
      mapBgRng() * GAME_W,
      mapBgRng() * GAME_H,
      18 + mapBgRng() * 22,
      mapBgRng() * Math.PI * 2);
  }

  // Frost crystals
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 14; i++) {
    drawFrostCrystal(ctx,
      mapBgRng() * GAME_W,
      mapBgRng() * GAME_H,
      3 + mapBgRng() * 5);
  }
  ctx.restore();

  // Ice glints — small bright sparkles with subtle glow.
  ctx.save();
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 4;
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(mapBgRng() * GAME_W, mapBgRng() * GAME_H,
            0.4 + mapBgRng() * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Open-water hole through the ice — bright frosty rim + deep blue water + sun glint. */
function drawIceHole(ctx, cx, cy, w, h) {
  ctx.save();
  ctx.translate(cx, cy);
  // Outer cracked-ice rim — bright frost buildup around the hole.
  ctx.fillStyle = 'rgba(232, 244, 250, 0.70)';
  ctx.beginPath();
  ctx.ellipse(0, 0, w + 5, h + 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Deep water — radial gradient from very dark to medium blue.
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, w);
  grad.addColorStop(0,   'rgba(10, 30, 60, 0.95)');
  grad.addColorStop(0.6, 'rgba(30, 70, 105, 0.85)');
  grad.addColorStop(1,   'rgba(70, 110, 145, 0.55)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
  ctx.fill();
  // Sun-glint on the water surface (upper-left).
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.beginPath();
  ctx.ellipse(-w * 0.32, -h * 0.32, w * 0.22, h * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Elongated snow drift — drop shadow, bright lit body, crest highlight. */
function drawSnowDrift(ctx, cx, cy, size, angle) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  // Drop shadow (cool blue, suggests cold)
  ctx.fillStyle = 'rgba(60, 90, 120, 0.32)';
  ctx.beginPath();
  ctx.ellipse(2, 2, size, size * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  // Lit body — bright highlight offset up-left
  const grad = ctx.createRadialGradient(-size * 0.25, -size * 0.2, 0, 0, 0, size);
  grad.addColorStop(0,   'rgba(255, 255, 255, 0.78)');
  grad.addColorStop(0.7, 'rgba(220, 235, 245, 0.40)');
  grad.addColorStop(1,   'rgba(220, 235, 245, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, size, size * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Crest highlight on the windward (top) edge
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.04, size * 0.85, size * 0.35, 0, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  ctx.restore();
}

/** Six-armed frost crystal: main arms with paired side branches at midpoint. */
function drawFrostCrystal(ctx, cx, cy, size) {
  for (let b = 0; b < 6; b++) {
    const angle = (b / 6) * Math.PI * 2;
    const tipX = cx + Math.cos(angle) * size;
    const tipY = cy + Math.sin(angle) * size;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    // Side branches at 55% along the arm
    const midX = cx + Math.cos(angle) * size * 0.55;
    const midY = cy + Math.sin(angle) * size * 0.55;
    const side = size * 0.30;
    for (const da of [0.6, -0.6]) {
      const a2 = angle + da;
      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.lineTo(midX + Math.cos(a2) * side, midY + Math.sin(a2) * side);
      ctx.stroke();
    }
  }
}

/** Mucky puddles + tiny reed clusters. */
function drawSwampPuddles(ctx, levelData) {
  ctx.save();
  for (let i = 0; i < 14; i++) {
    const cx = mapBgRng() * GAME_W;
    const cy = mapBgRng() * GAME_H;
    const w  = 12 + mapBgRng() * 28;
    const h  = 6 + mapBgRng() * 12;
    ctx.fillStyle = '#1a2810';
    ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.ellipse(cx, cy, w, h, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#586a38';
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx, cy, w, h, 0, 0, Math.PI * 2); ctx.stroke();
    // Lily pad
    if (mapBgRng() > 0.6) {
      ctx.fillStyle = '#5a7038';
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(cx + (mapBgRng() - 0.5) * w * 0.6,
              cy + (mapBgRng() - 0.5) * h * 0.6,
              2 + mapBgRng() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Reeds
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = '#283818';
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 35; i++) {
    const x = mapBgRng() * GAME_W;
    const y = mapBgRng() * GAME_H;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (mapBgRng() - 0.5) * 1.5, y - 4 - mapBgRng() * 5);
    ctx.stroke();
  }
  ctx.restore();
}

/** Properly shaded craters (lit rim + shadow rim) + small rocks. */
function drawLunarCraters(ctx, levelData) {
  ctx.save();
  for (let i = 0; i < 11; i++) {
    const cx = mapBgRng() * GAME_W;
    const cy = mapBgRng() * GAME_H;
    const r  = 8 + mapBgRng() * 22;
    // Crater bowl
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(40, 40, 56, 0.55)');
    grad.addColorStop(1, 'rgba(40, 40, 56, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    // Lit rim (top-left, sun comes from top-left)
    ctx.strokeStyle = 'rgba(220, 220, 232, 0.45)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 1.05, Math.PI * 0.05); ctx.stroke();
    // Shadow rim (bottom-right)
    ctx.strokeStyle = 'rgba(20, 20, 28, 0.55)';
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 0.05, Math.PI * 1.05); ctx.stroke();
  }
  // Boulders
  ctx.fillStyle = '#5a5a6a';
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 35; i++) {
    ctx.beginPath();
    ctx.arc(mapBgRng() * GAME_W, mapBgRng() * GAME_H, 0.9 + mapBgRng() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Bubbling acid pools with bright cores. */
function drawAcidPools(ctx, levelData) {
  ctx.save();
  for (let i = 0; i < 11; i++) {
    const cx = mapBgRng() * GAME_W;
    const cy = mapBgRng() * GAME_H;
    const r  = 12 + mapBgRng() * 22;
    // Outer dim ring
    ctx.fillStyle = '#283818';
    ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    // Glowing core
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.7);
    grad.addColorStop(0, 'rgba(220, 248, 80, 0.8)');
    grad.addColorStop(1, 'rgba(160, 200, 40, 0)');
    ctx.fillStyle = grad;
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2); ctx.fill();
    // Bubbles
    for (let b = 0; b < 4; b++) {
      const ba = mapBgRng() * Math.PI * 2;
      const bd = mapBgRng() * r * 0.55;
      ctx.fillStyle = '#f0ff80';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ba) * bd, cy + Math.sin(ba) * bd,
              0.8 + mapBgRng() * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Glowing crystal shards in clusters. */
function drawCrystalShards(ctx, levelData) {
  ctx.save();
  for (let i = 0; i < 16; i++) {
    const cx = mapBgRng() * GAME_W;
    const cy = mapBgRng() * GAME_H;
    const len = 9 + mapBgRng() * 16;
    const w   = 2.5 + mapBgRng() * 3;
    const angle = mapBgRng() * Math.PI * 2;
    ctx.shadowColor = '#d8b8ff';
    ctx.shadowBlur = 5;
    ctx.fillStyle = '#a888e8';
    ctx.globalAlpha = 0.65;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(len, 0);
    ctx.lineTo(0, w);
    ctx.lineTo(-len * 0.3, 0);
    ctx.lineTo(0, -w);
    ctx.closePath();
    ctx.fill();
    // Bright facet highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f0d8ff';
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(len * 0.85, 0);
    ctx.lineTo(0, w * 0.4);
    ctx.lineTo(-len * 0.2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** Smoking scorch marks + scattered angular debris. */
function drawScorchedDebris(ctx, levelData) {
  ctx.save();
  for (let i = 0; i < 14; i++) {
    const cx = mapBgRng() * GAME_W;
    const cy = mapBgRng() * GAME_H;
    const r  = 18 + mapBgRng() * 28;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(8, 4, 4, 0.85)');
    grad.addColorStop(1, 'rgba(8, 4, 4, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
  // Debris chunks
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 35; i++) {
    const cx = mapBgRng() * GAME_W;
    const cy = mapBgRng() * GAME_H;
    const a  = mapBgRng() * Math.PI * 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.fillStyle = mapBgRng() > 0.5 ? '#1a0808' : '#382020';
    ctx.fillRect(-2 - mapBgRng() * 2, -1, 4 + mapBgRng() * 3, 1.6);
    ctx.restore();
  }
  ctx.restore();
}

// ----- Crack helpers -----------------------------------------------------------

/** Several short jagged lines, used by mesa + others. */
function drawJaggedCracks(ctx, count, len, color, alpha) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1;
  for (let i = 0; i < count; i++) {
    drawJaggedLine(ctx, mapBgRng() * GAME_W, mapBgRng() * GAME_H, len * (0.5 + mapBgRng()));
  }
  ctx.restore();
}

/** Random-walk polyline of total length ~`len`. Caller sets stroke style. */
function drawJaggedLine(ctx, x, y, len) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  let cx = x;
  let cy = y;
  let angle = mapBgRng() * Math.PI * 2;
  let drawn = 0;
  while (drawn < len) {
    const segLen = 5 + mapBgRng() * 8;
    angle += (mapBgRng() - 0.5) * 0.9;
    cx += Math.cos(angle) * segLen;
    cy += Math.sin(angle) * segLen;
    ctx.lineTo(cx, cy);
    drawn += segLen;
  }
  ctx.stroke();
}

/** Generate the polyline points for a jagged crack so it can be stroked twice
 *  with different styles (used by the ice-fracture pass). */
function generateJaggedPath(x, y, len) {
  const points = [{ x, y }];
  let cx = x;
  let cy = y;
  let angle = mapBgRng() * Math.PI * 2;
  let drawn = 0;
  while (drawn < len) {
    const segLen = 5 + mapBgRng() * 8;
    angle += (mapBgRng() - 0.5) * 0.9;
    cx += Math.cos(angle) * segLen;
    cy += Math.sin(angle) * segLen;
    points.push({ x: cx, y: cy });
    drawn += segLen;
  }
  return points;
}

/** Stroke a path produced by generateJaggedPath. Caller sets stroke style. */
function strokeJaggedPath(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
}

// ----- Path styling ------------------------------------------------------------

/** A few atmospheric themes get a coloured underglow halo around the path. */
const PATH_GLOW_COLORS = {
  volcanic: 'rgba(255, 80, 30, 0.35)',
  frozen:   'rgba(160, 220, 255, 0.30)',
  acid:     'rgba(200, 240, 60, 0.32)',
  crystal:  'rgba(200, 160, 255, 0.32)',
};

function drawPathUnderglow(ctx, levelData) {
  const glow = PATH_GLOW_COLORS[levelData.theme];
  if (!glow) return;
  const points = state.pathPoints;
  ctx.save();
  ctx.strokeStyle = glow;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = TILE * 1.25;
  ctx.shadowColor = glow;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.restore();
}

/** Continuous ribbon following the path waypoints. */
function drawRoadRibbon(ctx, levelData) {
  const points = state.pathPoints;
  const drawLine = (color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  drawLine(levelData.path,      TILE * 0.92);   // outer (darker)
  drawLine(levelData.pathInner, TILE * 0.78);   // inner (lighter)
}

// ----- Buildable check ---------------------------------------------------------

/**
 * Whether a tower can be placed at pixel (x, y). Rejects positions that
 * (a) fall outside the play area, (b) overlap the road, (c) overlap the
 * base, or (d) overlap an existing tower.
 */
export function isBuildableAt(x, y) {
  if (x < TOWER_RADIUS || x > GAME_W - TOWER_RADIUS) return false;
  if (y < TOWER_RADIUS || y > GAME_H - TOWER_RADIUS) return false;
  if (distToPath(x, y) < PATH_CLEARANCE) return false;
  if (Math.hypot(state.base.x - x, state.base.y - y) < BASE_CLEARANCE) return false;
  for (const tower of state.towers) {
    if (Math.hypot(tower.x - x, tower.y - y) < TOWER_RADIUS * 2) return false;
  }
  return true;
}
