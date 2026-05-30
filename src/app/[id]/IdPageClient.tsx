'use client';

import { useEffect } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';




interface IdPageClientProps {
  id: string;
  name?: string;
  photoSrc?: string;
}

export default function IdPageClient({ id, name, photoSrc }: IdPageClientProps) {
  const displayName = name ?? id;

  useEffect(() => {
    // const styleEl = document.createElement('style');
    // styleEl.textContent = ID_PAGE_CSS;
    // document.head.appendChild(styleEl);

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
      // styleEl.remove();
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