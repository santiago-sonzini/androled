import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass }     from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass }     from 'three/addons/postprocessing/OutputPass.js';

const CustomPostShader = {
  uniforms: {
    tDiffuse:            { value: null },
    uTime:               { value: 0 },
    uResolution:         { value: new THREE.Vector2(1, 1) },
    uChromaticAberration:{ value: 0.003 },
    uVignetteStrength:   { value: 0.45 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uChromaticAberration;
    uniform float uVignetteStrength;
    varying vec2 vUv;

    vec3 aces(vec3 x) {
      const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
      return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
    }

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;
      float ca = uChromaticAberration;
      vec4 r = texture2D(tDiffuse, uv + vec2(ca,  0.0));
      vec4 g = texture2D(tDiffuse, uv);
      vec4 b = texture2D(tDiffuse, uv - vec2(ca,  0.0));
      vec4 color = vec4(r.r, g.g, b.b, 1.0);

      float dist = length(uv - 0.5);
      float vignette = 1.0 - smoothstep(0.3, 0.9, dist * uVignetteStrength * 2.8);
      color.rgb *= vignette;

      float grain = (hash(uv + fract(uTime * 0.017)) - 0.5) * 0.03;
      color.rgb += grain;

      color.rgb = aces(color.rgb);
      gl_FragColor = color;
    }
  `,
};

export class SceneManager {
  constructor(canvas, gpuTier) {
    this.canvas   = canvas;
    this.gpuTier  = gpuTier;

    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initComposer();
    this._initResize();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030308);
  }

  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 2000);
    this.camera.position.set(0, 0, 300);
  }

  _initComposer() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    if (this.gpuTier !== 'low') {
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.8, this.gpuTier === 'mid' ? 0.2 : 0.4, 0.2
      );
      this.composer.addPass(this.bloomPass);

      this.customPass = new ShaderPass(CustomPostShader);
      this.customPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
      this.composer.addPass(this.customPass);
    }

    this.composer.addPass(new OutputPass());
  }

  _initResize() {
    window.addEventListener('resize', () => {
      const w = window.innerWidth, h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.composer.setSize(w, h);
      if (this.customPass) this.customPass.uniforms.uResolution.value.set(w, h);
    });
  }

  setBloomStrength(v)  { if (this.bloomPass) this.bloomPass.strength = v; }
  updateTime(t)        { if (this.customPass) this.customPass.uniforms.uTime.value = t; }
  render()             { this.composer.render(); }
}
