import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhraseChips } from '@/components/generate/PhraseChips';
import { PhraseVisuals } from '@/components/generate/PhraseVisuals';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Slider } from '@/components/Slider';
import { phraseToSargam, randomPhrase, stepHistogram } from '@/src/generator/randomNotes';
import { DEFAULT_RECIPE, pitchClassesOf, rangeOf, type Recipe } from '@/src/generator/recipe';
import { renderRecipe } from '@/src/generator/renderToFile';
import { useSavePiece } from '@/src/generator/useSavePiece';
import { usePlayer } from '@/src/player/PlayerProvider';
import { colors, radius, spacing, typography } from '@/src/theme';

/**
 * The generator.
 *
 * The same controls as the browser preview, at a size a thumb can use. Everything it produces
 * comes from `src/generator`, so a phrase heard here is the phrase that was tuned there — the
 * difference is only that this one has to make a file, since React Native has no Web Audio and
 * the app plays audio by playing files.
 *
 * Rendering is why Play takes a moment. A hundred and twenty beats at 360 is twenty seconds of
 * audio synthesised in JavaScript; it is fast enough to wait for and slow enough to say so.
 */
export default function GenerateScreen() {
  const insets = useSafeAreaInsets();
  const { playQueue } = usePlayer();
  const { save, state: saveState, error: saveError } = useSavePiece();

  const [recipe, setRecipe] = useState<Recipe>(DEFAULT_RECIPE);
  const [rendering, setRendering] = useState(false);

  const set = useCallback(<K extends keyof Recipe>(key: K, value: Recipe[K]) => {
    setRecipe((current) => ({ ...current, [key]: value }));
  }, []);

  const generate = useCallback(() => {
    setRecipe((current) => {
      const { lowest, highest } = rangeOf(current.span);
      const tokens = randomPhrase({
        count: current.count,
        lowest,
        highest,
        anchorEvery: current.anchorEvery,
        midpointAnchor: current.midpointAnchor,
        holdChance: current.holdChance,
        restChance: current.restChance,
        loopBacks: current.loopBacks,
        stepWeights: current.stepWeights,
        allowedPitchClasses: pitchClassesOf(current),
      });
      return { ...current, phrase: phraseToSargam(tokens) };
    });
  }, []);

  /**
   * Plays the current phrase.
   *
   * Rendered to a fixed filename that is overwritten each time, so auditioning does not fill
   * storage with attempts. A piece only gets a file of its own when it is saved.
   */
  const play = useCallback(async () => {
    if (!recipe.phrase.trim()) return;
    setRendering(true);
    try {
      const piece = await renderRecipe(recipe, 'preview');
      playQueue([
        {
          id: 'generated-preview',
          uri: `${piece.uri}?t=${Date.now()}`,
          title: 'Untitled',
          artist: 'Ratio',
          album: 'Generated',
          albumId: 'generated',
          artistId: 'generated',
          durationMs: piece.durationMs,
          trackNumber: 0,
          discNumber: 0,
          year: null,
          source: 'generated',
        },
      ]);
    } catch (caught) {
      Alert.alert('Could not play', caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRendering(false);
    }
  }, [playQueue, recipe]);

  const keep = useCallback(() => {
    if (!recipe.phrase.trim()) return;
    const stamp = new Date();
    const title = `Piece ${stamp.getDate()}/${stamp.getMonth() + 1} ${String(stamp.getHours()).padStart(2, '0')}:${String(stamp.getMinutes()).padStart(2, '0')}`;
    void save(recipe, title);
  }, [recipe, save]);

  const summary = useMemo(() => {
    const beats = recipe.phrase.replace(/\|/g, ' ').split(/\s+/).filter(Boolean).length;
    if (beats === 0) return null;
    const seconds = (beats * 60) / Math.max(1, recipe.beatsPerMinute);
    return `${beats} beats · ${seconds.toFixed(1)}s`;
  }, [recipe.phrase, recipe.beatsPerMinute]);

  const blockSize =
    recipe.midpointAnchor && recipe.anchorEvery >= 2
      ? Math.floor(recipe.anchorEvery / 2)
      : recipe.anchorEvery;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Generate" subtitle={summary ?? 'Nothing yet'} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.actions}>
          <Action icon="shuffle" label="Generate" onPress={generate} primary />
          <Action
            icon={rendering ? 'hourglass-outline' : 'play'}
            label={rendering ? 'Rendering' : 'Play'}
            onPress={play}
            disabled={rendering || !recipe.phrase.trim()}
          />
          <Action
            icon={saveState === 'saving' ? 'hourglass-outline' : 'bookmark-outline'}
            label={saveState === 'saving' ? 'Saving' : 'Keep'}
            onPress={keep}
            disabled={saveState === 'saving' || !recipe.phrase.trim()}
          />
        </View>

        {saveState === 'saved' ? (
          <Text style={styles.good}>Saved to the Generated playlist.</Text>
        ) : null}
        {saveError ? <Text style={styles.bad}>{saveError}</Text> : null}

        <Section title="Phrase">
          <TextInput
            style={styles.phrase}
            value={recipe.phrase}
            onChangeText={(text) => set('phrase', text)}
            placeholder="Press Generate, or write swaras here"
            placeholderTextColor={colors.textFaint}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />
        </Section>

        <Section title="Parsed">
          <PhraseChips text={recipe.phrase} blockSize={blockSize} />
        </Section>

        <Section title="Shape">
          <PhraseVisuals
            phrase={{
              text: recipe.phrase,
              sa: recipe.sa,
              beatsPerMinute: recipe.beatsPerMinute,
              overlap: recipe.overlap,
            }}
          />
        </Section>

        <Section title="Sound">
          <Slider
            label="Sa"
            value={recipe.sa}
            min={80}
            max={600}
            step={1}
            onChange={(value) => set('sa', value)}
          />
          <Slider
            label="Beats per minute"
            value={recipe.beatsPerMinute}
            min={40}
            max={600}
            step={10}
            onChange={(value) => set('beatsPerMinute', value)}
          />
          <Toggle
            label="Squash"
            hint="Each note runs into the next, so every pair sounds together."
            value={recipe.overlap > 0}
            onChange={(on) => set('overlap', on ? 0.4 : 0)}
          />
          {recipe.overlap > 0 ? (
            <Slider
              label="Overlap"
              value={Math.round(recipe.overlap * 100)}
              min={5}
              max={150}
              step={5}
              onChange={(value) => set('overlap', value / 100)}
            />
          ) : null}
        </Section>

        <Section title="Structure">
          <Slider
            label="Notes"
            value={recipe.count}
            min={8}
            max={512}
            step={8}
            onChange={(value) => set('count', value)}
          />
          <Slider
            label="Anchor every"
            value={recipe.anchorEvery}
            min={0}
            max={32}
            step={1}
            onChange={(value) => set('anchorEvery', value)}
          />
          <Slider
            label="Range"
            value={recipe.span}
            min={4}
            max={72}
            step={2}
            onChange={(value) => set('span', value)}
          />
          <Slider
            label="Loop backs"
            value={recipe.loopBacks}
            min={0}
            max={40}
            step={1}
            onChange={(value) => set('loopBacks', value)}
          />
          <Toggle
            label="Fixed midpoint"
            hint="One shared note halfway between anchors."
            value={recipe.midpointAnchor}
            onChange={(value) => set('midpointAnchor', value)}
          />
          <Toggle
            label="Shuddha only"
            hint="S R G M P D N, no komal or tivra."
            value={recipe.shuddhaOnly}
            onChange={(value) => set('shuddhaOnly', value)}
          />
        </Section>

        <Section title="Rhythm">
          <Slider
            label="Holds"
            value={Math.round(recipe.holdChance * 100)}
            min={0}
            max={60}
            step={1}
            onChange={(value) => set('holdChance', value / 100)}
          />
          <Slider
            label="Rests"
            value={Math.round(recipe.restChance * 100)}
            min={0}
            max={40}
            step={1}
            onChange={(value) => set('restChance', value / 100)}
          />
        </Section>

        <Section title="Step sizes">
          {[1, 2, 3, 4].map((size) => (
            <Slider
              key={size}
              label={`Step ${size}`}
              value={recipe.stepWeights[size] ?? 0}
              min={0}
              max={100}
              step={1}
              onChange={(value) => {
                const next = [...recipe.stepWeights];
                next[size] = value;
                set('stepWeights', next);
              }}
            />
          ))}
          <StepReadout phrase={recipe.phrase} />
        </Section>
      </ScrollView>
    </View>
  );
}

/** What the steps actually came out as, which the recurring notes can override. */
function StepReadout({ phrase }: { phrase: string }) {
  const text = useMemo(() => {
    const tokens = phrase.replace(/\|/g, ' ').split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return null;

    const notes: number[] = [];
    for (const token of tokens) {
      if (token === '-' || token === '_') continue;
      let body = token;
      let octave = 0;
      while (body.startsWith('.')) {
        octave -= 1;
        body = body.slice(1);
      }
      while (body.endsWith("'") && body !== "M'") {
        octave += 1;
        body = body.slice(0, -1);
      }
      const index = ['S', 'r', 'R', 'g', 'G', 'M', 'M#', 'P', 'd', 'D', 'n', 'N'].indexOf(
        body === 'm' ? 'M#' : body,
      );
      if (index >= 0) notes.push(index + octave * 12);
    }

    const histogram = stepHistogram(notes);
    const total = Math.max(1, notes.length - 1);
    const parts: string[] = [];
    for (let size = 1; size < histogram.length; size += 1) {
      const used = histogram[size] ?? 0;
      if (used) parts.push(`${size}: ${Math.round((used / total) * 100)}%`);
    }
    return parts.join('   ');
  }, [phrase]);

  if (!text) return null;
  return <Text style={styles.readout}>{text}</Text>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable style={styles.toggle} onPress={() => onChange(!value)}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.toggleHint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor="#FFFFFF"
      />
    </Pressable>
  );
}

function Action({
  icon,
  label,
  onPress,
  primary,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.action,
        primary ? styles.actionPrimary : null,
        disabled ? styles.actionDisabled : null,
        pressed && !disabled ? styles.actionPressed : null,
      ]}
    >
      <Ionicons
        name={icon}
        size={17}
        color={primary ? '#FFFFFF' : disabled ? colors.textFaint : colors.text}
      />
      <Text
        style={[
          styles.actionLabel,
          primary ? styles.actionLabelPrimary : null,
          disabled ? styles.actionLabelDisabled : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  actionPressed: { opacity: 0.7 },
  actionDisabled: { opacity: 0.5 },
  actionLabel: { ...typography.label, color: colors.text, fontWeight: '600' },
  actionLabelPrimary: { color: '#FFFFFF' },
  actionLabelDisabled: { color: colors.textFaint },

  section: { gap: spacing.sm },
  sectionTitle: { ...typography.caption, color: colors.textFaint, letterSpacing: 1.2 },
  sectionBody: { gap: spacing.md },

  phrase: {
    minHeight: 96,
    maxHeight: 200,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
    textAlignVertical: 'top',
  },

  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  toggleText: { flex: 1, gap: 2 },
  toggleLabel: typography.body,
  toggleHint: { ...typography.caption, lineHeight: 16 },

  readout: { ...typography.caption, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  good: { ...typography.caption, color: colors.accent },
  bad: { ...typography.caption, color: colors.danger },
});
