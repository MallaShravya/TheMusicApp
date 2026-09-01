/**
 * A user-made ordered collection of tracks.
 *
 * Unlike albums and artists, playlists *are* stored — they are the one part of the library
 * that is authored rather than discovered, so nothing else can reconstruct them.
 */
export type Playlist = {
  id: string;
  name: string;

  /**
   * Track ids in playback order.
   *
   * Ids, not Tracks: a playlist saved months ago must not pin a stale copy of a track's
   * metadata, and storing whole objects would duplicate the library into storage. The
   * tradeoff is that ids can outlive the files they point at — a track deleted from the
   * device leaves a dangling id — so playlists resolve ids through the library on read and
   * skip the misses rather than requiring a migration.
   */
  trackIds: string[];

  /** Epoch milliseconds. */
  createdAt: number;
  updatedAt: number;
};
