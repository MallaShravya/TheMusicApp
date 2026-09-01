import { useEffect } from 'react';
import * as Brightness from 'expo-brightness';

/**
 * The setting's value when the screen should be left alone.
 *
 * A sentinel rather than a separate boolean, so the slider has one continuous range with
 * "don't touch it" at the bottom end instead of a toggle beside it.
 */
export const SYSTEM_BRIGHTNESS = -1;

/** Never black. A fire nobody can see is not a setting anyone wants to have chosen. */
export const MIN_BRIGHTNESS = 0.15;

export function clampBrightness(value: number): number {
  if (!Number.isFinite(value)) return SYSTEM_BRIGHTNESS;
  if (value < MIN_BRIGHTNESS) return SYSTEM_BRIGHTNESS;
  return Math.min(1, value);
}

/**
 * Raises the screen while the fire is on it.
 *
 * This exists because no amount of colour maths can reproduce what turning the screen up
 * does. Brightness is the panel's emitted luminance, not the pixel values — a screenshot at
 * minimum and maximum brightness is the same file — and perceived colourfulness rises with
 * luminance, which is why a fully saturated indigo looks dull at a low setting and vivid at a
 * high one. Rather than imitate that badly by lifting values, the app asks for the real
 * thing.
 *
 * The override is scoped to this app's window: no permission is needed, it lasts only while
 * Ratio is in the foreground, and it is handed back the moment this unmounts. Since the
 * visualiser is itself only mounted while it is being looked at, the screen returns to normal
 * as soon as you leave the fire.
 *
 * Every call is guarded. Brightness control is a device capability, and a phone that refuses
 * must not take the visualiser down with it.
 */
export function useScreenBrightness(level: number) {
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        if (!(await Brightness.isAvailableAsync())) return;
        if (cancelled) return;

        if (level === SYSTEM_BRIGHTNESS) {
          await Brightness.restoreSystemBrightnessAsync();
          return;
        }

        await Brightness.setBrightnessAsync(Math.min(1, Math.max(MIN_BRIGHTNESS, level)));
      } catch {
        // Nothing to do and nothing worth saying: the screen stays as the user had it.
      }
    })();

    return () => {
      cancelled = true;
      // Restore on the way out, whatever happened on the way in.
      void Brightness.restoreSystemBrightnessAsync().catch(() => {});
    };
  }, [level]);
}
