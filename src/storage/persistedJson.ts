import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Reads JSON from AsyncStorage, falling back rather than throwing.
 *
 * Storage returns a string the app wrote on some earlier run, possibly by an older version.
 * Three things can go wrong — nothing stored, unparseable text, or valid JSON of the wrong
 * shape — and none of them should take down a screen. The caller supplies the fallback and
 * checks the shape, because only it knows what "right" looks like.
 */
export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Writes JSON to AsyncStorage.
 *
 * Deliberately not wrapped in a try/catch: a failed write means the user's playlist did not
 * survive, which is worth surfacing rather than swallowing. Reads are lenient, writes are not.
 */
export async function writeJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}
