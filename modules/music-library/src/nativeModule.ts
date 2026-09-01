import { NativeModule, requireNativeModule } from 'expo';
import { Platform } from 'react-native';

import type { MusicLibraryEvents } from './events';
import type { NativeTrackAnalysis } from './NativeTrackAnalysis';
import type { NativeTrack } from './NativeTrack';

/**
 * The contract with `MusicLibraryModule.kt`.
 *
 * This declaration is the *only* description of that boundary on the JavaScript side —
 * there is no generated code and no runtime check tying the two together. If a name or an
 * argument here stops matching the Kotlin, TypeScript stays happy and the call fails on the
 * device instead. Treat any edit to this file as an edit to the Kotlin.
 */
declare class MusicLibraryNativeModule extends NativeModule<MusicLibraryEvents> {
  /**
   * Every music file and voice recording on the device, in one MediaStore query.
   *
   * Cheap enough to call on every change — a few thousand tracks is a single cursor pass —
   * which is what lets the library be rebuilt wholesale rather than patched incrementally.
   */
  getTracks(): Promise<NativeTrack[]>;

  /**
   * An album's cover as a `file://` URI, or null when it has none.
   *
   * Separate from `getTracks` because it decodes and re-compresses a bitmap. Results are
   * cached to disk by the Kotlin, including the misses, so a second call for the same album
   * is effectively free.
   */
  getAlbumArtwork(albumId: string, size: number): Promise<string | null>;

  /**
   * Decodes a track and returns per-frame loudness and brightness measurements.
   *
   * Runs at many times realtime, but is still seconds of work for a long track, so callers
   * should treat it as a background job rather than something to await before playing.
   * Undecodable files come back with empty arrays rather than throwing.
   */
  analyseTrack(uri: string, hopMs: number): Promise<NativeTrackAnalysis>;
}

/**
 * A do-nothing stand-in for platforms with no native side.
 *
 * `requireNativeModule` throws at *module scope* when the native module is absent, which
 * would take down the entire bundle rather than just this feature. The app is Android-only,
 * but Metro still bundles for web and `tsc` runs anywhere, so those paths get an empty
 * library instead of a crash.
 */
const unsupportedPlatformStub = {
  getTracks: async () => [],
  getAlbumArtwork: async () => null,
  analyseTrack: async () => ({ sampleRate: 0, hopMs: 0, rms: [], centroidHz: [] }),
  addListener: () => ({ remove: () => {} }),
  removeAllListeners: () => {},
} as unknown as MusicLibraryNativeModule;

export const musicLibrary: MusicLibraryNativeModule =
  Platform.OS === 'android'
    ? requireNativeModule<MusicLibraryNativeModule>('MusicLibrary')
    : unsupportedPlatformStub;

export type { MusicLibraryNativeModule };
