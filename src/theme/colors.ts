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

  /** The one accent. Marks what is playing, and the primary action on any screen. */
  accent: '#7C5CFF',
  /** The accent at low opacity, for fills behind it — badges, the player's backdrop wash. */
  accentSoft: 'rgba(124, 92, 255, 0.16)',

  /** Destructive actions only. */
  danger: '#FF5C7C',
};
