/**
 * One row of Android's `MediaStore.Audio.Media` table, exactly as the Kotlin returns it.
 *
 * This is the raw wire shape, deliberately kept separate from the app's own `Track`
 * (`@/src/model`). They are near-identical today, which is precisely why they must not be
 * the same type: this one is dictated by Android and changes when MediaStore does, while
 * `Track` is ours and has to also describe generated tracks that MediaStore has never heard
 * of. `LibraryProvider` translates between them in one place.
 */
export type NativeTrack = {
  /** MediaStore `_ID`, stable for as long as the file stays on the device. */
  id: string;

  /** `content://` URI, playable directly by expo-audio. */
  uri: string;

  /** Falls back to the filename in Kotlin when the file carries no title tag. */
  title: string;

  /**
   * Null when the file carries no tag. MediaStore stores the literal string `<unknown>`
   * rather than null for these, which the Kotlin normalises away before it reaches here.
   */
  artist: string | null;
  album: string | null;

  albumId: string;
  artistId: string;

  durationMs: number;

  /** Already stripped of the disc prefix MediaStore packs into its `TRACK` column. */
  trackNumber: number;
  discNumber: number;

  year: number | null;
  sizeBytes: number;
  mimeType: string | null;

  /** Seconds since the epoch — MediaStore's unit, *not* JavaScript milliseconds. */
  dateAdded: number;

  filename: string | null;
};
