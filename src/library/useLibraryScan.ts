import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import MusicLibrary from '@/modules/music-library';
import { loadGeneratedTracks, type GeneratedTrackRecord } from '@/src/generator/store';
import type { Track } from '@/src/model';

import { hasAudioLibraryPermission, requestAudioLibraryPermission } from './permissions';
import { toTrack } from './toTrack';

export type LibraryStatus = 'idle' | 'needs-permission' | 'scanning' | 'ready' | 'error';

export type LibraryScan = {
  status: LibraryStatus;
  error: string | null;
  tracks: Track[];
  /** Rescans if permitted. Concurrent calls join the running scan rather than starting one. */
  refresh: () => Promise<void>;
  /** Prompts for library access, then scans if it was granted. */
  requestAccess: () => Promise<void>;
};

/**
 * Owns the library's contents and how they get there.
 *
 * The scan is deliberately all-or-nothing: every change re-reads the whole library rather
 * than patching what moved. A MediaStore query over a few thousand tracks is a single cursor
 * pass, and incremental updates would mean reconciling adds, deletes and retags against
 * derived albums and artists — far more code, and far more ways to end up subtly wrong.
 */
export function useLibraryScan(): LibraryScan {
  const [status, setStatus] = useState<LibraryStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);

  const scanInFlight = useRef<Promise<void> | null>(null);

  const runScan = useCallback(async () => {
    setStatus('scanning');
    setError(null);

    try {
      // Both sources in parallel: the device library and anything the generator has made.
      // They are concatenated rather than merged — generated tracks are not in MediaStore,
      // so there is nothing to reconcile.
      const [native, generated] = await Promise.all([
        MusicLibrary.getTracks(),
        loadGeneratedTracks(),
      ]);

      const deviceTracks = native.map(toTrack);
      const generatedTracks: Track[] = (generated as GeneratedTrackRecord[]).map((record) => ({
        ...record,
        source: 'generated',
      }));

      setTracks([...deviceTracks, ...generatedTracks]);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the music library.');
      setStatus('error');
    }
  }, []);

  const refresh = useCallback((): Promise<void> => {
    if (scanInFlight.current) return scanInFlight.current;

    // The promise is built and stored before this function yields, so a caller arriving
    // during the permission check joins the running scan instead of starting a second one.
    // Checking the ref and *then* awaiting would leave a window where both callers see null
    // — which the change watcher and the foreground check can genuinely hit together.
    const run = (async () => {
      if (!(await hasAudioLibraryPermission())) {
        setStatus('needs-permission');
        return;
      }
      await runScan();
    })().finally(() => {
      scanInFlight.current = null;
    });

    scanInFlight.current = run;
    return run;
  }, [runScan]);

  const requestAccess = useCallback(async () => {
    const granted = await requestAudioLibraryPermission();
    if (!granted) {
      setStatus('needs-permission');
      return;
    }
    // Goes back through `refresh` rather than calling `runScan` directly, so there is exactly
    // one path that starts a scan. It re-checks the permission we just obtained, which costs
    // nothing and keeps the de-duplication in one place.
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Memoised so the returned object is referentially stable between renders. The provider
  // spreads this into its context value, and a fresh object each render would make that
  // value new every time — re-rendering every screen that reads the library for nothing.
  return useMemo(
    () => ({ status, error, tracks, refresh, requestAccess }),
    [status, error, tracks, refresh, requestAccess],
  );
}
