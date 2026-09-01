/**
 * The arithmetic behind the seek bar: touch position ↔ playback time.
 *
 * Small, but worth isolating — every function here divides by a number that is legitimately
 * zero at some point in the app's life. The bar is laid out before it is measured (width 0)
 * and rendered before the player reports a length (duration 0), so an unguarded division
 * yields `NaN` or `Infinity`, and a `NaN` width silently collapses the layout with no error
 * to explain it.
 */

/** Where in the track a touch at `locationX` points, in seconds. */
export function timeForPosition(locationX: number, width: number, duration: number): number {
  if (width <= 0 || duration <= 0) return 0;
  return clampRatio(locationX / width) * duration;
}

/** How far through the track we are, as 0–1. */
export function progressRatio(currentTime: number, duration: number): number {
  if (duration <= 0) return 0;
  return clampRatio(currentTime / duration);
}

/**
 * Left offset for the thumb, centred on its position rather than leading it.
 *
 * Clamped at zero so the thumb never hangs off the left edge at the very start of a track.
 */
export function thumbOffset(ratio: number, width: number, thumbSize: number): number {
  return Math.max(0, ratio * width - thumbSize / 2);
}

/** Touches can land marginally outside a view's bounds, so the ratio is always clamped. */
function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
