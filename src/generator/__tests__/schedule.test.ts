import { overlappingPairs, scheduleBeats, schedulePhrase } from '../schedule';
import { parseSargam } from '../swara';

const scheduleOf = (text: string, overlap = 0) =>
  schedulePhrase(parseSargam(text).events, { beatSeconds: 0.5, overlap, articulation: 0.03 });

describe('laying a phrase out in time', () => {
  it('starts each note where the beats say', () => {
    const notes = scheduleOf('S R G');
    expect(notes.map((n) => n.at)).toEqual([0, 0.5, 1]);
  });

  it('gives a held note the length of its holds', () => {
    const notes = scheduleOf('S - - R');
    expect(notes[0].seconds).toBeCloseTo(1.5 - 0.03, 6);
    expect(notes[1].at).toBeCloseTo(1.5, 6);
  });

  it('leaves a rest as a gap rather than an event', () => {
    const notes = scheduleOf('S _ R');
    expect(notes).toHaveLength(2);
    expect(notes[1].at).toBeCloseTo(1, 6);
  });

  it('carries the pitch through as semitones from Sa', () => {
    expect(scheduleOf("S P S' .S").map((n) => n.semitones)).toEqual([0, 7, 12, -12]);
  });

  it('reports the length in beats, ignoring any overhang', () => {
    expect(scheduleBeats(parseSargam('S - R _ G').events)).toBe(5);
  });
});

describe('separating notes when nothing overlaps', () => {
  it('shortens each note slightly so two of the same length do not merge', () => {
    const notes = scheduleOf('S R');
    expect(notes[0].seconds).toBeLessThan(0.5);
    expect(notes[0].at + notes[0].seconds).toBeLessThanOrEqual(notes[1].at + 1e-9);
  });

  it('leaves nothing sounding at the same time', () => {
    expect(overlappingPairs(scheduleOf('S R G M P'))).toBe(0);
  });

  it('never shortens a note to a click', () => {
    // A very fast tempo could otherwise take the whole note away and leave a pop.
    const notes = schedulePhrase(parseSargam('S R G').events, {
      beatSeconds: 0.02,
      articulation: 0.03,
    });
    for (const note of notes) expect(note.seconds).toBeGreaterThanOrEqual(0.03);
  });
});

describe('squashing', () => {
  it('runs each note a quarter of a beat into the next', () => {
    const notes = scheduleOf('S R G', 0.25);
    // Half a beat long plus a quarter beat of overhang.
    expect(notes[0].seconds).toBeCloseTo(0.5 + 0.125, 6);
    expect(notes[0].at + notes[0].seconds).toBeCloseTo(notes[1].at + 0.125, 6);
  });

  it('makes every pair overlap', () => {
    const notes = scheduleOf('S R G M P', 0.25);
    expect(overlappingPairs(notes)).toBe(notes.length - 1);
  });

  it('does not move any note: only their lengths change', () => {
    const plain = scheduleOf('S R G M');
    const squashed = scheduleOf('S R G M', 0.25);
    expect(squashed.map((n) => n.at)).toEqual(plain.map((n) => n.at));
  });

  it('overlaps more when asked for more', () => {
    const light = scheduleOf('S R G M', 0.1)[0].seconds;
    const heavy = scheduleOf('S R G M', 0.5)[0].seconds;
    expect(heavy).toBeGreaterThan(light);
  });

  it('holds the overlap across a held note too', () => {
    const notes = scheduleOf('S - R', 0.25);
    expect(notes[0].seconds).toBeCloseTo(1 + 0.125, 6);
  });

  it('does not reach across a rest to the note after it', () => {
    // A quarter beat of overhang is shorter than the rest it would have to cross, so silence
    // stays silent — which is the whole reason for having rests at all.
    const notes = scheduleOf('S _ R', 0.25);
    expect(notes[0].at + notes[0].seconds).toBeLessThan(notes[1].at);
    expect(overlappingPairs(notes)).toBe(0);
  });

  it('can reach across a rest if the overlap is long enough to', () => {
    // Stated rather than prevented: an overlap of more than a beat is asking for it.
    const notes = scheduleOf('S _ R', 1.5);
    expect(overlappingPairs(notes)).toBe(1);
  });

  it('leaves the phrase the same length in beats', () => {
    const events = parseSargam('S R G M').events;
    expect(scheduleBeats(events)).toBe(4);
  });
});

describe('bad input', () => {
  it('falls back to a sane tempo rather than dividing by nothing', () => {
    for (const beatSeconds of [0, -1, NaN]) {
      const notes = schedulePhrase(parseSargam('S R').events, { beatSeconds });
      expect(notes[1].at).toBeGreaterThan(0);
      expect(Number.isFinite(notes[0].seconds)).toBe(true);
    }
  });

  it('treats a nonsense overlap as none', () => {
    const notes = schedulePhrase(parseSargam('S R').events, { beatSeconds: 0.5, overlap: NaN });
    expect(overlappingPairs(notes)).toBe(0);
  });

  it('schedules nothing for an empty phrase', () => {
    expect(schedulePhrase([], { beatSeconds: 0.5 })).toEqual([]);
    expect(scheduleBeats([])).toBe(0);
  });

  it('emits only finite, positive durations', () => {
    for (const overlap of [0, 0.25, 1]) {
      for (const note of scheduleOf('S - R _ G M#', overlap)) {
        expect(Number.isFinite(note.at)).toBe(true);
        expect(note.seconds).toBeGreaterThan(0);
      }
    }
  });
});
