import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, typography } from '@/src/theme';

type Props = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  /** `primary` is the accent-filled one. Exactly one per row. */
  variant?: 'primary' | 'secondary';
};

/**
 * The Play / Shuffle pair that heads every collection screen.
 *
 * Was copy-pasted three times — album, artist and playlist each carried their own identical
 * `primary`/`secondary` style blocks. Three copies means three places to miss when the accent
 * colour or the pill radius changes.
 */
export function ActionButton({ label, icon, onPress, variant = 'secondary' }: Props) {
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={18} color={isPrimary ? '#FFFFFF' : colors.text} />
      <Text style={[styles.label, isPrimary && styles.labelPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.surface },
  pressed: { opacity: 0.7 },
  label: { ...typography.body, fontWeight: '600' },
  labelPrimary: { color: '#FFFFFF' },
});
