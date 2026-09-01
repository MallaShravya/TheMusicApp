/**
 * The library layer: what music exists on this device, and how it is organised.
 *
 * Everything below the provider is plain and testable — `toTrack`, `groupAlbums`,
 * `groupArtists` and `sortAlbumTracks` are pure functions of their inputs, and the three
 * hooks each own exactly one concern (loading, watching, caching). `LibraryProvider` only
 * wires them together.
 */
export { LibraryProvider, useLibrary } from './LibraryProvider';
export type { LibraryContextValue } from './LibraryProvider';

export { sortAlbumTracks } from './sortAlbumTracks';
export { groupAlbums } from './groupAlbums';
export { groupArtists } from './groupArtists';
export { toTrack } from './toTrack';

export { useLibraryScan, type LibraryScan, type LibraryStatus } from './useLibraryScan';
export { useLibraryWatch } from './useLibraryWatch';
export { useArtworkCache, type ArtworkCache } from './useArtworkCache';

export { hasAudioLibraryPermission, requestAudioLibraryPermission } from './permissions';
