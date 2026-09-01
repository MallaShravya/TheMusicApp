import { useEffect } from 'react';
import { setAudioModeAsync } from 'expo-audio';

/**
 * Configures how the app's audio behaves against the rest of the phone. Once, at startup.
 *
 * - `shouldPlayInBackground` is the setting that keeps music going when the app is not on
 *   screen. Note that on Android it is not sufficient on its own: playback still stops after
 *   roughly three minutes unless a lock-screen session is also active, which is why
 *   `useLockScreen` runs on every track load rather than only when the UI wants a notification.
 * - `playsInSilentMode` because the silent switch is meant for notifications, not for music
 *   the user deliberately started.
 * - `duckOthers` so a navigation prompt or a message notification dips the music briefly
 *   instead of stopping it outright.
 */
export function useAudioSession(): void {
  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
    });
  }, []);
}
