import React from 'react';
import { Dimensions, FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlbumTile } from '@/components/AlbumTile';
import { EmptyState } from '@/components/EmptyState';
import { LibraryGate } from '@/components/LibraryGate';
import { ScreenHeader } from '@/components/ScreenHeader';
import { pluralise } from '@/src/format';
import { useLibrary } from '@/src/library';
import { colors, spacing } from '@/src/theme';

const COLUMNS = 2;
const GUTTER = spacing.lg;

/**
 * Computed once at module scope rather than per render. The app is portrait-locked, so the
 * window width cannot change under us — and every tile must agree on this number or the
 * columns drift apart.
 */
const TILE_SIZE = (Dimensions.get('window').width - GUTTER * (COLUMNS + 1)) / COLUMNS;

export default function AlbumsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { albums } = useLibrary();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Albums" subtitle={pluralise(albums.length, 'album')} />

      <LibraryGate>
        {albums.length === 0 ? (
          <EmptyState
            icon="albums-outline"
            title="No albums yet"
            message="Albums are grouped from the tags on your audio files."
          />
        ) : (
          <FlatList
            data={albums}
            keyExtractor={(item) => item.id}
            numColumns={COLUMNS}
            columnWrapperStyle={styles.column}
            contentContainerStyle={styles.listContent}
            initialNumToRender={8}
            windowSize={9}
            removeClippedSubviews
            renderItem={({ item }) => (
              <AlbumTile
                album={item}
                size={TILE_SIZE}
                onPress={() => router.push(`/album/${encodeURIComponent(item.id)}`)}
              />
            )}
          />
        )}
      </LibraryGate>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  listContent: { paddingHorizontal: GUTTER, paddingBottom: spacing.xl, gap: spacing.xl },
  column: { gap: GUTTER },
});
