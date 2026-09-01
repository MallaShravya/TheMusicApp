/**
 * Smoothing for values that drive animation.
 *
 * Raw per-buffer features are jittery — loudness swings hard between a snare hit and the gap
 * after it, and a fire driven directly by them strobes. But smoothing symmetrically is worse:
 * it blunts the transients, and the flames stop looking like they are reacting to anything.
 *
 * So attack and release differ. The value jumps most of the way toward a rise immediately and
 * eases back down slowly, which is how a flame physically behaves — fuel catches at once and
 * dies away — and also how percussion sounds.
 */
export type EnvelopeRates = {
  /** Share of the gap closed per frame while rising. Near 1 is instant. */
  attack: number;
  /** Share of the gap closed per frame while falling. Small is a long tail. */
  release: number;
};

export const FLAME_RATES: EnvelopeRates = { attack: 0.6, release: 0.08 };

/** Colour drifts rather than flickers, so it moves slower in both directions. */
export const COLOUR_RATES: EnvelopeRates = { attack: 0.2, release: 0.08 };

export function follow(previous: number, target: number, rates: EnvelopeRates): number {
  if (!Number.isFinite(target)) return previous;

  const rate = target > previous ? rates.attack : rates.release;
  return previous + (target - previous) * rate;
}
