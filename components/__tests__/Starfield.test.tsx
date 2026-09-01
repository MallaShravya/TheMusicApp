import React from 'react';
import renderer, { act } from 'react-test-renderer';

import { Starfield } from '../Starfield';

/**
 * The first layout pass reports a zero-sized view, and a zero-sized `viewBox` is the shape
 * that has already crashed this app once. The component must draw nothing until it has been
 * measured — this is what says so.
 */
function layout(tree: renderer.ReactTestRenderer, width: number, height: number) {
  const view = tree.root.findAll((n) => typeof n.props?.onLayout === 'function')[0];
  act(() => {
    view.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width, height } } });
  });
}

function svgNodes(tree: renderer.ReactTestRenderer) {
  const found: any[] = [];
  const walk = (n: any) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (typeof n.props?.viewBox === 'string' || n.props?.bbWidth !== undefined) found.push(n);
    (n.children ?? []).forEach(walk);
  };
  walk(tree.toJSON());
  return found;
}

describe('Starfield', () => {
  const originalRequest = global.requestAnimationFrame;
  beforeEach(() => {
    global.requestAnimationFrame = (() => 1) as any;
  });
  afterEach(() => {
    global.requestAnimationFrame = originalRequest;
  });

  it('draws nothing before it has been measured', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<Starfield />);
    });
    expect(svgNodes(tree!)).toHaveLength(0);
  });

  it('draws nothing when measured at zero, which the first pass reports', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<Starfield />);
    });
    layout(tree!, 0, 0);
    expect(svgNodes(tree!)).toHaveLength(0);
  });

  it('draws stars once it has a real size', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<Starfield />);
    });
    layout(tree!, 390, 420);

    const circles: any[] = [];
    const walk = (n: any) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) return n.forEach(walk);
      if (String(n.type).includes('Circle')) circles.push(n);
      (n.children ?? []).forEach(walk);
    };
    walk(tree!.toJSON());

    expect(circles.length).toBeGreaterThan(10);
    for (const circle of circles) {
      expect(circle.props.r).toBeGreaterThan(0);
      expect(Number.isFinite(circle.props.cx)).toBe(true);
      expect(Number.isFinite(circle.props.cy)).toBe(true);
    }
  });

  it('releases its animation frame on unmount', () => {
    const cancelled: number[] = [];
    const originalCancel = global.cancelAnimationFrame;
    global.cancelAnimationFrame = ((id: number) => cancelled.push(id)) as any;

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<Starfield />);
    });
    act(() => {
      tree!.unmount();
    });

    global.cancelAnimationFrame = originalCancel;
    expect(cancelled.length).toBeGreaterThan(0);
  });
});
