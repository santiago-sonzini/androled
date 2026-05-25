import * as THREE from 'three';

export class LightSystem {
  constructor(scene, sceneManager) {
    this.scene        = scene;
    this.sceneManager = sceneManager;

    this.ambient = new THREE.AmbientLight(0x0a0820, 0.4);
    this.scene.add(this.ambient);

    this.pt1 = new THREE.PointLight(0x4a47d4, 2.0, 300);
    this.pt1.position.set(60, 80, -50);
    this.scene.add(this.pt1);

    this.pt2 = new THREE.PointLight(0xc026a8, 1.5, 200);
    this.pt2.position.set(-40, -60, -100);
    this.scene.add(this.pt2);
  }

  spikeBloom(peak, settle, duration = 800) {
    const start = performance.now();
    const run = () => {
      const t = (performance.now()-start)/duration;
      if (t >= 1) { this.sceneManager.setBloomStrength(settle); return; }
      this.sceneManager.setBloomStrength(peak + (settle-peak)*t);
      requestAnimationFrame(run);
    };
    this.sceneManager.setBloomStrength(peak);
    requestAnimationFrame(run);
  }

  update(t) {
    this.pt1.position.x = Math.sin(t*0.2)*70;
    this.pt1.position.y = Math.cos(t*0.15)*50 + 40;
    this.pt2.position.x = Math.cos(t*0.18)*50 - 20;
    this.pt2.position.y = Math.sin(t*0.12)*40 - 30;
  }

  setColorSection(s) {
    const map = [
      [0x4a47d4, 0x1a1060],
      [0x6a58e8, 0xc026a8],
      [0x30b8e8, 0x8844cc],
      [0xff4444, 0x8800ff],
      [0xffffff, 0xffffff],
    ];
    if (map[s]) {
      this.pt1.color.setHex(map[s][0]);
      this.pt2.color.setHex(map[s][1]);
    }
  }
}
