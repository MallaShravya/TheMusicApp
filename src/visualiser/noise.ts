/**
 * Deterministic smooth noise, from summed sinusoids.
 *
 * A fire needs motion that looks unplanned but is not actually random: `Math.random()` per
 * frame gives white noise, which reads as static rather than as a flame, and nothing about it
 * can be reproduced or tested. This is continuous in time, so a flame drifts instead of
 * jittering, and identical inputs always give identical output.
 *
 * No dependency and no lookup tables — three sine calls is cheap enough to run per control
 * point per frame.
 */

/** Octaves of detail. Three gives a slow drift with a fine ripple on top. */
const OCTAVES = 3;

/** Between-octave frequency step. Deliberately not 2, so the octaves rarely realign. */
const LACUNARITY = 1.87;

/** How much each successive octave contributes. */
const GAIN = 0.5;

/**
 * A stable pseudo-random phase for a seed.
 *
 * Only needs to scatter nearby seeds to unrelated phases — flame 3 must not move like flame 4 —
 * so the fractional part of a large irrational multiple is enough.
 */
function phaseFor(seed: number): number {
  return ((Math.sin(seed * 127.1 + 311.7) * 43758.5453) % 1) * Math.PI * 2;
}

/**
 * Smooth noise in roughly -1…1, continuous in `t`.
 *
 * @param seed  Distinguishes one wobbling thing from another.
 * @param t     Time or position. Advancing it slowly gives slow movement.
 */
export function wobble(seed: number, t: number): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let total = 0;

  for (let octave = 0; octave < OCTAVES; octave += 1) {
    value += Math.sin(t * frequency + phaseFor(seed + octave * 17.3)) * amplitude;
    total += amplitude;
    frequency *= LACUNARITY;
    amplitude *= GAIN;
  }

  // Normalised by the total amplitude so the result stays in range whatever OCTAVES is.
  return total > 0 ? value / total : 0;
}

/** The same noise remapped to 0…1, for sizes and opacities that must not go negative. */
export function wobble01(seed: number, t: number): number {
  return (wobble(seed, t) + 1) / 2;
}
