import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { readJson, writeJson } from '@/src/storage';

import {
  clampSetting,
  DEFAULT_FLAME_SETTINGS,
  normaliseSettings,
  type FlameSettings,
} from './flameSettings';
import { clampBrightness, SYSTEM_BRIGHTNESS } from './useScreenBrightness';

const STORAGE_KEY = 'ratio.flameSettings.v1';
const BRIGHTNESS_KEY = 'ratio.flameBrightness.v1';

export type FlameSettingsState = {
  settings: FlameSettings;
  /**
   * How bright to drive the screen while the fire is showing, or `SYSTEM_BRIGHTNESS` to
   * leave it alone. Persisted separately from the flame geometry: it is a property of the
   * device, not of the fire.
   */
  screenBrightness: number;
  setScreenBrightness: (value: number) => void;
  /** Sets one value, clamped to its range. */
  set: <K extends keyof FlameSettings>(key: K, value: number) => void;
  /** Back to the tuned defaults. */
  reset: () => void;
  /** True until the stored settings have loaded. */
  loading: boolean;
};

const FlameSettingsContext = createContext<FlameSettingsState | null>(null);

/**
 * The visualiser's settings, persisted.
 *
 * A provider rather than a hook per consumer, because the renderer and the settings screen
 * have to see the same values — a slider that only moved its own copy would be a slider that
 * does nothing.
 */
export function FlameSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<FlameSettings>(DEFAULT_FLAME_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [screenBrightness, setBrightnessState] = useState(SYSTEM_BRIGHTNESS);

  // Writes read the latest value from here rather than from state, so dragging a slider does
  // not race its own previous save.
  const settingsRef = useRef<FlameSettings>(DEFAULT_FLAME_SETTINGS);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const stored = await readJson<Partial<FlameSettings> | null>(STORAGE_KEY, null);
      if (cancelled) return;

      // Normalised on the way in: stored values outlive the ranges that produced them.
      const loaded = normaliseSettings(stored);
      settingsRef.current = loaded;
      setSettings(loaded);

      const brightness = await readJson<number | null>(BRIGHTNESS_KEY, null);
      if (cancelled) return;
      if (typeof brightness === 'number') setBrightnessState(clampBrightness(brightness));

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const set = useCallback(<K extends keyof FlameSettings>(key: K, value: number) => {
    const next = { ...settingsRef.current, [key]: clampSetting(key, value) };
    settingsRef.current = next;
    setSettings(next);

    // Fire and forget. A dropped write costs the user a slider position, and blocking the
    // drag on storage would make the control feel broken.
    void writeJson(STORAGE_KEY, next);
  }, []);

  const setScreenBrightness = useCallback((value: number) => {
    const next = clampBrightness(value);
    setBrightnessState(next);
    void writeJson(BRIGHTNESS_KEY, next);
  }, []);

  const reset = useCallback(() => {
    settingsRef.current = DEFAULT_FLAME_SETTINGS;
    setSettings(DEFAULT_FLAME_SETTINGS);
    void writeJson(STORAGE_KEY, DEFAULT_FLAME_SETTINGS);
  }, []);

  const value = useMemo<FlameSettingsState>(
    () => ({ settings, set, reset, loading, screenBrightness, setScreenBrightness }),
    [settings, set, reset, loading, screenBrightness, setScreenBrightness],
  );

  return (
    <FlameSettingsContext.Provider value={value}>{children}</FlameSettingsContext.Provider>
  );
}

export function useFlameSettings(): FlameSettingsState {
  const context = useContext(FlameSettingsContext);
  if (!context) throw new Error('useFlameSettings must be used inside <FlameSettingsProvider>');
  return context;
}
