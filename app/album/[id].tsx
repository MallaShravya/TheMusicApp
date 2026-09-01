import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Artwork } from '@/components/Artwork';
import { BackBar } from '@/components/BackBar';
import { CollectionActions } from '@/components/CollectionActions';
import { EmptyState } from '@/components/EmptyState';
import { TrackRow } from '@/components/TrackRow';
import { useTrackActions } from '@/components/TrackActions';
import { formatTotalDuration, pluralise } from '@/src/format';
import { sortAlbumTracks, useLibrary } from '@/src/library';
import type { Track } from '@/src/model';
import { UNKNOWN_ARTIST } from '@/src/model';
import { usePlayer } from '@/src/player/PlayerProvider';
import { colors, radius, spacing, typography } from '@/src/theme';

export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const albumId = decodeURIComponent(id ?? '');
  const insets = useSafeAreaInsets();

  const { albumById, trackById } = useLibrary();
  const { playQueue, currentTrack, isPlaying } = usePlayer();
  const { openAddToPlaylist } = useTrackActions();

  const album = albumById.get(albumId);

  const tracks = useMemo(() => {
    if (!album) return [];
    const resolved = album.trackIds
      .map((trackId) => trackById.get(trackId))
      .filter((track): track is Track => track != null);
    return sortAlbumTracks(resolved);
  }, [album, trackById]);

  if (!album) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <BackBar />
        <EmptyState icon="albums-outline" title="Album not found" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <BackBar />

      <FlatList
        data={tracks}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Artwork albumId={album.id} size={168} borderRadius={radius.md} />
            <Text style={styles.title}>{album.title}</Text>
            <Text style={styles.subtitle}>
              {album.artist ?? UNKNOWN_ARTIST}
              {album.year ? ` · ${album.year}` : ''}
            </Text>
            <Text style={styles.meta}>
              {pluralise(tracks.length, 'track')} · {formatTotalDuration(album.durationMs)}
            </Text>

            <CollectionActions tracks={tracks} />
          </View>
        }
        renderItem={({ item, index }) => (
          <TrackRow
            track={item}
            index={index}
            // Position within the album is more useful here than a repeat of the same cover.
            showArtwork={false}
            isCurrent={currentTrack?.id === item.id}
            isPlaying={isPlaying}
            onPress={() => playQueue(tracks, index)}
            onMenuPress={() => openAddToPlaylist([item.id])}
          />
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  listContent: { paddingBottom: spacing.xxl },
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  title: { ...typography.heading, textAlign: 'center', marginTop: spacing.lg },
  subtitle: { ...typography.label, textAlign: 'center' },
  meta: { ...typography.caption, marginTop: 2 },
});
