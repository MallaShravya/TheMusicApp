import { colors } from './colors';

/**
 * Five text styles, each bundling size, weight, *and* colour.
 *
 * Colour is included on purpose. In practice type scale and hierarchy are the same decision
 * — a caption is small *and* faint — and splitting them means every call site re-deciding
 * which grey a caption gets, which is exactly how a UI drifts. Spread one of these and
 * override only where a screen genuinely differs:
 *
 * ```ts
 * title: { ...typography.title, fontSize: 22 }
 * ```
 *
 * The `as const` on each weight is required: React Native types `fontWeight` as a union of
 * string literals, and a bare `'600'` widens to `string` and stops assigning.
 */
export const typography = {
  /** Screen titles. One per screen, at the top. */
  title: { fontSize: 28, fontWeight: '700' as const, color: colors.text },
  /** Section headings and sheet titles. */
  heading: { fontSize: 20, fontWeight: '600' as const, color: colors.text },
  /** Track titles, buttons, anything you read or press. */
  body: { fontSize: 15, fontWeight: '500' as const, color: colors.text },
  /** Supporting lines: artist names, item counts. */
  label: { fontSize: 13, fontWeight: '500' as const, color: colors.textMuted },
  /** Durations, timestamps, metadata. */
  caption: { fontSize: 12, fontWeight: '500' as const, color: colors.textFaint },
};

/**
 * @deprecated Kept because sixteen files already import `type`, which is an unfortunate name
 * — it collides visually with TypeScript's `type` keyword and reads badly at call sites
 * (`...type.body`). Prefer {@link typography} in new code; the old name can be retired in a
 * pass of its own rather than churning every screen now.
 */
export const type = typography;
