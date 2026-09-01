import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { Track } from '@/src/model';
import { usePlaybackProgress, usePlayer } from '@/src/player/PlayerProvider';
import { colors, radius, spacing, typography } from '@/src/theme';
import {
  buildFlameFrame,
  EMPTY_FRAME,
  GLOW_STOPS,
  safe,
  makeSparkStates,
  makeTongues,
  sampleAnalysis,
  SCENE,
  VIEWPORT,
  useFlameSettings,
  useScreenBrightness,
  useTrackAnalysis,
  type FlameFrame,
  type TongueSpec,
} from '@/src/visualiser';

/**
 * The wood, at the scene's own scale. Painted once and never animated — the glow above it
 * does the reacting, and tinting the logs as well made them read as lit plastic.
 */
const LOGS = [
  { x: -62, y: -3, w: 124, h: 9, rotate: -9, fill: '#33200F' },
  { x: -26, y: 5, w: 107, h: 8, rotate: 8, fill: '#28190C' },
  { x: -75, y: 8, w: 88, h: 8, rotate: 4, fill: '#3A2513' },
  { x: -42, y: 15, w: 95, h: 7, rotate: -3, fill: '#221408' },
];

const SPARK_COUNT = 22;

/** The outermost glow layer is drawn this much larger than the core. */
const HALO_SCALE = 1.24;

/**
 * Gradient ids are unique per instance, so two mounted fires cannot collide in the SVG id
 * namespace.
 *
 * A caution about the history here: the visualiser crash was blamed on two `Bonfire`s being
 * mounted at once, and the settings screen's live preview was removed on that basis. That was
 * wrong. The real cause was a zero-radius glow ellipse under a radial gradient — see the
 * comment on the Ellipse below. The two-instance correlation was a timing artifact: the
 * second mount was heavier and so more likely to paint a frame before the first `rAF` fired.
 */
let instanceCount = 0;

/**
 * The bonfire visualiser.
 *
 * Draws into a fixed 520×430 scene and lets SVG scale it, so a fire tuned in the preview
 * console looks the same on any screen. Everything it needs — the shapes, the colours, the
 * per-tongue drive — comes from `src/visualiser`, which is why this file is only assembly.
 *
 * Animation runs on a `requestAnimationFrame` loop that rebuilds the path strings and sets
 * them as React state. That is the straightforward approach rather than the fastest one:
 * every frame re-renders `tongues × layers` Path elements. It is the first thing to change
 * if this proves too slow on a real device.
 */
export function Bonfire({ track }: { track: Track | null }) {
  const { settings, screenBrightness } = useFlameSettings();
  const { analysis } = useTrackAnalysis(track);

  // Applied here rather than on the screen, because this component is mounted only while the
  // fire is visible — so the screen goes back to normal the moment you leave it.
  useScreenBrightness(screenBrightness);
  const { isPlaying } = usePlayer();
  const progress = usePlaybackProgress();

  const [frame, setFrame] = useState<FlameFrame>(EMPTY_FRAME);
  const [loopError, setLoopError] = useState<Error | null>(null);
  const gradientId = useRef(`flameGlow${(instanceCount += 1)}`).current;

  const tonguesRef = useRef<TongueSpec[]>([]);
  const levelsRef = useRef<number[]>([]);
  // Built once and never rebuilt: a spark in flight keeps the energy it launched with, and
  // resetting this would drop every airborne spark back to the wood.
  const sparkStatesRef = useRef(makeSparkStates());
  const brightnessRef = useRef(0);

  /**
   * A local playback clock.
   *
   * The player reports its position twice a second, which is far too coarse to index an
   * analysis sampled every 50 ms — the fire would step rather than move. This free-runs at
   * frame rate and resyncs whenever a real position arrives.
   */
  const clockRef = useRef(0);
  useEffect(() => {
    clockRef.current = progress.currentTime;
  }, [progress.currentTime]);

  // Rebuild the fire's layout only when its shape actually changes.
  useEffect(() => {
    tonguesRef.current = makeTongues(settings.tongues);
    levelsRef.current = tonguesRef.current.map(() => 0);
  }, [settings.tongues]);

  const analysisRef = useRef(analysis);
  const settingsRef = useRef(settings);
  const playingRef = useRef(isPlaying);
  analysisRef.current = analysis;
  settingsRef.current = settings;
  playingRef.current = isPlaying;

  useEffect(() => {
    let raf = 0;
    let last = 0;

    const step = (now: number) => {
      try {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016;
      last = now;

      if (playingRef.current) clockRef.current += dt;

      const target = sampleAnalysis(analysisRef.current, clockRef.current);

      // All the maths lives in `buildFlameFrame`, which is pure and tested. Keeping it out of
      // this callback is deliberate: an animation frame is the one place a test cannot reach,
      // and this is the only code whose output becomes native view props sixty times a second.
      const built = buildFlameFrame({
        settings: settingsRef.current,
        tongues: tonguesRef.current,
        levels: levelsRef.current,
        sparkStates: sparkStatesRef.current,
        amplitude: target.amplitude,
        brightness: target.brightness,
        previousBrightness: brightnessRef.current,
        time: now / 1000,
      });

      brightnessRef.current = built.brightness;
      setFrame(built);

      raf = requestAnimationFrame(step);
      } catch (error) {
        // Surfaced rather than rethrown: an animation frame callback is outside React's error
        // boundaries, so an escape here would close the app with no message at all.
        setLoopError(error instanceof Error ? error : new Error(String(error)));
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (loopError) {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.errorBox}>
          <Text selectable style={styles.errorTitle}>Bonfire animation failed</Text>
          <Text selectable style={styles.errorText}>{loopError.message}</Text>
          <Text selectable style={styles.errorStack}>
            {(loopError.stack ?? '').slice(0, 600)}
          </Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Svg
        width="100%"
        height="100%"
        // Both dimensions, never one: `Svg.render()` only defaults them as a pair, so passing
        // a lone width through `style` would hand the native view a half-specified size.
        viewBox={`${VIEWPORT.x} ${VIEWPORT.y} ${VIEWPORT.width} ${VIEWPORT.height}`}
        // yMax: the fire stands on the bottom of the stage. Centring it was tried and looked
        // worse — a fire floating in the middle of the frame reads as unmoored. The vertical
        // slack this leaves above is deliberate now: the starfield fills it.
        preserveAspectRatio="xMidYMax meet"
      >
        <Defs>
          {/* A gradient, not stacked shapes: concentric ellipses band visibly at this size. */}
          <RadialGradient id={gradientId}>
            {GLOW_STOPS.map((stop) => (
              <Stop
                key={stop.offset}
                offset={stop.offset}
                stopColor={frame.colour}
                stopOpacity={stop.weight * frame.glowOpacity}
              />
            ))}
          </RadialGradient>
        </Defs>

        {/* Wood first, so the flames sit in front of it rather than behind. */}
        <G>
          {LOGS.map((log, index) => (
            <Rect
              key={index}
              x={SCENE.width / 2 + log.x}
              y={SCENE.baseY + log.y}
              width={log.w}
              height={log.h}
              rx={log.h / 2}
              fill={log.fill}
              // Separate numeric props, not an "x, y" string: `origin` is typed NumberArray,
              // and under the New Architecture a string there is a native type violation.
              originX={SCENE.width / 2 + log.x + log.w / 2}
              originY={SCENE.baseY + log.y + log.h / 2}
              rotation={log.rotate}
            />
          ))}
        </G>

        {/*
          * Only when it has a size. A radial gradient resolves its radius against the
          * bounding box of the shape it fills, so a zero-sized ellipse gives Android a
          * zero radius, and `new RadialGradient(..., 0f, ...)` throws — natively, below
          * React, killing the app with no message. `EMPTY_FRAME` is exactly that shape,
          * and it is what renders on mount before the first animation frame lands.
          * See `src/visualiser/__tests__/radialGradientBox.test.ts`.
          */}
        {frame.glowRx > 0 && frame.glowRy > 0 ? (
          <Ellipse
            cx={SCENE.width / 2}
            cy={SCENE.baseY + 14}
            rx={frame.glowRx}
            ry={frame.glowRy}
            fill={`url(#${gradientId})`}
          />
        ) : null}

        {frame.paths.map((d, index) => (
          <Path key={index} d={d} fill={frame.colour} fillOpacity={safe(frame.opacities[index])} />
        ))}

        {frame.sparks.map((spark, index) => (
          <Circle
            key={index}
            cx={spark.cx}
            cy={spark.cy}
            r={spark.r}
            fill={frame.colour}
            fillOpacity={spark.opacity}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  // Transparent, not the page colour: the starfield sits behind this and would be hidden.
  container: { flex: 1, width: '100%', backgroundColor: 'transparent' },
  errorBox: { flex: 1, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md },
  errorTitle: { ...typography.body, fontWeight: '600', color: colors.danger, marginBottom: spacing.sm },
  errorText: { ...typography.label, color: colors.text, lineHeight: 20 },
  errorStack: { ...typography.caption, marginTop: spacing.sm, lineHeight: 16 },
  probe: { alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  probeText: { ...typography.body, color: colors.textMuted },
  probeHint: typography.caption,
  probeBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.md,
    ...typography.caption,
    color: colors.textFaint,
  },
});
