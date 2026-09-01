import React, { createContext, useContext, useMemo } from 'react';

import type { Album, Artist, Track } from '@/src/model';

import { groupAlbums } from './groupAlbums';
import { groupArtists } from './groupArtists';
import { useArtworkCache, type ArtworkCache } from './useArtworkCache';
import { useLibraryScan, type LibraryScan, type LibraryStatus } from './useLibraryScan';
import { useLibraryWatch } from './useLibraryWatch';

type LibraryContextValue = LibraryScan &
  ArtworkCache & {
    trackById: Map<string, Track>;
    albums: Album[];
    artists: Artist[];
    albumById: Map<string, Album>;
    artistById: Map<string, Artist>;
  };

const LibraryContext = createContext<LibraryContextValue | null>(null);

/**
 * Assembles the library from its parts and hands it to the app.
 *
 * Composition only — the scan, the watching, the caching and the grouping each live in their
 * own file. What is left here is the one thing that genuinely belongs to the provider:
 * deciding what the rest of the app sees, and making sure that value only changes when
 * something real has.
 */
export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const scan = useLibraryScan();
  const artwork = useArtworkCache();

  // Rescan when Android says the library changed. Passing `scan.refresh` rather than letting
  // the watcher own a scan keeps a single path to loading tracks.
  useLibraryWatch(scan.refresh);

  /**
   * Albums, artists and the id lookups are all derived from the track list, so they are
   * recomputed together and only when it changes. Grouping a few thousand tracks is cheap;
   * doing it on every render because the memo was split five ways would not be.
   */
  const derived = useMemo(() => {
    const albums = groupAlbums(scan.tracks);
    const artists = groupArtists(scan.tracks);

    return {
      trackById: new Map(scan.tracks.map((track) => [track.id, track])),
      albums,
      artists,
      albumById: new Map(albums.map((album) => [album.id, album])),
      artistById: new Map(artists.map((artist) => [artist.id, artist])),
    };
  }, [scan.tracks]);

  const value = useMemo<LibraryContextValue>(
    () => ({ ...scan, ...artwork, ...derived }),
    [scan, artwork, derived],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryContextValue {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('useLibrary must be used inside <LibraryProvider>');
  return context;
}

// Re-exported so the existing `from '@/src/library/LibraryProvider'` imports keep working.
// New code should reach for `@/src/library` instead.
export { sortAlbumTracks } from './sortAlbumTracks';
export type { LibraryStatus, LibraryContextValue };
