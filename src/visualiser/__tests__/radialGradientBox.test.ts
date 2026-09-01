/**
 * Why a radial gradient on a zero-sized shape closes the app.
 *
 * This is the visualiser crash. It is native, below React, so neither the `ErrorBoundary` nor
 * the `try/catch` around the animation loop can see it — the process simply dies with no
 * message. The logic below is transcribed from the library and the platform so the failure
 * can be demonstrated in a test instead of on a device.
 *
 * Chain:
 *
 *   1. `<RadialGradient>` with no geometry takes its defaultProps — cx/cy/r = '50%'
 *      (react-native-svg/src/elements/RadialGradient.tsx), and `rx = rx || r`.
 *   2. `gradientUnits` defaults to objectBoundingBox, so those percentages resolve against
 *      the bounding box of the *filled shape* — `setupPaint(paint, mBox, ...)`, where mBox
 *      comes from `path.computeBounds()` (Brush.java:112-115, RenderableView.java:525).
 *   3. A zero-radius ellipse has a zero-sized box, so rx resolves to 0. Brush.java's guard
 *      then falls back to `rx = width` — which is also 0 (Brush.java:207-213). The guard
 *      covers a zero radius on a real box, not a zero-sized box.
 *   4. `new RadialGradient(cx, cy, 0f, ...)` throws IllegalArgumentException. Android's
 *      constructor rejects a non-positive radius outright.
 *
 * Note the PATTERN branch immediately above does bail out on a degenerate box
 * (`if (!(w > 1 && h > 1)) return;`). The radial branch has no equivalent.
 */

/** PropHelper.fromRelative, for the percentage case only. */
function resolvePercent(percent: number, relative: number): number {
  return (percent / 100) * relative;
}

/** android.graphics.RadialGradient's constructor precondition. */
function androidRadialGradient(cx: number, cy: number, radius: number): { cx: number; cy: number } {
  if (!(radius > 0)) {
    throw new Error('java.lang.IllegalArgumentException: radius must be > 0');
  }
  return { cx, cy };
}

/** Brush.setupPaint, BrushType.RADIAL_GRADIENT branch (Brush.java:203-226). */
function paintRadialGradient(box: { width: number; height: number }) {
  let rx = resolvePercent(50, box.width);
  let ry = resolvePercent(50, box.height);

  if (rx <= 0 || ry <= 0) {
    // "Gradient with radius = 0 should be rendered as solid color of the last stop"
    rx = box.width;
    ry = box.height;
  }

  const ratio = ry / rx;
  const cx = resolvePercent(50, box.width);
  const cy = resolvePercent(50, box.height / ratio);

  return androidRadialGradient(cx, cy, rx);
}

describe('a radial gradient painted onto a shape', () => {
  it('is fine on a normal bounding box', () => {
    expect(() => paintRadialGradient({ width: 300, height: 120 })).not.toThrow();
  });

  it('throws on a zero-sized box — the crash', () => {
    expect(() => paintRadialGradient({ width: 0, height: 0 })).toThrow(/radius must be > 0/);
  });

  it("produces NaN for the centre too, because the library's fallback divides 0 by 0", () => {
    const ratio = 0 / 0;
    expect(Number.isNaN(ratio)).toBe(true);
    expect(Number.isNaN(resolvePercent(50, 0 / ratio))).toBe(true);
  });

  it('does not throw when only one dimension collapses, but paints at a NaN centre', () => {
    // rx survives as `width`, so the radius precondition passes. ratio is 0, so `height/ratio`
    // is NaN and the centre goes with it. Bad, but not fatal — it takes *both* dimensions
    // collapsing to reach the throw, which is exactly what EMPTY_FRAME does.
    const shader = paintRadialGradient({ width: 300, height: 0 });
    expect(Number.isNaN(shader.cy)).toBe(true);
  });

  it('survives any box with both dimensions positive, however small', () => {
    expect(() => paintRadialGradient({ width: 0.5, height: 0.5 })).not.toThrow();
  });
});
