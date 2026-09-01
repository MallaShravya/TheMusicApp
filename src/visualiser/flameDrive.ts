import { wobble, wobble01 } from './noise';

/**
 * One tongue's fixed character: where it sits, how tall it rests, and how it answers the music.
 *
 * Generated once per fire, not per frame.
 */
export type TongueSpec = {
  seed: number;
  /** Position across the base, -1 (far left) to 1 (far right). */
  offset: number;
  /** Resting height, as a fraction of the fire's full height. */
  restHeight: number;
  /** Resting width, as a fraction of the base width. */
  restWidth: number;
  /** How strongly this tongue answers loudness. Some barely react; some leap. */
  gain: number;
  /** How quickly its own surges come and go, independent of the music. */
  surgeRate: number;
  /**
   * This tongue's own envelope rates, so it *lags* the music by its own amount.
   *
   * Shaped to satisfy `EnvelopeRates`, so a spec can be handed straight to `follow`. Varying
   * these is what stops the fire answering a beat all at once: a fast tongue snaps up on the
   * transient while a slow one is still swelling from the last one.
   */
  attack: number;
  release: number;
};

/** The fire never goes out while a track plays, so every tongue keeps this much life. */
const IDLE = 0.26;

/**
 * Hard ceiling on how far a tongue can reach, as a multiple of the fire's height.
 *
 * Exported because callers need it to size their canvas: the tallest a tongue can ever be
 * drawn is `height * MAX_REACH`, so a stage that allows for that can never be overshot.
 */
export const MAX_REACH = 1.35;

/** Below this, response is linear; above it, it eases into the ceiling instead of clipping. */
const KNEE = 0.85;

/**
 * Compresses the top of the range rather than truncating it.
 *
 * A hard clamp would make every loud passage look identical once it saturated — all the
 * tongues pinned flat at the same height. This keeps them ordered and still separable up at
 * the ceiling, and a real fire behaves the same way: past a point, more energy stops buying
 * proportionally more height.
 */
function softLimit(value: number): number {
  if (value <= KNEE) return value;
  const room = MAX_REACH - KNEE;
  return KNEE + room * (1 - Math.exp(-(value - KNEE) / room));
}

/**
 * How high one tongue is reaching right now.
 *
 * The important part is that loudness is **not** applied uniformly. Driving every tongue with
 * the same scalar makes the fire rise and fall as a single block — it reads as a shape being
 * resized rather than as fire. Each tongue gets its own gain and its own surge rhythm, so a
 * loud passage lifts them at different moments and by different amounts, and the fire churns.
 *
 * Returns 0 to {@link MAX_REACH}, never more — see `softLimit`. The caller multiplies this by
 * the fire's height, so `height * MAX_REACH` is the tallest anything will ever be drawn.
 */
export function tongueEnergy(spec: TongueSpec, time: number, level: number): number {
  // This tongue's own rhythm. Nothing to do with the music — it is what keeps the fire moving
  // during a sustained note instead of freezing at a height.
  const surge = wobble01(spec.seed + 61.3, time * spec.surgeRate);

  // The music's contribution, gated through this tongue's temperament. `level` is this
  // tongue's *own* followed loudness, not the fire's — see `attack` / `release`.
  const driven = level * spec.gain * (0.3 + 1.35 * surge);

  // Idle flicker, also per-tongue, so a quiet passage is uneven rather than uniformly small.
  const idle = IDLE * (0.5 + 1.0 * wobble01(spec.seed + 17.9, time * spec.surgeRate * 0.55));

  return softLimit(idle + driven);
}

/**
 * Lays out a fire.
 *
 * Two deliberate asymmetries. Positions are jittered rather than evenly spaced, because an
 * even row reads as a fence; and tongues near the centre rest taller, because a fire is a
 * mound with its hottest column in the middle, not a wall of equal flames.
 */
export function makeTongues(count: number): TongueSpec[] {
  const tongues: TongueSpec[] = [];
  const total = Math.max(1, Math.floor(count));

  for (let i = 0; i < total; i += 1) {
    const seed = i * 7.13 + 1;

    // -1…1 across the base, before jitter.
    const even = total === 1 ? 0 : (i / (total - 1)) * 2 - 1;
    const jitter = wobble(seed + 3.1, 0.7) * (0.85 / Math.max(1, total - 1));

    // Falls off toward the edges, so the silhouette is a mound.
    const centrality = 1 - Math.abs(even) ** 1.4;

    tongues.push({
      seed,
      offset: clamp(even * 0.86 + jitter, -1, 1),
      // Normalised so the tallest resting tongue is ~1.0 and `height` is a real budget.
      restHeight: (0.34 + 0.52 * centrality) * (0.82 + 0.32 * wobble01(seed + 11.7, 2.3)),
      restWidth: 0.55 + 0.7 * wobble01(seed + 23.9, 1.1),
      // Wide on purpose: a fire has tongues that barely stir and tongues that leap.
      gain: 0.3 + 1.65 * wobble01(seed + 31.3, 3.7),
      surgeRate: 0.7 + 1.9 * wobble01(seed + 47.1, 5.2),
      attack: 0.14 + 0.55 * wobble01(seed + 53.9, 1.9),
      release: 0.03 + 0.09 * wobble01(seed + 67.3, 4.1),
    });
  }

  return tongues;
}

/**
 * How much wider a tongue gets as it climbs.
 *
 * Fire does broaden when it flares, but nothing like as much as it rises — scaling both
 * equally makes the flame look like an image being stretched rather than something burning
 * harder. A third of the vertical response is about right.
 */
export function tongueSpread(reach: number): number {
  // Guarded like everything else that feeds a native prop. `Math.max(0, NaN)` is NaN, so an
  // unguarded version propagates it into the flame's width — and a NaN dimension reaching
  // react-native-svg closes the app with no error at all.
  if (!Number.isFinite(reach)) return 0.72;
  return 0.72 + 0.34 * Math.min(1.6, Math.max(0, reach));
}

function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low;
  return Math.min(high, Math.max(low, value));
}
