import { buildTrackAnalysis, percentile, percentileRange, sampleAnalysis } from '../trackAnalysis';

describe('percentiles', () => {
  it('handles degenerate inputs', () => {
    expect(percentile([], 0.5)).toBe(0);
    expect(percentile([7], 0.9)).toBe(7);
    expect(percentile([1, 2, 3], 0)).toBe(1);
    expect(percentile([1, 2, 3], 1)).toBe(3);
  });

  it('interpolates between neighbours', () => {
    expect(percentile([0, 10], 0.25)).toBeCloseTo(2.5, 9);
  });

  it('ignores outliers when setting the range', () => {
    // One click, or the silence before the first note, must not define the band and squash
    // everything else into a sliver of it.
    const ordinary = Array.from({ length: 100 }, (_, i) => 0.05 + (i % 10) * 0.005);
    const [low, high] = percentileRange([0, ...ordinary, 1.0]);

    expect(low).toBeGreaterThan(0);
    expect(high).toBeLessThan(1.0);
  });
});

describe('per-track normalisation', () => {
  it('lets a quiet track use the whole range', () => {
    // The justification for the entire design. An absolute window would crush this into a
    // sliver near the floor and the fire would barely flicker for the whole song.
    const frames = 200;
    const analysis = buildTrackAnalysis({
      sampleRate: 16000,
      hopMs: 50,
      rms: Array.from({ length: frames }, (_, i) => 0.002 + 0.004 * Math.abs(Math.sin(i / 12))),
      centroidHz: Array.from({ length: frames }, (_, i) => 300 + 250 * Math.abs(Math.sin(i / 9))),
    });

    expect(Math.min(...analysis.amplitude)).toBeLessThan(0.15);
    expect(Math.max(...analysis.amplitude)).toBeGreaterThan(0.85);
    expect(Math.min(...analysis.brightness)).toBeLessThan(0.15);
    expect(Math.max(...analysis.brightness)).toBeGreaterThan(0.85);
  });

  it('snaps outliers to the ends without pinning ordinary frames', () => {
    const ordinary = Array.from({ length: 100 }, (_, i) => 0.02 + (i / 99) * 0.18);
    const built = buildTrackAnalysis({
      sampleRate: 16000,
      hopMs: 50,
      rms: [0, ...ordinary, 1.0],
      centroidHz: [0, ...ordinary.map((_, i) => 300 + i * 30), 18000],
    });

    const last = built.amplitude.length - 1;
    expect(built.amplitude[0]).toBe(0);
    expect(built.amplitude[last]).toBe(1);
    expect(built.brightness[0]).toBe(0);
    expect(built.brightness[last]).toBe(1);

    // Snapping outliers is only useful if it does not also flatten everything between them.
    const inner = built.amplitude.slice(1, last);
    expect(inner.filter((v) => v === 0 || v === 1).length).toBeLessThan(13);
  });

  it('does not stretch a flat drone into a strobe', () => {
    const drone = buildTrackAnalysis({
      sampleRate: 16000,
      hopMs: 50,
      rms: new Array(50).fill(0.1),
      centroidHz: new Array(50).fill(1000),
    });

    expect(Math.max(...drone.amplitude) - Math.min(...drone.amplitude)).toBeLessThan(0.01);
  });

  it('never produces a non-finite value, even from silence', () => {
    const silent = buildTrackAnalysis({
      sampleRate: 16000,
      hopMs: 50,
      rms: new Array(50).fill(0),
      centroidHz: new Array(50).fill(0),
    });

    for (const value of [...silent.amplitude, ...silent.brightness]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it('bounds itself by the shorter of the two series', () => {
    const ragged = buildTrackAnalysis({
      sampleRate: 16000,
      hopMs: 50,
      rms: [0.1, 0.2, 0.3, 0.4, 0.5],
      centroidHz: [500, 600],
    });

    expect(ragged.amplitude).toHaveLength(2);
    expect(ragged.brightness).toHaveLength(2);
  });
});

describe('reading the analysis by time', () => {
  const analysis = { hopMs: 40, amplitude: [0, 1, 0], brightness: [0, 0.5, 1] };

  it('interpolates between frames rather than stepping', () => {
    expect(sampleAnalysis(analysis, 0)).toEqual({ amplitude: 0, brightness: 0 });
    expect(sampleAnalysis(analysis, 0.02).amplitude).toBeCloseTo(0.5, 9);
    expect(sampleAnalysis(analysis, 0.04)).toEqual({ amplitude: 1, brightness: 0.5 });
  });

  it('holds the last frame past the end rather than snuffing out', () => {
    expect(sampleAnalysis(analysis, 99)).toEqual({ amplitude: 0, brightness: 1 });
  });

  it('clamps negative time and survives an empty analysis', () => {
    expect(sampleAnalysis(analysis, -5)).toEqual({ amplitude: 0, brightness: 0 });
    expect(sampleAnalysis({ hopMs: 40, amplitude: [], brightness: [] }, 1)).toEqual({
      amplitude: 0,
      brightness: 0,
    });
  });
});
