import { wobble, wobble01 } from './noise';

export type Point = { x: number; y: number };

export type FlameShapeParams = {
  /** Distinguishes this tongue from its neighbours; identical seeds move identically. */
  seed: number;
  /** Seconds. Advancing this is what animates the flame. */
  time: number;
  /** Horizontal centre of the flame's base. */
  centreX: number;
  /** Vertical position of the base — the fire sits on this line. */
  baseY: number;
  /** How tall the tongue reaches. Driven by amplitude. */
  height: number;
  /** The tongue's width at its widest point, in the belly — *not* at the base. */
  width: number;
  /** Lateral drift of the tip, in pixels. The base never moves. */
  sway: number;
  /** Amplitude of the ripple along each edge. */
  flutter: number;
  /** Higher makes a narrower, sharper tip. */
  tipSharpness: number;
  /** Outline resolution up one side. More is smoother and slower. */
  segments: number;
};

/** How wide the foot is, relative to the tongue's widest point. */
const FOOT = 0.15;

/** Shapes the lower flare. Lower opens the belly out faster and sits it lower. */
const FLARE = 0.55;

/** How fast the neck closes below the belly. Higher keeps the foot tighter. */
const FOOT_DECAY = 6;

/**
 * Peak of `u^a · (1-u)^b`, exactly.
 *
 * Differentiating gives a maximum at `a / (a + b)`, so there is no need to search for it. An
 * earlier version sampled the curve to find this, which was both approximate — the profile
 * came out slightly over 1 — and, worse, dependent on `tipSharpness` in a way that leaked into
 * the foot width. Cached only because it is called per point, per layer, per frame.
 */
const peakCache = new Map<number, { at: number; value: number }>();

function bodyPeak(tipSharpness: number): { at: number; value: number } {
  const cached = peakCache.get(tipSharpness);
  if (cached) return cached;

  const at = FLARE / (FLARE + tipSharpness);
  const value = at ** FLARE * (1 - at) ** tipSharpness;
  const result = { at, value: value > 0 ? value : 1 };

  peakCache.set(tipSharpness, result);
  return result;
}

/**
 * Width at height `u`, as a fraction of the tongue's widest point.
 *
 * The silhouette is a stylised flame: a narrow neck where it meets the fuel, a belly in the
 * lower half, and a point at the top. Built from two parts —
 *
 * - **body**: `u^FLARE · (1-u)^tipSharpness`, normalised to peak at exactly 1. Zero at *both*
 *   ends, which is what gives the shape its neck and its point.
 * - **foot**: a small constant that only survives near the base, so the flame meets the wood
 *   with a narrow stem rather than vanishing to nothing.
 *
 * Keeping the foot outside the normalisation is the important part: it means `FOOT` is the
 * literal width at the base whatever `tipSharpness` does, instead of being scaled by it.
 *
 * Exported because this profile *is* the flame's identity — worth inspecting and testing
 * directly rather than only through a rendered path.
 */
export function flameWidthProfile(u: number, tipSharpness: number): number {
  if (!Number.isFinite(u) || u < 0 || u > 1) return 0;

  const peak = bodyPeak(tipSharpness);
  const body = (u ** FLARE * (1 - u) ** tipSharpness) / peak.value;
  const foot = FOOT * (1 - u) ** FOOT_DECAY;

  // Blended rather than added. Adding them overshoots 1 slightly around the belly, and
  // clamping that away leaves a flat spot exactly where the flame is widest. This reaches
  // exactly 1 at the belly, exactly `FOOT` at the base, and exactly 0 at the tip.
  return body + foot * (1 - body);
}

/**
 * The outline of one flame tongue, as a closed loop of points.
 *
 * Walks up the left edge to the tip and back down the right, so the result can be stroked or
 * filled as a single closed path. Both the centreline and the edges are displaced by noise,
 * but everything is scaled by `u` so distortion grows with height — a flame is anchored where
 * it meets its fuel and loosest at the tip. Wobbling the base too would make it look like the
 * whole fire was sliding around.
 */
export function flameOutline(params: FlameShapeParams): Point[] {
  const {
    seed, time, centreX, baseY, height, width,
    sway, flutter, tipSharpness, segments,
  } = params;

  const steps = Math.max(3, Math.floor(segments));
  const left: Point[] = [];
  const right: Point[] = [];

  for (let i = 0; i <= steps; i += 1) {
    const u = i / steps;

    // Two lateral movements, because one reads as a wobble rather than as fire.
    //
    // A slow lean displaces the whole upper flame in one direction, like a draught crossing
    // it; a faster whip rides on top of that. The exponent is well below 2 so the middle of
    // the tongue moves too — squaring it pins everything but the last few pixels of tip, which
    // is what made the shape look rigid.
    const bend = u ** 1.45;

    // Three displacements of the *centreline*, so both edges always move together.
    //
    // Flutter used to be applied to each edge independently, with its own seed. That let the
    // two sides wander toward each other and meet — a tongue pinched to zero width, or worse,
    // edges crossing over and the shape reading as a twisted ribbon. Displacing the centre and
    // deriving both edges from it makes crossing geometrically impossible.
    const lean = wobble(seed + 5.7, time * 0.42) * sway * 0.75 * bend;
    const whip = wobble(seed, time * 1.35 + u * 2.4) * sway * 0.55 * bend;
    const ripple = wobble(seed + 88.2, time * 2.3 + u * 5.1) * flutter * bend;

    const x = centreX + lean + whip + ripple;
    const y = baseY - height * u;

    // Width breathes symmetrically instead. The multiplier stays well clear of zero, so the
    // only place a tongue closes is the tip, where the taper is supposed to bring it to a point.
    const breathe = 0.78 + 0.3 * wobble01(seed + 141.7, time * 1.9 + u * 3.6);
    const halfWidth = Math.max(0, (width / 2) * flameWidthProfile(u, tipSharpness) * breathe);

    left.push({ x: x - halfWidth, y });
    right.push({ x: x + halfWidth, y });
  }

  // Up the left, back down the right. The tip point is shared, so it is not repeated.
  return [...left, ...right.reverse().slice(1)];
}

/**
 * A closed SVG path through the points, smoothed.
 *
 * Straight segments between outline points would show as faceting on the shoulders of the
 * flame. This converts a Catmull-Rom spline through the points into cubic Béziers, which
 * passes exactly through every point while keeping the curve continuous — so resolution can
 * be traded away without the silhouette going angular.
 */
export function toPathData(points: Point[]): string {
  const count = points.length;
  if (count < 3) return '';

  // Wraps at both ends, because the shape is a loop: the curve leaving the last point has to
  // arrive back at the first without a corner.
  const at = (index: number) => points[((index % count) + count) % count];

  let path = `M ${round(points[0].x)} ${round(points[0].y)}`;

  for (let i = 0; i < count; i += 1) {
    const previous = at(i - 1);
    const current = at(i);
    const next = at(i + 1);
    const following = at(i + 2);

    // The standard Catmull-Rom → Bézier control points, with the usual 1/6 tension.
    const c1 = {
      x: current.x + (next.x - previous.x) / 6,
      y: current.y + (next.y - previous.y) / 6,
    };
    const c2 = {
      x: next.x - (following.x - current.x) / 6,
      y: next.y - (following.y - current.y) / 6,
    };

    path += ` C ${round(c1.x)} ${round(c1.y)}, ${round(c2.x)} ${round(c2.y)}, ${round(next.x)} ${round(next.y)}`;
  }

  return `${path} Z`;
}

/** Two decimals is well under a pixel, and keeps the path string short enough to rebuild often. */
function round(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}
