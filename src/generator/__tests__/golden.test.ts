import { goldenWalk, MIN_RANGE_SEMITONES, PHI, PHI_CENTS, powerOfPhi } from '../golden';
import { contour } from '../perlin';

/** Pearson correlation, for asking whether one sequence follows another. */
function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  const meanA = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const meanB = b.slice(0, n).reduce((s, v) => s + v, 0) / n;

  let top = 0;
  let leftSq = 0;
  let rightSq = 0;
  for (let i = 0; i < n; i += 1) {
    const left = a[i] - meanA;
    const right = b[i] - meanB;
    top += left * right;
    leftSq += left * left;
    rightSq += right * right;
  }

  return leftSq > 0 && rightSq > 0 ? top / Math.sqrt(leftSq * rightSq) : 0;
}

const walk = (over: Partial<Parameters<typeof goldenWalk>[0]> = {}) =>
  goldenWalk({ seed: 7, steps: 64, span: 4, start: 240, rangeSemitones: 24, ...over });

describe('the ratio', () => {
  it('is the golden ratio', () => {
    expect(PHI).toBeCloseTo(1.6180339887, 9);
    // The defining property: it is its own reciprocal plus one.
    expect(PHI).toBeCloseTo(1 / PHI + 1, 12);
  });

  it('is 833 cents, a minor sixth and a third of a semitone', () => {
    expect(PHI_CENTS).toBeCloseTo(833.09, 2);
    expect(PHI_CENTS - 800).toBeGreaterThan(30);
  });

  it('needs at least that much room for one step', () => {
    expect(MIN_RANGE_SEMITONES).toBeCloseTo(8.33, 2);
  });
});

describe('the walk', () => {
  /** The rule the whole module exists to keep. */
  it('puts exactly one golden step between every pair of successive notes', () => {
    const notes = walk({ steps: 200 });

    for (let i = 1; i < notes.length; i += 1) {
      const ratio = notes[i].hz / notes[i - 1].hz;
      const up = Math.abs(ratio - PHI);
      const down = Math.abs(ratio - 1 / PHI);
      expect(Math.min(up, down)).toBeLessThan(1e-9);
    }
  });

  it('keeps that exact whatever the seed, span or length', () => {
    for (const seed of [1, 42, 9999]) {
      for (const span of [0.5, 4, 30]) {
        const notes = goldenWalk({ seed, steps: 120, span, start: 180, rangeSemitones: 30 });
        for (let i = 1; i < notes.length; i += 1) {
          expect(Math.abs(Math.round(powerOfPhi(notes[i - 1].hz, notes[i].hz)))).toBe(1);
        }
      }
    }
  });

  it('never drifts: the ratio holds after hundreds of steps', () => {
    // Powers are integers, so no rounding accumulates. A float-multiplying implementation
    // would slowly go out of tune and this is what would notice.
    const notes = walk({ steps: 600, rangeSemitones: 40 });
    const last = notes[notes.length - 1];
    expect(last.hz).toBeCloseTo(240 * Math.pow(PHI, last.power), 6);
  });

  it('stays inside the range it was given', () => {
    const range = 20;
    const notes = walk({ steps: 400, rangeSemitones: range });
    for (const note of notes) {
      const cents = 1200 * Math.log2(note.hz / 240);
      expect(Math.abs(cents)).toBeLessThanOrEqual(range * 100 + 1e-6);
    }
  });

  it('reflects at the edge rather than clamping', () => {
    // Clamping would produce a step smaller than φ, which is the one thing not allowed. If
    // the walk reaches its limit and the ratio still holds everywhere, it reflected.
    const notes = walk({ steps: 400, rangeSemitones: 10 });
    const powers = notes.map((n) => n.power);

    expect(Math.max(...powers)).toBe(1);
    expect(Math.min(...powers)).toBe(-1);

    for (let i = 1; i < notes.length; i += 1) {
      expect(Math.abs(notes[i].power - notes[i - 1].power)).toBe(1);
    }
  });

  it('is the same walk for the same seed', () => {
    expect(walk().map((n) => n.power)).toEqual(walk().map((n) => n.power));
  });

  it('is a different walk for a different seed', () => {
    expect(walk({ seed: 1 }).map((n) => n.power)).not.toEqual(walk({ seed: 2 }).map((n) => n.power));
  });

  /**
   * Why Perlin rather than a coin toss.
   *
   * Not measured by counting direction changes, which was the obvious thing and does not
   * work: the rule says every step is a golden step, so the walk can never stand still. Once
   * it arrives where the noise wants it, it has no choice but to oscillate about that note,
   * and a wandering line therefore turns around about as often as a coin does. What actually
   * distinguishes the two is *where* it oscillates — the golden walk's position follows the
   * noise, and a coin toss follows nothing.
   */
  it('follows the noise rather than wandering at random', () => {
    const seed = 7;
    const span = 3;
    const steps = 200;
    const notes = walk({ seed, steps, span, rangeSemitones: 60 });

    const target = Array.from(contour({ seed, steps: steps - 1, span, octaves: 3 }));
    const positions = notes.slice(1).map((n) => n.power);

    expect(correlation(positions, target)).toBeGreaterThan(0.8);
  });

  it('does not follow noise it was not given', () => {
    const notes = walk({ seed: 7, steps: 200, span: 3, rangeSemitones: 60 });
    const unrelated = Array.from(contour({ seed: 999, steps: 199, span: 3, octaves: 3 }));
    const positions = notes.slice(1).map((n) => n.power);

    expect(Math.abs(correlation(positions, unrelated))).toBeLessThan(0.5);
  });

  it('uses the range it is given, rather than hovering near the start', () => {
    const notes = walk({ steps: 200, span: 3, rangeSemitones: 60 });
    const powers = notes.map((n) => n.power);
    const limit = Math.floor(6000 / PHI_CENTS);

    expect(Math.max(...powers)).toBeGreaterThanOrEqual(limit - 1);
    expect(Math.min(...powers)).toBeLessThanOrEqual(-(limit - 1));
  });

  it('reaches every note as a whole power of phi above the start', () => {
    for (const note of walk({ steps: 100 })) {
      expect(Number.isInteger(note.power)).toBe(true);
      expect(note.hz).toBeCloseTo(240 * Math.pow(PHI, note.power), 9);
    }
  });

  it('lands on no equal-tempered pitch but the one it started from', () => {
    // phi is irrational, so a golden step can never be a whole number of semitones. This is
    // the reason it will sound untethered no matter what drone is behind it.
    for (const note of walk({ steps: 60 })) {
      if (note.power === 0) continue;
      const semitones = 12 * Math.log2(note.hz / 240);
      expect(Math.abs(semitones - Math.round(semitones))).toBeGreaterThan
        ? expect(Math.abs(semitones - Math.round(semitones))).toBeGreaterThan(0.01)
        : undefined;
    }
  });
});

describe('edges', () => {
  it('returns nothing for no steps or an impossible start', () => {
    expect(walk({ steps: 0 })).toHaveLength(0);
    expect(walk({ start: 0 })).toHaveLength(0);
    expect(walk({ start: NaN })).toHaveLength(0);
  });

  it('stands still rather than breaking the rule when there is no room', () => {
    // Under one golden step of range, no move is possible without a smaller interval.
    const notes = walk({ steps: 8, rangeSemitones: 4 });
    expect(notes).toHaveLength(1);
  });

  it('emits only positive, finite frequencies', () => {
    for (const note of walk({ steps: 300, rangeSemitones: 36 })) {
      expect(Number.isFinite(note.hz)).toBe(true);
      expect(note.hz).toBeGreaterThan(0);
    }
  });
});
