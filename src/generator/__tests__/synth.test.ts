import { schedulePhrase } from '../schedule';
import { frequencyOf, JUST_RATIOS, limit, peak, render } from '../synth';
import { parseSargam } from '../swara';

const RATE = 22050;

const renderText = (text: string, overlap = 0, sa = 240) =>
  render(
    schedulePhrase(parseSargam(text).events, { beatSeconds: 0.5, overlap, articulation: 0.03 }),
    sa,
    { sampleRate: RATE },
  );

/** Frequency recovered from a stretch of samples, by counting rising zero crossings. */
function frequencyIn(samples: Float32Array, from: number, to: number): number {
  const crossings: number[] = [];
  for (let i = from + 1; i < to; i += 1) {
    if (samples[i - 1] < 0 && samples[i] >= 0) crossings.push(i);
  }
  if (crossings.length < 3) return 0;
  const span = (crossings[crossings.length - 1] - crossings[0]) / RATE;
  return (crossings.length - 1) / span;
}

describe('pitch', () => {
  it('puts Sa on the tonic', () => {
    expect(frequencyOf(0, 240)).toBe(240);
  });

  it('uses just intonation, not equal temperament', () => {
    // Pa is a true 3:2 here. Equal temperament would give 359.6.
    expect(frequencyOf(7, 240)).toBeCloseTo(360, 6);
    expect(frequencyOf(5, 240)).toBeCloseTo(320, 6);
  });

  it('doubles an octave up and halves an octave down', () => {
    expect(frequencyOf(12, 240)).toBeCloseTo(480, 6);
    expect(frequencyOf(-12, 240)).toBeCloseTo(120, 6);
    expect(frequencyOf(19, 240)).toBeCloseTo(720, 6);
  });

  it('has one ratio per semitone, rising, inside an octave', () => {
    expect(JUST_RATIOS).toHaveLength(12);
    for (let i = 1; i < JUST_RATIOS.length; i += 1) {
      expect(JUST_RATIOS[i]).toBeGreaterThan(JUST_RATIOS[i - 1]);
    }
    expect(JUST_RATIOS[11]).toBeLessThan(2);
  });

  it('refuses nonsense rather than producing it', () => {
    expect(frequencyOf(NaN, 240)).toBe(0);
    expect(frequencyOf(0, 0)).toBe(0);
    expect(frequencyOf(0, -100)).toBe(0);
  });
});

describe('rendering', () => {
  it('produces samples for as long as the phrase lasts', () => {
    const samples = renderText('S R G M');
    // Four half-second beats, less the articulation gap on the last note.
    expect(samples.length / RATE).toBeGreaterThan(1.9);
    expect(samples.length / RATE).toBeLessThan(2.01);
  });

  it('sounds the pitch it was given', () => {
    const samples = renderText('S');
    // Measured away from the attack and release, where the envelope distorts the shape.
    const recovered = frequencyIn(samples, Math.floor(0.05 * RATE), Math.floor(0.4 * RATE));
    expect(Math.abs(recovered - 240)).toBeLessThan(3);
  });

  it('sounds a different pitch for a different swara', () => {
    const samples = renderText('P');
    const recovered = frequencyIn(samples, Math.floor(0.05 * RATE), Math.floor(0.4 * RATE));
    expect(Math.abs(recovered - 360)).toBeLessThan(4);
  });

  it('leaves a rest silent', () => {
    const samples = renderText('S _ R');
    const middle = Math.floor(0.75 * RATE);
    expect(Math.abs(samples[middle])).toBeLessThan(1e-6);
  });

  it('starts and ends at silence, so a note cannot click', () => {
    const samples = renderText('S R G');
    expect(Math.abs(samples[0])).toBeLessThan(1e-9);
    expect(Math.abs(samples[samples.length - 1])).toBeLessThan(0.02);
  });

  it('never jumps between neighbouring samples', () => {
    // A discontinuity is a click. At this rate a sine at 480Hz moves about 0.14 per sample,
    // so anything past a quarter is an envelope fault rather than the waveform.
    const samples = renderText("S R G M P D N S'", 0.25);
    for (let i = 1; i < samples.length; i += 1) {
      expect(Math.abs(samples[i] - samples[i - 1])).toBeLessThan(0.25);
    }
  });

  it('renders nothing for nothing', () => {
    expect(render([], 240, { sampleRate: RATE })).toHaveLength(0);
    expect(renderText('')).toHaveLength(0);
  });

  it('refuses an impossible sample rate', () => {
    expect(render(
      schedulePhrase(parseSargam('S').events, { beatSeconds: 0.5 }),
      240,
      { sampleRate: 0 },
    )).toHaveLength(0);
  });
});

describe('overlapping notes', () => {
  it('sums where two notes sound together', () => {
    const separate = peak(renderText('S R G M', 0));
    const squashed = peak(renderText('S R G M', 0.4));
    expect(squashed).toBeGreaterThan(separate);
  });

  it('keeps a single note inside its gain', () => {
    expect(peak(renderText('S'))).toBeLessThanOrEqual(0.28 * 1.24);
  });

  it('runs the phrase past its last beat when squashed', () => {
    const plain = renderText('S R', 0).length;
    const squashed = renderText('S R', 0.5).length;
    expect(squashed).toBeGreaterThan(plain);
  });
});

describe('headroom', () => {
  it('reports the loudest sample', () => {
    // Six places, not ten: a Float32Array holds about seven significant digits, so 0.7 comes
    // back as 0.699999988 and an exact comparison is testing the storage, not the code.
    expect(peak(Float32Array.from([0, 0.4, -0.7, 0.2]))).toBeCloseTo(0.7, 6);
    expect(peak(new Float32Array(0))).toBe(0);
  });

  it('scales a hot buffer down below the ceiling', () => {
    const hot = Float32Array.from([0, 1.6, -1.2]);
    const tamed = limit(hot, 0.95);
    expect(peak(tamed)).toBeCloseTo(0.95, 6);
    // The shape is unchanged: everything moved by the same factor.
    expect(tamed[2] / tamed[1]).toBeCloseTo(hot[2] / hot[1], 5);
  });

  it('leaves a quiet buffer alone rather than normalising it', () => {
    // Raising a sparse piece to full scale would erase the difference between it and a dense
    // one, which is exactly the difference worth hearing.
    const quiet = Float32Array.from([0, 0.2, -0.1]);
    expect(limit(quiet, 0.95)).toBe(quiet);
  });

  it('does nothing to silence', () => {
    const silence = new Float32Array(8);
    expect(limit(silence)).toBe(silence);
  });

  it('keeps a squashed phrase inside the ceiling', () => {
    const dense = limit(renderText("S R G M P D N S' .N .D .P .M", 0.6));
    expect(peak(dense)).toBeLessThanOrEqual(0.95 + 1e-6);
  });
});
