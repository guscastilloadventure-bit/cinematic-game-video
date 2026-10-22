// title.js: the end title, the game's name in heavy, angular, chamfered capitals (no curves anywhere),
// extruded steel faces with polished gold bevels, slammed in on the score's last hit, then a slow
// push-in, a light sweep across the metal, embers and smoke, and the game's link underneath.
import * as THREE from 'three';

const H = 10, S = 2.7; // cap height, stroke
const oct = (x0, y0, x1, y1, c) => [[x0 + c, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1 - c], [x1 - c, y1], [x0 + c, y1], [x0, y1 - c], [x0, y0 + c]];
/** Letter outlines: { w, shapes: [{ outer, holes }] } on a 10-unit cap height. */
const LETTERS = {
  Q: () => ({ w: 8.6, shapes: [
    { outer: oct(0, 0, 8.6, H, 2.0), holes: [oct(S, S, 8.6 - S, H - S, 0.9).reverse()] },
    { outer: [[4.9, 3.2], [6.9, 3.2], [10.2, -1.9], [8.2, -1.9]], holes: [] },
  ] }),
  U: () => ({ w: 8.4, shapes: [{ outer: [[0, H], [0, 1.9], [1.9, 0], [8.4 - 1.9, 0], [8.4, 1.9], [8.4, H], [8.4 - S, H], [8.4 - S, S + 0.7], [8.4 - S - 0.7, S], [S + 0.7, S], [S, S + 0.7], [S, H]].reverse(), holes: [] }] }),
  I: () => ({ w: 3.0, shapes: [{ outer: [[0, 0], [3.0, 0], [3.0, H], [0, H]], holes: [] }] }),
  C: () => ({ w: 8.2, shapes: [{ outer: [[8.2, H], [2.0, H], [0, H - 2.0], [0, 2.0], [2.0, 0], [8.2, 0], [8.2, S], [S + 0.9, S], [S, S + 0.9], [S, H - S - 0.9], [S + 0.9, H - S], [8.2, H - S]].reverse(), holes: [] }] }),
  K: () => ({ w: 8.8, shapes: [{ outer: [[0, 0], [S, 0], [S, 3.3], [5.6, 0], [8.8, 0], [S + 1.9, 5.0], [8.8, H], [5.6, H], [S, 6.7], [S, H], [0, H]], holes: [] }] }),
  O: () => ({ w: 8.6, shapes: [{ outer: oct(0, 0, 8.6, H, 2.0), holes: [oct(S, S, 8.6 - S, H - S, 0.9).reverse()] }] }),
  M: () => ({ w: 10.6, shapes: [{ outer: [[0, 0], [S, 0], [S, 5.6], [5.3, 2.3], [10.6 - S, 5.6], [10.6 - S, 0], [10.6, 0], [10.6, H], [10.6 - S, H], [5.3, 5.7], [S, H], [0, H]], holes: [] }] }),
  B: () => ({ w: 8.4, shapes: [{ outer: [[0, 0], [6.9, 0], [8.4, 1.5], [8.4, 4.0], [7.5, 5.0], [8.1, 5.9], [8.1, 8.6], [6.7, H], [0, H]], holes: [
    [[S, S], [5.6, S], [5.6, 3.9], [S, 3.9]].reverse(),
    [[S, 6.1], [5.3, 6.1], [5.3, H - S], [S, H - S]].reverse(),
  ] }] }),
  A: () => ({ w: 9.4, shapes: [{ outer: [[0, 0], [2.9, 0], [3.5, 2.2], [9.4 - 3.5, 2.2], [9.4 - 2.9, 0], [9.4, 0], [9.4 - 2.5, H], [2.5, H]], holes: [[[3.95, 4.5], [9.4 - 3.95, 4.5], [9.4 - 4.45, H - 2.5], [4.45, H - 2.5]].reverse()] }] }),
  P: () => ({ w: 8.4, shapes: [{ outer: [[0, 0], [S, 0], [S, 4.0], [6.6, 4.0], [8.4, 5.8], [8.4, 8.2], [6.6, H], [0, H]], holes: [
    [[S, 6.1], [5.2, 6.1], [5.8, 6.7], [5.8, 7.3], [5.2, H - S + 0.1], [S, H - S + 0.1]].reverse(),
  ] }] }),
  D: () => ({ w: 8.8, shapes: [{ outer: [[0, 0], [6.3, 0], [8.8, 2.5], [8.8, H - 2.5], [6.3, H], [0, H]], holes: [
    [[S, S], [5.3, S], [6.1, S + 0.8], [6.1, H - S - 0.8], [5.3, H - S], [S, H - S]].reverse(),
  ] }] }),
  R: () => ({ w: 8.9, shapes: [{ outer: [[0, 0], [S, 0], [S, 3.7], [4.3, 3.7], [6.0, 0], [8.9, 0], [6.9, 4.3], [8.4, 5.7], [8.4, 8.2], [6.6, H], [0, H]], holes: [
    [[S, 6.1], [5.2, 6.1], [5.8, 6.7], [5.8, 7.3], [5.2, H - S + 0.1], [S, H - S + 0.1]].reverse(),
  ] }] }),
  F: () => ({ w: 7.8, shapes: [{ outer: [[0, 0], [S, 0], [S, 3.9], [6.6, 3.9], [6.6, 6.4], [S, 6.4], [S, H - S], [7.8, H - S], [7.8, H], [0, H]], holes: [] }] }),
  S: () => { const w = 8.4, c = 1.9, ci = 0.7, m0 = 5 - S / 2, m1 = 5 + S / 2; return { w, shapes: [{ outer: [[0, 0], [w - c, 0], [w, c], [w, m1 - 0.9], [w - 0.9, m1], [S + ci, m1], [S, m1 + ci], [S, H - S], [w, H - S], [w, H], [c, H], [0, H - c], [0, m0 + 0.9], [0.9, m0], [w - S - ci, m0], [w - S, m0 - ci], [w - S, S], [0, S]], holes: [] }] }; },
  E: () => ({ w: 7.8, shapes: [{ outer: [[0, 0], [7.8, 0], [7.8, S], [S, S], [S, 3.75], [6.6, 3.75], [6.6, 6.25], [S, 6.25], [S, H - S], [7.8, H - S], [7.8, H], [0, H]], holes: [] }] }),
  T: () => ({ w: 8.6, shapes: [{ outer: [[0, H], [0, H - S], [4.3 - S / 2, H - S], [4.3 - S / 2, 0], [4.3 + S / 2, 0], [4.3 + S / 2, H - S], [8.6, H - S], [8.6, H]].reverse(), holes: [] }] }),
  G: () => ({ w: 8.4, shapes: [{ outer: [[8.4, H], [2.0, H], [0, H - 2.0], [0, 2.0], [2.0, 0], [8.4, 0], [8.4, 5.4], [4.4, 5.4], [4.4, 3.2], [8.4 - S, 3.2], [8.4 - S, S], [S + 0.9, S], [S, S + 0.9], [S, H - S - 0.9], [S + 0.9, H - S], [8.4, H - S]].reverse(), holes: [] }] }),
  H: () => ({ w: 8.4, shapes: [{ outer: [[0, 0], [S, 0], [S, 3.75], [8.4 - S, 3.75], [8.4 - S, 0], [8.4, 0], [8.4, H], [8.4 - S, H], [8.4 - S, 6.25], [S, 6.25], [S, H], [0, H]], holes: [] }] }),
  J: () => ({ w: 7.6, shapes: [{ outer: [[7.6, H], [7.6, 1.9], [5.7, 0], [1.9, 0], [0, 1.9], [0, 3.6], [S, 3.6], [S, S + 0.7], [S + 0.7, S], [7.6 - S - 0.7, S], [7.6 - S, S + 0.7], [7.6 - S, H]].reverse(), holes: [] }] }),
  L: () => ({ w: 7.4, shapes: [{ outer: [[0, 0], [7.4, 0], [7.4, S], [S, S], [S, H], [0, H]], holes: [] }] }),
  N: () => ({ w: 8.8, shapes: [{ outer: [[0, 0], [S, 0], [S, 5.0], [8.8 - S, 0], [8.8, 0], [8.8, H], [8.8 - S, H], [8.8 - S, 5.0], [S, H], [0, H]], holes: [] }] }),
  V: () => ({ w: 9.0, shapes: [{ outer: [[0, H], [S + 0.1, H], [4.5, 2.9], [9.0 - S - 0.1, H], [9.0, H], [5.9, 0], [3.1, 0]], holes: [] }] }),
  W: () => ({ w: 12.0, shapes: [{ outer: [[0, H], [S, H], [3.3, 3.2], [5.2, 7.5], [6.8, 7.5], [8.7, 3.2], [12 - S, H], [12, H], [9.7, 0], [7.6, 0], [6.0, 4.2], [4.4, 0], [2.3, 0]], holes: [] }] }),
  X: () => ({ w: 9.0, shapes: [{ outer: [[0, 0], [3.0, 0], [4.5, 3.1], [6.0, 0], [9.0, 0], [6.1, 5.0], [9.0, H], [6.0, H], [4.5, 6.9], [3.0, H], [0, H], [2.9, 5.0]], holes: [] }] }),
  Y: () => ({ w: 9.0, shapes: [{ outer: [[0, H], [3.1, H], [4.5, 7.0], [5.9, H], [9.0, H], [5.85, 4.6], [5.85, 0], [3.15, 0], [3.15, 4.6]], holes: [] }] }),
  Z: () => ({ w: 8.0, shapes: [{ outer: [[0, H], [8.0, H], [8.0, H - S], [3.3, S], [8.0, S], [8.0, 0], [0, 0], [0, S], [4.7, H - S], [0, H - S]], holes: [] }] }),
  '0': () => LETTERS.O(),
  '1': () => ({ w: 4.6, shapes: [{ outer: [[1.9, 0], [4.6, 0], [4.6, H], [2.2, H], [0, H - 2.2], [0, H - 3.6], [1.9, H - 3.6]], holes: [] }] }),
  '2': () => ({ w: 8.4, shapes: [{ outer: [[0, H], [6.5, H], [8.4, H - 1.9], [8.4, 5.9], [4.4, S], [8.4, S], [8.4, 0], [0, 0], [0, 2.4], [5.7, 6.6], [5.7, H - S], [0, H - S]], holes: [] }] }),
  '3': () => ({ w: 8.2, shapes: [{ outer: [[0, H], [6.3, H], [8.2, H - 1.9], [8.2, 6.0], [7.3, 5.0], [8.2, 4.0], [8.2, 1.9], [6.3, 0], [0, 0], [0, S], [5.5, S], [5.5, 3.75], [1.6, 3.75], [1.6, 6.25], [5.5, 6.25], [5.5, H - S], [0, H - S]], holes: [] }] }),
  '4': () => ({ w: 8.3, shapes: [{ outer: [[5.6, 0], [8.3, 0], [8.3, H], [5.9, H], [0, 3.8], [0, 1.6], [5.6, 1.6]], holes: [[[2.9, 4.3], [5.6, 4.3], [5.6, 7.0]]] }] }),
  '5': () => ({ w: 8.2, shapes: [{ outer: [[0, H], [8.0, H], [8.0, H - S], [S, H - S], [S, 6.3], [6.4, 6.3], [8.2, 4.5], [8.2, 1.9], [6.3, 0], [0, 0], [0, S], [5.5, S], [5.5, 3.6], [0, 3.6]], holes: [] }] }),
  '6': () => ({ w: 8.2, shapes: [{ outer: [[8.0, H], [1.9, H], [0, H - 1.9], [0, 1.9], [1.9, 0], [6.3, 0], [8.2, 1.9], [8.2, 4.5], [6.4, 6.3], [S, 6.3], [S, H - S], [8.0, H - S]], holes: [[[S, S], [5.5, S], [5.5, 3.6], [S, 3.6]]] }] }),
  '7': () => ({ w: 8.2, shapes: [{ outer: [[0, H], [8.2, H], [8.2, 7.6], [4.3, 0], [1.4, 0], [5.1, H - S], [0, H - S]], holes: [] }] }),
  '8': () => ({ w: 8.4, shapes: [{ outer: [[1.9, 0], [6.5, 0], [8.4, 1.9], [8.4, 4.0], [7.5, 5.0], [8.2, 5.9], [8.2, 8.6], [6.8, H], [1.6, H], [0.2, 8.6], [0.2, 5.9], [0.9, 5.0], [0, 4.0], [0, 1.9]], holes: [
    [[S, S], [5.7, S], [5.7, 3.9], [S, 3.9]], [[2.9, 6.1], [5.5, 6.1], [5.5, H - S], [2.9, H - S]],
  ] }] }),
  '9': () => ({ w: 8.2, shapes: [{ outer: [[0.2, 0], [6.3, 0], [8.2, 1.9], [8.2, 8.1], [6.3, H], [1.9, H], [0, 8.1], [0, 5.5], [1.8, 3.7], [5.5, 3.7], [5.5, S], [0.2, S]], holes: [[[S, 6.4], [5.5, 6.4], [5.5, H - S], [S, H - S]]] }] }),
  ' ': () => ({ w: 3.4, shapes: [] }),
  '-': () => ({ w: 5.0, shapes: [{ outer: [[0, 3.9], [5.0, 3.9], [5.0, 6.1], [0, 6.1]], holes: [] }] }),
};

/** Soft fractal noise texture for smoke. */
function smokeTexture() {
  const N = 256, cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  const img = g.createImageData(N, N);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const grid = (n) => Array.from({ length: n * n }, rnd);
  const octs = [4, 8, 16, 32].map((n) => ({ n, v: grid(n) }));
  const at = (o, x, y) => {
    const fx = (x / N) * o.n, fy = (y / N) * o.n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const v = (i, j) => o.v[((j % o.n + o.n) % o.n) * o.n + ((i % o.n + o.n) % o.n)];
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return (v(x0, y0) * (1 - sx) + v(x0 + 1, y0) * sx) * (1 - sy) + (v(x0, y0 + 1) * (1 - sx) + v(x0 + 1, y0 + 1) * sx) * sy;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0, a = 0.55;
    for (const o of octs) { v += at(o, x, y) * a; a *= 0.5; }
    const r = Math.hypot(x - N / 2, y - N / 2) / (N / 2);
    const fall = Math.max(0, 1 - r) ** 1.6;
    const k = (y * N + x) * 4;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
    img.data[k + 3] = Math.max(0, Math.min(255, (v - 0.35) * 2.2 * fall * 255));
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The link, rendered with the system's Avenir Next (clean, not tracked). */
function linkTexture(text) {
  const cv = document.createElement('canvas');
  cv.width = 4800; cv.height = 400;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  g.font = '600 208px "Avenir Next", "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 24;
  g.fillStyle = '#f6eedf';
  g.fillText(text, cv.width / 2, cv.height / 2 + 4);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return t;
}

const EMBER_VS = /* glsl */`
attribute vec4 seed; uniform float uT; uniform float uScale; varying float vA; varying vec3 vC;
void main() {
  float life = 3.2 + seed.w * 2.4;
  float age = mod(uT * (0.55 + seed.z * 0.6) + seed.x * life, life);
  float u = age / life;
  vec3 p = vec3((seed.x - 0.5) * 120.0, -26.0 + age * (9.0 + seed.y * 9.0), (seed.y - 0.5) * 44.0 - 8.0);
  p.x += sin(uT * (0.7 + seed.z) + seed.w * 20.0) * (2.0 + seed.y * 3.0) + age * (seed.z - 0.5) * 3.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float flick = 0.65 + 0.35 * sin(uT * (9.0 + seed.x * 14.0) + seed.y * 30.0);
  vA = smoothstep(0.0, 0.12, u) * (1.0 - smoothstep(0.65, 1.0, u)) * flick;
  vC = mix(vec3(4.0, 1.25, 0.25), vec3(5.0, 2.6, 0.8), seed.z);
  gl_PointSize = uScale * (0.18 + seed.w * 0.32) / -mv.z;
}`;
const EMBER_FS = /* glsl */`
varying float vA; varying vec3 vC;
void main() { vec2 d = gl_PointCoord - 0.5; float r = dot(d, d); if (r > 0.25) discard; gl_FragColor = vec4(vC * vA * exp(-r * 14.0), 1.0); }`;
const SPARK_VS = /* glsl */`
attribute vec4 seed; uniform float uT; uniform float uScale; varying float vA;
void main() {
  float a = seed.x * 6.2831853, sp = 38.0 + seed.y * 70.0;
  float t = max(uT, 0.0);
  vec3 dir = normalize(vec3(cos(a) * 1.25, sin(a) * 0.62 + 0.18, (seed.z - 0.5) * 0.6));
  vec3 p = vec3((seed.w - 0.5) * 70.0, 0.0, 2.0) + dir * sp * t * exp(-t * 1.6) + vec3(0.0, -24.0 * t * t, 0.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vA = (1.0 - smoothstep(0.15, 0.85 + seed.z * 0.4, t)) * step(0.0, uT);
  gl_PointSize = uScale * (0.22 + seed.w * 0.3) / -mv.z;
}`;
const SPARK_FS = /* glsl */`
varying float vA;
void main() { vec2 d = gl_PointCoord - 0.5; float r = dot(d, d); if (r > 0.25) discard; gl_FragColor = vec4(vec3(6.0, 3.6, 1.4) * vA * exp(-r * 10.0), 1.0); }`;

export class Title {
  constructor(renderer, link, opts = {}) {
    this.renderer = renderer;
    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0x020102);
    scene.fog = new THREE.FogExp2(0x0a0504, 0.0045);
    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 1000);

    // environment for the metal: a dark room with a warm key above, a hot rim below, a cool fill
    const env = new THREE.Scene();
    const panel = (w, h, color, x, y, z, ry = 0, rx = 0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.rotation.set(rx, ry, 0); env.add(m);
    };
    env.background = new THREE.Color(0x040302);
    panel(30, 6, new THREE.Color(5.5, 4.2, 2.8), -6, 14, 10, 0, Math.PI / 2.4);
    panel(40, 3, new THREE.Color(4.5, 1.6, 0.4), 0, -12, 6, 0, -Math.PI / 2.3);
    panel(6, 20, new THREE.Color(0.5, 0.9, 1.4), 22, 2, 0, -Math.PI / 2);
    panel(6, 20, new THREE.Color(1.6, 0.9, 0.5), -22, 2, 0, Math.PI / 2);
    // behind the viewer: a tall gradient the flat letter faces mirror (bright top, dark bottom: chrome)
    const grad = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.ShaderMaterial({ side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec2 vUv; void main(){ float y = vUv.y; vec3 c = mix(vec3(0.05, 0.03, 0.02), vec3(2.6, 2.3, 2.0), smoothstep(0.38, 0.78, y)) + vec3(1.4, 0.55, 0.15) * exp(-pow((y - 0.3) * 9.0, 2.0)); gl_FragColor = vec4(c, 1.0); }' }));
    grad.position.set(0, 2, 26); grad.rotation.y = Math.PI; env.add(grad);
    const pm = new THREE.PMREMGenerator(renderer);
    this.envTex = pm.fromScene(env, 0.0, 0.1, 100, { size: 1024 }).texture;
    pm.dispose();
    scene.environment = this.envTex;

    // the logo
    const steel = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.95, roughness: 0.16, envMapIntensity: 1.35, clearcoat: 1, clearcoatRoughness: 0.04 });
    // chrome: bright silver above a sharp horizon, dark steel below, with fine brushed streaks
    steel.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;').replace('#include <map_fragment>', `#include <map_fragment>
        float hy = vObj.y + 0.35 * sin(vObj.x * 0.07);
        float top = smoothstep(-0.06, 0.06, hy);
        vec3 hi = mix(vec3(0.62, 0.62, 0.66), vec3(1.0, 0.97, 0.92), smoothstep(0.3, 4.8, hy));
        vec3 lo = mix(vec3(0.07, 0.065, 0.075), vec3(0.26, 0.22, 0.2), smoothstep(-5.0, -0.4, hy));
        float brush = 0.94 + 0.06 * fract(sin(floor(vObj.y * 24.0) * 91.7 + floor(vObj.x * 1.4) * 13.1) * 43758.5);
        diffuseColor.rgb = mix(lo, hi, top) * brush;`);
    };
    const gold = new THREE.MeshPhysicalMaterial({ color: 0xf0b24a, metalness: 1.0, roughness: 0.1, envMapIntensity: 2.6, clearcoat: 1, clearcoatRoughness: 0.03 });
    this.logo = new THREE.Group();
    // the game's name in caps (A-Z, 0-9, space, hyphen); opts.word, e.g. 'ZERO TO GONE'
    const word = String(opts.word || 'GAME').toUpperCase(), gap = 0.9;
    let x = 0;
    const parts = [];
    for (const ch of word) {
      const L = (LETTERS[ch] || LETTERS[' '])();
      for (const sh of L.shapes) {
        const shape = new THREE.Shape(sh.outer.map(([a, b]) => new THREE.Vector2(a + x, b)));
        for (const hole of sh.holes) shape.holes.push(new THREE.Path(hole.map(([a, b]) => new THREE.Vector2(a + x, b))));
        parts.push(shape);
      }
      x += L.w + gap;
    }
    const width = x - gap;
    const geo = new THREE.ExtrudeGeometry(parts, { depth: 1.7, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.46, bevelSegments: 1, curveSegments: 1 });
    geo.translate(-width / 2, -H / 2, -0.85);
    const mesh = new THREE.Mesh(geo, [steel, gold]);
    this.logo.add(mesh);
    // a blade under the word
    const blade = new THREE.Shape([[-width / 2 + 6, -H / 2 - 2.6], [width / 2 - 6, -H / 2 - 2.6], [width / 2 - 1, -H / 2 - 3.3], [width / 2 - 6, -H / 2 - 4.0], [-width / 2 + 6, -H / 2 - 4.0], [-width / 2 + 1, -H / 2 - 3.3]].map(([a, b]) => new THREE.Vector2(a, b)));
    const bladeGeo = new THREE.ExtrudeGeometry(blade, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.18, bevelSegments: 1 });
    bladeGeo.translate(0, 0, -0.3);
    this.blade = new THREE.Mesh(bladeGeo, [steel, gold]);
    this.logo.add(this.blade);
    this.width = width;
    // long names shrink to fit the frame (STUFFED, 7 letters, is about 64 units wide)
    this.fit = Math.min(1, 66 / width);
    scene.add(this.logo);

    // light: a key, a warm rim and a sweep that crosses the letters
    const key = new THREE.DirectionalLight(0xfff0dc, 2.2); key.position.set(-30, 40, 60); scene.add(key);
    const rim = new THREE.DirectionalLight(0xff7a2a, 2.4); rim.position.set(20, -10, -40); scene.add(rim);
    this.sweep = new THREE.PointLight(0xffe2b0, 0, 90, 1.6); this.sweep.position.set(-60, 8, 16); scene.add(this.sweep);
    scene.add(new THREE.AmbientLight(0x2a1810, 0.6));

    // the link
    this.linkMat = new THREE.MeshBasicMaterial({ map: linkTexture(link), transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    this.linkMesh = new THREE.Mesh(new THREE.PlaneGeometry(60, 5), this.linkMat);
    this.linkMesh.position.set(0, -H / 2 - 8.6, 0);
    scene.add(this.linkMesh);

    // a dark backdrop with a low ember glow
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(600, 340), new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 } }, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec2 vUv; uniform float uT; void main(){ vec2 d = vUv - vec2(0.5, 0.36); float g = exp(-dot(d * vec2(1.2, 2.2), d * vec2(1.2, 2.2)) * 9.0); vec3 c = vec3(0.075, 0.016, 0.005) * g * (0.92 + 0.08 * sin(uT * 1.7)) + vec3(0.004, 0.003, 0.004); gl_FragColor = vec4(c, 1.0); }',
    }));
    bg.position.set(0, 0, -140);
    this.bg = bg; scene.add(bg);

    // smoke
    const smoke = smokeTexture();
    this.smoke = [];
    let sd = 3;
    const r = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: smoke, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color().setRGB(0.16 + r() * 0.1, 0.07 + r() * 0.03, 0.05 + r() * 0.04), opacity: 0.14 }));
      const s = 30 + r() * 50;
      m.scale.set(s, s, 1);
      m.userData = { x: (r() - 0.5) * 160, y: -24 + r() * 26, z: -20 - r() * 70, v: 1 + r() * 2.5, spin: (r() - 0.5) * 0.18, a: r() * 6 };
      this.smoke.push(m); scene.add(m);
    }
    // embers + the slam's sparks
    const pts = (n, vs, fs) => {
      const g = new THREE.BufferGeometry();
      const seed = new Float32Array(n * 4);
      for (let i = 0; i < n * 4; i++) seed[i] = r();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
      const m = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uScale: { value: 1 } }, vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p); return m;
    };
    this.embers = pts(900, EMBER_VS, EMBER_FS);
    // opts.fluff: a 2x2 sprite atlas of the game's own debris (stuffing, sparks, leaves) that bursts out from behind
    // the letters on the slam, a few more drifting down
    this.fluff = [];
    if (opts.fluff) {
      const cells = [0, 1, 2, 3].map((c) => { const t = opts.fluff.clone(); t.needsUpdate = true; t.repeat.set(0.5, 0.5); t.offset.set((c % 2) * 0.5, (c >> 1) * 0.5); return t; });
      for (let i = 0; i < 26; i++) {
        const burst = i < 20;
        const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cells[i % 4], color: new THREE.Color(2.1, 1.75, 1.4), transparent: true, depthWrite: false }));
        const a = r() * Math.PI * 2, sp = 18 + r() * 34;
        m.userData = burst
          ? { burst, x: (r() - 0.5) * 60, y: (r() - 0.5) * 6, z: -2 - r() * 3, vx: Math.cos(a) * sp * 1.3, vy: Math.sin(a) * sp * 0.7 + 8, vz: -(6 + r() * 26), s: 0.9 + r() * 1.4, rot: r() * 6, spin: (r() - 0.5) * 3 }
          : { burst, x: (r() - 0.5) * 170, y: 14 + r() * 50, z: -40 - r() * 50, vx: (r() - 0.5) * 2, vy: -2.5 - r() * 2.5, vz: 0, s: 1.8 + r() * 2.4, rot: r() * 6, spin: (r() - 0.5) * 0.8 };
        this.fluff.push(m); scene.add(m);
      }
    }
    this.sparks = pts(420, SPARK_VS, SPARK_FS);
  }

  /** Pose everything for time t (s) after the score's last hit; returns grade tweaks. */
  update(t, size) {
    const easeOutBack = (u) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
    const clamp = (v) => Math.max(0, Math.min(1, v));
    // slam: big and close on the hit, settles with a little overshoot
    const u = clamp(t / 0.34);
    const sc = 1.16 - 0.16 * easeOutBack(u);
    this.logo.scale.setScalar(sc * this.fit);
    this.logo.position.set(0, 1.6, (1 - easeOutBack(u)) * 6);
    // camera: shake on the hit, then a slow push-in
    const shake = Math.exp(-t * 9) * 0.9;
    const n = (k) => Math.sin(t * 61 + k) * 0.6 + Math.sin(t * 37 + k * 2.1) * 0.4;
    const dist = 104 - 9 * (1 - Math.exp(-t * 0.9));
    this.camera.position.set(n(1) * shake, 2.2 + n(2) * shake, dist);
    this.camera.lookAt(n(3) * shake * 0.4, -1.4, 0);
    this.camera.aspect = size.x / size.y; this.camera.updateProjectionMatrix();
    // light sweep across the letters, left to right
    const sw = clamp((t - 0.35) / 1.25);
    this.sweep.position.set(-70 + 140 * sw, 7, 18);
    this.sweep.intensity = 150 * Math.sin(Math.PI * sw) ** 1.5;
    this.scene.environmentRotation = new THREE.Euler(0, -0.5 + sw * 0.9, 0);
    // the link fades in under the word
    const lk = clamp((t - 0.85) / 0.45);
    this.linkMat.opacity = lk * lk * (3 - 2 * lk);
    this.linkMesh.position.y = -H / 2 - 8.6 - (1 - lk) * 1.2;
    // smoke, embers, sparks
    for (const m of this.smoke) {
      const d = m.userData;
      m.position.set(d.x + Math.sin(t * 0.2 + d.a) * 4 + t * d.v, d.y + t * d.v * 0.6, d.z);
      m.rotation.z = d.a + t * d.spin;
      m.quaternion.copy(this.camera.quaternion); m.rotateZ(d.a + t * d.spin);
    }
    for (const m of this.fluff) {
      const d = m.userData;
      if (d.burst) { // thrown out on the hit, slowed by the air, then falling
        const k = 1 - Math.exp(-t * 2.4);
        m.position.set(d.x + d.vx * k / 2.4, d.y + d.vy * k / 2.4 - 3.5 * t * t * 0.5, d.z + d.vz * k / 2.4);
        m.material.opacity = t < 0 ? 0 : Math.min(1, t / 0.05) * Math.max(0, 1 - Math.max(0, (t - 0.9) / 0.8));
      } else {
        m.position.set(d.x + Math.sin(t * 0.7 + d.rot) * 2, d.y + d.vy * t, d.z);
        m.material.opacity = 0.55;
      }
      m.scale.setScalar(d.s); m.material.rotation = d.rot + d.spin * t;
    }
    const scale = size.y * 1.2;
    this.embers.uniforms.uT.value = t + 6.0; this.embers.uniforms.uScale.value = scale;
    this.sparks.uniforms.uT.value = t; this.sparks.uniforms.uScale.value = scale;
    this.bg.material.uniforms.uT.value = t;
    // the hit flashes the frame; the very end fades to black with the ring-out
    const flash = Math.exp(-t * 11) * 1.6;
    const fade = clamp((t - 3.15) / 0.6);
    return { exposure: 1.0 + flash, fade, bloom: 0.55 + Math.exp(-t * 6) * 0.6, bloomThreshold: 1.25, bloomRadius: 0.5, vig: 0.55, ca: 0.002, warm: 0.3, bars: 0, sat: 1.05, contrast: 1.08 };
  }
}
