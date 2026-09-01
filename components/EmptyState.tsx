import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, typography } from '@/src/theme';

type Props = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon, title, message, actionLabel, onAction }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.iconRing}>
        <Ionicons name={icon} size={28} color={colors.textMuted} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  iconRing: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...typography.heading, textAlign: 'center' },
  message: {
    ...typography.label,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  action: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  actionPressed: { opacity: 0.8 },
  actionText: { ...typography.body, color: '#FFFFFF', fontWeight: '600' },
});
