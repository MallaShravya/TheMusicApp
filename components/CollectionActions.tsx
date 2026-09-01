import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { Track } from '@/src/model';
import { usePlayer } from '@/src/player/PlayerProvider';
import { spacing } from '@/src/theme';

import { ActionButton } from './ActionButton';

/**
 * The Play / Shuffle pair at the head of an album, artist or playlist.
 *
 * Takes the collection and talks to the player directly, so a screen only has to say *which
 * tracks*. Previously each screen wired both buttons itself, which is how the Shuffle button
 * ended up subtly wrong in three places at once — see `shufflePlay` in `PlayerProvider`.
 */
export function CollectionActions({ tracks }: { tracks: Track[] }) {
  const { playQueue, shufflePlay } = usePlayer();

  return (
    <View style={styles.row}>
      <ActionButton
        label="Play"
        icon="play"
        variant="primary"
        onPress={() => playQueue(tracks, 0)}
      />
      <ActionButton label="Shuffle" icon="shuffle" onPress={() => shufflePlay(tracks)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
});
