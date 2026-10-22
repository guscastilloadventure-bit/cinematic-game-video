// studio.mjs: a long-lived muted headless Chrome + the game's vite dev server, for look-dev. POST jobs to it:
//   curl -s localhost:$CTRL -d '{"q":"map=canyon","items":[{"shot":"face","frac":0.5}]}'
// Each item renders one frame (full sub-frames unless "scout": true) to scout/<shot>_<tag|frac>.jpg.
// Item keys: shot, frac | frame, tag, scout, look ({pos, look, fov} heights above ground: a free camera at the shot's
// state), eval (JS run before the frame). Job keys: q (extra query; reloads the page), k (sub-frame multiplier),
// evalOnly (run JS in the page and return the result, no reload), quit.
// Env: PORT 8973 (dev server), CDP 9975, CTRL 8975, GAME game, FILMQ film, DSF 2. Pick ports no other session uses.
// Not Vite? DEV_CMD='<shell command in the game dir that serves on $PORT>' (live rebuilds), or SERVE_DIR=<built folder
// in the game dir> (static; rebuild it yourself after each edit).
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { launch, newPage } from './cdp.mjs';
import { serveStatic } from './serve.mjs';
const E = process.env;
const PORT = +(E.PORT || 8973), CDP = +(E.CDP || 9975), CTRL = +(E.CTRL || 8975), W = 1920, H = 1080, DSF = +(E.DSF || 2);
const GAME = E.GAME || 'game', FILMQ = E.FILMQ || 'film';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync('scout', { recursive: true });
const server = E.SERVE_DIR ? await serveStatic(`${GAME}/${E.SERVE_DIR}`, PORT)
  : E.DEV_CMD ? spawn('/bin/zsh', ['-c', E.DEV_CMD], { cwd: GAME, stdio: 'ignore', env: { ...E, PORT: String(PORT) } })
  : spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: GAME, stdio: 'ignore' });
const stopServer = () => (E.SERVE_DIR ? server.close() : server.kill());
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/`)).ok) break; } catch {} await sleep(250); }
const chrome = await launch({ port: CDP, headless: true, width: W, height: H });
const page = await newPage(chrome.port);
await page.setViewport(W, H, DSF);
let busy = false;
async function load(q) {
  await page.goto(`http://127.0.0.1:${PORT}/?${FILMQ}${q ? '&' + q : ''}`, { wait: 300 });
  for (let i = 0; i < 400; i++) { if (await page.eval('!!(window.__film && window.__film.ready)').catch(() => false)) return; await sleep(400); }
  throw new Error('not ready');
}
createServer((req, res) => {
  let body = '';
  req.on('data', (d) => (body += d));
  req.on('end', async () => {
    if (busy) { res.end('busy\n'); return; }
    busy = true;
    const out = [];
    try {
      const job = JSON.parse(body || '{}');
      if (job.quit) { res.end('bye\n'); await chrome.close(); stopServer(); process.exit(0); }
      if (job.evalOnly) { out.push(JSON.stringify(await page.eval(job.evalOnly))); busy = false; res.end(out.join('\n') + '\n'); return; }
      await load(job.q || '');
      const info = await page.eval('({ shots: __film.SHOTS })');
      await page.eval(`__film.setK(${job.k ?? 1}); 1`);
      for (const it of job.items || []) {
        const s = info.shots.find((x) => x.name === it.shot);
        if (!s) { out.push(`no shot ${it.shot}`); continue; }
        await page.eval(`__film.setScout(${!!it.scout}); 1`);
        const n = s.f1 - s.f0, f = it.frame ?? s.f0 + Math.min(n - 1, Math.floor(n * (it.frac ?? 0.5)));
        const t0 = Date.now();
        if (it.look) await page.eval(`__film.look(${JSON.stringify(it.look)}, ${JSON.stringify(it.shot)})`, { timeoutMs: 600000 });
        else await page.eval(it.eval ? `${it.eval}; __film.frame(${f})` : `__film.frame(${f})`, { timeoutMs: 600000 });
        const file = `scout/${it.shot}_${it.tag ?? it.frac ?? 'f' + f}.jpg`;
        await page.screenshot(file, { format: 'jpeg', quality: 88 });
        out.push(`${file} ${Date.now() - t0} ms`);
      }
      for (const m of page.console.splice(0)) if (/error|warn/i.test(m.type)) out.push('[console] ' + m.text.slice(0, 300));
    } catch (e) { out.push('ERROR ' + (e && e.stack || e)); }
    busy = false;
    res.end(out.join('\n') + '\n');
  });
}).listen(CTRL, '127.0.0.1', () => console.log('studio on', CTRL));
