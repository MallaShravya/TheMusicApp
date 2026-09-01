import React, { useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Artwork } from '@/components/Artwork';
import { Bonfire } from '@/components/Bonfire';
import { Starfield } from '@/components/Starfield';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SeekBar } from '@/components/SeekBar';
import { Queue, TopBar, TrackDetails, Transport } from '@/components/nowPlaying';
import { UNKNOWN_ALBUM } from '@/src/model';
import { usePlayer } from '@/src/player/PlayerProvider';
import { colors, radius, spacing, typography } from '@/src/theme';

/** Square, but never taller than it is wide on a narrow phone. */
const ART_SIZE = Math.min(Dimensions.get('window').width - spacing.xl * 2, 360);

export default function PlayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentTrack } = usePlayer();

  // Artwork, the visualiser and the queue all occupy the same space; these decide which.
  //
  // `showQueue` is local because it is a momentary view state — reopening the player should
  // not drop you back into a queue you were only glancing at. `showFire` is local for now
  // too, though it is the better candidate for persisting if it turns out people pick one and
  // stay there.
  const [showQueue, setShowQueue] = useState(false);
  const [showFire, setShowFire] = useState(false);

  // Reachable by deep link, or after `stop()` cleared the queue.
  if (!currentTrack) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.emptyText}>Nothing is playing.</Text>
        <Pressable onPress={() => router.back()} style={styles.emptyButton}>
          <Text style={styles.emptyButtonText}>Back to library</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* A soft wash behind the art gives the modal some depth without sampling colours out
          of the cover, which would mean decoding every image twice.

          Not behind the fire, though: the visualiser wants a black sky, and a violet cast
          over the stars makes them look like they are shining through dust. */}
      {showFire ? null : (
        <LinearGradient
          colors={[colors.accentSoft, 'transparent']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}

      <TopBar
        albumLabel={currentTrack.album ?? UNKNOWN_ALBUM}
        showQueue={showQueue}
        onToggleQueue={() => setShowQueue((shown) => !shown)}
        showFire={showFire}
        onToggleFire={() => setShowFire((shown) => !shown)}
      />

      {showQueue ? (
        <Queue />
      ) : showFire ? (
        // Mounted only while visible: the fire runs an animation frame loop, and leaving it
        // running behind the artwork would burn battery for nothing.
        <View style={styles.stage}>
          {/* Behind the fire, filling the band the letterboxed scene leaves above it. */}
          <ErrorBoundary label="Starfield">
            <Starfield />
          </ErrorBoundary>
          <ErrorBoundary label="Visualiser">
            <Bonfire track={currentTrack} />
          </ErrorBoundary>
          <Pressable
            onPress={() => router.push('/flame-settings')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Visualiser settings"
            style={({ pressed }) => [styles.tune, pressed && styles.tunePressed]}
          >
            <Ionicons name="options-outline" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.stage}>
          <Artwork albumId={currentTrack.albumId} size={ART_SIZE} borderRadius={radius.lg} />
        </View>
      )}

      {/* Details, scrubber and transport stay put whichever view is above them, so the
          controls never move under the user's thumb when toggling the queue. */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
        <TrackDetails track={currentTrack} />
        <SeekBar />
        <Transport />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  emptyText: typography.label,
  emptyButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  emptyButtonText: { ...typography.body, color: '#FFFFFF', fontWeight: '600' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
  tune: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.md,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  tunePressed: { opacity: 0.6 },
  bottom: { paddingHorizontal: spacing.xl, gap: spacing.lg },
});
