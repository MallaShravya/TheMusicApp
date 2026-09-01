import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, radius, spacing, typography } from '@/src/theme';

/**
 * Placeholder for the math-based generator.
 *
 * The plumbing it will need already exists: generated tracks have a `source` of
 * `generated` in the library model, and `src/generator/store.ts` persists them so they
 * appear in Songs, queues, and playlists next to scanned files. What is missing is the
 * synthesis itself — the part that turns a recipe into a WAV on disk.
 */
const PLANNED = [
  {
    icon: 'grid-outline' as const,
    title: 'Pitch from a sequence',
    body: 'Map an integer sequence onto scale degrees — Collatz, primes, digits of an irrational, a linear congruential generator — and let the shape of the numbers pick the notes.',
  },
  {
    icon: 'pulse-outline' as const,
    title: 'Rhythm from ratios',
    body: 'Euclidean rhythms distribute k onsets over n steps as evenly as possible, which is where a surprising amount of real-world percussion actually comes from.',
  },
  {
    icon: 'options-outline' as const,
    title: 'Timbre from synthesis',
    body: 'Additive and FM synthesis rendered sample by sample, with an ADSR envelope so notes start and stop without clicking.',
  },
  {
    icon: 'save-outline' as const,
    title: 'Rendered to a real file',
    body: 'Each piece is written as a WAV into app storage and registered as a library track, so it plays through exactly the same queue and lock-screen controls as everything else.',
  },
];

export default function GenerateScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Generate" subtitle="Not built yet" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.banner}>
          <Ionicons name="color-wand-outline" size={22} color={colors.accent} />
          <Text style={styles.bannerText}>
            The player is finished. This is where math-driven composition will live — the
            library already treats generated tracks as first-class, so the generator only has
            to produce audio.
          </Text>
        </View>

        {PLANNED.map((item) => (
          <View key={item.title} style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name={item.icon} size={18} color={colors.textMuted} />
              <Text style={styles.cardTitle}>{item.title}</Text>
            </View>
            <Text style={styles.cardBody}>{item.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  banner: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  bannerText: { ...typography.label, flex: 1, lineHeight: 20, color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { ...typography.body, fontWeight: '600' },
  cardBody: { ...typography.label, lineHeight: 20 },
});
