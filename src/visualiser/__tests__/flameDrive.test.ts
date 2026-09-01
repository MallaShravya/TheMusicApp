import { follow } from '../envelope';
import { makeTongues, MAX_REACH, tongueEnergy, tongueSpread } from '../flameDrive';

function correlation(a: number[], b: number[]): number {
  const meanA = a.reduce((s, v) => s + v, 0) / a.length;
  const meanB = b.reduce((s, v) => s + v, 0) / b.length;

  let numerator = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i] - meanA;
    const y = b[i] - meanB;
    numerator += x * y;
    varA += x * x;
    varB += y * y;
  }
  return numerator / Math.sqrt(varA * varB || 1);
}

describe('how tongues answer the music', () => {
  const tongues = makeTongues(9);

  it('never lets one exceed the documented ceiling', () => {
    // The whole point of MAX_REACH: `height * MAX_REACH` is what a caller budgets for. An
    // earlier version was unbounded and reached ~3.6, which drew a 2000px flame in a 430px
    // scene. The last two levels here are impossible inputs, included to prove the bound.
    let peak = 0;
    for (const tongue of tongues) {
      for (let time = 0; time < 40; time += 0.05) {
        for (const level of [0, 0.5, 1, 1.5, 3]) {
          const reach = tongueEnergy(tongue, time, level);
          expect(Number.isFinite(reach)).toBe(true);
          expect(reach).toBeGreaterThanOrEqual(0);
          expect(reach).toBeLessThanOrEqual(MAX_REACH + 1e-9);
          peak = Math.max(peak, reach);
        }
      }
    }
    expect(peak).toBeCloseTo(MAX_REACH, 2);
  });

  it('does not move them in lockstep', () => {
    // Driving every tongue with one scalar makes the fire resize as a block rather than churn.
    const series = tongues.map((t) =>
      Array.from({ length: 300 }, (_, i) => tongueEnergy(t, i * 0.05, 0.7)),
    );

    for (let i = 0; i < series.length; i += 1) {
      for (let j = i + 1; j < series.length; j += 1) {
        expect(Math.abs(correlation(series[i], series[j]))).toBeLessThan(0.8);
      }
    }
  });

  it('holds them at visibly different heights at any instant', () => {
    const snapshot = tongues.map((t) => tongueEnergy(t, 12.3, 0.7));
    expect(Math.max(...snapshot) - Math.min(...snapshot)).toBeGreaterThan(0.25);
  });

  it('staggers when each tongue arrives at a step change', () => {
    // A spec doubles as EnvelopeRates, so each tongue lags the music by its own amount.
    const levels = tongues.map(() => 0);
    const arrival = tongues.map(() => -1);

    for (let frame = 0; frame < 400; frame += 1) {
      tongues.forEach((tongue, i) => {
        levels[i] = follow(levels[i], 1, tongue);
        if (arrival[i] < 0 && levels[i] > 0.9) arrival[i] = frame;
      });
    }

    expect(Math.max(...arrival) - Math.min(...arrival)).toBeGreaterThanOrEqual(4);
  });

  it('keeps the fire alive through silence', () => {
    for (const tongue of tongues) {
      for (let time = 0; time < 60; time += 0.13) {
        expect(tongueEnergy(tongue, time, 0)).toBeGreaterThan(0.05);
      }
    }
  });

  it('still grows overall when the music gets louder', () => {
    const quiet = tongues.reduce((sum, t) => sum + tongueEnergy(t, 5, 0.1), 0);
    const loud = tongues.reduce((sum, t) => sum + tongueEnergy(t, 5, 0.9), 0);
    expect(loud).toBeGreaterThan(quiet * 1.6);
  });
});

describe('the layout of a fire', () => {
  it('spaces tongues unevenly', () => {
    const offsets = makeTongues(9)
      .map((t) => t.offset)
      .sort((a, b) => a - b);
    const gaps = offsets.slice(1).map((v, i) => v - offsets[i]);

    // An evenly spaced row reads as a fence, not a fire.
    expect(Math.max(...gaps) / Math.min(...gaps)).toBeGreaterThan(1.4);
  });

  it('rests taller in the middle than at the edges', () => {
    const tongues = makeTongues(9);
    const middle = tongues.filter((t) => Math.abs(t.offset) < 0.35);
    const edges = tongues.filter((t) => Math.abs(t.offset) > 0.65);

    const average = (list: typeof tongues) =>
      list.reduce((sum, t) => sum + t.restHeight, 0) / Math.max(1, list.length);

    expect(average(middle)).toBeGreaterThan(average(edges) * 1.15);
  });

  it('keeps rest heights normalised so `height` is a real budget', () => {
    for (let count = 3; count <= 13; count += 1) {
      for (const tongue of makeTongues(count)) {
        expect(tongue.restHeight).toBeGreaterThan(0);
        expect(tongue.restHeight).toBeLessThanOrEqual(1);
        expect(Math.abs(tongue.offset)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is deterministic for a given count', () => {
    expect(makeTongues(7)).toEqual(makeTongues(7));
  });
});

describe('width response', () => {
  it('broadens with loudness, but far less than height does', () => {
    const quiet = tongueSpread(0.3);
    const loud = tongueSpread(1.4);

    expect(loud).toBeGreaterThan(quiet * 1.15);
    // Scaling both equally makes a flare look like a stretched image rather than a hotter fire.
    expect(loud / quiet).toBeLessThan(1.9);
  });

  it('stays finite and positive for any input', () => {
    for (const reach of [-5, 0, 0.5, 1, 3, NaN]) {
      const spread = tongueSpread(reach);
      expect(Number.isFinite(spread)).toBe(true);
      expect(spread).toBeGreaterThan(0);
    }
  });
});
