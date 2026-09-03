/**
 * The app on a phone screen, in the current palette.
 *
 *   node preview/phone.js
 *
 * Drawn at the Pixel 6 Pro's real logical size — 412 by 892 points — rather than at whatever
 * a browser column happens to be, so the type, the spacing and the accents are the size a
 * thumb will actually meet them at. Colours come out of `src/theme/colors.ts`, so this cannot
 * disagree with the app.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function palette() {
  const source = fs.readFileSync(path.join(ROOT, 'src', 'theme', 'colors.ts'), 'utf8');
  const found = {};
  for (const [, key, value] of source.matchAll(/^\s{2}(\w+):\s*'([^']+)'/gm)) found[key] = value;
  return found;
}

// The icon the app actually ships, not a candidate out of preview/icons — those are rewritten
// every time the icon script runs, so a preview that reads them can quietly fall out of step
// with the build.
const icon = fs.readFileSync(path.join(ROOT, 'assets', 'icon.png')).toString('base64');

/**
 * The pair the app carried before this change, kept so the two can be compared like for like.
 * Comparing the new colours in a phone frame against the old ones in a card mock would be
 * comparing the frame as much as the colour.
 */
const PREVIOUS = {
  accent: '#FFA000',
  accentSoft: 'rgba(255, 160, 0, 0.16)',
  accentSecondary: '#005FFF',
  accentSecondarySoft: 'rgba(0, 95, 255, 0.16)',
};

function page(c, note) {
  return `<title>Swayve on a Phone</title>

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
    color-scheme: dark;
  }

  body { margin: 0; background: #08080b; color: var(--text); font-family: Roboto, system-ui, sans-serif; }

  .page { max-width: 1180px; margin: 0 auto; padding: 24px 16px 60px; }

  header { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; border-bottom: 1px solid var(--line); padding-bottom: 14px; margin-bottom: 20px; }
  header img { width: 56px; height: 56px; border-radius: 13px; }
  h1 { margin: 0; font-size: 21px; font-weight: 700; }
  header p { margin: 2px 0 0; color: var(--muted); font-size: 12.5px; }
  .swatches { margin-left: auto; display: flex; gap: 8px; }
  .sw { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--muted); text-align: center; }
  .sw i { display: block; width: 54px; height: 26px; border-radius: 6px; margin-bottom: 4px; }

  .rail { display: flex; gap: 26px; flex-wrap: wrap; align-items: flex-start; }
  .holder { width: 268px; }
  .scaler { transform: scale(0.65); transform-origin: top left; width: 412px; height: 892px; }
  .holder { height: 600px; }
  .label { margin-top: -8px; color: var(--faint); font-size: 11.5px; }

  /* 412x892 is the Pixel 6 Pro's logical screen. Everything inside is at real point size. */
  .device {
    width: 412px; height: 892px; background: var(--bg); border-radius: 30px;
    overflow: hidden; display: flex; flex-direction: column;
    font-size: 14px; box-shadow: 0 20px 50px -18px rgba(0,0,0,0.9);
  }

  .inset { height: 44px; flex: none; }
  .bar { height: 50px; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex: none; }
  .bar .title { font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }
  .bar .sub { font-size: 12px; color: var(--muted); }

  .row { display: flex; align-items: center; gap: 12px; padding: 10px 16px; }
  .row .art { width: 46px; height: 46px; border-radius: 7px; background: #23232e; flex: none; }
  .row .meta { flex: 1; min-width: 0; }
  .row .name { font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row .sub { font-size: 12.5px; color: var(--muted); margin-top: 1px; }
  .row.playing .name { color: var(--accent); font-weight: 500; }
  .row.playing .art { outline: 2px solid var(--accent); outline-offset: -2px; }
  .bars { display: flex; align-items: flex-end; gap: 2px; height: 15px; }
  .bars i { width: 3px; background: var(--accent); border-radius: 1px; }
  .tag { font-size: 10.5px; padding: 2px 7px; border-radius: 999px; background: var(--second-soft); color: var(--second); border: 1px solid var(--second); }

  .fire { flex: 1; background: #000; display: flex; align-items: center; justify-content: center; }
  .fire img { width: 210px; height: 210px; }

  .details { padding: 14px 24px 0; }
  .details .track { font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }
  .details .artist { font-size: 13px; color: var(--muted); margin-top: 2px; }

  .seek { padding: 14px 24px 0; }
  .seek .rail2 { height: 4px; border-radius: 2px; background: #2a2a36; position: relative; }
  .seek .fill { position: absolute; inset: 0 auto 0 0; width: 38%; border-radius: 2px; background: var(--accent); }
  .seek .thumb { position: absolute; left: 38%; top: 50%; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%; background: var(--text); }
  .seek .times { display: flex; justify-content: space-between; font-size: 12px; color: var(--faint); margin-top: 6px; }

  .transport { height: 66px; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; }
  .transport .g { font-size: 26px; color: var(--text); }
  .transport .d { font-size: 19px; color: var(--muted); }
  .transport .play { width: 66px; height: 66px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; color: #1a0e00; font-size: 24px; }

  .tabs { display: flex; border-top: 1px solid var(--line); flex: none; padding-bottom: 18px; }
  .tab { flex: 1; text-align: center; padding: 9px 0 0; font-size: 10.5px; color: var(--faint); }
  .tab.on { color: var(--accent); }
  .tab .g { display: block; font-size: 20px; margin-bottom: 2px; }

  .actions { display: flex; gap: 10px; padding: 10px 16px 6px; }
  .btn { flex: 1; text-align: center; padding: 13px 0; border-radius: 10px; font-size: 13.5px; font-weight: 600; border: 1px solid var(--line); background: var(--surface); }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: #1a0e00; }
  .btn.secondary { background: var(--second); border-color: var(--second); color: #fff; }

  .section { font-size: 10.5px; letter-spacing: 0.12em; color: var(--faint); padding: 14px 16px 6px; }

  .phrase { margin: 0 16px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; font-family: 'IBM Plex Mono', monospace; font-size: 13px; line-height: 1.7; color: var(--text); }

  .chips { display: flex; flex-wrap: wrap; gap: 5px; padding: 8px 16px 0; }
  .chips span { font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; padding: 4px 8px; border-radius: 6px; background: var(--surface); border: 1px solid var(--line); }
  .chips span.loop { background: var(--second-soft); border-color: var(--second); }

  .slider { padding: 10px 16px 2px; }
  .slider .l { display: flex; justify-content: space-between; font-size: 12.5px; color: var(--muted); margin-bottom: 7px; }
  .slider .l b { color: var(--text); font-weight: 400; }
  .slider .r { height: 3px; background: #2a2a36; border-radius: 2px; position: relative; }
  .slider .d { position: absolute; inset: 0 auto 0 0; background: var(--accent); border-radius: 2px; }
  .slider .k { position: absolute; top: 50%; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 50%; background: var(--accent); }

  .switch { display: flex; align-items: center; justify-content: space-between; padding: 11px 16px; font-size: 14px; }
  .switch .t { width: 44px; height: 24px; border-radius: 12px; background: var(--accent); position: relative; flex: none; }
  .switch .t.off { background: #2f2f3b; }
  .switch .t i { position: absolute; top: 3px; left: 23px; width: 18px; height: 18px; border-radius: 50%; background: #fff; }
  .switch .t.off i { left: 3px; }
</style>

<div class="page">
  <header>
    <img src="data:image/png;base64,${icon}" alt="Swayve">
    <div>
      <h1>Swayve</h1>
      <p>${note}</p>
    </div>
    <div class="swatches">
      <div class="sw"><i style="background:${c.accent}"></i>${c.accent}</div>
      <div class="sw"><i style="background:${c.accentSecondary}"></i>${c.accentSecondary}</div>
    </div>
  </header>

  <div class="rail">

    <div class="holder">
      <div class="scaler"><div class="device">
        <div class="inset"></div>
        <div class="bar"><span class="title">Songs</span><span class="sub">1,284</span></div>
        <div class="row playing">
          <div class="art"></div>
          <div class="meta"><div class="name">Nocturne in E-flat</div><div class="sub">Frédéric Chopin</div></div>
          <div class="bars"><i style="height:9px"></i><i style="height:15px"></i><i style="height:6px"></i></div>
        </div>
        <div class="row"><div class="art"></div><div class="meta"><div class="name">Raga Brindavani Sarang</div><div class="sub">Buddhadev DasGupta</div></div></div>
        <div class="row"><div class="art"></div><div class="meta"><div class="name">Piece 3/9 01:42</div><div class="sub">Swayve</div></div><span class="tag">made</span></div>
        <div class="row"><div class="art"></div><div class="meta"><div class="name">Kind of Blue</div><div class="sub">Miles Davis</div></div></div>
        <div class="row"><div class="art"></div><div class="meta"><div class="name">Piece 2/9 23:10</div><div class="sub">Swayve</div></div><span class="tag">made</span></div>
        <div class="row"><div class="art"></div><div class="meta"><div class="name">Blue in Green</div><div class="sub">Miles Davis</div></div></div>
        <div class="row"><div class="art"></div><div class="meta"><div class="name">Voice 004</div><div class="sub">Recordings</div></div></div>
        <div style="flex:1"></div>
        <div class="tabs">
          <div class="tab on"><span class="g">♪</span>Songs</div>
          <div class="tab"><span class="g">▦</span>Albums</div>
          <div class="tab"><span class="g">≡</span>Playlists</div>
          <div class="tab"><span class="g">✧</span>Generate</div>
        </div>
      </div></div>
      <p class="label">Songs. Playing takes the primary; made takes the secondary.</p>
    </div>

    <div class="holder">
      <div class="scaler"><div class="device">
        <div class="inset"></div>
        <div class="bar"><span style="font-size:24px;color:var(--text)">⌄</span><span class="sub">Nocturnes, Op. 9</span><span style="color:var(--accent);font-size:20px">◈</span></div>
        <div class="fire"><img src="data:image/png;base64,${icon}" alt=""></div>
        <div class="details"><div class="track">Nocturne in E-flat</div><div class="artist">Frédéric Chopin</div></div>
        <div class="seek">
          <div class="rail2"><div class="fill"></div><div class="thumb"></div></div>
          <div class="times"><span>2:14</span><span>5:51</span></div>
        </div>
        <div class="transport"><span class="d">⤨</span><span class="g">⏮</span><span class="play">❚❚</span><span class="g">⏭</span><span class="d">⟲</span></div>
        <div style="height:26px"></div>
      </div></div>
      <p class="label">Now Playing. Scrubber, play and the flame toggle in the primary.</p>
    </div>

    <div class="holder">
      <div class="scaler"><div class="device">
        <div class="inset"></div>
        <div class="bar"><span class="title">Generate</span><span class="sub">120 beats · 20.0s</span></div>
        <div class="actions">
          <div class="btn primary">Generate</div>
          <div class="btn">Play</div>
          <div class="btn secondary">Keep</div>
        </div>
        <div class="section">PHRASE</div>
        <div class="phrase">D M# _ D n D n - | D M# _ D n - D _</div>
        <div class="section">PARSED</div>
        <div class="chips">
          <span>D</span><span>M#</span><span class="loop">P</span><span class="loop">D</span><span class="loop">n</span><span class="loop">D</span><span>_</span><span>P</span><span>D</span><span class="loop">P</span><span class="loop">D</span><span class="loop">n</span><span class="loop">D</span><span>-</span><span>M</span><span>P</span>
        </div>
        <div class="section">SOUND</div>
        <div class="slider"><div class="l"><span>Sa</span><b>240</b></div><div class="r"><div class="d" style="width:31%"></div><div class="k" style="left:31%"></div></div></div>
        <div class="slider"><div class="l"><span>Beats per minute</span><b>360</b></div><div class="r"><div class="d" style="width:58%"></div><div class="k" style="left:58%"></div></div></div>
        <div class="switch"><span>Squash</span><span class="t"><i></i></span></div>
        <div class="switch"><span>Shuddha only</span><span class="t"><i></i></span></div>
        <div class="switch"><span>Fixed midpoint</span><span class="t off"><i></i></span></div>
        <div style="flex:1"></div>
        <div class="tabs">
          <div class="tab"><span class="g">♪</span>Songs</div>
          <div class="tab"><span class="g">▦</span>Albums</div>
          <div class="tab"><span class="g">≡</span>Playlists</div>
          <div class="tab on"><span class="g">✧</span>Generate</div>
        </div>
      </div></div>
      <p class="label">Generate. Keep and the repeated stretches in the secondary.</p>
    </div>

  </div>
</div>
`;
}

function write(name, c, note) {
  fs.writeFileSync(path.join(__dirname, name), page(c, note));
  console.log(`  wrote preview/${name} — ${c.accent} and ${c.accentSecondary}`);
}

const current = palette();
write('phone.html', current, "Three screens at a Pixel 6 Pro's real size, 412 by 892 points.");
write('phone-v1.html', { ...current, ...PREVIOUS }, 'The previous pair, same three screens, for comparison.');
