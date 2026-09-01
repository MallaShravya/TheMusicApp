package expo.modules.musiclibrary

import android.content.Context
import android.provider.MediaStore

/**
 * Decides which rows count as library content, adapting to what this device's MediaStore
 * actually provides.
 *
 * **In:** music and voice recordings. **Out:** ringtones, alarms, notification sounds,
 * podcasts, audiobooks. MediaStore keeps a separate boolean column per category, so the
 * intent is stated directly in the two lists below rather than inferred from one catch-all
 * flag — moving a category across is a one-line edit here and nothing else changes.
 */
internal class MediaStoreSchema(private val context: Context) {

  /**
   * The columns this device's MediaStore has.
   *
   * `is_recording` only exists from Android 12 and `is_audiobook` from Android 10, and
   * naming a missing column in a WHERE clause is a query-time crash rather than an empty
   * result. Reading the cursor's own schema is cheaper than trusting a version table and
   * cannot drift as Android adds columns.
   */
  fun columns(): Set<String> {
    cached?.let { return it }

    val discovered = runCatching {
      // Creating a cursor does not fetch rows, so this reads the schema, not the library.
      context.contentResolver.query(AudioCollection.uri, null, null, null, null)
        ?.use { it.columnNames.toSet() }
    }.getOrNull()

    // Only remember a real answer: the first probe may run before permission is granted,
    // and an empty set must not be cached as though it were the schema.
    if (!discovered.isNullOrEmpty()) cached = discovered
    return discovered ?: emptySet()
  }

  /** The WHERE clause for a library query, built from the columns that actually exist. */
  fun buildSelection(): String {
    val columns = columns()

    // Probe failed. `is_music` is the one flag present on every Android version, so fall
    // back to it rather than risk naming a column that is not there.
    if (columns.isEmpty()) return MediaStore.Audio.Media.IS_MUSIC + " != 0"

    // COALESCE because these columns are nullable, and `NULL = 0` is NULL in SQLite —
    // comparing directly would silently drop every untagged file in the library.
    val wanted = INCLUDE_FLAGS
      .filter { columns.contains(it) }
      .map { "COALESCE($it, 0) != 0" }
      .toMutableList()

    // Before Android 12 there is no is_recording flag, so fall back to where the system
    // recorder writes. An imperfect match beats no recordings at all on those devices.
    if (!columns.contains(MediaStore.Audio.Media.IS_RECORDING) &&
      columns.contains(MediaStore.Audio.Media.DATA)
    ) {
      @Suppress("DEPRECATION")
      wanted += MediaStore.Audio.Media.DATA + " LIKE '%/Recordings/%'"
    }

    val unwanted = EXCLUDE_FLAGS
      .filter { columns.contains(it) }
      .map { "COALESCE($it, 0) = 0" }

    val included = wanted.joinToString(" OR ")
    return if (unwanted.isEmpty()) "($included)"
    else "($included) AND " + unwanted.joinToString(" AND ")
  }

  companion object {
    /**
     * Process-wide, because a device's MediaStore schema cannot change while the app runs.
     * Holding it here means callers can build a `MediaStoreSchema` freely without paying for
     * the probe again, which keeps the class free of any lifecycle of its own.
     */
    private var cached: Set<String>? = null

    /** A file is library content if any of these is set. */
    private val INCLUDE_FLAGS = listOf(
      MediaStore.Audio.Media.IS_MUSIC,
      MediaStore.Audio.Media.IS_RECORDING,
    )

    /** ...and is dropped if any of these is set, whatever else it claims to be. */
    private val EXCLUDE_FLAGS = listOf(
      MediaStore.Audio.Media.IS_RINGTONE,
      MediaStore.Audio.Media.IS_ALARM,
      MediaStore.Audio.Media.IS_NOTIFICATION,
      MediaStore.Audio.Media.IS_PODCAST,
      MediaStore.Audio.Media.IS_AUDIOBOOK,
    )
  }
}
