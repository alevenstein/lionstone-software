// -----------------------------------------------------------------------------
// Procedural wave generator. 100 waves per level × 10 levels = 1,000 waves.
//
// Difficulty is a strict, monotonic function of the GLOBAL WAVE COUNT
//
//     gwc = (level - 1) * 100 + waveNum     (range: 1..1000)
//
// so wave 1 of level N is always tougher than wave 100 of level N-1. Wave
// COMPOSITION (boss / tank / swarm / runner / mixed) is still picked from the
// per-level wave number so each level keeps its own boss-every-10 rhythm — but
// the counts, gaps, HP, reward, and speed all climb on `gwc`.
// -----------------------------------------------------------------------------

export const WAVES_PER_LEVEL = 100;

/** Convert (per-level wave, level) → global wave count, 1..1000. */
export function gwcOf(waveNum, level) {
  return (level - 1) * WAVES_PER_LEVEL + waveNum;
}

// ----- Per-pattern wave builders -----------------------------------------------

/** Boss wave (every 10th wave). Boss count grows with gwc; later waves add
 * supporting tanks, grunts, and swarm. */
function bossWave(gwc, countMul, gapMul) {
  const groups = [];
  const bosses = Math.min(25, 1 + Math.floor(gwc / 60));
  groups.push({ type: 'boss', count: bosses, gap: Math.max(1.4, 5.5 - gwc * 0.005) * gapMul });
  if (gwc >= 30)  groups.push({ type: 'tank',  count: Math.floor((4 + gwc * 0.04) * countMul), gap: 0.70 * gapMul });
  if (gwc >= 100) groups.push({ type: 'grunt', count: Math.floor((15 + gwc * 0.06) * countMul), gap: 0.30 * gapMul });
  if (gwc >= 300) groups.push({ type: 'swarm', count: Math.floor(30 * countMul), gap: 0.18 * gapMul });
  return groups;
}

/** Tank-heavy wave (every 7th, except boss waves). */
function tankWave(gwc, countMul, gapMul) {
  const groups = [];
  groups.push({
    type: 'tank',
    count: Math.floor((4 + gwc * 0.05) * countMul),
    gap: Math.max(0.40, 1.0 - gwc * 0.001) * gapMul,
  });
  if (gwc >= 30) {
    groups.push({
      type: 'runner',
      count: Math.floor((6 + gwc * 0.05) * countMul),
      gap: 0.32 * gapMul,
    });
  }
  return groups;
}

/** Swarm wave (every 5th). */
function swarmWave(gwc, countMul, gapMul) {
  const groups = [];
  groups.push({
    type: 'swarm',
    count: Math.floor((15 + gwc * 0.15) * countMul),
    gap: Math.max(0.10, 0.32 - gwc * 0.0004) * gapMul,
  });
  if (gwc >= 50) {
    groups.push({ type: 'tank', count: Math.floor(2 + gwc * 0.015), gap: 1.10 * gapMul });
  }
  return groups;
}

/** Runner blitz (every 3rd). */
function runnerWave(gwc, countMul, gapMul) {
  const groups = [];
  groups.push({
    type: 'runner',
    count: Math.floor((10 + gwc * 0.12) * countMul),
    gap: Math.max(0.12, 0.50 - gwc * 0.0008) * gapMul,
  });
  if (gwc >= 80) {
    groups.push({ type: 'grunt', count: Math.floor(8 * countMul), gap: 0.50 * gapMul });
  }
  return groups;
}

/** Default mixed grunts (the fallback). */
function mixedWave(gwc, countMul, gapMul) {
  const groups = [];
  groups.push({
    type: 'grunt',
    count: Math.floor((8 + gwc * 0.10) * countMul),
    gap: Math.max(0.18, 0.70 - gwc * 0.001) * gapMul,
  });
  if (gwc >= 30)  groups.push({ type: 'runner', count: Math.floor(3 + gwc * 0.03), gap: 0.40 * gapMul });
  if (gwc >= 80)  groups.push({ type: 'tank',   count: Math.floor(2 + gwc * 0.02), gap: 0.95 * gapMul });
  return groups;
}

// ----- Pattern dispatch --------------------------------------------------------

/** Pick which builder runs for this wave based on the per-level wave number. */
function pickPattern(waveNum) {
  if (waveNum % 10 === 0) return bossWave;
  if (waveNum % 7  === 0) return tankWave;
  if (waveNum % 5  === 0) return swarmWave;
  if (waveNum % 3  === 0) return runnerWave;
  return mixedWave;
}

/** Returns the wave's enemy groups: an array of {type, count, gap}. */
export function getWave(waveNum, level) {
  const gwc = gwcOf(waveNum, level);
  // Counts grow with gwc but are capped so the screen can't overflow.
  const countMul = Math.min(1 + (gwc - 1) * 0.006, 7);
  // Gaps shrink with gwc but are floored so spawns can't overlap completely.
  const gapMul   = Math.max(0.25, 1 / (1 + (gwc - 1) * 0.0035));
  return pickPattern(waveNum)(gwc, countMul, gapMul);
}
