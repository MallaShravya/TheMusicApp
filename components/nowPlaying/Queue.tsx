import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { usePlayer } from '@/src/player/PlayerProvider';
import { UNKNOWN_ARTIST } from '@/src/model';
import { colors, spacing, typography } from '@/src/theme';

/**
 * What is playing next, in play order.
 *
 * Iterates the *order* array rather than the queue, so with shuffle on this shows the route
 * actually being taken rather than the collection it was built from. That makes it the one
 * place in the app where you can see whether shuffle really shuffled.
 */
export function Queue() {
  const { queue, order, position, skipToPosition } = usePlayer();

  return (
    <FlatList
      style={styles.list}
      data={order}
      keyExtractor={(queueIndex) => queue[queueIndex]?.id ?? String(queueIndex)}
      contentContainerStyle={styles.content}
      renderItem={({ item: queueIndex, index }) => {
        const track = queue[queueIndex];
        if (!track) return null;

        const isCurrent = index === position;

        return (
          <Pressable
            onPress={() => skipToPosition(index)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={[styles.index, isCurrent && styles.accent]}>
              {isCurrent ? '▶' : index + 1}
            </Text>
            <View style={styles.text}>
              <Text numberOfLines={1} style={[styles.title, isCurrent && styles.accent]}>
                {track.title}
              </Text>
              <Text numberOfLines={1} style={styles.artist}>
                {track.artist ?? UNKNOWN_ARTIST}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  index: {
    ...typography.caption,
    width: 24,
    textAlign: 'center',
    // Tabular figures so the numbers form a straight column as they gain digits.
    fontVariant: ['tabular-nums'],
  },
  text: { flex: 1, gap: 2 },
  title: { ...typography.body, fontSize: 14 },
  artist: typography.caption,
  accent: { color: colors.accent },
  pressed: { opacity: 0.6 },
});
