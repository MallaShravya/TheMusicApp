import { useCallback, useState } from 'react';

import { useLibrary } from '@/src/library';
import type { Track } from '@/src/model';
import { usePlaylists } from '@/src/storage';

import type { Recipe } from './recipe';
import { renderRecipe } from './renderToFile';
import { saveGeneratedTrack, type GeneratedTrackRecord } from './store';

/** Every generated piece lands here, so they are one list rather than scattered through Songs. */
export const GENERATED_PLAYLIST = 'Generated';

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

/**
 * Saves a piece: renders it, files it, and puts it where it can be found again.
 *
 * Four things have to happen together and none of them is useful alone — the audio has to
 * exist on disk, the library has to know about it, the recipe has to be kept so the piece can
 * be reopened, and it has to join the playlist. Doing them in one place means a failure
 * part-way through is one thing to reason about rather than four.
 */
export function useSavePiece() {
  const { refresh } = useLibrary();
  const { playlists, createPlaylist, addToPlaylist } = usePlaylists();
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(
    async (recipe: Recipe, title: string): Promise<GeneratedTrackRecord | null> => {
      setState('saving');
      setError(null);

      try {
        // The id is also the filename, so a piece and its audio cannot drift apart.
        const id = `generated-${Date.now().toString(36)}`;
        const piece = await renderRecipe(recipe, id);

        const record: GeneratedTrackRecord = {
          id,
          uri: piece.uri,
          title,
          artist: 'Swayve',
          album: GENERATED_PLAYLIST,
          // Grouped under one album so the generated pieces sit together in Albums as well.
          albumId: 'generated',
          artistId: 'generated',
          durationMs: piece.durationMs,
          trackNumber: 0,
          discNumber: 0,
          year: new Date().getFullYear(),
          source: 'generated',
          recipe: recipe as unknown as Record<string, unknown>,
          createdAt: Date.now(),
        };

        await saveGeneratedTrack(record);

        // The playlist is made on first save rather than at startup, so an app that has never
        // generated anything does not show an empty list nobody asked for.
        const existing = playlists.find((playlist) => playlist.name === GENERATED_PLAYLIST);
        if (existing) await addToPlaylist(existing.id, [id]);
        else await createPlaylist(GENERATED_PLAYLIST, [id]);

        // Last, so the track is fully written before anything can play it.
        await refresh();

        setState('saved');
        return record;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
        setState('failed');
        return null;
      }
    },
    [addToPlaylist, createPlaylist, playlists, refresh],
  );

  const reset = useCallback(() => {
    setState('idle');
    setError(null);
  }, []);

  return { save, state, error, reset };
}

/** A Track from a stored record, for the library to fold in. */
export function toTrack(record: GeneratedTrackRecord): Track {
  return { ...record, source: 'generated' };
}
