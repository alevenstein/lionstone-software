// -----------------------------------------------------------------------------
// Centre-screen flash messages ("Wave 5 cleared!", "Cannot build there", etc).
// -----------------------------------------------------------------------------
import { state } from './state.js';

const DEFAULT_DURATION = 2.0;

/**
 * Show a brief overlay message in the centre of the play area. Optional
 * duration in seconds; defaults to 2.0.
 */
export function flash(message, duration = DEFAULT_DURATION) {
  state.message = message;
  state.messageT = duration;
}
