import {
  isShooting,
  makeStars,
  shootingStar,
  SHOOTING_DURATION,
  SHOOTING_PERIOD,
  SKY_DEPTH,
  STREAK_SEGMENTS,
  TWINKLE_GROUPS,
} from '../starField';

const W = 390;
const H = 420;

describe('the star field', () => {
  const stars = makeStars(60, W, H);

  it('puts every star inside the sky', () => {
    for (const star of stars) {
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThanOrEqual(W);
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThanOrEqual(H);
      expect(star.r).toBeGreaterThan(0);
    }
  });

  it('is the same sky every time, so stars do not wander between renders', () => {
    expect(makeStars(60, W, H)).toEqual(stars);
  });

  it('keeps to the top of the sky, never straying over the fire', () => {
    for (const star of stars) {
      expect(star.y).toBeLessThanOrEqual(H * (0.015 + SKY_DEPTH));
    }
  });

  it('puts most of the field inside the top third', () => {
    // A large sample: sixty stars is too few to measure a distribution without the answer
    // wobbling by ten points from noise alone.
    const many = makeStars(600, W, H);
    const upperThird = many.filter((s) => s.y < H / 3).length;
    expect(upperThird / many.length).toBeGreaterThan(0.85);
  });

  it('fades with depth, so the field ends in a fade rather than a line', () => {
    const high = stars.filter((s) => s.y < H * 0.12);
    const low = stars.filter((s) => s.y > H * 0.28);
    const mean = (list: typeof stars) =>
      list.reduce((sum, s) => sum + s.opacity, 0) / (list.length || 1);
    expect(low.length).toBeGreaterThan(0);
    expect(mean(low)).toBeLessThan(mean(high));
  });

  it('gives every star a fixed, drawable opacity', () => {
    for (const star of stars) {
      expect(star.opacity).toBeGreaterThan(0);
      expect(star.opacity).toBeLessThanOrEqual(1);
    }
  });

  it('carries no time dimension: the blink belongs to the group, not the star', () => {
    // A star holds no phase and no rate. If either ever appears here, the field has gone
    // back to being computed per frame, which is what the grouping exists to avoid.
    expect(Object.keys(stars[0]).sort()).toEqual(['group', 'opacity', 'r', 'x', 'y']);
  });

  it('assigns every star to a real group', () => {
    for (const star of stars) {
      expect(Number.isInteger(star.group)).toBe(true);
      expect(star.group).toBeGreaterThanOrEqual(0);
      expect(star.group).toBeLessThan(TWINKLE_GROUPS.length);
    }
  });

  it('spreads the field across every group, so none of them is dead weight', () => {
    const used = new Set(makeStars(200, W, H).map((s) => s.group));
    expect(used.size).toBe(TWINKLE_GROUPS.length);
  });

  it('does not hand neighbouring stars the same blink', () => {
    // Assigning by index would make consecutive stars share a group; the seed must decide.
    const byIndex = stars.every((star, i) => star.group === i % TWINKLE_GROUPS.length);
    expect(byIndex).toBe(false);
  });
});

describe('the twinkle table', () => {
  it('dims each group by a different amount', () => {
    const lows = TWINKLE_GROUPS.map((g) => g.low);
    expect(new Set(lows).size).toBe(lows.length);
  });

  it('never dims a group to nothing, or fails to dim it at all', () => {
    for (const group of TWINKLE_GROUPS) {
      expect(group.low).toBeGreaterThan(0.2);
      expect(group.low).toBeLessThan(0.95);
    }
  });

  it('keeps the periods out of step so the sky never pulses together', () => {
    const periods = TWINKLE_GROUPS.map((g) => g.period);
    expect(new Set(periods).size).toBe(periods.length);

    // No pair may sit on an exact whole-number ratio — that is the case where two groups
    // lock and stay locked. Merely close periods are fine and in fact desirable: 3.1s
    // against 2.9s takes about forty-five seconds to drift a full cycle apart, which is
    // what keeps the field looking unplanned.
    for (let i = 0; i < periods.length; i += 1) {
      for (let j = i + 1; j < periods.length; j += 1) {
        const ratio = Math.max(periods[i], periods[j]) / Math.min(periods[i], periods[j]);
        expect(Math.abs(ratio - Math.round(ratio))).toBeGreaterThan(0.02);
      }
    }
  });

  it('starts each group at a different point in its own cycle', () => {
    const offsets = TWINKLE_GROUPS.map((g) => (g.phase / g.period) % 1);
    expect(new Set(offsets.map((o) => o.toFixed(3))).size).toBe(offsets.length);
  });

  it('survives a zero-sized sky, which is what the first layout pass reports', () => {
    expect(makeStars(60, 0, 0)).toEqual([]);
    expect(makeStars(60, W, 0)).toEqual([]);
    expect(makeStars(0, W, H)).toEqual([]);
  });

  it('gives a bigger sky more stars rather than sparser ones', () => {
    expect(makeStars(60, W, H)).toHaveLength(60);
    expect(makeStars(20, W, H)).toHaveLength(20);
  });
});

describe('the shooting star', () => {
  it('is absent almost all of the time', () => {
    let visible = 0;
    const samples = 2000;
    for (let i = 0; i < samples; i += 1) {
      if (shootingStar((i / samples) * SHOOTING_PERIOD * 4, W, H).length > 0) visible += 1;
    }
    const fraction = visible / samples;
    expect(fraction).toBeGreaterThan(0);
    expect(fraction).toBeLessThan(SHOOTING_DURATION / SHOOTING_PERIOD + 0.02);
  });

  it('appears once per period', () => {
    expect(shootingStar(0.2, W, H).length).toBe(STREAK_SEGMENTS);
    expect(shootingStar(SHOOTING_DURATION + 0.5, W, H)).toEqual([]);
    expect(shootingStar(SHOOTING_PERIOD + 0.2, W, H).length).toBe(STREAK_SEGMENTS);
  });

  it('fades in and out instead of snapping on', () => {
    const head = (t: number) => shootingStar(t, W, H)[0].opacity;
    expect(head(0.02)).toBeLessThan(head(SHOOTING_DURATION / 2));
    expect(head(SHOOTING_DURATION - 0.02)).toBeLessThan(head(SHOOTING_DURATION / 2));
  });

  it('is brightest at the head and fades along the tail', () => {
    const streaks = shootingStar(SHOOTING_DURATION / 2, W, H);
    for (let i = 1; i < streaks.length; i += 1) {
      expect(streaks[i].opacity).toBeLessThanOrEqual(streaks[i - 1].opacity);
      expect(streaks[i].width).toBeLessThanOrEqual(streaks[i - 1].width);
    }
  });

  it('draws different crossings on different cycles', () => {
    const first = shootingStar(SHOOTING_DURATION / 2, W, H)[0];
    const second = shootingStar(SHOOTING_PERIOD * 3 + SHOOTING_DURATION / 2, W, H)[0];
    expect(first).not.toEqual(second);
  });

  it('stays in the upper sky, where the stars are', () => {
    for (let t = 0; t < SHOOTING_PERIOD * 8; t += 0.05) {
      for (const s of shootingStar(t, W, H)) {
        expect(Math.max(s.y1, s.y2)).toBeLessThan(H * 0.5);
      }
    }
  });

  it('lets the renderer sleep: isShooting agrees with what is drawn', () => {
    for (let t = 0; t < SHOOTING_PERIOD * 4; t += 0.037) {
      expect(isShooting(t)).toBe(shootingStar(t, W, H).length > 0);
    }
    expect(isShooting(NaN)).toBe(false);
  });

  it('emits only finite, positive-width segments', () => {
    for (let t = 0; t < SHOOTING_PERIOD * 3; t += 0.017) {
      for (const s of shootingStar(t, W, H)) {
        for (const value of [s.x1, s.y1, s.x2, s.y2, s.opacity, s.width]) {
          expect(Number.isFinite(value)).toBe(true);
        }
        // A zero stroke width would be invisible; a negative one is a native type violation.
        expect(s.width).toBeGreaterThan(0);
        expect(s.opacity).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('returns nothing rather than NaN geometry for a degenerate sky', () => {
    expect(shootingStar(0.2, 0, 0)).toEqual([]);
    expect(shootingStar(NaN, W, H)).toEqual([]);
  });
});
