// shots.js: the STUFFED ad. One 3v3 match on Redrock Canyon at sunset, start to win, cut to the rock track
// "Carry On" (145 BPM). The music sits at film 0.832 s, so film beat n = n * 60/145 s and bars fall on
// multiples of 4: intro stabs 4-16, build 16-36, breakdown 36-44, drop at 44, ending stabs 84-96, the
// last chord (title) at 96.
// A shot: { setup(), cam(t, u) -> { pos, look, fov, focus|focusOn, bokeh, range, hand }, tick(t, dt) (after the
// bears update), speed(t) (game s per film s), K (sub-frames), pre, rounds, rays, bars, hud }.
export const BPM = 145;
export const MUSIC_AT = 0.832;
export const EDIT = [
  // ACT 1 (letterboxed): the pump, the squad, the rivals
  ['rack', 0, 8], ['squad', 8, 4], ['rivals', 12, 4],
  // ACT 2 (the bars open): first contact, off the bridge, the epic chest
  ['contact', 16, 6], ['flop', 22, 4], ['chest', 26, 6], ['chestup', 32, 4],
  // breakdown: the grenade
  ['arc', 36, 4], ['toss', 40, 4],
  // DROP
  ['boom', 44, 4], ['maple', 48, 4], ['glint', 52, 2], ['scope', 54, 4], ['flank', 58, 6], ['wide', 64, 4],
  ['grizz', 68, 4], ['down', 72, 4],
  // the last point: hero vs Grizz on the bridge
  ['face', 76, 4], ['eyeH', 80, 2], ['eyeG', 82, 2], ['charge', 84, 4], ['leap', 88, 4], ['ko', 92, 2], ['win', 94, 2],
  ['title', 96, 9],
];
export const BEATS = EDIT.at(-1)[1] + EDIT.at(-1)[2];
// the end title: the game's name, its link, and the game's own stuffing sprites bursting out on the slam
// physics audit settings for this game (film.js AC): bears are the defaults, so nothing to change here
export const AUDIT_CONFIG = {};
export const TITLE = { word: 'STUFFED', link: 'stuffed-game.vercel.app', fluff: (ctx) => ctx.fx.stuff.mat.uniforms.map.value };

export function makeShots(W) {
  const { THREE, ctx, stage, BONE, v3, clamp } = W;
  const gy = (x, z) => W.H.heightAt(x, z);
  /** the top surface (rock, deck, platform) under x, z */
  const top = (x, z, from = 40) => ctx.colliders.groundAt(x, z, from, 0);
  const G = (x, h, z) => v3(x, gy(x, z) + h, z);
  const T = (x, h, z) => v3(x, top(x, z) + h, z);
  const ease = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
  const easeIO = (u) => { u = clamp(u); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const lerp = (a, b, t) => a + (b - a) * t;
  const L = (fur, vest, bandana, skin) => (skin ? { fur, vest, bandana, skin } : { fur, vest, bandana });
  const fwd = (b) => v3(Math.sin(b.yaw), 0, Math.cos(b.yaw));
  const right = (b) => v3(-Math.cos(b.yaw), 0, Math.sin(b.yaw));
  const head = (b) => BONE(b, 'head').add(v3(0, 0.06, 0));
  const chest = (b) => BONE(b, 'spine').add(v3(0, 0.15, 0));
  const toYaw = (dx, dz) => Math.atan2(dx, dz);
  const R = () => Math.random();
  const orbit = (b, az, el, d, lift = 1.1, fov = 45) => {
    const a = b.yaw + az, c = v3(b.pos.x, b.pos.y + lift, b.pos.z);
    const pos = c.clone().add(v3(Math.sin(a) * Math.cos(el), Math.sin(el), Math.cos(a) * Math.cos(el)).multiplyScalar(d));
    return { pos, look: c, fov, focusOn: c };
  };
  const lowReady = (b, yaw = b.yaw) => v3(b.pos.x + Math.sin(yaw) * 3 + Math.cos(yaw) * 2.2, b.pos.y + 0.1, b.pos.z + Math.cos(yaw) * 3 - Math.sin(yaw) * 2.2);
  const pull = (t, t0, w = 0.02) => t >= t0 && t < t0 + w;
  const B = 60 / BPM;

  // ---- the cast: Lakeside (sky) vs Ridgeline (red), the same six bears all the way through
  const C = {
    hero: { name: 'You', team: 0, player: true, look: L('honey', 'sage', 'sky'), gun: 'shotgun' },
    maple: { name: 'Maple', team: 0, look: L('cream', 'tan', 'sky'), gun: 'dmr' },
    pip: { name: 'Pip', team: 0, look: L('silver', 'slate', 'sky'), gun: 'sniper' },
    grizz: { name: 'Grizz', team: 1, look: L('charcoal', 'black', 'red', 'grizzly'), gun: 'lmg' },
    biscuit: { name: 'Biscuit', team: 1, look: L('cinnamon', 'rust', 'red'), gun: 'sniper' },
    cocoa: { name: 'Cocoa', team: 1, look: L('chocolate', 'olive', 'red'), gun: 'carbine' },
  };
  const who = (key, o = {}) => ({ key, ...C[key], ...o });
  const noPlayer = (o) => ({ ...o, player: false });

  // ---- places (Redrock Canyon): Table Rock in the middle, the east rope bridge to the East Shelf, Signal Butte
  const SUN = v3(-0.86, 0.2, -0.47).normalize();
  const AWAY = v3(-SUN.x, 0, -SUN.z).normalize();          // walking away from the sun
  const SIDE = v3(-AWAY.z, 0, AWAY.x);
  const BR = { x0: 19.5, x1: 36.5, z: -5 };                  // east rope bridge deck (runs along x)
  const deckY = (x) => top(x, BR.z, 20);
  const CHEST = [2, -8];
  const BUTTE = [60, -52];
  const COVER = [8, 0];                                      // log barricade on Table Rock (the grenade)
  const OPEN = v3(-13, 0, -3);                               // the opening: Table Rock's west side, the sun beyond the slot
  const LEAP = { x0: 18.5, g: 31.0, jump: 0.2, fire: 0.52 };   // run-up start, Grizz, leap and shot (sim s)

  // ---- props and overlays ----------------------------------------------------------------------
  function glint() {
    if (!W.glintS) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.1, 'rgba(255,240,210,0.8)'); gr.addColorStop(1, 'rgba(255,200,140,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128); g.fillStyle = 'rgba(255,250,235,0.9)'; g.fillRect(0, 62, 128, 4); g.fillRect(62, 0, 4, 128);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      W.glintS = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(4, 3.4, 2.6), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, toneMapped: false }));
      W.glintS.renderOrder = 10; ctx.scene.add(W.glintS);
    }
    return W.glintS;
  }
  function clearProps() { if (W.glintS) W.glintS.visible = false; }
  /** extra head/neck turn on top of the game's pose (radians) */
  function look(b, yaw = 0, pitch = 0, roll = 0) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ')), id = new THREE.Quaternion();
    b.mesh.bones.neck.quaternion.multiply(id.clone().slerp(q, 0.35));
    b.mesh.bones.head.quaternion.multiply(q.clone().slerp(id, 0.35));
    b.mesh.root.updateMatrixWorld(true);
  }
  /** the loot chest on Table Rock holds `gun` (rarity from the gun) */
  function chestItem(gun, rarity) {
    const pk = ctx.pickups;
    let it = null, bd = 1e9;
    for (const x of pk.items) if (x.kind === 'crate' && !x.drop) { const d = Math.hypot(x.x - CHEST[0], x.z - CHEST[1]); if (d < bd) { bd = d; it = x; } }
    it.offer = gun; it.rarity = rarity; pk._tint(it); it.dirty = true; pk._draw(it);
    return it;
  }
  /** pitch that throws a grenade from `b` (standing still, facing `to`) onto point `to` */
  function grenadePitch(b, to) {
    const g = 14, sp = 16, lift = 4;
    const o = v3(b.pos.x, b.pos.y + 1.62, b.pos.z);
    const D = Math.hypot(to.x - o.x, to.z - o.z), dy = to.y - o.y;
    // landing time when the arc comes back down to the target height: dy = vy t - g t^2 / 2
    const land = (p) => { const vy = Math.sin(p) * sp + lift, vh = Math.cos(p) * sp; return vh * (vy + Math.sqrt(Math.max(0, vy * vy - 2 * g * dy))) / g; };
    let lo = -0.6, hi = 0.7;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (land(m) < D) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  const speedRamp = (pts) => (t) => { // [[t, speed], ...] eased between points
    if (t <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (t < pts[i][0]) return lerp(pts[i - 1][1], pts[i][1], ease((t - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0])));
    return pts.at(-1)[1];
  };

  // ---- stagings shared by several shots -----------------------------------------------------------
  /** the squad walk: three Lakeside bears cross Table Rock away from the sun */
  const SQUAD0 = v3(-7.5, 0, -9.5);
  const squadAt = (k, s) => { const o = { hero: 0, maple: -1.7, pip: 1.7 }[k]; return [SQUAD0.x + SIDE.x * o + AWAY.x * s, SQUAD0.z + SIDE.z * o + AWAY.z * s]; };

  const SH = {
    // ================================================================ ACT 1
    rack: {
      // silence: a macro slide along the Timber Pump in the low sun; the pump racks on the riff's first
      // downbeat (film 1.655 s) and the shell spins out; the camera pulls back and up to the face as the gun
      // swings from low ready out to the shoulder
      pre: 1.5, bars: 1, rays: 0.55, K: 12, shadow: 5,
      speed: () => 0.5,
      lights: () => [{ cam: true, i: 0.75, color: 0xffd9b8, up: 0.25, side: 0.5 }, { rim: true, i: 1.4, color: 0xffbf86, up: 0.35, side: -0.35 }],
      motes: () => ({ c: chest(W.c.hero).addScaledVector(AWAY, 0.7), r: 1.4, i: 0.55 }),
      setup() {
        const yaw = toYaw(AWAY.x, AWAY.z) + 1.15;
        const far = v3(OPEN.x + Math.sin(yaw - 0.5) * 30, top(OPEN.x, OPEN.z) + 1.2, OPEN.z + Math.cos(yaw - 0.5) * 30);
        W.c = stage({ cast: [who('hero', { at: [OPEN.x, OPEN.z], yaw, act: (t, b) => ({ yaw: t < 0.95 ? yaw : yaw - 0.5, aim: t < 0.95 ? lowReady(b, yaw) : far, swing: 4.5, turn: 2.5 }) })] });
        W.racked = false; W.shell = false;
      },
      tick(t) {
        const b = W.c.hero, w = b.weapon;
        if (!W.racked && t >= 0.575) { w.pumpT = w.def.pump; W.racked = true; }
        if (!W.shell && t >= 0.8) {
          // the spent shell spins out of the port toward the lens (the game throws it off the far side)
          ctx.fx.ejectCasing(b, w.def); W.shell = true;
          const e = ctx.fx.casings[w.def.casing].list.at(-1), q = b.gun.obj.getWorldQuaternion(new THREE.Quaternion());
          const gx = v3(1, 0, 0).applyQuaternion(q), sgn = gx.dot(AWAY) >= 0 ? 1 : -1;
          if (e) { e.v.copy(gx).multiplyScalar(0.75 * sgn).add(v3(0, 0.55, 0)).addScaledVector(v3(0, 0, 1).applyQuaternion(q), 0.35); e.w.set(9, 4, 14); }
        }
      },
      cam: (t, u) => {
        const h = W.c.hero, g = h.gun.obj; g.updateMatrixWorld(true);
        // the side of the gun that faces the camera's general direction (away from the sun)
        const gx = v3(1, 0, 0).applyQuaternion(g.getWorldQuaternion(new THREE.Quaternion()));
        const sgn = gx.dot(AWAY) >= 0 ? 1 : -1;
        const a = clamp(t / 1.5), slide = easeIO(a);
        const macro = g.localToWorld(v3(sgn * lerp(0.3, 0.5, slide), lerp(0.06, 0.1, slide), lerp(0.5, 0.2, slide)));
        const macroAt = g.localToWorld(v3(0, 0.0, lerp(0.56, 0.22, slide)));
        // after the rack: back and up to a low three-quarter on the face, the sun behind the head
        const hd = head(h), k = easeIO(clamp((t - 1.75) / 1.45));
        const wide = hd.clone().addScaledVector(AWAY, 1.55).addScaledVector(SIDE, -0.45).add(v3(0, -0.32, 0));
        const pos = macro.clone().lerp(wide, k), look = macroAt.clone().lerp(hd.clone().add(v3(0, -0.06, 0)), k);
        const foc = macroAt.clone().lerp(hd, ease(clamp((t - 1.9) / 0.9)));
        return { pos, look, fov: lerp(30, 34, k), focusOn: foc, bokeh: lerp(3.6, 2.4, k), range: lerp(0.07, 0.35, k), near: 0.01, hand: lerp(0.0015, 0.003, k) };
      },
    },
    squad: {
      lights: () => [{ cam: true, i: 0.55, color: 0xffdcc0, up: 0.2 }], shadow: 14, motes: () => ({ c: chest(W.c.hero).addScaledVector(AWAY, 2.5), r: 2.2, i: 0.9 }),
      pre: 1.2, bars: 1, rays: 0.6, K: 8,
      speed: () => 0.5,
      setup() {
        const yaw = toYaw(AWAY.x, AWAY.z);
        const act = () => (t, b) => ({ move: [AWAY.x * 0.62, AWAY.z * 0.62], yaw, aim: lowReady(b, yaw), turn: 5 });
        W.c = stage({ cast: ['hero', 'maple', 'pip'].map((k) => who(k, { at: squadAt(k, 0), yaw, act: act() })) });
      },
      cam: (t, u) => {
        const h = W.c.hero, k = easeIO(u);
        const c = v3(h.pos.x, h.pos.y, h.pos.z);
        const pos = c.clone().addScaledVector(AWAY, lerp(7.5, 6.2, k)).addScaledVector(SIDE, 0.6); pos.y = top(pos.x, pos.z) + 0.32;
        const lookAt = c.clone().add(v3(0, 1.5, 0));
        return { pos, look: lookAt, fov: 40, focusOn: chest(h), bokeh: 1.4, range: 2.5, hand: 0.003 };
      },
    },
    rivals: {
      lights: () => [{ cam: true, i: 0.55, color: 0xffe2c8, up: 0.3 }], shadow: 14,
      pre: 1.5, bars: 1, K: 8,
      speed: () => 0.6,
      setup() {
        const yaw = toYaw(-1, 0.05);
        W.c = stage({ cast: [
          who('hero', { at: [-30, 30] }),
          who('grizz', { at: [43.5, -5], yaw, act: (t, b) => ({ yaw, aim: t < 0.55 ? lowReady(b, yaw) : T(20, 1.4, -5), turn: 3.5 }) }),
          who('biscuit', { at: [46, -7.6], yaw, act: (t, b) => ({ yaw, aim: lowReady(b, yaw) }) }),
          who('cocoa', { at: [46.3, -2.4], yaw, act: (t, b) => ({ yaw, aim: lowReady(b, yaw) }) }),
        ] });
      },
      cam: (t, u) => {
        const g = W.c.grizz, k = easeIO(u);
        const pos = T(lerp(38.6, 39.2, k), 1.15, -6.3);
        return { pos, look: chest(g).add(v3(0, 0.1, -0.3)), fov: 36, focusOn: chest(g), bokeh: 1.4, range: 2.2, hand: 0.004 };
      },
    },

    // ================================================================ ACT 2: the bars open on the build
    contact: {
      hud: true, pre: 1.2,
      bars: (t) => 1 - ease(t / 0.45),
      setup() {
        const yE = toYaw(1, 0);
        W.c = stage({ mode: '3v3', cast: [
          who('hero', { at: [9, -4.6], yaw: yE, act: (t, b) => ({ move: t > -0.2 && t < 0.95 ? [0.9, 0] : [0, 0], sprint: t > -0.2 && t < 0.8, aim: W.c.cocoa.alive ? { bear: W.c.cocoa, part: 'spine' } : T(30, 1.2, -5), fire: pull(t, 1.15) || pull(t, 1.8), turn: 7 }) }),
          who('cocoa', { at: [38, -5], yaw: toYaw(-1, 0), mortalAt: 1.7, kb: 0.9, act: (t, b) => ({ move: t > -0.2 ? [-1, 0] : [0, 0], sprint: t > -0.2, aim: { bear: W.c.hero }, fire: t > 1.0 && t < 1.7, yaw: toYaw(-1, 0) }) }),
        ] });
        ctx.match.teamScore = [3, 2];
      },
    },
    flop: {
      shadow: 16,
      pre: 1.5, rays: 0.5, K: 10, bars: 0,
      speed: speedRamp([[0, 0.5], [0.35, 0.16], [1.3, 0.16], [1.6, 0.35]]),
      setup() {
        W.c = stage({ cast: [
          who('hero', { at: [18.2, -6.2], yaw: toYaw(1, 0.1), act: (t) => ({ aim: W.c.cocoa.alive ? { bear: W.c.cocoa, part: 'spine' } : T(26, 1.2, -5), ads: true, fire: pull(t, 0.15) }) }),
          who('cocoa', { at: [26, -5], yaw: toYaw(-1, 0), mortalAt: 0.1, kb: 1.4, act: (t) => ({ move: t > -0.25 ? [-0.8, 0] : [0, 0], sprint: t > -0.25, aim: { bear: W.c.hero }, yaw: toYaw(-1, 0) }) }),
        ] });
        W.pushed = false;
      },
      tick() {
        const c = W.c.cocoa;
        if (!c.alive && c.kb && !W.pushed) { c.kb.v.z += 3.6; c.kb.v.y += 1.2; c.film.noCollide = true; W.pushed = true; }
      },
      cam: (t, u) => {
        const k = easeIO(u), y = deckY(25);
        const c = W.c.cocoa.pos;
        const pos = v3(lerp(27.2, 26.8, k), y - lerp(1.6, 2.4, k), 0.4);
        return { pos, look: c.clone().add(v3(0, 0.7, 0)), fov: 44, focusOn: c, bokeh: 0.8, range: 3, hand: 0.004 };
      },
    },
    chest: {
      hud: true, pre: 1.0,
      setup() {
        W.c = stage({ mode: '3v3', cast: [
          who('hero', { at: [CHEST[0] - 1.45, CHEST[1] - 0.75], yaw: toYaw(1, 0.3), act: (t, b) => ({ aim: T(CHEST[0] + 3.2, 0, CHEST[1] + 1.3), interact: (t > 0.12 && W.it.cool <= 0 && !ctx.pickups.search) || (t > 1.45 && W.it.cool > 0 && b.weapons[1].id !== 'auto_shotgun') }) }),
        ] });
        W.it = chestItem('auto_shotgun', 'epic');
        ctx.match.teamScore = [4, 2];
      },
    },
    chestup: {
      lights: () => [{ cam: true, i: 0.7, color: 0xffdcc0, up: 0.3 }, { rim: true, i: 1.1, color: 0xffc088, up: 0.5 }], shadow: 10, motes: () => ({ c: head(W.c.hero), r: 1.6, i: 0.8 }),
      pre: 1.5, rays: 0.55, K: 8,
      speed: () => 0.5,
      setup() {
        W.c = stage({ cast: [
          who('hero', { gun: 'auto_shotgun', at: [CHEST[0] - 1.35, CHEST[1] + 0.25], yaw: toYaw(1, -0.2), act: (t, b) => ({ aim: t < 0.45 ? lowReady(b) : T(30, 1.3, 2), yaw: t < 0.45 ? toYaw(1, -0.2) : undefined, ads: t > 0.7, turn: 4 }) }),
        ] });
        const it = chestItem('shotgun', 'common');
        it.cool = 30; it.open = 1; it.rise = 1; it.dirty = true; ctx.pickups._draw(it); // the old pump left lying in the chest
      },
      cam: (t, u) => {
        const h = W.c.hero, k = easeIO(u);
        const c = T(CHEST[0], 0, CHEST[1]);
        const pos = c.clone().add(v3(lerp(1.15, 1.0, k), 0.42, lerp(-0.9, -0.6, k)));
        return { pos, look: head(h).add(v3(0, -0.35, 0)), fov: 46, focusOn: head(h), bokeh: 1.0, range: 1.8, hand: 0.003 };
      },
    },

    // ================================================================ breakdown: the grenade
    arc: {
      hud: true, pre: 1.0,
      setup() {
        const at = [-7, -9], to = T(COVER[0] + 1.4, 0, COVER[1] + 0.9);
        W.c = stage({ mode: '3v3', cast: [
          who('hero', { gun: 'auto_shotgun', at, yaw: toYaw(to.x - at[0], to.z - at[1]), act: (t, b) => ({ yaw: toYaw(to.x - b.pos.x, to.z - b.pos.z), pitch: W.gp, grenHold: t < 0.95, turn: 6 }) }),
          ...coverReds(),
        ] });
        W.gp = grenadePitch(W.c.hero, to);
        ctx.match.teamScore = [11, 9];
      },
    },
    toss: {
      shadow: 14,
      pre: 0.9, rays: 0.4, K: 10,
      speed: speedRamp([[0, 0.85], [0.9, 0.85], [1.25, 0.22]]),
      setup() {
        const at = [-7, -9], to = T(COVER[0] + 1.4, 0, COVER[1] + 0.9);
        W.c = stage({ cast: [
          who('hero', { gun: 'auto_shotgun', at, yaw: toYaw(to.x - at[0], to.z - at[1]), act: (t, b) => ({ yaw: toYaw(to.x - b.pos.x, to.z - b.pos.z), pitch: W.gp, grenHold: t < -0.35, turn: 6 }) }),
          ...coverReds(),
        ] });
        W.gp = grenadePitch(W.c.hero, to);
        W.to = to;
      },
      tick(t) {
        // the two of them look down at what just landed
        const g = ctx.grenades.list[0];
        if (g && g.ground) for (const k of ['grizz', 'cocoa']) look(W.c[k], 0, 0.45 * ease((t - 1.0) / 0.3), 0);
      },
      cam: (t, u) => {
        const g = ctx.grenades.list[0];
        // a chase camera behind the grenade: the two reds behind the barricade come up ahead of it
        const p = g ? g.p.clone() : (W.lastG || W.to.clone().add(v3(0, 0.3, 0)));
        W.lastG = p;
        const D = v3(W.to.x + 7, 0, W.to.z + 9).normalize(), Sd = v3(-D.z, 0, D.x);
        const pos = p.clone().addScaledVector(D, -lerp(1.0, 3.2, ease(u))).addScaledVector(Sd, 0.45).add(v3(0, lerp(0.4, 0.75, ease(u)), 0));
        return { pos, look: p.clone().addScaledVector(D, 1.6).add(v3(0, -0.15, 0)), fov: 42, focusOn: p, bokeh: 1.0, range: 1.4, hand: 0.004 };
      },
    },

    // ================================================================ DROP
    boom: {
      lights: () => [{ cam: true, i: 0.45, color: 0xffe0c8, up: 0.3 }], shadow: 16,
      pre: 1.2, rays: 0.35, K: 10,
      speed: speedRamp([[0, 0.12], [0.75, 0.12], [1.35, 0.8]]),
      setup() {
        W.c = stage({ cast: [who('hero', { at: [-7, -9] }), ...coverReds({ mortal: true })] });
        W.boom = false;
      },
      tick(t) {
        if (!W.boom && t >= -0.05) {
          const p = T(COVER[0] + 1.3, 0.06, COVER[1] + 0.8);
          ctx.grenades.throwFrom(W.c.hero, p, v3(0.2, 0, 0.1), { age: 2.6 - 0.056 }); // goes off on the cut (the drop)
          W.boom = true;
        }
      },
      cam: (t, u) => {
        const c = T(COVER[0] + 1.3, 0, COVER[1] + 0.8), k = easeIO(u);
        const pos = c.clone().add(v3(lerp(4.0, 4.8, k), lerp(0.45, 0.8, k), lerp(-3.3, -4.0, k)));
        return { pos, look: c.clone().add(v3(0, 1.1, 0)), fov: 50, focus: pos.distanceTo(c), bokeh: 0.6, range: 4, hand: 0.006 };
      },
    },
    maple: {
      lights: () => [{ cam: true, i: 0.65, color: 0xffe0c4, up: 0.3 }, { rim: true, i: 1.0, color: 0xffc088, up: 0.5 }], shadow: 10,
      pre: 1.2, K: 8, rounds: true,
      speed: () => 0.45,
      setup() {
        const b0 = T(BUTTE[0], 0, BUTTE[1]);
        W.c = stage({ cast: [
          who('hero', { at: [-30, 30] }),
          noPlayer(who('maple', { at: [5.2, -10.6], act: (t) => ({ aim: b0.clone().add(v3(0, 1.3, 0)), ads: true, fire: t > 0.05 && (t % 0.3) < 0.15 }) })),
          who('biscuit', { at: BUTTE, act: (t, b) => ({ aim: lowReady(b) }) }),
        ] });
        W.c.maple.pos.y = top(5.2, -10.6);
      },
      cam: (t, u) => {
        const m = W.c.maple, k = easeIO(u);
        const a = toYaw(BUTTE[0] - m.pos.x, BUTTE[1] - m.pos.z);
        const c = chest(m);
        const pos = c.clone().add(v3(Math.sin(a + lerp(1.05, 0.75, k)) * 2.2, -0.45, Math.cos(a + lerp(1.05, 0.75, k)) * 2.2));
        return { pos, look: c.clone().add(v3(Math.sin(a) * 0.6, 0.12, Math.cos(a) * 0.6)), fov: 44, focusOn: c, bokeh: 1.2, range: 1.6, hand: 0.005 };
      },
    },
    glint: {
      pre: 1.2, K: 6,
      setup() {
        W.c = stage({ cast: [
          who('hero', { at: [-30, 30] }),
          noPlayer(who('pip', { at: [-3.5, -12] })),
          who('biscuit', { at: BUTTE, act: () => ({ aim: T(-3.5, 1.4, -12), ads: true }) }),
        ] });
        W.c.biscuit.pos.y = top(BUTTE[0], BUTTE[1]);
      },
      tick() {
        const s = glint(), b = W.c.biscuit; s.visible = true;
        const g = b.gun && b.gun.sight ? b.gun.sight.getWorldPosition(v3()) : head(b);
        s.position.copy(g); s.scale.setScalar(0.42);
      },
      cam: (t, u) => {
        const b = W.c.biscuit, c = head(b);
        const pos = T(-3.5, 1.5, -12).lerp(c, lerp(0.0, 0.04, u));
        return { pos, look: c.clone().add(v3(0, -0.25, 0)), fov: lerp(3.9, 3.4, u), focusOn: c, bokeh: 0.5, range: 6, hand: 0.0009 };
      },
    },
    scope: {
      hud: true, pre: 1.2,
      setup() {
        W.c = stage({ mode: '3v3', cast: [
          who('pip', { player: true, at: [-3.5, -12], act: () => ({ aim: { bear: W.c.biscuit, part: 'head' }, ads: true, fire: pull(W.S.t, 0.85), turn: 5 }) }),
          who('biscuit', { at: BUTTE, mortalAt: 0.5, kb: 1.6, act: () => ({ aim: T(-3.5, 1.4, -12), ads: true }) }),
        ] });
        W.c.biscuit.film.noCollide = true;
        ctx.match.teamScore = [15, 12];
      },
    },
    flank: {
      lights: () => [{ cam: true, i: 0.5, color: 0xffe0c4, up: 0.3 }], shadow: 14,
      pre: 1.2, K: 8, rounds: true,
      speed: () => 0.6,
      setup() {
        W.c = stage({ cast: [
          who('hero', { gun: 'auto_shotgun', at: [-9, -3], yaw: toYaw(1, 0), act: (t, b) => ({ move: t > -0.3 && t < 0.9 ? [1, 0] : [0.15, 0], sprint: t > -0.3 && t < 0.7, aim: W.c.cocoa.alive ? { bear: W.c.cocoa, part: 'spine' } : T(9, 1, -3), fire: t > 0.75 && t < 1.25, turn: 8 }) }),
          who('cocoa', { at: [7, -3.5], yaw: toYaw(-1, 0), mortalAt: 1.05, kb: 1.1, act: (t) => ({ move: t > 0 ? [-0.4, 0] : [0, 0], aim: { bear: W.c.hero }, fire: t > 0.2 }) }),
        ] });
      },
      cam: (t, u) => {
        // alongside the charge, low, the target ahead in the frame
        const h = W.c.hero, k = easeIO(u), q = W.c.cocoa.pos;
        const D = v3(q.x - h.pos.x, 0, q.z - h.pos.z).normalize(), Sd = v3(D.z, 0, -D.x);
        const pos = v3(h.pos.x, h.pos.y + 0.95, h.pos.z).addScaledVector(Sd, 1.9).addScaledVector(D, lerp(-1.5, -1.1, k));
        return { pos, look: chest(h).lerp(q.clone().add(v3(0, 0.9, 0)), 0.5), fov: 50, focusOn: chest(h), bokeh: 0.8, range: 3, hand: 0.006 };
      },
    },
    wide: {
      pre: 4, rays: 0.3, K: 6, rounds: false,
      setup() {
        const ai = (k, at) => who(k, { at, ai: true, spread: 1 });
        W.c = stage({ teams: true, cast: [
          who('hero', { at: [-30, 30] }),
          noPlayer(ai('maple', [-6, -6])), noPlayer(ai('pip', [-2, -12])), ai('grizz', [12, -2]), ai('biscuit', [10, -12]), ai('cocoa', [14, 4]),
        ] });
        W.c.hero.mesh.root.visible = false;
      },
      cam: (t, u) => {
        const a = lerp(-2.2, -1.95, easeIO(u));
        const c = T(3, 0, -5);
        return { pos: c.clone().add(v3(Math.sin(a) * 17, 7.5, Math.cos(a) * 17)), look: c.clone().add(v3(1, 0.5, 0)), fov: 40, hand: 0.002 };
      },
    },
    grizz: {
      lights: () => [{ cam: true, i: 0.6, color: 0xffe0c4, up: 0.2 }], shadow: 12, motes: () => ({ c: chest(W.c.grizz), r: 2, i: 0.8 }),
      pre: 1.2, K: 8, rounds: true, rays: 0.45,
      speed: () => 0.5,
      setup() {
        W.c = stage({ cast: [
          who('hero', { at: [-30, 30] }),
          who('grizz', { at: [13, 3], yaw: toYaw(-1, -0.6), act: (t, b) => ({ move: [-0.35, -0.2], aim: T(-4, 1.2, -9), fire: true }) }),
          noPlayer(who('maple', { at: [-4, -9], act: () => ({ aim: { bear: W.c.grizz } }) })),
        ] });
      },
      cam: (t, u) => {
        const g = W.c.grizz, k = easeIO(u);
        const f = fwd(g), r = right(g), c = chest(g);
        const pos = c.clone().addScaledVector(f, lerp(2.4, 2.0, k)).addScaledVector(r, -0.7).add(v3(0, -0.9, 0));
        return { pos, look: c.clone().add(v3(0, 0.15, 0)), fov: 40, focusOn: c, bokeh: 1.2, range: 1.6, hand: 0.006 };
      },
    },
    down: {
      hud: true, pre: 1.2,
      setup() {
        W.c = stage({ mode: '3v3', cast: [
          who('hero', { gun: 'auto_shotgun', at: [-13, -6], yaw: toYaw(1, 0.4), act: () => ({ aim: { bear: W.c.grizz, part: 'spine' }, crouch: true }) }),
          noPlayer(who('maple', { at: [-4, -3.5], mortalAt: 0.5, kb: 0.8, act: () => ({ aim: { bear: W.c.grizz }, fire: true }) })),
          noPlayer(who('pip', { at: [-6.5, -0.5], mortalAt: 1.15, kb: 0.8, act: () => ({ aim: { bear: W.c.grizz }, fire: true }) })),
          who('grizz', { at: [10, 2], act: (t) => ({ aim: t < 0.8 ? { bear: W.c.maple } : { bear: W.c.pip }, fire: true }) }),
        ] });
        ctx.match.teamScore = [24, 22];
      },
    },

    // ================================================================ the last point
    face: {
      pre: 1.5, K: 8, rays: 0.5,
      setup() {
        W.c = stage({ cast: [
          who('hero', { gun: 'auto_shotgun', at: [BR.x0 - 0.6, BR.z], yaw: toYaw(1, 0), act: (t, b) => ({ yaw: toYaw(1, 0), aim: lowReady(b, toYaw(1, 0)) }) }),
          who('grizz', { at: [BR.x1 + 1.0, BR.z], yaw: toYaw(-1, 0), act: (t, b) => ({ yaw: toYaw(-1, 0), aim: lowReady(b, toYaw(-1, 0)) }) }),
        ] });
      },
      cam: (t, u) => {
        const k = easeIO(u), y = deckY(28);
        return { pos: v3(28, y + lerp(0.2, 0.0, k), lerp(16, 14.5, k)), look: v3(28, y + 1.1, BR.z), fov: 31, hand: 0.002 };
      },
    },
    eyeH: {
      lights: () => [{ cam: true, i: 0.8, color: 0xffdcbc, up: 0.3, side: 0.4 }, { rim: true, i: 1.5, color: 0xffbf86, up: 0.4, side: -0.5 }], shadow: 5, motes: () => ({ c: head(W.c.hero), r: 1.0, i: 1.0 }),
      pre: 1.5, K: 6,
      setup() { SH.face.setup(); },
      cam: (t, u) => {
        const h = W.c.hero, hd = head(h), f = fwd(h), r = right(h);
        const pos = hd.clone().addScaledVector(f, lerp(1.2, 1.0, u)).addScaledVector(r, 0.18).add(v3(0, -0.02, 0));
        return { pos, look: hd.clone().add(v3(0, 0.02, 0)), fov: 30, focusOn: hd, bokeh: 2.2, range: 0.35 };
      },
    },
    eyeG: {
      lights: () => [{ cam: true, i: 0.8, color: 0xffdcbc, up: 0.3, side: -0.4 }, { rim: true, i: 1.5, color: 0xffbf86, up: 0.4, side: 0.5 }], shadow: 5, motes: () => ({ c: head(W.c.grizz), r: 1.0, i: 1.0 }),
      pre: 1.5, K: 6,
      setup() { SH.face.setup(); },
      cam: (t, u) => {
        const g = W.c.grizz, hd = head(g), f = fwd(g), r = right(g);
        const pos = hd.clone().addScaledVector(f, lerp(1.2, 1.0, u)).addScaledVector(r, -0.18).add(v3(0, -0.02, 0));
        return { pos, look: hd.clone().add(v3(0, 0.02, 0)), fov: 30, focusOn: hd, bokeh: 2.2, range: 0.35 };
      },
    },
    charge: {
      pre: 1.0, K: 8, rounds: true, rays: 0.4,
      speed: () => 0.75,
      lights: () => [{ cam: true, i: 0.6, color: 0xffe0c4, up: 0.3 }],
      setup() {
        W.c = stage({ cast: [
          who('hero', { gun: 'auto_shotgun', at: [BR.x0 - 1.2, BR.z], yaw: toYaw(1, 0), act: (t) => ({ move: t > -0.15 ? [1, 0] : [0, 0], sprint: t > -0.15, yaw: toYaw(1, 0), aim: T(40, 1.2, BR.z) }) }),
          // Grizz holds his ground at the shelf end of the bridge and opens up (the rounds go wide)
          who('grizz', { at: [BR.x1 - 1.0, BR.z], yaw: toYaw(-1, 0), act: (t) => ({ aim: { bear: W.c.hero, part: 'spine', off: v3(0, 0.55, 0.75) }, fire: t > 0.2, yaw: toYaw(-1, 0) }) }),
        ] });
      },
      cam: (t, u) => {
        const h = W.c.hero;
        const pos = v3(h.pos.x - 2.7, h.pos.y + 1.35, h.pos.z + 0.75);
        return { pos, look: chest(W.c.grizz).add(v3(0, -0.2, 0)), fov: 44, focusOn: chest(h), bokeh: 0.6, range: 5, hand: 0.007 };
      },
    },
    leap: {
      // the run-up, the leap 4.6 m out, bullet time at the top as the shotgun goes off, seen from the middle of the
      // bridge behind Grizz
      pre: 1.0, K: 12, rounds: true, rays: 0.4,
      speed: speedRamp([[0, 0.9], [0.32, 0.9], [0.62, 0.22], [0.95, 0.22], [1.12, 0.08], [1.45, 0.08], [1.655, 0.35]]),
      lights: () => [{ cam: true, i: 0.7, color: 0xffe0c4, up: 0.2 }, { rim: true, i: 1.2, color: 0xffc088, up: 0.6 }],
      setup() {
        W.c = stage({ cast: [
          who('hero', { gun: 'auto_shotgun', at: [LEAP.x0, BR.z], yaw: toYaw(1, 0), act: (t) => ({ move: t > -0.7 ? [1, 0] : [0, 0], sprint: t > -0.7, aim: W.c.grizz.alive ? { bear: W.c.grizz, part: 'spine' } : T(BR.x1, 0.8, BR.z), fire: t > LEAP.fire && t < LEAP.fire + 0.16, swing: 18, yaw: toYaw(1, 0) }) }),
          who('grizz', { at: [LEAP.g, BR.z - 0.12], yaw: toYaw(-1, 0), mortalAt: LEAP.fire + 0.02, kb: 1.35, act: () => ({ aim: { bear: W.c.hero, part: 'spine', off: v3(0, 0.7, 0.6) }, fire: true, yaw: toYaw(-1, 0) }) }),
        ] });
        W.jumped = false;
      },
      tick(t) {
        const h = W.c.hero;
        // the leap: a film-strength jump off the run (the game's jump only clears a log)
        if (!W.jumped && t >= LEAP.jump) { h.vel.y = 9.2; h.grounded = false; W.jumped = true; }
      },
      cam: (t, u) => {
        const h = W.c.hero, y = deckY(LEAP.g), k = easeIO(u);
        const pos = v3(LEAP.g + lerp(3.5, 3.1, k), y + lerp(0.42, 0.36, k), BR.z + 0.4);
        return { pos, look: chest(h).add(v3(0, -0.15, 0)), fov: lerp(38, 35, k), focusOn: chest(h), bokeh: 1.1, range: 2.6, hand: 0.004 };
      },
    },
    ko: {
      pre: 1.0, K: 10, rays: 0.5,
      speed: speedRamp([[0, 0.3], [1.0, 0.45]]),
      setup() {
        W.koLook = null;
        W.c = stage({ cast: [
          who('hero', { gun: 'auto_shotgun', at: [LEAP.g - 1.6, BR.z], yaw: toYaw(1, 0), act: (t) => ({ aim: W.c.grizz.alive ? { bear: W.c.grizz, part: 'spine' } : T(BR.x1, 1, BR.z), fire: pull(t, -0.2), yaw: toYaw(1, 0) }) }),
          who('grizz', { at: [LEAP.g + 0.4, BR.z], yaw: toYaw(-1, 0), mortalAt: -0.3, kb: 1.4, act: () => ({ aim: { bear: W.c.hero }, yaw: toYaw(-1, 0) }) }),
        ] });
        W.pushed = false;
      },
      tick() {
        const g = W.c.grizz;
        if (!g.alive && g.kb && !W.pushed) { g.kb.v.z -= 3.2; g.kb.v.y += 1.0; g.film.noCollide = true; W.pushed = true; }
      },
      cam: (t, u) => {
        const y = deckY(28), k = easeIO(u);
        const g = W.c.grizz.pos, pos = v3(lerp(24, 23.5, k), y + lerp(4.5, 5.2, k), -1.5);
        W.koLook = (W.koLook || g.clone()).lerp(g, 0.25);
        return { pos, look: W.koLook.clone().add(v3(0, 0.6, 0)), fov: 48, focusOn: g, bokeh: 0.6, range: 5, hand: 0.004 };
      },
    },
    win: {
      hud: true, pre: 1.0,
      setup() {
        const xm = (BR.x0 + BR.x1) / 2;
        W.c = stage({ mode: '3v3', cast: [
          who('hero', { gun: 'auto_shotgun', at: [xm - 1.2, BR.z], yaw: toYaw(1, 0), act: (t, b) => ({ aim: lowReady(b, toYaw(1, 0)), yaw: toYaw(1, 0) }) }),
        ] });
        ctx.match.teamScore = [25, 24];
        W.ended = false;
      },
      tick(t) { if (!W.ended && t >= -0.9) { W.ended = true; ctx.match.end(); } },
    },
    title: { title: true },
  };

  /** Grizz and Cocoa crouched behind the log barricade on Table Rock */
  function coverReds({ mortal = false } = {}) {
    const ax = COVER[0] + 1.0, az = COVER[1] + 0.4;
    const face = toYaw(-7 - ax, -9 - az);
    return [
      who('grizz', { at: [ax + 0.5, az + 1.1], yaw: face, minHp: 20, act: (t, b) => ({ crouch: true, yaw: face, aim: lowReady(b, face) }) }),
      who('cocoa', { at: [ax - 0.3, az - 0.4], yaw: face, mortalAt: mortal ? 0 : null, kb: 1.5, act: (t, b) => ({ crouch: true, yaw: face, aim: lowReady(b, face) }) }),
    ];
  }

  // the bars open once, on the build (contact), and stay open: everything after it is the full 16:9 frame
  for (const k of ['rack', 'squad', 'rivals']) SH[k].bars ??= 1;
  for (const k in SH) SH[k].bars ??= 0;
  // every shot starts with the props cleared
  for (const k in SH) {
    const s = SH[k];
    if (s.title) continue;
    const su = s.setup;
    s.setup = () => { clearProps(); su(); };
  }
  return SH;
}
