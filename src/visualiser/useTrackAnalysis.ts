import { useEffect, useRef, useState } from 'react';

import MusicLibrary from '@/modules/music-library';
import type { Track } from '@/src/model';

import { readCachedAnalysis, writeCachedAnalysis } from './analysisCache';
import { buildTrackAnalysis, EMPTY_ANALYSIS, type TrackAnalysis } from './trackAnalysis';

/**
 * 20 frames a second. Fast enough that interpolation keeps the fire moving continuously, slow
 * enough that a four-minute track is a few thousand values rather than tens of thousands.
 */
const HOP_MS = 50;

export type TrackAnalysisState = {
  analysis: TrackAnalysis;
  /** True while a track is being decoded. The fire idles rather than freezing. */
  loading: boolean;
};

/**
 * Provides the analysis for whichever track is playing, decoding it if it has not been seen.
 *
 * Deliberately never blocks playback. Music starts immediately; the fire has nothing to burn
 * for the second or two the decode takes, and then it does. Making the user wait for a
 * visualiser would be the wrong trade.
 */
export function useTrackAnalysis(track: Track | null): TrackAnalysisState {
  const [analysis, setAnalysis] = useState<TrackAnalysis>(EMPTY_ANALYSIS);
  const [loading, setLoading] = useState(false);

  // Skipping through tracks starts several decodes that finish out of order; only the one for
  // the track still playing may be applied.
  const requestRef = useRef(0);

  useEffect(() => {
    const request = requestRef.current + 1;
    requestRef.current = request;

    if (!track) {
      setAnalysis(EMPTY_ANALYSIS);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const isStale = () => cancelled || requestRef.current !== request;

    void (async () => {
      const cached = await readCachedAnalysis(track.id);
      if (isStale()) return;

      if (cached) {
        setAnalysis(cached);
        setLoading(false);
        return;
      }

      setAnalysis(EMPTY_ANALYSIS);
      setLoading(true);

      try {
        const raw = await MusicLibrary.analyseTrack(track.uri, HOP_MS);
        if (isStale()) return;

        const built = buildTrackAnalysis(raw);
        setAnalysis(built);

        // Only worth storing if there is something in it — an undecodable file returns empty
        // arrays, and caching those would mean never retrying after a codec update.
        if (built.amplitude.length > 0) {
          await writeCachedAnalysis(track.id, built);
        }
      } catch {
        // A track that will not decode leaves the fire idling, which is a fine outcome for a
        // decoration and not worth surfacing as an error.
        if (!isStale()) setAnalysis(EMPTY_ANALYSIS);
      } finally {
        if (!isStale()) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [track]);

  return { analysis, loading };
}
