import {
  BRIGHT_HZ,
  clamp01,
  DARK_HZ,
  LOUD_DB,
  QUIET_DB,
  type AudioFeatures,
} from './features';

/** Exactly what the native decoder hands back: one pair of raw measurements per frame. */
export type RawTrackAnalysis = {
  /** Sample rate the decoder actually analysed at, after downmix and decimation. */
  sampleRate: number;
  /** Milliseconds between frames. */
  hopMs: number;
  /** Linear RMS per frame. */
  rms: number[];
  /** Spectral centroid per frame, in Hz. */
  centroidHz: number[];
};

/** The same track after normalisation: two 0–1 series the fire can be drawn from. */
export type TrackAnalysis = {
  hopMs: number;
  amplitude: number[];
  brightness: number[];
};

export const EMPTY_ANALYSIS: TrackAnalysis = { hopMs: 40, amplitude: [], brightness: [] };

/**
 * Percentiles rather than true extremes.
 *
 * A single click, or the silence before the first note, would otherwise define the range and
 * squash everything else into a sliver of it. The 5th and 95th are far enough in to ignore
 * outliers and far enough out to keep the real dynamics.
 */
const LOW_PERCENTILE = 0.05;
const HIGH_PERCENTILE = 0.95;

/**
 * A range narrower than this is not dynamics, it is a flat signal plus noise — a sustained
 * drone, or a track that never changes. Normalising it would amplify the noise into a
 * strobing fire, so those fall back to absolute windows instead.
 */
const MIN_DB_RANGE = 6;
const MIN_OCTAVE_RANGE = 0.5;

export function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];

  // Linear interpolation between neighbours, so short tracks do not quantise hard to whichever
  // sample happens to sit at the index.
  const position = clamp01(fraction) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];

  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

/** The [low, high] percentile band of a series, ignoring values that are not finite. */
export function percentileRange(values: number[]): [number, number] {
  const usable = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (usable.length === 0) return [0, 0];

  return [percentile(usable, LOW_PERCENTILE), percentile(usable, HIGH_PERCENTILE)];
}

/**
 * Turns raw per-frame measurements into the two normalised series the fire reads.
 *
 * Both axes are log-transformed *before* normalising, not after. The log makes the numbers
 * perceptual — decibels for loudness, octaves for brightness — and the per-track percentile
 * band then spends the fire's whole range on the part each song actually occupies. Doing only
 * one of the two leaves either a quiet track barely flickering, or a normalised signal whose
 * middle is perceptually squashed.
 */
export function buildTrackAnalysis(raw: RawTrackAnalysis): TrackAnalysis {
  const frameCount = Math.min(raw.rms.length, raw.centroidHz.length);
  if (frameCount === 0) return { ...EMPTY_ANALYSIS, hopMs: raw.hopMs || EMPTY_ANALYSIS.hopMs };

  // Silence is a real value here, not an error, but log(0) is not — so silent frames are
  // pinned to the quiet end rather than becoming -Infinity and poisoning the percentiles.
  const decibels: number[] = [];
  const octaves: number[] = [];

  for (let i = 0; i < frameCount; i += 1) {
    const energy = raw.rms[i];
    decibels.push(energy > 0 ? 20 * Math.log10(energy) : QUIET_DB);

    const hz = raw.centroidHz[i];
    octaves.push(hz > 0 ? Math.log2(hz) : Math.log2(DARK_HZ));
  }

  const [dbLow, dbHigh] = rangeOrFallback(
    percentileRange(decibels),
    MIN_DB_RANGE,
    [QUIET_DB, LOUD_DB],
  );
  const [octaveLow, octaveHigh] = rangeOrFallback(
    percentileRange(octaves),
    MIN_OCTAVE_RANGE,
    [Math.log2(DARK_HZ), Math.log2(BRIGHT_HZ)],
  );

  return {
    hopMs: raw.hopMs,
    amplitude: decibels.map((db) => clamp01((db - dbLow) / (dbHigh - dbLow))),
    brightness: octaves.map((oct) => clamp01((oct - octaveLow) / (octaveHigh - octaveLow))),
  };
}

/**
 * Reads the analysis at a moment in the track.
 *
 * Interpolates between frames rather than snapping to the nearest. At a 40 ms hop the render
 * loop runs faster than the data, and stepping would make the fire visibly tick along at
 * 25 Hz instead of moving continuously.
 */
export function sampleAnalysis(analysis: TrackAnalysis, seconds: number): AudioFeatures {
  const { amplitude, brightness, hopMs } = analysis;
  if (amplitude.length === 0) return { amplitude: 0, brightness: 0 };

  const position = (Math.max(0, seconds) * 1000) / hopMs;
  const lower = Math.floor(position);

  // Past the end — a track whose analysis is shorter than its runtime. Hold the last frame
  // rather than dropping to zero, which would snuff the fire before the music stops.
  if (lower >= amplitude.length - 1) {
    const last = amplitude.length - 1;
    return { amplitude: amplitude[last], brightness: brightness[last] };
  }

  const t = position - lower;
  return {
    amplitude: amplitude[lower] + (amplitude[lower + 1] - amplitude[lower]) * t,
    brightness: brightness[lower] + (brightness[lower + 1] - brightness[lower]) * t,
  };
}

function rangeOrFallback(
  [low, high]: [number, number],
  minimumSpan: number,
  fallback: [number, number],
): [number, number] {
  return high - low >= minimumSpan ? [low, high] : fallback;
}
