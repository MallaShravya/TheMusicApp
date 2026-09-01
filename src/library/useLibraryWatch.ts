import { useEffect } from 'react';
import { AppState } from 'react-native';

import MusicLibrary from '@/modules/music-library';

/**
 * The system media scanner emits one notification per file, so copying an album arrives as a
 * burst. One quiet second collapses a burst into a single rescan.
 */
const RESCAN_DEBOUNCE_MS = 1000;

/**
 * Keeps the library current without the user ever asking it to.
 *
 * Two triggers, because neither is sufficient alone:
 *
 * - The **MediaStore observer** catches files appearing while the app is in the foreground.
 * - The **foreground check** catches everything that happened while it was backgrounded,
 *   where Android makes no promise that observers are delivered at all.
 *
 * Together they mean the list matches the device whenever the user is actually looking at it,
 * and nothing polls in between.
 */
export function useLibraryWatch(refresh: () => unknown): void {
  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const scheduleRescan = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => void refresh(), RESCAN_DEBOUNCE_MS);
    };

    const changeSubscription = MusicLibrary.addListener('onLibraryChanged', scheduleRescan);

    // Not debounced: returning to the app is a single discrete event, and the user is looking
    // at the list right now.
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });

    return () => {
      if (debounce) clearTimeout(debounce);
      changeSubscription.remove();
      appStateSubscription.remove();
    };
  }, [refresh]);
}
