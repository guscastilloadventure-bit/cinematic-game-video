// render.mjs: film a game video from a frozen build of the game snapshot in a muted headless Chrome.
// Run from the video project folder (the one holding game/, out/, scout/).
//   node render.mjs --scout [shot ...]           3 stills per shot (last sub-frame only) -> scout/<shot>_<i>.jpg
//   node render.mjs --still <shot> [--fracs a,b]  full-quality frames of one shot -> scout/<shot>_full_<frac>.jpg
//   node render.mjs --events                      every sound cue -> out/events.json, physics audit -> out/audit.json
//   node render.mjs --trace <shot> [castKey ...]  per-frame position / speed / ground clearance (verify physics by numbers)
//   node render.mjs --final [--from N --to M]     every frame -> frames/f00000.jpg (skips what sencode already encoded)
// Options: --game <dir> (game), --film <query> (film: the flag that hands boot to the director), --q <extra query>
//   (a map, a sign-in bypass...), --port 8976 --cdp 9976 (pick free ones: other sessions render too), --dist dist-film,
//   --w 1920 --h 1080 --dsf 2 (capture = w*dsf: 2 = 4K, if the game's own pixel-ratio cap allows it), --k <sub-frame
//   multiplier>, --nobuild (reuse the last build). Not Vite? --build '<shell command run in the game dir>' and
//   --serve <built folder inside the game dir> (served by serve.mjs), e.g. --build 'node build.mjs' --serve dist.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { launch, newPage } from './cdp.mjs';
import { serveStatic } from './serve.mjs';
const a = process.argv.slice(2);
const opt = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const PORT = +opt('port', 8976), CDP = +opt('cdp', 9976);
const W = +opt('w', 1920), H = +opt('h', 1080), DSF = +opt('dsf', 2);
const GAME = opt('game', 'game'), FILMQ = opt('film', 'film');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync('out', { recursive: true });

// a frozen production build (no hot reload: editing the game mid-render must never reload the page)
const DIST = opt('dist', 'dist-film'), BUILD = opt('build', ''), SERVE = opt('serve', '');
if (!a.includes('--nobuild')) {
  if (BUILD) execFileSync('/bin/zsh', ['-c', BUILD], { cwd: GAME, stdio: 'inherit' });
  else execFileSync('npx', ['vite', 'build', '--outDir', DIST, '--emptyOutDir', '--logLevel', 'warn'], { cwd: GAME, stdio: 'inherit' });
}
const server = SERVE ? await serveStatic(`${GAME}/${SERVE}`, PORT)
  : spawn('npx', ['vite', 'preview', '--outDir', DIST, '--port', String(PORT), '--strictPort'], { cwd: GAME, stdio: 'ignore' });
const stopServer = () => (SERVE ? server.close() : server.kill());
for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/`); if (r.ok) break; } catch {} await sleep(250); }
const chrome = await launch({ port: CDP, headless: true, width: W, height: H });
try {
  const page = await newPage(chrome.port);
  await page.setViewport(W, H, DSF);
  const extra = opt('q', '');
  await page.goto(`http://127.0.0.1:${PORT}/?${FILMQ}${extra ? '&' + extra : ''}`, { wait: 500 });
  let ok = false;
  for (let i = 0; i < 400; i++) { if (await page.eval('!!(window.__film && window.__film.ready)').catch(() => false)) { ok = true; break; } await sleep(500); }
  for (const m of page.console.splice(0)) if (/error|warn/i.test(m.type)) console.log('[console]', m.text.slice(0, 400));
  if (!ok) throw new Error('film never became ready');
  const info = await page.eval('({ frames: __film.FRAMES, shots: __film.SHOTS })');
  console.log('film ready:', info.frames, 'frames,', info.shots.length, 'shots');
  await page.eval(`__film.setK(${+opt('k', 1)}); 1`);
  const VAL = new Set(['--k', '--port', '--cdp', '--w', '--h', '--dsf', '--from', '--to', '--q', '--still', '--fracs', '--out', '--dist', '--game', '--film', '--build', '--serve']);
  const only = a.filter((x, i) => !x.startsWith('--') && !(i > 0 && VAL.has(a[i - 1])));
  if (a.includes('--events')) {
    // every sound cue in film seconds (for the mix) and, on the same pass, the physics audit
    const ev = await page.eval('__film.collect()', { timeoutMs: 1800000 });
    writeFileSync('out/events.json', JSON.stringify(ev, null, 0));
    console.log('events', ev.length);
    const au = await page.eval('__film.audit ? __film.audit() : []');
    writeFileSync('out/audit.json', JSON.stringify(au, null, 1));
    console.log('audit', au.length ? `${au.length} issue(s):` : 'clean');
    for (const x of au) console.log(`  ${x.shot.padEnd(9)} ${x.kind.padEnd(8)} ${x.who.padEnd(16)} ${x.at}-${x.until}s  ${x.frames} frames  ${x.detail}`);
  } else if (a.includes('--trace')) {
    const [shot, ...keys] = only;
    const tr = await page.eval(`__film.trace(${JSON.stringify(shot)}, ${JSON.stringify(keys)})`, { timeoutMs: 600000 });
    for (const r of tr) console.log(`${String(r.f).padStart(5)} ${r.t.toFixed(3)} ${r.who.padEnd(10)} x ${r.x.toFixed(2).padStart(7)} y ${r.y.toFixed(2).padStart(6)} z ${r.z.toFixed(2).padStart(7)}  ${String(r.v).padStart(5)} m/s  clear ${r.clear}${r.alive ? '' : '  (down)'}${r.grounded ? '' : '  air'}`);
  } else if (a.includes('--scout')) {
    mkdirSync('scout', { recursive: true });
    await page.eval('__film.setScout(true); 1');
    const fracs = opt('fracs', '0.15,0.5,0.85').split(',').map(Number);
    for (const s of info.shots) {
      if (only.length && !only.includes(s.name)) continue;
      const n = s.f1 - s.f0;
      for (const [q, frac] of fracs.entries()) {
        const f = s.f0 + Math.min(n - 1, Math.floor(n * frac));
        const t0 = Date.now();
        await page.eval(`__film.frame(${f})`, { timeoutMs: 600000 });
        await page.screenshot(`scout/${s.name}_${q}.jpg`, { format: 'jpeg', quality: 80 });
        if (q === fracs.length - 1) console.log(s.name, f, `${Date.now() - t0} ms`);
      }
      for (const m of page.console.splice(0)) if (/error|warn/i.test(m.type)) console.log('  [console]', m.text.slice(0, 400));
    }
  } else if (a.includes('--still')) {
    mkdirSync('scout', { recursive: true });
    const name = opt('still'), s = info.shots.find((x) => x.name === name);
    for (const frac of opt('fracs', '0.5').split(',').map(Number)) {
      const f = s.f0 + Math.min(s.f1 - s.f0 - 1, Math.floor((s.f1 - s.f0) * frac));
      const t0 = Date.now();
      await page.eval(`__film.frame(${f})`, { timeoutMs: 600000 });
      await page.screenshot(`scout/${name}_full_${frac}.jpg`, { format: 'jpeg', quality: 90 });
      console.log(name, f, `${Date.now() - t0} ms`);
    }
  } else if (a.includes('--final')) {
    const OUT = opt('out', 'frames');
    mkdirSync(OUT, { recursive: true });
    const from = +opt('from', 0), to = +opt('to', info.frames);
    // the streaming encoder (sencode) deletes frames once they are in the video and counts them in done.txt
    const encoded = () => { try { return +readFileSync(`${OUT}/done.txt`, 'utf8') || 0; } catch { return 0; } };
    let t0 = Date.now(), done = 0;
    for (let f = from; f < to; f++) {
      const file = `${OUT}/f${String(f).padStart(5, '0')}.jpg`;
      if (existsSync(file) && existsSync(`${OUT}/f${String(f + 1).padStart(5, '0')}.jpg`)) continue;
      if (f < encoded()) continue;
      await page.eval(`__film.frame(${f})`, { timeoutMs: 600000 });
      await page.screenshot(file, { format: 'jpeg', quality: 93 });
      done++;
      if (done % 60 === 0) { const r = (Date.now() - t0) / done; console.log(`frame ${f} / ${to}  ${r.toFixed(0)} ms per frame, ~${((to - f) * r / 60000).toFixed(1)} min left`); }
      for (const m of page.console.splice(0)) if (/error/i.test(m.type)) console.log('  [console]', m.text.slice(0, 300));
    }
  }
  await page.close();
} finally { await chrome.close(); stopServer(); }
