'use client';

import { useEffect } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const ID_PAGE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=Inter:wght@300;400&display=swap');

:root {
  --void:           #030308;
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

#webgl-canvas-id {
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

#id-hero {
  min-height: 100vh;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  z-index: 10;
  padding: 0 clamp(1.5rem, 6vw, 6rem);
}

.id-hero-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.2rem;
}

.id-welcome {
  font-family: 'Syne', sans-serif;
  font-size: clamp(0.65rem, 1.4vw, 0.85rem);
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: var(--text-secondary);
  opacity: 0;
  transform: translateY(16px);
}

.id-name {
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  font-size: clamp(3rem, 10vw, 8rem);
  letter-spacing: -0.02em;
  color: var(--white-core);
  line-height: 1;
  opacity: 0;
  transform: translateY(20px);
}

#id-photo {
  min-height: 100vh;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
  background: transparent;
  padding: 0 clamp(1.5rem, 6vw, 6rem);
}

.id-photo-inner {
  position: relative;
  z-index: 2;
}

.id-photo-img {
  width: clamp(300px, 60vw, 420px);
  aspect-ratio: 1;
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.15);
  box-shadow:
    0 0 60px rgba(74, 71, 212, 0.4),
    0 0 120px rgba(192, 38, 168, 0.2);
  display: block;
}

.id-no-photo {
  opacity: 1;
  transform: none;
  font-size: clamp(1rem, 3vw, 1.6rem) !important;
  font-weight: 400 !important;
  text-align: center;
  color: var(--white-core) !important;
}

.id-photo-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.8rem;
  justify-content: center;
}

.id-action-btn {
  font-family: 'Syne', sans-serif;
  font-size: clamp(0.6rem, 1.2vw, 0.75rem);
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: var(--white-core);
  background: transparent;
  border: 1px solid rgba(248, 244, 255, 0.5);
  padding: 0.7rem 1.6rem;
  cursor: none;
  position: relative;
  transition: border-color 0.3s, box-shadow 0.3s, color 0.3s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.id-action-btn:hover {
  border-color: var(--white-core);
  box-shadow:
    0 0 8px rgba(248, 244, 255, 0.6),
    0 0 20px rgba(248, 244, 255, 0.2),
    inset 0 0 8px rgba(248, 244, 255, 0.04);
  color: var(--white-core);
}

#id-footer {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 2rem;
  padding: 2.5rem clamp(1.5rem, 6vw, 6rem);
  border-top: 1px solid rgba(248, 244, 255, 0.06);
}

.id-footer-link {
  font-family: 'Syne', sans-serif;
  font-size: clamp(0.6rem, 1.2vw, 0.75rem);
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: #f8f4ff;
  text-decoration: none;
  transition: color 0.3s;
}

.id-footer-link:hover {
  color: #f8f4ff;
}

@media (hover: none) {
  body         { cursor: auto; }
  #cursor,
  #cursor-ring { display: none; }
}
`;

interface IdPageClientProps {
  id: string;
  name?: string;
  photoSrc?: string;
}

export default function IdPageClient({ id, name, photoSrc }: IdPageClientProps) {
  const displayName = name ?? id;

  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.textContent = ID_PAGE_CSS;
    document.head.appendChild(styleEl);

    gsap.registerPlugin(ScrollTrigger);
    (window as any).gsap = gsap;
    (window as any).ScrollTrigger = ScrollTrigger;

    // Custom cursor loop
    let cursorRaf: number;
    const cursor = document.getElementById('cursor');
    const cursorRing = document.getElementById('cursor-ring');
    let cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    let rx = cx, ry = cy;
    const onMouseMove = (e: MouseEvent) => { cx = e.clientX; cy = e.clientY; };
    window.addEventListener('mousemove', onMouseMove);
    const loopCursor = () => {
      if (cursor) { cursor.style.left = cx + 'px'; cursor.style.top = cy + 'px'; }
      if (cursorRing) {
        rx += (cx - rx) * 0.12;
        ry += (cy - ry) * 0.12;
        cursorRing.style.left = rx + 'px';
        cursorRing.style.top = ry + 'px';
      }
      cursorRaf = requestAnimationFrame(loopCursor);
    };
    loopCursor();

    let animationId: number;

    async function init() {
      const { detectGPUTier } = await import('@/landing/utils/GPUTier');
      const { SceneManager }  = await import('@/landing/SceneManager');
      const { ParticleEngine } = await import('@/landing/ParticleEngine');
      const { CameraRig }     = await import('@/landing/CameraRig');
      const { LightSystem }   = await import('@/landing/LightSystem');
      const { LineField }     = await import('@/landing/LineField');

      const gpuTier = detectGPUTier();
      const particleCount = gpuTier === 'high' ? 150000 : gpuTier === 'mid' ? 80000 : 30000;
      const canvas = document.getElementById('webgl-canvas-id') as HTMLCanvasElement;

      const sceneManager = new SceneManager(canvas, gpuTier);
      const { scene, camera } = sceneManager;
      const particles  = new ParticleEngine(scene, particleCount);
      const cameraRig  = new CameraRig(camera);
      const lights     = new LightSystem(scene, sceneManager);
      const lineField  = new LineField(scene);

      // Mouse → particles
      window.addEventListener('mousemove', (e: MouseEvent) => {
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = -(e.clientY / window.innerHeight) * 2 + 1;
        cameraRig.setMouseParallax(nx, ny);
      });

      // Camera scroll: hero → photo section
      ScrollTrigger.create({
        trigger: 'body', start: 'top top', end: 'bottom bottom', scrub: 1,
        onUpdate: (self: any) => cameraRig.setScrollTarget(self.progress * -1200),
      });

      // LineField: fade in when entering photo section
      ScrollTrigger.create({
        trigger: '#id-photo', start: 'top 95%', end: 'top 10%', scrub: 2.5,
        onEnter: () => lineField.show(),
        onUpdate: (self: any) => {
          const p = self.progress;
          const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          lineField.setDissolve(eased);
          lineField.setOpacity(Math.min(1, p * 1.6));
        },
        onLeaveBack: () => {
          lineField.hide();
          lineField.setDissolve(0);
          lineField.setOpacity(0);
        },
      });

      // Entry animations
      gsap.to(cameraRig, { targetZ: 0, duration: 2.4, ease: 'power3.out' });
      gsap.to('.id-welcome', { opacity: 1, y: 0, duration: 0.8, delay: 0.4, ease: 'power2.out' });
      gsap.to('.id-name',    { opacity: 1, y: 0, duration: 1.0, delay: 0.7, ease: 'expo.out' });
      gsap.to('.scroll-hint',{ opacity: 0.5, duration: 0.8, delay: 2.0 });

      // Render loop
      const clock = new THREE.Clock();
      let last = 0;
      function render() {
        animationId = requestAnimationFrame(render);
        const t = clock.getElapsedTime();
        const dt = t - last; last = t;
        particles.update(t, 0);
        cameraRig.update(dt);
        lights.update(t);
        lineField.update(t);
        sceneManager.updateTime(t);
        sceneManager.render();
      }
      render();
    }

    init().catch(console.error);

    return () => {
      cancelAnimationFrame(animationId);
      cancelAnimationFrame(cursorRaf);
      window.removeEventListener('mousemove', onMouseMove);
      ScrollTrigger.getAll().forEach((t: any) => t.kill());
      styleEl.remove();
    };
  }, []);

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: displayName, url: window.location.href });
    }
  };

  return (
    <>
      <div id="cursor"></div>
      <div id="cursor-ring"></div>
      <canvas id="webgl-canvas-id"></canvas>
      <div id="noise-overlay" aria-hidden="true"></div>

      <section id="id-hero">
        <div className="id-hero-inner">
          <p className="id-welcome">Bienvenido a Androled</p>
          <h1 className="id-name">{displayName}</h1>
        </div>
        <div className="scroll-hint" aria-hidden="true">Scroll</div>
      </section>

      <section id="id-photo">
        <div className="id-photo-inner">
          {photoSrc ? (
            <>
              <img
                src={photoSrc}
                className="id-photo-img"
                alt={displayName}
              />
              <div className="id-photo-actions">
                <a href={photoSrc} download className="id-action-btn">
                  Descargar
                </a>
                <button onClick={handleShare} className="id-action-btn">
                  Compartir
                </button>
              </div>
            </>
          ) : (
            <p className="id-welcome id-no-photo">Todavía no hay fotos tuyas</p>
          )}
        </div>
      </section>

      <footer id="id-footer">
        <a
          href="https://www.instagram.com/andro.led"
          target="_blank"
          rel="noopener noreferrer"
          className="id-footer-link"
        >
          Instagram
        </a>
        <a
          href="https://wa.me/5493534179573"
          target="_blank"
          rel="noopener noreferrer"
          className="id-footer-link"
        >
          WhatsApp
        </a>
      </footer>
    </>
  );
}