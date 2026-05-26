// @ts-nocheck
import * as THREE from 'three';
import { gaussianRandom } from './utils/MathHelpers.js';

const VERT = /* glsl */`
  attribute vec3  aVelocity;
  attribute float aLife;
  attribute float aSize;
  attribute vec3  aColor;
  attribute float aSeed;

  uniform float uTime;
  uniform vec3  uMouseWorld;
  uniform float uScrollVelocity;
  uniform vec3  uShockwaveOrigin;
  uniform float uShockwaveRadius;
  uniform float uSupernovaPhase;
  uniform float uDiskStrength;

  varying vec3  vColor;
  varying float vAlpha;

  float hash(float n) { return fract(sin(n) * 43758.5453); }

  void main() {
    vec3 pos = position;

    float freq = 0.3 + aSeed * 0.4;
    float turbStr = 1.0 + abs(uScrollVelocity) * 3.0;
    vec3 turb = vec3(
      sin(uTime * freq        + aSeed * 6.283),
      cos(uTime * freq * 0.7  + aSeed * 3.141),
      sin(uTime * freq * 0.5  + aSeed * 9.424)
    ) * turbStr * 0.5;

    pos += aVelocity * uTime * 12.0 + turb;

    if (length(pos) > 120.0)
      pos = normalize(pos) * (80.0 + hash(aSeed + floor(length(pos)*0.01)) * 40.0);

    vec3 toMouse = uMouseWorld - pos;
    float md = length(toMouse);
    if (md > 0.1 && md < 60.0)
      pos += normalize(toMouse) * min(0.8, 1.2 / (md * md) * 120.0);

    if (uDiskStrength > 0.001) {
      pos.y  = mix(pos.y,  0.0, uDiskStrength * 0.04);
      float xzLen = length(pos.xz);
      if (xzLen > 0.1) pos.xz = normalize(pos.xz) * mix(xzLen, 60.0, uDiskStrength * 0.02);
    }

    if (uShockwaveRadius > 0.0) {
      vec3  d  = pos - uShockwaveOrigin;
      float sd = length(d);
      float w  = uShockwaveRadius;
      if (sd < w && sd > w - 12.0)
        pos += normalize(d) * (1.0 - abs(sd - w + 6.0) / 6.0) * 8.0;
    }

    if (uSupernovaPhase > 0.0 && uSupernovaPhase < 1.0) {
      pos = mix(pos, vec3(0.0), uSupernovaPhase);
    } else if (uSupernovaPhase >= 1.0) {
      float t = uSupernovaPhase - 1.0;
      vec3 dir = normalize(aVelocity + vec3(
        hash(aSeed)*2.0-1.0, hash(aSeed+1.7)*2.0-1.0, hash(aSeed+3.3)*2.0-1.0));
      pos = dir * t * 100.0;
    }

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = clamp(aSize * (300.0 / -mvPos.z), 0.5, 12.0);
    gl_Position  = projectionMatrix * mvPos;

    float lc = fract(aLife + uTime * 0.02);
    vec3 c1 = vec3(0.18,0.17,0.83), c2 = vec3(0.29,0.28,0.83),
         c3 = vec3(0.75,0.15,0.66), c4 = vec3(0.97,0.95,1.00);
    vec3 fc;
    if      (lc < 0.33) fc = mix(c1, c2, lc/0.33);
    else if (lc < 0.66) fc = mix(c2, c3, (lc-0.33)/0.33);
    else                fc = mix(c3, c4, (lc-0.66)/0.34);

    vColor = fc * aColor;
    vAlpha = lc;
  }
`;

const FRAG = /* glsl */`
  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = 1.0 - smoothstep(0.5, 1.0, d);
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a * vAlpha * 0.85);
  }
`;

export class ParticleEngine {
  constructor(scene, count = 150000) {
    this.scene   = scene;
    this.count   = count;
    this.uniforms = {
      uTime:             { value: 0 },
      uMouseWorld:       { value: new THREE.Vector3() },
      uScrollVelocity:   { value: 0 },
      uShockwaveOrigin:  { value: new THREE.Vector3() },
      uShockwaveRadius:  { value: 0 },
      uSupernovaPhase:   { value: 0 },
      uDiskStrength:     { value: 0 },
    };
    this._build();
  }

  _build() {
    const n = this.count;
    const pos = new Float32Array(n*3), vel = new Float32Array(n*3),
          life= new Float32Array(n),   sz  = new Float32Array(n),
          col = new Float32Array(n*3), seed= new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const r = 20 + Math.random()*60;
      const theta = Math.random()*Math.PI*2;
      const phi   = Math.acos(2*Math.random()-1);
      pos[i*3]   = r*Math.sin(phi)*Math.cos(theta);
      pos[i*3+1] = r*Math.sin(phi)*Math.sin(theta);
      pos[i*3+2] = r*Math.cos(phi);
      vel[i*3]   = gaussianRandom(0,0.04);
      vel[i*3+1] = gaussianRandom(0,0.04);
      vel[i*3+2] = gaussianRandom(0,0.04);
      life[i]    = Math.random();
      sz[i]      = 0.08 + (1 - r/80)*0.32;
      col[i*3]   = 0.7+Math.random()*0.3;
      col[i*3+1] = 0.7+Math.random()*0.3;
      col[i*3+2] = 0.8+Math.random()*0.2;
      seed[i]    = Math.random();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',  new THREE.BufferAttribute(pos,  3));
    geo.setAttribute('aVelocity', new THREE.BufferAttribute(vel,  3));
    geo.setAttribute('aLife',     new THREE.BufferAttribute(life, 1));
    geo.setAttribute('aSize',     new THREE.BufferAttribute(sz,   1));
    geo.setAttribute('aColor',    new THREE.BufferAttribute(col,  3));
    geo.setAttribute('aSeed',     new THREE.BufferAttribute(seed, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: this.uniforms,
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.geometry = geo;
    this.material = mat;
    this.points   = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  update(time, scrollVelocity) {
    this.uniforms.uTime.value           = time;
    this.uniforms.uScrollVelocity.value = scrollVelocity;
  }

  setMouseWorld(x, y, z) { this.uniforms.uMouseWorld.value.set(x, y, z); }

  triggerShockwave(origin) {
    this.uniforms.uShockwaveOrigin.value.copy(origin);
    this.uniforms.uShockwaveRadius.value = 0;
    const start = performance.now();
    const run = () => {
      const t = (performance.now()-start)/1200;
      if (t >= 1) { this.uniforms.uShockwaveRadius.value = 0; return; }
      this.uniforms.uShockwaveRadius.value = t * 60;
      requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.scene.remove(this.points);
  }
}
