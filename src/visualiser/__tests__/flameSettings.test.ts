import {
  clampSetting,
  DEFAULT_FLAME_SETTINGS,
  FLAME_SETTING_RANGES,
  normaliseSettings,
  SCENE,
} from '../flameSettings';

describe('the settings contract', () => {
  it('describes a range for every setting, and no more', () => {
    expect(FLAME_SETTING_RANGES.map((r) => r.key).sort()).toEqual(
      Object.keys(DEFAULT_FLAME_SETTINGS).sort(),
    );
  });

  it('keeps every default reachable by its own slider', () => {
    for (const range of FLAME_SETTING_RANGES) {
      const value = DEFAULT_FLAME_SETTINGS[range.key];
      expect(value).toBeGreaterThanOrEqual(range.min);
      expect(value).toBeLessThanOrEqual(range.max);
      // On-grid too, or the slider could never return to the shipped value.
      expect(clampSetting(range.key, value)).toBe(value);
    }
  });

  it('cannot let the fire climb out of the scene', () => {
    expect(clampSetting('height', 9999)).toBeLessThanOrEqual(SCENE.baseY - 12);
  });
});

describe('clamping', () => {
  it('bounds, and falls back rather than propagating NaN', () => {
    expect(clampSetting('tongues', 99)).toBe(13);
    expect(clampSetting('tongues', -5)).toBe(3);
    expect(clampSetting('tongues', NaN)).toBe(DEFAULT_FLAME_SETTINGS.tongues);
  });

  it('cleans up floating-point step error', () => {
    // 0.05 steps otherwise land on values like 1.7500000000000002.
    expect(clampSetting('tipSharpness', 1.7300000000000002)).toBe(1.75);
    expect(clampSetting('tipSharpness', 1.8)).toBe(1.8);
  });
});

describe('settings written by an older build', () => {
  it('fills gaps with defaults rather than zeros', () => {
    const merged = normaliseSettings({ tongues: 5 });
    expect(merged.tongues).toBe(5);
    expect(merged.segments).toBe(DEFAULT_FLAME_SETTINGS.segments);
  });

  it('survives null, junk and out-of-range values', () => {
    expect(normaliseSettings(null)).toEqual(DEFAULT_FLAME_SETTINGS);

    const junk = normaliseSettings({ tongues: 'lots', height: -50, nope: 1 } as never);
    expect(junk.tongues).toBe(DEFAULT_FLAME_SETTINGS.tongues);
    expect(junk.height).toBe(90);
  });
});
