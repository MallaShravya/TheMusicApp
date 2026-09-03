/**
 * Draws the candidate icons and a page to look at them on.
 *
 *   node preview/icons.js
 *
 * The shape is *found* rather than drawn. An S-bent flame cannot be asked for — the sway is
 * noise, and the tongue leans wherever the noise puts it — so this searches the fire's own
 * frames for one whose main tongue happens to double back on itself, and uses that. The icon
 * is still a moment of the thing it stands for, not an illustration of it.
 */

const fs = require('node:fs');
const path = require('node:path');

const { loadSwayve, settle, outlinesAt, canvas, fill, polygon, log, wave, writePng } = require('./makeIcon');

const OUT = path.join(__dirname, 'icons');

const SIZE = 1024;
const SUPERSAMPLE = 3;

const BLACK = [0, 0, 0];
const WAVE = [0x00, 0x73, 0xfa];

const hex = (rgb) => `#${rgb.map((n) => n.toString(16).padStart(2, '0')).join('')}`.toUpperCase();

/** The app's primary accent, read rather than repeated, so the caption cannot go stale. */
function accentColour() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'theme', 'colors.ts'), 'utf8');
  return source.match(/^\s{2}accent:\s*'([^']+)'/m)[1].toUpperCase();
}

/** A hint of wood: the two widest pieces only, and dark enough to read as shadow. */
const LOGS = [
  { x: -58, y: -2, w: 116, h: 8, rotate: -8, fill: [0x2c, 0x1c, 0x0e] },
  { x: -34, y: 5, w: 92, h: 7, rotate: 7, fill: [0x22, 0x15, 0x0a] },
];

/**
 * The centreline of a tongue, recovered from its outline.
 *
 * `flameOutline` walks up the left edge and back down the right, sharing the tip, so the
 * point opposite index `i` is `2 * steps - i`. Averaging the pair gives the line the flame
 * was actually built around — which is the thing that either bends like an S or does not.
 */
function centreline(points) {
  const steps = (points.length - 1) / 2;
  const line = [];
  for (let i = 0; i < steps; i += 1) {
    line.push({ x: (points[i].x + points[2 * steps - i].x) / 2, y: points[i].y });
  }
  line.push({ x: points[steps].x, y: points[steps].y });
  return line;
}

/**
 * How much a centreline looks like a stretched S.
 *
 * An S doubles back twice: the line leans one way, comes back, and leans again. One turn is a
 * C and none is a candle, so both score nothing. Beyond that, wider bends are better.
 */
function esNess(line) {
  const smoothed = [];
  for (let i = 0; i < line.length; i += 1) {
    const from = Math.max(0, i - 2);
    const to = Math.min(line.length - 1, i + 2);
    let sum = 0;
    for (let j = from; j <= to; j += 1) sum += line[j].x;
    smoothed.push(sum / (to - from + 1));
  }

  let turns = 0;
  let previous = 0;
  for (let i = 1; i < smoothed.length; i += 1) {
    const slope = smoothed[i] - smoothed[i - 1];
    if (Math.abs(slope) < 0.05) continue;
    const sign = Math.sign(slope);
    if (previous !== 0 && sign !== previous) turns += 1;
    previous = sign;
  }

  if (turns !== 2) return 0;

  const spread = Math.max(...smoothed) - Math.min(...smoothed);
  return spread;
}

/** Searches the fire's frames for the one whose tallest tongue bends most like an S. */
function findFrame(R, settings, state) {
  let best = { time: 0, score: -1 };

  for (let time = 0; time < 60; time += 0.05) {
    const shapes = outlinesAt(R, settings, state, time);
    if (shapes.length === 0) continue;

    // The innermost layer of whichever tongue reaches highest: the one the eye reads.
    let main = null;
    let top = Infinity;
    for (let i = settings.layers - 1; i < shapes.length; i += settings.layers) {
      const points = shapes[i].points;
      const highest = Math.min(...points.map((p) => p.y));
      if (highest < top) {
        top = highest;
        main = points;
      }
    }
    if (!main) continue;

    const score = esNess(centreline(main));
    if (score > best.score) best = { time, score };
  }

  return best;
}

function draw(R, variant) {
  const size = SIZE * SUPERSAMPLE;
  const surface = canvas(size);
  fill(surface, BLACK);

  const shapes = outlinesAt(R, variant.settings, variant.state, variant.time);

  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  for (const shape of shapes) {
    for (const point of shape.points) {
      left = Math.min(left, point.x);
      right = Math.max(right, point.x);
      top = Math.min(top, point.y);
    }
  }

  const baseY = R.SCENE.baseY + 4;
  const drawn = { width: right - left, height: baseY - top };
  const margin = variant.margin;
  const scale = Math.min(
    (size * (1 - margin * 2)) / drawn.width,
    (size * (1 - margin * 2)) / drawn.height,
  );

  const offsetX = size / 2 - ((left + right) / 2) * scale;
  // `lift` raises the whole fire off the bottom edge, as a fraction of the icon.
  const offsetY = size * (1 - margin - variant.lift) - baseY * scale;
  const place = (point) => ({ x: point.x * scale + offsetX, y: point.y * scale + offsetY });

  // Wave first, so the flames pass in front of it. The outer flame layers are translucent, so
  // it shows through them rather than being hidden — which is what puts it *behind* rather
  // than merely under.
  wave(surface, {
    colour: WAVE,
    centreY: size * variant.waveY,
    amplitude: size * variant.waveAmplitude,
    cycles: variant.cycles,
    thickness: size * 0.042,
    // Off both edges rather than stopping short of them: a stroke that ends inside the square
    // reads as cut off, and the wave is meant to run through the mark, not sit in it.
    from: 0,
    to: size,
  });

  const orange = R.flameColour(5 / 6);
  const colour = [orange.r, orange.g, orange.b];
  for (const shape of shapes) {
    polygon(surface, shape.points.map(place), colour, shape.alpha);
  }

  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `icon-${variant.id}.png`);
  const bytes = writePng(surface, SUPERSAMPLE, file);
  return { file, bytes };
}

const BASE = {
  layers: 3,
  flutter: 3,
  tipSharpness: 1.9,
  segments: 36,
};

/**
 * Six widths of the same fire.
 *
 * `width` sets both the belly of each tongue and how far apart they stand, since a tongue is
 * offset by a multiple of it — so this one number is the width of the base.
 */
/**
 * The narrow base, zoomed and lifted by varying amounts.
 *
 * `margin` is the breathing room left around the flame: less of it means the fire fills more
 * of the square. `lift` raises it off the bottom edge afterwards, now that there is no wood
 * for it to stand on.
 */
const SHAPES = [
  { id: 'a', label: 'A little closer', margin: 0.08, lift: 0.03 },
  { id: 'b', label: 'Closer still', margin: 0.05, lift: 0.04 },
  { id: 'c', label: 'Close, lifted more', margin: 0.05, lift: 0.08 },
  { id: 'd', label: 'Tight', margin: 0.02, lift: 0.05 },
  { id: 'e', label: 'Tight, lifted more', margin: 0.02, lift: 0.09 },
  { id: 'f', label: 'Filling the square', margin: 0.0, lift: 0.06 },
].map((shape) => ({
  ...shape,
  settings: { ...BASE, tongues: 4, height: 185, width: 16, sway: 46 },
}));

function main() {
  const R = loadSwayve();
  const made = [];

  for (const shape of SHAPES) {
    const state = settle(R, shape.settings, 1);
    const variant = {
      ...shape,
      state,
      // One frame for all of them, so width is the only thing that differs between tiles.
      time: 35.5,
      waveY: 0.5,
      waveAmplitude: 0.075,
      cycles: 1,
    };

    const { file, bytes } = draw(R, variant);
    console.log(`  ${path.basename(file)} — ${(bytes / 1024).toFixed(0)}KB — ${shape.label} — margin ${shape.margin}, lift ${shape.lift}`);
    made.push({ ...variant, data: fs.readFileSync(file).toString('base64') });
  }

  writePage(made);
}

function writePage(made) {
  const accent = accentColour();
  const wave = hex(WAVE);

  const tiles = made
    .map(
      (variant) => `
    <figure>
      <div class="row">
        <img class="big" src="data:image/png;base64,${variant.data}" alt="${variant.label}">
        <div class="sizes">
          <img style="width:96px;height:96px" src="data:image/png;base64,${variant.data}" alt="">
          <img style="width:48px;height:48px" src="data:image/png;base64,${variant.data}" alt="">
          <img style="width:24px;height:24px" src="data:image/png;base64,${variant.data}" alt="">
        </div>
      </div>
      <figcaption>
        <b>${variant.id.toUpperCase()}</b> ${variant.label}
        <span class="meta">margin ${variant.margin} · lift ${variant.lift}</span>
      </figcaption>
    </figure>`,
    )
    .join('\n');

  const html = `<title>Swayve Icon</title>

<meta name="viewport" content="width=device-width, initial-scale=1">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap">

<style>
  :root { --ground: #101014; --panel: #1a1a22; --line: #2a2a34; --ink: #ECEBF2; --muted: #9895A6; color-scheme: dark; }
  body { margin: 0; background: var(--ground); color: var(--ink); font-family: 'IBM Plex Sans', system-ui, sans-serif; font-size: 14px; }
  .page { max-width: 860px; margin: 0 auto; padding: 28px 18px 64px; }
  h1 { margin: 0 0 6px; font-size: 21px; font-weight: 600; }
  header p { margin: 0 0 4px; color: var(--muted); font-size: 13px; max-width: 62ch; }
  header { border-bottom: 1px solid var(--line); padding-bottom: 16px; margin-bottom: 22px; }
  .swatch { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -1px; margin-right: 5px; }
  figure { margin: 0 0 22px; background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 16px; }
  .row { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }
  .big { width: 168px; height: 168px; border-radius: 34px; }
  .sizes { display: flex; align-items: center; gap: 14px; }
  .sizes img { border-radius: 22%; }
  figcaption { margin-top: 12px; color: var(--muted); font-size: 12.5px; }
  figcaption b { color: var(--ink); margin-right: 6px; }
  .meta { display: block; margin-top: 3px; font-size: 11.5px; color: #6A6878; }
</style>

<div class="page">
  <header>
    <h1>Swayve</h1>
    <p>
      The narrow base, no wood, zoomed and lifted by varying amounts. Four tongues, and a wave
      behind them running off both edges.
    </p>
    <p>
      <span class="swatch" style="background:${accent}"></span>accent ${accent}
      &nbsp;&nbsp;<span class="swatch" style="background:${wave}"></span>wave ${wave}
      &nbsp;&nbsp;<span class="swatch" style="background:#000; outline:1px solid #2a2a34"></span>black ground
    </p>
  </header>
${tiles}
</div>
`;

  fs.writeFileSync(path.join(__dirname, 'icons.html'), html);
  console.log(`\n  wrote preview/icons.html`);
}

main();
