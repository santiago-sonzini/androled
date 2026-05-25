import * as THREE from 'three';

const N_LINES  = 140;  // líneas para llenar la pantalla
const SEGS     = 64;   // puntos por línea
const LINE_LEN = 220;  // longitud en unidades 3D

export class LineField {
  constructor(scene) {
    this.scene = scene;

    this._opacity   = 0;
    this._dissolve  = 0;
    this._time      = 0;
    this._mouse     = new THREE.Vector2(0, 0);
    this._mouseVel  = 0;
    this._prevMouse = new THREE.Vector2(0, 0);

    this._palette = [
      new THREE.Color(0xff2222), new THREE.Color(0xff6600),
      new THREE.Color(0xffcc00), new THREE.Color(0x88ff00),
      new THREE.Color(0x00ffaa), new THREE.Color(0x00ccff),
      new THREE.Color(0x4488ff), new THREE.Color(0x8844ff),
      new THREE.Color(0xcc22ff), new THREE.Color(0xff22cc),
      new THREE.Color(0xff4488), new THREE.Color(0xffffff),
    ];

    this._lines = [];
    this._group = new THREE.Group();
    this._group.visible = false;
    this.scene.add(this._group);

    this._build();
    this._initMouse();
  }

  _build() {
    for (let i = 0; i < N_LINES; i++) {
      const ringIdx     = i % 12;
      const radius      = 18 + ringIdx * 4;
      const originAngle = (i / N_LINES) * Math.PI * 2 + Math.random() * 0.25;

      // Las líneas radian hacia afuera desde el ring de origen
      const travelAngle = originAngle + (Math.random() - 0.5) * 0.55;

      const wavePhase  = Math.random() * Math.PI * 2;
      const waveFreq   = 0.6 + Math.random() * 0.7;
      const waveAmp    = 1.8 + Math.random() * 2.8;
      const driftSpeed = 0.006 + Math.random() * 0.01;
      const driftDir   = Math.random() * Math.PI * 2;

      // Z posicionado delante de la cámara en section-2 (cámara ~-1200, mira hacia -1300)
      const zBase = -1420 + (Math.random() - 0.5) * 140;

      const col = this._palette[ringIdx].clone();
      col.multiplyScalar(0.6 + Math.random() * 0.4);

      const positions = new Float32Array((SEGS + 1) * 3);
      const geo = new THREE.BufferGeometry();
      const posAttr = new THREE.BufferAttribute(positions, 3);
      posAttr.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('position', posAttr);

      const idx = new Uint16Array(SEGS * 2);
      for (let s = 0; s < SEGS; s++) { idx[s*2] = s; idx[s*2+1] = s+1; }
      geo.setIndex(new THREE.BufferAttribute(idx, 1));

      const mat = new THREE.LineBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        linewidth: 1,
      });

      const mesh = new THREE.LineSegments(geo, mat);
      mesh.frustumCulled = false;
      this._group.add(mesh);

      this._lines.push({
        mesh, geo, mat, posAttr,
        radius, originAngle, travelAngle,
        wavePhase, waveFreq, waveAmp,
        driftSpeed, driftDir, zBase,
        col,
        driftX: 0, driftY: 0,
      });
    }
  }

  _initMouse() {
    window.addEventListener('mousemove', e => {
      const nx = (e.clientX / window.innerWidth)  * 2 - 1;
      const ny = -(e.clientY / window.innerHeight) * 2 + 1;
      const dx = nx - this._prevMouse.x;
      const dy = ny - this._prevMouse.y;
      this._mouseVel = Math.min(1.0, Math.sqrt(dx*dx + dy*dy) * 28);
      this._mouse.set(nx, ny);
      this._prevMouse.set(nx, ny);
    }, { passive: true });
  }

  update(t) {
    this._time = t;
    this._mouseVel *= 0.88;

    if (!this._group.visible) return;

    const dissolve = this._dissolve;
    const mouseStr = this._mouseVel;
    const mx       = this._mouse.x;
    const my       = this._mouse.y;

    for (let li = 0; li < this._lines.length; li++) {
      const ln = this._lines[li];

      ln.driftX = Math.cos(ln.driftDir) * ln.driftSpeed * t;
      ln.driftY = Math.sin(ln.driftDir) * ln.driftSpeed * t;

      // Origen en el ring (simetría plena, sin factor 0.5 en Y)
      const ox = Math.cos(ln.originAngle) * ln.radius + ln.driftX * dissolve;
      const oy = Math.sin(ln.originAngle) * ln.radius + ln.driftY * dissolve;
      const oz = ln.zBase;

      const tx = Math.cos(ln.travelAngle);
      const ty = Math.sin(ln.travelAngle);
      // Perpendicular para la onda
      const px = -ty;
      const py =  tx;

      const pos = ln.posAttr.array;
      const len = LINE_LEN * dissolve;

      for (let s = 0; s <= SEGS; s++) {
        const frac = s / SEGS;
        const dist = frac * len;

        let px3 = ox + tx * dist;
        let py3 = oy + ty * dist;
        // Leve profundidad Z para dar volumen
        const pz3 = oz + (frac - 0.5) * 22;

        // Onda sinusoidal que anima en el tiempo
        const waveAmp = ln.waveAmp * Math.min(1, dissolve * 1.5);
        const wave = Math.sin(
          frac * ln.waveFreq * Math.PI * 4.5
          + t * 0.55
          + ln.wavePhase
        ) * waveAmp;
        px3 += px * wave;
        py3 += py * wave;

        // Perturbación por mouse — onda radial expandiéndose desde el cursor
        const ndcX = px3 / 110;
        const ndcY = py3 / 75;
        const dMx  = ndcX - mx;
        const dMy  = ndcY - my;
        const dMag = Math.sqrt(dMx*dMx + dMy*dMy) + 0.001;
        const mouseWave = Math.sin(dMag * 5.5 - t * 2.8) * Math.exp(-dMag * 1.8);
        const mStr = mouseStr * 10.0 * dissolve;
        px3 += (dMx / dMag) * mouseWave * mStr;
        py3 += (dMy / dMag) * mouseWave * mStr;

        pos[s * 3]     = px3;
        pos[s * 3 + 1] = py3;
        pos[s * 3 + 2] = pz3;
      }

      ln.posAttr.needsUpdate = true;
      ln.geo.computeBoundingSphere();

      // Fade-in suave ligado al dissolve
      ln.mat.opacity = this._opacity * Math.min(1, dissolve * 2.2) * 0.8;
    }
  }

  setDissolve(v) { this._dissolve = Math.max(0, Math.min(1, v)); }
  setOpacity(v)  { this._opacity  = Math.max(0, Math.min(1, v)); }
  show()         { this._group.visible = true;  }
  hide()         { this._group.visible = false; }

  dispose() {
    for (const ln of this._lines) {
      ln.geo.dispose();
      ln.mat.dispose();
    }
    this.scene.remove(this._group);
  }
}
