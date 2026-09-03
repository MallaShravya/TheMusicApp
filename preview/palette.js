/**
 * Shows the app's screens in the new palette.
 *
 *   node preview/palette.js
 *
 * Built from the app's real theme file rather than a copy of it, so a colour that is wrong
 * here is wrong in the app and a colour that is right here needs no second edit. The screens
 * are mocks — the point is where the two accents fall, not the layout.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

/** The theme, read straight out of the TypeScript. */
function palette() {
  const source = fs.readFileSync(path.join(ROOT, 'src', 'theme', 'colors.ts'), 'utf8');
  const found = {};
  for (const [, key, value] of source.matchAll(/^\s{2}(\w+):\s*'([^']+)'/gm)) {
    found[key] = value;
  }
  return found;
}

const c = palette();
const icon = fs.readFileSync(path.join(__dirname, 'icons', 'icon-e.png')).toString('base64');

const html = `<title>Swayve Palette</title>

<meta name="viewport" content="width=device-width, initial-scale=1">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Roboto:wght@400;500;700&display=swap">

<style>
  :root {
    --bg: ${c.bg};
    --surface: ${c.surface};
    --line: ${c.border};
    --text: ${c.text};
    --muted: ${c.textMuted};
    --faint: ${c.textFaint};
    --accent: ${c.accent};
    --accent-soft: ${c.accentSoft};
    --second: ${c.accentSecondary};
    --second-soft: ${c.accentSecondarySoft};
    --danger: ${c.danger};
    color-scheme: dark;
  }

  body {
    margin: 0;
    background: #0a0a0e;
    color: var(--text);
    font-family: Roboto, system-ui, sans-serif;
    font-size: 14px;
  }

  .page { max-width: 1000px; margin: 0 auto; padding: 26px 18px 64px; }
  header { border-bottom: 1px solid var(--line); padding-bottom: 16px; margin-bottom: 22px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  header img { width: 64px; height: 64px; border-radius: 14px; }
  h1 { margin: 0 0 2px; font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }
  header p { margin: 0; color: var(--muted); font-size: 13px; }

  h2 { margin: 26px 0 10px; font-size: 10.5px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--faint); }

  .tokens { display: flex; flex-wrap: wrap; gap: 10px; }
  .token { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; min-width: 132px; }
  .token .chip { width: 100%; height: 26px; border-radius: 6px; margin-bottom: 8px; }
  .token b { display: block; font-size: 12px; font-weight: 500; }
  .token span { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--muted); }

  .screens { display: flex; gap: 20px; flex-wrap: wrap; }
  .phone {
    width: 300px; background: var(--bg); border-radius: 22px; border: 1px solid var(--line);
    overflow: hidden; display: flex; flex-direction: column;
  }
  .phone .bar { padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; }
  .phone .title { font-size: 16px; font-weight: 700; }
  .caption { color: var(--faint); font-size: 11.5px; margin: 8px 2px 0; }

  .row { display: flex; align-items: center; gap: 11px; padding: 9px 14px; }
  .row .art { width: 40px; height: 40px; border-radius: 6px; background: #23232e; flex: none; }
  .row .meta { flex: 1; min-width: 0; }
  .row .name { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row .sub { font-size: 12px; color: var(--muted); }
  .row.playing .name { color: var(--accent); font-weight: 500; }
  .row.playing .art { outline: 2px solid var(--accent); }
  .row .tag {
    font-size: 10px; padding: 2px 6px; border-radius: 999px;
    background: var(--second-soft); color: var(--second); border: 1px solid var(--second);
  }

  .seek { padding: 4px 14px 10px; }
  .seek .track { height: 4px; border-radius: 2px; background: #2a2a36; position: relative; }
  .seek .fill { position: absolute; inset: 0 auto 0 0; width: 42%; border-radius: 2px; background: var(--accent); }
  .seek .thumb { position: absolute; left: 42%; top: 50%; width: 13px; height: 13px; margin: -6.5px 0 0 -6.5px; border-radius: 50%; background: var(--text); }
  .seek .times { display: flex; justify-content: space-between; font-size: 11px; color: var(--faint); margin-top: 5px; }

  .transport { display: flex; align-items: center; justify-content: space-between; padding: 6px 18px 16px; }
  .transport .glyph { color: var(--text); font-size: 20px; }
  .transport .dim { color: var(--muted); font-size: 15px; }
  .transport .play {
    width: 54px; height: 54px; border-radius: 50%; background: var(--accent);
    display: flex; align-items: center; justify-content: center; color: #1a1000; font-size: 20px;
  }

  .tabs { display: flex; border-top: 1px solid var(--line); }
  .tab { flex: 1; text-align: center; padding: 9px 0 11px; font-size: 10.5px; color: var(--faint); }
  .tab.on { color: var(--accent); }
  .tab .glyph { display: block; font-size: 17px; margin-bottom: 2px; }

  .btn {
    flex: 1; text-align: center; padding: 11px 0; border-radius: 9px; font-size: 13px;
    font-weight: 500; border: 1px solid var(--line); background: var(--surface); color: var(--text);
  }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: #1a1000; }
  .btn.secondary { background: var(--second); border-color: var(--second); color: #fff; }
  .actions { display: flex; gap: 8px; padding: 12px 14px 4px; }

  .slider { padding: 8px 14px; }
  .slider .label { display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); margin-bottom: 6px; }
  .slider .rail { height: 3px; background: #2a2a36; border-radius: 2px; position: relative; }
  .slider .done { position: absolute; inset: 0 auto 0 0; background: var(--accent); border-radius: 2px; }
  .slider .knob { position: absolute; top: 50%; width: 15px; height: 15px; margin: -7.5px 0 0 -7.5px; border-radius: 50%; background: var(--accent); }

  .switch { display: flex; align-items: center; justify-content: space-between; padding: 9px 14px; font-size: 13px; }
  .switch .toggle { width: 40px; height: 22px; border-radius: 11px; background: var(--accent); position: relative; }
  .switch .toggle.off { background: #2f2f3b; }
  .switch .toggle i { position: absolute; top: 3px; left: 21px; width: 16px; height: 16px; border-radius: 50%; background: #fff; }
  .switch .toggle.off i { left: 3px; }

  .chips { display: flex; flex-wrap: wrap; gap: 5px; padding: 4px 14px 12px; }
  .chips span {
    font-family: 'IBM Plex Mono', monospace; font-size: 12px; padding: 4px 7px;
    border-radius: 5px; background: var(--surface); border: 1px solid var(--line);
  }
  .chips span.loop { background: var(--second-soft); border-color: var(--second); }

  .fire { height: 150px; background: #000; display: flex; align-items: flex-end; justify-content: center; }
  .fire img { width: 120px; height: 120px; }
</style>

<div class="page">
  <header>
    <img src="data:image/png;base64,${icon}" alt="Swayve">
    <div>
      <h1>Swayve</h1>
      <p>Orange leads, blue marks what the app made rather than what it found.</p>
    </div>
  </header>

  <h2>The two accents</h2>
  <div class="tokens">
    <div class="token"><div class="chip" style="background:${c.accent}"></div><b>Primary</b><span>${c.accent}</span></div>
    <div class="token"><div class="chip" style="background:${c.accentSecondary}"></div><b>Secondary</b><span>${c.accentSecondary}</span></div>
    <div class="token"><div class="chip" style="background:${c.bg}; outline:1px solid ${c.border}"></div><b>Background</b><span>${c.bg}</span></div>
    <div class="token"><div class="chip" style="background:${c.surface}"></div><b>Surface</b><span>${c.surface}</span></div>
    <div class="token"><div class="chip" style="background:${c.text}"></div><b>Text</b><span>${c.text}</span></div>
    <div class="token"><div class="chip" style="background:${c.danger}"></div><b>Danger</b><span>${c.danger}</span></div>
  </div>

  <h2>In place</h2>
  <div class="screens">

    <div>
      <div class="phone">
        <div class="bar"><span class="title">Songs</span><span class="dim" style="color:var(--muted)">search</span></div>
        <div class="row playing">
          <div class="art"></div>
          <div class="meta"><div class="name">Nocturne in E-flat</div><div class="sub">Frédéric Chopin</div></div>
          <span class="dim" style="color:var(--accent)">▮▮</span>
        </div>
        <div class="row"><div class="art"></div><div class="meta"><div class="name">Raga Brindavani Sarang</div><div class="sub">Buddhadev DasGupta</div></div></div>
        <div class="row">
          <div class="art"></div>
          <div class="meta"><div class="name">Piece 3/9 01:42</div><div class="sub">Swayve</div></div>
          <span class="tag">made</span>
        </div>
        <div class="row"><div class="art"></div><div class="meta"><div class="name">Kind of Blue</div><div class="sub">Miles Davis</div></div></div>
        <div class="row">
          <div class="art"></div>
          <div class="meta"><div class="name">Piece 2/9 23:10</div><div class="sub">Swayve</div></div>
          <span class="tag">made</span>
        </div>
        <div class="tabs">
          <div class="tab on"><span class="glyph">♪</span>Songs</div>
          <div class="tab"><span class="glyph">▦</span>Albums</div>
          <div class="tab"><span class="glyph">≡</span>Playlists</div>
          <div class="tab"><span class="glyph">✧</span>Generate</div>
        </div>
      </div>
      <p class="caption">The playing track takes the primary. Generated tracks are tagged in the secondary.</p>
    </div>

    <div>
      <div class="phone">
        <div class="bar"><span class="dim" style="color:var(--muted)">▾</span><span style="font-size:12px;color:var(--muted)">Nocturnes, Op. 9</span><span style="color:var(--accent)">◈</span></div>
        <div class="fire"><img src="data:image/png;base64,${icon}" alt=""></div>
        <div style="padding:12px 14px 0"><div style="font-size:20px;font-weight:700">Nocturne in E-flat</div><div style="font-size:12px;color:var(--muted)">Frédéric Chopin</div></div>
        <div class="seek">
          <div class="track"><div class="fill"></div><div class="thumb"></div></div>
          <div class="times"><span>2:14</span><span>5:51</span></div>
        </div>
        <div class="transport">
          <span class="dim">⤨</span><span class="glyph">⏮</span><span class="play">❚❚</span><span class="glyph">⏭</span><span class="dim">⟲</span>
        </div>
      </div>
      <p class="caption">Now Playing. The scrubber, the play button and the flame toggle all take the primary.</p>
    </div>

    <div>
      <div class="phone">
        <div class="bar"><span class="title">Generate</span><span style="font-size:11.5px;color:var(--muted)">120 beats · 20.0s</span></div>
        <div class="actions">
          <div class="btn primary">Generate</div>
          <div class="btn">Play</div>
          <div class="btn secondary">Keep</div>
        </div>
        <div class="chips">
          <span>D</span><span>M#</span><span class="loop">P</span><span class="loop">D</span><span class="loop">n</span><span class="loop">D</span><span>_</span><span>P</span><span>D</span><span class="loop">P</span><span class="loop">D</span><span class="loop">n</span><span class="loop">D</span><span>-</span>
        </div>
        <div class="slider">
          <div class="label"><span>Beats per minute</span><span>360</span></div>
          <div class="rail"><div class="done" style="width:58%"></div><div class="knob" style="left:58%"></div></div>
        </div>
        <div class="slider">
          <div class="label"><span>Overlap</span><span>40</span></div>
          <div class="rail"><div class="done" style="width:27%"></div><div class="knob" style="left:27%"></div></div>
        </div>
        <div class="switch"><span>Shuddha only</span><span class="toggle"><i></i></span></div>
        <div class="switch"><span>Fixed midpoint</span><span class="toggle"><i></i></span></div>
        <div class="switch"><span>Squash</span><span class="toggle off"><i></i></span></div>
        <div style="height:10px"></div>
      </div>
      <p class="caption">Generate. Keep takes the secondary, since it is the one action that makes something new; repeated stretches are tinted in it too.</p>
    </div>

  </div>

  <h2>Where the secondary is used</h2>
  <p style="color:var(--muted); font-size:13px; max-width:64ch">
    Only for what the app made rather than what it found: the Keep action, the tag on a
    generated track, the repeated stretches in a phrase, and the wave in the icon. Everything
    that is about <em>playing</em> stays orange, so the two never compete for the same meaning.
    Say if you would rather it fell somewhere else.
  </p>
</div>
`;

fs.writeFileSync(path.join(__dirname, 'palette.html'), html);
console.log('  wrote preview/palette.html');
console.log(`  primary ${c.accent}, secondary ${c.accentSecondary}, on ${c.bg}`);
