import {
  DEFAULT_STEP_WEIGHTS,
  largestStep,
  phraseToSargam,
  randomPhrase,
  SHUDDHA_SWARAS,
  soundedNotes,
  stepHistogram,
} from '../randomNotes';
import { parseSargam, toSargam } from '../swara';

const phrase = (over: Partial<Parameters<typeof randomPhrase>[0]> = {}) =>
  randomPhrase({ count: 40, lowest: -16, highest: 16, anchorEvery: 8, ...over });

/** The pitch of a beat that is required to sound one. */
const pitchAt = (tokens: ReturnType<typeof randomPhrase>, index: number): number => {
  const token = tokens[index];
  if (token.kind !== 'note') throw new Error(`beat ${index} does not sound a note`);
  return token.semitones;
};

describe('the shape of a phrase', () => {
  it('produces the number of beats asked for', () => {
    expect(phrase()).toHaveLength(40);
    expect(phrase({ count: 0 })).toHaveLength(0);
  });

  it('sounds a note on the first beat', () => {
    expect(phrase()[0].kind).toBe('note');
  });

  /** The anchor. */
  it('sounds the same note every eighth beat', () => {
    for (let run = 0; run < 200; run += 1) {
      const tokens = phrase();
      const anchors = [0, 8, 16, 24, 32].map((i) => pitchAt(tokens, i));
      expect(new Set(anchors).size).toBe(1);
    }
  });

  it('sounds one other shared note halfway between', () => {
    for (let run = 0; run < 200; run += 1) {
      const tokens = phrase();
      const middles = [4, 12, 20, 28, 36].map((i) => pitchAt(tokens, i));
      expect(new Set(middles).size).toBe(1);
      expect(middles[0]).not.toBe(pitchAt(tokens, 0));
    }
  });

  it('does not fix the anchor to Sa', () => {
    const anchors = new Set<number>();
    for (let run = 0; run < 200; run += 1) anchors.add(pitchAt(phrase(), 0));
    expect(anchors.size).toBeGreaterThan(3);
  });

  it('uses the anchor it is given', () => {
    const tokens = phrase({ anchorNote: 5 });
    for (const i of [0, 8, 16, 24, 32]) expect(pitchAt(tokens, i)).toBe(5);
  });
});

describe('holds and rests', () => {
  it('puts some of both in', () => {
    let holds = 0;
    let rests = 0;
    for (let run = 0; run < 60; run += 1) {
      for (const token of phrase()) {
        if (token.kind === 'hold') holds += 1;
        if (token.kind === 'rest') rests += 1;
      }
    }
    expect(holds).toBeGreaterThan(0);
    expect(rests).toBeGreaterThan(0);
  });

  it('never puts one on a beat that has to sound', () => {
    for (let run = 0; run < 200; run += 1) {
      const tokens = phrase();
      for (const i of [0, 4, 8, 12, 16, 20, 24, 28, 32, 36]) {
        expect(tokens[i].kind).toBe('note');
      }
    }
  });

  it('can be turned off entirely', () => {
    expect(phrase({ holdChance: 0, restChance: 0 }).every((t) => t.kind === 'note')).toBe(true);
  });

  it('makes more of them when asked', () => {
    const quiet = (hold: number, rest: number) => {
      let count = 0;
      for (let run = 0; run < 40; run += 1) {
        count += phrase({ holdChance: hold, restChance: rest }).filter((t) => t.kind !== 'note').length;
      }
      return count;
    };
    expect(quiet(0.4, 0.2)).toBeGreaterThan(quiet(0.05, 0.02));
  });

  it('leaves at least two sounding beats between recurring notes', () => {
    // One would leave a single step to cover whatever separates two pinned notes, which
    // forces a leap past the limit or an outright jump.
    for (let run = 0; run < 200; run += 1) {
      const tokens = phrase({ holdChance: 0.45, restChance: 0.45 });
      const pinned = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36];
      for (let p = 1; p < pinned.length; p += 1) {
        let sounded = 0;
        for (let i = pinned[p - 1] + 1; i <= pinned[p]; i += 1) {
          if (tokens[i].kind === 'note') sounded += 1;
        }
        expect(sounded).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('the steps between sounded notes', () => {
  it('never moves further than the weights allow', () => {
    for (let run = 0; run < 300; run += 1) {
      expect(largestStep(soundedNotes(phrase()))).toBeLessThanOrEqual(4);
    }
  });

  /**
   * The measurement that made the rhythm come first.
   *
   * A held or silent beat sounds no new note, so a step is between the beats that actually
   * sound. Choosing pitches and then hiding some of them would leave two sounded notes eight
   * semitones apart while every written step still looked small.
   */
  it('holds the limit even when most beats are silent', () => {
    for (let run = 0; run < 300; run += 1) {
      expect(largestStep(soundedNotes(phrase({ holdChance: 0.4, restChance: 0.4 })))).toBeLessThanOrEqual(4);
    }
  });

  it('never sounds the same note twice in a row', () => {
    for (let run = 0; run < 200; run += 1) {
      const notes = soundedNotes(phrase());
      for (let i = 1; i < notes.length; i += 1) expect(notes[i]).not.toBe(notes[i - 1]);
    }
  });

  it('stays inside its range', () => {
    for (let run = 0; run < 100; run += 1) {
      for (const note of soundedNotes(phrase({ lowest: -7, highest: 9 }))) {
        expect(note).toBeGreaterThanOrEqual(-7);
        expect(note).toBeLessThanOrEqual(9);
      }
    }
  });

  it('uses ones and twos most, then threes, then fours barely', () => {
    const counts = [0, 0, 0, 0, 0];
    for (let run = 0; run < 500; run += 1) {
      const histogram = stepHistogram(soundedNotes(phrase()));
      for (let size = 1; size <= 4; size += 1) counts[size] += histogram[size] ?? 0;
    }

    const total = counts.reduce((sum, n) => sum + n, 0);
    const share = counts.map((n) => n / total);

    expect(share[1] + share[2]).toBeGreaterThan(0.6);
    expect(share[1]).toBeGreaterThan(share[3]);
    expect(share[2]).toBeGreaterThan(share[3]);
    expect(share[3]).toBeGreaterThan(share[4]);
    expect(share[4]).toBeLessThan(0.05);
  });
});

describe('writing it out', () => {
  it('round-trips through the parser without an error', () => {
    for (let run = 0; run < 60; run += 1) {
      expect(parseSargam(phraseToSargam(phrase())).errors).toEqual([]);
    }
  });

  it('writes holds and rests the way the parser reads them', () => {
    const text = phraseToSargam([
      { kind: 'note', semitones: 0 },
      { kind: 'hold' },
      { kind: 'rest' },
      { kind: 'note', semitones: 7 },
    ]);
    expect(text).toBe('S - _ P');

    const parsed = parseSargam(text);
    expect(parsed.errors).toEqual([]);
    expect(parsed.events.map((e) => e.kind)).toEqual(['note', 'rest', 'note']);
    expect(parsed.events[0].beats).toBe(2);
  });

  it('keeps the beat count: every token is one beat', () => {
    const tokens = phrase();
    const parsed = parseSargam(phraseToSargam(tokens));
    const beats = parsed.events.reduce((sum, e) => sum + e.beats, 0);
    expect(beats).toBe(tokens.length);
  });

  it('puts the anchor on the beats it belongs to, once written and read back', () => {
    const tokens = phrase({ anchorNote: 3, holdChance: 0.3, restChance: 0.15 });
    const parsed = parseSargam(phraseToSargam(tokens));

    let beat = 0;
    for (const event of parsed.events) {
      if (beat % 8 === 0 && event.kind === 'note') {
        expect(event.swara.semitone + event.octave * 12).toBe(3);
      }
      beat += event.beats;
    }
  });
});

describe('when the constraints fight', () => {
  it('still anchors in a range too tight for free movement', () => {
    for (let run = 0; run < 200; run += 1) {
      const tokens = phrase({ lowest: -2, highest: 2 });
      const anchors = [0, 8, 16, 24, 32].map((i) => pitchAt(tokens, i));
      expect(new Set(anchors).size).toBe(1);
      expect(largestStep(soundedNotes(tokens))).toBeLessThanOrEqual(4);
    }
  });

  it('copes with a reversed range', () => {
    expect(phrase({ lowest: 10, highest: 2, count: 8 })).toHaveLength(8);
  });

  it('is deterministic for a given source of randomness', () => {
    let seed = 1;
    const fixed = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const a = randomPhrase({ count: 40, lowest: -16, highest: 16, anchorEvery: 8, random: fixed });
    seed = 1;
    const b = randomPhrase({ count: 40, lowest: -16, highest: 16, anchorEvery: 8, random: fixed });
    expect(a).toEqual(b);
  });
});

describe('the default weights', () => {
  it('never repeats a note', () => {
    expect(DEFAULT_STEP_WEIGHTS[0]).toBe(0);
  });

  it('favours ones and twos, then threes, then fours', () => {
    expect(DEFAULT_STEP_WEIGHTS[1]).toBeGreaterThan(DEFAULT_STEP_WEIGHTS[3]);
    expect(DEFAULT_STEP_WEIGHTS[2]).toBeGreaterThan(DEFAULT_STEP_WEIGHTS[3]);
    expect(DEFAULT_STEP_WEIGHTS[3]).toBeGreaterThan(DEFAULT_STEP_WEIGHTS[4]);
  });

  it('stops at four', () => {
    expect(DEFAULT_STEP_WEIGHTS).toHaveLength(5);
  });
});

describe('sargam for a single note', () => {
  it('writes octave markers the way a person would', () => {
    expect(toSargam(0)).toBe('S');
    expect(toSargam(12)).toBe("S'");
    expect(toSargam(-12)).toBe('.S');
    expect(toSargam(-1)).toBe('.N');
    expect(toSargam(7)).toBe('P');
  });
});

describe('silence never doubles up', () => {
  it('never puts two rests in a row', () => {
    for (let run = 0; run < 400; run += 1) {
      const tokens = phrase({ holdChance: 0.35, restChance: 0.35 });
      for (let i = 1; i < tokens.length; i += 1) {
        expect(tokens[i].kind === 'rest' && tokens[i - 1].kind === 'rest').toBe(false);
      }
    }
  });

  it('never holds a rest, which would be the same silence written differently', () => {
    // `_ -` reads as a two-beat rest. Written differently, heard identically.
    for (let run = 0; run < 400; run += 1) {
      const tokens = phrase({ holdChance: 0.35, restChance: 0.35 });
      for (let i = 1; i < tokens.length; i += 1) {
        expect(tokens[i].kind === 'hold' && tokens[i - 1].kind === 'rest').toBe(false);
      }
    }
  });

  it('never lets a silence last more than one beat, once parsed', () => {
    for (let run = 0; run < 200; run += 1) {
      const parsed = parseSargam(phraseToSargam(phrase({ holdChance: 0.35, restChance: 0.35 })));
      for (const event of parsed.events) {
        if (event.kind === 'rest') expect(event.beats).toBe(1);
      }
    }
  });
});

describe('loop backs', () => {
  const blockOf = (tokens: ReturnType<typeof randomPhrase>, index: number) =>
    JSON.stringify(tokens.slice(index * 4, index * 4 + 4));

  it('repeats an earlier stretch verbatim', () => {
    let found = 0;
    for (let run = 0; run < 200; run += 1) {
      const tokens = phrase({ loopBacks: 2 });
      const blocks = Array.from({ length: 10 }, (_, i) => blockOf(tokens, i));
      const repeated = blocks.length - new Set(blocks).size;
      if (repeated >= 1) found += 1;
    }
    // Not every phrase — a copy can land on a stretch that already matched — but most.
    expect(found).toBeGreaterThan(150);
  });

  it('makes fewer repeats when asked for fewer', () => {
    const repeats = (loops: number) => {
      let total = 0;
      for (let run = 0; run < 120; run += 1) {
        const tokens = phrase({ loopBacks: loops });
        const blocks = Array.from({ length: 10 }, (_, i) => blockOf(tokens, i));
        total += blocks.length - new Set(blocks).size;
      }
      return total;
    };
    expect(repeats(3)).toBeGreaterThan(repeats(0));
  });

  /** A copy must not be able to break anything the original satisfied. */
  it('keeps every other rule intact', () => {
    for (let run = 0; run < 400; run += 1) {
      const tokens = phrase({ loopBacks: 3, holdChance: 0.3, restChance: 0.25 });

      const anchors = [0, 8, 16, 24, 32].map((i) => pitchAt(tokens, i));
      expect(new Set(anchors).size).toBe(1);

      const middles = [4, 12, 20, 28, 36].map((i) => pitchAt(tokens, i));
      expect(new Set(middles).size).toBe(1);
      expect(middles[0]).not.toBe(anchors[0]);

      const notes = soundedNotes(tokens);
      expect(largestStep(notes)).toBeLessThanOrEqual(4);
      for (let i = 1; i < notes.length; i += 1) expect(notes[i]).not.toBe(notes[i - 1]);

      for (let i = 1; i < tokens.length; i += 1) {
        expect(tokens[i].kind === 'rest' && tokens[i - 1].kind === 'rest').toBe(false);
        expect(tokens[i].kind === 'hold' && tokens[i - 1].kind === 'rest').toBe(false);
      }

      expect(parseSargam(phraseToSargam(tokens)).errors).toEqual([]);
    }
  });

  it('leaves the phrase alone when asked for none', () => {
    const tokens = phrase({ loopBacks: 0 });
    expect(tokens).toHaveLength(40);
  });
});

describe('restricting to shuddha swaras', () => {
  const shuddha = (over: Partial<Parameters<typeof randomPhrase>[0]> = {}) =>
    phrase({ allowedPitchClasses: SHUDDHA_SWARAS, ...over });

  const pitchClass = (n: number) => ((n % 12) + 12) % 12;

  it('is the seven natural swaras', () => {
    expect(SHUDDHA_SWARAS).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it('sounds no komal or tivra note', () => {
    for (let run = 0; run < 300; run += 1) {
      for (const note of soundedNotes(shuddha())) {
        expect(SHUDDHA_SWARAS).toContain(pitchClass(note));
      }
    }
  });

  it('puts the recurring notes on the lattice too', () => {
    for (let run = 0; run < 300; run += 1) {
      const tokens = shuddha();
      expect(SHUDDHA_SWARAS).toContain(pitchClass(pitchAt(tokens, 0)));
      expect(SHUDDHA_SWARAS).toContain(pitchClass(pitchAt(tokens, 4)));
    }
  });

  /**
   * The reason this needed more than a filter.
   *
   * The arithmetic reachability test is exact only when every semitone is available. On an
   * uneven lattice it promises arrivals that cannot happen — there is no note one semitone
   * above Sa here — and the generator would then jump to the recurring note rather than step
   * to it, breaking the very limit the weights exist to keep.
   */
  it('still never leaps further than the weights allow', () => {
    for (let run = 0; run < 400; run += 1) {
      expect(largestStep(soundedNotes(shuddha()))).toBeLessThanOrEqual(4);
    }
  });

  it('keeps every other rule intact', () => {
    for (let run = 0; run < 300; run += 1) {
      const tokens = shuddha({ holdChance: 0.3, restChance: 0.25, loopBacks: 3 });

      expect(new Set([0, 8, 16, 24, 32].map((i) => pitchAt(tokens, i))).size).toBe(1);
      const middles = [4, 12, 20, 28, 36].map((i) => pitchAt(tokens, i));
      expect(new Set(middles).size).toBe(1);
      expect(middles[0]).not.toBe(pitchAt(tokens, 0));

      const notes = soundedNotes(tokens);
      for (let i = 1; i < notes.length; i += 1) expect(notes[i]).not.toBe(notes[i - 1]);

      for (let i = 1; i < tokens.length; i += 1) {
        expect(tokens[i].kind === 'rest' && tokens[i - 1].kind === 'rest').toBe(false);
        expect(tokens[i].kind === 'hold' && tokens[i - 1].kind === 'rest').toBe(false);
      }

      expect(parseSargam(phraseToSargam(tokens)).errors).toEqual([]);
    }
  });

  it('shifts the steps toward twos, because ones barely exist here', () => {
    // Only Ga to Ma and Ni to Sa are a single semitone apart among these seven.
    const counts = [0, 0, 0, 0, 0];
    for (let run = 0; run < 300; run += 1) {
      const histogram = stepHistogram(soundedNotes(shuddha()));
      for (let size = 1; size <= 4; size += 1) counts[size] += histogram[size] ?? 0;
    }
    const total = counts.reduce((sum, n) => sum + n, 0);
    expect(counts[2] / total).toBeGreaterThan(counts[1] / total);
  });

  it('leaves the chromatic behaviour alone when unset', () => {
    const classes = new Set<number>();
    for (let run = 0; run < 200; run += 1) {
      for (const note of soundedNotes(phrase())) classes.add(pitchClass(note));
    }
    // All twelve turn up when nothing is restricting them.
    expect(classes.size).toBe(12);
  });

  it('works for any set, not only the shuddha one', () => {
    // Malkauns: S g M d n.
    const malkauns = [0, 3, 5, 8, 10];
    for (let run = 0; run < 200; run += 1) {
      const notes = soundedNotes(shuddha({ allowedPitchClasses: malkauns }));
      for (const note of notes) expect(malkauns).toContain(pitchClass(note));
      expect(largestStep(notes)).toBeLessThanOrEqual(4);
    }
  });
});
