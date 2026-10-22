// vclock.js: after boot, page timers and CSS animations run on the film's clock, not the wall clock.
// setTimeout callbacks fire when game time reaches them; every CSS animation and transition is
// paused and set to (game time - its start) each step, so the HUD's slaps, toasts and fades are
// frame-exact at any shot speed.
export function installVirtualClock() {
  let now = 0, seq = 0;
  const q = [];
  window.setTimeout = (fn, ms = 0, ...args) => { const id = ++seq; q.push({ id, at: now + Math.max(0, +ms || 0) / 1000, fn, args }); return id; };
  window.clearTimeout = (id) => { const i = q.findIndex((t) => t.id === id); if (i >= 0) q.splice(i, 1); };
  const born = new WeakMap();
  return {
    get now() { return now; },
    reset() { q.length = 0; now = 0; for (const a of document.getAnimations()) a.cancel(); },
    advance(dt) {
      const end = now + dt;
      for (;;) {
        q.sort((a, b) => a.at - b.at || a.id - b.id);
        const t = q[0];
        if (!t || t.at > end + 1e-9) break;
        q.shift(); now = Math.max(now, t.at);
        try { t.fn(...t.args); } catch (e) { console.error(e); }
      }
      now = end;
      this.sync();
    },
    /** Pin every running CSS animation/transition to the virtual clock. */
    sync() {
      for (const a of document.getAnimations()) {
        if (!born.has(a)) { born.set(a, now); a.pause(); }
        a.currentTime = (now - born.get(a)) * 1000;
      }
    },
  };
}
