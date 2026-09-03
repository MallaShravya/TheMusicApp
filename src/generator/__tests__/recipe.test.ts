import { DEFAULT_RECIPE, durationOf, normaliseRecipe, pitchClassesOf, rangeOf } from '../recipe';
import { SHUDDHA_SWARAS } from '../randomNotes';

describe('the defaults the Generate tab opens on', () => {
  it('are the ones that were asked for', () => {
    expect(DEFAULT_RECIPE.sa).toBe(240);
    expect(DEFAULT_RECIPE.beatsPerMinute).toBe(360);
    expect(DEFAULT_RECIPE.overlap).toBe(0.4);
    expect(DEFAULT_RECIPE.count).toBe(120);
    expect(DEFAULT_RECIPE.anchorEvery).toBe(8);
    expect(DEFAULT_RECIPE.span).toBe(32);
    expect(DEFAULT_RECIPE.midpointAnchor).toBe(true);
    expect(DEFAULT_RECIPE.shuddhaOnly).toBe(true);
    expect(DEFAULT_RECIPE.holdChance).toBe(0.2);
    expect(DEFAULT_RECIPE.restChance).toBe(0.09);
    expect(DEFAULT_RECIPE.loopBacks).toBe(10);
    expect(DEFAULT_RECIPE.stepWeights).toEqual([0, 36, 36, 25, 3]);
  });

  it('runs for twenty seconds', () => {
    expect(durationOf(DEFAULT_RECIPE)).toBeCloseTo(20, 6);
  });
});

describe('the range', () => {
  it('is a total span, split either side of the anchor', () => {
    // The field says 32 and the generator gets plus and minus 16.
    expect(rangeOf(32)).toEqual({ lowest: -16, highest: 16 });
    expect(rangeOf(12)).toEqual({ lowest: -6, highest: 6 });
  });

  it('never collapses to nothing', () => {
    expect(rangeOf(0).highest).toBeGreaterThan(0);
    expect(rangeOf(NaN)).toEqual({ lowest: -16, highest: 16 });
  });
});

describe('pitch classes', () => {
  it('restricts to the shuddha seven when asked', () => {
    expect(pitchClassesOf({ shuddhaOnly: true })).toEqual(SHUDDHA_SWARAS);
  });

  it('allows all twelve otherwise', () => {
    expect(pitchClassesOf({ shuddhaOnly: false })).toBeUndefined();
  });
});

describe('reading a stored recipe', () => {
  it('fills in everything missing', () => {
    expect(normaliseRecipe({})).toEqual({ ...DEFAULT_RECIPE, phrase: '' });
    expect(normaliseRecipe(null)).toEqual({ ...DEFAULT_RECIPE, phrase: '' });
  });

  it('keeps what is there', () => {
    const stored = normaliseRecipe({ sa: 300, count: 64, shuddhaOnly: false, phrase: 'S R G' });
    expect(stored.sa).toBe(300);
    expect(stored.count).toBe(64);
    expect(stored.shuddhaOnly).toBe(false);
    expect(stored.phrase).toBe('S R G');
  });

  it('pulls impossible values back into range rather than trusting them', () => {
    // A recipe saved by an older build outlives the shape that produced it.
    const wild = normaliseRecipe({
      sa: -5, beatsPerMinute: 99999, count: 0, span: 500, overlap: 40, holdChance: 9,
    } as never);
    expect(wild.sa).toBeGreaterThanOrEqual(60);
    expect(wild.beatsPerMinute).toBeLessThanOrEqual(600);
    expect(wild.count).toBeGreaterThanOrEqual(2);
    expect(wild.span).toBeLessThanOrEqual(72);
    expect(wild.overlap).toBeLessThanOrEqual(2);
    expect(wild.holdChance).toBeLessThanOrEqual(0.8);
  });

  it('replaces a broken weight list rather than generating from it', () => {
    expect(normaliseRecipe({ stepWeights: [] as number[] }).stepWeights).toEqual(DEFAULT_RECIPE.stepWeights);
    expect(normaliseRecipe({ stepWeights: [0, NaN, 5] }).stepWeights).toEqual([0, 0, 5]);
  });
});
