import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatDuration } from '@/src/format';
import { usePlaybackProgress, usePlayer } from '@/src/player/PlayerProvider';
import { colors, spacing, typography } from '@/src/theme';

import { progressRatio, thumbOffset } from './seekGeometry';
import { useScrubGesture } from './useScrubGesture';

const TRACK_HEIGHT = 4;
const THUMB_SIZE = 14;

/**
 * Draggable playback position, with elapsed and remaining time.
 *
 * Rendering only — the arithmetic is in `seekGeometry`, the gesture in `useScrubGesture`.
 * While a drag is in progress the bar shows the finger's position rather than the player's,
 * which is what stops the thumb fighting the status tick.
 */
export function SeekBar() {
  const { currentTime, duration } = usePlaybackProgress();
  const { seekTo } = usePlayer();

  const { panHandlers, onLayout, width, scrubTime } = useScrubGesture(duration, seekTo);

  const shown = scrubTime ?? currentTime;
  const ratio = progressRatio(shown, duration);
  const remaining = Math.max(0, duration - shown);

  return (
    <View style={styles.container}>
      {/* Taller than the visible bar so the touch target is reachable with a thumb. */}
      <View style={styles.hitArea} onLayout={onLayout} {...panHandlers}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
        </View>
        <View style={[styles.thumb, { left: thumbOffset(ratio, width, THUMB_SIZE) }]} />
      </View>

      <View style={styles.times}>
        <Text style={styles.time}>{formatDuration(shown * 1000)}</Text>
        <Text style={styles.time}>-{formatDuration(remaining * 1000)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  hitArea: { height: 28, justifyContent: 'center' },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: { height: TRACK_HEIGHT, backgroundColor: colors.accent },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.text,
  },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  // Tabular figures so the elapsed time does not jitter as digits change width.
  time: { ...typography.caption, fontVariant: ['tabular-nums'] },
});
