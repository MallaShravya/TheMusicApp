import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { FAVOURITES_KEY } from './keys';
import { readJson, writeJson } from './persistedJson';

export type Favourites = {
  favouriteIds: Set<string>;
  toggleFavourite: (trackId: string) => Promise<void>;
  isFavourite: (trackId: string) => boolean;
};

/**
 * The set of favourited track ids.
 *
 * Kept apart from playlists despite both being stored lists of track ids, because they are
 * used differently: favourites are toggled one at a time from a heart icon and answered
 * thousands of times while scrolling, so this is a Set. Playlists are ordered, named, and
 * edited in bulk. Merging them would mean a fake playlist with a reserved id and special
 * cases at every call site.
 *
 * Stored as an array — `Set` is not JSON — and rebuilt on load.
 */
export function useFavourites(): Favourites {
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());

  // See the note in `usePlaylistStore`: a state updater must stay side-effect free, so the
  // current value is mirrored here for the write path to read.
  const favouritesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const stored = await readJson<string[]>(FAVOURITES_KEY, []);
      if (cancelled) return;

      const loaded = new Set(Array.isArray(stored) ? stored : []);
      favouritesRef.current = loaded;
      setFavouriteIds(loaded);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleFavourite = useCallback(async (trackId: string) => {
    // A new Set rather than mutating: React compares by reference, and an in-place add would
    // leave the heart icon showing the old state.
    const next = new Set(favouritesRef.current);
    if (next.has(trackId)) next.delete(trackId);
    else next.add(trackId);

    favouritesRef.current = next;
    setFavouriteIds(next);
    await writeJson(FAVOURITES_KEY, [...next]);
  }, []);

  const isFavourite = useCallback((trackId: string) => favouriteIds.has(trackId), [favouriteIds]);

  return useMemo(
    () => ({ favouriteIds, toggleFavourite, isFavourite }),
    [favouriteIds, toggleFavourite, isFavourite],
  );
}
