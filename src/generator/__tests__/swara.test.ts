import {
  frequency,
  justVersusEqual,
  parseSargam,
  SWARAS,
  totalBeats,
  type NoteEvent,
} from '../swara';

const notes = (text: string) => parseSargam(text).events.filter((e): e is NoteEvent => e.kind === 'note');

describe('the swara set', () => {
  it('has one swara per semitone of the octave', () => {
    expect(SWARAS).toHaveLength(12);
    expect(SWARAS.map((s) => s.semitone)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('gives Sa, Ma and Pa their defining ratios', () => {
    // These three are the ones a listener would notice immediately against a drone.
    expect(SWARAS[0].ratio).toBe(1);
    expect(SWARAS.find((s) => s.name === 'M')!.ratio).toBeCloseTo(4 / 3, 10);
    expect(SWARAS.find((s) => s.name === 'P')!.ratio).toBeCloseTo(3 / 2, 10);
  });

  it('orders every ratio the same way as its semitone', () => {
    for (let i = 1; i < SWARAS.length; i += 1) {
      expect(SWARAS[i].ratio).toBeGreaterThan(SWARAS[i - 1].ratio);
    }
  });

  it('keeps every ratio inside one octave', () => {
    for (const swara of SWARAS) {
      expect(swara.ratio).toBeGreaterThanOrEqual(1);
      expect(swara.ratio).toBeLessThan(2);
    }
  });
});

describe('reading sargam', () => {
  it('reads a plain ascent', () => {
    const parsed = notes('S R G M P D N');
    expect(parsed.map((n) => n.swara.name)).toEqual(['S', 'R', 'G', 'M', 'P', 'D', 'N']);
    expect(parsed.every((n) => n.octave === 0)).toBe(true);
  });

  it('reads komal swaras as lowercase', () => {
    expect(notes('r g d n').map((n) => n.swara.semitone)).toEqual([1, 3, 8, 10]);
  });

  it('reads tivra Ma, however it is written', () => {
    for (const text of ['M#', 'm', "M'"]) {
      expect(notes(text)[0].swara.name).toBe('M#');
    }
  });

  it('does not confuse tivra Ma with Ma an octave up', () => {
    // `'` raises an octave everywhere else, so this is the one collision in the notation.
    expect(notes("M'")[0]).toMatchObject({ octave: 0, swara: { name: 'M#' } });
    expect(notes('M#')[0].octave).toBe(0);
  });

  it('reads octave markers, including repeated ones', () => {
    expect(notes('.P')[0].octave).toBe(-1);
    expect(notes('..P')[0].octave).toBe(-2);
    expect(notes("S'")[0].octave).toBe(1);
    expect(notes("S''")[0].octave).toBe(2);
    expect(notes(".N'")[0].octave).toBe(0);
  });

  it('extends a note with a hold rather than repeating it', () => {
    const parsed = notes('S - - R');
    expect(parsed).toHaveLength(2);
    expect(parsed[0].beats).toBe(3);
    expect(parsed[1].beats).toBe(1);
  });

  it('treats an underscore as a beat of silence', () => {
    const { events } = parseSargam('S _ R');
    expect(events.map((e) => e.kind)).toEqual(['note', 'rest', 'note']);
  });

  it('ignores bar lines, which are for the reader', () => {
    expect(notes('S R | G M').map((n) => n.swara.name)).toEqual(['S', 'R', 'G', 'M']);
  });

  it('tolerates any amount of whitespace', () => {
    expect(notes('  S\n\tR   G  ')).toHaveLength(3);
  });

  it('counts the beats of a phrase', () => {
    expect(totalBeats(parseSargam('S - R _ G').events)).toBe(5);
  });
});

describe('when the text is wrong', () => {
  it('reports the bad token and keeps the rest', () => {
    const { events, errors } = parseSargam('S X R');
    expect(events).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ text: 'X', token: 1 });
  });

  it('says where the error was, so it can be pointed at', () => {
    const { errors } = parseSargam('S R Q G Z');
    expect(errors.map((e) => e.token)).toEqual([2, 4]);
  });

  it('refuses a hold with nothing to hold', () => {
    const { events, errors } = parseSargam('- S');
    expect(errors[0].reason).toMatch(/nothing to hold/);
    expect(events).toHaveLength(1);
  });

  it('reads an empty line as nothing at all, not as an error', () => {
    expect(parseSargam('   ')).toEqual({ events: [], errors: [] });
  });
});

describe('pitch', () => {
  const S = SWARAS[0];
  const P = SWARAS.find((s) => s.name === 'P')!;

  it('puts Sa on the tonic it is given', () => {
    expect(frequency(S, 0, 240)).toBe(240);
    expect(frequency(S, 0, 240, 'just')).toBe(240);
  });

  it('doubles an octave up and halves an octave down', () => {
    expect(frequency(S, 1, 240)).toBe(480);
    expect(frequency(S, -1, 240)).toBe(120);
    expect(frequency(S, -2, 240)).toBe(60);
  });

  it('makes Pa a true fifth in just intonation', () => {
    expect(frequency(P, 0, 240, 'just')).toBeCloseTo(360, 10);
  });

  it('makes Pa slightly flat of that in equal temperament', () => {
    // The famous two cents. Audible against a drone, which is the whole reason to offer both.
    const equal = frequency(P, 0, 240, 'equal');
    expect(equal).toBeLessThan(360);
    expect(justVersusEqual(P)).toBeCloseTo(1.955, 2);
  });

  it('never returns a nonsense frequency', () => {
    expect(frequency(S, 0, 0)).toBe(0);
    expect(frequency(S, 0, -100)).toBe(0);
    expect(frequency(S, NaN, 240)).toBe(0);
  });

  it('keeps every swara between the tonic and its octave', () => {
    for (const swara of SWARAS) {
      for (const tuning of ['equal', 'just'] as const) {
        const hz = frequency(swara, 0, 240, tuning);
        expect(hz).toBeGreaterThanOrEqual(240);
        expect(hz).toBeLessThan(480);
      }
    }
  });

  it('never drifts more than a comma from equal temperament', () => {
    // A just ratio that landed a quarter-tone away would be a typo, not a tuning system.
    for (const swara of SWARAS) {
      expect(Math.abs(justVersusEqual(swara))).toBeLessThan(25);
    }
  });
});
