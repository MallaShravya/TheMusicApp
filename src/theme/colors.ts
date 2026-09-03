/**
 * The single palette. One dark theme, no light variant.
 *
 * The app pins `userInterfaceStyle: "dark"` in app.json, so there is nothing to switch
 * between — a music player is looked at in the dark, next to album art, and a palette that
 * has to work in both modes ends up compromising for neither.
 *
 * Named by *role* rather than by shade (`surfaceRaised`, not `grey800`) so that restyling
 * means editing this file, not hunting for which grey meant "a card on top of a card".
 */
export const colors = {
  /** The page behind everything. Nearly black, faintly blue. */
  bg: '#0B0B10',
  /** Cards, the tab bar, the mini player — one step up from the page. */
  surface: '#15151D',
  /** A layer above that: artwork placeholders, inputs, avatars. */
  surfaceRaised: '#1E1E28',
  /** Hairline dividers. Deliberately close to `surface`; borders should be felt, not read. */
  border: '#272733',

  /** Primary reading colour: titles, controls, anything you act on. */
  text: '#F2F2F7',
  /** Secondary: artist names, counts, supporting lines. */
  textMuted: '#9A9AAB',
  /** Tertiary: durations, timestamps, inactive tab icons. */
  textFaint: '#6B6B7B',

  /**
   * The primary accent. Marks what is playing, and the primary action on any screen.
   *
   * Taken from the icon rather than chosen beside it: this is the brightest orange the flame
   * actually reaches once its three translucent layers have been composited over black. The
   * ramp's orange stop is #FF8A00 and the drawn result is a shade under it, so matching the
   * drawing rather than the source is what makes the icon and the interface agree.
   */
  accent: '#FA8700',
  /** The accent at low opacity, for fills behind it — badges, the player's backdrop wash. */
  accentSoft: 'rgba(250, 135, 0, 0.16)',
  /**
   * The secondary accent, for what the app made rather than what it found.
   *
   * The primary's complement: the orange sits at hue 32.4 degrees, so this sits at 212.4 with
   * the same saturation and lightness. Not the RGB inverse, which would be #0578FF — that is
   * the negative rather than the complement, and it shifts the lightness as a side effect.
   */
  accentSecondary: '#0073FA',
  accentSecondarySoft: 'rgba(0, 115, 250, 0.16)',

  /** Destructive actions only. */
  danger: '#FF5C7C',
};
