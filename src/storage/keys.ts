/**
 * AsyncStorage keys for everything the user authors.
 *
 * The `.v1` suffix is deliberate. These hold the only data in the app that cannot be
 * rebuilt — a playlist exists nowhere else — so when a shape has to change, the honest move
 * is a new key plus a migration that reads the old one, not a hopeful in-place reinterpret
 * that corrupts what it cannot parse.
 */
export const PLAYLISTS_KEY = 'ratio.playlists.v1';
export const FAVOURITES_KEY = 'ratio.favourites.v1';
