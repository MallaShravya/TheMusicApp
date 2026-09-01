import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { usePlayer } from '@/src/player/PlayerProvider';
import { colors, spacing } from '@/src/theme';

/**
 * The transport row: shuffle, previous, play/pause, next, repeat.
 *
 * Play/pause is the only filled control, and the largest — it is the one you reach for
 * without looking. The two modal toggles sit at the outer edges, where they are least likely
 * to be hit by accident while skipping.
 */
export function Transport() {
  const { isPlaying, toggle, next, previous, shuffle, toggleShuffle, repeat, cycleRepeat } =
    usePlayer();

  return (
    <View style={styles.row}>
      <Pressable
        onPress={toggleShuffle}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={shuffle ? 'Turn shuffle off' : 'Turn shuffle on'}
      >
        <Ionicons name="shuffle" size={22} color={shuffle ? colors.accent : colors.textMuted} />
      </Pressable>

      <Pressable
        onPress={previous}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Previous track"
      >
        <Ionicons name="play-skip-back" size={30} color={colors.text} />
      </Pressable>

      <Pressable
        onPress={toggle}
        style={styles.playButton}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
      >
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={30}
          color="#FFFFFF"
          // The play triangle's visual centre sits left of its bounding box, so it needs a
          // nudge to look centred in the circle. Pause is symmetrical and does not.
          style={isPlaying ? undefined : styles.playGlyphNudge}
        />
      </Pressable>

      <Pressable
        onPress={next}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Next track"
      >
        <Ionicons name="play-skip-forward" size={30} color={colors.text} />
      </Pressable>

      <Pressable
        onPress={cycleRepeat}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Repeat ${repeat}`}
      >
        <Ionicons
          name={repeat === 'one' ? 'repeat-outline' : 'repeat'}
          size={22}
          color={repeat === 'off' ? colors.textMuted : colors.accent}
        />
        {/* Ionicons has no repeat-one glyph, so a dot distinguishes it from repeat-all. */}
        {repeat === 'one' ? <View style={styles.repeatDot} /> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  playButton: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyphNudge: { marginLeft: 3 },
  repeatDot: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
});
