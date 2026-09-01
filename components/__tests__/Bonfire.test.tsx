import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import renderer, { act } from 'react-test-renderer';

import { Bonfire } from '../Bonfire';
import { DEFAULT_FLAME_SETTINGS } from '@/src/visualiser';

/**
 * Renders the real component and inspects every prop that reaches an SVG element.
 *
 * A non-finite number crossing into a native view is a genuine hazard with no device-side
 * diagnostics available on this project, so it is worth asserting before a build rather than
 * after one.
 *
 * The dimension check below is a style rule, not a proven crash guard — see the note in
 * `src/visualiser/__tests__/svgDimensions.test.ts`. The visualiser crash it was written for
 * is still unexplained.
 */

jest.mock('@/src/visualiser/useFlameSettings', () => ({
  useFlameSettings: () => ({
    settings: jest.requireActual('@/src/visualiser/flameSettings').DEFAULT_FLAME_SETTINGS,
    set: jest.fn(),
    reset: jest.fn(),
    loading: false,
    screenBrightness: -1,
    setScreenBrightness: jest.fn(),
  }),
  FlameSettingsProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/src/player/PlayerProvider', () => ({
  usePlayer: () => ({ isPlaying: true }),
  usePlaybackProgress: () => ({ currentTime: 12.5, duration: 200, isBuffering: false }),
}));

/** Numeric SVG props. A non-finite value in any of these is the failure mode. */
const NUMERIC_PROPS = [
  'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height',
  'originX', 'originY', 'rotation', 'fillOpacity', 'strokeWidth', 'strokeOpacity', 'opacity',
];

function walk(node: any, visit: (n: any) => void) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, visit));
    return;
  }
  visit(node);
  (node.children ?? []).forEach((child: any) => walk(child, visit));
}

describe('Bonfire renders drawable SVG', () => {
  it('never emits a non-finite numeric prop', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<Bonfire track={null} />);
    });

    const offenders: string[] = [];
    walk(tree!.toJSON(), (node) => {
      const props = node.props ?? {};
      for (const key of NUMERIC_PROPS) {
        const value = props[key];
        if (typeof value === 'number' && !Number.isFinite(value)) {
          offenders.push(`${node.type}.${key} = ${value}`);
        }
      }
      if (typeof props.d === 'string' && /NaN|Infinity|undefined/.test(props.d)) {
        offenders.push(`${node.type}.d contains a non-finite number`);
      }
    });

    expect(offenders).toEqual([]);
    act(() => tree!.unmount());
  });

  it('gives its Svg root both dimensions, never one', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<Bonfire track={null} />);
    });

    const roots: any[] = [];
    walk(tree!.toJSON(), (node) => {
      if (typeof node.type === 'string' && node.type.toLowerCase().includes('svg')) {
        roots.push(node);
      }
    });

    expect(roots.length).toBeGreaterThan(0);

    for (const root of roots) {
      const style = Array.isArray(root.props.style)
        ? Object.assign({}, ...root.props.style)
        : (root.props.style ?? {});
      const hasWidth = root.props.width !== undefined || style.width !== undefined;
      const hasHeight = root.props.height !== undefined || style.height !== undefined;

      // Supplying exactly one leaves bbHeight unset on the native view. Whether that is
      // harmful is unproven; not relying on it is cheap either way.
      expect(hasWidth).toBe(hasHeight);
    }

    act(() => tree!.unmount());
  });

  it('mounts and unmounts without leaking its animation frame', () => {
    const pending = new Set<number>();
    const originalRequest = global.requestAnimationFrame;
    const originalCancel = global.cancelAnimationFrame;

    let id = 0;
    global.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      const handle = ++id;
      pending.add(handle);
      return handle;
    }) as typeof global.requestAnimationFrame;
    global.cancelAnimationFrame = ((handle: number) => {
      pending.delete(handle);
    }) as typeof global.cancelAnimationFrame;

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<Bonfire track={null} />);
    });
    expect(pending.size).toBe(1);

    act(() => tree!.unmount());
    expect(pending.size).toBe(0);

    global.requestAnimationFrame = originalRequest;
    global.cancelAnimationFrame = originalCancel;
  });
});

describe('the tuned defaults', () => {
  it('are the numbers chosen in the preview console', () => {
    expect(DEFAULT_FLAME_SETTINGS).toEqual({
      tongues: 7,
      layers: 3,
      height: 212,
      width: 22,
      sway: 30,
      flutter: 5,
      tipSharpness: 1.8,
      segments: 36,
    });
  });
});

/**
 * The one-instance invariant, as a test rather than a comment.
 *
 * Two `Bonfire`s mounted at once with the gradient is the only configuration observed to
 * crash the app. Nothing here proves *why*, so the rule is enforced literally: exactly one
 * place in the app may render a `<Bonfire>`. If a second is ever wanted — a live preview on
 * the settings sheet, most likely — it has to be a transparent window onto the player's own
 * fire, not another instance.
 */
/**
 * The crash guard.
 *
 * A shape filled with `url(#gradient)` resolves the gradient's radius against its own
 * bounding box, so a zero-sized one makes Android throw `IllegalArgumentException: radius
 * must be > 0` while drawing — a native crash React cannot catch. The mechanism is worked
 * through in `src/visualiser/__tests__/radialGradientBox.test.ts`; this asserts the component
 * never produces the shape, including on the very first render, which is where it happened.
 *
 * Note that the existing non-finite check does not cover this: zero is perfectly finite.
 */
describe('Bonfire never gradient-fills a zero-sized shape', () => {
  /**
   * `fill="url(#id)"` does not survive to the tree as a string: `extractFill` turns it into
   * `{ type: 1, brushRef: 'id' }`. Checking for the string made this test vacuous — it passed
   * with the bug still present. Both forms are accepted here so it cannot go quiet again.
   */
  const gradientFilled = (node: any) => {
    const fill = node?.props?.fill;
    if (typeof fill === 'string') return fill.startsWith('url(#');
    return typeof fill === 'object' && fill !== null && typeof fill.brushRef === 'string';
  };

  const degenerate = (node: any) => {
    const { rx, ry, r } = node.props;
    if (r !== undefined) return !(r > 0);
    return !(rx > 0) || !(ry > 0);
  };

  it('emits no zero-radius gradient fill on the first frame, before any rAF', () => {
    const originalRequest = global.requestAnimationFrame;
    // Never fire. This is the mount-time state — exactly what the device paints first.
    global.requestAnimationFrame = (() => 1) as any;

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<Bonfire track={null} />);
    });

    const offenders: string[] = [];
    walk(tree!.toJSON(), (node) => {
      if (gradientFilled(node) && degenerate(node)) {
        offenders.push(`${node.type} rx=${node.props.rx} ry=${node.props.ry} r=${node.props.r}`);
      }
    });

    global.requestAnimationFrame = originalRequest;
    expect(offenders).toEqual([]);
  });

  it('emits none once animating either, with a frame actually driven', () => {
    // rAF does not fire synchronously under jest, so a frame has to be run by hand — without
    // this the test would only ever re-measure the mount frame under a misleading name.
    const originalRequest = global.requestAnimationFrame;
    let pending: FrameRequestCallback | null = null;
    global.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      pending = cb;
      return 1;
    }) as any;

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<Bonfire track={null} />);
    });
    act(() => {
      pending?.(1000);
    });

    const offenders: string[] = [];
    walk(tree!.toJSON(), (node) => {
      if (gradientFilled(node) && degenerate(node)) offenders.push(String(node.type));
    });

    global.requestAnimationFrame = originalRequest;

    // The glow must now be present and real, not merely non-degenerate by being absent.
    const drawn: any[] = [];
    walk(tree!.toJSON(), (node) => {
      if (gradientFilled(node)) drawn.push(node);
    });
    expect(offenders).toEqual([]);
    expect(drawn).toHaveLength(1);
    expect(drawn[0].props.rx).toBeGreaterThan(0);
  });
});

describe('only one Bonfire is mounted in the app', () => {
  const appSources = fs
    .readdirSync(path.join(__dirname, '..', '..', 'app'), { recursive: true })
    .map(String)
    .filter((name) => name.endsWith('.tsx'))
    .map((name) => path.join(__dirname, '..', '..', 'app', name));

  const componentSources = fs
    .readdirSync(path.join(__dirname, '..', '..', 'components'))
    .filter((name) => name.endsWith('.tsx') && name !== 'Bonfire.tsx')
    .map((name) => path.join(__dirname, '..', '..', 'components', name));

  it('renders it from exactly one screen', () => {
    const mounting = [...appSources, ...componentSources].filter((file) =>
      /<Bonfire[\s/>]/.test(fs.readFileSync(file, 'utf8')),
    );
    expect(mounting.map((file) => path.basename(file))).toEqual(['player.tsx']);
  });

  it('renders it once within that screen', () => {
    const player = fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'player.tsx'), 'utf8');
    expect(player.match(/<Bonfire[\s/>]/g)).toHaveLength(1);
  });
});
