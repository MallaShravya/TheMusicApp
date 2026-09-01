import { buildFlameFrame } from '../flameFrame';
import { makeTongues } from '../flameDrive';
import { makeSparkStates } from '../sparks';
import { DEFAULT_FLAME_SETTINGS, SCENE, VIEWPORT } from '../flameSettings';

/**
 * The crop has to actually contain the fire.
 *
 * `VIEWPORT` was chosen by measuring the drawn extent rather than by eye, so this re-measures
 * it. If the defaults are retuned and the flames outgrow the crop, they will be clipped on
 * device with nothing to indicate why — this is what says so instead.
 */
function drawnExtent(settings = DEFAULT_FLAME_SETTINGS) {
  const tongues = makeTongues(settings.tongues);
  const levels = tongues.map(() => 0);
  const sparkStates = makeSparkStates();
  let left = Infinity, right = -Infinity, top = Infinity;
  let brightness = 0;

  for (let i = 0; i < 600; i++) {
    const frame = buildFlameFrame({
      settings, tongues, levels, sparkStates,
      amplitude: 1, brightness: 1, previousBrightness: brightness, time: i / 60,
    });
    brightness = frame.brightness;

    for (const d of frame.paths) {
      const n = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
      for (let k = 0; k + 1 < n.length; k += 2) {
        left = Math.min(left, n[k]);
        right = Math.max(right, n[k]);
        top = Math.min(top, n[k + 1]);
      }
    }
    for (const s of frame.sparks) {
      left = Math.min(left, s.cx - s.r);
      right = Math.max(right, s.cx + s.r);
      top = Math.min(top, s.cy - s.r);
    }
  }
  return { left, right, top };
}

describe('the viewport crop', () => {
  const { left, right, top } = drawnExtent();

  it('contains the flames at the tuned defaults', () => {
    expect(left).toBeGreaterThanOrEqual(VIEWPORT.x);
    expect(right).toBeLessThanOrEqual(VIEWPORT.x + VIEWPORT.width);
    expect(top).toBeGreaterThanOrEqual(VIEWPORT.y);
  });

  it('still contains them at heavy sway, which widens the fire most', () => {
    const swayed = drawnExtent({ ...DEFAULT_FLAME_SETTINGS, sway: 80 });
    expect(swayed.left).toBeGreaterThanOrEqual(VIEWPORT.x);
    expect(swayed.right).toBeLessThanOrEqual(VIEWPORT.x + VIEWPORT.width);
  });

  it('stays inside the scene', () => {
    expect(VIEWPORT.x).toBeGreaterThanOrEqual(0);
    expect(VIEWPORT.x + VIEWPORT.width).toBeLessThanOrEqual(SCENE.width);
    expect(VIEWPORT.y + VIEWPORT.height).toBeLessThanOrEqual(SCENE.height);
  });

  it('leaves enough below the fire that the glow is not cut into a visible edge', () => {
    // The crop bottom is what sets how low the fire sits, since the viewBox is anchored to
    // the bottom of the stage. Trimming it moves the fire down; trimming it too far cuts
    // across the glow while the gradient is still opaque enough to show a seam.
    const belowBase = VIEWPORT.y + VIEWPORT.height - SCENE.baseY;
    expect(belowBase).toBeGreaterThanOrEqual(60);
  });

  it('keeps the log pile fully inside the crop', () => {
    // The widest log spans 124 wide starting 75 left of centre; the pile ends 22 below baseY.
    expect(SCENE.width / 2 - 75).toBeGreaterThanOrEqual(VIEWPORT.x);
    expect(SCENE.width / 2 + 81).toBeLessThanOrEqual(VIEWPORT.x + VIEWPORT.width);
    expect(SCENE.baseY + 22).toBeLessThanOrEqual(VIEWPORT.y + VIEWPORT.height);
  });

  it('is a real crop — otherwise the fire is drawn smaller than it needs to be', () => {
    expect(VIEWPORT.width).toBeLessThan(SCENE.width);
    // Width binds the scale, so this ratio is how much bigger the fire renders.
    expect(SCENE.width / VIEWPORT.width).toBeGreaterThan(1.4);
  });
});
