/**
 * Builds the Bonfire Console preview.
 *
 *   node preview/build.js
 *
 * Compiles the visualiser modules out of `src/visualiser`, wraps them in a tiny module
 * registry, drops them into the template at `__SWAYVE_BUNDLE__`, and refuses to write the
 * page unless both script blocks actually parse.
 *
 * This exists because the preview was twice corrupted by editing the built page in place:
 * offsets into the HTML were computed, *then* other edits shifted the string, and the stale
 * offsets sliced through the middle of the bundle. Nothing here indexes into the output —
 * the template owns the page, this owns the bundle, and they meet at one placeholder.
 *
 * Edit `bonfire-console.template.html`, never `bonfire-console.html`.
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..');
const PLACEHOLDER = '/*__SWAYVE_BUNDLE__*/';

/**
 * The pages built from `src/visualiser`. `blocks` is how many `<script>` blocks the page is
 * expected to have — every one of them is parsed before anything is written.
 */
const TARGETS = [
  { template: 'bonfire-console.template.html', output: 'bonfire-console.html', blocks: 2 },
  { template: 'pixel.template.html', output: 'pixel.html', blocks: 2 },
  { template: 'swatches.template.html', output: 'swatches.html', blocks: 2 },
  { template: 'sargam.template.html', output: 'sargam.html', blocks: 2 },
  {
    template: 'continuous.template.html',
    output: 'continuous.html',
    blocks: 2,
    // Only this page needs the glide, and adding it to every bundle would change pages that
    // are meant to stay exactly as they are.
    extra: ['glide'],
  },
];

/**
 * Dependency order, not alphabetical: each module's `require` is resolved against what has
 * already been registered, so a module must appear after everything it imports.
 */
const MODULES = [
  'noise',
  'fft',
  'flameColour',
  'features',
  'envelope',
  'flameShape',
  'flameDrive',
  'flameSettings',
  'trackAnalysis',
  'sparks',
  'flameFrame',
  'starField',
];

/** Modules from `src/generator`, compiled and registered the same way. */
/**
 * Modules from `src/generator`, compiled and registered the same way.
 *
 * `perlin`, `golden` and `glide` are deliberately absent: they are still in the repo
 * with their tests, but nothing on a preview page uses them any more, and carrying
 * dead code into the bundle only makes it harder to see what a page depends on.
 */
const GENERATOR_MODULES = ['swara', 'wav', 'randomNotes', 'schedule'];

/** Every generator module any page asks for, compiled once. */
const ALL_GENERATOR = [
  ...new Set([...GENERATOR_MODULES, ...TARGETS.flatMap((target) => target.extra ?? [])]),
];

function compile(outDir) {
  const config = path.join(os.tmpdir(), `ratio-preview-${process.pid}.json`);

  // Every path here is absolute on purpose. Paths inside a tsconfig resolve relative to the
  // config file, not the working directory, and this config lives in the temp directory —
  // relative paths silently looked for the source under %TEMP% and reported every file
  // missing.
  const sourceDir = path.join(ROOT, 'src', 'visualiser');

  fs.writeFileSync(
    config,
    JSON.stringify({
      compilerOptions: {
        strict: true,
        module: 'commonjs',
        target: 'es2020',
        rootDir: path.join(ROOT, 'src'),
        outDir,
        skipLibCheck: true,
        removeComments: true,
      },
      files: [
        ...MODULES.map((name) => path.join(sourceDir, `${name}.ts`)),
        ...ALL_GENERATOR.map((name) => path.join(ROOT, 'src', 'generator', `${name}.ts`)),
      ],
    }),
  );

  try {
    execFileSync('npx', ['tsc', '-p', config], { cwd: ROOT, stdio: 'pipe', shell: true });
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    // tsc reports a deprecation notice on this Node/TS pairing that is not a build failure.
    const real = output.split('\n').filter((line) => line.trim() && !/TS5107|aka\.ms\/ts6/.test(line));
    if (real.length) {
      throw new Error(`TypeScript failed:\n${real.join('\n')}`);
    }
  } finally {
    fs.rmSync(config, { force: true });
  }
}

function assemble(outDir, extra = []) {
  const parts = [
    '// Compiled from src/visualiser/*.ts by preview/build.js — the shipping code, not a copy.',
    'var __m = {};',
    "function __req(id){ return __m[id.replace('./','')]; }",
  ];

  const all = [
    ...MODULES.map((name) => ({ name, file: path.join(outDir, 'visualiser', `${name}.js`) })),
    ...[...GENERATOR_MODULES, ...extra].map((name) => ({
      name,
      file: path.join(outDir, 'generator', `${name}.js`),
    })),
  ];

  for (const { name, file } of all) {
    const code = fs.readFileSync(file, 'utf8');
    // Written out plainly. An earlier version built this with a template literal whose
    // opening brace was escaped and whose closing brace was not, which left every module
    // with one brace too many.
    parts.push(
      `__m['${name}'] = (function () { var exports = {}; var require = __req;\n${code}\nreturn exports; })();`,
    );
  }

  parts.push(`var SWAYVE = Object.assign({}, ${all.map(({ name }) => `__m['${name}']`).join(', ')});`);
  return parts.join('\n');
}

/** Every `<script>` block in the page has to parse, or the page is not written. */
function verify(html, expected) {
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  if (blocks.length !== expected) {
    throw new Error(`expected ${expected} script blocks, found ${blocks.length}`);
  }

  blocks.forEach((block, index) => {
    const file = path.join(os.tmpdir(), `ratio-block-${process.pid}-${index}.js`);
    fs.writeFileSync(file, block);
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    } catch (error) {
      throw new Error(`script block ${index} does not parse:\n${error.stderr}`);
    } finally {
      fs.rmSync(file, { force: true });
    }
  });

  return blocks;
}

function main() {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ratio-preview-'));

  try {
    compile(outDir);
    console.log(`${MODULES.length + ALL_GENERATOR.length} modules compiled`);

    for (const target of TARGETS) {
      const bundle = assemble(outDir, target.extra ?? []);
      const templatePath = path.join(__dirname, target.template);
      if (!fs.existsSync(templatePath)) {
        console.log(`  skipped ${target.output} — no template`);
        continue;
      }

      const template = fs.readFileSync(templatePath, 'utf8');
      if (!template.includes(PLACEHOLDER)) {
        throw new Error(`${target.template} is missing ${PLACEHOLDER}`);
      }

      // One substitution, on a string nothing else has touched. No offsets anywhere.
      const html = template.replace(PLACEHOLDER, () => bundle);
      const blocks = verify(html, target.blocks);

      fs.writeFileSync(path.join(__dirname, target.output), html);
      console.log(`  built ${target.output} — blocks ${blocks.map((b) => `${b.length}B`).join(', ')}, all parse`);
    }

    // Parsing is not running. Twice now a page has been written that parsed cleanly and threw
    // on load, which kills every listener and leaves a page whose buttons do nothing.
    console.log('');
    execFileSync(process.execPath, [path.join(__dirname, 'smoke.js')], { stdio: 'inherit' });
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}

main();
