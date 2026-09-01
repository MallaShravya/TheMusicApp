import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTrackActions } from '@/components/TrackActions';
import type { Track } from '@/src/model';
import { UNKNOWN_ARTIST } from '@/src/model';
import { usePlaylists } from '@/src/storage/PlaylistProvider';
import { colors, spacing, typography } from '@/src/theme';

/**
 * Title and artist, with the two things you can do to a track from here.
 *
 * Favourite is a filled/outline heart rather than a labelled control: it is toggled often and
 * read at a glance, so the icon carries the state. Add-to-playlist opens the shared sheet.
 */
export function TrackDetails({ track }: { track: Track }) {
  const { isFavourite, toggleFavourite } = usePlaylists();
  const { openAddToPlaylist } = useTrackActions();

  const favourite = isFavourite(track.id);

  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text numberOfLines={1} style={styles.title}>
          {track.title}
        </Text>
        <Text numberOfLines={1} style={styles.artist}>
          {track.artist ?? UNKNOWN_ARTIST}
        </Text>
      </View>

      <Pressable
        onPress={() => void toggleFavourite(track.id)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={favourite ? 'Remove from favourites' : 'Add to favourites'}
      >
        <Ionicons
          name={favourite ? 'heart' : 'heart-outline'}
          size={24}
          color={favourite ? colors.accent : colors.textMuted}
        />
      </Pressable>

      <Pressable
        onPress={() => openAddToPlaylist([track.id])}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Add to playlist"
        style={styles.secondAction}
      >
        <Ionicons name="add-circle-outline" size={24} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, gap: spacing.xs },
  title: { ...typography.title, fontSize: 22 },
  artist: typography.label,
  secondAction: { marginLeft: spacing.lg },
});
