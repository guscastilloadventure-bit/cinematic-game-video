// film.js: the director. The game boots with ?film, then hands off here instead of starting its frame loop; render.mjs
// calls __film.frame(i): the game simulates on a fixed film clock with seeded randomness, renders K jittered
// sub-frames through the post chain (AO, DOF, bloom, grade) and averages them (motion blur + anti-aliasing).
// The game's own menus and HUD are live DOM on top (HUD shots).
//
// TEMPLATE from the STUFFED ad (2026-10-21). Generic as is: the film clock, seeded Math.random, vclock, sub-frames
// (subT, advanceFrame, frame), speed ramps (simTimeAt), cameras (placeCamera, jitter, handheld), letterbox, film
// lights + dust motes (filmLights), the title render, collect() (sound cues) and the PHYSICS AUDIT (auditFrame,
// trace). GAME-SPECIFIC, rewrite for each game (see references/porting.md): the Bear/Match/Player imports and the
// startFilm(H) hand-off object, the prototype overrides (damage / die / update: scripted knockouts + knockback),
// drive() (turns a cast member's act(t) into the game's input), stage() (spawns a cast), resetWorld() (clears
// bullets, loot, effects, HUD between shots), openMenu(), fakeInput, upkeep() (foliage, water, shadows, LOD).
import { buildPost } from './post.js';
import { installVirtualClock } from './vclock.js';
import * as SHOTMOD from './shots.js';
const { makeShots, EDIT, BPM, BEATS } = SHOTMOD;
// the end title: shots.js exports TITLE = { word: 'GAME NAME', link: 'game.example.app' }
const TITLE = SHOTMOD.TITLE || { word: 'GAME', link: '' };
import { Title } from './title.js';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect } from 'postprocessing';
import { AccumPass, GainEffect } from './post.js';
import { Bot } from '../ai/bot.js';
import { followShadow } from '../world/sky.js';
import { updateFoliage } from '../world/foliage.js';
import { updateWater } from '../world/water.js';
import { SUN_DIR } from '../world/sky.js';
import { installFilmFX } from './fxfilm.js';

export const FPS = 60;

export async function startFilm(H) {
  const { THREE, ctx, menu, hud, showcase, progress, Match, Player, Bear } = H;
  const Q = new URLSearchParams(location.search);
  const $ = (s) => document.querySelector(s);
  const camera = ctx.camera, renderer = ctx.renderer, scene = ctx.scene;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

  // ---- page: no wall-clock transitions, a drawn cursor, nothing else on screen -----------------
  const css = document.createElement('style');
  css.textContent = `#filmcursor { position: fixed; z-index: 60; left: 0; top: 0; width: 30px; height: 30px; pointer-events: none; will-change: transform; }
    .fsbtn, #fps { display: none !important; } #game { opacity: 1 !important; transition: none !important; } #backdrop { display: none !important; }
    #filmfade { position: fixed; inset: 0; background: #000; z-index: 55; pointer-events: none; opacity: 0; }
    #filmbars { position: fixed; inset: 0; z-index: 70; pointer-events: none; }
    #filmbars::before, #filmbars::after { content: ''; position: absolute; left: 0; right: 0; height: var(--bar, 12.8%); background: #000; }
    #filmbars::before { top: 0; } #filmbars::after { bottom: 0; }`;
  document.head.appendChild(css);
  const cursor = document.createElement('div'); cursor.id = 'filmcursor'; cursor.hidden = true;
  cursor.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M4 2 L4 20 L8.6 15.6 L11.6 22 L14.4 20.8 L11.4 14.6 L18 14.6 Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  document.body.appendChild(cursor);
  const fadeEl = document.createElement('div'); fadeEl.id = 'filmfade'; document.body.appendChild(fadeEl);
  // 2.39:1 letterbox over everything (the frame is 16:9)
  const bars = document.createElement('div'); bars.id = 'filmbars'; document.body.appendChild(bars);
  try { localStorage.setItem('stuffed.taught', '1'); } catch {}
  menu.onStart = () => {};

  // a seasoned account: Ranger rank, a wallet of buttons, a few things owned
  Object.assign(progress, { xp: 8350, buttons: 2480, look: { fur: 'honey', vest: 'sage', bandana: 'sky' }, primary: 'carbine',
    owned: { fur: ['honey', 'chocolate', 'cream'], vest: ['sage', 'olive', 'tan'], bandana: ['sky', 'red', 'orange'] } });
  menu._rank();
  const progress0 = JSON.stringify(progress);
  const restoreProgress = () => { const p0 = JSON.parse(progress0); for (const k in p0) progress[k] = p0[k]; };

  // shots without the player still knock bears out: the kill feed needs a player to colour names
  const _feed = hud.killFeed.bind(hud);
  hud.killFeed = (k, v, i) => { if (ctx.player) _feed(k, v, i); };
  const vclock = installVirtualClock();
  await new Promise((r) => requestAnimationFrame(() => r()));
  H.resize();
  const post = buildPost(renderer, scene, camera, Q);
  post.composer.setSize(innerWidth, innerHeight, false);
  const { composer, dof, accum } = post;
  let FX = null; // film effects, made once the shots know the world

  // ---- seeded randomness, so a shot renders the same every time -------------------------------
  let seed = 1;
  Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  // ---- film-only behaviour on top of the game's bears ---------------------------------------------
  // b.film = { act(t, b), immortal, mortalAt, kb, spread }
  const S = { t: 0, shot: null, simT: 0 };
  const _dmg = Bear.prototype.damage;
  Bear.prototype.damage = function (amount, attacker, info) {
    const f = this.film;
    if (f && this.alive) {
      if (f.mortalAt != null && S.t >= f.mortalAt) amount = this.hp + 60;
      else if (f.immortal !== false) amount = Math.min(amount, Math.max(0, this.hp - (f.minHp ?? 6)));
    }
    return _dmg.call(this, amount, attacker, info);
  };
  const _die = Bear.prototype.die;
  Bear.prototype.die = function (attacker, info, lx, lz) {
    _die.call(this, attacker, info, lx, lz);
    // knockback: the body is thrown along the shot, harder for the big guns, then slides to a stop
    const k = this.film && this.film.kb != null ? this.film.kb : ({ shotgun: 1, sniper: 1.1, dmr: 0.55 }[info.wid] || 0.28);
    this.kb = { v: v3(info.dir.x * 6.5 * k, 1.2 + 2.6 * k, info.dir.z * 6.5 * k) };
    this.rig.fall.vel = 2.4 + 4.5 * k;
    this.rig.fall.limbV = 7 + 8 * k;
  };
  const _upd = Bear.prototype.update;
  const RADIUS = 0.34;
  Bear.prototype.update = function (dt) {
    _upd.call(this, dt);
    if (!this.alive && this.kb) {
      const v = this.kb.v;
      v.y -= 20 * dt;
      this.pos.addScaledVector(v, dt);
      const free = this.film && this.film.noCollide; // thrown clear of a rail (the tower)
      if (!free) ctx.colliders.resolve(this.pos, RADIUS, this.pos.y + 0.1, this.pos.y + 0.8);
      const g = free ? H.heightAt(this.pos.x, this.pos.z) : ctx.colliders.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.6, 0.6);
      if (free && this.pos.y > g + 0.3) { // tumbling through the air
        this.kb.spinAxis ??= v3(v.z, 0, -v.x).normalize();
        this.mesh.root.rotateOnWorldAxis(this.kb.spinAxis, 4.2 * dt);
      }
      if (this.pos.y <= g) { this.pos.y = g; v.y = Math.max(0, -v.y * 0.15); const f = Math.max(0, 1 - 7 * dt); v.x *= f; v.z *= f; if (free && !this.kb.landed) { this.kb.landed = true; this.mesh.root.rotation.set(0, this.yaw, 0); if (ctx.fx) ctx.fx.knockout(this, { dir: v.clone().normalize() }); } }
      this.mesh.root.position.copy(this.pos);
      this.mesh.root.updateMatrixWorld(true);
    }
  };

  // ---- puppets: a script per bear drives its input, yaw, pitch and aim -------------------------
  const BONE = (b, n) => { b.mesh.root.updateMatrixWorld(true); return b.mesh.bones[n].getWorldPosition(v3()); };
  /** chest / head / a point: what a script aims at */
  const aimPoint = (a) => {
    if (!a) return null;
    if (a.isVector3) return a;
    if (a.pos && a.mesh) return BONE(a, 'spine').add(v3(0, 0.12, 0));
    if (a.bear) return a.part === 'head' ? BONE(a.bear, 'head').add(v3(0, 0.08, 0)) : BONE(a.bear, a.part || 'spine').add(a.off || v3(0, 0.12, 0));
    return null;
  };
  const angTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
  function drive(b, dt) {
    const f = b.film; if (!f || !f.act || !b.alive) return;
    const c = f.act(S.t, b) || {};
    const inp = b.input;
    // aim and turn (eased, rate limited: no snapping joints)
    f.cmd = c;
    const hudP = S.shot && S.shot.shot.hud && b.isPlayer;
    const eye = hudP ? camera.position.clone() : v3(b.pos.x, b.pos.y + 1.42, b.pos.z);
    const ap = aimPoint(c.aim);
    // in HUD shots the Player owns the view: steer its base yaw/pitch (the game adds recoil on top)
    const P = hudP ? ctx.player : b;
    let wantYaw = c.yaw != null ? c.yaw : P.yaw, wantPitch = c.pitch != null ? c.pitch : 0;
    // an explicit yaw wins over the aim point (a low-ready aim beside the bear must not turn its body)
    if (ap) { const d = ap.clone().sub(eye); if (c.yaw == null) wantYaw = Math.atan2(d.x, d.z); if (c.pitch == null) wantPitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); }
    const rate = c.turn || 9;
    const dy = angTo(P.yaw, wantYaw);
    P.yaw += Math.sign(dy) * Math.min(Math.abs(dy), Math.abs(dy) * Math.min(1, rate * dt * 1.6) + 0.02 * rate * dt);
    P.pitch += (wantPitch - P.pitch) * Math.min(1, rate * dt * 1.6);
    if (ap && hudP) b.aimPoint.copy(ap);
    else if (ap) {
      // the gun swings to a new aim point (from low ready across the body out to the target) instead of snapping
      if (!f.aimS) f.aimS = ap.clone();
      const e = v3(b.pos.x, b.pos.y + 1.3, b.pos.z);
      const d0 = f.aimS.clone().sub(e), d1 = ap.clone().sub(e), l0 = d0.length(), l1 = d1.length();
      const k = 1 - Math.exp(-(c.swing || 10) * dt);
      d0.normalize().lerp(d1.normalize(), k).normalize();
      f.aimS.copy(e).addScaledVector(d0, l0 + (l1 - l0) * k);
      b.aimPoint.copy(f.aimS);
    }
    else b.aimPoint.set(b.pos.x + Math.sin(b.yaw) * Math.cos(b.pitch) * 30, eye.y + Math.sin(b.pitch) * 30, b.pos.z + Math.cos(b.yaw) * Math.cos(b.pitch) * 30);
    // move: c.move = [wx, wz] in stick units, world space
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    const m = c.move || [0, 0];
    inp.mz = m[0] * fx + m[1] * fz; inp.mx = -m[0] * fz + m[1] * fx;
    inp.sprint = !!c.sprint; inp.crouch = !!c.crouch; inp.jump = !!c.jump; inp.ads = !!c.ads; inp.reload = !!c.reload;
    const fire = !!c.fire;
    inp.firePressed = fire && !f.prevFire; inp.fire = fire; f.prevFire = fire;
    inp.swap = !!c.swap; inp.slot = c.slot ?? -1;
    // grenades: hold winds up and (for the player) shows the arc, letting go throws along the aim
    inp.grenadeHold = !!c.grenHold; inp.grenade = !!c.gren;
    if (b.isPlayer && ctx.player) {
      if (!hudP) ctx.player.aimPoint.copy(b.aimPoint);
    }
  }

  // ---- the world between shots -----------------------------------------------------------------
  const fxLists = () => { const F = ctx.fx; return [F.stuff, F.smoke, F.flash, F.fire, F.flashSide, F.sparks, F.bits]; };
  function resetWorld() {
    for (const b of ctx.bears) b.dispose();
    ctx.bears.length = 0;
    ctx.projectiles.reset();
    for (const l of fxLists()) { l.p.length = 0; l.update(0); }
    for (const k in ctx.fx.casings) { ctx.fx.casings[k].list.length = 0; ctx.fx.casings[k].im.count = 0; }
    ctx.fx.holes.count = 0; ctx.fx.holeI = 0; ctx.fx.light.intensity = 0; ctx.fx.lightT = 0; ctx.fx.shakeT = 0;
    // loot: every container shut and full again, chests rerolled from the shot's seed
    const pk = ctx.pickups;
    pk.search = null; pk.prompt = null;
    for (const it of pk.items) {
      it.open = 0; it.peek = 0; it.peekT = -9; it.cool = it.drop ? Infinity : 0; it.life = 0; it.rise = 0;
      if (it.kind === 'crate') pk._reroll(it);
      pk._draw(it);
    }
    ctx.grenades.reset();
    if (H.party) H.party.set([]);
    const el = hud.el;
    el.feed.innerHTML = ''; el.toasts.innerHTML = ''; el.hint.classList.remove('show'); el.lvup && el.lvup.classList.remove('show'); el.dmg.innerHTML = ''; el.ko.classList.remove('show');
    el.end.classList.remove('show'); el.death.classList.remove('show'); el.board.classList.remove('show');
    hud.last = {}; hud.trail = 100; hud.trailT = 0; hud.kick = 0; hud.deathT = -1; hud.lastTag = hud.lastTagShown = null;
    hud.show(false);
    vclock.reset();
    ctx.match = null; ctx.player = null;
    showcase.hide();
    document.body.classList.remove('menu-open', 'paused');
    document.body.classList.add('in-match');
    cursor.hidden = true; fadeEl.style.opacity = '0';
    if (FX) FX.reset();
    W.tracerScale = 1;
    restoreProgress();
  }
  /** The main menu over the live camp, on a page, with the showcase bear by the fire. */
  function openMenu(page) {
    document.body.classList.remove('in-match');
    document.body.classList.add('menu-open');
    showcase.spawn(3.3, 5.6, Math.PI + 0.55);
    showcase.setLook(progress.look);
    showcase.giveWeapon(progress.primary);
    showcase.switchT = 0;
    menu.open(page);
    menu._rank();
  }

  const fakeInput = { touch: { on: false }, touchRoot: document.createElement('div'), showTake() {}, showGrenades() {}, state: {}, poll(st) { return Object.assign(st, this.state); } };
  /** Start a match with a cast. cast: [{ name, team, look, gun, at:[x,z], yaw, act, hp, mortalAt, ai, kb, spread, player }] */
  function stage({ teams = true, mode = null, cast = [], diff = 'hard', time = 0, limit = 480 }) {
    const m = new Match({ mode: mode || (teams ? 'tdm' : 'ffa'), bots: 0, difficulty: diff, time: limit });
    m.started = true; m.time = time;
    m.update = function (dt) { this.time += dt; };
    ctx.match = m;
    ctx.paused = false;
    const bears = {};
    for (const c of cast) {
      const b = new Bear({ name: c.name, team: c.team ?? 0, look: c.look, isPlayer: !!c.player, primary: c.gun || 'carbine' });
      if (c.gun === 'pistol') { b.equip(0, true); }
      const y = c.yaw ?? 0;
      b.spawn(c.at[0], c.at[1], y);
      if (c.gun === 'pistol') b.equip(0, true);
      b.spawnT = -1e9;
      if (c.hp != null) b.hp = c.hp;
      b.film = { key: c.key || c.name, act: c.act || null, immortal: c.immortal, mortalAt: c.mortalAt, kb: c.kb, minHp: c.minHp ?? (c.player ? 62 : 6) };
      if (c.spread != null || !c.ai) for (const ws of b.weapons) if (ws) ws.def = { ...ws.def, spread: ws.def.spread.map((s) => s * (c.spread ?? 0.35)) };
      if (c.ai) { b.bot = new Bot(b, diff); m.bots.push(b.bot); b.film.act = null; }
      if (c.stats) Object.assign(b, c.stats);
      ctx.bears.push(b);
      bears[c.key || c.name] = b;
      if (c.player) {
        ctx.player = new Player(b, fakeInput, camera);
        ctx.player.reset(y);
      }
    }
    return bears;
  }

  // ---- stepping ----------------------------------------------------------------------------------
  function step(dt) {
    ctx.dt = dt; ctx.time += dt; ctx.frame = (ctx.frame || 0) + 1; S.t += dt;
    const shot = S.shot.shot;
    // tracers sized to the shot's speed, set where the bullets are simulated (not at render)
    W.tracerScale = shot.tracer ?? Math.min(1, shot.speed ? shot.speed(Math.max(0, S.ft || 0)) * 1.5 : 1);
    if (shot.menu) H.menuUpdate(dt);
    if (ctx.match) {
      const p = ctx.player;
      for (const b of ctx.bears) drive(b, dt);
      if (p && shot.hud) {
        // the real player camera: the script sets where the player looks, the game does the rest
        const c = (p.bear.film && p.bear.film.cmd) || {};
        const b = p.bear, inp = b.input;
        fakeInput.state = { mx: inp.mx, mz: inp.mz, fire: inp.fire, firePressed: inp.firePressed, ads: inp.ads, reload: inp.reload, jump: inp.jump, crouch: inp.crouch, sprint: inp.sprint, swap: inp.swap, slot: inp.slot, grenadeHold: !!c.grenHold, grenadeThrow: !!c.gren, grenadePressed: false, lookX: 0, lookY: 0, shoulder: false, interact: !!(c && c.interact), scores: !!(c && c.scores) };
        p.update(dt);
      }
      for (const b of ctx.bears) if (b.bot && b.alive) b.bot.update(dt);
      for (const b of ctx.bears) b.update(dt);
      H.separate();
      ctx.projectiles.update(dt);
      ctx.grenades.update(dt);
      ctx.pickups.update(dt, !!(p && p.interact));
      ctx.match.update(dt);
      if (p && shot.hud) { p.updateCamera(dt); hud.update(dt); }
    }
    if (shot.tick) shot.tick(S.t, dt);
    S.kick = Math.max(0, (S.kick || 0) - dt * 6);
    ctx.fx.update(dt);
    vclock.advance(dt);
  }

  // ---- cameras -----------------------------------------------------------------------------------
  const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
  function placeCamera(c, k) {
    camera.position.copy(c.pos);
    camera.up.copy(c.up || v3(0, 1, 0));
    camera.lookAt(c.look);
    if (c.roll) camera.rotateZ(c.roll);
    // handheld: slow drifting noise on the film clock, plus a kick that decays after nearby shots
    const ht = (S.shot ? SHOTS[S.shot.idx].f0 / FPS - (S.shot.shot.t0 || 0) : 0) + (S.ft || 0);
    const n = (a, b, c2) => Math.sin(ht * a + c2) * 0.6 + Math.sin(ht * b + c2 * 1.7) * 0.4;
    const hand = (c.hand ?? 0.004) + (S.kick || 0) * 0.02;
    if (hand > 0) { camera.rotateY(n(1.3, 2.9, 1) * hand); camera.rotateX(n(1.1, 3.7, 4) * hand * 0.8); camera.rotateZ(n(0.7, 1.9, 7) * hand * 0.4); }
    camera.fov = c.fov || 50;
    camera.near = c.near || 0.05; camera.far = 1200;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    dof.cocMaterial.copyCameraSettings(camera);
    if (c.focus != null || c.focusOn) {
      const fd = c.focus != null ? c.focus : camera.position.distanceTo(c.focusOn);
      dof.cocMaterial.focusDistance = fd; dof.cocMaterial.focusRange = c.range || Math.max(0.6, fd * 0.35); dof.bokehScale = c.bokeh ?? 1.5;
    } else { dof.bokehScale = 0; }
  }
  function jitter(k) {
    const sz = renderer.getDrawingBufferSize(new THREE.Vector2());
    const jx = halton(k + 1, 2) - 0.5, jy = halton(k + 1, 3) - 0.5;
    camera.setViewOffset(sz.x, sz.y, jx, jy, sz.x, sz.y);
  }

  function upkeep() {
    const cam = camera, W = ctx.world;
    updateFoliage(ctx.time);
    updateWater(W.water, ctx.time);
    ctx.sky.position.copy(cam.position);
    ctx.sky.material.uniforms.uTime.value = ctx.time;
    W.forest.update(cam.position);
    if (W.grass) W.grass.update(cam.position);
    const focus = S.focus || (ctx.player ? ctx.player.bear.pos : cam.position);
    followShadow(ctx.sun, focus, ctx.tier);
    for (const b of ctx.bears) b.setLod(0);
    showcase.setLod && showcase.setLod(0);
    post.sun.position.copy(cam.position).addScaledVector(SUN_DIR, 700);
    post.sun.updateMatrixWorld();
  }

  // two extra lights the shots aim and dim (always in the scene, so no shader ever recompiles)
  const xl = [new THREE.DirectionalLight(0xffffff, 0), new THREE.DirectionalLight(0xffffff, 0)];
  for (const l of xl) { l.castShadow = false; scene.add(l); scene.add(l.target); }
  // sunlit dust floating in the air near the camera (close shots)
  const motes = (() => {
    const N = 900, g = new THREE.BufferGeometry(), p = new Float32Array(N * 3), r = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) for (let k = 0; k < 4; k++) r[i * 4 + k] = Math.random();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('rnd', new THREE.BufferAttribute(r, 4));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uT: { value: 0 }, uC: { value: new THREE.Vector3() }, uR: { value: 3 }, uI: { value: 1 }, uScale: { value: 800 } },
      vertexShader: `attribute vec4 rnd; uniform float uT, uR, uScale; uniform vec3 uC; varying float vA;
        void main() { vec3 o = (rnd.xyz - 0.5) * 2.0 * uR; o += vec3(sin(uT * 0.21 + rnd.w * 40.0), sin(uT * 0.13 + rnd.x * 30.0) * 0.6 + uT * 0.05, cos(uT * 0.17 + rnd.y * 50.0)) * 0.35;
          o = mod(o + uR, 2.0 * uR) - uR; vec4 mv = modelViewMatrix * vec4(uC + o, 1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = uScale * (0.0018 + 0.0035 * rnd.w) / -mv.z; vA = 0.35 + 0.65 * fract(rnd.w * 7.3 + uT * 0.1 * rnd.z); }`,
      fragmentShader: `uniform float uI; varying float vA; void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vec3(1.0, 0.74, 0.46) * a * a * vA * uI, 1.0); }` });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 8; scene.add(pts);
    return pts;
  })();
  function filmLights() {
    const sh = S.shot && S.shot.shot, ft = Math.max(0, S.ft || 0);
    const L = sh && sh.lights ? sh.lights(ft) : [];
    xl.forEach((l, i) => {
      const d = L[i]; l.intensity = d ? d.i : 0;
      if (!d) return;
      l.color.set(d.color ?? 0xffffff);
      // dir: from the scene toward the light; cam: a fill from the camera side; rim: from behind the subject
      let dir = d.dir ? d.dir.clone() : null;
      if (!dir) { const at = d.at || camera.position.clone().add(camera.getWorldDirection(v3()).multiplyScalar(3)); dir = d.cam ? camera.position.clone().sub(at) : at.clone().sub(camera.position); dir.y = 0; dir.normalize(); if (d.side) dir.applyAxisAngle(v3(0, 1, 0), d.side); dir.y = d.up ?? 0.4; }
      l.position.copy(dir).normalize().multiplyScalar(10); l.target.position.set(0, 0, 0); l.updateMatrixWorld(); l.target.updateMatrixWorld();
    });
    const M = sh && sh.motes ? sh.motes(ft) : null;
    motes.visible = !!M;
    if (M) { const u = motes.material.uniforms; u.uC.value.copy(M.c); u.uR.value = M.r || 2.5; u.uI.value = M.i ?? 1; u.uT.value = (S.shot ? SHOTS[S.shot.idx].f0 / FPS : 0) + ft; u.uScale.value = renderer.getDrawingBufferSize(new THREE.Vector2()).y; }
  }

  function renderSub(k, K, present) {
    upkeep();
    filmLights();
    jitter(k);
    const sh = S.shot && S.shot.shot;
    FX.update(sh && sh.flashScale || 1, !!(sh && sh.rounds));
    post.rays.weight = sh && sh.rays != null ? sh.rays : 0.32;
    accum.weight = 1 / K; accum.first = k === 0; accum.present = present;
    composer.render(1 / FPS / K);
    camera.clearViewOffset();
  }

  // ---- shots ----------------------------------------------------------------------------------------
  const W = { THREE, ctx, H, S, hud, menu, showcase, progress, stage, openMenu, BONE, aimPoint, v3, clamp, cursor, fadeEl, $, post, vclock, fakeInput, camera };
  FX = installFilmFX(W);
  W.FX = FX;
  const SH = makeShots(W);
  const SHOTS = EDIT.map(([name, b, n]) => ({ name, f0: Math.round(b * (60 / BPM) * FPS), f1: Math.round((b + n) * (60 / BPM) * FPS) }));
  const FRAMES = SHOTS.at(-1).f1;

  function simTimeAt(shot, t) {
    if (!shot.speed) return t;
    let g = 0; const n = Math.max(1, Math.ceil(t * 240));
    for (let i = 0; i < n; i++) g += shot.speed(((i + 0.5) / n) * t) * (t / n);
    return g;
  }
  function simTo(g) { while (S.simT < g - 1e-9) { const d = Math.min(1 / 60, g - S.simT); step(d); S.simT += d; } }

  function begin(idx) {
    const meta = SHOTS[idx], shot = SH[meta.name];
    if (!shot) throw new Error('no shot ' + meta.name);
    seed = 1000 + idx * 7919;
    ctx.time = 40 + idx * 13;
    resetWorld();
    S.focus = null; S.t = -(shot.pre ?? 1.5); S.simT = 0; S.ft = -1; // pre-roll events are not in the film
    S.shot = { idx, meta, shot, K: Math.max(1, Math.round((shot.K || 8) * Kmul)), j: -1 };
    { const r = shot.shadow || 36, sc = ctx.sun.shadow.camera; Object.assign(sc, { left: -r, right: r, top: r, bottom: -r }); sc.updateProjectionMatrix(); ctx.tier.shadowRange = r; }
    if (shot.setup) shot.setup();
    if (shot.hud) hud.show(true);
    // pre-roll: flames, smoke and the rigs settle into motion before the first frame
    const pre = shot.pre ?? 1.5;
    for (let g = 0; g < pre - 1e-9;) { const d = Math.min(1 / 60, pre - g); step(d); g += d; }
    S.t = 0; S.simT = 0;
  }

  let Kmul = 1, scoutMode = false;
  /** Sub-frame film times of frame j: K samples across a 180-degree shutter. */
  const subT = (j, k, K) => (j + ((k + 0.5) / K) * 0.5) / FPS;

  function advanceFrame(j, render) {
    const { shot, meta, K } = S.shot;
    const n = meta.f1 - meta.f0;
    for (let k = 0; k < K; k++) {
      const t = subT(j, k, K) + (shot.t0 || 0);   // t0: the shot's first t0 seconds happen before the cut
      S.ft = t;
      simTo(simTimeAt(shot, t));
      if (!render || (scoutMode && k !== K - 1)) continue;
      ui(shot, t, j / n);
      const c = shot.hud || !shot.cam ? null : shot.cam(t, (j + (k + 0.5) / K * 0.5) / n);
      if (c) placeCamera(c, k); else { dof.bokehScale = 0; }
      if (shot.grade) shot.grade(t, post);
      renderSub(scoutMode ? 0 : k, scoutMode ? 1 : K, k === K - 1);
    }
    simTo(simTimeAt(shot, (j + 1) / FPS + (shot.t0 || 0)));
    S.shot.j = j;
  }
  function ui(shot, t, u) {
    cursor.hidden = true;
    // letterbox: 1 = 2.39:1 bars, 0 = the full 16:9 frame (HUD shots); a function animates them
    const bar = typeof shot.bars === 'function' ? shot.bars(t, u) : shot.bars ?? (shot.hud ? 0 : 1);
    bars.style.setProperty('--bar', (12.8 * bar).toFixed(3) + '%');
    if (shot.ui) shot.ui(t, u);
  }

  let titleRig = null;
  function titleRender(t, K) {
    if (!titleRig) {
      const T = new Title(renderer, TITLE.link, { word: TITLE.word, fluff: TITLE.fluff ? TITLE.fluff(ctx) : null });
      const comp = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
      comp.addPass(new RenderPass(T.scene, T.camera));
      const gain = new GainEffect(), bloom = new BloomEffect({ mipmapBlur: true, intensity: 0.55, luminanceThreshold: 1.3, luminanceSmoothing: 0.3, radius: 0.5 });
      const fade = new GainEffect();
      comp.addPass(new EffectPass(T.camera, gain, bloom, new ToneMappingEffect({ mode: ToneMappingMode.AGX }), new VignetteEffect({ offset: 0.25, darkness: 0.6 }), fade));
      const acc = new AccumPass(); comp.addPass(acc);
      comp.setSize(innerWidth, innerHeight, false);
      titleRig = { T, comp, gain, fade, acc, bloom };
    }
    const { T, comp, gain, fade, acc, bloom } = titleRig;
    for (let k = 0; k < K; k++) {
      const ts = t + ((k + 0.5) / K) * 0.5 / FPS;
      const L = T.update(ts, { x: innerWidth, y: innerHeight });
      gain.uniforms.get('uGain').value = L.exposure;
      bloom.intensity = 0.35 + Math.max(0, L.bloom - 0.55) * 1.2;   // the slam flares, then the letters stay crisp
      fade.uniforms.get('uGain').value = 1 - L.fade;
      acc.weight = 1 / K; acc.first = k === 0; acc.present = k === K - 1;
      comp.render(1 / FPS / K);
    }
  }

  function frame(i) {
    const idx = SHOTS.findIndex((s) => i >= s.f0 && i < s.f1);
    const meta = SHOTS[idx];
    if (SH[meta.name] && SH[meta.name].title) {
      resetWorld(); hud.show(false); document.body.classList.add('in-match'); bars.style.setProperty('--bar', '0%');
      titleRender((i - meta.f0) / FPS + (SH[meta.name].t0 || 0), scoutMode ? 1 : Math.max(1, Math.round(8 * Kmul)));
      return meta.name;
    }
    const j = i - meta.f0;
    if (!S.shot || S.shot.idx !== idx || S.shot.j >= j) begin(idx);
    // catch up without rendering, through the same sub-frame steps a full render would take
    for (let jj = S.shot.j + 1; jj < j; jj++) advanceFrame(jj, false);
    advanceFrame(j, true);
    return meta.name;
  }

  /** Scout: render any camera at a shot's state (no sub-frames). */
  function look(c, name) {
    if (name) { const idx = SHOTS.findIndex((s) => s.name === name); begin(idx); }
    const gp = (p) => v3(p[0], p[1] + (c.rel === false ? 0 : H.heightAt(p[0], p[2])), p[2]); // heights above the ground
    placeCamera({ fov: 50, ...c, pos: gp(c.pos), look: gp(c.look) }, 0);
    upkeep(); accum.weight = 1; accum.first = true; accum.present = true; composer.render(1 / 60);
    return true;
  }

  // ---- physics audit: what a viewer reads as fake, checked by the numbers on every frame of every shot ----------
  // touch    two live bodies pressed together (games push bodies apart, so they rarely overlap: they press)
  // blocked  told to move but not moving: running into someone or something
  // hover    off the ground and not falling (standing on a head, stuck on a ledge, a missing gravity step)
  // teleport moved further in one frame than its own velocity explains (a scripted position, a collision pop)
  // jitter   lots of motion that goes nowhere (vibrating against a wall or another body)
  // sink     below the ground        snap   aim turned faster than an arm swings
  // camera   a cinematic camera inside or skimming the ground or a prop
  // Times are simulated seconds (bullet time hides nothing). A shot allows a scripted contact with
  // `contact: [['a', 'b']]` (cast keys) or a whole kind with `allow: ['hover']`. Per game, shots.js can export
  // AUDIT_CONFIG to override any field below (a flyer: hover false, touch 4, jump 0.4; a car: its own body size).
  const AC = Object.assign({
    actors: () => ctx.bears.filter((b) => b.mesh && b.mesh.root.visible),   // GAME-SPECIFIC: every moving body
    key: (b) => (b.film && b.film.key) || b.name,
    alive: (b) => b.alive !== false,
    vel: (b) => b.vel || null,                       // the velocity the simulation moves it by (m/s), or null
    move: (b) => { const m = b.film && b.film.cmd && b.film.cmd.move; return m ? Math.hypot(m[0], m[1]) : 0; },
    aim: (b) => b.aimPoint || null, eye: 1.3,        // what the body points at, and the height it points from
    ground: (x, z, y) => ctx.colliders.groundAt(x, z, y + 0.5, 0.3),   // GAME-SPECIFIC: the top surface under a point
    terrain: (x, z) => H.heightAt(x, z),                               // GAME-SPECIFIC: the bare terrain height (camera check)
    touch: 0.78, touchY: 1.5, touchT: 0.12, blockT: 0.25, hover: true, hoverH: 0.25, hoverT: 0.12, hoverVy: 0.5,
    jump: 0.15, maxV: 13, snap: 26, camClear: 0.1, jitterT: 0.3, jitterPath: 0.35, jitterNet: 0.12,
  }, SHOTMOD.AUDIT_CONFIG || {});
  function auditFrame(shot, name, ft, st, out, cam) {
    const actors = AC.actors();
    const dt = Math.max(1e-4, S.simT - (st.simT ?? S.simT)); st.simT = S.simT;
    const key = AC.key;
    const ok = (kind, a, b) => (shot.allow || []).includes(kind) || (shot.contact || []).some(([x, y]) => (x === key(a) && y === key(b)) || (x === key(b) && y === key(a)));
    const flag = (kind, who, detail) => {
      const k = kind + ':' + who, e = st.seen.get(k);
      if (e) { e.frames++; e.until = +ft.toFixed(2); return; }
      const n = { shot: name, kind, who, at: +ft.toFixed(2), until: +ft.toFixed(2), frames: 1, detail };
      st.seen.set(k, n); out.push(n);
    };
    // the camera: a cinematic camera never sits inside the ground or a prop
    if (cam && cam.pos && !(shot.allow || []).includes('camera')) {
      const c = cam.pos, g = AC.terrain(c.x, c.z);
      if (c.y - g < AC.camClear) flag('camera', 'camera', `${(c.y - g).toFixed(2)} m above the terrain`);
    }
    if (dt < 1e-3) return;
    const timer = (map, id, on) => { const v = on ? (map.get(id) || 0) + dt : 0; map.set(id, v); return v; };
    for (let i = 0; i < actors.length; i++) {
      const a = actors[i], aliveA = AC.alive(a);
      for (let j = i + 1; j < actors.length; j++) {
        const b = actors[j], id = key(a) + '+' + key(b);
        const d = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
        const on = aliveA && AC.alive(b) && d < AC.touch && Math.abs(a.pos.y - b.pos.y) < AC.touchY && !ok('touch', a, b);
        if (timer(st.touch, id, on) > AC.touchT) flag('touch', id, `${d.toFixed(2)} m apart`);
      }
      const p = st.pos.get(a), k = key(a), vel = AC.vel(a);
      const v = p ? Math.hypot(a.pos.x - p.x, a.pos.z - p.z) / dt : 0, vy = p ? (a.pos.y - p.y) / dt : 0;
      st.pos.set(a, a.pos.clone());
      if (!aliveA) continue;
      const vs = vel ? Math.hypot(vel.x, vel.z) : 0;
      if (p && !ok('teleport', a, a)) {
        // moved further than its own velocity explains (a scripted position, a collision pop); with no velocity to
        // compare, faster than anything alive moves
        const dev = vel ? Math.hypot(a.pos.x - p.x - vel.x * dt, a.pos.z - p.z - vel.z * dt) : 0;
        if (vel ? dev > AC.jump && v > vs * 0.5 : v > AC.maxV) flag('teleport', k, vel ? `${dev.toFixed(2)} m jump in one frame` : `${v.toFixed(1)} m/s`);
      }
      // trying to move (the script asks, or its own velocity says so) but going nowhere: pushing into a body or a wall
      const trying = AC.move(a) > 0.3 || vs > 2;
      if (timer(st.block, k, p && trying && v < Math.max(0.6, vs * 0.3) && !ok('blocked', a, a)) > AC.blockT) flag('blocked', k, `trying to move${vs ? ` at ${vs.toFixed(1)} m/s` : ''}, moving ${v.toFixed(1)} m/s`);
      // jitter: over each jitterT window, a long path with almost no net displacement
      if (p) {
        const w = st.jit.get(a) || { t: 0, path: 0, from: p.clone() };
        w.t += dt; w.path += Math.hypot(a.pos.x - p.x, a.pos.z - p.z);
        if (w.t >= AC.jitterT) {
          const net = Math.hypot(a.pos.x - w.from.x, a.pos.z - w.from.z);
          if (w.path > AC.jitterPath && net < AC.jitterNet && !ok('jitter', a, a)) flag('jitter', k, `${w.path.toFixed(2)} m of motion, ${net.toFixed(2)} m net`);
          w.t = 0; w.path = 0; w.from = a.pos.clone();
        }
        st.jit.set(a, w);
      }
      const g = AC.ground(a.pos.x, a.pos.z, a.pos.y);
      if (a.pos.y < g - 0.08 && !ok('sink', a, a)) flag('sink', k, `${(g - a.pos.y).toFixed(2)} m under`);
      if (AC.hover && timer(st.hover, k, p && a.pos.y - g > AC.hoverH && Math.abs(vy) < AC.hoverVy && !ok('hover', a, a)) > AC.hoverT) flag('hover', k, `${(a.pos.y - g).toFixed(2)} m up, not falling`);
      const ap = AC.aim(a);
      if (ap) {
        const e = v3(a.pos.x, a.pos.y + AC.eye, a.pos.z), dir = ap.clone().sub(e).normalize(), q = st.aim.get(a);
        if (q) { const w = Math.acos(Math.min(1, Math.max(-1, q.dot(dir)))) / dt; if (w > AC.snap && !ok('snap', a, a)) flag('snap', k, `aim turned ${w.toFixed(0)} rad/s`); }
        st.aim.set(a, dir);
      }
    }
  }

  /** Per-frame numbers for cast members of one shot (no rendering): position, speed, ground clearance, state. */
  function trace(name, keys) {
    const idx = SHOTS.findIndex((x) => x.name === name), meta = SHOTS[idx], shot = SH[meta.name];
    begin(idx);
    const out = [], last = new Map();
    for (let j = 0; j < meta.f1 - meta.f0; j++) {
      const t0 = S.simT;
      advanceFrame(j, false);
      const dt = Math.max(1e-4, S.simT - t0);
      for (const b of AC.actors()) {
        const k = AC.key(b);
        if (keys && keys.length && !keys.includes(k)) continue;
        const p = last.get(b), g = AC.ground(b.pos.x, b.pos.z, b.pos.y);
        out.push({ f: meta.f0 + j, t: +((j + 1) / FPS).toFixed(3), who: k, x: +b.pos.x.toFixed(2), y: +b.pos.y.toFixed(2), z: +b.pos.z.toFixed(2),
          v: p ? +(Math.hypot(b.pos.x - p.x, b.pos.z - p.z) / dt).toFixed(1) : 0, clear: +(b.pos.y - g).toFixed(2), alive: b.alive, grounded: !!b.grounded });
        last.set(b, b.pos.clone());
      }
    }
    S.shot = null;
    return out;
  }

  const AUDIT = [];
  function collect() {
    FX.shots.length = 0; AUDIT.length = 0;
    const out = [];
    for (let idx = 0; idx < SHOTS.length; idx++) {
      const meta = SHOTS[idx], shot = SH[meta.name];
      if (shot.title) continue;
      begin(idx);
      FX.shots.length = 0;
      const n = meta.f1 - meta.f0;
      const st = { pos: new Map(), touch: new Map(), block: new Map(), hover: new Map(), aim: new Map(), jit: new Map(), seen: new Map() };
      for (let j = 0; j < n; j++) {
        const k0 = FX.shots.length;
        advanceFrame(j, false);
        const camNow = shot.cam && !shot.hud ? shot.cam((j + 0.5) / FPS + (shot.t0 || 0), (j + 0.5) / n) : null;
        auditFrame(shot, meta.name, meta.f0 / FPS + (j + 1) / FPS, st, AUDIT, camNow);
        // where the camera is on the frame each shot fires (the cameras read the live state)
        if (FX.shots.length > k0 && shot.cam && !shot.hud) { const c = shot.cam((j + 0.5) / FPS + (shot.t0 || 0), (j + 0.5) / n); for (let q = k0; q < FX.shots.length; q++) FX.shots[q].cam = c.pos.clone(); }
      }
      for (const e of FX.shots) {
        if (e.ft < (shot.t0 || 0)) continue; // pre-roll, or before the cut
        const cp = e.cam || camera.position;
        out.push({ t: +(meta.f0 / FPS + e.ft - (shot.t0 || 0)).toFixed(4), shot: meta.name, wid: e.wid, snd: e.snd, who: e.who, dist: +cp.distanceTo(e.pos).toFixed(2), speed: shot.speed ? +shot.speed(e.ft).toFixed(3) : 1 });
      }
    }
    S.shot = null;
    return out;
  }

  return { frame, look, collect, trace, audit: () => AUDIT, FRAMES, SHOTS, EDIT, BPM, BEATS, ready: true, setK: (k) => { Kmul = k; }, setScout: (s) => { scoutMode = s; }, W, S, ctx };
}
