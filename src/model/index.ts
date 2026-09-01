/**
 * The app's data model, one entity per file.
 *
 * Import from here (`@/src/model`) rather than reaching for individual files, so the split
 * stays an implementation detail and entities can be moved without touching call sites.
 */
export type { Track, TrackSource } from './track';
export type { Album } from './album';
export type { Artist } from './artist';
export type { Playlist } from './playlist';
export type { RepeatMode } from './playback';

export { UNKNOWN_ALBUM } from './album';
export { UNKNOWN_ARTIST } from './artist';
