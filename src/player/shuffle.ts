/**
 * Playback order is kept as an array of indices *into* the queue, rather than by shuffling
 * the queue itself.
 *
 * That indirection is what lets shuffle be toggled mid-song without disturbing anything: the
 * queue never moves, so "track 4 of 12" stays track 4, and only the route through it changes.
 */

/** `[0, 1, 2, …]` — the queue played in its own order. */
export function identityOrder(length: number): number[] {
  return Array.from({ length }, (_, index) => index);
}

/**
 * A random order with `first` lifted to the front.
 *
 * Pinning the first entry matters in two places: starting shuffled playback from a track the
 * user tapped, and turning shuffle on mid-song. Both need the current track to stay put while
 * everything after it is reordered.
 *
 * Fisher-Yates over a copy — an unbiased shuffle, where the naive `sort(() => Math.random() - 0.5)`
 * is not, and visibly favours leaving elements near where they started.
 */
export function shuffledOrder(length: number, first: number): number[] {
  const rest = identityOrder(length).filter((index) => index !== first);

  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }

  // A negative `first` means "nothing is playing", so there is nothing to pin.
  return first >= 0 ? [first, ...rest] : rest;
}
