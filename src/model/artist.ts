/**
 * A group of tracks sharing an artist name.
 *
 * Like {@link Album}, derived on each scan rather than stored.
 */
export type Artist = {
  /**
   * The artist's name, lowercased — *not* MediaStore's `ARTIST_ID`.
   *
   * The same artist routinely gets several different ids across differently-tagged files,
   * which would split their work into duplicate rows in the artist list. Keying on the
   * normalised name merges them back together. The cost is that two genuinely different
   * artists with identical names would collide, which is far rarer and far less annoying.
   */
  id: string;

  /** The name as it should be displayed, preserving original casing. */
  name: string;

  trackIds: string[];

  /** Every album this artist appears on, so their page can be grouped as a discography. */
  albumIds: string[];
};

/** Shown in place of a missing artist tag. */
export const UNKNOWN_ARTIST = 'Unknown artist';
