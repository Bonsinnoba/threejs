// Non-glass apparatus (procedural). Each builder returns a Group whose origin is the bottom centre.
import * as THREE from 'three';

const steel = () => new THREE.MeshStandardMaterial({ color: 0xc4cbd0, metalness: 1, roughness: 0.3 });
const castIron = () => new THREE.MeshStandardMaterial({ color: 0x2a2f33, metalness: 0.5, roughness: 0.5 });

function put(g, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

/**
 * Retort stand with a boss-head clamp ring. Burette axis sits at (0.1, y, 0); the base has room for a tile or flask under it.
 * Attach points are declared in catalog.js (they must stay in sync with these numbers):
 *   clamp slot  -> local (0.1, 2.0, 0): the burette origin is its tip, the clamp grips ~3.0 above it, ring at y = 5.0
 *   base slot   -> local (0.1, 0.14, 0)
 */
export function buildRetortStand() {
  const g = new THREE.Group();
  put(g, new THREE.BoxGeometry(2.4, 0.14, 1.5), castIron(), 0, 0.07, 0);
  put(g, new THREE.CylinderGeometry(0.07, 0.07, 7.0, 16), steel(), -0.9, 3.5, 0);
  put(g, new THREE.BoxGeometry(0.26, 0.26, 0.26), steel(), -0.9, 5.0, 0);                       // boss head
  put(g, new THREE.CylinderGeometry(0.05, 0.05, 1.0, 12), steel(), -0.4, 5.0, 0).rotation.z = Math.PI / 2; // clamp arm
  put(g, new THREE.TorusGeometry(0.2, 0.045, 8, 24), steel(), 0.1, 5.0, 0).rotation.x = Math.PI / 2;      // clamp ring (axis vertical)
  put(g, new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10), steel(), -0.9, 5.0, 0.28).rotation.x = Math.PI / 2; // thumbscrew
  return g;
}

/** White tile (for seeing indicator colour changes). Top surface at y = 0.08. */
export function buildWhiteTile() {
  const g = new THREE.Group();
  put(g, new THREE.BoxGeometry(1.4, 0.08, 1.4), new THREE.MeshStandardMaterial({ color: 0xfdfdfb, roughness: 0.2 }), 0, 0.04, 0);
  return g;
}

/** Rubber pipette filler (bulb). */
export function buildPipetteFiller() {
  const g = new THREE.Group();
  const rubber = new THREE.MeshStandardMaterial({ color: 0xb3262d, roughness: 0.55 });
  const bulb = put(g, new THREE.SphereGeometry(0.3, 24, 16), rubber, 0, 0.62, 0);
  bulb.scale.set(1, 1.35, 1);
  put(g, new THREE.CylinderGeometry(0.08, 0.1, 0.3, 14), rubber, 0, 0.15, 0);
  put(g, new THREE.CylinderGeometry(0.06, 0.08, 0.2, 14), rubber, 0, 1.15, 0);
  return g;
}
