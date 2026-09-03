import type { ScheduledNote } from './schedule';

/**
 * Turns scheduled notes into samples.
 *
 * The whole piece is rendered at once into one buffer rather than streamed, because the app
 * plays files: everything downstream — the queue, the lock screen, the visualiser's analyser
 * — expects something on disk with a known length. Nothing here touches the filesystem or
 * the audio hardware, which is what lets the same code be tested exactly and, if it ever
 * needs to be, moved to Kotlin without changing what it produces.
 *
 * **The voice is a sine and two quiet harmonics**, the same one the preview uses, so what
 * comes out of the app is what was tuned in the browser. It is deliberately dull: this is a
 * generator of pitch relationships, and a rich timbre makes small intervals harder to hear,
 * not easier.
 */

export type VoiceOptions = {
  /** Samples per second. */
  sampleRate: number;
  /**
   * Peak amplitude of a single note, before any overlap.
   *
   * Left well under 1 because notes overlap: two at full scale sum past the ceiling and clip,
   * and the encoder clips rather than normalises, on purpose.
   */
  gain?: number;
  /** Seconds to reach full level. Anything shorter than a millisecond or so clicks. */
  attack?: number;
  /** Seconds to fall silent at the end of a note. */
  release?: number;
};

/** Partial, and its share of the level. Sums to a little over one; the gain accounts for it. */
const HARMONICS: readonly (readonly [number, number])[] = [
  [1, 1],
  [2, 0.16],
  [3, 0.07],
];

/**
 * One cycle of a sine, looked up rather than computed.
 *
 * Measured, not assumed: calling `Math.sin` three times a sample took two and a half seconds
 * to render twenty seconds of audio on a desktop, which on a phone is a wait long enough to
 * look like a hang. A table with linear interpolation between entries gives the same waveform
 * to well under the precision a sixteen-bit file can carry, for a fraction of the work.
 *
 * 4096 entries: the largest error between two neighbours is then about a millionth of full
 * scale, which is some hundreds of times finer than the quantisation that follows.
 */
const TABLE_BITS = 12;
const TABLE_SIZE = 1 << TABLE_BITS;
const TABLE_MASK = TABLE_SIZE - 1;

const SINE = (() => {
  const table = new Float32Array(TABLE_SIZE + 1);
  for (let i = 0; i <= TABLE_SIZE; i += 1) {
    table[i] = Math.sin((2 * Math.PI * i) / TABLE_SIZE);
  }
  return table;
})();

/** A sine of a phase in turns, where 1 is a whole cycle. */
function sine(turns: number): number {
  const scaled = turns * TABLE_SIZE;
  const index = Math.floor(scaled) & TABLE_MASK;
  const fraction = scaled - Math.floor(scaled);
  return SINE[index] + (SINE[index + 1] - SINE[index]) * fraction;
}

/**
 * Renders a phrase.
 *
 * The buffer runs to the end of the last note, including any overhang from squashing, so a
 * note that outlasts its beat is not cut off mid-decay.
 */
export function render(notes: ScheduledNote[], sa: number, options: VoiceOptions): Float32Array {
  const rate = options.sampleRate;
  if (!(rate > 0) || !Number.isFinite(rate)) return new Float32Array(0);

  const gain = options.gain ?? 0.28;
  const attack = Math.max(0.001, options.attack ?? 0.012);
  const release = Math.max(0.004, options.release ?? 0.05);

  let end = 0;
  for (const note of notes) end = Math.max(end, note.at + note.seconds);
  const length = Math.ceil(end * rate);
  if (length <= 0) return new Float32Array(0);

  const out = new Float32Array(length);

  for (const note of notes) {
    const hz = frequencyOf(note.semitones, sa);
    if (!(hz > 0) || !Number.isFinite(hz)) continue;

    const from = Math.max(0, Math.floor(note.at * rate));
    const to = Math.min(length, Math.ceil((note.at + note.seconds) * rate));
    const total = to - from;
    if (total <= 0) continue;

    const attackSamples = Math.max(1, Math.min(Math.floor(attack * rate), Math.floor(total / 2)));
    const releaseSamples = Math.max(1, Math.min(Math.floor(release * rate), total - attackSamples));

    // Phase advances by a fixed amount each sample rather than being recomputed from the
    // time, which is what lets the table replace the trigonometry entirely.
    const steps = HARMONICS.map(([partial, level]) => ({
      increment: (hz * partial) / rate,
      level,
      phase: 0,
    }));

    for (let i = 0; i < total; i += 1) {
      // Linear in and out, flat between. Not an instrument's envelope, but the one thing it
      // must not do is jump, and a jump at either end is a click on every note.
      let envelope = 1;
      if (i < attackSamples) envelope = i / attackSamples;
      else if (i > total - releaseSamples) envelope = (total - i) / releaseSamples;

      let value = 0;
      for (const step of steps) {
        value += sine(step.phase) * step.level;
        step.phase += step.increment;
        // Kept inside one cycle, or the phase grows until a float can no longer resolve the
        // fraction and the tone slowly detunes.
        if (step.phase >= 1) step.phase -= 1;
      }

      // Summed, not replaced: overlapping notes are the point of squashing.
      out[from + i] += value * envelope * gain;
    }
  }

  return out;
}

/**
 * A pitch in hertz, in just intonation.
 *
 * The ratios are the same seven-plus-five the rest of the generator uses, applied to whatever
 * octave the note falls in. Kept here rather than imported from `swara` so this module
 * depends on nothing but numbers — it is the piece most likely to be moved to native code.
 */
export function frequencyOf(semitones: number, sa: number): number {
  if (!Number.isFinite(semitones) || !(sa > 0)) return 0;

  const octave = Math.floor(semitones / 12);
  const within = ((semitones % 12) + 12) % 12;
  return sa * JUST_RATIOS[within] * Math.pow(2, octave);
}

/** Just intonation, as small integer ratios. Matches `SWARAS` in `swara.ts`. */
export const JUST_RATIOS = [
  1,
  16 / 15,
  9 / 8,
  6 / 5,
  5 / 4,
  4 / 3,
  45 / 32,
  3 / 2,
  8 / 5,
  5 / 3,
  16 / 9,
  15 / 8,
];

/** The loudest sample in a buffer, for checking headroom before writing a file. */
export function peak(samples: Float32Array): number {
  let worst = 0;
  for (const value of samples) {
    const size = Math.abs(value);
    if (size > worst) worst = size;
  }
  return worst;
}

/**
 * Scales a buffer down until nothing clips, and only then.
 *
 * Not normalisation: a quiet piece stays quiet, because raising it would erase the difference
 * between a dense passage and a sparse one. This only ever reduces.
 */
export function limit(samples: Float32Array, ceiling = 0.95): Float32Array {
  const worst = peak(samples);
  if (worst <= ceiling || worst === 0) return samples;

  const scale = ceiling / worst;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) out[i] = samples[i] * scale;
  return out;
}
