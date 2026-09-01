/**
 * The spacing scale, in points.
 *
 * A fixed ladder rather than free numbers: every gap in the app is one of these six values,
 * which is what makes unrelated screens look like they belong together. Roughly a 4pt grid,
 * loosening as it grows — the eye notices the difference between 4 and 8 far more than
 * between 24 and 28, so the large end does not need fine steps.
 */
export const spacing = {
  /** Hairline gaps: between a title and its subtitle. */
  xs: 4,
  sm: 8,
  md: 12,
  /** The default. Screen edges, list padding, gaps between rows. */
  lg: 16,
  xl: 24,
  xxl: 32,
};
