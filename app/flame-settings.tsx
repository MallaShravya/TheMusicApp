import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Slider } from '@/components/Slider';
import { colors, radius, spacing, typography } from '@/src/theme';
import {
  FLAME_SETTING_RANGES,
  MIN_BRIGHTNESS,
  SYSTEM_BRIGHTNESS,
  useFlameSettings,
} from '@/src/visualiser';

/**
 * Tuning for the visualiser.
 *
 * No live preview yet: this is a full sheet over the player, so the fire is hidden while it
 * is open. Changes apply immediately and are visible the moment it closes. Making it a
 * transparent sheet over the player's own fire is a separate change.
 *
 * Screen brightness sits here rather than with the flame geometry because it is a property
 * of the device, not of the fire — and it is the one setting whose effect cannot be drawn.
 *
 * Every control is generated from `FLAME_SETTING_RANGES`, so adding a parameter to the
 * visualiser puts a slider here with no edit to this file.
 */
export default function FlameSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, set, reset, screenBrightness, setScreenBrightness } = useFlameSettings();

  const confirmReset = () => {
    Alert.alert('Reset visualiser', 'Put every setting back to its default?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: reset },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="chevron-down" size={26} color={colors.text} />
        </Pressable>

        <Text style={styles.title}>Visualiser</Text>

        <Pressable
          onPress={confirmReset}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Reset to defaults"
        >
          <Ionicons name="refresh" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.controls}
        contentContainerStyle={[
          styles.controlsContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        // The sliders are gestures too; without this the scroll view steals the drag.
        keyboardShouldPersistTaps="handled"
      >
        {FLAME_SETTING_RANGES.map((range) => (
          <Slider
            key={range.key}
            label={range.label}
            value={settings[range.key]}
            min={range.min}
            max={range.max}
            step={range.step}
            decimals={range.decimals}
            onChange={(value) => set(range.key, value)}
          />
        ))}

        <View style={styles.brightness}>
          <Slider
            label="Screen brightness"
            value={screenBrightness < MIN_BRIGHTNESS ? MIN_BRIGHTNESS - 0.05 : screenBrightness}
            min={MIN_BRIGHTNESS - 0.05}
            max={1}
            step={0.05}
            decimals={2}
            onChange={(value) =>
              setScreenBrightness(value < MIN_BRIGHTNESS ? SYSTEM_BRIGHTNESS : value)
            }
          />
          <Text style={styles.brightnessHint}>
            {screenBrightness === SYSTEM_BRIGHTNESS
              ? 'Off — the screen stays wherever you have it.'
              : 'The screen brightens for the fire and goes back when you leave it.'}
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  title: { ...typography.body, fontWeight: '600', flex: 1, textAlign: 'center' },
  controls: { flex: 1, marginTop: spacing.md },
  controlsContent: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  brightness: { gap: spacing.xs, marginTop: spacing.sm },
  brightnessHint: { ...typography.caption, lineHeight: 16 },
});
