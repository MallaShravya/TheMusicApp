import AsyncStorage from '@react-native-async-storage/async-storage';

import { readJson, writeJson } from '@/src/storage';

import type { TrackAnalysis } from './trackAnalysis';

/**
 * Analyses are cached per track so a song is only decoded once.
 *
 * Stored under one key each, with a separate index, rather than as a single map. A map would
 * mean parsing every cached analysis on the first read — hundreds of kilobytes of JSON to
 * answer a question about one track.
 */
const INDEX_KEY = 'ratio.analysis.index.v1';
const ENTRY_PREFIX = 'ratio.analysis.v1.';

/**
 * How many tracks to keep. Each is roughly 20–40 KB, so this is a few hundred kilobytes —
 * comfortably inside AsyncStorage's budget while covering an album or two of recent listening.
 */
const MAX_ENTRIES = 12;

/**
 * Values are stored as bytes, not floats.
 *
 * The series are 0–1 and drive a fire; 1/255 resolution is far below what any eye resolves,
 * and it cuts the stored JSON to a third of what full-precision numbers would take.
 */
const QUANTISE = 255;

type StoredAnalysis = {
  hopMs: number;
  /** Quantised 0–255. */
  amplitude: number[];
  brightness: number[];
};

function entryKey(trackId: string): string {
  return ENTRY_PREFIX + trackId;
}

export async function readCachedAnalysis(trackId: string): Promise<TrackAnalysis | null> {
  const stored = await readJson<StoredAnalysis | null>(entryKey(trackId), null);
  if (!stored || !Array.isArray(stored.amplitude) || !Array.isArray(stored.brightness)) {
    return null;
  }

  return {
    hopMs: stored.hopMs,
    amplitude: stored.amplitude.map((value) => value / QUANTISE),
    brightness: stored.brightness.map((value) => value / QUANTISE),
  };
}

export async function writeCachedAnalysis(
  trackId: string,
  analysis: TrackAnalysis,
): Promise<void> {
  const stored: StoredAnalysis = {
    hopMs: analysis.hopMs,
    amplitude: analysis.amplitude.map(quantise),
    brightness: analysis.brightness.map(quantise),
  };

  await writeJson(entryKey(trackId), stored);
  await touchIndex(trackId);
}

/**
 * Moves a track to the front of the index and evicts anything past the limit.
 *
 * Most-recently-used rather than least-recently-*added*: the tracks worth keeping decoded are
 * the ones being listened to now, which is not the same as the ones cached most recently.
 */
async function touchIndex(trackId: string): Promise<void> {
  const index = await readJson<string[]>(INDEX_KEY, []);
  const withoutThis = (Array.isArray(index) ? index : []).filter((id) => id !== trackId);
  const next = [trackId, ...withoutThis];

  const evicted = next.slice(MAX_ENTRIES);
  if (evicted.length > 0) {
    // Best effort: a failed removal costs disk space, not correctness, and must not lose the
    // index write that follows.
    await Promise.all(
      evicted.map((id) => AsyncStorage.removeItem(entryKey(id)).catch(() => undefined)),
    );
  }

  await writeJson(INDEX_KEY, next.slice(0, MAX_ENTRIES));
}

function quantise(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(1, Math.max(0, value)) * QUANTISE);
}
