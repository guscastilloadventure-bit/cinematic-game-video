// post.js: the film's look on top of the game's render. Ambient occlusion, depth of field, bloom,
// filmic tone mapping, a warm grade and a vignette, then every sub-frame is averaged in AccumPass
// (motion blur + sub-pixel jitter = clean edges). The game itself renders straight to the screen.
import * as THREE from 'three';
import { Pass, EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect, Effect, BlendFunction, DepthOfFieldEffect, ChromaticAberrationEffect, GodRaysEffect, KernelSize } from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

/** Averages the full image of every sub-frame (after tone mapping); presents on the last one. */
export class AccumPass extends Pass {
  constructor() {
    super('AccumPass');
    this.needsSwap = false;
    this.acc = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
    this.weight = 1; this.first = true; this.present = true;
    const vs = 'varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }';
    this.add = new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, w: { value: 1 } }, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
      vertexShader: vs,
      fragmentShader: 'uniform sampler2D tex; uniform float w; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(tex, vUv).rgb * w, 1.0); }',
    });
    this.show = new THREE.ShaderMaterial({
      uniforms: { tex: { value: this.acc.texture } }, depthTest: false, depthWrite: false, vertexShader: vs,
      fragmentShader: /* glsl */ `uniform sampler2D tex; varying vec2 vUv;
        vec3 srgb(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
        float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() { vec3 c = srgb(texture2D(tex, vUv).rgb); c += (h(gl_FragCoord.xy) - 0.5) / 255.0; gl_FragColor = vec4(c, 1.0); }`,
    });
    this.fullscreenMaterial = this.add;
  }
  render(renderer, inputBuffer) {
    const ac = renderer.autoClear; renderer.autoClear = false;
    this.add.uniforms.tex.value = inputBuffer.texture; this.add.uniforms.w.value = this.weight;
    this.add.blending = this.first ? THREE.NoBlending : THREE.CustomBlending;
    this.fullscreenMaterial = this.add;
    renderer.setRenderTarget(this.acc); renderer.render(this.scene, this.camera);
    if (this.present) { this.fullscreenMaterial = this.show; renderer.setRenderTarget(null); renderer.render(this.scene, this.camera); }
    renderer.autoClear = ac;
  }
  setSize(w, h) { this.acc.setSize(w, h); }
}

/** Plain gain before tone mapping (flashes, fades). */
export class GainEffect extends Effect {
  constructor() {
    super('GainEffect', 'uniform float uGain; void mainImage(const in vec4 c, const in vec2 uv, out vec4 o) { o = vec4(c.rgb * uGain, c.a); }', { blendFunction: BlendFunction.SET, uniforms: new Map([['uGain', new THREE.Uniform(1)]]) });
  }
}

/** Grade on the tone-mapped image (display gamma): S-curve, saturation, warm highlights, cool shadows, fade. */
export class GradeEffect extends Effect {
  constructor({ contrast = 0.3, saturation = 1.08, warm = 0.5, cool = 1, lift = 0.01 } = {}) {
    super('GradeEffect', /* glsl */ `
      uniform float uContrast, uSaturation, uWarm, uCool, uLift, uFade;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = pow(clamp(inputColor.rgb, 0.0, 1.0), vec3(1.0 / 2.2));
        c = mix(c, c * c * (3.0 - 2.0 * c), uContrast);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, uSaturation);
        // cool (teal) shadows against warm highlights: the canyon is orange already, keep the frame from going one colour
        c += uCool * vec3(-0.028, 0.006, 0.036) * (1.0 - l) * (1.0 - l) + uWarm * vec3(0.024, 0.008, -0.02) * l;
        c = c * (1.0 - uLift) + uLift;
        c *= 1.0 - uFade;
        outputColor = vec4(pow(clamp(c, 0.0, 1.0), vec3(2.2)), inputColor.a);
      }`, { blendFunction: BlendFunction.SET, uniforms: new Map([['uContrast', new THREE.Uniform(contrast)], ['uSaturation', new THREE.Uniform(saturation)], ['uWarm', new THREE.Uniform(warm)], ['uCool', new THREE.Uniform(cool)], ['uLift', new THREE.Uniform(lift)], ['uFade', new THREE.Uniform(0)]]) });
  }
}

export function buildPost(renderer, scene, camera, Q) {
  const num = (k, d) => (Q.has(k) ? +Q.get(k) : d);
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
  let ao = null;
  if (num('ao', 1) > 0) {
    ao = new N8AOPostPass(scene, camera, innerWidth, innerHeight);
    Object.assign(ao.configuration, { aoRadius: 1.2, distanceFalloff: 0.8, intensity: num('aoi', 2.4), aoSamples: 12, denoiseSamples: 6, denoiseRadius: 8, halfRes: true, gammaCorrection: false, color: new THREE.Color(0x0b0705) });
    composer.addPass(ao);
  }
  const dof = new DepthOfFieldEffect(camera, { focusDistance: 6, focusRange: 4, bokehScale: 1.5, resolutionScale: 0.75 });
  composer.addPass(new EffectPass(camera, dof));
  const gain = new GainEffect();
  const bloom = new BloomEffect({ mipmapBlur: true, intensity: num('bloom', 0.38), luminanceThreshold: num('bt', 1.05), luminanceSmoothing: 0.35, radius: 0.72 });
  const fringe = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0005, 0.0005), radialModulation: true, modulationOffset: 0.35 });
  const tone = new ToneMappingEffect({ mode: Q.get('tone') === 'aces' ? ToneMappingMode.ACES_FILMIC : ToneMappingMode.AGX });
  const grade = new GradeEffect({ contrast: num('con', 0.5), saturation: num('sat', 1.14), warm: num('warm', 0.6), cool: num('cool', 1.3) });
  const vig = new VignetteEffect({ offset: 0.3, darkness: 0.5 });
  // light shafts from the low sun through the pines (the sun disc only exists for this pass)
  const sun = new THREE.Mesh(new THREE.SphereGeometry(16, 24, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.72, 0.42), transparent: true, depthWrite: false, fog: false }));
  sun.frustumCulled = false;
  const rays = new GodRaysEffect(camera, sun, { samples: 80, density: 0.95, decay: 0.93, weight: num('rayw', 0.32), exposure: 0.55, clampMax: 0.9, resolutionScale: 0.5, kernelSize: KernelSize.SMALL, blur: true, blendFunction: BlendFunction.SCREEN });
  composer.addPass(new EffectPass(camera, rays, gain, fringe, bloom, tone, grade, vig));
  const accum = new AccumPass();
  composer.addPass(accum);
  return { composer, dof, bloom, gain, grade, vig, ao, accum, tone, rays, sun };
}
