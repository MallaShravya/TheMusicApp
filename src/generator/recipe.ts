import { DEFAULT_STEP_WEIGHTS, SHUDDHA_SWARAS } from './randomNotes';

/**
 * Everything needed to reproduce a piece.
 *
 * Saved alongside the audio rather than instead of it, so a piece that turned out well can be
 * played like any other track *and* reopened to be tweaked. The audio is what you listen to;
 * this is what it was made from.
 *
 * The phrase text is stored as well as the settings that produced it. That is deliberate
 * duplication: the settings alone would only reproduce it if the generator never changes, and
 * the whole point of this stage is that the generator keeps changing.
 */
export type Recipe = {
  /** The phrase as sargam, exactly as it was played. */
  phrase: string;
  /** Tonic in hertz. */
  sa: number;
  beatsPerMinute: number;
  /** How far each note runs into the next, as a fraction of a beat. 0 is no overlap. */
  overlap: number;

  /* The generator's own settings, so a piece can be regenerated rather than only replayed. */
  count: number;
  anchorEvery: number;
  /** Total width in semitones. Half of it above the anchor and half below. */
  span: number;
  midpointAnchor: boolean;
  shuddhaOnly: boolean;
  holdChance: number;
  restChance: number;
  loopBacks: number;
  stepWeights: number[];
};

/**
 * The starting point, and the numbers the Generate tab opens on.
 *
 * A fast tempo and a long phrase on purpose: at 360 a beat is a sixth of a second, so a
 * hundred and twenty beats is twenty seconds of quick movement rather than a slow scale.
 */
export const DEFAULT_RECIPE: Recipe = {
  phrase: '',
  sa: 240,
  beatsPerMinute: 360,
  overlap: 0.4,

  count: 120,
  anchorEvery: 8,
  span: 32,
  midpointAnchor: true,
  shuddhaOnly: true,
  holdChance: 0.2,
  restChance: 0.09,
  loopBacks: 10,
  stepWeights: DEFAULT_STEP_WEIGHTS,
};

/** The range a span covers, as the generator wants it. */
export function rangeOf(span: number): { lowest: number; highest: number } {
  const half = Math.max(1, Math.round((Number.isFinite(span) ? span : 32) / 2));
  return { lowest: -half, highest: half };
}

/** The pitch classes a recipe allows, or undefined for all twelve. */
export function pitchClassesOf(recipe: Pick<Recipe, 'shuddhaOnly'>): number[] | undefined {
  return recipe.shuddhaOnly ? SHUDDHA_SWARAS : undefined;
}

/**
 * Fills in anything missing or nonsensical.
 *
 * Applied on read as well as on write: a recipe saved by an older build outlives the shape
 * that produced it, and a piece from last week should still open rather than crash.
 */
export function normaliseRecipe(stored: Partial<Recipe> | null | undefined): Recipe {
  const from = stored ?? {};
  const number = (value: unknown, fallback: number, low: number, high: number) => {
    const parsed = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    return Math.min(high, Math.max(low, parsed));
  };

  const weights = Array.isArray(from.stepWeights) && from.stepWeights.length > 1
    ? from.stepWeights.map((w) => (Number.isFinite(w) && w >= 0 ? w : 0))
    : DEFAULT_RECIPE.stepWeights;

  return {
    phrase: typeof from.phrase === 'string' ? from.phrase : '',
    sa: number(from.sa, DEFAULT_RECIPE.sa, 60, 900),
    beatsPerMinute: number(from.beatsPerMinute, DEFAULT_RECIPE.beatsPerMinute, 20, 600),
    overlap: number(from.overlap, DEFAULT_RECIPE.overlap, 0, 2),

    count: Math.round(number(from.count, DEFAULT_RECIPE.count, 2, 512)),
    anchorEvery: Math.round(number(from.anchorEvery, DEFAULT_RECIPE.anchorEvery, 0, 32)),
    span: Math.round(number(from.span, DEFAULT_RECIPE.span, 2, 72)),
    midpointAnchor: from.midpointAnchor ?? DEFAULT_RECIPE.midpointAnchor,
    shuddhaOnly: from.shuddhaOnly ?? DEFAULT_RECIPE.shuddhaOnly,
    holdChance: number(from.holdChance, DEFAULT_RECIPE.holdChance, 0, 0.8),
    restChance: number(from.restChance, DEFAULT_RECIPE.restChance, 0, 0.8),
    loopBacks: Math.round(number(from.loopBacks, DEFAULT_RECIPE.loopBacks, 0, 64)),
    stepWeights: weights,
  };
}

/** How long a phrase will last, in seconds, before it is rendered. */
export function durationOf(recipe: Pick<Recipe, 'count' | 'beatsPerMinute'>): number {
  if (!(recipe.beatsPerMinute > 0)) return 0;
  return (recipe.count * 60) / recipe.beatsPerMinute;
}
