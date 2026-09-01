/**
 * Pieces of the Now Playing modal.
 *
 * Grouped in their own folder because none of them are reusable elsewhere — they exist to
 * keep `app/player.tsx` readable, not to be shared. Each reads what it needs from the player
 * directly, so the screen passes almost nothing down.
 */
export { TopBar } from './TopBar';
export { Queue } from './Queue';
export { TrackDetails } from './TrackDetails';
export { Transport } from './Transport';
