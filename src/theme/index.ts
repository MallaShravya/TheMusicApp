/**
 * Design tokens, one concern per file.
 *
 * Nothing here imports from the rest of the app — `typography` reaching for `colors` is the
 * only internal edge. That makes this the second of the two leaf layers (the other is
 * `@/src/format`): safe to change, incapable of breaking behaviour.
 *
 * Existing `from '@/src/theme'` imports resolve here now that the directory has replaced the
 * old single file, so no call site needed touching.
 */
export { colors } from './colors';
export { spacing } from './spacing';
export { radius } from './radius';
export { typography, type } from './typography';
export { MINI_PLAYER_HEIGHT } from './layout';
