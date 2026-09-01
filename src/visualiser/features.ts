import { largestPowerOfTwo, magnitudeSpectrum } from './fft';

/**
 * The two numbers the fire is driven by, both normalised to 0–1.
 *
 * Everything the visualiser knows about the music is in here. Reducing a buffer of a
 * thousand samples to two scalars on arrival is deliberate: the renderer runs per frame and
 * must never touch raw audio.
 */
export type AudioFeatures = {
  /** Perceived loudness → how big the flames are. */
  amplitude: number;
  /** Perceived brightness → where on the purple-to-white ramp the flames sit. */
  brightness: number;
};

export const SILENCE: AudioFeatures = { amplitude: 0, brightness: 0 };

/** Root mean square — energy, not peak, which is what loudness actually tracks. */
export function rms(frames: ArrayLike<number>): number {
  const length = frames.length;
  if (length === 0) return 0;

  let sum = 0;
  for (let i = 0; i < length; i += 1) sum += frames[i] * frames[i];
  return Math.sqrt(sum / length);
}

/**
 * Loudness on a 0–1 scale, via decibels.
 *
 * Linear RMS is a poor control signal: hearing is logarithmic, so a linear mapping leaves
 * quiet music pinned near zero and loud music saturated near one, with everything
 * interesting crushed into the bottom of the range. In dB, ordinary music spreads across
 * roughly -50 to -8, which is what the window below is.
 */
export const QUIET_DB = -50;
export const LOUD_DB = -8;

export function loudness(frames: ArrayLike<number>): number {
  const energy = rms(frames);
  // log(0) is -Infinity; digital silence is a real input, not an error.
  if (energy <= 0) return 0;

  const db = 20 * Math.log10(energy);
  return clamp01((db - QUIET_DB) / (LOUD_DB - QUIET_DB));
}

/**
 * Spectral centroid: the energy-weighted mean frequency of a buffer, in Hz.
 *
 * The "centre of mass" of the spectrum, and the standard correlate of perceived brightness —
 * a bass line sits low, a cymbal sits high. Used instead of fundamental pitch because a full
 * mix has no single pitch to detect, while it always has a brightness.
 */
export function spectralCentroid(frames: ArrayLike<number>, sampleRate: number): number {
  const size = largestPowerOfTwo(frames.length);
  if (size < 4) return 0;

  const magnitudes = magnitudeSpectrum(frames, size);

  let weighted = 0;
  let total = 0;
  // Bin 0 is DC — a constant offset with no pitch — and including it drags the centroid
  // toward zero on any signal with even slight bias.
  for (let bin = 1; bin < magnitudes.length; bin += 1) {
    const magnitude = magnitudes[bin];
    weighted += ((bin * sampleRate) / size) * magnitude;
    total += magnitude;
  }

  return total > 0 ? weighted / total : 0;
}

/**
 * Brightness on a 0–1 scale.
 *
 * Mapped logarithmically, for the same reason as loudness: an octave is a doubling, so
 * linear Hz would spend most of the range on frequencies nobody hears as distinct. The
 * window spans roughly the low end of a bass to the top of a cymbal's body.
 */
export const DARK_HZ = 120;
export const BRIGHT_HZ = 6000;

export function brightness(frames: ArrayLike<number>, sampleRate: number): number {
  const centroid = spectralCentroid(frames, sampleRate);
  if (centroid <= 0) return 0;

  const span = Math.log2(BRIGHT_HZ) - Math.log2(DARK_HZ);
  return clamp01((Math.log2(centroid) - Math.log2(DARK_HZ)) / span);
}

/** Both features from one buffer, so the FFT is computed once. */
export function analyse(frames: ArrayLike<number>, sampleRate: number): AudioFeatures {
  return {
    amplitude: loudness(frames),
    brightness: brightness(frames, sampleRate),
  };
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
