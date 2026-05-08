// -----------------------------------------------------------------------------
// Visual effects (sparks, smoke, explosions, lightning, etc). Each effect is
// a plain object with at least { type, t } where `t` is the remaining lifetime
// in seconds. Effects are dropped from the list when `t` reaches zero.
// -----------------------------------------------------------------------------
import { state } from './state.js';

/** Append an effect to the active list. The shape is type-specific. */
export function addEffect(effect) {
  state.effects.push(effect);
}

/** Tick down each effect's lifetime and prune the dead ones. */
export function updateEffects(dt) {
  for (const fx of state.effects) fx.t -= dt;
  state.effects = state.effects.filter((fx) => fx.t > 0);
}
