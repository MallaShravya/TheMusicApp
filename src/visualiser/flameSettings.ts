/**
 * The eight numbers that shape the fire, their permitted ranges, and the tuned defaults.
 *
 * One definition, used three ways: the preview console builds its sliders from it, the app's
 * settings screen builds the same sliders from it, and both renderers read the same values.
 * Hardcoding the numbers in each place is how a preview and an app quietly stop agreeing.
 */

export type FlameSettings = {
  /** How many separate tongues make up the fire. */
  tongues: number;
  /** Translucent copies per tongue. More is softer and more expensive. */
  layers: number;
  /** The tallest pixel the fire may ever touch, in scene units. */
  height: number;
  /** Width at a tongue's widest point, in scene units. Also sets how far apart they sit. */
  width: number;
  /** Lateral travel of a tongue's tip, in scene units. */
  sway: number;
  /** Amplitude of the ripple running up a tongue. */
  flutter: number;
  /** Higher gives a narrower, more pointed tip and drops the belly lower. */
  tipSharpness: number;
  /** Outline resolution up one side. Higher is smoother and slower. */
  segments: number;
};

/**
 * The coordinate space every setting is expressed in.
 *
 * The renderer draws into this box and scales it to whatever space it is given, so a value
 * tuned in the preview means exactly the same thing on a phone. Without a fixed space, "peak
 * height 212" would mean a different fire on every screen.
 */
export const SCENE = {
  width: 520,
  height: 430,
  /** The line the fire stands on — inside the log pile, so tongues rise out of the wood. */
  baseY: 338,
} as const;

/**
 * The part of the scene actually drawn.
 *
 * The scene stays 520x430 so tuned numbers keep their meaning, but the fire never uses that
 * much of it. Measured over 900 frames at full amplitude with the default settings:
 *
 *   flames + sparks   x 182..326   top y 147
 *   flames at sway 80 x  99..390
 *   glow              rx 218 (x 42..478), ry 119..142 from cy 352
 *
 * So the flames themselves occupy under a third of the scene's width, and rendering the whole
 * box wasted the rest. The container is far wider than it is tall in scene units, which means
 * **width is the binding dimension** — the vertical crop costs nothing in scale and is chosen
 * for composition alone, while every unit trimmed horizontally makes the fire bigger.
 *
 * x: 80..440 keeps the flames clear even at heavy sway and cuts the glow at 83% of its radius,
 * where the gradient has faded to roughly 0.04 opacity — far enough out that the crop does not
 * read as an edge. Cutting nearer than that reintroduces the hard rim the gradient replaced.
 *
 * y: 120 leaves headroom above the default flame tip at 147. The bottom stops at 410 rather
 * than the scene floor at 430, which drops the fire about 23dp lower on the stage — the
 * viewBox is bottom-anchored, so trimming below the fire is what moves it down. That cuts the
 * glow at roughly half its radius, where the gradient is faint enough not to read as an edge;
 * trimming much further would start to show a seam across the bottom.
 *
 * Peak heights past roughly 265 clip at the top. That is deliberate — rescaling to fit would
 * make the height slider do nothing on screen, since a taller fire would just be drawn smaller.
 */
export const VIEWPORT = {
  x: 80,
  y: 120,
  width: 360,
  height: 290,
} as const;

/** Tuned by eye in the preview console. */
export const DEFAULT_FLAME_SETTINGS: FlameSettings = {
  tongues: 7,
  layers: 3,
  height: 212,
  width: 22,
  sway: 30,
  flutter: 5,
  tipSharpness: 1.8,
  segments: 36,
};

export type SettingRange = {
  key: keyof FlameSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Decimal places to show. Whole numbers for counts and pixels, one for exponents. */
  decimals: number;
};

/**
 * Ordered for the UI: what the fire is made of, then how big, then how it moves, then quality.
 */
export const FLAME_SETTING_RANGES: SettingRange[] = [
  { key: 'tongues', label: 'Tongues', min: 3, max: 13, step: 1, decimals: 0 },
  { key: 'layers', label: 'Glow layers', min: 1, max: 3, step: 1, decimals: 0 },
  // Capped just below the base line, so the fire cannot climb out of the scene.
  { key: 'height', label: 'Peak height', min: 90, max: SCENE.baseY - 12, step: 2, decimals: 0 },
  { key: 'width', label: 'Belly width', min: 8, max: 170, step: 2, decimals: 0 },
  { key: 'sway', label: 'Sway', min: 0, max: 160, step: 2, decimals: 0 },
  { key: 'flutter', label: 'Flutter', min: 0, max: 34, step: 1, decimals: 0 },
  { key: 'tipSharpness', label: 'Tip sharpness', min: 0.4, max: 2.6, step: 0.05, decimals: 2 },
  { key: 'segments', label: 'Segments', min: 5, max: 36, step: 1, decimals: 0 },
];

/**
 * Forces a value onto its range and step grid.
 *
 * Applied on read as well as on write, because stored settings outlive the ranges that
 * produced them: a value saved before a limit changed would otherwise draw a fire that the
 * sliders can no longer express, or in the worst case one that leaves the scene.
 */
export function clampSetting(key: keyof FlameSettings, value: number): number {
  const range = FLAME_SETTING_RANGES.find((entry) => entry.key === key);
  if (!range) return value;
  if (!Number.isFinite(value)) return DEFAULT_FLAME_SETTINGS[key];

  const bounded = Math.min(range.max, Math.max(range.min, value));
  const stepped = Math.round((bounded - range.min) / range.step) * range.step + range.min;

  // Re-bound after snapping: rounding up on the last step can overshoot the maximum.
  const settled = Math.min(range.max, Math.max(range.min, stepped));

  // Float steps accumulate error — 0.05 steps land on 1.7500000000000002 without this.
  const factor = 10 ** range.decimals;
  return Math.round(settled * factor) / factor;
}

/**
 * A complete, valid settings object from whatever was stored.
 *
 * Missing keys fall back to the default rather than to zero, so a settings file written by an
 * older build stays usable instead of producing an invisible fire.
 */
export function normaliseSettings(stored: Partial<FlameSettings> | null | undefined): FlameSettings {
  const result = { ...DEFAULT_FLAME_SETTINGS };

  if (!stored || typeof stored !== 'object') return result;

  for (const range of FLAME_SETTING_RANGES) {
    const value = stored[range.key];
    if (typeof value === 'number') {
      result[range.key] = clampSetting(range.key, value);
    }
  }

  return result;
}
