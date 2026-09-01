/**
 * The night above the fire.
 *
 * Everything here is settled up front. The stars are generated once from a fixed seed and
 * their positions never change; the blinking is real, but no part of it is calculated per
 * frame. Each star is assigned to one of a few `TWINKLE_GROUPS`, and the platform's own
 * animation driver oscillates the group — CSS keyframes in the preview, `Animated` on the
 * device. Seven values move; a hundred and twenty stars ride on them.
 *
 * The shooting star runs off a hardcoded table of crossings for the same reason.
 *
 * No moon, by request.
 *
 * Deliberately no gradients in this file. A gradient resolves its radius against the bounding
 * box of the shape it fills, and a streak is a zero-height box — the shape that crashed the
 * app once already. Fading is done with stacked segments at falling opacity.
 */

export type Star = {
  x: number;
  y: number;
  r: number;
  /** The star's own brightness, before its group's blink is applied. */
  opacity: number;
  /** Which entry of `TWINKLE_GROUPS` drives this star. */
  group: number;
};

/**
 * The blink, as a table rather than a calculation.
 *
 * One oscillation per group, and every star in a group rides the same one — which is why a
 * field of any size costs the same handful of animated values. The periods are deliberately
 * unrelated to each other: round or harmonic numbers would drift into step and the whole sky
 * would pulse together, which is the one thing that would give it away.
 *
 * `low` is how far the group dims at its darkest. Varying it per group matters as much as the
 * timing does — a sky where everything dips by the same amount reads as a flicker, not stars.
 */
export const TWINKLE_GROUPS = [
  { period: 3.1, phase: 0.0, low: 0.58 },
  { period: 4.3, phase: 1.7, low: 0.7 },
  { period: 2.6, phase: 0.9, low: 0.52 },
  { period: 5.9, phase: 3.4, low: 0.78 },
  { period: 3.7, phase: 2.2, low: 0.62 },
  { period: 6.7, phase: 4.8, low: 0.84 },
  { period: 2.9, phase: 1.3, low: 0.55 },
] as const;

export type Streak = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  opacity: number;
  width: number;
};

/**
 * How far down the sky reaches, as a fraction of the stage.
 *
 * Stars belong in the band above the fire, not behind it. The distribution is weighted hard
 * toward the top of this range and its brightness falls away with depth, so the field thins
 * into the dark rather than stopping on a line.
 */
export const SKY_DEPTH = 0.38;

/** The seed the shipped sky is drawn from. Changing it redraws every star. */
export const SKY_SEED = 20260902;

/** One shooting star roughly this often, in seconds. */
export const SHOOTING_PERIOD = 11;

/** How long it takes to cross, in seconds. */
export const SHOOTING_DURATION = 1.1;

/** The tail is drawn as this many segments, each dimmer than the last. */
export const STREAK_SEGMENTS = 7;

/**
 * The crossings, in fractions of the stage, cycled through in order.
 *
 * Fixed rather than generated: there is no reason to pay for randomness that repeats every
 * few minutes anyway, and a written table is one that can be read and adjusted. All of them
 * stay in the upper sky, and they alternate direction so they never look like a pattern.
 */
const CROSSINGS = [
  { x: -0.06, y: 0.07, dir: 1, span: 0.64, drop: 0.14 },
  { x: 0.94, y: 0.15, dir: -1, span: 0.58, drop: 0.19 },
  { x: 0.12, y: 0.04, dir: 1, span: 0.47, drop: 0.11 },
  { x: 1.02, y: 0.09, dir: -1, span: 0.71, drop: 0.16 },
  { x: -0.02, y: 0.19, dir: 1, span: 0.55, drop: 0.09 },
  { x: 0.86, y: 0.05, dir: -1, span: 0.5, drop: 0.21 },
] as const;

/** A small deterministic generator, so the same seed always draws the same sky. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Scatters stars across the top of the sky.
 *
 * `depth ** 1.8` puts about nine in ten inside the upper third and trails the rest below it,
 * and brightness falls with the same depth so the edge of the field reads as a fade rather
 * than a boundary.
 */
export function makeStars(
  count: number,
  width: number,
  height: number,
  seed = SKY_SEED,
): Star[] {
  if (!(width > 0) || !(height > 0) || !(count > 0)) return [];

  const random = mulberry32(seed);
  const stars: Star[] = [];

  for (let i = 0; i < count; i += 1) {
    const depth = random() ** 1.8;

    stars.push({
      x: width * random(),
      y: height * (0.015 + SKY_DEPTH * depth),
      r: 0.4 + 0.9 * random() ** 2,
      // Bright. The depth fade is gentle now — enough to give the field a far edge, not
      // so much that the lower half turns to grey smudges.
      opacity: (0.42 + 0.58 * random()) * (1 - 0.42 * depth),
      // Assigned from the seed, not by index: neighbours must not share a blink or the
      // grouping becomes visible as bands of the sky pulsing together.
      group: Math.floor(random() * TWINKLE_GROUPS.length) % TWINKLE_GROUPS.length,
    });
  }

  return stars;
}

/**
 * The shooting star, if one is crossing at this instant.
 *
 * Returns an empty array the rest of the time, which is most of it — the caller can skip all
 * of its work on that basis.
 */
export function shootingStar(time: number, width: number, height: number): Streak[] {
  if (!Number.isFinite(time) || !(width > 0) || !(height > 0)) return [];

  const cycle = Math.floor(time / SHOOTING_PERIOD);
  const elapsed = time - cycle * SHOOTING_PERIOD;
  if (elapsed > SHOOTING_DURATION) return [];

  const crossing = CROSSINGS[((cycle % CROSSINGS.length) + CROSSINGS.length) % CROSSINGS.length];
  const progress = elapsed / SHOOTING_DURATION;

  const span = width * crossing.span;
  const drop = height * crossing.drop;
  const headX = width * crossing.x + crossing.dir * span * progress;
  const headY = height * crossing.y + drop * progress;

  // Fades in and out rather than snapping on: sin gives 0 at both ends and 1 in the middle.
  const envelope = Math.sin(Math.PI * progress);
  const tailLength = width * 0.16;
  const slope = drop / (span || 1);

  const segments: Streak[] = [];
  for (let i = 0; i < STREAK_SEGMENTS; i += 1) {
    const near = i / STREAK_SEGMENTS;
    const far = (i + 1) / STREAK_SEGMENTS;

    segments.push({
      x1: headX - crossing.dir * tailLength * near,
      y1: headY - tailLength * near * slope,
      x2: headX - crossing.dir * tailLength * far,
      y2: headY - tailLength * far * slope,
      // Brightest at the head, gone by the end of the tail.
      opacity: Math.max(0, envelope * 0.85 * (1 - near) ** 1.6),
      width: Math.max(0.3, 1.7 * (1 - near)),
    });
  }

  return segments;
}

/** True while a crossing is on screen. Lets a renderer sleep through the gaps. */
export function isShooting(time: number): boolean {
  if (!Number.isFinite(time)) return false;
  return time - Math.floor(time / SHOOTING_PERIOD) * SHOOTING_PERIOD <= SHOOTING_DURATION;
}
