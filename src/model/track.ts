/**
 * A single playable audio file.
 *
 * This is the shape everything else in the app is built on: queues hold Tracks, playlists
 * hold Track ids, and albums and artists are derived by grouping Tracks. It is deliberately
 * flat — no nested Album or Artist object — because a track arrives from Android as one row
 * of a database table, and keeping it that way means grouping is a decision the app makes
 * rather than a structure it has to unpick.
 */
export type Track = {
  /**
   * MediaStore's row id for device files. Stable while the file stays on the device, so it
   * is safe to store in a playlist; it does *not* survive the file being deleted and
   * re-added, which is why playlists tolerate ids that no longer resolve.
   */
  id: string;

  /** A `content://` URI that expo-audio can play directly. Never a filesystem path. */
  uri: string;

  title: string;

  /**
   * Null, not "Unknown", when the file carries no tag.
   *
   * The distinction matters: null means "this file has no artist", and the display fallback
   * is chosen at render time. Baking "Unknown artist" in here would make an untagged file
   * indistinguishable from one by a band actually called that, and would sort it under U.
   */
  artist: string | null;
  album: string | null;

  /**
   * MediaStore's album id, kept separately from the album *name*.
   *
   * Two different albums can share a title ("Greatest Hits"), and the same album can be
   * tagged inconsistently across its tracks. Grouping on the id keeps those apart, and it
   * is also the key album artwork is looked up and cached by.
   */
  albumId: string;
  artistId: string;

  durationMs: number;

  /**
   * Position within the album. Already split out of MediaStore's packed `TRACK` column,
   * which encodes multi-disc releases as `disc * 1000 + track`.
   */
  trackNumber: number;
  discNumber: number;

  year: number | null;

  /** Distinguishes scanned files from generated ones. See {@link TrackSource}. */
  source: TrackSource;
};

/**
 * Where a track came from.
 *
 * Generated tracks sit in the same library as scanned ones so they queue, sort, and go into
 * playlists identically — the only thing this flag changes is that they are labelled in the
 * UI and persisted by the app rather than discovered by Android's media scanner.
 */
export type TrackSource = 'device' | 'generated';
