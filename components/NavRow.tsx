import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, typography } from '@/src/theme';

type Props = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
  onLongPress?: () => void;
  /** Circles read as people; rounded squares read as containers. */
  iconShape?: 'circle' | 'square';
  /** Tints the icon and its backing — used to pin Favourites above the ordinary rows. */
  accent?: boolean;
};

/**
 * A tappable row that navigates somewhere: icon, two lines of text, chevron.
 *
 * Artists and playlists had written this out separately — three copies once Favourites is
 * counted — with identical layout and only the icon differing. The chevron matters: it is the
 * one signal that a row leads somewhere rather than doing something, so it belongs to this
 * component rather than being remembered at each call site.
 */
export function NavRow({
  icon,
  title,
  subtitle,
  onPress,
  onLongPress,
  iconShape = 'square',
  accent = false,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      android_ripple={{ color: colors.surfaceRaised }}
    >
      <View
        style={[
          styles.icon,
          iconShape === 'circle' ? styles.iconCircle : styles.iconSquare,
          accent && styles.iconAccent,
        ]}
      >
        <Ionicons name={icon} size={20} color={accent ? colors.accent : colors.textFaint} />
      </View>

      <View style={styles.text}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.6 },
  icon: {
    width: 44,
    height: 44,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: { borderRadius: radius.pill },
  iconSquare: { borderRadius: radius.md },
  iconAccent: { backgroundColor: colors.accentSoft },
  text: { flex: 1, gap: 2 },
  title: typography.body,
  subtitle: typography.caption,
});
