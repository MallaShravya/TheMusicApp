import { Directory, File, Paths } from 'expo-file-system';

import { durationOf, type Recipe } from './recipe';
import { schedulePhrase, scheduleBeats } from './schedule';
import { parseSargam } from './swara';
import { limit, render } from './synth';
import { encodeWav } from './wav';

/**
 * Turns a recipe into a file the player can open.
 *
 * This is the one place in the generator that touches the device. Everything it uses —
 * parsing, scheduling, synthesis, encoding — is pure and tested; what is left here is the
 * part that cannot be: choosing a sample rate, deciding where the file goes, and writing it.
 *
 * **22050Hz, not 44100.** Halving the rate halves both the time spent synthesising in
 * JavaScript and the size of the file, and the voice is a sine with two quiet harmonics whose
 * highest partial at the top of the range is around 3kHz — nowhere near the ceiling that
 * rate imposes. A richer voice would need the higher rate; this one does not.
 */

export const SAMPLE_RATE = 22050;

/** Where generated audio lives. Document storage, not cache: it must survive the system. */
const FOLDER = 'generated';

export type RenderedPiece = {
  /** A `file://` URI, ready for `player.replace({ uri })`. */
  uri: string;
  durationMs: number;
  bytes: number;
  /** The loudest sample before limiting, so a clipping recipe can be noticed. */
  peak: number;
};

/**
 * Renders a recipe to a WAV in app storage.
 *
 * Synchronous work on the JavaScript thread — a hundred and twenty beats at 360 is about
 * twenty seconds of audio, which is some hundreds of thousands of samples. It is fast enough
 * to wait for and slow enough to want a spinner.
 */
export async function renderRecipe(recipe: Recipe, name: string): Promise<RenderedPiece> {
  const parsed = parseSargam(recipe.phrase);

  const scheduled = schedulePhrase(parsed.events, {
    beatSeconds: 60 / Math.max(1, recipe.beatsPerMinute),
    overlap: recipe.overlap,
    articulation: 0.03,
  });

  const samples = limit(render(scheduled, recipe.sa, { sampleRate: SAMPLE_RATE }));
  const bytes = encodeWav(samples, { sampleRate: SAMPLE_RATE });

  const folder = new Directory(Paths.document, FOLDER);
  if (!folder.exists) folder.create({ intermediates: true });

  const file = new File(folder, `${name}.wav`);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);

  const beats = scheduleBeats(parsed.events);
  const seconds = beats > 0
    ? (beats * 60) / Math.max(1, recipe.beatsPerMinute)
    : durationOf(recipe);

  return {
    uri: file.uri,
    durationMs: Math.round(seconds * 1000),
    bytes: bytes.byteLength,
    peak: peakOf(samples),
  };
}

/** Removes a rendered file, for when a saved piece is deleted. */
export function deleteRendered(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A file already gone is the outcome that was wanted.
  }
}

function peakOf(samples: Float32Array): number {
  let worst = 0;
  for (const value of samples) {
    const size = Math.abs(value);
    if (size > worst) worst = size;
  }
  return worst;
}
