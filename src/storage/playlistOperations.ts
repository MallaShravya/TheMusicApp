import type { Playlist } from '@/src/model';

/**
 * Every edit a playlist can undergo, as pure list-to-list transforms.
 *
 * Each takes the current playlists and returns the next set — no state, no storage, no clock.
 * `now` is a parameter rather than a `Date.now()` call precisely so these can be tested, and
 * so that one edit stamps exactly one timestamp instead of each helper reading the clock at a
 * slightly different moment.
 *
 * The hook above supplies the id and the timestamp; everything here is deterministic.
 */

/** Unique within this device's store, which is the only place it is ever compared. */
export function makePlaylistId(): string {
  return `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildPlaylist({
  id,
  name,
  trackIds,
  now,
}: {
  id: string;
  name: string;
  trackIds: string[];
  now: number;
}): Playlist {
  return {
    id,
    // An empty name is a slip, not an intent — the sheet lets you hit Create without typing.
    name: name.trim() || 'Untitled playlist',
    trackIds,
    createdAt: now,
    updatedAt: now,
  };
}

/** Newest first, matching how the playlists screen lists them. */
export function addPlaylist(playlists: Playlist[], playlist: Playlist): Playlist[] {
  return [playlist, ...playlists];
}

export function renamePlaylist(
  playlists: Playlist[],
  id: string,
  name: string,
  now: number,
): Playlist[] {
  return playlists.map((playlist) =>
    playlist.id === id
      ? // Falls back to the existing name, not to "Untitled": clearing the field is far more
        // likely a mistake than a request to discard the name.
        { ...playlist, name: name.trim() || playlist.name, updatedAt: now }
      : playlist,
  );
}

export function deletePlaylist(playlists: Playlist[], id: string): Playlist[] {
  return playlists.filter((playlist) => playlist.id !== id);
}

export function addTracks(
  playlists: Playlist[],
  id: string,
  trackIds: string[],
  now: number,
): Playlist[] {
  return playlists.map((playlist) => {
    if (playlist.id !== id) return playlist;

    // A playlist is a set, not a bag: adding a track already present is a no-op rather than
    // a duplicate row, which would then play twice and be confusing to remove.
    const existing = new Set(playlist.trackIds);
    const additions = trackIds.filter((trackId) => !existing.has(trackId));

    // Nothing new — return the same object so React sees no change and `updatedAt` does not
    // move for an edit that did not happen.
    if (additions.length === 0) return playlist;

    return { ...playlist, trackIds: [...playlist.trackIds, ...additions], updatedAt: now };
  });
}

export function removeTrack(
  playlists: Playlist[],
  id: string,
  trackId: string,
  now: number,
): Playlist[] {
  return playlists.map((playlist) =>
    playlist.id === id
      ? {
          ...playlist,
          trackIds: playlist.trackIds.filter((existing) => existing !== trackId),
          updatedAt: now,
        }
      : playlist,
  );
}

export function reorderTracks(
  playlists: Playlist[],
  id: string,
  trackIds: string[],
  now: number,
): Playlist[] {
  return playlists.map((playlist) =>
    playlist.id === id ? { ...playlist, trackIds, updatedAt: now } : playlist,
  );
}
