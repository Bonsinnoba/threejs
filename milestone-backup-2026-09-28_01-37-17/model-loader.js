import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

export async function loadModel(path) {
  const gltf = await loader.loadAsync(path);
  return gltf.scene;
}

export function normalizeModel(object, targetHeight = 1.8) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);

  if (!maxDimension) return object;

  const scale = targetHeight / maxDimension;
  object.scale.multiplyScalar(scale);
  return object;
}
