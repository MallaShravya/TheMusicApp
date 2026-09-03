/**
 * Runs a built preview page against a stub DOM, to prove it actually starts.
 *
 *   node preview/smoke.js            # every page
 *   node preview/smoke.js sargam     # one of them
 *
 * `node --check` was not enough, twice. Deleting a section of a page left code that still
 * parsed perfectly and threw the moment it ran: once on a readout element that no longer
 * existed, once on a variable whose declaration had gone with the block around it. In both
 * cases the error killed the setup function before it reached `addEventListener`, so every
 * button on the page silently did nothing — and the build reported success.
 *
 * This executes both script blocks the way a browser would, with just enough of a DOM to get
 * through initialisation, and then checks that every button on the page actually had a
 * listener attached. That second half was added after a page initialised perfectly and still
 * did nothing, because an edit had removed two `addEventListener` lines along with the block
 * they sat next to — no error, no warning, just dead controls.
 *
 * It cannot tell you the page looks right. It can tell you the page is not dead.
 */

const fs = require('node:fs');
const path = require('node:path');

/** Anything can be called on this and anything can be set; reads of unknown keys are no-ops. */
function loose(overrides = {}) {
  const store = { ...overrides };
  return new Proxy(store, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === Symbol.toPrimitive || key === 'toString') return () => '';
      return () => loose();
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
    has: () => true,
  });
}

function element(id, listeners) {
  return loose({
    id,
    value: '10',
    textContent: '',
    innerHTML: '',
    className: '',
    clientWidth: 400,
    clientHeight: 150,
    width: 400,
    height: 150,
    dataset: {},
    style: loose(),
    classList: loose({ toggle: () => false, add: () => {}, remove: () => {}, contains: () => false }),
    addEventListener: (type) => {
      if (listeners) listeners.add(`${id}:${type}`);
    },
    // A real appendChild hands the child back, and pages chain off it.
    appendChild: (child) => child,
    removeChild: (child) => child,
    setAttribute: () => {},
    getAttribute: () => null,
    getContext: () => loose({ setTransform: () => {}, clearRect: () => {} }),
    firstChild: null,
  });
}

function run(file) {
  const html = fs.readFileSync(file, 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

  // A page with no script is a still image — icons, palettes, device mockups. Nothing
  // initialises, nothing is wired, so there is nothing here to prove.
  if (blocks.length === 0) return null;

  // Only ids the page actually declares, so a lookup for something removed comes back null
  // exactly as it would in a browser.
  const ids = new Set([...html.matchAll(/id="([A-Za-z0-9_-]+)"/g)].map((m) => m[1]));
  const buttons = [...html.matchAll(/<button[^>]*\sid="([A-Za-z0-9_-]+)"/g)].map((m) => m[1]);
  const elements = new Map();
  const listeners = new Set();

  const sandbox = {
    document: loose({
      getElementById: (id) => {
        if (!ids.has(id)) return null;
        if (!elements.has(id)) elements.set(id, element(id, listeners));
        return elements.get(id);
      },
      createElement: () => element('created', null),
      createElementNS: () => element('created', null),
      querySelector: () => null,
      querySelectorAll: () => [],
      head: element('head', null),
      body: element('body', null),
    }),
    window: loose({
      innerWidth: 412,
      innerHeight: 900,
      devicePixelRatio: 2,
      addEventListener: () => {},
      AudioContext: function AudioContext() {
        return loose({
          currentTime: 0,
          state: 'running',
          destination: loose(),
          createGain: () => loose({ gain: loose({ setValueAtTime: () => {}, linearRampToValueAtTime: () => {} }), connect: () => loose() }),
          createAnalyser: () => loose({ fftSize: 2048, connect: () => loose(), getByteTimeDomainData: () => {} }),
          createOscillator: () => loose({ frequency: loose(), connect: () => loose(), start: () => {}, stop: () => {} }),
          resume: () => {},
        });
      },
    }),
    // Never actually schedules: a recursing draw loop would run forever here.
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    setTimeout: () => 1,
    clearTimeout: () => {},
    console,
    Math,
    Number,
    String,
    Array,
    Object,
    JSON,
    Float32Array,
    Uint8Array,
    Set,
    Map,
    isNaN,
    parseFloat,
    parseInt,
  };

  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;

  const names = Object.keys(sandbox);
  const values = names.map((n) => sandbox[n]);

  // The bundle first, then the page's own code, sharing one scope as in a browser.
  // Only a built page carries the bundle in its first block. A hand-written page's first
  // script is its own code, and re-exporting a global it never defined would be the one
  // thing that threw.
  const exportsBundle = /\bvar SWAYVE\b/.test(blocks[0]);
  const source = exportsBundle
    ? `${blocks[0]}\n;globalThis.SWAYVE = SWAYVE;\n${blocks.slice(1).join('\n')}`
    : blocks.join('\n');

  try {
    new Function(...names, source)(...values);
  } catch (error) {
    return error;
  }

  // A button nobody listened to is a button that does nothing. The page starts, the build
  // passes, and the control is dead — which is exactly what happened, so it is checked.
  const dead = buttons.filter((id) => !listeners.has(`${id}:click`));
  if (dead.length) {
    return new Error(`no click listener on: ${dead.join(', ')}`);
  }

  return null;
}

const only = process.argv[2];
const pages = fs
  .readdirSync(__dirname)
  .filter((name) => name.endsWith('.html') && !name.includes('.template.'))
  .filter((name) => !only || name.includes(only));

let failed = 0;

for (const page of pages) {
  const error = run(path.join(__dirname, page));
  if (error) {
    failed += 1;
    console.error(`  ${page}: ${error.message}`);
    const line = (error.stack ?? '').split('\n')[1];
    if (line) console.error(`    ${line.trim()}`);
  } else {
    console.log(`  ${page}: initialises, all buttons wired`);
  }
}

if (failed) {
  console.error(`\n${failed} page(s) throw on load — every control on them would be dead.`);
  process.exit(1);
}
