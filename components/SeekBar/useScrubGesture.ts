import { useCallback, useRef, useState } from 'react';
import {
  PanResponder,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';

import { timeForPosition } from './seekGeometry';

export type ScrubGesture = {
  /** Spread onto the touch target. */
  panHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];
  onLayout: (event: LayoutChangeEvent) => void;
  /** Measured track width, needed to place the thumb. */
  width: number;
  /** The finger's position while dragging, or null when not dragging. */
  scrubTime: number | null;
};

/**
 * Turns drags across the bar into a playback position.
 *
 * The gesture is created once and never re-created — a PanResponder rebuilt mid-drag drops
 * the gesture — so live values reach it through refs rather than closure. That is the whole
 * reason this is a hook and not inline JSX.
 *
 * `scrubTime` exists so the bar can render the finger instead of the player while dragging.
 * Without it the twice-a-second status tick fights the gesture and the thumb jumps backwards
 * under the user's finger.
 */
export function useScrubGesture(duration: number, onSeek: (seconds: number) => void): ScrubGesture {
  const [width, setWidth] = useState(0);
  const [scrubTime, setScrubTime] = useState<number | null>(null);

  const widthRef = useRef(0);
  const durationRef = useRef(0);
  const onSeekRef = useRef(onSeek);
  widthRef.current = width;
  durationRef.current = duration;
  onSeekRef.current = onSeek;

  const timeForTouch = useCallback(
    (event: GestureResponderEvent) =>
      timeForPosition(event.nativeEvent.locationX, widthRef.current, durationRef.current),
    [],
  );

  const panResponder = useRef(
    PanResponder.create({
      // Claim the gesture on touch down, so a tap anywhere on the bar seeks immediately
      // rather than requiring a drag.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => setScrubTime(timeForTouch(event)),
      onPanResponderMove: (event) => setScrubTime(timeForTouch(event)),
      onPanResponderRelease: (event) => {
        onSeekRef.current(timeForTouch(event));
        setScrubTime(null);
      },
      // Interrupted mid-drag (a call, a system gesture): abandon without seeking, so playback
      // stays where it was rather than jumping to wherever the finger happened to be.
      onPanResponderTerminate: () => setScrubTime(null),
    }),
  ).current;

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);

  return { panHandlers: panResponder.panHandlers, onLayout, width, scrubTime };
}
