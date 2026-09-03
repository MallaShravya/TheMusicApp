import { glideCurve, largestStepCents } from '../glide';

const nodes = (hz: number[], beats = 1) => hz.map((h) => ({ hz: h, beats }));

/** Where in the curve a node's centre falls, as a sample index. */
function centreIndex(count: number, totalBeats: number, centreBeat: number): number {
  return Math.round((centreBeat / totalBeats) * count);
}

describe('the glide', () => {
  it('passes exactly through every note', () => {
    const hz = [200, 300, 250, 400];
    const curve = glideCurve({ nodes: nodes(hz), samplesPerBeat: 100, glide: 1 });

    hz.forEach((value, i) => {
      const index = centreIndex(curve.length, hz.length, i + 0.5);
      expect(curve[index]).toBeCloseTo(value, 0);
    });
  });

  /**
   * The property the whole thing is named for: each note is a crest or a trough, not a point
   * the line happens to cross on its way past.
   */
  it('makes a higher note a crest and a lower note a trough', () => {
    const curve = glideCurve({ nodes: nodes([200, 400, 200]), samplesPerBeat: 200, glide: 1 });
    const peak = centreIndex(curve.length, 3, 1.5);

    expect(curve[peak]).toBeGreaterThan(curve[peak - 30]);
    expect(curve[peak]).toBeGreaterThan(curve[peak + 30]);

    const dip = glideCurve({ nodes: nodes([400, 200, 400]), samplesPerBeat: 200, glide: 1 });
    expect(dip[peak]).toBeLessThan(dip[peak - 30]);
    expect(dip[peak]).toBeLessThan(dip[peak + 30]);
  });

  it('never overshoots a note it is heading for', () => {
    // A spline would ring past the target and sound a pitch nobody asked for.
    const hz = [200, 400, 210, 380];
    const curve = glideCurve({ nodes: nodes(hz), samplesPerBeat: 150, glide: 1 });
    for (const value of curve) {
      expect(value).toBeGreaterThanOrEqual(Math.min(...hz) - 0.001);
      expect(value).toBeLessThanOrEqual(Math.max(...hz) + 0.001);
    }
  });

  it('moves monotonically between two notes', () => {
    const curve = glideCurve({ nodes: nodes([200, 400]), samplesPerBeat: 300, glide: 1 });
    for (let i = 1; i < curve.length; i += 1) {
      expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1] - 1e-9);
    }
  });

  it('interpolates by ear, not by hertz', () => {
    // Halfway between an octave is the geometric mean, 283Hz, not the arithmetic 300.
    const curve = glideCurve({ nodes: nodes([200, 400]), samplesPerBeat: 400, glide: 1 });
    const middle = curve[Math.round(curve.length / 2)];
    expect(middle).toBeCloseTo(Math.sqrt(200 * 400), 0);
    expect(Math.abs(middle - 300)).toBeGreaterThan(10);
  });

  it('holds flat before the first note and after the last', () => {
    const curve = glideCurve({ nodes: nodes([300, 500]), samplesPerBeat: 100, glide: 1 });
    expect(curve[0]).toBeCloseTo(300, 5);
    expect(curve[curve.length - 1]).toBeCloseTo(500, 5);
  });
});

describe('how much of the gap is spent moving', () => {
  it('is an ordinary stepped melody at zero', () => {
    const curve = glideCurve({ nodes: nodes([200, 400]), samplesPerBeat: 100, glide: 0 });
    const distinct = new Set(Array.from(curve).map((v) => v.toFixed(4)));
    expect(distinct.size).toBe(2);
  });

  it('dwells on the note at a low setting and travels at a high one', () => {
    const dwelling = (glide: number) => {
      const curve = glideCurve({ nodes: nodes([200, 400]), samplesPerBeat: 200, glide });
      // Samples sitting within a cent of one of the two pitches.
      return Array.from(curve).filter(
        (v) => Math.abs(1200 * Math.log2(v / 200)) < 1 || Math.abs(1200 * Math.log2(v / 400)) < 1,
      ).length;
    };

    expect(dwelling(0.2)).toBeGreaterThan(dwelling(0.9));
  });

  it('is continuous: finer sampling gives smaller steps, at every setting', () => {
    // Not an absolute cent limit. A low glide squeezes the same distance into less time, so
    // it is legitimately steeper -- at 0.2 the line moves five times as fast as at 1.0, and a
    // fixed threshold would only be measuring that. What makes a curve continuous rather than
    // a staircase is that its steps vanish as resolution rises, which is what this measures.
    for (const glide of [0.2, 0.5, 1]) {
      const coarse = largestStepCents(
        glideCurve({ nodes: nodes([200, 400, 220]), samplesPerBeat: 100, glide }),
      );
      const fine = largestStepCents(
        glideCurve({ nodes: nodes([200, 400, 220]), samplesPerBeat: 400, glide }),
      );

      expect(fine).toBeLessThan(coarse * 0.35);
      expect(fine).toBeGreaterThan(0);
    }
  });

  it('is smooth in time at the resolution the player actually uses', () => {
    // The number that matters, and it was found here rather than by ear: at 33 samples a
    // beat a glide of 0.2 steps by 264 cents, because squeezing an octave into a fifth of
    // the gap makes the line very steep indeed. 125 a beat -- 250 a second at a walking
    // tempo -- keeps even the steepest setting under a semitone between control points.
    for (const glide of [0.2, 0.5, 1]) {
      const curve = glideCurve({ nodes: nodes([200, 400, 220]), samplesPerBeat: 125, glide });
      expect(largestStepCents(curve)).toBeLessThan(100);
    }
  });

  it('treats nonsense as a full glide rather than failing', () => {
    const curve = glideCurve({ nodes: nodes([200, 400]), samplesPerBeat: 100, glide: NaN });
    expect(curve.length).toBeGreaterThan(0);
    expect(largestStepCents(curve)).toBeLessThan(30);
  });
});

describe('durations', () => {
  it('gives a longer note a longer dwell around its pitch', () => {
    const short = glideCurve({
      nodes: [{ hz: 200, beats: 1 }, { hz: 400, beats: 1 }, { hz: 200, beats: 1 }],
      samplesPerBeat: 200,
      glide: 0.6,
    });
    const long = glideCurve({
      nodes: [{ hz: 200, beats: 1 }, { hz: 400, beats: 4 }, { hz: 200, beats: 1 }],
      samplesPerBeat: 200,
      glide: 0.6,
    });

    const near400 = (curve: Float32Array) =>
      Array.from(curve).filter((v) => Math.abs(1200 * Math.log2(v / 400)) < 5).length;

    expect(near400(long)).toBeGreaterThan(near400(short) * 2);
  });

  it('sizes the curve from the total beats', () => {
    const curve = glideCurve({
      nodes: [{ hz: 200, beats: 2 }, { hz: 300, beats: 3 }],
      samplesPerBeat: 50,
      glide: 1,
    });
    expect(curve.length).toBe(250);
  });
});

describe('bad input', () => {
  it('returns nothing rather than a broken curve', () => {
    expect(glideCurve({ nodes: [], samplesPerBeat: 100, glide: 1 })).toHaveLength(0);
    expect(glideCurve({ nodes: nodes([200]), samplesPerBeat: 0, glide: 1 })).toHaveLength(0);
  });

  it('drops notes that could never be sounded', () => {
    const curve = glideCurve({
      nodes: [{ hz: 200, beats: 1 }, { hz: NaN, beats: 1 }, { hz: 0, beats: 1 }, { hz: 400, beats: 1 }],
      samplesPerBeat: 100,
      glide: 1,
    });
    for (const value of curve) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });

  it('emits only positive, finite frequencies', () => {
    const curve = glideCurve({ nodes: nodes([120, 900, 240, 480]), samplesPerBeat: 120, glide: 0.7 });
    for (const value of curve) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });
});

describe('where the line is allowed to be flat', () => {
  /** Slope in cents per sample, measured across a node. */
  const slopeAt = (curve: Float32Array, index: number) =>
    Math.abs(1200 * Math.log2(curve[index + 1] / curve[index - 1]));

  const centreIndexOf = (count: number, totalBeats: number, node: number) =>
    Math.round(((node + 0.5) / totalBeats) * count);

  /**
   * The rule: a note is only a flat spot when the line actually turns there.
   *
   * Smoothstep gave every node a zero tangent, so a rising run came out as a staircase of
   * little plateaux — the melody stopped on every note whether or not it had any reason to.
   */
  it('runs through a note in the middle of a climb', () => {
    const hz = [200, 240, 288, 346, 415];
    const curve = glideCurve({ nodes: nodes(hz), samplesPerBeat: 400, glide: 1 });

    for (let node = 1; node < hz.length - 1; node += 1) {
      const at = centreIndexOf(curve.length, hz.length, node);
      expect(slopeAt(curve, at)).toBeGreaterThan(0.5);
    }
  });

  it('runs through a note in the middle of a descent', () => {
    const hz = [415, 346, 288, 240, 200];
    const curve = glideCurve({ nodes: nodes(hz), samplesPerBeat: 400, glide: 1 });

    for (let node = 1; node < hz.length - 1; node += 1) {
      const at = centreIndexOf(curve.length, hz.length, node);
      expect(slopeAt(curve, at)).toBeGreaterThan(0.5);
    }
  });

  it('is flat only where the direction reverses', () => {
    // Up, up, turn, down, down, turn, up. Only the two turns may be flat.
    const hz = [200, 240, 288, 240, 200, 240];
    const turns = [false, false, true, false, true, false];
    const curve = glideCurve({ nodes: nodes(hz), samplesPerBeat: 400, glide: 1 });

    for (let node = 1; node < hz.length - 1; node += 1) {
      const at = centreIndexOf(curve.length, hz.length, node);
      const slope = slopeAt(curve, at);
      if (turns[node]) expect(slope).toBeLessThan(0.2);
      else expect(slope).toBeGreaterThan(0.5);
    }
  });

  it('rises without a single plateau across a whole climb', () => {
    // Not one sample of the interior may stand still.
    const curve = glideCurve({
      nodes: nodes([200, 240, 288, 346]),
      samplesPerBeat: 200,
      glide: 1,
    });

    let still = 0;
    const first = Math.round(curve.length * 0.14);
    const last = Math.round(curve.length * 0.86);
    for (let i = first; i < last; i += 1) {
      if (Math.abs(1200 * Math.log2(curve[i] / curve[i - 1])) < 0.02) still += 1;
    }
    expect(still).toBe(0);
  });

  it('still puts a genuine peak on a note the line turns at', () => {
    const curve = glideCurve({ nodes: nodes([200, 400, 200]), samplesPerBeat: 300, glide: 1 });
    const peak = centreIndexOf(curve.length, 3, 1);
    expect(curve[peak]).toBeGreaterThan(curve[peak - 40]);
    expect(curve[peak]).toBeGreaterThan(curve[peak + 40]);
    expect(curve[peak]).toBeCloseTo(400, 0);
  });

  it('holds deliberately when the glide is below one, which is a different thing', () => {
    // The flats below a full glide are asked for: that is the meend shape.
    const curve = glideCurve({ nodes: nodes([200, 240, 288]), samplesPerBeat: 300, glide: 0.4 });
    let still = 0;
    for (let i = 1; i < curve.length; i += 1) {
      if (Math.abs(1200 * Math.log2(curve[i] / curve[i - 1])) < 0.02) still += 1;
    }
    expect(still).toBeGreaterThan(curve.length * 0.3);
  });
});
