import type { AudioMetadata } from 'expo-audio';

import type { Track } from '@/src/model';
import { UNKNOWN_ARTIST } from '@/src/model';

/**
 * Describes a track to Android's media notification.
 *
 * This is the one place where the app's `null means untagged` convention has to be given up:
 * the lock screen will render whatever it is handed, so a missing artist becomes the visible
 * fallback rather than an empty line, and a missing album becomes `undefined` so the field is
 * omitted entirely instead of showing as blank.
 */
export function toAudioMetadata(track: Track, artworkUrl?: string): AudioMetadata {
  return {
    title: track.title,
    artist: track.artist ?? UNKNOWN_ARTIST,
    albumTitle: track.album ?? undefined,
    // Only set when we have one — passing `undefined` explicitly would clear artwork that is
    // already showing.
    ...(artworkUrl ? { artworkUrl } : {}),
  };
}
