import fs from 'node:fs';
import path from 'node:path';

/**
 * Guards an asymmetry in `react-native-svg` that is easy to trip over.
 *
 * `Svg.render()` merges `style` and props into one object, then fills in `100%` for both
 * dimensions **only when both are missing**:
 *
 *   if (width === undefined && height === undefined && position !== 'absolute') {
 *     width = height = '100%';
 *   }
 *   ...
 *   if (width != null) props.bbWidth = width;
 *   if (height != null) props.bbHeight = height;
 *
 * So `style={{ width: '100%', aspectRatio: n }}` with no height sends the native view a width
 * and no height. Passing neither is safe; passing both is safe; passing one is the odd case.
 *
 * Honest caveat on why this file exists. It was written believing this caused a crash on
 * device. Reading the Android source afterwards, that does not hold: `bbWidth`/`bbHeight` are
 * optional in the Fabric spec, and `mbbHeight` is only dereferenced for a *nested* `<Svg>`
 * (SvgView.java:312-313, guarded by `nested`). Our Svg is top-level, so a missing `bbHeight`
 * should be harmless. The crash cause is still unknown.
 *
 * These assertions are kept anyway — relying on a half-specified size is worth not doing —
 * but they are a style rule here, not a proven crash guard. Do not read them as the fix.
 */

/** Transcribed from react-native-svg/src/elements/Svg.tsx, render(), lines 104-175. */
function resolveNativeDimensions(props: Record<string, unknown>): {
  bbWidth?: unknown;
  bbHeight?: unknown;
} {
  const { style, ...extracted } = props;
  const stylesAndProps: Record<string, unknown> = {
    ...(Array.isArray(style) ? Object.assign({}, ...style) : (style as object)),
    ...extracted,
  };

  let width = stylesAndProps.width;
  let height = stylesAndProps.height;

  if (width === undefined && height === undefined && stylesAndProps.position !== 'absolute') {
    width = '100%';
    height = '100%';
  }

  const native: { bbWidth?: unknown; bbHeight?: unknown } = {};
  if (width != null) native.bbWidth = width;
  if (height != null) native.bbHeight = height;
  return native;
}

describe('react-native-svg dimension resolution', () => {
  it('fills in both dimensions when neither is given', () => {
    const d = resolveNativeDimensions({});
    expect(d.bbWidth).toBe('100%');
    expect(d.bbHeight).toBe('100%');
  });

  it('keeps both when both are given as props', () => {
    const d = resolveNativeDimensions({ width: '100%', height: '100%' });
    expect(d.bbWidth).toBe('100%');
    expect(d.bbHeight).toBe('100%');
  });

  it('leaves height unset when only a width comes from style — the crash', () => {
    const d = resolveNativeDimensions({ style: { width: '100%', aspectRatio: 404 / 338 } });
    expect(d.bbWidth).toBe('100%');
    expect(d.bbHeight).toBeUndefined();
  });

  it('is safe when style carries aspectRatio but no width', () => {
    const d = resolveNativeDimensions({ style: { aspectRatio: 404 / 338 } });
    expect(d.bbWidth).toBe('100%');
    expect(d.bbHeight).toBe('100%');
  });

  it('is safe when a sized wrapper is used and Svg keeps both dimensions', () => {
    const d = resolveNativeDimensions({
      width: '100%',
      height: '100%',
      style: { aspectRatio: 404 / 338 },
    });
    expect(d.bbWidth).toBe('100%');
    expect(d.bbHeight).toBe('100%');
  });
});

describe('Bonfire keeps its Svg safely dimensioned', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'components', 'Bonfire.tsx'),
    'utf8',
  );

  /** The opening `<Svg ...>` tag, attributes only. */
  const svgTag = source.slice(source.indexOf('<Svg'), source.indexOf('>', source.indexOf('<Svg')));

  it('renders exactly one Svg root', () => {
    expect(source.match(/<Svg[\s>]/g)).toHaveLength(1);
  });

  it('passes width and height, or neither — never exactly one', () => {
    const hasWidth = /\bwidth=/.test(svgTag);
    const hasHeight = /\bheight=/.test(svgTag);
    expect(hasWidth).toBe(hasHeight);
  });

  it('does not put a width in the Svg style, which bypasses the default', () => {
    // A style width without a matching height is the exact shape that crashed.
    const styleMatch = svgTag.match(/style=\{([^}]*)\}/);
    if (styleMatch) {
      expect(styleMatch[1]).not.toMatch(/width/);
    }
  });
});
