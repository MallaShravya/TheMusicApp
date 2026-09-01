/**
 * Raw per-frame measurements from decoding a track, exactly as the Kotlin returns them.
 *
 * Deliberately unprocessed. The native side decodes and measures; every perceptual decision —
 * decibels, octaves, per-track normalisation — happens in `src/visualiser`, where it is covered
 * by tests. Anything shaped like a judgement call does not belong in a file that can only be
 * checked by building an APK.
 */
export type NativeTrackAnalysis = {
  /** The rate actually analysed at, after downmix to mono and integer decimation. */
  sampleRate: number;
  /** Milliseconds between frames, echoed back from the request. */
  hopMs: number;
  /** Linear RMS per frame. */
  rms: number[];
  /** Spectral centroid per frame, in Hz. */
  centroidHz: number[];
};
