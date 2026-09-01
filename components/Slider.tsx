import React, { useCallback, useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';

import { colors, spacing, typography } from '@/src/theme';

const TRACK_HEIGHT = 3;
const THUMB_SIZE = 16;

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Decimal places in the readout. */
  decimals?: number;
  onChange: (value: number) => void;
};

/**
 * A labelled slider, built from a PanResponder.
 *
 * React Native has no slider of its own, and the community one is another native dependency
 * for something the seek bar already proved can be done with a gesture and two Views. Same
 * approach here: measure the track, map the touch, snap to the step.
 */
export function Slider({ label, value, min, max, step, decimals = 0, onChange }: Props) {
  const [width, setWidth] = useState(0);

  // The responder is created once and never rebuilt — a PanResponder replaced mid-drag drops
  // the gesture — so live values reach it through refs rather than closure.
  const widthRef = useRef(0);
  const boundsRef = useRef({ min, max, step });
  const onChangeRef = useRef(onChange);
  widthRef.current = width;
  boundsRef.current = { min, max, step };
  onChangeRef.current = onChange;

  const report = useCallback((event: GestureResponderEvent) => {
    const trackWidth = widthRef.current;
    if (trackWidth <= 0) return;

    const { min: low, max: high, step: increment } = boundsRef.current;
    const ratio = Math.min(1, Math.max(0, event.nativeEvent.locationX / trackWidth));
    const raw = low + ratio * (high - low);
    const snapped = Math.round((raw - low) / increment) * increment + low;

    onChangeRef.current(Math.min(high, Math.max(low, snapped)));
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      // Claim on touch down, so a tap anywhere on the track jumps there rather than needing
      // a drag.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: report,
      onPanResponderMove: report,
    }),
  ).current;

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);

  const ratio = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value.toFixed(decimals)}</Text>
      </View>

      {/* Taller than the visible track, so it is reachable with a thumb. */}
      <View style={styles.hitArea} onLayout={onLayout} {...panResponder.panHandlers}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
        </View>
        <View
          style={[
            styles.thumb,
            // Offset by half the thumb so it centres on the value rather than leading it.
            { left: Math.max(0, ratio * width - THUMB_SIZE / 2) },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: typography.label,
  // Tabular figures so the readout does not jitter as digits change width while dragging.
  value: { ...typography.body, fontSize: 13, fontVariant: ['tabular-nums'] },
  hitArea: { height: 34, justifyContent: 'center' },
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
});
