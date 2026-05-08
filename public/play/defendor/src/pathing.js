// -----------------------------------------------------------------------------
// Geometry helpers that depend on the path: distance from a point to the road,
// distance to a line segment, and the missile-knockback "rewind alien along the
// path by N pixels" routine.
// -----------------------------------------------------------------------------
import { state } from './state.js';
import { dist, lerp, clamp } from './math.js';

/** Shortest distance from (px, py) to the segment (ax,ay)→(bx,by). */
export function distPointToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Shortest distance from (x, y) to the road's centerline, measured per segment. */
export function distToPath(x, y) {
  const points = state.pathPoints;
  let min = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const d = distPointToSegment(
      x, y,
      points[i].x,     points[i].y,
      points[i + 1].x, points[i + 1].y,
    );
    if (d < min) min = d;
  }
  return min;
}

/**
 * Walk an alien backward along the path by `back` pixels and reposition its
 * (x,y). Used by the rate-maxed "red missile" knockback. The alien stays
 * clamped to the path geometry — it can't be pushed past the spawn point.
 */
export function knockbackAlongPath(enemy, back) {
  const points = state.pathPoints;
  if (enemy.seg >= points.length - 1) return;

  // How far along the path the alien currently is, in pixels.
  let traveled = 0;
  for (let i = 0; i < enemy.seg; i++) traveled += dist(points[i], points[i + 1]);
  traveled += enemy.segT * dist(points[enemy.seg], points[enemy.seg + 1]);

  // New target travel distance (clamped at 0 so the alien can't be pushed off).
  const target = Math.max(0, traveled - back);

  // Walk forward from start until we land in the right segment.
  let acc = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const segLen = dist(points[i], points[i + 1]);
    if (acc + segLen >= target || i === points.length - 2) {
      enemy.seg = i;
      enemy.segT = clamp((target - acc) / segLen, 0, 1);
      enemy.x = lerp(points[i].x, points[i + 1].x, enemy.segT);
      enemy.y = lerp(points[i].y, points[i + 1].y, enemy.segT);
      return;
    }
    acc += segLen;
  }
}
