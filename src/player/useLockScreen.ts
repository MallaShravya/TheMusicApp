import { useCallback, useMemo, useRef } from 'react';
import type { AudioPlayer } from 'expo-audio';

import type { Track } from '@/src/model';

import { toAudioMetadata } from './lockScreenMetadata';

export type LockScreen = {
  /** Publishes a track to the media notification, then fills in its cover when it arrives. */
  show: (track: Track) => void;
  /** Tears the notification down and cancels any artwork still in flight. */
  clear: () => void;
};

/**
 * Owns the media notification.
 *
 * Metadata goes up in two passes on purpose. Text is available immediately, but artwork is a
 * disk read and a decode — waiting for it would leave the lock screen blank for the first
 * moment of every track. So the notification appears instantly with title and artist, and the
 * cover is added a beat later.
 *
 * That second pass is why this hook holds a token. Skipping quickly through tracks starts
 * several artwork lookups that finish out of order, and without a guard a slow lookup for a
 * track you have already left would overwrite the metadata of the one now playing.
 */
export function useLockScreen(
  player: AudioPlayer,
  getArtwork: (albumId: string) => Promise<string | null>,
): LockScreen {
  const tokenRef = useRef(0);

  const show = useCallback(
    (track: Track) => {
      const token = tokenRef.current + 1;
      tokenRef.current = token;

      player.setActiveForLockScreen(true, toAudioMetadata(track), {
        // Next/previous are not offered: expo-audio surfaces no event for them, so buttons
        // here would be dead. Seek is wired through and works.
        showSeekForward: true,
        showSeekBackward: true,
      });

      void getArtwork(track.albumId).then((artworkUrl) => {
        // Stale lookup — the user has moved on. Drop it.
        if (!artworkUrl || tokenRef.current !== token) return;
        player.updateLockScreenMetadata(toAudioMetadata(track, artworkUrl));
      });
    },
    [getArtwork, player],
  );

  const clear = useCallback(() => {
    // Bump first: an artwork lookup already in flight must not resurrect the notification we
    // are about to remove.
    tokenRef.current += 1;
    player.clearLockScreenControls();
  }, [player]);

  return useMemo(() => ({ show, clear }), [show, clear]);
}
