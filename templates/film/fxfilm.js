// EXAMPLE (shooter): film-grade muzzle flashes, brass rounds riding live bullets, tracers scaled to slow motion, a shot
// log for the sound mix. Keep the idea (the game's own effects are made for 1/20 s glimpses; film needs bigger, longer
// ones that read in slow motion) and rewrite the details for the game at hand.
// fxfilm.js: effects the film adds on top of the game's own.
// - a cinematic muzzle flash (soft glow, a star of light, a flame tongue along the barrel) in place of
//   the game's flash cards, which are made for 1/20 s and read as flat quads in slow motion
// - brass rounds drawn at every live bullet, and tracers scaled to the shot's speed, so slow motion
//   shows the bullets themselves instead of 10 m light streaks
// - a log of every shot (film time, gun, position) for the sound mix
import * as THREE from 'three';

function canvasTex(draw, w = 128, h = 128) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function installFilmFX(W) {
  const { ctx, S, v3 } = W;
  const scene = ctx.scene;

  // ---- textures
  const glowTex = canvasTex((g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(255,226,170,0.9)'); gr.addColorStop(0.42, 'rgba(255,140,50,0.3)'); gr.addColorStop(1, 'rgba(255,90,20,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
  const starTex = canvasTex((g, w) => { // thin rays of light from the centre
    g.translate(w / 2, w / 2);
    for (let i = 0; i < 6; i++) {
      g.save(); g.rotate((i / 6) * Math.PI * 2 + (i % 2) * 0.2);
      const L = w * (i % 2 ? 0.32 : 0.48);
      const gr = g.createLinearGradient(0, 0, L, 0); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(1, 'rgba(255,150,60,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, -w * 0.035); g.lineTo(L, 0); g.lineTo(0, w * 0.035); g.closePath(); g.fill(); g.restore();
    }
  });
  const flameTex = canvasTex((g, w, h) => { // a flame tongue: u across, v along the barrel (base at v=0)
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = y / h, u = (x / w) * 2 - 1;
      const width = 0.18 + 0.75 * Math.sin(Math.min(1, v * 1.25) * Math.PI) * (1 - v * 0.55);
      let a = Math.max(0, 1 - Math.abs(u) / width); a = a * a * (1 - Math.pow(v, 2.2));
      const k = (y * w + x) * 4;
      img.data[k] = 255; img.data[k + 1] = 170 + 80 * (1 - v); img.data[k + 2] = 70 + 120 * (1 - v) * a; img.data[k + 3] = 255 * a;
    }
    g.putImageData(img, 0, 0);
  }, 64, 128);

  // ---- muzzle flash pool
  const add = (map, color) => new THREE.SpriteMaterial({ map, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false });
  const flameMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: flameTex }, uA: { value: 0 }, uLen: { value: 0.4 }, uWid: { value: 0.12 }, uDir: { value: new THREE.Vector3(0, 0, 1) } },
    vertexShader: /* glsl */ `uniform float uLen, uWid; uniform vec3 uDir; varying vec2 vUv;
      void main() { vUv = uv; vec3 o = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 side = normalize(cross(uDir, normalize(cameraPosition - o)));
        vec3 p = o + uDir * (uv.y * uLen) + side * ((uv.x - 0.5) * uWid);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: /* glsl */ `uniform sampler2D map; uniform float uA; varying vec2 vUv;
      void main() { vec4 t = texture2D(map, vUv); gl_FragColor = vec4(t.rgb * t.a * uA * vec3(3.0, 2.0, 1.2), 1.0); }`,
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false,
  });
  const pool = [];
  for (let i = 0; i < 16; i++) {
    const glow = new THREE.Sprite(add(glowTex, new THREE.Color(3.4, 2.4, 1.5)));
    const star = new THREE.Sprite(add(starTex, new THREE.Color(3.0, 2.2, 1.4)));
    const flame = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), flameMat.clone());
    for (const o of [glow, star, flame]) { o.visible = false; o.renderOrder = 9; o.frustumCulled = false; scene.add(o); }
    pool.push({ glow, star, flame, live: false });
  }
  const flashes = [];
  const shots = []; // the sound log
  const _mf = ctx.fx.muzzleFlash.bind(ctx.fx);
  ctx.fx.muzzleFlash = (bear, muzzle, dir, def) => {
    const nf = ctx.fx.flash.p.length, ns = ctx.fx.flashSide.p.length;
    _mf(bear, muzzle, dir, def);
    ctx.fx.flash.p.length = nf; ctx.fx.flashSide.p.length = ns; // keep the game's smoke and light, drop its cards
    const big = def.dmg > 40 || def.pellets;
    // drop flashes that burned out while nothing was drawn (a shot's silent catch-up), or the pool runs dry
    for (let i = flashes.length - 1; i >= 0; i--) if (ctx.time - flashes[i].t0 > flashes[i].life) { const s = flashes[i].slot; s.live = false; s.glow.visible = s.star.visible = s.flame.visible = false; flashes.splice(i, 1); }
    // a slot no live flash is drawing with (two flashes on one slot: the later one hides the other)
    const used = new Set(flashes.map((f) => f.slot));
    let slot = pool.find((p) => !used.has(p)) || pool[0];
    flashes.push({ slot, pos: muzzle.clone(), dir: dir.clone(), t0: ctx.time, big, rot: Math.random() * 6.28, life: big ? 0.045 : 0.03 });
    slot.live = true;
    shots.push({ shot: S.shot ? S.shot.idx : -1, ft: S.ft ?? 0, gt: S.t, wid: bear.weapon.id, pos: muzzle.clone(), who: bear.name });
    // the camera kicks when a gun goes off near it
    const dc = W.camera.position.distanceTo(muzzle);
    S.kick = Math.max(S.kick || 0, (big ? 1 : 0.45) / (1 + dc / 2.5));
  };

  // ---- brass rounds for every live bullet
  const brass = new THREE.MeshStandardMaterial({ color: 0xd9a35a, metalness: 1, roughness: 0.25 });
  const body = new THREE.CylinderGeometry(0.0045, 0.0045, 0.02, 16); body.rotateX(Math.PI / 2);
  const tip = new THREE.ConeGeometry(0.0045, 0.017, 16); tip.rotateX(Math.PI / 2); tip.translate(0, 0, 0.0185);
  const merge = (a, b) => { const g = new THREE.BufferGeometry(); const pa = a.toNonIndexed(), pb = b.toNonIndexed();
    for (const k of ['position', 'normal']) { const A = pa.attributes[k].array, B = pb.attributes[k].array, C = new Float32Array(A.length + B.length); C.set(A); C.set(B, A.length); g.setAttribute(k, new THREE.BufferAttribute(C, 3)); } return g; };
  const rounds = new THREE.InstancedMesh(merge(body, tip), brass, 64);
  rounds.count = 0; rounds.frustumCulled = false; scene.add(rounds);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _z = new THREE.Vector3(0, 0, 1), _d = new THREE.Vector3();

  // tracers shorter in slow motion (a 10 m streak is 1/80 s of travel at full speed)
  const P = ctx.projectiles, _tr = P._tracer.bind(P);
  P._tracer = function (n, p, a) {
    const k = W.tracerScale ?? 1;
    if (k <= 0) return n;
    if (k >= 1) return _tr(n, p, a);
    const def = p.def; p.def = { ...def, velocity: def.velocity * k }; const r = _tr(n, p, a); p.def = def; return r; // the streak is velocity x 12 ms long
  };

  return {
    shots, flashes,
    /** a sound cue at the current film time (not a gunshot) */
    cue(snd, pos) { shots.push({ shot: S.shot ? S.shot.idx : -1, ft: S.ft ?? 0, gt: S.t, snd, pos: pos ? pos.clone() : W.camera.position.clone(), who: '' }); },
    reset() { flashes.length = 0; for (const p of pool) { p.live = false; p.glow.visible = p.star.visible = p.flame.visible = false; } rounds.count = 0; },
    /** pose every effect for the current game time (call before each render) */
    update(scale = 1, showRounds = false) {
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i], a = ctx.time - f.t0, s = f.slot;
        if (a > f.life || a < 0) { s.live = false; s.glow.visible = s.star.visible = s.flame.visible = false; flashes.splice(i, 1); continue; }
        const u = a / f.life, k = Math.min(1, a / (f.life * 0.15)), fade = Math.pow(1 - u, 1.6), sz = (f.big ? 1 : 0.7) * scale;
        s.glow.visible = s.star.visible = s.flame.visible = true;
        s.glow.position.copy(f.pos).addScaledVector(f.dir, 0.06); s.glow.scale.setScalar(sz * (0.22 + 0.4 * k)); s.glow.material.opacity = fade;
        s.star.position.copy(s.glow.position); s.star.scale.setScalar(sz * (0.35 + 0.5 * k)); s.star.material.rotation = f.rot; s.star.material.opacity = fade * 0.9;
        s.flame.position.copy(f.pos); const u2 = s.flame.material.uniforms; u2.uDir.value.copy(f.dir); u2.uLen.value = sz * (0.25 + 0.4 * k) * (1 + u); u2.uWid.value = sz * (0.12 + 0.1 * k); u2.uA.value = fade;
        ctx.fx.light.intensity = Math.max(ctx.fx.light.intensity, (f.big ? 10 : 6) * fade);
      }
      if (showRounds) {
        let n = 0;
        for (const p of P.live) { if (n >= 64) break; _d.copy(p.vel).normalize(); _q.setFromUnitVectors(_z, _d); _m.compose(p.pos, _q, _s); rounds.setMatrixAt(n++, _m); }
        rounds.count = n; rounds.instanceMatrix.needsUpdate = true;
      } else rounds.count = 0;
    },
  };
}
