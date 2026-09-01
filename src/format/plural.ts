/**
 * Counts a noun: `4 albums`, `1 album`, `0 tracks`.
 *
 * The irregular plural is a parameter because English will not be reasoned about — the app
 * already needs `1 entry` / `2 entries` shaped cases, and a bare `+ 's'` would be wrong the
 * first time one appears.
 */
export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  // Only exactly one is singular: zero takes the plural ("0 tracks"), as does anything else.
  return `${count} ${count === 1 ? singular : plural}`;
}
