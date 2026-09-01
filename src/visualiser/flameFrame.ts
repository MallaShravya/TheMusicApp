import { COLOUR_RATES, follow } from './envelope';
import { flameColour } from './flameColour';
import { MAX_REACH, tongueEnergy, tongueSpread, type TongueSpec } from './flameDrive';
import { flameOutline, toPathData } from './flameShape';
import { SCENE, type FlameSettings } from './flameSettings';
import { buildSparks, type Spark, type SparkState } from './sparks';

/** The outermost glow layer is drawn this much larger than the core. */
export const HALO_SCALE = 1.24;

/**
 * The glow's gradient stops: offset, and its share of `glowOpacity`.
 *
 * Shared rather than written into the renderer, so the component and the preview cannot
 * drift apart.
 */
export const GLOW_STOPS = [
  { offset: '0%', weight: 0.44 },
  { offset: '30%', weight: 0.26 },
  { offset: '62%', weight: 0.09 },
  { offset: '100%', weight: 0 },
] as const;

/**
 * Everything needed to draw one frame. Every number here reaches a native SVG prop.
 */
export type FlameFrame = {
  /** One path per tongue per layer, outermost first. */
  paths: string[];
  /** Opacity per layer, indexed the same way as `paths`. */
  opacities: number[];
  colour: string;
  glowRx: number;
  glowRy: number;
  glowOpacity: number;
  sparks: Spark[];
  /** The smoothed brightness this frame settled on, to be fed back in on the next one. */
  brightness: number;
};

export const EMPTY_FRAME: FlameFrame = {
  paths: [],
  opacities: [],
  colour: 'rgb(148, 0, 211)',
  glowRx: 0,
  glowRy: 0,
  glowOpacity: 0,
  sparks: [],
  brightness: 0,
};

/**
 * Keeps a non-finite value out of a native prop.
 *
 * Not defensive programming for its own sake: a `NaN` dimension reaching react-native-svg
 * closes the app outright, with no JavaScript error and nothing an error boundary can catch.
 * Every number leaving this module passes through here.
 */
export function safe(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Builds one frame of the fire.
 *
 * Extracted from the renderer's animation loop so it can actually be tested. Inside a
 * `requestAnimationFrame` callback this maths was unreachable by any test, which is a poor
 * place for the most crash-prone code in the project — it is the only code whose output goes
 * straight into native view props sixty times a second.
 *
 * `levels` and `sparkStates` are both mutated in place: they are the only things that have to
 * persist between frames for the envelopes and the spark flights to mean anything.
 */
export function buildFlameFrame(input: {
  settings: FlameSettings;
  tongues: TongueSpec[];
  levels: number[];
  /** Each spark's flight, carried between frames. Built once by `makeSparkStates`. */
  sparkStates: SparkState[];
  /** Target loudness for this instant, 0–1. */
  amplitude: number;
  /** Target brightness for this instant, 0–1. */
  brightness: number;
  /** The brightness the previous frame settled on. */
  previousBrightness: number;
  /** Seconds, driving the noise. */
  time: number;
}): FlameFrame {
  const { settings, tongues, levels, sparkStates, time } = input;

  const amplitude = safe(input.amplitude);
  const brightness = follow(
    safe(input.previousBrightness),
    safe(input.brightness),
    COLOUR_RATES,
  );

  const colour = flameColour(brightness);
  const colourString = `rgb(${colour.r}, ${colour.g}, ${colour.b})`;

  // `height` is a peak budget: dividing by the ceiling and the halo scale means the tallest
  // tongue at full loudness lands on it and never above.
  const heightUnit = safe(settings.height / (MAX_REACH * HALO_SCALE));

  const paths: string[] = [];
  const opacities: number[] = [];

  for (let i = 0; i < tongues.length; i += 1) {
    const tongue = tongues[i];

    // Each tongue follows the raw loudness on its own clock, so a beat reaches them at
    // different moments instead of lifting the whole fire at once.
    levels[i] = safe(follow(safe(levels[i] ?? 0), amplitude, tongue));

    const reach = safe(tongueEnergy(tongue, time, levels[i]));
    const spread = tongueSpread(reach);

    for (let layer = 0; layer < settings.layers; layer += 1) {
      const depth = settings.layers === 1 ? 1 : layer / (settings.layers - 1);
      const scale = HALO_SCALE - (HALO_SCALE - 1) * depth;

      paths.push(
        toPathData(
          flameOutline({
            seed: tongue.seed + layer * 0.31,
            time,
            centreX: SCENE.width / 2 + tongue.offset * settings.width * 1.45,
            baseY: SCENE.baseY,
            height: safe(heightUnit * tongue.restHeight * reach * scale),
            width: safe(settings.width * tongue.restWidth * spread * scale),
            sway: safe(settings.sway * (0.45 + 0.75 * Math.min(1.4, reach))),
            flutter: safe(settings.flutter),
            tipSharpness: settings.tipSharpness,
            segments: settings.segments,
          }),
        ),
      );
      opacities.push(safe(0.16 + 0.42 * depth));
    }
  }

  const energy = 0.18 + 0.82 * amplitude;
  const glowBreath = 0.72 + 0.5 * energy;

  const sparks = buildSparks({
    states: sparkStates,
    time,
    energy,
    centreX: SCENE.width / 2,
    baseY: SCENE.baseY,
    width: settings.width,
    height: settings.height,
  });

  return {
    paths,
    opacities,
    colour: colourString,
    glowRx: Math.max(0, safe((130 + settings.width * 2.2) * glowBreath)),
    glowRy: Math.max(0, safe((64 + settings.height * 0.16) * glowBreath)),
    glowOpacity: safe(0.34 + 0.86 * amplitude),
    sparks,
    brightness,
  };
}
