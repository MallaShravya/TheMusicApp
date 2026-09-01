package expo.modules.musiclibrary

import android.net.Uri
import android.os.Build
import android.provider.MediaStore

/**
 * Which MediaStore table to read audio from.
 *
 * Android 10 replaced the single `EXTERNAL_CONTENT_URI` with per-volume URIs, so the right
 * answer depends on the running OS version. Every other file needs this URI — the query, the
 * schema probe, the artwork lookup, and the change observer — so it lives in one place rather
 * than each of them repeating the version check.
 */
internal object AudioCollection {
  @Suppress("DEPRECATION")
  val uri: Uri
    get() = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
    } else {
      MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
    }
}
