// qa/cdp.mjs: minimal Chrome DevTools Protocol driver, no dependencies (Node 22+).
//
//   import { launch, newPage } from './cdp.mjs'
//   const chrome = await launch({ port: 9340 })            // own throwaway profile
//   try {
//     const page = await newPage(chrome.port)
//     await page.goto('http://127.0.0.1:8791/qa/map.html?shim=1', { wait: 2500 })
//     const n = await page.eval('window.__stats.drawCalls')
//     await page.screenshot('qa/shots/map-1.png')
//     await page.close()
//   } finally { await chrome.close() }
//
// Or from the shell:  node qa/shot.mjs <url> <out.png> [--wait 2500] [--eval "expr"] [--w 1280 --h 800]
//
// Use your OWN port (9340–9399) and never touch the Chrome on port 9333: that
// one is the owner's play window.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEFAULT_TIMEOUT_MS = 60000;

/** Start a Chrome on `port` with a throwaway profile. `close()` kills it and removes the profile. */
export async function launch({ port = 9340, headless = false, width = 1280, height = 800 } = {}) {
  const profile = mkdtempSync(path.join(tmpdir(), 'film-cdp-'));
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-features=ProfilePicker,Translate',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding', '--autoplay-policy=no-user-gesture-required',
    '--mute-audio', '--disable-extensions', // never play game audio on the owner's speakers during QA (owner rule 2026-09-28)
    '--hide-scrollbars', `--window-size=${width},${height}`, '--window-position=2000,1200',
    'about:blank',
  ];
  if (headless) args.unshift('--headless=new', '--use-angle=metal');
  const proc = spawn(CHROME, args, { stdio: 'ignore' });
  let spawnError = null;
  proc.once('error', (e) => { spawnError = e; });
  let closing = null;
  const close = () => {
    if (closing) return closing;
    closing = (async () => {
      process.off('SIGINT', onSig); process.off('SIGTERM', onSig);
      if (proc.exitCode === null && proc.signalCode === null) {
        const exited = new Promise((r) => { proc.once('exit', r); setTimeout(r, 3000).unref(); });
        proc.kill();
        await exited;
      }
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    })();
    return closing;
  };
  const onSig = () => { close().finally(() => process.exit(130)); };
  process.on('SIGINT', onSig); process.on('SIGTERM', onSig);
  let version = null;
  for (let i = 0; i < 100 && !spawnError; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) { version = await r.json(); break; } } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  if (!version) { await close(); throw new Error(spawnError ? `Chrome would not start: ${spawnError.message}` : `Chrome did not expose port ${port}`); }
  return { proc, port, version, close };
}

/** Open a new tab on a running Chrome and return a Page. */
export async function newPage(port) {
  const r = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
  if (!r.ok) throw new Error(`could not open a tab: ${r.status}`);
  const target = await r.json();
  const page = await connect(target.webSocketDebuggerUrl);
  page.targetId = target.id;
  page.port = port;
  return page;
}

/** Connect to one target's websocket. */
export async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('CDP socket error')), { once: true });
  });
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method && listeners.has(msg.method)) for (const fn of listeners.get(msg.method)) { try { fn(msg.params); } catch {} }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject, timer } = pending.get(msg.id);
      clearTimeout(timer);
      pending.delete(msg.id);
      msg.error ? reject(new Error(`${msg.error.message || JSON.stringify(msg.error)}`)) : resolve(msg.result);
    }
  });
  const send = (method, params = {}, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out after ${timeoutMs} ms`)); }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const on = (method, fn) => { if (!listeners.has(method)) listeners.set(method, []); listeners.get(method).push(fn); };

  const console_ = [];
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');
  on('Runtime.consoleAPICalled', (p) => console_.push({ type: p.type, text: p.args.map((a) => a.value ?? a.description ?? '').join(' ') }));
  on('Runtime.exceptionThrown', (p) => console_.push({ type: 'exception', text: p.exceptionDetails.exception?.description || p.exceptionDetails.text }));
  on('Log.entryAdded', (p) => console_.push({ type: p.entry.level, text: p.entry.text }));

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const page = {
    ws, send, on, console: console_, sleep,
    /** Navigate and wait for load (+ `wait` ms for the scene to settle). */
    async goto(url, { wait = 1500, timeoutMs = 60000 } = {}) {
      const loaded = new Promise((r) => on('Page.loadEventFired', r));
      await send('Page.navigate', { url });
      await Promise.race([loaded, sleep(timeoutMs)]);
      await sleep(wait);
    },
    /** Evaluate an expression (top-level await allowed) and return its JSON value. */
    async eval(expression, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, { timeoutMs });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    /** PNG screenshot of the viewport to `file`. */
    async screenshot(file, { format = 'png', quality, timeoutMs = 240000 } = {}) {
      const r = await send('Page.captureScreenshot', { format, quality, captureBeyondViewport: false }, { timeoutMs });
      writeFileSync(file, Buffer.from(r.data, 'base64'));
      return file;
    },
    async setViewport(width, height, deviceScaleFactor = 1) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor, mobile: false });
    },
    /** Synthetic mouse click at CSS pixel coordinates (counts as a user gesture). */
    async click(x, y) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    },
    async key(code, key = code, { down = true, up = true } = {}) {
      if (down) await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key, windowsVirtualKeyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0 });
      if (up) await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key, windowsVirtualKeyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0 });
    },
    /** Move the mouse by (dx, dy): feeds movementX/Y for pointer-locked look. */
    async mouseMove(x, y) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); },
    async close() {
      try { if (page.targetId) await fetch(`http://127.0.0.1:${page.port}/json/close/${page.targetId}`); } catch {}
      try { ws.close(); } catch {}
    },
  };
  return page;
}
