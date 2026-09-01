/**
 * The data model now lives in `src/model/`, one entity per file.
 *
 * This file stays as a re-export so the twenty-odd existing imports of `@/src/types` keep
 * working unchanged. New code should import from `@/src/model` instead.
 */
export type { Track, TrackSource, Album, Artist, Playlist, RepeatMode } from './model';
export { UNKNOWN_ALBUM, UNKNOWN_ARTIST } from './model';
