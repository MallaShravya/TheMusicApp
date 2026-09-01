import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Sheet } from '@/components/Sheet';
import { pluralise } from '@/src/format';
import type { Playlist } from '@/src/model';
import { colors, radius, spacing, typography } from '@/src/theme';

type Props = {
  visible: boolean;
  /** How many tracks are being filed, purely for the heading. */
  trackCount: number;
  playlists: Playlist[];
  onPick: (playlistId: string) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
};

/**
 * Presentational half of the add-to-playlist flow.
 *
 * Knows nothing about storage or which tracks are pending — it takes a list and reports which
 * one was chosen. The only state it owns is whether the create-new field is open and what has
 * been typed into it, both of which die with the sheet.
 */
export function AddToPlaylistSheet({
  visible,
  trackCount,
  playlists,
  onPick,
  onCreate,
  onClose,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  // Reset when the sheet closes, so reopening never shows a half-typed name from last time.
  const close = () => {
    setCreating(false);
    setName('');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close}>
      <Text style={styles.title}>Add {pluralise(trackCount, 'track')} to…</Text>

      {creating ? (
        <View style={styles.createRow}>
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
          <Pressable
            onPress={() => onCreate(name)}
            style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}
          >
            <Text style={styles.createButtonText}>Create</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => setCreating(true)}
          style={({ pressed }) => [styles.option, pressed && styles.pressed]}
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
          <Text style={[styles.optionText, { color: colors.accent }]}>New playlist</Text>
        </Pressable>
      )}

      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {playlists.length === 0 ? (
          <Text style={styles.hint}>You have no playlists yet.</Text>
        ) : (
          playlists.map((playlist) => (
            <Pressable
              key={playlist.id}
              onPress={() => onPick(playlist.id)}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            >
              <Ionicons name="list-outline" size={20} color={colors.textMuted} />
              <View style={styles.optionTextBlock}>
                <Text numberOfLines={1} style={styles.optionText}>
                  {playlist.name}
                </Text>
                <Text style={styles.optionMeta}>
                  {pluralise(playlist.trackIds.length, 'track')}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Pressable onPress={close} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.heading, fontSize: 17, marginBottom: spacing.xs },
  // `flexGrow: 0` so the list takes only the height it needs, leaving Cancel visible.
  list: { flexGrow: 0 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  optionTextBlock: { flex: 1, gap: 2 },
  optionText: typography.body,
  optionMeta: typography.caption,
  pressed: { opacity: 0.6 },
  hint: { ...typography.label, paddingVertical: spacing.md },
  createRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  createButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  createButtonText: { ...typography.body, color: '#FFFFFF', fontWeight: '600' },
  cancel: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  cancelText: { ...typography.body, color: colors.textMuted },
});
