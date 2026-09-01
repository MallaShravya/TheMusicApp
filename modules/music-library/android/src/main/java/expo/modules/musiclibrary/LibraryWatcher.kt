package expo.modules.musiclibrary

import android.content.Context
import android.database.ContentObserver
import android.net.Uri
import android.os.Handler
import android.os.Looper

/**
 * Watches Android's media database and reports that it changed.
 *
 * This is what makes the library update itself: nothing polls, and the user never asks for a
 * rescan. Android pushes a notification whenever a track is added, removed or retagged by
 * any app, and the JavaScript side turns that into a re-query.
 *
 * Fires in **bursts** — the system scanner emits one notification per file, so copying an
 * album produces one per track. Debouncing is left to the caller, which already owns the
 * rescan and can collapse a burst into a single pass.
 */
internal class LibraryWatcher(
  private val context: Context,
  // Not named `onChange`: that is also the ContentObserver method overridden below, and
  // having both in scope inside the observer is a needless resolution puzzle.
  private val notifyChanged: (Uri?) -> Unit,
) {
  private var observer: ContentObserver? = null

  fun start() {
    if (observer != null) return

    val watcher = object : ContentObserver(Handler(Looper.getMainLooper())) {
      override fun onChange(selfChange: Boolean, uri: Uri?) {
        notifyChanged(uri)
      }
    }

    // notifyForDescendants = true so edits to individual tracks reach us, not only changes
    // to the collection URI itself.
    context.contentResolver.registerContentObserver(AudioCollection.uri, true, watcher)
    observer = watcher
  }

  fun stop() {
    observer?.let { context.contentResolver.unregisterContentObserver(it) }
    observer = null
  }
}
