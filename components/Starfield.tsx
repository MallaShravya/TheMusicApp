import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line } from 'react-native-svg';

import {
  isShooting,
  makeStars,
  SHOOTING_DURATION,
  shootingStar,
  TWINKLE_GROUPS,
} from '@/src/visualiser';

/**
 * Stars per 100×100 points of sky. They are packed into the top of the stage rather than
 * spread across it, so this is denser than it sounds.
 */
const DENSITY = 5.2;
const MAX_STARS = 180;

const AnimatedG = Animated.createAnimatedComponent(G);

/**
 * The sky behind the fire.
 *
 * The stars blink, but nothing about the blink is computed. Each star belongs to one of the
 * seven `TWINKLE_GROUPS`, each group is one `<G>` whose opacity is driven by one looping
 * `Animated.Value`, and the interpolation is the animation driver's job rather than ours.
 * Seven values move; every star rides on them. That is what makes a field this size free:
 * the star elements are built once per layout and handed back by identity, so React skips
 * the whole subtree on every subsequent render, and no star is ever touched again.
 *
 * Sized from its own layout rather than a fixed scene, because it fills whatever the stage
 * leaves. The fire cannot do that — it draws into a fixed 520×430 scene so tuned numbers keep
 * their meaning, which leaves an empty band once that scene is letterboxed. This fills it.
 */
export function Starfield() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [streaks, setStreaks] = useState<ReturnType<typeof shootingStar>>([]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) =>
      Math.abs(current.width - width) < 1 && Math.abs(current.height - height) < 1
        ? current
        : { width, height },
    );
  };

  /** One driver per group, created once for the life of the component. */
  const drivers = useRef(TWINKLE_GROUPS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = drivers.map((driver, index) => {
      const group = TWINKLE_GROUPS[index];
      const half = (group.period * 1000) / 2;

      // Started already part-way through, so the groups are out of step from the first frame
      // rather than falling into step for the opening seconds.
      driver.setValue((group.phase / group.period) % 1);

      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(driver, {
            toValue: 1,
            duration: half,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
          Animated.timing(driver, {
            toValue: 0,
            duration: half,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
        ]),
      );

      loop.start();
      return loop;
    });

    return () => loops.forEach((loop) => loop.stop());
  }, [drivers]);

  const opacities = useMemo(
    () =>
      drivers.map((driver, index) =>
        driver.interpolate({
          inputRange: [0, 1],
          outputRange: [TWINKLE_GROUPS[index].low, 1],
        }),
      ),
    [drivers],
  );

  /**
   * Built once per size and kept by identity.
   *
   * Deliberately not rebuilt when a shooting star moves: React compares the same elements and
   * skips them, so the cost of the field is paid once.
   */
  const groups = useMemo(() => {
    const count = Math.min(MAX_STARS, Math.round((size.width * size.height * DENSITY) / 10000));
    const stars = makeStars(count, size.width, size.height);

    return TWINKLE_GROUPS.map((_, index) =>
      stars
        .filter((star) => star.group === index)
        .map((star, key) => (
          <Circle
            key={key}
            cx={star.x}
            cy={star.y}
            r={star.r}
            fill="#FFFFFF"
            fillOpacity={star.opacity}
          />
        )),
    );
  }, [size.width, size.height]);

  const startedAt = useRef(0);
  const wasShooting = useRef(false);

  useEffect(() => {
    let raf = 0;

    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      if (!startedAt.current) startedAt.current = now;
      // Offset past the first crossing window. Without it a shooting star fires the instant
      // the visualiser opens, every single time, which reads as scripted rather than chance.
      const time = (now - startedAt.current) / 1000 + SHOOTING_DURATION + 2;

      // Nothing crossing: no state, no render. This is the case nine times out of ten.
      if (!isShooting(time)) {
        if (wasShooting.current) {
          wasShooting.current = false;
          setStreaks([]);
        }
        return;
      }

      wasShooting.current = true;
      setStreaks(shootingStar(time, size.width, size.height));
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [size.width, size.height]);

  return (
    <View style={styles.container} onLayout={onLayout} pointerEvents="none">
      {size.width > 0 && size.height > 0 ? (
        <Svg width="100%" height="100%" viewBox={`0 0 ${size.width} ${size.height}`}>
          {groups.map((stars, index) => (
            <AnimatedG key={index} opacity={opacities[index]}>
              {stars}
            </AnimatedG>
          ))}

          {streaks.map((streak, index) => (
            <Line
              key={index}
              x1={streak.x1}
              y1={streak.y1}
              x2={streak.x2}
              y2={streak.y2}
              stroke="#FFFFFF"
              strokeOpacity={streak.opacity}
              strokeWidth={streak.width}
              strokeLinecap="round"
            />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
