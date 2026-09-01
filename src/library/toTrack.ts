import type { NativeTrack } from '@/modules/music-library';
import type { Track } from '@/src/model';

/**
 * Translates one MediaStore row into the app's own {@link Track}.
 *
 * The single place the two shapes meet. They are near-identical today, which is exactly why
 * this function exists rather than a cast: `NativeTrack` is dictated by Android and will
 * change when MediaStore does, while `Track` also has to describe generated tracks that
 * MediaStore has never heard of. When they diverge, they diverge here and nowhere else.
 *
 * Note what is dropped: `sizeBytes`, `mimeType`, `dateAdded` and `filename` are read by the
 * Kotlin but not carried up, because nothing in the UI shows them. They stay in `NativeTrack`
 * so adding a "sort by recently added" later is a change to this function alone.
 */
export function toTrack(native: NativeTrack): Track {
  return {
    id: native.id,
    uri: native.uri,
    title: native.title,
    artist: native.artist,
    album: native.album,
    albumId: native.albumId,
    artistId: native.artistId,
    durationMs: native.durationMs,
    trackNumber: native.trackNumber,
    discNumber: native.discNumber,
    year: native.year,
    source: 'device',
  };
}
