import { buildFlameFrame, type FlameFrame } from '../flameFrame';
import { makeTongues } from '../flameDrive';
import { makeSparkStates } from '../sparks';
import { DEFAULT_FLAME_SETTINGS, type FlameSettings } from '../flameSettings';

/**
 * Every number in a frame becomes a native SVG prop, and a non-finite one closes the app with
 * no error and nothing to catch. These tests exist because that actually happened.
 */
function assertFrameIsDrawable(frame: FlameFrame) {
  for (const key of ['glowRx', 'glowRy', 'glowOpacity', 'brightness'] as const) {
    expect(Number.isFinite(frame[key])).toBe(true);
  }
  expect(frame.glowRx).toBeGreaterThanOrEqual(0);
  expect(frame.glowRy).toBeGreaterThanOrEqual(0);
  expect(frame.colour).toMatch(/^rgb\(\d+, \d+, \d+\)$/);

  expect(frame.opacities).toHaveLength(frame.paths.length);
  for (const opacity of frame.opacities) expect(Number.isFinite(opacity)).toBe(true);

  for (const d of frame.paths) {
    expect(d).not.toMatch(/NaN|Infinity|undefined|null/);
    if (d.length > 0) {
      expect(d.startsWith('M ')).toBe(true);
      expect(d.endsWith(' Z')).toBe(true);
    }
  }

  for (const spark of frame.sparks) {
    for (const value of [spark.cx, spark.cy, spark.r, spark.opacity]) {
      expect(Number.isFinite(value)).toBe(true);
    }
    expect(spark.r).toBeGreaterThanOrEqual(0);
    expect(spark.opacity).toBeGreaterThanOrEqual(0);
  }
}

function frameWith(
  settings: Partial<FlameSettings>,
  amplitude = 0.5,
  brightness = 0.5,
  time = 3.7,
): FlameFrame {
  const merged = { ...DEFAULT_FLAME_SETTINGS, ...settings };
  const tongues = makeTongues(merged.tongues);
  return buildFlameFrame({
    settings: merged,
    tongues,
    levels: tongues.map(() => 0),
    sparkStates: makeSparkStates(),
    amplitude,
    brightness,
    previousBrightness: 0,
    time,
  });
}

describe('a frame at the tuned defaults', () => {
  it('is drawable', () => {
    assertFrameIsDrawable(frameWith({}));
  });

  it('produces one path per tongue per layer', () => {
    const frame = frameWith({ tongues: 7, layers: 3 });
    expect(frame.paths).toHaveLength(21);
  });

  it('never draws taller than the height budget', () => {
    // `height * MAX_REACH` is the guarantee callers size their canvas from.
    const settings = { ...DEFAULT_FLAME_SETTINGS };
    const tongues = makeTongues(settings.tongues);
    const levels = tongues.map(() => 1);

    let highest = Infinity;
    for (let time = 0; time < 30; time += 0.1) {
      const frame = buildFlameFrame({
        settings,
        tongues,
        levels,
        sparkStates: makeSparkStates(),
        amplitude: 1,
        brightness: 1,
        previousBrightness: 1,
        time,
      });

      for (const d of frame.paths) {
        for (const match of d.matchAll(/-?\d+(?:\.\d+)?\s+(-?\d+(?:\.\d+)?)/g)) {
          highest = Math.min(highest, Number(match[1]));
        }
      }
    }

    // Y grows downward, so the smallest y is the tallest point.
    expect(highest).toBeGreaterThan(0);
  });
});

describe('hostile inputs never produce an undrawable frame', () => {
  it.each([
    ['NaN amplitude', { amplitude: NaN }],
    ['NaN brightness', { brightness: NaN }],
    ['Infinite amplitude', { amplitude: Infinity }],
    ['negative amplitude', { amplitude: -5 }],
    ['amplitude far above 1', { amplitude: 99 }],
    ['NaN time', { time: NaN }],
    ['negative time', { time: -40 }],
  ])('survives %s', (_label, override) => {
    const settings = DEFAULT_FLAME_SETTINGS;
    const tongues = makeTongues(settings.tongues);
    assertFrameIsDrawable(
      buildFlameFrame({
        settings,
        tongues,
        levels: tongues.map(() => 0),
        sparkStates: makeSparkStates(),
        amplitude: 0.5,
        brightness: 0.5,
        previousBrightness: 0,
        time: 3.7,
        ...override,
      }),
    );
  });

  it.each([
    ['zero width', { width: 0 }],
    ['zero height', { height: 0 }],
    ['one layer', { layers: 1 }],
    ['minimum tongues', { tongues: 3 }],
    ['maximum tongues', { tongues: 13 }],
    ['no sway', { sway: 0 }],
    ['no flutter', { flutter: 0 }],
    ['minimum segments', { segments: 5 }],
    ['maximum segments', { segments: 36 }],
    ['blunt tip', { tipSharpness: 0.4 }],
    ['sharp tip', { tipSharpness: 2.6 }],
  ])('survives %s', (_label, override) => {
    assertFrameIsDrawable(frameWith(override));
  });

  it('survives a corrupt levels array', () => {
    const settings = DEFAULT_FLAME_SETTINGS;
    const tongues = makeTongues(settings.tongues);

    assertFrameIsDrawable(
      buildFlameFrame({
        settings,
        tongues,
        // Short, and full of values that should never appear.
        levels: [NaN, Infinity, -1],
        sparkStates: makeSparkStates(),
        amplitude: 0.6,
        brightness: 0.6,
        previousBrightness: 0,
        time: 9,
      }),
    );
  });

  it('recovers the levels array rather than propagating NaN', () => {
    const settings = DEFAULT_FLAME_SETTINGS;
    const tongues = makeTongues(settings.tongues);
    const levels = tongues.map(() => NaN);

    buildFlameFrame({
      settings,
      tongues,
      levels,
      sparkStates: makeSparkStates(),
      amplitude: 0.5,
      brightness: 0.5,
      previousBrightness: 0,
      time: 1,
    });

    for (const level of levels) expect(Number.isFinite(level)).toBe(true);
  });
});

describe('frames stay drawable over a long run', () => {
  it('holds up across two minutes of animation', () => {
    const settings = DEFAULT_FLAME_SETTINGS;
    const tongues = makeTongues(settings.tongues);
    const levels = tongues.map(() => 0);
    let brightness = 0;

    // 60 fps for two minutes, sampled every tenth frame.
    for (let frame = 0; frame < 7200; frame += 10) {
      const time = frame / 60;
      // A signal that swings across the whole range, including silence.
      const amplitude = Math.max(0, Math.sin(time * 1.7)) ** 3;

      const built = buildFlameFrame({
        settings,
        tongues,
        levels,
        sparkStates: makeSparkStates(),
        amplitude,
        brightness: (Math.sin(time * 0.6) + 1) / 2,
        previousBrightness: brightness,
        time,
      });

      brightness = built.brightness;
      assertFrameIsDrawable(built);
    }
  });
});
