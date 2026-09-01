/**
 * User-authored data: playlists and favourites.
 *
 * The only state in the app that cannot be rebuilt from the device. Albums and artists are
 * derived from MediaStore and can be thrown away safely; a playlist exists nowhere else, which
 * is why this is the one layer that writes to disk and the one whose storage keys are versioned.
 *
 * All playlist editing is pure (`playlistOperations`); the hooks add persistence, the clock,
 * and id generation.
 */
export { PlaylistProvider, usePlaylists } from './PlaylistProvider';
export type { PlaylistContextValue } from './PlaylistProvider';

export { usePlaylistStore, type PlaylistStore } from './usePlaylistStore';
export { useFavourites, type Favourites } from './useFavourites';

export * as playlistOperations from './playlistOperations';
export { PLAYLISTS_KEY, FAVOURITES_KEY } from './keys';
export { readJson, writeJson } from './persistedJson';
