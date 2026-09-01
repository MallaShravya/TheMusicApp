import { clampBrightness, MIN_BRIGHTNESS, SYSTEM_BRIGHTNESS } from '../useScreenBrightness';

/**
 * The value that reaches `setBrightnessAsync` goes to the device's display. A bad one here
 * does not throw — it dims the screen and leaves the user wondering what happened.
 */
describe('screen brightness', () => {
  it('keeps a real level as given', () => {
    expect(clampBrightness(0.5)).toBe(0.5);
    expect(clampBrightness(MIN_BRIGHTNESS)).toBe(MIN_BRIGHTNESS);
  });

  it('never returns a level that would black out the screen', () => {
    expect(clampBrightness(0)).toBe(SYSTEM_BRIGHTNESS);
    expect(clampBrightness(0.01)).toBe(SYSTEM_BRIGHTNESS);
    // Below the floor means "leave it alone", not "make it dark".
    expect(clampBrightness(MIN_BRIGHTNESS - 0.01)).toBe(SYSTEM_BRIGHTNESS);
  });

  it('caps at full', () => {
    expect(clampBrightness(1)).toBe(1);
    expect(clampBrightness(4)).toBe(1);
  });

  it('treats nonsense as leave-it-alone rather than as a number', () => {
    // Every non-finite value, including Infinity: a screen level is a measurement, and an
    // infinite one is not a request for maximum, it is a bug upstream.
    expect(clampBrightness(NaN)).toBe(SYSTEM_BRIGHTNESS);
    expect(clampBrightness(Infinity)).toBe(SYSTEM_BRIGHTNESS);
    expect(clampBrightness(-Infinity)).toBe(SYSTEM_BRIGHTNESS);
  });

  it('round-trips the sentinel, so a stored "off" stays off', () => {
    expect(clampBrightness(SYSTEM_BRIGHTNESS)).toBe(SYSTEM_BRIGHTNESS);
  });
});
