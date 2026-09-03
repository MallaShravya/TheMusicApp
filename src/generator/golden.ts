import { createPerlin } from './perlin';

/**
 * A walk in which every step is the golden ratio.
 *
 * Each note is exactly φ above or below the one before it — never anything else. What the
 * noise decides is only the direction, and because gradient noise holds its sign for a
 * stretch, the line climbs for a while and then falls for a while rather than flickering
 * between the two.
 *
 * **φ is 833.09 cents**, a minor sixth and a third of a semitone. That is the whole character
 * of this: it is nearly a consonance and audibly not one, so the interval never settles. A
 * sequence that only rose by φ would leave hearing in about ten notes, which is why the step
 * has to be able to go both ways for the idea to be playable at all.
 *
 * The pitches it visits are φ raised to integer powers, so — φ being irrational — no two
 * notes in an unbounded walk are ever an octave apart, and none of them coincides with any
 * note of any equal-tempered scale except the one it started on. There is nothing to tune it
 * against, which is the point of hearing it.
 */

/** (1 + √5) / 2. */
export const PHI = (1 + Math.sqrt(5)) / 2;

/** How far a golden step moves, in cents. */
export const PHI_CENTS = 1200 * Math.log2(PHI);

/** Below this there is no room for a single step, and a walk cannot start. */
export const MIN_RANGE_SEMITONES = PHI_CENTS / 100;

export type GoldenWalkOptions = {
  seed: number;
  /** How many notes to produce. */
  steps: number;
  /** How fast the noise decides to change direction. See `contour`'s `span`. */
  span: number;
  /** The note the walk begins on, in hertz. */
  start: number;
  /**
   * How far the walk may wander from `start`, in semitones, up and down.
   *
   * Reached by reflection rather than clamping: when a step would leave the range the
   * direction is inverted instead, so the ratio between successive notes stays exactly φ.
   * Clamping would produce a smaller interval at the boundary and quietly break the rule the
   * whole thing exists to keep.
   */
  rangeSemitones: number;
};

export type GoldenNote = {
  hz: number;
  /** Which power of φ above the starting note this is. */
  power: number;
  /** `1` if this note is above the previous one, `-1` if below, `0` for the first. */
  direction: number;
};

/**
 * Walks the lattice.
 *
 * Returns the notes in order. Every adjacent pair has a frequency ratio of exactly φ or
 * exactly 1/φ — there is a test for it, because it is the one property that must not bend.
 */
export function goldenWalk(options: GoldenWalkOptions): GoldenNote[] {
  const { seed, steps, span, start, rangeSemitones } = options;

  const count = Math.max(0, Math.floor(steps));
  if (count === 0 || !(start > 0) || !Number.isFinite(start)) return [];

  const noise = createPerlin(seed);
  const width = Number.isFinite(span) && span > 0 ? span : 1;

  // In powers of φ, which is the natural unit here: the whole walk is integer arithmetic and
  // the ratio rule cannot drift no matter how long it runs.
  const reach = Number.isFinite(rangeSemitones) ? Math.abs(rangeSemitones) : 24;
  const limit = Math.floor((reach * 100) / PHI_CENTS);

  const notes: GoldenNote[] = [{ hz: start, power: 0, direction: 0 }];
  if (limit < 1) return notes.slice(0, count);

  /**
   * The targets, normalised to their own extremes.
   *
   * Perlin noise nominally runs -1..1 but in practice a stretch of it uses maybe a third of
   * that — it rarely goes near its bounds. Scaling the raw value by `limit` therefore gives a
   * target that never travels far enough to pull the walk anywhere, and the line oscillates
   * about its starting note instead of moving. Stretching each run to its own minimum and
   * maximum is what makes the range mean what it says.
   */
  const raw: number[] = [];
  for (let i = 1; i < count; i += 1) {
    raw.push(noise.fbm((i / count) * width + 0.5, 3));
  }

  const lowest = Math.min(...raw);
  const highest = Math.max(...raw);
  const spread = highest - lowest;
  const targets = raw.map((value) =>
    spread > 1e-6 ? (((value - lowest) / spread) * 2 - 1) * limit : 0,
  );

  let power = 0;
  let previous = 1;

  for (let i = 1; i < count; i += 1) {
    // The noise sets where the line *wants* to be, and the walk takes one golden step
    // towards it. Reading the noise as a direction instead was the obvious thing to do and
    // it was wrong: at a boundary the step would reflect, the noise would still be pointing
    // outwards, and the walk pinballed between two pitches for as long as the noise held its
    // sign. Chasing a position means a rising target produces a run of rising steps.
    const target = targets[i - 1];

    let direction: number;
    if (target > power + 0.5) direction = 1;
    else if (target < power - 0.5) direction = -1;
    // Already where it wants to be. It still has to move — a step of nothing is not a golden
    // step — so it turns around, which is heard as an oscillation about the target rather
    // than as drift away from it.
    else direction = -previous;

    if (Math.abs(power + direction) > limit) direction = -direction;
    if (Math.abs(power + direction) > limit) break;

    power += direction;
    previous = direction;
    notes.push({ hz: start * Math.pow(PHI, power), power, direction });
  }

  return notes;
}

/**
 * The ratio between two frequencies, as a power of φ.
 *
 * Rounded, because it exists to check a walk rather than to measure arbitrary intervals: a
 * result that is not a whole number means something has broken the rule.
 */
export function powerOfPhi(from: number, to: number): number {
  if (!(from > 0) || !(to > 0)) return NaN;
  return Math.log(to / from) / Math.log(PHI);
}
