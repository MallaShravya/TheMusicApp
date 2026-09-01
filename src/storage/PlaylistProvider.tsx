import React, { createContext, useContext, useMemo } from 'react';

import { useFavourites, type Favourites } from './useFavourites';
import { usePlaylistStore, type PlaylistStore } from './usePlaylistStore';

export type PlaylistContextValue = PlaylistStore & Favourites;

const PlaylistContext = createContext<PlaylistContextValue | null>(null);

/**
 * Everything the user has authored: playlists and favourites.
 *
 * Composition only. The two stores are independent — they load in parallel, write to separate
 * keys, and neither can corrupt the other — and are joined here purely because every screen
 * that wants one usually wants the other.
 */
export function PlaylistProvider({ children }: { children: React.ReactNode }) {
  const playlists = usePlaylistStore();
  const favourites = useFavourites();

  const value = useMemo<PlaylistContextValue>(
    () => ({ ...playlists, ...favourites }),
    [playlists, favourites],
  );

  return <PlaylistContext.Provider value={value}>{children}</PlaylistContext.Provider>;
}

export function usePlaylists(): PlaylistContextValue {
  const context = useContext(PlaylistContext);
  if (!context) throw new Error('usePlaylists must be used inside <PlaylistProvider>');
  return context;
}
