import type { Event } from './swara';

/**
 * When each note starts and how long it sounds.
 *
 * Separated from both the notation and the synthesis because it is the only place that knows
 * about *time* — the parser deals in beats, the synthesis deals in samples, and the mapping
 * between them is a decision in its own right. It is also where notes are allowed to overlap,
 * which is not a detail: two notes sounding at once is a different musical event from two
 * notes in succession, and it is the only way this generator produces an interval that can be
 * heard as an interval rather than as a move.
 */

export type ScheduledNote = {
  /** Seconds from the start of the phrase. */
  at: number;
  /** How long it sounds, including any overlap into what follows. */
  seconds: number;
  /** Which event produced it, so a player can highlight the right one. */
  index: number;
  /** Semitones from Sa. */
  semitones: number;
};

export type ScheduleOptions = {
  /** Seconds per beat. */
  beatSeconds: number;
  /**
   * How far each note runs into the next, as a fraction of a beat.
   *
   * At 0 the notes are separate. At 0.25 each one is still sounding for the first quarter of
   * its successor, which turns every pair into a brief two-note chord — the phrase stops being
   * a line of pitches and becomes a line of intervals.
   */
  overlap?: number;
  /**
   * A short silence at the end of each note when nothing overlaps.
   *
   * Without it, two notes of the same length butt together and read as one longer note. Only
   * applied when `overlap` is zero, since an overlap makes the question moot.
   */
  articulation?: number;
};

/**
 * Lays a parsed phrase out in time.
 *
 * Rests occupy their beats and sound nothing, which is what separates them from holds: a hold
 * has already been folded into the length of the note before it by the parser, so it never
 * appears here at all.
 */
export function schedulePhrase(events: Event[], options: ScheduleOptions): ScheduledNote[] {
  const beat = Number.isFinite(options.beatSeconds) && options.beatSeconds > 0
    ? options.beatSeconds
    : 0.5;

  const overlap = clamp(options.overlap ?? 0, 0, 4);
  const articulation = Math.max(0, options.articulation ?? 0);

  const scheduled: ScheduledNote[] = [];
  let cursor = 0;

  events.forEach((event, index) => {
    const length = Math.max(0, event.beats) * beat;

    if (event.kind === 'note') {
      const extra = overlap > 0 ? overlap * beat : -Math.min(articulation, length * 0.5);
      scheduled.push({
        at: cursor,
        // Never shorter than a click: a note squeezed to nothing is a pop, not a note.
        seconds: Math.max(0.03, length + extra),
        index,
        semitones: event.swara.semitone + event.octave * 12,
      });
    }

    cursor += length;
  });

  return scheduled;
}

/** How long the phrase runs, ignoring any overlap hanging off the end. */
export function scheduleBeats(events: Event[]): number {
  return events.reduce((sum, event) => sum + Math.max(0, event.beats), 0);
}

/**
 * How many pairs of notes are sounding at the same moment.
 *
 * Reported because it is the point of squashing: at zero overlap this is zero, and the number
 * rising is the phrase turning from a sequence into a series of intervals.
 */
export function overlappingPairs(scheduled: ScheduledNote[]): number {
  let pairs = 0;
  for (let i = 1; i < scheduled.length; i += 1) {
    const previous = scheduled[i - 1];
    if (previous.at + previous.seconds > scheduled[i].at + 1e-9) pairs += 1;
  }
  return pairs;
}

function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low;
  return Math.min(high, Math.max(low, value));
}
