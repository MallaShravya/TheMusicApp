/**
 * Draws the app icon from the visualiser's own flame maths.
 *
 *   node preview/makeIcon.js
 *
 * Not a drawing of a fire: a frame of *the* fire, using the same `flameOutline` the app
 * animates, so the icon and the thing it stands for are the same shape. It writes real PNGs
 * rather than an approximation to preview, because an icon that looks right as an SVG and
 * wrong once rasterised is a wasted round trip.
 *
 * There is no image library here. A polygon fill and a small PNG writer are about a hundred
 * lines between them, and they are exact — no resampling, no colour management, nothing that
 * could quietly alter a colour that was chosen deliberately.
 */

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');

/* ------------------------------------------------------------------ the flame */

/** The compiled visualiser, taken from a page the builder has already made. */
function loadRatio() {
  const page = fs.readFileSync(path.join(__dirname, 'bonfire-console.html'), 'utf8');
  const bundle = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
  const scope = {};
  new Function('globalThis', `${bundle}\nglobalThis.RATIO = RATIO;`)(scope);
  return scope.RATIO;
}

/**
 * Settles the fire, once.
 *
 * Each tongue follows the loudness on its own clock, so a frame taken at time zero is every
 * tongue at rest — a flat fire, and not the one anybody recognises. This runs the envelopes
 * forward until they stop moving and hands back the state, so that searching a thousand
 * frames does not mean settling it a thousand times.
 */
function settle(R, settings, amplitude) {
  const tongues = R.makeTongues(settings.tongues);
  const levels = tongues.map(() => 0);
  const sparkStates = R.makeSparkStates();

  let brightness = 0;
  for (let i = 0; i < 240; i += 1) {
    const frame = R.buildFlameFrame({
      settings, tongues, levels, sparkStates,
      amplitude, brightness: 1, previousBrightness: brightness, time: i / 60,
    });
    brightness = frame.brightness;
  }

  return { tongues, levels };
}

/** One frame of the settled fire, as polygons. */
function outlinesAt(R, settings, state, time) {
  const heightUnit = settings.height / (R.MAX_REACH * R.HALO_SCALE);
  const shapes = [];

  state.tongues.forEach((tongue, index) => {
    const reach = R.tongueEnergy(tongue, time, state.levels[index]);
    const spread = R.tongueSpread(reach);

    for (let layer = 0; layer < settings.layers; layer += 1) {
      const depth = settings.layers === 1 ? 1 : layer / (settings.layers - 1);
      const scale = R.HALO_SCALE - (R.HALO_SCALE - 1) * depth;

      shapes.push({
        points: R.flameOutline({
          seed: tongue.seed + layer * 0.31,
          time,
          centreX: R.SCENE.width / 2 + tongue.offset * settings.width * 1.45,
          baseY: R.SCENE.baseY,
          height: heightUnit * tongue.restHeight * reach * scale,
          width: settings.width * tongue.restWidth * spread * scale,
          sway: settings.sway * (0.45 + 0.75 * Math.min(1.4, reach)),
          flutter: settings.flutter,
          tipSharpness: settings.tipSharpness,
          segments: settings.segments,
        }),
        alpha: 0.16 + 0.42 * depth,
      });
    }
  });

  return shapes;
}

/* -------------------------------------------------------------- rasterising */

/** An RGBA canvas, drawn at several times the final size and shrunk at the end. */
function canvas(size) {
  return { size, data: new Float64Array(size * size * 4) };
}

function fill(surface, colour) {
  for (let i = 0; i < surface.data.length; i += 4) {
    surface.data[i] = colour[0];
    surface.data[i + 1] = colour[1];
    surface.data[i + 2] = colour[2];
    surface.data[i + 3] = 255;
  }
}

/** Source-over, one pixel. */
function blend(surface, x, y, colour, alpha) {
  if (x < 0 || y < 0 || x >= surface.size || y >= surface.size || alpha <= 0) return;
  const i = (y * surface.size + x) * 4;
  const a = Math.min(1, alpha);
  surface.data[i] = surface.data[i] * (1 - a) + colour[0] * a;
  surface.data[i + 1] = surface.data[i + 1] * (1 - a) + colour[1] * a;
  surface.data[i + 2] = surface.data[i + 2] * (1 - a) + colour[2] * a;
}

/**
 * Fills a polygon by scanline, using the even-odd rule.
 *
 * Even-odd rather than nonzero because a flame outline is a simple closed loop that never
 * crosses itself — the two agree, and this one is shorter.
 */
function polygon(surface, points, colour, alpha) {
  if (points.length < 3) return;

  let top = Infinity;
  let bottom = -Infinity;
  for (const point of points) {
    top = Math.min(top, point.y);
    bottom = Math.max(bottom, point.y);
  }

  const from = Math.max(0, Math.floor(top));
  const to = Math.min(surface.size - 1, Math.ceil(bottom));

  for (let y = from; y <= to; y += 1) {
    const centre = y + 0.5;
    const crossings = [];

    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if (a.y === b.y) continue;
      if (centre < Math.min(a.y, b.y) || centre >= Math.max(a.y, b.y)) continue;
      crossings.push(a.x + ((centre - a.y) / (b.y - a.y)) * (b.x - a.x));
    }

    crossings.sort((p, q) => p - q);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const left = Math.max(0, Math.ceil(crossings[i] - 0.5));
      const right = Math.min(surface.size - 1, Math.floor(crossings[i + 1] - 0.5));
      for (let x = left; x <= right; x += 1) blend(surface, x, y, colour, alpha);
    }
  }
}

/** A rounded rectangle, rotated about its own centre. Used for the logs. */
function log(surface, rect, colour) {
  const radians = (rect.rotate * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;

  const corners = [
    [-rect.w / 2, -rect.h / 2],
    [rect.w / 2, -rect.h / 2],
    [rect.w / 2, rect.h / 2],
    [-rect.w / 2, rect.h / 2],
  ].map(([x, y]) => ({ x: cx + x * cos - y * sin, y: cy + x * sin + y * cos }));

  polygon(surface, corners, colour, 1);
}

/** A sine, stroked with a flat cap, drawn point by point down its thickness. */
function wave(surface, options) {
  const { colour, centreY, amplitude, cycles, thickness, from, to } = options;

  for (let x = Math.floor(from); x <= Math.ceil(to); x += 1) {
    const across = (x - from) / (to - from);
    const y = centreY + Math.sin(across * cycles * 2 * Math.PI) * amplitude;

    for (let offset = -thickness / 2; offset <= thickness / 2; offset += 0.5) {
      const at = Math.round(y + offset);
      // Feathered at the edges, or the stroke has a staircase down both sides.
      const edge = 1 - Math.abs(offset) / (thickness / 2);
      blend(surface, x, at, colour, Math.min(1, edge * 3));
    }
  }
}

/* -------------------------------------------------------------------- output */

function crc32(buffer) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }

  let crc = -1;
  for (const byte of buffer) crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, body) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length, 0);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed), 0);
  return Buffer.concat([length, typed, crc]);
}

/** Shrinks by averaging, then writes a PNG. Averaging is the whole of the antialiasing. */
function writePng(surface, factor, file) {
  const size = surface.size / factor;
  const rows = [];

  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(size * 4 + 1);
    row[0] = 0; // filter: none
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < factor; sy += 1) {
        for (let sx = 0; sx < factor; sx += 1) {
          const i = ((y * factor + sy) * surface.size + (x * factor + sx)) * 4;
          r += surface.data[i];
          g += surface.data[i + 1];
          b += surface.data[i + 2];
        }
      }
      const count = factor * factor;
      row.writeUInt8(Math.round(r / count), 1 + x * 4);
      row.writeUInt8(Math.round(g / count), 2 + x * 4);
      row.writeUInt8(Math.round(b / count), 3 + x * 4);
      row.writeUInt8(255, 4 + x * 4);
    }
    rows.push(row);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // truecolour with alpha
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);

  fs.writeFileSync(file, png);
  return png.length;
}

module.exports = { loadRatio, settle, outlinesAt, canvas, fill, polygon, log, wave, writePng, blend };
