/**
 * A single track's length, as a clock reading: `3:07`, or `1:02:44` past the hour.
 *
 * Used in track rows and either side of the seek bar. The hours field is omitted rather
 * than zero-padded, so a typical song reads `3:07` and not `0:03:07`.
 */
export function formatDuration(ms: number): string {
  // The player reports NaN before a track loads and -1 for an unknown length; both would
  // otherwise render as "NaN:aN". A zero clock is the honest thing to show while waiting.
  if (!Number.isFinite(ms) || ms <= 0) return '0:00';

  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  // Seconds are always padded; minutes only once there is an hours field in front of them.
  const paddedSeconds = String(seconds).padStart(2, '0');

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`
    : `${minutes}:${paddedSeconds}`;
}
