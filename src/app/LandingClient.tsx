'use client';

import { useEffect } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const LANDING_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=Inter:wght@300;400&display=swap');

:root {
  --void:           #030308;
  --indigo:         #4a47d4;
  --magenta:        #c026a8;
  --white-core:     #f8f4ff;
  --text-primary:   #e8e4f8;
  --text-secondary: #8882b8;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { scroll-behavior: smooth; }

body {
  background: var(--void);
  color: var(--text-primary);
  font-family: 'Inter', sans-serif;
  font-weight: 300;
  overflow-x: hidden;
  cursor: none;
}

#cursor {
  position: fixed;
  width: 8px; height: 8px;
  background: var(--white-core);
  border-radius: 50%;
  pointer-events: none;
  z-index: 9999;
  transform: translate(-50%, -50%);
  mix-blend-mode: difference;
}
#cursor-ring {
  position: fixed;
  width: 32px; height: 32px;
  border: 1px solid rgba(248,244,255,0.4);
  border-radius: 50%;
  pointer-events: none;
  z-index: 9998;
  transform: translate(-50%, -50%);
}

#webgl-canvas {
  position: fixed;
  inset: 0;
  width: 100%; height: 100%;
  z-index: 0;
  pointer-events: none;
}

#noise-overlay {
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  opacity: 0.025;
  pointer-events: none;
  z-index: 200;
  mix-blend-mode: overlay;
}

section {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 0 clamp(1.5rem, 6vw, 6rem);
  z-index: 10;
}

.wordmark-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.2rem;
  user-select: none;
}

.wordmark {
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  font-size: clamp(3.5rem, 12vw, 9rem);
  letter-spacing: -0.02em;
  color: var(--white-core);
  display: flex;
  line-height: 1;
}

.wordmark .char {
  display: inline-block;
  opacity: 0;
  filter: blur(40px);
  transform: scale(0.6);
  will-change: filter, opacity, transform;
}

.wordmark-sub {
  font-size: clamp(0.65rem, 1.4vw, 0.85rem);
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: var(--text-secondary);
  opacity: 0;
}

.scroll-hint {
  position: absolute;
  bottom: 2.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  opacity: 0;
  color: var(--text-secondary);
  font-size: 0.6rem;
  letter-spacing: 0.35em;
  text-transform: uppercase;
}
.scroll-hint::after {
  content: '';
  width: 1px;
  height: 36px;
  background: linear-gradient(to bottom, var(--text-secondary), transparent);
  animation: scrollPulse 2s ease-in-out infinite;
}
@keyframes scrollPulse {
  0%, 100% { opacity: 0.3; }
  50%       { opacity: 1;   }
}

.section-1-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.2rem;
  max-width: 56ch;
}

.section-label {
  font-size: 0.62rem;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: var(--text-secondary);
}
.section-label span {
  opacity: 0;
  display: inline-block;
  transform: translateY(10px);
}

.headline {
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  font-size: clamp(2.2rem, 5.5vw, 4.5rem);
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--white-core);
}
.headline .word { display: inline-block; margin-right: 0.22em; }
.headline .char {
  display: inline-block;
  opacity: 0;
  transform: translateY(60px);
  will-change: transform, opacity;
}

.body-text {
  font-size: clamp(0.85rem, 1.6vw, 1rem);
  line-height: 1.75;
  color: var(--text-secondary);
  max-width: 46ch;
  opacity: 0;
}

.final-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.6rem;
}

.final-label {
  font-family: 'Syne', sans-serif;
  font-size: 0.62rem;
  letter-spacing: 0.45em;
  text-transform: uppercase;
  color: var(--text-secondary);
  opacity: 0;
  transform: translateY(20px);
}

.final-headline {
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  font-size: clamp(2.8rem, 7vw, 6rem);
  line-height: 1.08;
  letter-spacing: -0.02em;
  color: var(--white-core);
  opacity: 0;
  transform: translateY(20px);
}

.final-sub {
  font-size: clamp(0.85rem, 1.6vw, 1rem);
  color: var(--text-secondary);
  max-width: 38ch;
  line-height: 1.7;
  opacity: 0;
  transform: translateY(20px);
}

.whatsapp-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.95rem 2.2rem;
  border-radius: 100px;
  background: rgba(37, 211, 102, 0.08);
  border: 1px solid rgba(37, 211, 102, 0.35);
  color: #e8fef0;
  font-family: 'Syne', sans-serif;
  font-size: 0.85rem;
  letter-spacing: 0.06em;
  text-decoration: none;
  cursor: none;
  opacity: 0;
  transform: translateY(20px) scale(0.96);
  transition: background 0.4s ease, border-color 0.4s ease, transform 0.3s ease;
}
.whatsapp-btn:hover {
  background: rgba(37, 211, 102, 0.15);
  border-color: rgba(37, 211, 102, 0.7);
  transform: translateY(-2px) scale(1.02) !important;
}

.whatsapp-btn__glow {
  position: absolute;
  inset: -14px;
  border-radius: 100px;
  background: radial-gradient(ellipse at center, rgba(37,211,102,0.18) 0%, transparent 70%);
  animation: glowPulse 3s ease-in-out infinite;
  pointer-events: none;
  z-index: -1;
}
@keyframes glowPulse {
  0%, 100% { opacity: 0.4; transform: scale(1);    }
  50%       { opacity: 1;   transform: scale(1.14); }
}

.whatsapp-btn__icon {
  width: 22px; height: 22px;
  flex-shrink: 0;
  filter: drop-shadow(0 0 6px rgba(37,211,102,0.6));
}

@media (max-width: 600px) {
  .wordmark       { font-size: clamp(2.2rem, 11vw, 3rem); }
  .headline       { font-size: clamp(1.65rem, 6.5vw, 2.2rem); }
  .final-headline { font-size: clamp(1.9rem, 8.5vw, 2.4rem); }
  .body-text,
  .final-sub      { font-size: 0.82rem; }
  .whatsapp-btn   { font-size: 0.78rem; padding: 0.8rem 1.7rem; }
}

@media (hover: none) {
  body          { cursor: auto; }
  #cursor,
  #cursor-ring  { display: none; }
}

#section-1 {
  min-height: 180vh;
  justify-content: center;
}

#section-2 {
  min-height: 100vh;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  text-align: center;
  padding: 0 clamp(1.5rem, 6vw, 6rem);
  background: transparent;
  position: relative;
}

#section-2 .final-inner {
  position: relative;
  z-index: 2;
}
`;

function splitWordmark(selector: string, text: string) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.innerHTML = '';
  [...text].forEach(ch => {
    const s = document.createElement('span');
    s.className = 'char';
    s.textContent = ch === ' ' ? ' ' : ch;
    el.appendChild(s);
  });
}

function splitIntoChars(selector: string, text: string) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.innerHTML = '';
  text.split(' ').forEach((word, wi, arr) => {
    const w = document.createElement('span');
    w.className = 'word';
    [...word].forEach(ch => {
      const c = document.createElement('span');
      c.className = 'char';
      c.textContent = ch;
      w.appendChild(c);
    });
    el.appendChild(w);
    if (wi < arr.length - 1) el.appendChild(document.createTextNode(' '));
  });
}

export default function LandingClient() {
  useEffect(() => {
    // Inject landing CSS (removed on cleanup to avoid leaking into other routes)
    const styleEl = document.createElement('style');
    styleEl.id = 'landing-css';
    styleEl.textContent = LANDING_CSS;
    document.head.appendChild(styleEl);

    gsap.registerPlugin(ScrollTrigger);
    // Make available as globals for the vanilla JS modules that reference them without import
    (window as any).gsap = gsap;
    (window as any).ScrollTrigger = ScrollTrigger;

    let animationId: number;

    async function init() {
      const { detectGPUTier } = await import('@/landing/utils/GPUTier');
      const { SceneManager } = await import('@/landing/SceneManager');
      const { ParticleEngine } = await import('@/landing/ParticleEngine');
      const { CameraRig } = await import('@/landing/CameraRig');
      const { LightSystem } = await import('@/landing/LightSystem');
      const { LineField } = await import('@/landing/LineField');
      const { SectionOrchestrator } = await import('@/landing/SectionOrchestrator');
      const { InteractionLayer } = await import('@/landing/InteractionLayer');

      splitWordmark('.wordmark', 'Androled');
      splitIntoChars('#section-1 .headline', 'Luz que se mueve con tu gente.');

      const gpuTier = detectGPUTier();
      const particleCount = gpuTier === 'high' ? 150000 : gpuTier === 'mid' ? 80000 : 30000;
      const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
      const sceneManager = new SceneManager(canvas, gpuTier);
      const { scene, camera } = sceneManager;
      const particles = new ParticleEngine(scene, particleCount);
      const cameraRig = new CameraRig(camera);
      const lights = new LightSystem(scene, sceneManager);
      const lineField = new LineField(scene);
      const orchestrator = new SectionOrchestrator(scene, camera, cameraRig, particles, lights, sceneManager, lineField);
      new InteractionLayer(camera, particles, cameraRig);

      // Entry animations
      gsap.to(cameraRig, { targetZ: 0, duration: 2.4, ease: 'power3.out' });
      gsap.to('.wordmark .char', {
        opacity: 1, filter: 'blur(0px)', scale: 1,
        duration: 1.2, ease: 'expo.out', stagger: 0.07, delay: 0.3,
      });
      gsap.to('.wordmark-sub', { opacity: 1, duration: 1.0, delay: 1.1 });
      gsap.to('.scroll-hint', { opacity: 0.5, duration: 0.8, delay: 2.2 });

      // Render loop
      const clock = new THREE.Clock();
      let last = 0;
      function render() {
        animationId = requestAnimationFrame(render);
        const t = clock.getElapsedTime();
        const dt = t - last; last = t;
        particles.update(t, orchestrator._scrollEMA || 0);
        cameraRig.update(dt);
        lights.update(t);
        orchestrator.update(t);
        sceneManager.updateTime(t);
        sceneManager.render();
      }
      render();
    }

    init().catch(console.error);

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      ScrollTrigger.getAll().forEach(t => t.kill());
      styleEl.remove();
    };
  }, []);

  return (
    <>
      <div id="cursor"></div>
      <div id="cursor-ring"></div>
      <canvas id="webgl-canvas"></canvas>
      <div id="noise-overlay" aria-hidden="true"></div>

      <section id="section-0">
        <div className="wordmark-container">
          <h1 className="wordmark" aria-label="Androled"></h1>
          <p className="wordmark-sub">Pulseras LED para eventos</p>
        </div>
        <div className="scroll-hint" aria-hidden="true">Scroll</div>
      </section>

      <section id="section-1">
        <div className="section-1-content">
          <p className="section-label"><span>Experiencia</span></p>
          <h2 className="headline" aria-label="Luz que se mueve con tu gente"></h2>
          <p className="body-text">
            Sincronizamos miles de pulseras LED en tiempo real. Cada evento se convierte
            en un espectáculo de luz vivo, colectivo e irrepetible.
          </p>
        </div>
      </section>

      <section id="section-2">
        <div className="final-inner">
          <p className="final-label">Androled</p>
          <h2 className="final-headline">Tu evento.<br />Nuestra luz.</h2>
          <p className="final-sub">Cotizá tu paquete de pulseras LED y transformá la noche.</p>
          <a
            className="whatsapp-btn"
            href="https://wa.me/5493536563678"
            target="_blank"
            rel="noopener"
            aria-label="Contactar por WhatsApp"
          >
            <span className="whatsapp-btn__glow"></span>
            <svg className="whatsapp-btn__icon" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M16 2C8.268 2 2 8.268 2 16c0 2.478.677 4.8 1.855 6.793L2 30l7.395-1.83A13.94 13.94 0 0016 30c7.732 0 14-6.268 14-14S23.732 2 16 2z" fill="#25D366" />
              <path d="M22.5 19.5c-.3-.15-1.77-.873-2.044-.972-.274-.1-.473-.15-.672.15-.2.3-.772.972-.947 1.172-.174.2-.349.224-.648.075-.3-.15-1.265-.466-2.41-1.485-.891-.794-1.493-1.774-1.668-2.073-.174-.3-.018-.462.131-.61.134-.134.3-.349.449-.523.15-.175.2-.3.3-.499.1-.2.05-.374-.025-.523-.075-.15-.672-1.62-.921-2.22-.243-.582-.49-.503-.672-.512l-.573-.01c-.2 0-.523.075-.797.374-.274.3-1.046 1.022-1.046 2.492s1.071 2.892 1.22 3.092c.15.2 2.107 3.215 5.104 4.508.714.308 1.271.492 1.705.63.716.228 1.368.196 1.884.119.575-.086 1.77-.724 2.02-1.423.249-.7.249-1.3.174-1.424-.074-.123-.273-.198-.573-.348z" fill="white" />
            </svg>
            <span className="whatsapp-btn__text">Hablemos por WhatsApp</span>
          </a>
        </div>
      </section>
    </>
  );
}
