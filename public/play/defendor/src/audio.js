// -----------------------------------------------------------------------------
// Procedural audio using the Web Audio API. No asset files; every sound is
// either an oscillator (`beep`) or a noise burst (`noiseBurst`).
//
// `state.muted` short-circuits both, so the on/off button is a single boolean
// that disables all sound effects.
// -----------------------------------------------------------------------------
import { state } from './state.js';

/** Lazily create the AudioContext on the first user gesture. */
export function initAudio() {
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    state.audio = new Ctor();
  } catch (_err) {
    state.audio = null;
  }
}

/** Resume the audio context if browser autoplay policy suspended it. */
export function ensureAudio() {
  if (state.audio && state.audio.state === 'suspended') state.audio.resume();
}

/** Single oscillator beep, decaying exponentially over `dur` seconds. */
function beep(freq, dur, type = 'square', vol = 0.05) {
  if (state.muted) return;
  const ctx = state.audio;
  if (!ctx || ctx.state === 'suspended') return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = vol;
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + dur);
}

/** White-noise pulse with linear decay — used for explosions / cannon roar. */
function noiseBurst(dur, vol = 0.08) {
  if (state.muted) return;
  const ctx = state.audio;
  if (!ctx) return;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(gain);
  gain.connect(ctx.destination);
  src.start();
}

/** All in-game sound effects, keyed by name. */
export const sfx = {
  shoot:    () => beep(720, 0.04, 'square', 0.03),
  cannon:   () => { beep(140, 0.12, 'sawtooth', 0.06); noiseBurst(0.08, 0.04); },
  laser:    () => beep(900, 0.04, 'sine', 0.02),
  missile:  () => beep(220, 0.18, 'triangle', 0.05),
  explode:  () => { noiseBurst(0.25, 0.12); beep(110, 0.15, 'sawtooth', 0.05); },
  tesla:    () => beep(1400, 0.06, 'square', 0.03),
  build:    () => {
    beep(440, 0.05, 'square', 0.05);
    setTimeout(() => beep(660, 0.05, 'square', 0.05), 40);
  },
  hit:      () => beep(180, 0.05, 'square', 0.03),
  kill:     () => beep(330, 0.07, 'square', 0.04),
  baseHurt: () => { noiseBurst(0.2, 0.1); beep(80, 0.2, 'sawtooth', 0.08); },
  win:      () => {
    [523, 659, 784, 1047].forEach((freq, i) =>
      setTimeout(() => beep(freq, 0.25, 'square', 0.06), i * 120));
  },
  lose:     () => {
    [400, 300, 200].forEach((freq, i) =>
      setTimeout(() => beep(freq, 0.4, 'sawtooth', 0.08), i * 200));
  },
  invalid:  () => beep(120, 0.06, 'square', 0.04),
  sproing:  () => {
    // Descending pitch staircase — boing-on-impact for the red missile.
    [900, 700, 500, 350, 220].forEach((freq, i) =>
      setTimeout(() => beep(freq, 0.06, i < 2 ? 'square' : 'sawtooth', 0.05), i * 35));
  },
};
