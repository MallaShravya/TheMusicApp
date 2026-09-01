/**
 * Turning playing audio into two numbers a fire can be drawn from.
 *
 * The chain is: the native decoder measures the whole file once → `buildTrackAnalysis`
 * normalises it against that track's own range → `sampleAnalysis` reads it at the current
 * playback position → `follow` smooths → `flameColour` and flame height.
 *
 * Nothing listens to playback. Android's only route to live audio is `Visualizer`, which taps
 * the output session and needs `RECORD_AUDIO`; decoding a file we already have access to needs
 * nothing extra, and knowing the whole waveform in advance is what makes per-track
 * normalisation possible at all.
 *
 * On the substitution worth knowing about: the colour axis is driven by **spectral centroid**
 * rather than pitch. A full mix has no single pitch to detect, but it always has a brightness,
 * and brightness is what a purple-to-white ramp is really asking for.
 */
export { analyse, brightness, loudness, rms, spectralCentroid, SILENCE } from './features';
export type { AudioFeatures } from './features';

export { flameColour, flameColourString } from './flameColour';
export type { Rgb } from './flameColour';

export { follow, FLAME_RATES, COLOUR_RATES } from './envelope';
export type { EnvelopeRates } from './envelope';

export { fftInPlace, hannWindow, largestPowerOfTwo, magnitudeSpectrum } from './fft';

export {
  buildTrackAnalysis,
  sampleAnalysis,
  percentile,
  percentileRange,
  EMPTY_ANALYSIS,
} from './trackAnalysis';
export type { RawTrackAnalysis, TrackAnalysis } from './trackAnalysis';

export { useTrackAnalysis, type TrackAnalysisState } from './useTrackAnalysis';
export { readCachedAnalysis, writeCachedAnalysis } from './analysisCache';

export { flameWidthProfile, flameOutline, toPathData } from './flameShape';
export type { FlameShapeParams, Point } from './flameShape';

export { makeTongues, tongueEnergy, tongueSpread, MAX_REACH } from './flameDrive';

export { buildFlameFrame, EMPTY_FRAME, GLOW_STOPS, safe, HALO_SCALE } from './flameFrame';
export type { FlameFrame } from './flameFrame';
export type { TongueSpec } from './flameDrive';

export { wobble, wobble01 } from './noise';

export {
  DEFAULT_FLAME_SETTINGS,
  FLAME_SETTING_RANGES,
  SCENE,
  VIEWPORT,
  clampSetting,
  normaliseSettings,
} from './flameSettings';
export type { FlameSettings, SettingRange } from './flameSettings';
export { buildSparks, makeSparkStates, SPARK_COUNT } from './sparks';
export type { Spark, SparkState } from './sparks';
export {
  isShooting,
  makeStars,
  shootingStar,
  SHOOTING_DURATION,
  SHOOTING_PERIOD,
  SKY_DEPTH,
  SKY_SEED,
  STREAK_SEGMENTS,
  TWINKLE_GROUPS,
} from './starField';
export type { Star, Streak } from './starField';

export { FlameSettingsProvider, useFlameSettings } from './useFlameSettings';
export {
  clampBrightness,
  MIN_BRIGHTNESS,
  SYSTEM_BRIGHTNESS,
  useScreenBrightness,
} from './useScreenBrightness';
export type { FlameSettingsState } from './useFlameSettings';
