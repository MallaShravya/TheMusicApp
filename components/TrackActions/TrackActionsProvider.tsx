import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { usePlaylists } from '@/src/storage/PlaylistProvider';

import { AddToPlaylistSheet } from './AddToPlaylistSheet';

export type TrackActionsValue = {
  /** Opens the add-to-playlist sheet for one or more tracks. */
  openAddToPlaylist: (trackIds: string[]) => void;
};

const TrackActionsContext = createContext<TrackActionsValue | null>(null);

/**
 * Hosts the add-to-playlist sheet once, at the root.
 *
 * Any row anywhere can raise it without carrying its own modal state — which matters because
 * the ··· menu appears on every track in the app, and a `<Modal>` per row would be thousands
 * of them. The pending track ids are the whole state: non-null means the sheet is open.
 */
export function TrackActionsProvider({ children }: { children: React.ReactNode }) {
  const { playlists, createPlaylist, addToPlaylist } = usePlaylists();
  const [pendingTrackIds, setPendingTrackIds] = useState<string[] | null>(null);

  const close = useCallback(() => setPendingTrackIds(null), []);

  const openAddToPlaylist = useCallback((trackIds: string[]) => {
    // Nothing to file: opening an empty sheet would just be a dead end.
    if (trackIds.length === 0) return;
    setPendingTrackIds(trackIds);
  }, []);

  const handlePick = useCallback(
    async (playlistId: string) => {
      if (!pendingTrackIds) return;
      await addToPlaylist(playlistId, pendingTrackIds);
      close();
    },
    [addToPlaylist, close, pendingTrackIds],
  );

  const handleCreate = useCallback(
    async (name: string) => {
      if (!pendingTrackIds) return;
      // Created with the tracks already in it, rather than create-then-add: one write, and no
      // window where an empty playlist exists.
      await createPlaylist(name, pendingTrackIds);
      close();
    },
    [close, createPlaylist, pendingTrackIds],
  );

  const value = useMemo<TrackActionsValue>(() => ({ openAddToPlaylist }), [openAddToPlaylist]);

  return (
    <TrackActionsContext.Provider value={value}>
      {children}

      <AddToPlaylistSheet
        visible={pendingTrackIds !== null}
        trackCount={pendingTrackIds?.length ?? 0}
        playlists={playlists}
        onPick={(id) => void handlePick(id)}
        onCreate={(name) => void handleCreate(name)}
        onClose={close}
      />
    </TrackActionsContext.Provider>
  );
}

export function useTrackActions(): TrackActionsValue {
  const context = useContext(TrackActionsContext);
  if (!context) throw new Error('useTrackActions must be used inside <TrackActionsProvider>');
  return context;
}
