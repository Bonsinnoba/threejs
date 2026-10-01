import * as THREE from 'three';
import './style.css';

const container = document.querySelector('#scene-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10151c);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(0, 5.5, 9);
camera.lookAt(0, 0.8, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x303846, 2.2));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
keyLight.position.set(4, 8, 5);
keyLight.castShadow = true;
scene.add(keyLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(14, 10),
  new THREE.MeshStandardMaterial({ color: 0x252d38, roughness: 0.9 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.01;
floor.receiveShadow = true;
scene.add(floor);

const bench = new THREE.Mesh(
  new THREE.BoxGeometry(7.5, 0.35, 3.8),
  new THREE.MeshStandardMaterial({ color: 0x6f7782, roughness: 0.65 })
);
bench.position.y = 0.1;
bench.castShadow = true;
bench.receiveShadow = true;
scene.add(bench);

const back = new THREE.Mesh(
  new THREE.BoxGeometry(7.5, 3.4, 0.25),
  new THREE.MeshStandardMaterial({ color: 0x3b4653 })
);
back.position.set(0, 1.7, -1.8);
scene.add(back);

const placedEquipment = [];
let dragging = null;
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3);
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

function resize() {
  const width = container.clientWidth;
  const height = container.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
window.addEventListener('resize', resize);
resize();

function createEquipment(type) {
  const group = new THREE.Group();
  group.userData.equipmentType = type;

  let body;
  if (type === 'beaker') {
    body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.45, 1.1, 32, 1, true),
      new THREE.MeshPhysicalMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0.55, roughness: 0.1 })
    );
    body.position.y = 0.55;
    group.add(body);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.045, 10, 32),
      new THREE.MeshStandardMaterial({ color: 0xd9f3ff })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.1;
    group.add(rim);
  } else if (type === 'flask') {
    body = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.68),
      new THREE.MeshStandardMaterial({ color: 0x9ad9ff, transparent: true, opacity: 0.62 })
    );
    body.position.y = 0.5;
    group.add(body);
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.25, 0.75, 24),
      new THREE.MeshStandardMaterial({ color: 0x9ad9ff, transparent: true, opacity: 0.62 })
    );
    neck.position.y = 1.0;
    group.add(neck);
  } else {
    body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.65, 1.3, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xc8e9ff, transparent: true, opacity: 0.6 })
    );
    body.position.y = 0.65;
    body.rotation.z = Math.PI;
    group.add(body);
  }

  group.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.userData.equipmentRoot = group;
    }
  });

  return group;
}

function addEquipment(type, position) {
  const object = createEquipment(type);
  object.position.copy(position);
  scene.add(object);
  placedEquipment.push(object);
  return object;
}

function pointerPosition(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  pointerPosition(event);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(placedEquipment, true);
  if (!hits.length) return;

  dragging = hits[0].object.userData.equipmentRoot;
  renderer.domElement.setPointerCapture(event.pointerId);
});

renderer.domElement.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  pointerPosition(event);
  raycaster.setFromCamera(pointer, camera);
  const point = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(dragPlane, point)) {
    dragging.position.x = THREE.MathUtils.clamp(point.x, -3.3, 3.3);
    dragging.position.z = THREE.MathUtils.clamp(point.z, -1.2, 1.2);
  }
});

renderer.domElement.addEventListener('pointerup', (event) => {
  dragging = null;
  if (renderer.domElement.hasPointerCapture(event.pointerId)) {
    renderer.domElement.releasePointerCapture(event.pointerId);
  }
});

document.querySelectorAll('.equipment-item').forEach((button) => {
  button.addEventListener('dragstart', () => {});
  button.addEventListener('click', () => {
    addEquipment(button.dataset.equipment, new THREE.Vector3(0, 0.3, 0));
  });
  button.setAttribute('draggable', 'true');
  button.addEventListener('dragend', () => {
    // The click fallback above keeps the equipment usable even when browser drag
    // events do not provide a reliable 3D drop position.
  });
});

const experimentDescriptions = {
  'hookes-law': "Hooke's Law: a future milestone will let you attach masses to a spring and measure extension.",
  'acid-base': 'Acid / Base Mixing: a future milestone will let you pick up, pour, mix, and observe a reaction.',
  circuit: 'Simple Circuit: a future milestone will let you connect a battery, resistor, switch, and bulb.'
};

document.querySelectorAll('.experiment-button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelector('#experiment-info').innerHTML = `<strong>${button.textContent}</strong><p>${experimentDescriptions[button.dataset.experiment]}</p>`;
  });
});

function animate() {
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
