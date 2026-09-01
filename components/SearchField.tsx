import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing } from '@/src/theme';

/**
 * The inline search box that drops in under a screen header.
 *
 * `autoFocus` is deliberate: the field only exists once the user has tapped search, so the
 * keyboard should already be up — making them tap twice to start typing would be a wasted step.
 */
export function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="search" size={16} color={colors.textFaint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        style={styles.input}
        autoFocus
        returnKeyType="search"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  input: { flex: 1, paddingVertical: spacing.md, color: colors.text, fontSize: 15 },
});
