import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { LibraryGate } from '@/components/LibraryGate';
import { NavRow } from '@/components/NavRow';
import { ScreenHeader } from '@/components/ScreenHeader';
import { pluralise } from '@/src/format';
import { useLibrary } from '@/src/library';
import { colors, spacing } from '@/src/theme';

export default function ArtistsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { artists } = useLibrary();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Artists" subtitle={pluralise(artists.length, 'artist')} />

      <LibraryGate>
        {artists.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No artists yet"
            message="Artists are grouped by name from your file tags."
          />
        ) : (
          <FlatList
            data={artists}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            initialNumToRender={14}
            removeClippedSubviews
            renderItem={({ item }) => (
              <NavRow
                icon="person"
                iconShape="circle"
                title={item.name}
                subtitle={`${pluralise(item.trackIds.length, 'track')} · ${pluralise(
                  item.albumIds.length,
                  'album',
                )}`}
                // The artist id is a lowercased name, so it must be encoded — real names
                // contain slashes, question marks and hashes.
                onPress={() => router.push(`/artist/${encodeURIComponent(item.id)}`)}
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
  listContent: { paddingBottom: spacing.xl },
});
