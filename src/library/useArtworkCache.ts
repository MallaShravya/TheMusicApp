import { useCallback, useMemo, useRef } from 'react';

import MusicLibrary from '@/modules/music-library';

/** Requested cover size in pixels. Comfortably above the largest place one is drawn. */
const ARTWORK_SIZE = 512;

export type ArtworkCache = {
  /** Resolves an album's cover, hitting the cache when possible. Null means "has no art". */
  getArtwork: (albumId: string) => Promise<string | null>;
  /**
   * Synchronous peek. `undefined` means "not asked yet", `null` means "asked, has none".
   * Lets a list row paint a known cover on its first render instead of flashing a placeholder.
   */
  peekArtwork: (albumId: string) => string | null | undefined;
};

/**
 * Memoises album covers for the life of the process.
 *
 * Two layers of caching, because they solve different problems. The **result** cache stops
 * us re-asking for an album we already know about. The **in-flight** cache stops a burst of
 * simultaneous asks for the *same* album — which is exactly what happens when a list of
 * twelve tracks from one album scrolls into view at once — from each starting its own native
 * bitmap decode. Without it, one album could trigger a dozen concurrent decodes.
 *
 * The Kotlin also caches to disk, including the misses, so this layer is about avoiding the
 * bridge call rather than the decode. Both are worth having: this one is free and synchronous.
 */
export function useArtworkCache(): ArtworkCache {
  // `null` is a real, cached answer ("this album has no art"), so the map holds
  // `string | null` and `undefined` is reserved for "not yet asked".
  const results = useRef(new Map<string, string | null>());
  const inFlight = useRef(new Map<string, Promise<string | null>>());

  const getArtwork = useCallback(async (albumId: string): Promise<string | null> => {
    const cached = results.current.get(albumId);
    if (cached !== undefined) return cached;

    const pending = inFlight.current.get(albumId);
    if (pending) return pending;

    const request = MusicLibrary.getAlbumArtwork(albumId, ARTWORK_SIZE)
      // A failed lookup is cached as "no art" rather than retried: on this device it will
      // keep failing, and a list would otherwise re-ask on every scroll.
      .catch(() => null)
      .then((uri) => {
        results.current.set(albumId, uri);
        inFlight.current.delete(albumId);
        return uri;
      });

    inFlight.current.set(albumId, request);
    return request;
  }, []);

  const peekArtwork = useCallback((albumId: string) => results.current.get(albumId), []);

  // Both callbacks are stable for the life of the provider, so this object is created once
  // and never changes — see the note in `useLibraryScan` for why that matters.
  return useMemo(() => ({ getArtwork, peekArtwork }), [getArtwork, peekArtwork]);
}
