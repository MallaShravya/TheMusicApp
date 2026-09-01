import { PermissionsAndroid, Platform } from 'react-native';

/**
 * Android 13 split the old blanket storage permission into per-media-type grants, so which
 * permission we need depends on the API level the app is actually running on.
 */
function audioPermission(): Permission {
  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : 0;
  return apiLevel >= 33
    ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
    : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
}

type Permission = (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS];

export async function hasAudioLibraryPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return PermissionsAndroid.check(audioPermission());
}

export async function requestAudioLibraryPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  if (await hasAudioLibraryPermission()) return true;

  const result = await PermissionsAndroid.request(audioPermission(), {
    title: 'Let Ratio read your music',
    message: 'Ratio needs access to the audio files on this device to build your library.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });

  return result === PermissionsAndroid.RESULTS.GRANTED;
}

// The notification permission that backs the lock-screen controls used to live here too. It
// moved to `@/src/player/permissions`: it is asked for on first play and has nothing to do
// with reading the library, so keeping it here made the player depend on this layer for a
// reason that was never really about the library.
