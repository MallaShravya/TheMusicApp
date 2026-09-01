/**
 * The player layer: what is queued, what is playing, and what the lock screen shows.
 *
 * The queue is driven by the app, not by expo-audio. A single `AudioPlayer` is kept alive for
 * the life of the app and tracks are swapped into it — rather than using expo-audio's own
 * `AudioPlaylist`, which offers gapless playback but has no way to publish lock-screen
 * controls. For a music player those controls matter more.
 *
 * The two genuinely tricky decisions — where the queue goes next, and how a shuffled order is
 * built — are pure functions in `queueNavigation` and `shuffle`, so they can be tested without
 * an audio device.
 */
export { PlayerProvider, usePlayer, usePlaybackProgress } from './PlayerProvider';
export type { PlayerControls, PlaybackProgress } from './PlayerProvider';

export { nextMove, type QueueMove, type QueueMoveInput } from './queueNavigation';
export { identityOrder, shuffledOrder } from './shuffle';
export { toAudioMetadata } from './lockScreenMetadata';

export { useAudioSession } from './useAudioSession';
export { useLockScreen, type LockScreen } from './useLockScreen';
export { requestPlaybackNotificationPermission } from './permissions';
