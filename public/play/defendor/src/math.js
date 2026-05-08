// -----------------------------------------------------------------------------
// Pure math + formatting helpers. No state dependencies.
// -----------------------------------------------------------------------------

/** Distance between two {x,y} points. */
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Squared distance — cheap when only comparing. */
export const dist2 = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

/** Clamp v to [lo, hi]. */
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Linear interpolate between a and b at t in [0,1]. */
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Compact human-readable HP/cash formatter.
 *   850       → "850"
 *   4_250     → "4.3k"
 *   1_200_000 → "1.2M"
 */
export const formatHp = (n) =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' :
  n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' :
  Math.round(n) + '';

/**
 * Deterministic pseudo-random. Used by preRenderMap so the decorative
 * concrete circles land in the same spots every reload, which gives the
 * cached map background a stable look.
 */
export function makeRng(seed = 7) {
  let s = seed;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}

/** Wrap an angular delta into the (-π, π] range. */
export function wrapAngle(delta) {
  while (delta >  Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}
