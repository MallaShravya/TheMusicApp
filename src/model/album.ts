/**
 * A group of tracks sharing a MediaStore album id.
 *
 * Albums are never stored — they are derived by grouping the track list on every scan. That
 * means there is no cache to invalidate when the library changes, and no way for the album
 * list to disagree with the tracks it came from.
 */
export type Album = {
  /** MediaStore's album id. Also the key album artwork is fetched and cached under. */
  id: string;

  /** Falls back to {@link UNKNOWN_ALBUM} at grouping time when no track carries a tag. */
  title: string;

  artist: string | null;

  /**
   * Taken from the first track that has one, since compilations frequently tag only some
   * of their tracks with a year.
   */
  year: number | null;

  trackIds: string[];

  /**
   * Total runtime, summed once while grouping.
   *
   * Stored rather than computed on read because the album list renders this on every row,
   * and re-summing per row would turn scrolling into O(tracks) work per frame.
   */
  durationMs: number;
};

/** Shown in place of a missing album title. */
export const UNKNOWN_ALBUM = 'Unknown album';
