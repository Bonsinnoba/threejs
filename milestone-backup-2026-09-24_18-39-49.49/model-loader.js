import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

export async function loadModel(path) {
    const gltf = await loader.loadAsync(path);
    return gltf.scene;
}
