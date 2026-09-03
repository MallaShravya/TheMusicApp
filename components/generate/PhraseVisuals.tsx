import React, { useMemo } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { schedulePhrase, scheduleBeats } from '@/src/generator/schedule';
import { frequencyOf } from '@/src/generator/synth';
import { parseSargam } from '@/src/generator/swara';
import { colors, radius, spacing } from '@/src/theme';

/**
 * The waveform and the pitch contour, drawn from the same maths that renders the audio.
 *
 * The preview reads its waveform from a live analyser; there is no equivalent here, and one
 * would only show what a moment sounded like anyway. Drawing the *rendered* shape instead
 * shows the whole piece at once — where it is dense, where it rests, where overlapping notes
 * pile up — which is the more useful thing to see before deciding whether to keep it.
 */

const WAVE_POINTS = 240;
const WAVE_HEIGHT = 84;
const CONTOUR_HEIGHT = 132;

export type VisualPhrase = {
  text: string;
  sa: number;
  beatsPerMinute: number;
  overlap: number;
};

export function PhraseVisuals({ phrase }: { phrase: VisualPhrase }) {
  const [width, setWidth] = React.useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setWidth((current) => (Math.abs(current - next) < 1 ? current : next));
  };

  const shape = useMemo(() => buildShape(phrase), [phrase]);

  return (
    <View onLayout={onLayout} style={styles.stack}>
      <View style={[styles.panel, { height: WAVE_HEIGHT }]}>
        {width > 0 && shape.envelope.length > 1 ? (
          <Svg width="100%" height="100%" viewBox={`0 0 ${WAVE_POINTS} 100`} preserveAspectRatio="none">
            <Line x1={0} y1={50} x2={WAVE_POINTS} y2={50} stroke={colors.border} strokeWidth={1} />
            <Path d={shape.envelope} fill="rgba(255, 210, 122, 0.35)" stroke="#FFD27A" strokeWidth={0.8} />
          </Svg>
        ) : null}
      </View>

      <View style={[styles.panel, { height: CONTOUR_HEIGHT }]}>
        {width > 0 && shape.contour.length > 0 ? (
          <Svg width="100%" height="100%" viewBox={`0 0 1000 100`} preserveAspectRatio="none">
            {shape.anchors.map((y, index) => (
              <Line
                key={index}
                x1={0}
                y1={y}
                x2={1000}
                y2={y}
                stroke="#2E2A45"
                strokeWidth={0.6}
                strokeDasharray="6 6"
              />
            ))}
            {shape.contour.map((bar, index) => (
              <Line
                key={index}
                x1={bar.from}
                y1={bar.y}
                x2={bar.to}
                y2={bar.y}
                stroke="rgba(124, 92, 255, 0.75)"
                strokeWidth={3}
              />
            ))}
          </Svg>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Both pictures, from one pass over the phrase.
 *
 * The waveform is an *envelope* rather than every sample: a twenty-second piece is hundreds
 * of thousands of samples and no screen has that many pixels, so each column is the loudest
 * thing happening in its slice of time. That is also what makes the overlaps visible — where
 * two notes sound together the column is taller.
 */
function buildShape(phrase: VisualPhrase) {
  const parsed = parseSargam(phrase.text);
  const beat = 60 / Math.max(1, phrase.beatsPerMinute);

  const notes = schedulePhrase(parsed.events, {
    beatSeconds: beat,
    overlap: phrase.overlap,
    articulation: 0.03,
  });

  if (notes.length === 0) return { envelope: '', contour: [], anchors: [] };

  let seconds = scheduleBeats(parsed.events) * beat;
  for (const note of notes) seconds = Math.max(seconds, note.at + note.seconds);
  if (!(seconds > 0)) return { envelope: '', contour: [], anchors: [] };

  // How many notes are sounding in each column, which stands in for loudness without having
  // to synthesise anything.
  const columns = new Float32Array(WAVE_POINTS);
  for (const note of notes) {
    const from = Math.max(0, Math.floor((note.at / seconds) * WAVE_POINTS));
    const to = Math.min(WAVE_POINTS, Math.ceil(((note.at + note.seconds) / seconds) * WAVE_POINTS));
    for (let i = from; i < to; i += 1) columns[i] += 1;
  }

  let loudest = 1;
  for (const value of columns) loudest = Math.max(loudest, value);

  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i < WAVE_POINTS; i += 1) {
    const height = (columns[i] / loudest) * 46;
    top.push(`${i},${50 - height}`);
    bottom.push(`${WAVE_POINTS - 1 - i},${50 + (columns[WAVE_POINTS - 1 - i] / loudest) * 46}`);
  }
  const envelope = `M${top.join(' L')} L${bottom.join(' L')} Z`;

  // Pitch as log frequency, so an octave is the same distance wherever it falls.
  const pitches = notes.map((note) => Math.log2(frequencyOf(note.semitones, phrase.sa)));
  let low = Math.min(...pitches);
  let high = Math.max(...pitches);
  const pad = Math.max(0.1, (high - low) * 0.16);
  low -= pad;
  high += pad;

  const yAt = (pitch: number) => 94 - ((pitch - low) / (high - low)) * 88;

  const contour = notes.map((note, index) => ({
    from: (note.at / seconds) * 1000,
    to: ((note.at + note.seconds) / seconds) * 1000,
    y: yAt(pitches[index]),
  }));

  const anchors: number[] = [];
  for (let octave = -4; octave <= 4; octave += 1) {
    const pitch = Math.log2(phrase.sa * Math.pow(2, octave));
    if (pitch >= low && pitch <= high) anchors.push(yAt(pitch));
  }

  return { envelope, contour, anchors };
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
});
