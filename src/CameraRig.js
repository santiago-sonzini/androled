import * as THREE from 'three';
import { lerp, clamp } from './utils/MathHelpers.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.targetX = 0;
    this.targetY = 0;
    this.targetZ = 300;

    this.mouseOffsetX  = 0;
    this.mouseOffsetY  = 0;
    this.mouseTargetX  = 0;
    this.mouseTargetY  = 0;

    this.lerpSpeed        = 0.04;
    this.currentLerpSpeed = 0.04;
    this._inertiaDecay    = 0;

    this.orbitMode     = false;
    this.orbitCenter   = new THREE.Vector3(0, 0, -600);
    this.orbitRadius   = 80;
    this.orbitProgress = 0;

    // LookAt suavizado — evita el snap al entrar/salir del orbit
    this._lookAtY = 0;
    this._lookAtZ = 200; // targetZ(300) - 100

    this._initGyro();
  }

  _initGyro() {
    if (typeof DeviceOrientationEvent !== 'undefined') {
      window.addEventListener('deviceorientation', e => {
        if (e.beta == null) return;
        this.mouseTargetX = clamp(e.gamma, -30, 30) / 30 *  0.3;
        this.mouseTargetY = clamp(e.beta,  -30, 30) / 30 * -0.2;
      });
    }
  }

  setMouseParallax(nx, ny) {
    this.mouseTargetX = nx * 0.3;
    this.mouseTargetY = ny * 0.3;
  }

  setScrollTarget(z) { this.targetZ = z; }

  triggerInertia() {
    this.currentLerpSpeed = 0.14;
    this._inertiaDecay    = 1.0;
  }

  enableOrbitMode(progress) {
    this.orbitMode     = true;
    this.orbitProgress = progress;
  }

  disableOrbitMode() { this.orbitMode = false; }

  update(dt) {
    this.mouseOffsetX = lerp(this.mouseOffsetX, this.mouseTargetX, 0.05);
    this.mouseOffsetY = lerp(this.mouseOffsetY, this.mouseTargetY, 0.05);

    if (this._inertiaDecay > 0) {
      this._inertiaDecay    = Math.max(0, this._inertiaDecay - dt * 0.85);
      this.currentLerpSpeed = lerp(this.lerpSpeed, 0.14, this._inertiaDecay);
    } else {
      this.currentLerpSpeed = lerp(this.currentLerpSpeed, this.lerpSpeed, 0.08);
    }

    if (this.orbitMode) {
      const a  = this.orbitProgress * Math.PI;
      const cx = this.orbitCenter.x + Math.sin(a) * this.orbitRadius;
      const cz = this.orbitCenter.z + Math.cos(a) * this.orbitRadius;
      const cy = this.orbitCenter.y + Math.sin(a * 0.5) * 20;

      this.camera.position.x = lerp(this.camera.position.x, cx + this.mouseOffsetX, this.currentLerpSpeed);
      this.camera.position.y = lerp(this.camera.position.y, cy + this.mouseOffsetY, this.currentLerpSpeed);
      this.camera.position.z = lerp(this.camera.position.z, cz, this.currentLerpSpeed);

      // LookAt suavizado hacia el centro del orbit
      this._lookAtY = lerp(this._lookAtY, this.orbitCenter.y, 0.07);
      this._lookAtZ = lerp(this._lookAtZ, this.orbitCenter.z, 0.07);
    } else {
      this.camera.position.x = lerp(this.camera.position.x, this.targetX + this.mouseOffsetX, this.currentLerpSpeed);
      this.camera.position.y = lerp(this.camera.position.y, this.targetY + this.mouseOffsetY, this.currentLerpSpeed);
      this.camera.position.z = lerp(this.camera.position.z, this.targetZ, this.currentLerpSpeed);

      // LookAt suavizado hacia adelante — nunca salta, siempre lerp
      this._lookAtY = lerp(this._lookAtY, 0, 0.05);
      this._lookAtZ = lerp(this._lookAtZ, this.targetZ - 100, 0.05);
    }

    this.camera.lookAt(0, this._lookAtY, this._lookAtZ);
  }
}
