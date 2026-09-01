/**
 * The combined runtime of a collection, in prose: `48 min`, `1 hr 12 min`, `2 hr`.
 *
 * Deliberately *not* {@link formatDuration}. An album header saying `1:12:00` invites you to
 * read it as a position you could seek to; `1 hr 12 min` reads as a quantity. Same number,
 * different question being answered, so it is a different function rather than a flag.
 */
export function formatTotalDuration(ms: number): string {
  // Rounded to the nearest minute — nobody needs an album's length to the second, and the
  // seconds would only churn the header as tracks are added and removed.
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  // "2 hr", not "2 hr 0 min".
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}
