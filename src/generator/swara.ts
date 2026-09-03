/**
 * The twelve swaras, and how to read them written down.
 *
 * This is the vocabulary layer: it turns text a musician would actually write into pitches,
 * and knows nothing about rhythm, synthesis or ragas. A raga is a set of constraints *over*
 * these; keeping the two apart means a raga can be described without restating what a note is.
 *
 * **Notation.** Capital letters are shuddha, lowercase are komal, and Ma alone takes tivra:
 *
 * ```
 *   S   r  R   g  G   M  M#   P   d  D   n  N
 *   Sa  re Re  ga Ga  Ma Ma#  Pa  dh Dha ni Ni
 * ```
 *
 * A leading `.` drops an octave and a trailing `'` raises one, both repeatable — `.P` is Pa
 * in mandra saptak, `S''` is Sa two octaves up. `-` holds the previous note for another beat,
 * `_` is a beat of silence, and `|` is a bar line that exists only for the reader.
 */

export type SwaraName =
  | 'S' | 'r' | 'R' | 'g' | 'G' | 'M' | 'M#' | 'P' | 'd' | 'D' | 'n' | 'N';

export type Swara = {
  name: SwaraName;
  /** How it is spoken. */
  spoken: string;
  /** Semitones above Sa. */
  semitone: number;
  /**
   * Frequency ratio to Sa in just intonation.
   *
   * One common set of small-integer ratios, not the whole story: Hindustani theory describes
   * twenty-two shrutis, and schools disagree about which ratio a given swara takes in a given
   * raga. These are a defensible default, and the point of offering them at all is that they
   * sound audibly different from equal temperament against a drone — which is the thing worth
   * hearing before deciding what the app should do.
   */
  ratio: number;
};

export const SWARAS: readonly Swara[] = [
  { name: 'S', spoken: 'Sa', semitone: 0, ratio: 1 },
  { name: 'r', spoken: 'komal Re', semitone: 1, ratio: 16 / 15 },
  { name: 'R', spoken: 'Re', semitone: 2, ratio: 9 / 8 },
  { name: 'g', spoken: 'komal Ga', semitone: 3, ratio: 6 / 5 },
  { name: 'G', spoken: 'Ga', semitone: 4, ratio: 5 / 4 },
  { name: 'M', spoken: 'Ma', semitone: 5, ratio: 4 / 3 },
  { name: 'M#', spoken: 'tivra Ma', semitone: 6, ratio: 45 / 32 },
  { name: 'P', spoken: 'Pa', semitone: 7, ratio: 3 / 2 },
  { name: 'd', spoken: 'komal Dha', semitone: 8, ratio: 8 / 5 },
  { name: 'D', spoken: 'Dha', semitone: 9, ratio: 5 / 3 },
  { name: 'n', spoken: 'komal Ni', semitone: 10, ratio: 16 / 9 },
  { name: 'N', spoken: 'Ni', semitone: 11, ratio: 15 / 8 },
] as const;

const BY_NAME = new Map<string, Swara>(SWARAS.map((s) => [s.name, s]));

/** `m` is a common way to write tivra Ma where `#` is awkward to type. */
const ALIASES: Record<string, SwaraName> = { m: 'M#', "M'": 'M#' };

export type Tuning = 'equal' | 'just';

/** One sounded note. `beats` counts the holds that followed it. */
export type NoteEvent = {
  kind: 'note';
  swara: Swara;
  /** 0 is the middle octave; -1 is mandra, +1 is taar. */
  octave: number;
  beats: number;
  /** Where in the source text this began, so a player can highlight it. */
  token: number;
};

export type RestEvent = { kind: 'rest'; beats: number; token: number };

export type Event = NoteEvent | RestEvent;

export type ParseError = {
  /** The offending token, as written. */
  text: string;
  token: number;
  reason: string;
};

export type ParseResult = { events: Event[]; errors: ParseError[] };

/**
 * Reads a line of sargam.
 *
 * Errors are collected rather than thrown, and parsing continues past them. Someone typing a
 * phrase should hear the part that works and be told which token did not, rather than getting
 * silence and one message about the first mistake.
 */
export function parseSargam(text: string): ParseResult {
  const events: Event[] = [];
  const errors: ParseError[] = [];

  const tokens = text
    .replace(/\|/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  tokens.forEach((raw, index) => {
    if (raw === '-') {
      const last = events[events.length - 1];
      if (!last) {
        errors.push({ text: raw, token: index, reason: 'nothing to hold' });
        return;
      }
      last.beats += 1;
      return;
    }

    if (raw === '_') {
      events.push({ kind: 'rest', beats: 1, token: index });
      return;
    }

    let body = raw;
    let octave = 0;

    while (body.startsWith('.')) {
      octave -= 1;
      body = body.slice(1);
    }
    while (body.endsWith("'") && body !== "M'") {
      octave += 1;
      body = body.slice(0, -1);
    }

    const name = ALIASES[body] ?? body;
    const swara = BY_NAME.get(name);

    if (!swara) {
      errors.push({ text: raw, token: index, reason: `not a swara` });
      return;
    }

    events.push({ kind: 'note', swara, octave, beats: 1, token: index });
  });

  return { events, errors };
}

/**
 * The pitch of a swara, in hertz.
 *
 * `sa` is the tonic in hertz — arbitrary by design, since every performer picks their own,
 * and nothing about a raga is tied to a fixed frequency.
 */
export function frequency(
  swara: Swara,
  octave: number,
  sa: number,
  tuning: Tuning = 'equal',
): number {
  if (!(sa > 0) || !Number.isFinite(octave)) return 0;

  const base =
    tuning === 'just' ? sa * swara.ratio : sa * Math.pow(2, swara.semitone / 12);

  return base * Math.pow(2, octave);
}

/** How far a just-intoned swara sits from its equal-tempered neighbour, in cents. */
export function justVersusEqual(swara: Swara): number {
  const cents = 1200 * Math.log2(swara.ratio);
  return cents - swara.semitone * 100;
}

/**
 * Writes a semitone offset from Sa back as sargam.
 *
 * The inverse of reading a token, so a generator can produce something a person can edit:
 * anything this emits, `parseSargam` reads back to the same note.
 */
export function toSargam(semitones: number): string {
  if (!Number.isFinite(semitones)) return 'S';

  const rounded = Math.round(semitones);
  const octave = Math.floor(rounded / 12);
  const within = ((rounded % 12) + 12) % 12;
  const swara = SWARAS[within];

  const below = octave < 0 ? '.'.repeat(-octave) : '';
  const above = octave > 0 ? "'".repeat(octave) : '';
  return below + swara.name + above;
}

/** Total length of a parsed phrase, in beats. */
export function totalBeats(events: Event[]): number {
  return events.reduce((sum, event) => sum + event.beats, 0);
}
