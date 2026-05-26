// @ts-nocheck
// Disposer.js — Three.js geometry and material disposal tracker

export class Disposer {
  constructor() {
    this._registry = new Map(); // sectionId -> [disposables]
  }

  register(sectionId, object) {
    if (!this._registry.has(sectionId)) {
      this._registry.set(sectionId, []);
    }
    this._registry.get(sectionId).push(object);
  }

  flush(sectionId) {
    const items = this._registry.get(sectionId);
    if (!items) return;
    for (const item of items) {
      this._disposeObject(item);
    }
    this._registry.delete(sectionId);
  }

  flushAll() {
    for (const sectionId of this._registry.keys()) {
      this.flush(sectionId);
    }
  }

  _disposeObject(obj) {
    if (!obj) return;

    // Three.js geometry
    if (obj.isBufferGeometry || obj.isGeometry) {
      obj.dispose();
      return;
    }

    // Three.js material
    if (obj.isMaterial) {
      this._disposeMaterial(obj);
      return;
    }

    // Three.js texture
    if (obj.isTexture) {
      obj.dispose();
      return;
    }

    // Three.js mesh/object3D — traverse
    if (obj.isObject3D) {
      obj.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => this._disposeMaterial(m));
          } else {
            this._disposeMaterial(child.material);
          }
        }
      });
    }
  }

  _disposeMaterial(material) {
    if (!material) return;
    // Dispose all texture maps
    const mapKeys = [
      'map', 'lightMap', 'bumpMap', 'normalMap', 'displacementMap',
      'specularMap', 'envMap', 'alphaMap', 'aoMap', 'emissiveMap',
      'metalnessMap', 'roughnessMap',
    ];
    for (const key of mapKeys) {
      if (material[key]) material[key].dispose();
    }
    material.dispose();
  }
}
