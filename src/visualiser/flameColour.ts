export type Rgb = { r: number; g: number; b: number };

type Stop = { at: number; colour: Rgb };

/**
 * The fire's colour ramp: VIBGYOR, dark to bright.
 *
 * Violet, indigo, blue, green, yellow, orange, red — the spectrum in its traditional order,
 * used straight. Quiet, bass-heavy passages sit at the violet end; loud, bright ones burn red.
 *
 * Stops are evenly spaced so no band dominates, and the sequence descends the hue wheel
 * without doubling back. That matters because interpolation happens in RGB: a pair that jumps
 * across the wheel passes through the middle of the colour cube and arrives grey. Every
 * neighbour here is close enough that the colours between them are still colours — blue to
 * green is the widest gap and it passes through teal, which is fine.
 *
 * These flames are stylised, not simulated. Nothing here should be "corrected" toward
 * combustion physics.
 */
const STOPS: Stop[] = [
  { at: 0 / 6, colour: { r: 148, g: 0, b: 211 } },
  { at: 1 / 6, colour: { r: 75, g: 0, b: 130 } },
  { at: 2 / 6, colour: { r: 0, g: 71, b: 255 } },
  { at: 3 / 6, colour: { r: 0, g: 200, b: 83 } },
  { at: 4 / 6, colour: { r: 255, g: 235, b: 59 } },
  { at: 5 / 6, colour: { r: 255, g: 138, b: 0 } },
  { at: 6 / 6, colour: { r: 230, g: 32, b: 32 } },
];

export function flameColour(brightness: number): Rgb {
  const t = clamp01(brightness);

  // A short scan, cheaper than anything cleverer and easier to read.
  for (let i = 1; i < STOPS.length; i += 1) {
    const upper = STOPS[i];
    if (t > upper.at) continue;

    const lower = STOPS[i - 1];
    const span = upper.at - lower.at;
    return mix(lower.colour, upper.colour, span > 0 ? (t - lower.at) / span : 0);
  }

  return { ...STOPS[STOPS.length - 1].colour };
}


/** `rgba(...)`, ready for a fill. */
export function flameColourString(brightness: number, alpha = 1): string {
  const { r, g, b } = flameColour(brightness);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mix(from: Rgb, to: Rgb, t: number): Rgb {
  return {
    // Rounded because these become CSS-style colour strings, where fractional channels are
    // wasted precision.
    r: Math.round(from.r + (to.r - from.r) * t),
    g: Math.round(from.g + (to.g - from.g) * t),
    b: Math.round(from.b + (to.b - from.b) * t),
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
