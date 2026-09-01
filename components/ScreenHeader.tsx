import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, typography } from '@/src/theme';

type Action = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  accessibilityLabel: string;
};

export function ScreenHeader({
  title,
  subtitle,
  actions = [],
}: {
  title: string;
  subtitle?: string;
  actions?: Action[];
}) {
  return (
    <View style={styles.header}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {actions.map((action) => (
        <Pressable
          key={action.accessibilityLabel}
          onPress={action.onPress}
          hitSlop={10}
          accessibilityLabel={action.accessibilityLabel}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Ionicons name={action.icon} size={20} color={colors.text} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  titleBlock: { flex: 1, gap: 2 },
  title: typography.title,
  subtitle: typography.label,
  action: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPressed: { opacity: 0.6 },
});
