import type { Album, Track } from '@/src/model';
import { UNKNOWN_ALBUM } from '@/src/model';

/**
 * Collects tracks into albums.
 *
 * Keyed on MediaStore's album id rather than the album *title*: two unrelated records are
 * both called "Greatest Hits", and grouping by name would silently merge them into one
 * ruined album. The id also survives inconsistent tagging across tracks of the same record.
 *
 * Pure and total — same tracks in, same albums out, and it is re-run from scratch on every
 * scan rather than updated in place. That is what makes it impossible for the album list to
 * drift out of step with the tracks it came from.
 */
export function groupAlbums(tracks: Track[]): Album[] {
  const byId = new Map<string, Album>();

  for (const track of tracks) {
    const existing = byId.get(track.albumId);

    if (existing) {
      existing.trackIds.push(track.id);
      existing.durationMs += track.durationMs;
      // Take a year from whichever track has one: compilations routinely tag only some.
      if (existing.year == null && track.year != null) existing.year = track.year;
    } else {
      byId.set(track.albumId, {
        id: track.albumId,
        title: track.album ?? UNKNOWN_ALBUM,
        artist: track.artist,
        year: track.year,
        trackIds: [track.id],
        durationMs: track.durationMs,
      });
    }
  }

  return [...byId.values()].sort((a, b) =>
    // `sensitivity: 'base'` so "abba" and "ABBA" sort together instead of all lowercase
    // titles landing after all uppercase ones.
    a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
  );
}
