import { flameColour } from '../flameColour';

/** How a colour reads, used to assert the ramp visits every band it claims to. */
function hue(c: { r: number; g: number; b: number }): string {
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  if (max - min < 30) return 'grey';
  if (c.b >= max && c.r > 100) return 'violet';
  if (c.b >= max && c.g > c.r) return c.g > 150 ? 'teal' : 'blue';
  if (c.b >= max) return c.r > 40 ? 'indigo' : 'blue';
  if (c.g >= max && c.r > 200) return 'yellow';
  if (c.g >= max) return 'green';
  if (c.g > 110) return 'orange';
  return 'red';
}

describe('the VIBGYOR ramp', () => {
  it('starts at violet and ends at red', () => {
    expect(flameColour(0)).toEqual({ r: 148, g: 0, b: 211 });
    expect(flameColour(1)).toEqual({ r: 230, g: 32, b: 32 });
  });

  it('visits every band of the spectrum', () => {
    const seen = new Set<string>();
    for (let i = 0; i <= 3000; i += 1) seen.add(hue(flameColour(i / 3000)));

    for (const band of ['violet', 'indigo', 'blue', 'green', 'yellow', 'orange', 'red']) {
      expect(seen).toContain(band);
    }
  });

  it('never washes out to grey', () => {
    // The reason stops walk the hue wheel in order: interpolation happens in RGB, so a pair
    // that jumps across the wheel passes through the middle of the colour cube and arrives
    // grey. Blue to green is the widest gap here and it passes through teal.
    for (let i = 0; i <= 3000; i += 1) {
      const c = flameColour(i / 3000);
      const spread = Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
      expect(spread).toBeGreaterThanOrEqual(70);
    }
  });

  it('produces whole channels inside 0-255', () => {
    for (let i = 0; i <= 400; i += 1) {
      const c = flameColour(i / 400);
      for (const channel of [c.r, c.g, c.b]) {
        expect(Number.isInteger(channel)).toBe(true);
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(255);
      }
    }
  });

  it('clamps anything outside 0-1, including NaN', () => {
    expect(flameColour(-9)).toEqual(flameColour(0));
    expect(flameColour(9)).toEqual(flameColour(1));
    expect(flameColour(NaN)).toEqual(flameColour(0));
  });
});
