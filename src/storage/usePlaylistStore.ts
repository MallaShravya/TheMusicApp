import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Playlist } from '@/src/model';

import { PLAYLISTS_KEY } from './keys';
import { readJson, writeJson } from './persistedJson';
import * as ops from './playlistOperations';

export type PlaylistStore = {
  playlists: Playlist[];
  /** True until the first read from storage lands, so screens can avoid an empty flash. */
  loading: boolean;
  createPlaylist: (name: string, trackIds?: string[]) => Promise<Playlist>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  addToPlaylist: (id: string, trackIds: string[]) => Promise<void>;
  removeFromPlaylist: (id: string, trackId: string) => Promise<void>;
  reorderPlaylist: (id: string, trackIds: string[]) => Promise<void>;
};

/**
 * Playlists, kept in memory and mirrored to storage.
 *
 * All the actual editing lives in `playlistOperations` as pure functions. What is left here
 * is the part that cannot be pure: holding the current value, deciding when to write, and
 * supplying the clock and the ids.
 */
export function usePlaylistStore(): PlaylistStore {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  // The current value, readable without making every callback depend on it. A state updater
  // is not allowed to have side effects — it can run twice in development — so the write to
  // storage cannot live inside one.
  const playlistsRef = useRef<Playlist[]>([]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const stored = await readJson<Playlist[]>(PLAYLISTS_KEY, []);
      if (cancelled) return;

      // Storage could hold anything an older build wrote; only an array is usable.
      const loaded = Array.isArray(stored) ? stored : [];
      playlistsRef.current = loaded;
      setPlaylists(loaded);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * The single write path. Applying the transform and persisting the same result means the
   * in-memory list and storage cannot drift apart.
   */
  const commit = useCallback(async (transform: (current: Playlist[]) => Playlist[]) => {
    const next = transform(playlistsRef.current);
    playlistsRef.current = next;
    setPlaylists(next);
    await writeJson(PLAYLISTS_KEY, next);
  }, []);

  const createPlaylist = useCallback(
    async (name: string, trackIds: string[] = []) => {
      const playlist = ops.buildPlaylist({
        id: ops.makePlaylistId(),
        name,
        trackIds,
        now: Date.now(),
      });
      await commit((current) => ops.addPlaylist(current, playlist));
      return playlist;
    },
    [commit],
  );

  const renamePlaylist = useCallback(
    async (id: string, name: string) => {
      await commit((current) => ops.renamePlaylist(current, id, name, Date.now()));
    },
    [commit],
  );

  const deletePlaylist = useCallback(
    async (id: string) => {
      await commit((current) => ops.deletePlaylist(current, id));
    },
    [commit],
  );

  const addToPlaylist = useCallback(
    async (id: string, trackIds: string[]) => {
      await commit((current) => ops.addTracks(current, id, trackIds, Date.now()));
    },
    [commit],
  );

  const removeFromPlaylist = useCallback(
    async (id: string, trackId: string) => {
      await commit((current) => ops.removeTrack(current, id, trackId, Date.now()));
    },
    [commit],
  );

  const reorderPlaylist = useCallback(
    async (id: string, trackIds: string[]) => {
      await commit((current) => ops.reorderTracks(current, id, trackIds, Date.now()));
    },
    [commit],
  );

  return useMemo(
    () => ({
      playlists,
      loading,
      createPlaylist,
      renamePlaylist,
      deletePlaylist,
      addToPlaylist,
      removeFromPlaylist,
      reorderPlaylist,
    }),
    [
      playlists,
      loading,
      createPlaylist,
      renamePlaylist,
      deletePlaylist,
      addToPlaylist,
      removeFromPlaylist,
      reorderPlaylist,
    ],
  );
}
