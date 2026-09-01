import React, { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { NavRow } from '@/components/NavRow';
import { NewPlaylistSheet } from '@/components/NewPlaylistSheet';
import { ScreenHeader } from '@/components/ScreenHeader';
import { pluralise } from '@/src/format';
import type { Playlist } from '@/src/model';
import { usePlaylists } from '@/src/storage/PlaylistProvider';
import { colors, spacing } from '@/src/theme';

export default function PlaylistsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { playlists, favouriteIds, createPlaylist, deletePlaylist } = usePlaylists();

  const [composing, setComposing] = useState(false);

  const handleCreate = useCallback(
    async (name: string) => {
      const created = await createPlaylist(name);
      setComposing(false);
      // Straight into the new playlist: it is empty, and the next thing you want is to fill it.
      router.push(`/playlist/${created.id}`);
    },
    [createPlaylist, router],
  );

  // Long-press rather than a visible delete button — destructive, and rarely wanted.
  const confirmDelete = useCallback(
    (playlist: Playlist) => {
      Alert.alert('Delete playlist', `Delete “${playlist.name}”? The tracks themselves stay.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void deletePlaylist(playlist.id) },
      ]);
    },
    [deletePlaylist],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Playlists"
        actions={[
          {
            icon: 'add',
            accessibilityLabel: 'New playlist',
            onPress: () => setComposing(true),
          },
        ]}
      />

      {/* Favourites is derived from the favourite flag rather than stored as a playlist, so it
          is pinned above the user's own lists instead of living in the same array. */}
      <NavRow
        icon="heart"
        accent
        title="Favourites"
        subtitle={pluralise(favouriteIds.size, 'track')}
        onPress={() => router.push('/playlist/favourites')}
      />

      <View style={styles.divider} />

      {playlists.length === 0 ? (
        <EmptyState
          icon="list-outline"
          title="No playlists yet"
          message="Create one here, or add tracks to a new playlist from the ··· menu on any song."
          actionLabel="New playlist"
          onAction={() => setComposing(true)}
        />
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <NavRow
              icon="list"
              title={item.name}
              subtitle={pluralise(item.trackIds.length, 'track')}
              onPress={() => router.push(`/playlist/${item.id}`)}
              onLongPress={() => confirmDelete(item)}
            />
          )}
        />
      )}

      <NewPlaylistSheet
        visible={composing}
        onCreate={(name) => void handleCreate(name)}
        onClose={() => setComposing(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
  },
  listContent: { paddingBottom: spacing.xl },
});
