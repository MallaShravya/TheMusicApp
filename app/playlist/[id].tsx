import React, { useCallback, useMemo } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackBar } from '@/components/BackBar';
import { CollectionActions } from '@/components/CollectionActions';
import { EmptyState } from '@/components/EmptyState';
import { TrackRow } from '@/components/TrackRow';
import { formatTotalDuration, pluralise } from '@/src/format';
import { useLibrary } from '@/src/library';
import type { Track } from '@/src/model';
import { usePlayer } from '@/src/player/PlayerProvider';
import { usePlaylists } from '@/src/storage/PlaylistProvider';
import { colors, spacing, typography } from '@/src/theme';

/** Favourites is a real screen but not a stored playlist, so it gets a reserved id. */
const FAVOURITES_ID = 'favourites';

export default function PlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const playlistId = id ?? '';
  const insets = useSafeAreaInsets();

  const { trackById } = useLibrary();
  const { playQueue, currentTrack, isPlaying } = usePlayer();
  const { playlists, favouriteIds, removeFromPlaylist, toggleFavourite } = usePlaylists();

  const isFavourites = playlistId === FAVOURITES_ID;
  const playlist = isFavourites ? null : playlists.find((entry) => entry.id === playlistId);

  const trackIds = useMemo(
    () => (isFavourites ? [...favouriteIds] : (playlist?.trackIds ?? [])),
    [favouriteIds, isFavourites, playlist?.trackIds],
  );

  /**
   * Stored ids can outlive the files they point at — a track deleted from the device leaves a
   * dangling id behind. Resolving through the library and dropping the misses keeps the list
   * honest without needing a migration, and the count of what went missing is shown below.
   */
  const tracks = useMemo(
    () =>
      trackIds
        .map((trackId) => trackById.get(trackId))
        .filter((track): track is Track => track != null),
    [trackById, trackIds],
  );

  const missingCount = trackIds.length - tracks.length;
  const totalDuration = tracks.reduce((sum, track) => sum + track.durationMs, 0);

  // The ··· menu means "remove from this collection", which is un-favouriting on the
  // favourites screen and a destructive edit on a real playlist — hence only one confirms.
  const handleRemove = useCallback(
    (track: Track) => {
      if (isFavourites) {
        void toggleFavourite(track.id);
        return;
      }

      Alert.alert('Remove track', `Remove “${track.title}” from this playlist?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => void removeFromPlaylist(playlistId, track.id),
        },
      ]);
    },
    [isFavourites, playlistId, removeFromPlaylist, toggleFavourite],
  );

  if (!isFavourites && !playlist) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <BackBar />
        <EmptyState icon="list-outline" title="Playlist not found" />
      </View>
    );
  }

  const title = isFavourites ? 'Favourites' : (playlist?.name ?? 'Playlist');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <BackBar />

      {tracks.length === 0 ? (
        <EmptyState
          icon={isFavourites ? 'heart-outline' : 'list-outline'}
          title={isFavourites ? 'No favourites yet' : 'This playlist is empty'}
          message={
            isFavourites
              ? 'Tap the heart on the Now Playing screen to keep a track here.'
              : 'Use the ··· menu on any song to add it to this playlist.'
          }
        />
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.meta}>
                {pluralise(tracks.length, 'track')} · {formatTotalDuration(totalDuration)}
                {missingCount > 0 ? ` · ${missingCount} missing` : ''}
              </Text>

              <CollectionActions tracks={tracks} />
            </View>
          }
          renderItem={({ item, index }) => (
            <TrackRow
              track={item}
              index={index}
              isCurrent={currentTrack?.id === item.id}
              isPlaying={isPlaying}
              onPress={() => playQueue(tracks, index)}
              onMenuPress={() => handleRemove(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  listContent: { paddingBottom: spacing.xxl },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.xs },
  title: typography.title,
  meta: typography.caption,
});
