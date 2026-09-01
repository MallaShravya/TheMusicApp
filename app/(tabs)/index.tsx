import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { LibraryGate } from '@/components/LibraryGate';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SearchField } from '@/components/SearchField';
import { TrackRow, TRACK_ROW_HEIGHT } from '@/components/TrackRow';
import { useTrackActions } from '@/components/TrackActions';
import { pluralise } from '@/src/format';
import { useLibrary } from '@/src/library';
import { usePlayer } from '@/src/player/PlayerProvider';
import { colors, spacing } from '@/src/theme';
import type { Track } from '@/src/model';

function matches(track: Track, needle: string): boolean {
  return (
    track.title.toLowerCase().includes(needle) ||
    (track.artist?.toLowerCase().includes(needle) ?? false) ||
    (track.album?.toLowerCase().includes(needle) ?? false)
  );
}

export default function SongsScreen() {
  const insets = useSafeAreaInsets();
  const { tracks, refresh } = useLibrary();
  const { playQueue, shufflePlay, currentTrack, isPlaying } = usePlayer();
  const { openAddToPlaylist } = useTrackActions();

  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return tracks;
    return tracks.filter((track) => matches(track, needle));
  }, [query, tracks]);

  const renderItem = useCallback(
    ({ item, index }: { item: Track; index: number }) => (
      <TrackRow
        track={item}
        index={index}
        isCurrent={currentTrack?.id === item.id}
        isPlaying={isPlaying}
        onPress={() => playQueue(visible, index)}
        onMenuPress={() => openAddToPlaylist([item.id])}
      />
    ),
    [currentTrack?.id, isPlaying, openAddToPlaylist, playQueue, visible],
  );

  // Rows are a fixed height, so the list can skip measurement entirely — the difference is
  // very visible on libraries of a few thousand tracks.
  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: TRACK_ROW_HEIGHT,
      offset: TRACK_ROW_HEIGHT * index,
      index,
    }),
    [],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Songs"
        subtitle={pluralise(tracks.length, 'track')}
        actions={[
          {
            icon: searching ? 'close' : 'search',
            accessibilityLabel: searching ? 'Close search' : 'Search songs',
            onPress: () => {
              setSearching((s) => !s);
              setQuery('');
            },
          },
          {
            icon: 'shuffle',
            accessibilityLabel: 'Shuffle all songs',
            // Shuffles whatever is currently listed, so a search narrows what gets played.
            onPress: () => shufflePlay(visible),
          },
          {
            icon: 'refresh',
            accessibilityLabel: 'Rescan library',
            onPress: () => void refresh(),
          },
        ]}
      />

      {searching ? (
        <SearchField value={query} onChangeText={setQuery} placeholder="Title, artist or album" />
      ) : null}

      <LibraryGate>
        {visible.length === 0 ? (
          <EmptyState
            icon={query ? 'search-outline' : 'musical-notes-outline'}
            title={query ? 'No matches' : 'No music found'}
            message={
              query
                ? `Nothing in your library matches “${query}”.`
                : 'Ratio scans the audio files stored on this device. Copy some music over, then rescan.'
            }
            actionLabel={query ? undefined : 'Rescan'}
            onAction={query ? undefined : () => void refresh()}
          />
        ) : (
          <FlatList
            data={visible}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            getItemLayout={getItemLayout}
            initialNumToRender={14}
            windowSize={11}
            removeClippedSubviews
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
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
