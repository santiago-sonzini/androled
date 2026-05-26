import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { VC_DATA, ANIMAL_DATA, N_PTS } from '@/data/points-data';

// ─── helpers ────────────────────────────────────────────────────────────────
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ss = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

// ─── section id list ────────────────────────────────────────────────────────
const SECTION_IDS = ['hero', 'emblem', 'tigers', 'map', 'panther', 'rsvp', 'foot'] as const;

interface SectionTops {
  hero?: number;
  emblem?: number;
  tigers?: number;
  map?: number;
  panther?: number;
  rsvp?: number;
  foot?: number;
}

// ─── vertex shaders ─────────────────────────────────────────────────────────
const MORPH_VERT = /* glsl */`
  attribute vec3  aVCPos, aAnimalPos;
  attribute float aRandom, aRandom2, aRandom3;
  uniform float uTime, uRotY, uFormT, uMorphT, uDriftAmp, uLimitSoft;
  uniform float uBeat, uScrollRot, uScale, uIntroS, uPixelRatio;
  varying float vOpacity;

  void main() {
    vec3 base = mix(aVCPos, aAnimalPos, uMorphT);
    base *= 1.22; // <-- separa las partículas

    // micro-breathing
    float bp  = aRandom  * 6.2831 + uTime * 0.55;
    float bp2 = aRandom2 * 6.2831 + uTime * 0.40;
    base += vec3(sin(bp)*0.012, cos(bp2)*0.009, sin(bp*0.7)*0.007);

    // rotation Y (frontal)
    float r = uRotY + uScrollRot;
    float cY = cos(r), sY = sin(r);
    vec3 rotated = vec3(cY*base.x + sY*base.z, base.y, -sY*base.x + cY*base.z);

    // soft limits
    float lp = aRandom * 6.2831;
    rotated += vec3(
      sin(lp + uTime*0.28)*0.28,
      cos(lp*1.2 + uTime*0.22)*0.20,
      sin(lp*0.7 - uTime*0.18)*0.16
    ) * uLimitSoft;

    // drift
    float dp  = aRandom2 * 6.2831 + uTime * 0.25;
    float dp2 = aRandom3 * 6.2831 + uTime * 0.20;
    vec3 floatOff = vec3(
      sin(dp)  * (0.55 + aRandom  * 0.5),
      cos(dp2) * (0.45 + aRandom2 * 0.4),
      sin(dp*0.7 + dp2*0.5) * (0.3 + aRandom3 * 0.25)
    ) * uDriftAmp;
    vec3 finalPos = mix(rotated + floatOff, rotated, uFormT);

    // heartbeat (latido real)
    finalPos += normalize(finalPos) * uBeat * 0.22;
    // heartbeat
    finalPos += vec3(
      sin(aRandom *47.3) * uBeat * 0.14,
      cos(aRandom2*31.7) * uBeat * 0.14,
      sin(aRandom3*19.1) * uBeat * 0.09
    );

    float pulse = sin(uTime*0.55 + aRandom*6.2831)*0.18 + 0.82;
    float beat  = 1.0 + uBeat * 0.9;

    vOpacity = pulse * beat * mix(0.5, 1.0, uFormT);

    vec4 mvPos = modelViewMatrix * vec4(finalPos * uScale * uIntroS, 1.0);
    float d = length(mvPos.xyz);
    gl_PointSize = max(0.4, (1.6 + pulse*0.8) * beat * uPixelRatio * (3.0/d) * 2.8);
    gl_Position  = projectionMatrix * mvPos;
  }
`;

const MORPH_FRAG = /* glsl */`
  varying float vOpacity;
  void main() {
    vec2  uv = gl_PointCoord - 0.5;
    float d  = length(uv);
    if (d > 0.5) discard;
    float alpha = 1.0 - smoothstep(0.27, 0.5, d);
    if (alpha < 0.01) discard;
    float inner = 1.0 - smoothstep(0.0, 0.2, d);
    float core  = 1.0 - smoothstep(0.0, 0.10, d);
    float glow  = exp(-d * d * 18.0);
    float halo  = exp(-d * d * 5.5) * 0.55;
    float a2 = clamp(core*0.95 + glow*0.55 + halo, 0.0, 1.0);
    vec3 coreCol = vec3(1.00, 0.18, 0.22);   // ← rojo brillante en el centro
    vec3 midCol  = vec3(0.90, 0.08, 0.08);
    vec3 haloCol = vec3(0.55, 0.02, 0.02);
    vec3 col = mix(haloCol, midCol,  smoothstep(0.0, 0.35, 1.0-d));
    col      = mix(col,    coreCol,  smoothstep(0.0, 0.12, 1.0-d));
    col     += midCol * glow * 0.35;
    gl_FragColor = vec4(col, a2 * vOpacity);
  }
`;

const AMBIENT_VERT = /* glsl */`
  attribute float aR0, aR1, aR2, aR3, aR4;
  uniform float uTime, uPixelRatio;
  varying float vOpacity;
  varying float vSize;

  void main() {
    vec3 p = position;
    float fx = 0.055 + aR0 * 0.065;
    float fy = 0.048 + aR1 * 0.058;
    float fz = 0.038 + aR2 * 0.042;
    float ax = 0.6 + aR3 * 1.2;
    float ay = 0.5 + aR4 * 0.9;
    float az = 0.25 + aR0 * 0.45;
    float px0 = aR1 * 6.2831;
    float py0 = aR2 * 6.2831;
    float pz0 = aR3 * 6.2831;
    p.x += sin(uTime * fx + px0) * ax;
    p.y += cos(uTime * fy + py0) * ay;
    p.z += sin(uTime * fz + pz0) * az;
    float bA = sin(uTime * (0.19 + aR0*0.12) + aR4*6.2831) * 0.5 + 0.5;
    float bB = sin(uTime * (0.31 + aR1*0.09) + aR3*6.2831) * 0.3 + 0.3;
    float breathe = (bA + bB) * 0.5;
    float dim = 0.06 + aR2 * 0.12;
    vOpacity = breathe * dim;
    vSize = 0.5 + aR4 * 2.5;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = length(mv.xyz);
    gl_PointSize = max(0.3, vSize * uPixelRatio * (3.0/dist));
    gl_Position  = projectionMatrix * mv;
  }
`;

const AMBIENT_FRAG = /* glsl */`
  varying float vOpacity;
  varying float vSize;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float alpha = exp(-d * d * (8.0 + vSize * 2.0));
    if (alpha < 0.005) discard;
    float warmth = 1.0 - d * 2.0;
    vec3 col = mix(vec3(0.35, 0.01, 0.01), vec3(0.80, 0.25, 0.08), clamp(warmth, 0.0, 1.0));
    gl_FragColor = vec4(col, alpha * vOpacity);
  }
`;

// ─── hook ───────────────────────────────────────────────────────────────────
export function useThreeMorphAnimation(
  containerRef: React.RefObject<HTMLDivElement | null>
): void {
  const rafRef = useRef<number>(0);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let W = window.innerWidth;
    let H = window.innerHeight;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    // ── renderer ────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(DPR);
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.style.cssText =
      'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:0;pointer-events:none;';
    container.appendChild(canvas);
    rendererRef.current = renderer;

    // ── scene / camera ──────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, W / H, 0.1, 200);
    camera.position.set(0, 0, 5.5);

    // ── mouse ───────────────────────────────────────────────────────────────
    const mouse = { x: 0, y: 0 };
    const onMouseMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / W - 0.5) * 2;
      mouse.y = -(e.clientY / H - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouseMove);

    // ── morph geometry ──────────────────────────────────────────────────────
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('aVCPos', new THREE.BufferAttribute(VC_DATA.slice(), 3));
    geo.setAttribute('aAnimalPos', new THREE.BufferAttribute(ANIMAL_DATA.slice(), 3));
    const rnd = new Float32Array(N_PTS);
    const rnd2 = new Float32Array(N_PTS);
    const rnd3 = new Float32Array(N_PTS);
    for (let i = 0; i < N_PTS; i++) {
      rnd[i] = Math.random();
      rnd2[i] = Math.random();
      rnd3[i] = Math.random();
    }
    geo.setAttribute('aRandom', new THREE.BufferAttribute(rnd, 1));
    geo.setAttribute('aRandom2', new THREE.BufferAttribute(rnd2, 1));
    geo.setAttribute('aRandom3', new THREE.BufferAttribute(rnd3, 1));
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_PTS * 3), 3));

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uRotY: { value: 0 },
        uFormT: { value: 1 },
        uMorphT: { value: 0 },
        uDriftAmp: { value: 0 },
        uLimitSoft: { value: 0 },
        uBeat: { value: 0 },
        uScrollRot: { value: 0 },
        uScale: { value: 1 },
        uIntroS: { value: 3.0 },
        uPixelRatio: { value: DPR },
      },
      vertexShader: MORPH_VERT,
      fragmentShader: MORPH_FRAG,
    });
    scene.add(new THREE.Points(geo, mat));

    // ── ambient particles ───────────────────────────────────────────────────
    const AMB = 420;
    const ambGeo = new THREE.BufferGeometry();
    const ambPos = new Float32Array(AMB * 3);
    const ambR = [0, 1, 2, 3, 4].map(() => new Float32Array(AMB));
    for (let i = 0; i < AMB; i++) {
      ambPos[i * 3] = (Math.random() - 0.5) * 14;
      ambPos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      ambPos[i * 3 + 2] = (Math.random() - 0.5) * 6 - 2;
      ambR.forEach(a => { a[i] = Math.random(); });
    }
    ambGeo.setAttribute('position', new THREE.BufferAttribute(ambPos, 3));
    ambGeo.setAttribute('aR0', new THREE.BufferAttribute(ambR[0] ?? new Float32Array(AMB), 1));
    ambGeo.setAttribute('aR1', new THREE.BufferAttribute(ambR[1] ?? new Float32Array(AMB), 1));
    ambGeo.setAttribute('aR2', new THREE.BufferAttribute(ambR[2] ?? new Float32Array(AMB), 1));
    ambGeo.setAttribute('aR3', new THREE.BufferAttribute(ambR[3] ?? new Float32Array(AMB), 1));
    ambGeo.setAttribute('aR4', new THREE.BufferAttribute(ambR[4] ?? new Float32Array(AMB), 1));


    const ambMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: DPR },
      },
      vertexShader: AMBIENT_VERT,
      fragmentShader: AMBIENT_FRAG,
    });
    scene.add(new THREE.Points(ambGeo, ambMat));

    // ── section position tracking ────────────────────────────────────────────
    const tops: SectionTops = {};
    const measureSections = () => {
      SECTION_IDS.forEach(id => {
        const el = document.getElementById(`s-${id}`);
        if (el) (tops as Record<string, number>)[id] = el.offsetTop;
      });
    };
    const measureTimer = setTimeout(measureSections, 120);

    // ── scroll → uniforms ────────────────────────────────────────────────────
    const computeUniforms = (scrollY: number) => {
      const vH = window.innerHeight;
      const heroBot = tops.emblem ?? vH;
      const emblemBot = tops.tigers ?? vH * 2;
      const tigersBot = tops.map ?? vH * 3;
      const mapBot = tops.panther ?? vH * 4;
      const pantherBot = tops.rsvp ?? vH * 5;
      const footTop = tops.foot ?? vH * 6;
      const footEl = document.getElementById('s-foot');
      const footBot = footTop + (footEl?.offsetHeight ?? vH);
      const rsvpBot = footTop + vH;
      const u = mat.uniforms;

      const dissolveT = ss(0, heroBot * 0.5, scrollY);
      const formVC = 1 - dissolveT;
      const reformT = ss(rsvpBot, footBot, scrollY);

      if (u.uFormT && u.uMorphT && u.uDriftAmp && u.uScrollRot) {
        u.uFormT.value = clamp(scrollY < rsvpBot ? formVC : reformT, 0, 1);
        u.uMorphT.value = ss(emblemBot, mapBot, scrollY);
        const driftIn = ss(0, emblemBot * 0.8, scrollY);
        const driftOut = 1 - ss(mapBot, pantherBot, scrollY);
        u.uDriftAmp.value = driftIn * driftOut;
        u.uScrollRot.value = ss(tigersBot, pantherBot, scrollY) * Math.PI * 0.5;
      }
    };

    // ── resize ───────────────────────────────────────────────────────────────
    const onResize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H);
      setTimeout(measureSections, 50);
    };
    window.addEventListener('resize', onResize);

    // ── render loop ──────────────────────────────────────────────────────────
    const INTRO = 4.0;
    const ROT_CONT = 0.22;
    const TOTAL = Math.PI * 2 + Math.PI * 1.5;
    const B_e = ROT_CONT * INTRO / TOTAL;
    const A_e = 1 - B_e;

    let autoTime = 0;
    const clock = new THREE.Clock();

    let beat = 0;

    const onBeat = () => {
      beat = 1;
    };

    window.addEventListener('countdown-beat', onBeat);

    const frame = () => {
      rafRef.current = requestAnimationFrame(frame);
      const dt = clock.getDelta();
      const t = clock.getElapsedTime();
      autoTime += dt * 0.13;

      const u = mat.uniforms;
      if (u.uTime && ambMat.uniforms.uTime) {
        u.uTime.value = t;
        ambMat.uniforms.uTime.value = t;
      }

      // scale
      if (u.uScale && u.uMorphT) {
        u.uScale.value = lerp(u.uScale.value, 1 - u.uMorphT.value * 0.30, 0.08);
      }

      // intro convergence
      const introTarget = t < INTRO ? 3.0 - 2.0 * Math.min(t / INTRO, 1.0) : 1.0;
      if (u.uIntroS) {
        u.uIntroS.value = lerp(u.uIntroS.value, introTarget, 0.04);
      }

      // organic heartbeat
      const now = performance.now();
      const sf = (now % 1000) / 1000;

      beat *= 0.92;

      if (u.uBeat) {
        u.uBeat.value = beat;
      }

      // scroll uniforms
      computeUniforms(window.scrollY || 0);

      // rotation
      let rotY: number;
      if (t < INTRO) {
        const p = t / INTRO;
        const eased = 1 - Math.pow(1 - p, 5);
        rotY = TOTAL * (A_e * eased + B_e * p);
      } else {
        rotY = TOTAL + (t - INTRO) * ROT_CONT;
      }
      if (u.uRotY && u.uLimitSoft) {
        u.uRotY.value = rotY;
        u.uLimitSoft.value = 0;
      }

      // camera
      camera.position.x = lerp(camera.position.x, mouse.x * 0.18, 0.03);
      camera.position.y = lerp(camera.position.y, mouse.y * 0.13, 0.03);
      camera.position.z = 5.5;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    rafRef.current = requestAnimationFrame(frame);

    // ── scroll reveal ────────────────────────────────────────────────────────
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(en => {
          if (en.isIntersecting) {
            en.target.classList.add('in');
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );
    document.querySelectorAll<Element>('.reveal').forEach(el => io.observe(el));

    // ── cleanup ──────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(measureTimer);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      io.disconnect();
      renderer.dispose();
      geo.dispose();
      mat.dispose();
      ambGeo.dispose();
      ambMat.dispose();
      if (container.contains(canvas)) container.removeChild(canvas);
      rendererRef.current = null;
    };
  }, [containerRef]);
}
