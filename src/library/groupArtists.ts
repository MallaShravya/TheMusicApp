import type { Artist, Track } from '@/src/model';
import { UNKNOWN_ARTIST } from '@/src/model';

/**
 * Collects tracks into artists.
 *
 * Keyed on the lowercased artist *name*, deliberately not MediaStore's `ARTIST_ID` — the
 * opposite of what {@link groupAlbums} does, and for the opposite reason. The same artist
 * routinely gets several different ids across differently-tagged files, so grouping by id
 * scatters one artist across duplicate rows. Names collide far more rarely than ids
 * fragment, so name wins here while id wins for albums.
 */
export function groupArtists(tracks: Track[]): Artist[] {
  // A Set for album ids while building, because an artist's tracks arrive interleaved and
  // membership is checked far more often than it is read.
  const byKey = new Map<string, Artist & { albumIdSet: Set<string> }>();

  for (const track of tracks) {
    const name = track.artist ?? UNKNOWN_ARTIST;
    const key = name.toLowerCase();

    const existing = byKey.get(key);
    if (existing) {
      existing.trackIds.push(track.id);
      existing.albumIdSet.add(track.albumId);
    } else {
      byKey.set(key, {
        id: key,
        // Keep the first spelling seen, so the display name has its original casing even
        // though the key is normalised.
        name,
        trackIds: [track.id],
        albumIds: [],
        albumIdSet: new Set([track.albumId]),
      });
    }
  }

  return [...byKey.values()]
    // Drop the working Set and flatten it into the array the rest of the app expects.
    .map(({ albumIdSet, ...artist }) => ({ ...artist, albumIds: [...albumIdSet] }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}
