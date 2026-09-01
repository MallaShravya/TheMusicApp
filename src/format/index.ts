/**
 * Turning numbers into the strings the UI shows. One function per file.
 *
 * Everything here is pure: same input, same output, no state and no imports from the rest of
 * the app. That is what makes this layer safe to change — nothing can break except the text
 * on screen.
 *
 * Existing `from '@/src/format'` imports resolve here automatically now that the directory
 * has replaced the old single file, so no call site needed touching.
 */
export { formatDuration } from './duration';
export { formatTotalDuration } from './runtime';
export { pluralise } from './plural';
