/**
 * Events the native module pushes up to JavaScript.
 *
 * Only one, and it carries almost nothing on purpose: it is a *signal*, not a payload. The
 * module could diff MediaStore and report exactly what changed, but the library is rebuilt
 * from a single cheap query anyway, so "something changed, look again" is both simpler and
 * impossible to get subtly wrong.
 */
export type MusicLibraryEvents = {
  /**
   * Android's media database changed — a file added, removed, or retagged.
   *
   * Arrives in **bursts**: the system media scanner fires one notification per file, so
   * copying an album emits one of these per track. Always debounce before rescanning.
   *
   * @param payload.uri The specific item that changed, when Android names one. Unused today
   *   — kept because it costs nothing and is the only way to ever do incremental updates.
   */
  onLibraryChanged: (payload: { uri: string | null }) => void;
};
