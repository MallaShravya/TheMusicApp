/**
 * `music-library` — reads the device's audio library out of Android's MediaStore.
 *
 * The only part of the app that talks to Android directly. Everything above it consumes
 * plain data through `LibraryProvider`, so this is the single place the platform leaks in.
 *
 * Four pieces:
 * - `getTracks()`      — the whole library in one query
 * - `getAlbumArtwork()`— covers, resolved lazily and cached on disk
 * - `onLibraryChanged` — a push when MediaStore changes, so nothing has to poll
 * - `analyseTrack()`   — decodes a track to drive the visualiser
 */
import { musicLibrary } from './src/nativeModule';

export default musicLibrary;

export type { NativeTrack } from './src/NativeTrack';
export type { NativeTrackAnalysis } from './src/NativeTrackAnalysis';
export type { MusicLibraryEvents } from './src/events';
export type { MusicLibraryNativeModule } from './src/nativeModule';
