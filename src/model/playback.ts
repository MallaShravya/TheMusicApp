/**
 * What happens when the queue reaches its end.
 *
 * - `off`  — playback stops after the last track.
 * - `all`  — the queue wraps back to the start.
 * - `one`  — the current track repeats indefinitely.
 *
 * A three-state mode rather than two booleans, because "repeat all" and "repeat one" are
 * mutually exclusive and a boolean pair would make the illegal both-at-once state
 * representable.
 */
export type RepeatMode = 'off' | 'all' | 'one';
