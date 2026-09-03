import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/src/theme';
import { parseSargam, type Event } from '@/src/generator/swara';

/** Tints for repeated stretches. A stretch and its copies share one. */
const LOOP_TINTS = [
  { background: 'rgba(63, 184, 160, 0.20)', border: 'rgba(63, 184, 160, 0.65)' },
  { background: 'rgba(224, 138, 184, 0.18)', border: 'rgba(224, 138, 184, 0.60)' },
  { background: 'rgba(120, 160, 255, 0.18)', border: 'rgba(120, 160, 255, 0.60)' },
  { background: 'rgba(214, 178, 92, 0.18)', border: 'rgba(214, 178, 92, 0.60)' },
];

/**
 * Which stretches of a phrase repeat each other.
 *
 * Read out of the written line rather than taken from the generator, so it also marks
 * repetition in something edited by hand and stays right after a change. Blocks appearing
 * once are absent from the result.
 */
export function repeatedBlocks(text: string, size: number): Map<number, number> {
  const marks = new Map<number, number>();
  if (!(size > 0)) return marks;

  const tokens = text.replace(/\|/g, ' ').split(/\s+/).filter(Boolean);
  const groups = new Map<string, number[]>();

  for (let block = 0; (block + 1) * size <= tokens.length; block += 1) {
    const key = tokens.slice(block * size, (block + 1) * size).join(' ');
    const found = groups.get(key);
    if (found) found.push(block);
    else groups.set(key, [block]);
  }

  let colour = 0;
  for (const blocks of groups.values()) {
    if (blocks.length < 2) continue;
    for (const block of blocks) marks.set(block, colour % LOOP_TINTS.length);
    colour += 1;
  }

  return marks;
}

/**
 * The phrase, one chip per written beat.
 *
 * Repeats are tinted at every occurrence, source and copy alike: showing only the copies
 * would say where a repeat landed and not what it repeats.
 */
export function PhraseChips({ text, blockSize }: { text: string; blockSize: number }) {
  const { events, errors } = parseSargam(text);
  const loops = repeatedBlocks(text, blockSize);

  if (events.length === 0) {
    return <Text style={styles.empty}>Nothing yet — press Generate.</Text>;
  }

  return (
    <View>
      <View style={styles.row}>
        {events.map((event, index) => (
          <Chip
            key={index}
            event={event}
            tint={blockSize > 0 ? loops.get(Math.floor(event.token / blockSize)) : undefined}
          />
        ))}
      </View>

      {errors.length > 0 ? (
        <Text style={styles.error}>
          {errors.map((e) => `beat ${e.token + 1}: ${e.text} — ${e.reason}`).join('\n')}
        </Text>
      ) : null}
    </View>
  );
}

function Chip({ event, tint }: { event: Event; tint: number | undefined }) {
  const palette = tint === undefined ? null : LOOP_TINTS[tint];

  const label =
    event.kind === 'rest'
      ? '_'
      : (event.octave < 0 ? '.'.repeat(-event.octave) : '') +
        event.swara.name +
        (event.octave > 0 ? "'".repeat(event.octave) : '');

  return (
    <View
      style={[
        styles.chip,
        palette ? { backgroundColor: palette.background, borderColor: palette.border } : null,
      ]}
    >
      <Text style={[styles.chipText, event.kind === 'rest' ? styles.restText : null]}>
        {label}
        {event.beats > 1 ? <Text style={styles.beats}>{` x${event.beats}`}</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { ...typography.caption, color: colors.text, fontVariant: ['tabular-nums'] },
  restText: { color: colors.textFaint },
  beats: { color: colors.textFaint },
  empty: { ...typography.caption, color: colors.textFaint },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.sm },
});
