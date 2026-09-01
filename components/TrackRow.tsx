import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatDuration } from '@/src/format';
import { colors, radius, spacing, typography } from '@/src/theme';
import { UNKNOWN_ARTIST, type Track } from '@/src/model';

import { Artwork } from './Artwork';

type Props = {
  track: Track;
  onPress: () => void;
  onMenuPress?: () => void;
  /** Draws the row in the accent colour and shows an equaliser glyph. */
  isCurrent?: boolean;
  isPlaying?: boolean;
  /** Album and playlist views show positions instead of covers. */
  index?: number;
  showArtwork?: boolean;
};

export const TRACK_ROW_HEIGHT = 64;

function TrackRowComponent({
  track,
  onPress,
  onMenuPress,
  isCurrent = false,
  isPlaying = false,
  index,
  showArtwork = true,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      android_ripple={{ color: colors.surfaceRaised }}
    >
      {showArtwork ? (
        <Artwork albumId={track.albumId} size={44} borderRadius={radius.sm} />
      ) : (
        <View style={styles.indexBox}>
          {isCurrent ? (
            <Ionicons
              name={isPlaying ? 'volume-medium' : 'pause'}
              size={16}
              color={colors.accent}
            />
          ) : (
            <Text style={styles.indexText}>{index != null ? index + 1 : '–'}</Text>
          )}
        </View>
      )}

      <View style={styles.text}>
        <Text
          numberOfLines={1}
          style={[styles.title, isCurrent && styles.titleCurrent]}
        >
          {track.title}
        </Text>
        <Text numberOfLines={1} style={styles.subtitle}>
          {track.artist ?? UNKNOWN_ARTIST}
          {track.source === 'generated' ? '  ·  Generated' : ''}
        </Text>
      </View>

      <Text style={styles.duration}>{formatDuration(track.durationMs)}</Text>

      {onMenuPress ? (
        <Pressable
          onPress={onMenuPress}
          hitSlop={10}
          style={({ pressed }) => [styles.menu, pressed && styles.rowPressed]}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

/**
 * Rows are the hot path when scrolling thousands of tracks, so re-render only when
 * something visible actually changed.
 */
export const TrackRow = memo(
  TrackRowComponent,
  (prev, next) =>
    prev.track.id === next.track.id &&
    prev.isCurrent === next.isCurrent &&
    prev.isPlaying === next.isPlaying &&
    prev.index === next.index &&
    prev.showArtwork === next.showArtwork,
);

const styles = StyleSheet.create({
  row: {
    height: TRACK_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  rowPressed: { opacity: 0.6 },
  indexBox: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: { ...typography.label, color: colors.textFaint, fontVariant: ['tabular-nums'] },
  text: { flex: 1, gap: 2 },
  title: { ...typography.body },
  titleCurrent: { color: colors.accent, fontWeight: '600' },
  subtitle: { ...typography.caption },
  duration: {
    ...typography.caption,
    fontVariant: ['tabular-nums'],
  },
  menu: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
