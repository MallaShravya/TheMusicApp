import { wobble } from './noise';

export type Spark = { cx: number; cy: number; r: number; opacity: number };

export const SPARK_COUNT = 22;

/**
 * What one spark carries with it while it is in the air.
 *
 * A spark used to be positioned straight from the fire's *current* energy, which meant that
 * when the music quietened every spark already aloft was pulled back down toward the wood —
 * they fell. Embers do not fall back into a fire. A spark's flight is settled the moment it
 * leaves, so the energy it launched with is captured here and used for the rest of its life.
 *
 * `cycle` is which repetition of the spark's loop this is. When it changes, the spark has been
 * reborn, and that is the only moment a new energy is read.
 */
export type SparkState = { cycle: number; launchEnergy: number };

/** `-1` so that the first frame always counts as a launch. */
export function makeSparkStates(count: number = SPARK_COUNT): SparkState[] {
  return Array.from({ length: count }, () => ({ cycle: -1, launchEnergy: 0 }));
}

/** Each spark loops on its own schedule, so they never pulse in unison. */
export function sparkRate(index: number): number {
  return 0.22 + 0.16 * (index % 5);
}

export function sparkPhase(index: number, count: number = SPARK_COUNT): number {
  return index / count;
}

export type SparkInput = {
  states: SparkState[];
  time: number;
  /** The fire's energy right now. Read only when a spark launches. */
  energy: number;
  centreX: number;
  baseY: number;
  /** `settings.width`, which sets how far sparks drift sideways. */
  width: number;
  /** `settings.height`, which sets how far they climb. */
  height: number;
};

/**
 * Positions every spark for one frame.
 *
 * Mutates `states` in place, the same way the tongue levels are carried between frames. The
 * guarantee worth preserving here is that `cy` never increases across a spark's flight — see
 * `__tests__/sparks.test.ts`, which drives the energy down mid-flight and checks exactly that.
 */
export function buildSparks(input: SparkInput): Spark[] {
  const { states, time, energy, centreX, baseY, width, height } = input;
  const count = states.length;
  const sparks: Spark[] = [];

  for (let s = 0; s < count; s += 1) {
    const state = states[s];
    const raw = time * sparkRate(s) + sparkPhase(s, count);
    const cycle = Math.floor(raw);
    const life = raw - cycle;

    if (cycle !== state.cycle) {
      state.cycle = cycle;
      state.launchEnergy = Number.isFinite(energy) ? energy : 0;
    }

    const launch = state.launchEnergy;
    const rise = life ** 0.85;
    const seed = 40 + s * 3.3;

    sparks.push({
      cx: finite(centreX + wobble(seed, time * 0.7 + life * 3) * width * 1.9, centreX),
      // Climbs on the energy it left with, not the energy of this instant.
      cy: finite(baseY - rise * height * 0.9 * launch, baseY),
      r: Math.max(0, finite(0.7 + 1.5 * (1 - rise) * launch)),
      opacity: Math.max(0, finite((1 - rise) * 0.6 * launch)),
    });
  }

  return sparks;
}

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}
