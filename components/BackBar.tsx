import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { colors, spacing } from '@/src/theme';

/**
 * Back chevron for the pushed detail screens.
 *
 * Calls `router.back()` itself rather than taking an `onBack` prop — all five places that
 * rendered this wanted exactly that, and a prop would only invite one of them to differ.
 *
 * `alignSelf: flex-start` keeps the touch target the size of the icon rather than the full
 * screen width, so a tap on the right-hand side of the header does not navigate away.
 */
export function BackBar() {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
    >
      <Ionicons name="chevron-back" size={24} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignSelf: 'flex-start',
  },
  pressed: { opacity: 0.6 },
});
