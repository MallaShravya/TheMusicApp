import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { colors, spacing, typography } from '@/src/theme';

/**
 * Header of the Now Playing modal: dismiss, context, and what fills the stage below.
 *
 * A chevron *down* rather than back, because this screen is presented as a modal — the
 * gesture is "put it away", not "go up a level", and the icon should say which.
 */
export function TopBar({
  albumLabel,
  showQueue,
  onToggleQueue,
  showFire,
  onToggleFire,
}: {
  albumLabel: string;
  showQueue: boolean;
  onToggleQueue: () => void;
  showFire: boolean;
  onToggleFire: () => void;
}) {
  const router = useRouter();

  return (
    <View style={styles.bar}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close player"
      >
        <Ionicons name="chevron-down" size={26} color={colors.text} />
      </Pressable>

      <Text numberOfLines={1} style={styles.label}>
        {albumLabel}
      </Text>

      {/* Artwork and the visualiser occupy the same space, so this switches between them.
          Hidden while the queue is up, where it would control something not on screen. */}
      {showQueue ? null : (
        <Pressable
          onPress={onToggleFire}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={showFire ? 'Show artwork' : 'Show visualiser'}
          style={styles.action}
        >
          <Ionicons
            name={showFire ? 'image-outline' : 'flame-outline'}
            size={21}
            color={showFire ? colors.accent : colors.text}
          />
        </Pressable>
      )}

      <Pressable
        onPress={onToggleQueue}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={showQueue ? 'Hide queue' : 'Show queue'}
        style={styles.action}
      >
        <Ionicons
          // The icon shows what you get, not what you are looking at.
          name={showQueue ? 'musical-note' : 'list'}
          size={22}
          color={showQueue ? colors.accent : colors.text}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  label: { ...typography.caption, flex: 1, textAlign: 'center' },
  action: { marginLeft: spacing.xs },
});
