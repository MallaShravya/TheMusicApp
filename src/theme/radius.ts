/**
 * Corner radii, in points.
 *
 * Scaled to the size of the thing being rounded: a 44pt thumbnail with a 16pt radius looks
 * like a blob, and a 360pt album cover with a 6pt radius looks square. Hence four steps
 * rather than one global value.
 */
export const radius = {
  /** Small thumbnails: track rows, the mini player, artist tiles in a section header. */
  sm: 6,
  /** Cards, inputs, sheets, medium artwork. The general-purpose one. */
  md: 10,
  /** Large surfaces: the Now Playing cover, modal sheets. */
  lg: 16,
  /**
   * Fully round. Any value past half the height gets clamped, so this works on a button of
   * any size without needing to know it.
   */
  pill: 999,
};
