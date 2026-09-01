import type { Track } from '@/src/model';

/**
 * Puts an album's tracks into listening order: disc, then track number, then title.
 *
 * Separate from {@link groupAlbums} because albums are grouped once per scan but sorted per
 * screen — the album page and each section of the artist page sort their own slice, and only
 * when rendered.
 *
 * Title is the tiebreak rather than a stable no-op because untagged files all report track
 * number 0; without it they would appear in whatever order the cursor happened to return.
 */
export function sortAlbumTracks(tracks: Track[]): Track[] {
  // Copy first: callers pass arrays derived from library state, and sorting in place would
  // mutate the very array React is using to decide whether anything changed.
  return [...tracks].sort((a, b) => {
    if (a.discNumber !== b.discNumber) return a.discNumber - b.discNumber;
    if (a.trackNumber !== b.trackNumber) return a.trackNumber - b.trackNumber;
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  });
}
