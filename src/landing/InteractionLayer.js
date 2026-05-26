// @ts-nocheck
import * as THREE from 'three';

export class InteractionLayer {
  constructor(camera, particles, cameraRig) {
    this.camera    = camera;
    this.particles = particles;
    this.cameraRig = cameraRig;
    this.enabled   = true;

    this.cursor    = document.getElementById('cursor');
    this.cursorRing= document.getElementById('cursor-ring');
    this._cx = window.innerWidth/2;
    this._cy = window.innerHeight/2;
    this._rx = this._cx;
    this._ry = this._cy;

    this._init();
    this._loopCursor();
  }

  _ndc(clientX, clientY) {
    return {
      x: (clientX/window.innerWidth)*2 - 1,
      y: -(clientY/window.innerHeight)*2 + 1,
    };
  }

  _worldPos(nx, ny) {
    const v = new THREE.Vector3(nx, ny, 0.5).unproject(this.camera);
    const dir = v.sub(this.camera.position).normalize();
    const t   = Math.abs(this.camera.position.z) / Math.max(Math.abs(dir.z), 0.0001);
    return this.camera.position.clone().addScaledVector(dir, t);
  }

  _init() {
    window.addEventListener('mousemove', e => {
      this._cx = e.clientX; this._cy = e.clientY;
      if (!this.enabled) return;
      const { x, y } = this._ndc(e.clientX, e.clientY);
      this.cameraRig.setMouseParallax(x, y);
      const wp = this._worldPos(x, y);
      this.particles.setMouseWorld(wp.x, wp.y, wp.z);
    });

    window.addEventListener('click', e => {
      if (!this.enabled) return;
      const { x, y } = this._ndc(e.clientX, e.clientY);
      this.particles.triggerShockwave(this._worldPos(x, y));
    });

    window.addEventListener('touchmove', e => {
      if (!e.touches.length || !this.enabled) return;
      const t = e.touches[0];
      const { x, y } = this._ndc(t.clientX, t.clientY);
      this.cameraRig.setMouseParallax(x, y);
      const wp = this._worldPos(x, y);
      this.particles.setMouseWorld(wp.x, wp.y, wp.z);
    }, { passive: true });

    window.addEventListener('touchstart', e => {
      if (!e.touches.length || !this.enabled) return;
      const t = e.touches[0];
      this.particles.triggerShockwave(this._worldPos(
        this._ndc(t.clientX, t.clientY).x,
        this._ndc(t.clientX, t.clientY).y
      ));
    }, { passive: true });
  }

  _loopCursor() {
    const run = () => {
      if (this.cursor) {
        this.cursor.style.left = this._cx + 'px';
        this.cursor.style.top  = this._cy + 'px';
      }
      if (this.cursorRing) {
        this._rx += (this._cx - this._rx) * 0.12;
        this._ry += (this._cy - this._ry) * 0.12;
        this.cursorRing.style.left = this._rx + 'px';
        this.cursorRing.style.top  = this._ry + 'px';
      }
      requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  }
}
