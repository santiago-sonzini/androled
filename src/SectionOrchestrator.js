// SectionOrchestrator.js
import * as THREE from 'three';
import { Disposer } from './utils/Disposer.js';

export class SectionOrchestrator {
  constructor(scene, camera, cameraRig, particles, lights, sceneManager, lineField) {
    this.scene        = scene;
    this.camera       = camera;
    this.cameraRig    = cameraRig;
    this.particles    = particles;
    this.lights       = lights;
    this.sceneManager = sceneManager;
    this.lineField    = lineField || null;
    this.disposer     = new Disposer();

    this._scrollEMA     = 0;
    this._finalRevealed = false;
    this._bloomFired    = false;
    this.rings          = [];

    this._buildGeometry();
    this._registerTriggers();
    this._trackScroll();
  }

  _buildGeometry() {
    const palette = [
      0xff2222, 0xff6600, 0xffcc00, 0x88ff00,
      0x00ffaa, 0x00ccff, 0x4488ff, 0x8844ff,
      0xcc22ff, 0xff22cc, 0xff4488, 0xffffff,
    ];
    for (let i = 0; i < 12; i++) {
      const geo  = new THREE.TorusGeometry(18 + i * 4, 0.28, 8, 120);
      const mat  = new THREE.MeshBasicMaterial({
        color: palette[i], transparent: true, opacity: 0,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.set(
        (i / 12) * Math.PI * 0.8 + 0.2,
        (i / 12) * Math.PI * 0.5,
        (i / 12) * Math.PI * 0.3
      );
      ring.position.set(0, 0, -600);
      ring.frustumCulled = true;
      ring._rs = {
        x: (Math.random() - 0.5) * 0.008,
        y: (Math.random() - 0.5) * 0.012,
        z: (Math.random() - 0.5) * 0.006,
      };
      ring._rsOrig = { x: ring._rs.x, y: ring._rs.y, z: ring._rs.z };
      this.scene.add(ring);
      this.rings.push(ring);
      this.disposer.register('s1', geo);
      this.disposer.register('s1', mat);
    }
  }

  _trackScroll() {
    ScrollTrigger.addEventListener('scrollStart', () => this.cameraRig.triggerInertia());
    let lastY = window.scrollY, lastT = performance.now();
    window.addEventListener('scroll', () => {
      const now = performance.now(), dy = window.scrollY - lastY, dt = (now - lastT) / 1000;
      const raw = dt > 0 ? dy / dt / 1000 : 0;
      this._scrollEMA = 0.15 * raw + 0.85 * this._scrollEMA;
      lastY = window.scrollY; lastT = now;
    }, { passive: true });
  }

  _registerTriggers() {
    // Master camera Z
    ScrollTrigger.create({
      trigger: 'body', start: 'top top', end: 'bottom bottom', scrub: 1,
      onUpdate: self => this.cameraRig.setScrollTarget(-self.progress * 1200),
    });

    // Sección 1: rings + explosión scrubbed (100% reversible)
    ScrollTrigger.create({
      trigger: '#section-1', start: 'top 85%', end: 'bottom 15%', scrub: 1,
      onEnter: () => this._revealS1Text(),
      onUpdate: self => {
        const prog = self.progress;
        // Fase normal (0 → 0.78) y fase explosión (0.78 → 1.0)
        const expT = Math.max(0, (prog - 0.78) / 0.22); // 0→1 durante explosión

        for (const r of this.rings) {
          if (expT <= 0) {
            // Fase normal: aparecen suavemente
            r.material.opacity = Math.min(0.7, prog * 2);
            r.scale.setScalar(1);
            r._rs.x = r._rsOrig.x;
            r._rs.y = r._rsOrig.y;
            r._rs.z = r._rsOrig.z;
          } else {
            // Fase explosión: se expanden y desvanecen — reversible
            r.material.opacity = Math.max(0, 0.7 * (1 - expT * 2.2));
            r.scale.setScalar(1 + expT * 1.8);
            r._rs.x = r._rsOrig.x * (1 + expT * 6);
            r._rs.y = r._rsOrig.y * (1 + expT * 6);
            r._rs.z = r._rsOrig.z * (1 + expT * 6);
          }
        }

        this.cameraRig.enableOrbitMode(prog);

        // Bloom spike: one-shot solo al avanzar, se resetea al retroceder
        if (self.direction === 1 && expT > 0 && !this._bloomFired) {
          this._bloomFired = true;
          this.lights.spikeBloom(4.5, 1.4, 900);
        }
        if (expT <= 0) this._bloomFired = false;
      },
      onLeave: () => {
        this.cameraRig.disableOrbitMode();
      },
      onLeaveBack: () => {
        this.cameraRig.disableOrbitMode();
        // Limpiar estado de rings para cuando la cámara está por encima de section-1
        for (const r of this.rings) {
          r.material.opacity = 0;
          r.scale.setScalar(1);
          r._rs.x = r._rsOrig.x;
          r._rs.y = r._rsOrig.y;
          r._rs.z = r._rsOrig.z;
        }
        this._bloomFired = false;
        if (this.lineField) {
          this.lineField.hide();
          this.lineField.setDissolve(0);
          this.lineField.setOpacity(0);
        }
      },
      onEnterBack: () => {
        this.cameraRig.enableOrbitMode(1);
        // onUpdate se encarga del estado de rings al decrecer progress
      },
    });

    // Transición épica: rings → líneas (scrubbed, 100% reversible)
    ScrollTrigger.create({
      trigger: '#section-2',
      start: 'top 95%',
      end:   'top 10%',
      scrub: 2.5,
      onEnter: () => {
        if (this.lineField) this.lineField.show();
      },
      onUpdate: self => {
        if (this.lineField) {
          const p = self.progress;
          // Ease in-out para una disolución más dramática
          const eased = p < 0.5 ? 2*p*p : 1 - Math.pow(-2*p + 2, 2) / 2;
          this.lineField.setDissolve(eased);
          this.lineField.setOpacity(Math.min(1, p * 1.6));
        }
      },
      onLeaveBack: () => {
        if (this.lineField) {
          this.lineField.hide();
          this.lineField.setDissolve(0);
          this.lineField.setOpacity(0);
        }
      },
    });

    // Sección 2: reveal final
    ScrollTrigger.create({
      trigger: '#section-2', start: 'top 75%', end: 'top 20%',
      onEnter: () => {
        if (this._finalRevealed) return;
        this._finalRevealed = true;
        this._revealFinal();
      },
      onLeaveBack: () => {
        this._finalRevealed = false;
        gsap.set('.final-label, .final-headline, .final-sub, .whatsapp-btn', { opacity: 0, y: 20 });
      },
    });
  }

  _revealS1Text() {
    gsap.to('#section-1 .section-label span', { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' });
    gsap.to('#section-1 .headline .char',     { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.04 });
    gsap.to('#section-1 .body-text',          { opacity: 1, duration: 0.8, delay: 0.3, ease: 'power2.out' });
  }

  _revealFinal() {
    gsap.to(this.particles.uniforms.uScrollVelocity, { value: 0, duration: 2.5, ease: 'power3.out' });
    this.lights.spikeBloom(1.8, 0.8, 2000);

    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    tl.to('.final-label',    { opacity: 1, y: 0, duration: 0.8 })
      .to('.final-headline', { opacity: 1, y: 0, duration: 1.0 }, '-=0.3')
      .to('.final-sub',      { opacity: 1, y: 0, duration: 0.8 }, '-=0.4')
      .to('.whatsapp-btn',   { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: 'expo.out' }, '-=0.3');
  }

  update(t) {
    for (const r of this.rings) {
      r.rotation.x += r._rs.x;
      r.rotation.y += r._rs.y;
      r.rotation.z += r._rs.z;
    }
    if (this.lineField) this.lineField.update(t);
  }
}
