/**
 * One-dimensional Perlin noise, as a source of melodic contour.
 *
 * The reason to reach for this rather than `Math.random()` is that successive values are
 * *correlated*: the line wanders instead of jumping. A random walk over a scale produces
 * something that sounds like a mistake; gradient noise produces something that sounds like a
 * decision, because where it goes next is related to where it has been.
 *
 * Deliberately no musical knowledge here — no scale, no raga, no rhythm. It emits a smooth
 * signal in -1..1 and something else decides what that means. Keeping it that way means the
 * same generator can drive pitch, loudness, timbre or tempo without being rewritten.
 *
 * The visualiser has its own `noise.ts`, which is a cheap sum of sines for making flames
 * wobble. This is the real thing: lattice gradients with interpolation, which is what gives
 * the characteristic soft turns rather than a beating of periods.
 */

export type Perlin = {
  /** Value at `x`, in -1..1. Integer `x` always returns 0 — that is how the lattice works. */
  at(x: number): number;
  /**
   * Several octaves summed, each finer and quieter than the last.
   *
   * One octave alone is very smooth and can feel aimless. Adding octaves puts detail on top
   * of the large movement, which is the difference between a line that drifts and a line
   * that has gestures in it.
   */
  fbm(x: number, octaves?: number, gain?: number, lacunarity?: number): number;
};

const TABLE_SIZE = 256;

/**
 * The bound of raw 1D gradient noise.
 *
 * Interpolating two gradients in -1..1 across a unit cell peaks at a quarter of their
 * difference, so the raw value never leaves -0.5..0.5. Scaling by two lands it in -1..1 with
 * the extremes actually reachable, rather than leaving half the range unused.
 */
const RAW_SCALE = 2;

/** A small integer hash. Deterministic, and adequate for shuffling a permutation table. */
function hash(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a ^= a << 13;
    a >>>= 0;
    a ^= a >> 17;
    a ^= a << 5;
    a >>>= 0;
    return a / 4294967296;
  };
}

/** Perlin's fade: 6t^5 - 15t^4 + 10t^3, whose first and second derivatives vanish at 0 and 1. */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Builds a noise generator for a seed.
 *
 * The same seed always produces the same contour, which matters more here than it might
 * elsewhere: a phrase you liked is worth being able to hear again.
 */
export function createPerlin(seed: number): Perlin {
  const random = hash(Number.isFinite(seed) ? seed : 1);

  // A permutation of 0..255, doubled so lookups can run past the end without wrapping code.
  const permutation = Array.from({ length: TABLE_SIZE }, (_, i) => i);
  for (let i = TABLE_SIZE - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
  }
  const p = [...permutation, ...permutation];

  // In one dimension a gradient is just a direction and a length.
  const gradient = (i: number) => {
    const value = p[i & 511];
    return (value / 255) * 2 - 1;
  };

  const at = (x: number): number => {
    if (!Number.isFinite(x)) return 0;

    const cell = Math.floor(x);
    const t = x - cell;
    const i0 = cell & 255;
    const i1 = (cell + 1) & 255;

    const g0 = gradient(i0);
    const g1 = gradient(i1);

    // Each gradient's contribution is its dot product with the offset to the sample point.
    const v0 = g0 * t;
    const v1 = g1 * (t - 1);

    const blended = v0 + fade(t) * (v1 - v0);
    const scaled = blended * RAW_SCALE;

    return scaled > 1 ? 1 : scaled < -1 ? -1 : scaled;
  };

  const fbm = (x: number, octaves = 3, gain = 0.5, lacunarity = 2): number => {
    if (!Number.isFinite(x)) return 0;

    let sum = 0;
    let amplitude = 1;
    let total = 0;
    let frequency = 1;

    for (let i = 0; i < Math.max(1, Math.floor(octaves)); i += 1) {
      sum += at(x * frequency) * amplitude;
      total += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }

    const value = total > 0 ? sum / total : 0;
    return value > 1 ? 1 : value < -1 ? -1 : value;
  };

  return { at, fbm };
}

export type ContourOptions = {
  seed: number;
  /** How many samples to produce. */
  steps: number;
  /**
   * How far the noise travels over the whole contour, in lattice units.
   *
   * This is the tempo of the *shape*, independent of how many samples describe it: a small
   * span gives one slow arc, a large one gives a restless line, and changing `steps` alone
   * only changes the resolution.
   */
  span: number;
  octaves?: number;
};

/**
 * A contour, as values in -1..1.
 *
 * What those values mean is the caller's business — semitones from a tonic, most likely, but
 * nothing here assumes it.
 *
 * **The line crosses its centre once per lattice unit, whatever the seed.** Gradient noise is
 * zero at every integer, so `span` is not just a speed control: it also sets how many times
 * the contour returns to the middle of its range. A span of 4 comes back to centre four
 * times. Pointed at pitch that reads as a melody repeatedly touching one note — which can
 * sound like a tonic being honoured, or like a tic, depending entirely on how fast it is.
 * Worth knowing before blaming the ear.
 */
export function contour(options: ContourOptions): Float32Array {
  const { seed, steps, span, octaves = 3 } = options;
  const count = Math.max(0, Math.floor(steps));
  const out = new Float32Array(count);

  if (count === 0) return out;

  const noise = createPerlin(seed);
  const width = Number.isFinite(span) && span > 0 ? span : 1;

  for (let i = 0; i < count; i += 1) {
    // Offset by a half so the first sample is not always exactly on a lattice point, where
    // the noise is zero by construction and every contour would start from the same place.
    out[i] = noise.fbm((i / count) * width + 0.5, octaves);
  }

  return out;
}
