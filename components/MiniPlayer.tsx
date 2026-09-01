import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { usePlaybackProgress, usePlayer } from '@/src/player/PlayerProvider';
import { colors, MINI_PLAYER_HEIGHT, radius, spacing, typography } from '@/src/theme';
import { UNKNOWN_ARTIST } from '@/src/model';

import { Artwork } from './Artwork';

/**
 * Split out so the twice-a-second progress tick re-renders two pixels of bar rather than
 * the whole mini player.
 */
const ProgressBar = memo(function ProgressBar() {
  const { currentTime, duration } = usePlaybackProgress();
  const ratio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
    </View>
  );
});

export function MiniPlayer() {
  const router = useRouter();
  const { currentTrack, isPlaying, toggle, next } = usePlayer();

  if (!currentTrack) return null;

  return (
    <View style={styles.wrapper}>
      <ProgressBar />
      <Pressable
        style={styles.body}
        onPress={() => router.push('/player')}
        android_ripple={{ color: colors.surfaceRaised }}
      >
        <Artwork albumId={currentTrack.albumId} size={40} borderRadius={radius.sm} />

        <View style={styles.text}>
          <Text numberOfLines={1} style={styles.title}>
            {currentTrack.title}
          </Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            {currentTrack.artist ?? UNKNOWN_ARTIST}
          </Text>
        </View>

        <Pressable onPress={toggle} hitSlop={12} style={styles.control}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color={colors.text} />
        </Pressable>
        <Pressable onPress={next} hitSlop={12} style={styles.control}>
          <Ionicons name="play-skip-forward" size={20} color={colors.text} />
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  progressTrack: {
    height: 2,
    backgroundColor: colors.border,
  },
  progressFill: {
    height: 2,
    backgroundColor: colors.accent,
  },
  body: {
    height: MINI_PLAYER_HEIGHT - 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  text: { flex: 1, gap: 2 },
  title: { ...typography.body, fontSize: 14 },
  subtitle: { ...typography.caption },
  control: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
