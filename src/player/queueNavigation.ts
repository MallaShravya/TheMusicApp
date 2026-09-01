import type { RepeatMode } from '@/src/model';

/** What should happen when the queue is asked to move. */
export type QueueMove =
  | { type: 'load'; position: number }
  | { type: 'stop' }
  | { type: 'none' };

export type QueueMoveInput = {
  /** Current index into the play order. */
  position: number;
  /** Number of tracks in the play order. */
  length: number;
  direction: 1 | -1;
  repeat: RepeatMode;
  /**
   * True when a track ended on its own, false when the user pressed a button.
   *
   * This is the whole reason the function takes more than a direction. Running off the end of
   * a queue means "stop" when it happened by itself, but "wrap around" when someone deliberately
   * pressed next — a player that silently stopped on a next-press would feel broken.
   */
  auto: boolean;
};

/**
 * Decides where the queue goes next. Pure, so the awkward cases can actually be tested.
 *
 * `repeat: 'one'` is intentionally not handled here. Repeating a single track is a decision
 * about whether to move at all, taken by the caller before it asks; once it has decided to
 * move, a manual next or previous should still cross to the neighbouring track even with
 * repeat-one on. Treating it here would trap the user on one song.
 */
export function nextMove({
  position,
  length,
  direction,
  repeat,
  auto,
}: QueueMoveInput): QueueMove {
  if (length === 0) return { type: 'none' };

  const target = position + direction;

  if (target >= length) {
    // Past the last track: wrap if the user asked for repeat, wrap if the user pressed next
    // themselves, and otherwise stop.
    if (repeat === 'all') return { type: 'load', position: 0 };
    return auto ? { type: 'stop' } : { type: 'load', position: 0 };
  }

  if (target < 0) {
    // Before the first track: repeat-all wraps to the end, otherwise sit on the first track
    // rather than doing nothing, which at least restarts it.
    return { type: 'load', position: repeat === 'all' ? length - 1 : 0 };
  }

  return { type: 'load', position: target };
}
