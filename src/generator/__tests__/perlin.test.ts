import { contour, createPerlin } from '../perlin';

describe('perlin noise', () => {
  const noise = createPerlin(1234);

  it('gives the same contour for the same seed', () => {
    const again = createPerlin(1234);
    for (let i = 0; i < 50; i += 1) {
      const x = i * 0.37;
      expect(again.at(x)).toBe(noise.at(x));
    }
  });

  it('gives a different contour for a different seed', () => {
    const other = createPerlin(5678);
    const differences = Array.from({ length: 50 }, (_, i) => i * 0.37)
      .filter((x) => Math.abs(other.at(x) - noise.at(x)) > 1e-6);
    expect(differences.length).toBeGreaterThan(40);
  });

  it('stays inside -1..1', () => {
    for (let i = 0; i < 4000; i += 1) {
      const value = noise.at(i * 0.013);
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('is zero on the lattice, which is what makes it gradient noise', () => {
    for (let i = -5; i <= 5; i += 1) {
      expect(Math.abs(noise.at(i))).toBeLessThan(1e-9);
    }
  });

  /**
   * The property the whole thing is for.
   *
   * White noise has no relationship between neighbouring samples; this must. The test is
   * comparative rather than absolute — a step of 0.01 lattice units may never move the value
   * by more than a small fraction, where `Math.random()` would routinely swing the full range.
   */
  it('moves smoothly, unlike random values', () => {
    let noiseJumps = 0;
    let randomJumps = 0;

    for (let i = 1; i < 3000; i += 1) {
      const a = noise.at((i - 1) * 0.01);
      const b = noise.at(i * 0.01);
      noiseJumps += Math.abs(b - a);
      randomJumps += Math.abs(Math.random() * 2 - 1 - (Math.random() * 2 - 1));
    }

    expect(noiseJumps).toBeLessThan(randomJumps / 10);
  });

  it('never jumps far in a single small step', () => {
    for (let i = 1; i < 3000; i += 1) {
      const a = noise.at((i - 1) * 0.005);
      const b = noise.at(i * 0.005);
      expect(Math.abs(b - a)).toBeLessThan(0.06);
    }
  });

  it('actually uses its range rather than hugging the middle', () => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 5000; i += 1) {
      const value = noise.at(i * 0.017);
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    expect(max).toBeGreaterThan(0.5);
    expect(min).toBeLessThan(-0.5);
  });

  it('survives nonsense input', () => {
    expect(noise.at(NaN)).toBe(0);
    expect(noise.at(Infinity)).toBe(0);
    expect(noise.fbm(NaN)).toBe(0);
    expect(createPerlin(NaN).at(0.5)).toBeGreaterThanOrEqual(-1);
  });
});

describe('fbm', () => {
  const noise = createPerlin(99);

  it('stays inside -1..1 however many octaves', () => {
    for (const octaves of [1, 2, 4, 8]) {
      for (let i = 0; i < 800; i += 1) {
        const value = noise.fbm(i * 0.03, octaves);
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('adds detail, measured as changes of direction rather than as travel', () => {
    // Not total variation. `fbm` divides by the sum of its amplitudes, so adding octaves
    // scales the fundamental down by more than the fine detail puts back — four octaves
    // actually travels *less* than one. What octaves add is turns, not range, and that
    // distinction matters when choosing a value by ear.
    const turns = (octaves: number) => {
      let count = 0;
      let previous = noise.fbm(0, octaves) - noise.fbm(-0.01, octaves);
      for (let i = 1; i < 2000; i += 1) {
        const slope = noise.fbm(i * 0.01, octaves) - noise.fbm((i - 1) * 0.01, octaves);
        if (slope !== 0 && previous !== 0 && Math.sign(slope) !== Math.sign(previous)) count += 1;
        previous = slope;
      }
      return count;
    };

    expect(turns(4)).toBeGreaterThan(turns(1));
  });

  it('is one octave of plain noise when asked for one', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(noise.fbm(i * 0.31, 1)).toBeCloseTo(noise.at(i * 0.31), 10);
    }
  });
});

describe('contour', () => {
  it('produces the number of steps asked for', () => {
    expect(contour({ seed: 1, steps: 64, span: 4 })).toHaveLength(64);
    expect(contour({ seed: 1, steps: 0, span: 4 })).toHaveLength(0);
  });

  it('does not start every contour at zero', () => {
    // Sampling from an integer lattice point would make every seed begin at exactly zero,
    // since that is where gradient noise vanishes by construction.
    const firsts = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => contour({ seed, steps: 32, span: 4 })[0]);
    expect(firsts.every((v) => Math.abs(v) > 1e-9)).toBe(true);
  });

  it('gives different seeds different contours, apart from the lattice zeros', () => {
    // Every seed agrees wherever the sample lands on an integer, because that is where
    // gradient noise vanishes. Those points are not evidence of two seeds being alike, so
    // they are excluded rather than counted as coincidences.
    const a = contour({ seed: 1, steps: 64, span: 4 });
    const b = contour({ seed: 2, steps: 64, span: 4 });

    const same = Array.from(a).filter(
      (v, i) => Math.abs(v - b[i]) < 1e-9 && Math.abs(v) > 1e-9,
    ).length;

    expect(same).toBe(0);
  });

  it('returns to centre once per lattice unit, whatever the seed', () => {
    // The property behind the exclusion above, stated directly: `span` controls how often
    // the melody touches the middle of its range, not only how fast it moves.
    for (const seed of [1, 2, 3]) {
      const values = contour({ seed, steps: 64, span: 4 });
      const zeros = Array.from(values).filter((v) => Math.abs(v) < 1e-9).length;
      expect(zeros).toBe(4);
    }
  });

  it('separates the shape from the resolution', () => {
    // Doubling the steps at the same span should trace the same line, more finely — so the
    // endpoints match even though there are twice as many samples between them.
    const coarse = contour({ seed: 7, steps: 32, span: 3 });
    const fine = contour({ seed: 7, steps: 64, span: 3 });
    expect(fine[0]).toBeCloseTo(coarse[0], 6);
    expect(fine[fine.length - 2]).toBeCloseTo(coarse[coarse.length - 1], 1);
  });

  it('makes a wider span move more', () => {
    const travel = (span: number) => {
      const values = contour({ seed: 3, steps: 200, span });
      let sum = 0;
      for (let i = 1; i < values.length; i += 1) sum += Math.abs(values[i] - values[i - 1]);
      return sum;
    };

    expect(travel(20)).toBeGreaterThan(travel(2));
  });

  it('stays in range and finite throughout', () => {
    const values = contour({ seed: 42, steps: 500, span: 12, octaves: 5 });
    for (const value of values) {
      expect(Number.isFinite(value)).toBe(true);
      expect(Math.abs(value)).toBeLessThanOrEqual(1);
    }
  });
});
