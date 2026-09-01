import { brightness, loudness, rms, spectralCentroid } from '../features';

const SAMPLE_RATE = 44100;

const sine = (hz: number, n = 2048, amplitude = 1) =>
  Array.from({ length: n }, (_, i) => amplitude * Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE));

describe('spectral centroid', () => {
  // The load-bearing claim: the FFT measures the frequency that is actually present. If this
  // is wrong, every colour the visualiser picks is wrong, and nothing downstream would show it.
  it.each([
    [440, 25],
    [1000, 30],
    [3000, 50],
  ])('finds a %p Hz sine to within %p Hz', (hz, tolerance) => {
    const measured = spectralCentroid(sine(hz), SAMPLE_RATE);
    expect(Math.abs(measured - hz)).toBeLessThan(tolerance);
  });

  it('lands between the components of a two-tone mix', () => {
    const low = sine(300);
    const high = sine(3000);
    const mixed = low.map((v, i) => (v + high[i]) / 2);

    const centroid = spectralCentroid(mixed, SAMPLE_RATE);
    expect(centroid).toBeGreaterThan(900);
    expect(centroid).toBeLessThan(2400);
  });
});

describe('brightness', () => {
  it('rises with frequency', () => {
    const dark = brightness(sine(150), SAMPLE_RATE);
    const middle = brightness(sine(1000), SAMPLE_RATE);
    const bright = brightness(sine(5000), SAMPLE_RATE);

    expect(dark).toBeLessThan(middle);
    expect(middle).toBeLessThan(bright);
    expect(dark).toBeGreaterThanOrEqual(0);
    expect(bright).toBeLessThanOrEqual(1);
  });

  it('treats silence as no brightness rather than as an error', () => {
    expect(brightness(new Array(1024).fill(0), SAMPLE_RATE)).toBe(0);
  });
});

describe('loudness', () => {
  it('measures a unit sine at one over root two', () => {
    expect(rms(sine(440))).toBeCloseTo(Math.SQRT1_2, 2);
  });

  it('handles silence and empty buffers', () => {
    expect(rms([])).toBe(0);
    expect(rms([0, 0, 0, 0])).toBe(0);
    // log(0) is -Infinity; digital silence is a real input, not an error.
    expect(loudness([0, 0, 0, 0])).toBe(0);
  });

  it('rises with level and stays inside 0 to 1', () => {
    const quiet = loudness(sine(440, 2048, 0.01));
    const loud = loudness(sine(440, 2048, 0.9));

    expect(quiet).toBeLessThan(loud);
    expect(quiet).toBeGreaterThanOrEqual(0);
    expect(loud).toBeLessThanOrEqual(1);
  });
});
