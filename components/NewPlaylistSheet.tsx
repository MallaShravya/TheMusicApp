import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/src/theme';

import { Sheet } from './Sheet';

/**
 * Name-a-new-playlist dialog.
 *
 * Was a hand-rolled `Modal` with its own backdrop and card, duplicating the add-to-playlist
 * sheet. Now it is just the contents; `Sheet` owns the presentation.
 *
 * An empty name is allowed through rather than blocked — `buildPlaylist` turns it into
 * "Untitled playlist". Refusing to submit would leave the user staring at a dead button with
 * no explanation.
 */
export function NewPlaylistSheet({
  visible,
  onCreate,
  onClose,
}: {
  visible: boolean;
  onCreate: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');

  // Clear on open so a dismissed attempt does not leave its half-typed name behind.
  useEffect(() => {
    if (visible) setName('');
  }, [visible]);

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>New playlist</Text>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Playlist name"
        placeholderTextColor={colors.textFaint}
        style={styles.input}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => onCreate(name)}
      />

      <View style={styles.actions}>
        <Pressable onPress={onClose} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() => onCreate(name)}
          style={({ pressed }) => [styles.button, styles.buttonPrimary, pressed && styles.pressed]}
        >
          <Text style={[styles.buttonText, styles.buttonTextPrimary]}>Create</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.heading, fontSize: 17 },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 15,
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  button: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md },
  buttonPrimary: { backgroundColor: colors.accent },
  pressed: { opacity: 0.6 },
  buttonText: { ...typography.body, color: colors.textMuted },
  buttonTextPrimary: { color: '#FFFFFF', fontWeight: '600' },
});
