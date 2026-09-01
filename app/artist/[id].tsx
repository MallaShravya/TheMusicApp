import React, { useCallback, useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { usePlayer } from '@/src/player/PlayerProvider';
import { colors, radius, spacing, typography } from '@/src/theme';

type AlbumSection = {
  albumId: string;
  title: string;
  year: number | null;
  data: Track[];
};

export default function ArtistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const artistId = decodeURIComponent(id ?? '');
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { artistById, albumById, trackById } = useLibrary();
  const { playQueue, currentTrack, isPlaying } = usePlayer();
  const { openAddToPlaylist } = useTrackActions();

  const artist = artistById.get(artistId);

  /**
   * An artist page reads as a discography, so tracks are grouped by album and each album gets
   * its own running order — rather than one flat alphabetical list, which would interleave
   * records and lose the shape of each one.
   */
  const sections = useMemo<AlbumSection[]>(() => {
    if (!artist) return [];

    const artistTrackIds = new Set(artist.trackIds);

    return artist.albumIds
      .map((albumId) => {
        const album = albumById.get(albumId);
        if (!album) return null;

        // An album can hold tracks by other artists (compilations, features), so it is
        // filtered down to this artist's before being shown on their page.
        const data = sortAlbumTracks(
          album.trackIds
            .filter((trackId) => artistTrackIds.has(trackId))
            .map((trackId) => trackById.get(trackId))
            .filter((track): track is Track => track != null),
        );

        return data.length > 0 ? { albumId, title: album.title, year: album.year, data } : null;
      })
      .filter((section): section is AlbumSection => section != null)
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title));
  }, [albumById, artist, trackById]);

  const allTracks = useMemo(() => sections.flatMap((section) => section.data), [sections]);

  // Tapping a track plays the whole discography from that point, not just its album.
  const playFrom = useCallback(
    (track: Track) => {
      const index = allTracks.findIndex((candidate) => candidate.id === track.id);
      playQueue(allTracks, Math.max(0, index));
    },
    [allTracks, playQueue],
  );

  if (!artist) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <BackBar />
        <EmptyState icon="people-outline" title="Artist not found" />
      </View>
    );
  }

  const totalDuration = allTracks.reduce((sum, track) => sum + track.durationMs, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <BackBar />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        // Album headers scroll away with their tracks; pinning them would leave a header for
        // a record whose songs are no longer on screen.
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.name}>{artist.name}</Text>
            <Text style={styles.meta}>
              {pluralise(allTracks.length, 'track')} · {pluralise(sections.length, 'album')} ·{' '}
              {formatTotalDuration(totalDuration)}
            </Text>

            <CollectionActions tracks={allTracks} />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Pressable
            style={({ pressed }) => [styles.sectionHeader, pressed && styles.pressed]}
            onPress={() => router.push(`/album/${encodeURIComponent(section.albumId)}`)}
          >
            <Artwork albumId={section.albumId} size={40} borderRadius={radius.sm} />
            <View style={styles.sectionText}>
              <Text numberOfLines={1} style={styles.sectionTitle}>
                {section.title}
              </Text>
              {section.year ? <Text style={styles.sectionMeta}>{section.year}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
          </Pressable>
        )}
        renderItem={({ item, index }) => (
          <TrackRow
            track={item}
            index={index}
            showArtwork={false}
            isCurrent={currentTrack?.id === item.id}
            isPlaying={isPlaying}
            onPress={() => playFrom(item)}
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
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.xs },
  name: typography.title,
  meta: typography.caption,
  pressed: { opacity: 0.7 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionText: { flex: 1, gap: 2 },
  sectionTitle: { ...typography.body, fontWeight: '600' },
  sectionMeta: typography.caption,
});
