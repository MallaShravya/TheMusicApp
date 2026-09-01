import { flameOutline, flameWidthProfile, toPathData } from '../flameShape';

const BASE = {
  seed: 1,
  time: 0,
  centreX: 200,
  baseY: 300,
  height: 260,
  width: 80,
  sway: 90,
  flutter: 30,
  tipSharpness: 0.8,
  segments: 18,
};

describe('the flame silhouette', () => {
  it.each([0.5, 0.8, 1.2, 1.8, 2.6])('is a single belly at tip sharpness %p', (tip) => {
    const widths = Array.from({ length: 201 }, (_, i) => flameWidthProfile(i / 200, tip));

    // Narrow foot, closed tip, and exactly one turning point in between.
    expect(widths[0]).toBeCloseTo(0.15, 2);
    expect(widths[200]).toBeCloseTo(0, 6);

    // The profile peaks at exactly 1, but only at the analytic maximum u = a/(a+b). Sampling
    // on a grid lands beside it, so the grid is checked for the bound and the true peak is
    // checked for the value.
    expect(Math.max(...widths)).toBeLessThanOrEqual(1 + 1e-9);
    expect(Math.max(...widths)).toBeGreaterThan(0.999);
    expect(flameWidthProfile(0.55 / (0.55 + tip), tip)).toBeCloseTo(1, 9);

    let turns = 0;
    for (let i = 1; i < 200; i += 1) {
      if ((widths[i] - widths[i - 1]) * (widths[i + 1] - widths[i]) < 0) turns += 1;
    }
    expect(turns).toBeLessThanOrEqual(1);
  });

  it('keeps the foot the same width whatever the tip does', () => {
    // The foot is added outside the normalisation for exactly this reason: normalising by a
    // tip-dependent peak used to inflate it to 0.45 at sharp settings.
    const feet = [0.5, 1.0, 1.8, 2.6].map((tip) => flameWidthProfile(0, tip));
    for (const foot of feet) expect(foot).toBeCloseTo(feet[0], 6);
  });

  it('rejects an out-of-range height fraction', () => {
    expect(flameWidthProfile(-0.1, 0.8)).toBe(0);
    expect(flameWidthProfile(1.1, 0.8)).toBe(0);
    expect(flameWidthProfile(NaN, 0.8)).toBe(0);
  });
});

describe('the flame outline', () => {
  it('never lets its edges meet or cross', () => {
    // Edges used to carry independent flutter noise, so they could wander into each other:
    // a tongue pinched to nothing, or edges crossing and the shape reading as a ribbon. All
    // lateral movement now displaces the centreline, which makes crossing impossible.
    const n = BASE.segments;
    let crossings = 0;
    let pinches = 0;

    for (let seed = 1; seed <= 12; seed += 1) {
      for (let time = 0; time < 25; time += 0.25) {
        const points = flameOutline({ ...BASE, seed, time });
        for (let i = 0; i < n; i += 1) {
          const width = points[2 * n - i].x - points[i].x;
          if (width < 0) crossings += 1;
          if (i / n < 0.85 && width < 0.5) pinches += 1;
        }
      }
    }

    expect(crossings).toBe(0);
    expect(pinches).toBe(0);
  });

  it('anchors the base while the tip travels', () => {
    const tipX = (time: number) => {
      const points = flameOutline({ ...BASE, time });
      return points.reduce((best, p) => (p.y < best.y ? p : best)).x;
    };

    // The base's *centre*, not an edge: the foot breathes symmetrically as the tongue's
    // width varies, so an edge legitimately moves while the flame stays rooted.
    const baseCentre = (time: number) => {
      const points = flameOutline({ ...BASE, time });
      return (points[0].x + points[points.length - 1].x) / 2;
    };

    let baseTravel = 0;
    let tipLow = Infinity;
    let tipHigh = -Infinity;
    const firstCentre = baseCentre(0);

    for (let time = 0; time < 40; time += 0.2) {
      baseTravel = Math.max(baseTravel, Math.abs(baseCentre(time) - firstCentre));
      const x = tipX(time);
      tipLow = Math.min(tipLow, x);
      tipHigh = Math.max(tipHigh, x);
    }

    expect(baseTravel).toBeLessThan(0.01);
    expect(tipHigh - tipLow).toBeGreaterThan(BASE.sway * 0.7);
  });

  it('is deterministic', () => {
    expect(flameOutline(BASE)).toEqual(flameOutline(BASE));
  });

  it.each([
    ['zero height', { height: 0 }],
    ['zero width', { width: 0 }],
    ['zero segments', { segments: 0 }],
    ['negative segments', { segments: -5 }],
  ])('survives %s without producing NaN', (_label, override) => {
    for (const point of flameOutline({ ...BASE, ...override })) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
  });
});

describe('path data', () => {
  it('is a closed curve with one segment per point', () => {
    const points = flameOutline(BASE);
    const d = toPathData(points);

    expect(d.startsWith('M ')).toBe(true);
    expect(d.endsWith(' Z')).toBe(true);
    expect(d).not.toMatch(/NaN|Infinity|undefined/);
    expect(d.match(/C /g)).toHaveLength(points.length);
  });

  it('returns nothing for too few points', () => {
    expect(toPathData([])).toBe('');
    expect(toPathData([{ x: 0, y: 0 }])).toBe('');
  });
});
