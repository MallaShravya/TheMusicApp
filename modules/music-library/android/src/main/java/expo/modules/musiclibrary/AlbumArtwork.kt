package expo.modules.musiclibrary

import android.content.ContentUris
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.util.Size
import java.io.File
import java.io.FileOutputStream

/**
 * Album covers, resolved one album at a time and cached on disk.
 *
 * Kept out of [TrackQuery] deliberately: fetching art decodes and re-compresses a bitmap,
 * which is orders of magnitude more expensive than reading a row. Bundling it into the scan
 * would turn a fast query into a slow one, so the library loads instantly with placeholders
 * and covers arrive as they are asked for.
 */
internal class AlbumArtwork(private val context: Context) {

  /** A `file://` URI for the album's cover, or null when it has none. */
  fun resolve(albumId: String, size: Int): String? {
    val cacheDir = File(context.cacheDir, CACHE_DIR).apply { mkdirs() }
    val cached = File(cacheDir, albumId + "@" + size + ".jpg")

    if (cached.exists()) {
      // A zero-length file is the tombstone written below, meaning "known to have no art".
      return if (cached.length() > 0L) Uri.fromFile(cached).toString() else null
    }

    val bitmap = loadBitmap(albumId, size)
    if (bitmap == null) {
      // Remember the failure, so a decode known to fail is never retried on every scroll.
      runCatching { cached.createNewFile() }
      return null
    }

    return try {
      FileOutputStream(cached).use { out -> bitmap.compress(Bitmap.CompressFormat.JPEG, 90, out) }
      Uri.fromFile(cached).toString()
    } catch (e: Exception) {
      // A half-written file would be served as a valid cover forever. Remove it.
      cached.delete()
      null
    } finally {
      bitmap.recycle()
    }
  }

  /**
   * Android 10 removed reliable direct access to the album-art provider, so on Q+ the art is
   * requested as a thumbnail of one of the album's own tracks. Older versions still have the
   * legacy provider.
   */
  private fun loadBitmap(albumId: String, size: Int): Bitmap? {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      val trackUri = firstTrackUri(albumId) ?: return null
      return try {
        context.contentResolver.loadThumbnail(trackUri, Size(size, size), null)
      } catch (e: Exception) {
        null
      }
    }

    val numericId = albumId.toLongOrNull() ?: return null
    val legacyUri = ContentUris.withAppendedId(Uri.parse(LEGACY_ALBUM_ART), numericId)
    return try {
      context.contentResolver.openInputStream(legacyUri)?.use { BitmapFactory.decodeStream(it) }
    } catch (e: Exception) {
      null
    }
  }

  /** Any one track from the album — `loadThumbnail` needs a media item, not an album. */
  private fun firstTrackUri(albumId: String): Uri? {
    context.contentResolver.query(
      AudioCollection.uri,
      arrayOf(MediaStore.Audio.Media._ID),
      MediaStore.Audio.Media.ALBUM_ID + " = ?",
      arrayOf(albumId),
      null,
    )?.use { cursor ->
      if (cursor.moveToFirst()) {
        return ContentUris.withAppendedId(AudioCollection.uri, cursor.getLong(0))
      }
    }
    return null
  }

  companion object {
    private const val CACHE_DIR = "albumart"
    private const val LEGACY_ALBUM_ART = "content://media/external/audio/albumart"
  }
}
