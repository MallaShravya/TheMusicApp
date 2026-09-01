/**
 * Fixed dimensions that more than one file has to agree on.
 *
 * These are not styling choices so much as shared facts. A screen that pads its list by the
 * wrong mini-player height hides its own last row, and the bug only shows up when something
 * happens to be playing — so the number lives in one place rather than being repeated as a
 * literal in each list.
 */

/**
 * Height of the mini player, including its 2pt progress line.
 *
 * Consumed both by the component itself and by the tab bar it sits inside.
 */
export const MINI_PLAYER_HEIGHT = 62;
