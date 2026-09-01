import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Track } from '@/src/model';

const STORAGE_KEY = 'ratio.generatedTracks.v1';

/**
 * Tracks produced by the (upcoming) math-based generator.
 *
 * They are rendered to real audio files on disk and then recorded here, so the rest of the
 * app can treat them as ordinary library tracks: they sort, queue, and go into playlists
 * exactly like scanned files. MediaStore never sees them, which is why they need their own
 * store rather than showing up in a rescan.
 */
export type GeneratedTrackRecord = Track & {
  source: 'generated';
  /** Whatever parameters produced this track, kept so a render can be reproduced or tweaked. */
  recipe: Record<string, unknown>;
  createdAt: number;
};

export async function loadGeneratedTracks(): Promise<GeneratedTrackRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GeneratedTrackRecord[]) : [];
  } catch {
    // A corrupt store should cost the user their generated list, not the whole library.
    return [];
  }
}

async function persist(records: GeneratedTrackRecord[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export async function saveGeneratedTrack(record: GeneratedTrackRecord): Promise<GeneratedTrackRecord[]> {
  const existing = await loadGeneratedTracks();
  const next = [record, ...existing.filter((t) => t.id !== record.id)];
  await persist(next);
  return next;
}

export async function deleteGeneratedTrack(id: string): Promise<GeneratedTrackRecord[]> {
  const existing = await loadGeneratedTracks();
  const next = existing.filter((t) => t.id !== id);
  await persist(next);
  return next;
}
