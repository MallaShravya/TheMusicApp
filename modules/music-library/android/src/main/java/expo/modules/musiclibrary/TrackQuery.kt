package expo.modules.musiclibrary

import android.content.ContentUris
import android.content.Context
import android.database.Cursor
import android.provider.MediaStore

/**
 * Reads the whole library in a single cursor pass.
 *
 * One query returns title, artist, album, duration and track number for every file — which
 * is the entire reason this module exists, since `expo-media-library` exposes filenames and
 * nothing else. It is cheap enough to re-run on every change, so the library upstream is
 * rebuilt wholesale rather than patched incrementally.
 */
internal class TrackQuery(private val context: Context) {

  private val schema = MediaStoreSchema(context)

  fun all(): List<Map<String, Any?>> {
    val tracks = mutableListOf<Map<String, Any?>>()

    context.contentResolver
      .query(AudioCollection.uri, PROJECTION, schema.buildSelection(), null, SORT_ORDER)
      ?.use { cursor ->
        val idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
        val titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
        val artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
        val albumCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
        val albumIdCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID)
        val artistIdCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST_ID)
        val durationCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
        val trackCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TRACK)
        val yearCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.YEAR)
        val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE)
        val mimeCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.MIME_TYPE)
        val addedCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_ADDED)
        val nameCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME)

        while (cursor.moveToNext()) {
          val id = cursor.getLong(idCol)
          val albumId = cursor.getLong(albumIdCol)

          // MediaStore encodes TRACK as disc * 1000 + track for multi-disc albums.
          val rawTrack = if (cursor.isNull(trackCol)) 0 else cursor.getInt(trackCol)

          val title = cursor.stringOrNull(titleCol)
            ?: cursor.stringOrNull(nameCol)
            ?: "Unknown title"

          tracks.add(
            mapOf(
              "id" to id.toString(),
              "uri" to ContentUris.withAppendedId(AudioCollection.uri, id).toString(),
              "title" to title,
              "artist" to normaliseUnknown(cursor.stringOrNull(artistCol)),
              "album" to normaliseUnknown(cursor.stringOrNull(albumCol)),
              "albumId" to albumId.toString(),
              "artistId" to cursor.getLong(artistIdCol).toString(),
              "durationMs" to if (cursor.isNull(durationCol)) 0L else cursor.getLong(durationCol),
              "trackNumber" to rawTrack % 1000,
              "discNumber" to rawTrack / 1000,
              "year" to if (cursor.isNull(yearCol)) null else cursor.getInt(yearCol),
              "sizeBytes" to if (cursor.isNull(sizeCol)) 0L else cursor.getLong(sizeCol),
              "mimeType" to cursor.stringOrNull(mimeCol),
              "dateAdded" to if (cursor.isNull(addedCol)) 0L else cursor.getLong(addedCol),
              "filename" to cursor.stringOrNull(nameCol),
            )
          )
        }
      }

    return tracks
  }

  // MediaStore stores the literal string "<unknown>" rather than null for missing tags.
  private fun normaliseUnknown(value: String?): String? =
    if (value == null || value == "<unknown>") null else value

  companion object {
    private val PROJECTION = arrayOf(
      MediaStore.Audio.Media._ID,
      MediaStore.Audio.Media.TITLE,
      MediaStore.Audio.Media.ARTIST,
      MediaStore.Audio.Media.ALBUM,
      MediaStore.Audio.Media.ALBUM_ID,
      MediaStore.Audio.Media.ARTIST_ID,
      MediaStore.Audio.Media.DURATION,
      MediaStore.Audio.Media.TRACK,
      MediaStore.Audio.Media.YEAR,
      MediaStore.Audio.Media.SIZE,
      MediaStore.Audio.Media.MIME_TYPE,
      MediaStore.Audio.Media.DATE_ADDED,
      MediaStore.Audio.Media.DISPLAY_NAME,
    )

    /** Case-insensitive, so "abba" and "ABBA" do not end up in different halves of the list. */
    private val SORT_ORDER = MediaStore.Audio.Media.TITLE + " COLLATE NOCASE ASC"
  }
}

private fun Cursor.stringOrNull(column: Int): String? =
  if (isNull(column)) null else getString(column)
