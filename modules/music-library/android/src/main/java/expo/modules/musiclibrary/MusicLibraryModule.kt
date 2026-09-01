package expo.modules.musiclibrary

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The JavaScript-facing surface of the music library.
 *
 * Wiring only — every actual job lives in its own file:
 * - [AudioCollection]  which MediaStore table to read
 * - [MediaStoreSchema] which rows count as library content
 * - [TrackQuery]       reading the library
 * - [AlbumArtwork]     covers, cached on disk
 * - [TrackAnalyser]    decoding a track to drive the visualiser
 * - [LibraryWatcher]   noticing when the library changes
 *
 * Keeping this file thin means the boundary can be read at a glance, and none of the work
 * below it has to know it is being called from JavaScript.
 */
class MusicLibraryModule : Module() {

  override fun definition() = ModuleDefinition {
    Name("MusicLibrary")

    Events(LIBRARY_CHANGED)

    // AsyncFunction bodies run off the main thread, which is what keeps a multi-thousand
    // track cursor pass from stalling the UI.
    AsyncFunction("getTracks") {
      TrackQuery(context).all()
    }

    AsyncFunction("getAlbumArtwork") { albumId: String, size: Int ->
      AlbumArtwork(context).resolve(albumId, size)
    }

    // Decodes the file to measure it, rather than tapping playback — which would need
    // RECORD_AUDIO and would only ever see the audio as it went past.
    AsyncFunction("analyseTrack") { uri: String, hopMs: Int ->
      TrackAnalyser(context).analyse(uri, hopMs)
    }

    // Watch only while JavaScript is actually listening — an app nobody is observing should
    // not hold a ContentObserver against the system media provider.
    OnStartObserving { startWatching() }
    OnStopObserving { stopWatching() }
    OnDestroy { stopWatching() }
  }

  /**
   * Held across calls because it owns a registration that must be handed back. Everything
   * else here is constructed per call: [TrackQuery] and [AlbumArtwork] are stateless, and
   * the schema probe they depend on is cached process-wide inside [MediaStoreSchema].
   */
  private var watcher: LibraryWatcher? = null

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun startWatching() {
    if (watcher != null) return

    val created = LibraryWatcher(context) { uri ->
      sendEvent(LIBRARY_CHANGED, mapOf("uri" to uri?.toString()))
    }
    created.start()
    watcher = created
  }

  // Deliberately touches nothing but the existing watcher: this also runs on teardown, when
  // the React context may already be gone and reading `context` would throw.
  private fun stopWatching() {
    watcher?.stop()
    watcher = null
  }

  companion object {
    const val LIBRARY_CHANGED = "onLibraryChanged"
  }
}
