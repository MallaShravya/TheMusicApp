import { Platform } from 'react-native';
import { requestNotificationPermissionsAsync } from 'expo-audio';

/**
 * Asks for permission to post the media notification.
 *
 * Android 13 put notifications behind a runtime permission, and the lock-screen controls are
 * delivered *as* a notification — so a refusal costs the user their playback controls. It does
 * not cost them playback, which is why this never blocks and a rejection is not an error.
 *
 * Requested on first play rather than at startup: asking to send notifications makes obvious
 * sense the moment music starts, and none before it.
 */
export async function requestPlaybackNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    const { granted } = await requestNotificationPermissionsAsync();
    return granted;
  } catch {
    return false;
  }
}
