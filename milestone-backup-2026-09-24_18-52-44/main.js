import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.querySelector('#lab-canvas');
const lab = document.querySelector('.lab');
const instructions = document.querySelector('#instructions');
const experimentControls = document.querySelector('#experiment-controls');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdbe4e8);

const camera = new THREE.PerspectiveCamera(55, lab.clientWidth / lab.clientHeight, 0.1, 100);
camera.position.set(5.5, 5.5, 7);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(lab.clientWidth, lab.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.2, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2.05;

scene.add(new THREE.HemisphereLight(0xffffff, 0x64748b, 2.2));
const light = new THREE.DirectionalLight(0xffffff, 2.5);
light.position.set(4, 8, 5);
light.castShadow = true;
scene.add(light);

// Laboratory environment
const bench = new THREE.Mesh(
  new THREE.BoxGeometry(10, 0.6, 6),
  new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.75 })
);
bench.receiveShadow = true;
scene.add(bench);

const wall = new THREE.Mesh(
  new THREE.BoxGeometry(10, 5, 0.25),
  new THREE.MeshStandardMaterial({ color: 0xf1f5f9 })
);
wall.position.set(0, 2.5, -3);
wall.receiveShadow = true;
scene.add(wall);

const grid = new THREE.GridHelper(10, 20, 0x64748b, 0x94a3b8);
grid.position.y = 0.32;
scene.add(grid);

const equipment = [];
let selected = null;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.45);
const dragPoint = new THREE.Vector3();

function addToEquipment(group, type) {
  group.userData.equipmentType = type;
  group.traverse(object => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return group;
}

function makeEquipment(type) {
  const group = new THREE.Group();

  if (type === 'beaker') {
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.58, 1.25, 32, 1, true),
      new THREE.MeshPhysicalMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.45 })
    );
    body.position.y = 0.95;
    group.add(body);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.64, 0.045, 10, 32),
      new THREE.MeshStandardMaterial({ color: 0xdbeafe })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.58;
    group.add(rim);
  }

  if (type === 'flask') {
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 32, 16),
      new THREE.MeshStandardMaterial({ color: 0xc7e9ff, transparent: true, opacity: 0.55 })
    );
    body.position.y = 0.9;
    group.add(body);

    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.34, 1, 24),
      new THREE.MeshStandardMaterial({ color: 0xc7e9ff, transparent: true, opacity: 0.55 })
    );
    neck.position.y = 1.65;
    group.add(neck);
  }

  if (type === 'test-tube') {
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 1.6, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.55 })
    );
    tube.position.y = 1.1;
    group.add(tube);
  }

  if (type === 'ruler') {
    const ruler = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.08, 0.35),
      new THREE.MeshStandardMaterial({ color: 0xf4d06f })
    );
    ruler.position.y = 0.48;
    group.add(ruler);

    for (let i = 0; i <= 16; i++) {
      const mark = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, 0.12, i % 2 === 0 ? 0.22 : 0.14),
        new THREE.MeshStandardMaterial({ color: 0x1f2937 })
      );
      mark.position.set(-1.5 + i * 0.2, 0.57, 0);
      group.add(mark);
    }
  }

  return addToEquipment(group, type);
}

function addEquipment(type) {
  const object = makeEquipment(type);
  const index = equipment.length;
  object.position.set(-3 + (index % 3) * 2.5, 0, -1 + Math.floor(index / 3) * 1.7);
  scene.add(object);
  equipment.push(object);
}

// ---------------- Hooke's Law experiment ----------------
const hooke = {
  active: true,
  spring: null,
  masses: [],
  pendingMass: null,
  support: null,
  massCount: 0,
  massPerUnit: 0.1, // kg
  springConstant: 19.6, // N/m
  naturalLength: 1.35,
  minLength: 0.75,
  maxLength: 2.55,
};

function makeSpringCurve(length) {
  const points = [];
  const turns = 18;
  const radius = 0.23;
  const topY = 3.35;
  const bottomY = topY - length;

  for (let i = 0; i <= turns * 12; i++) {
    const t = i / (turns * 12);
    const angle = t * Math.PI * 2 * turns;
    points.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      topY - t * length,
      Math.sin(angle) * radius
    ));
  }

  return new THREE.CatmullRomCurve3(points);
}

function createSpring(length = hooke.naturalLength) {
  const geometry = new THREE.TubeGeometry(makeSpringCurve(length), 220, 0.035, 8, false);
  const material = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.28 });
  const spring = new THREE.Mesh(geometry, material);
  spring.userData.isHookeObject = true;
  return spring;
}

function createMass() {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.28, 32),
    new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.55,
      roughness: 0.35
    })
  );
  body.castShadow = true;
  group.add(body);

  const hook = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.035, 10, 24),
    new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.7,
      roughness: 0.25
    })
  );
  hook.position.y = 0.19;
  hook.rotation.x = Math.PI / 2;
  group.add(hook);

  group.userData.isHookeMass = true;
  group.userData.attached = false;
  return group;
}

function createHookeSupport() {
  const group = new THREE.Group();

  const post = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 3.9, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.65, roughness: 0.3 })
  );
  post.position.set(0, 2.25, 0);
  group.add(post);

  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.14, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.65, roughness: 0.3 })
  );
  arm.position.set(0.55, 4.05, 0);
  group.add(arm);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.12, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.4 })
  );
  base.position.set(0, 0.4, 0);
  group.add(base);

  group.userData.isHookeObject = true;
  return group;
}

function setupHooke() {
  clearHooke();

  hooke.support = createHookeSupport();
  scene.add(hooke.support);

  hooke.spring = createSpring(hooke.naturalLength);
  scene.add(hooke.spring);

  hooke.masses = [];
  hooke.pendingMass = null;
  hooke.massCount = 0;

  updateHooke();
  updateHookeUI();
}

function clearHooke() {
  if (hooke.spring) scene.remove(hooke.spring);
  if (hooke.support) scene.remove(hooke.support);

  hooke.masses.forEach(mass => scene.remove(mass));
  if (hooke.pendingMass) scene.remove(hooke.pendingMass);

  hooke.spring = null;
  hooke.support = null;
  hooke.masses = [];
  hooke.pendingMass = null;
  hooke.massCount = 0;
}

function getHookeMeasurements() {
  const massKg = hooke.massCount * hooke.massPerUnit;
  const force = massKg * 9.81;
  const extension = force / hooke.springConstant;
  return { massKg, force, extension };
}

function updateHooke() {
  if (!hooke.spring) return;

  const { extension } = getHookeMeasurements();
  const length = THREE.MathUtils.clamp(
    hooke.naturalLength + extension,
    hooke.minLength,
    hooke.maxLength
  );

  scene.remove(hooke.spring);
  hooke.spring.geometry.dispose();
  hooke.spring = createSpring(length);
  scene.add(hooke.spring);

  const bottomY = 3.35 - length;

  hooke.masses.forEach((mass, index) => {
    mass.position.set(0, bottomY - 0.25 - index * 0.32, 0);
  });
}

function updateHookeUI() {
  const { massKg, force, extension } = getHookeMeasurements();

  const set = (selector, value) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  };

  set('#mass-count', hooke.massCount);
  set('#mass-value', `${Math.round(massKg * 1000)} g`);
  set('#force-value', `${force.toFixed(2)} N`);
  set('#extension-value', `${(extension * 100).toFixed(1)} cm`);
  set(
    '#pending-mass',
    hooke.pendingMass ? 'Drag the mass to the spring' : 'No mass waiting'
  );
}

function createPendingMass() {
  if (hooke.pendingMass || hooke.massCount >= 5) return;

  const mass = createMass();
  mass.position.set(-2.1, 0.72, 0);
  scene.add(mass);
  hooke.pendingMass = mass;
  updateHookeUI();
}

function attachPendingMass() {
  if (!hooke.pendingMass || hooke.massCount >= 5) return;

  const mass = hooke.pendingMass;
  mass.userData.attached = true;
  hooke.masses.push(mass);
  hooke.pendingMass = null;
  hooke.massCount += 1;

  updateHooke();
  updateHookeUI();
}

function removeMass() {
  if (!hooke.massCount) return;

  const mass = hooke.masses.pop();
  scene.remove(mass);
  hooke.massCount -= 1;

  updateHooke();
  updateHookeUI();
}

function resetHooke() {
  hooke.masses.forEach(mass => scene.remove(mass));
  if (hooke.pendingMass) scene.remove(hooke.pendingMass);

  hooke.masses = [];
  hooke.pendingMass = null;
  hooke.massCount = 0;

  updateHooke();
  updateHookeUI();
}

function showHookeControls() {
  experimentControls.innerHTML = `
    <div class="control-title">Hooke's Law controls</div>
    <div class="control-row">
      <button id="add-mass" class="control-button primary">+ Get 100 g mass</button>
      <button id="remove-mass" class="control-button">− Remove</button>
    </div>
    <div class="drag-status" id="pending-mass">No mass waiting</div>
    <div class="measurement-grid">
      <div><span>Masses attached</span><strong id="mass-count">0</strong></div>
      <div><span>Total mass</span><strong id="mass-value">0 g</strong></div>
      <div><span>Force</span><strong id="force-value">0.00 N</strong></div>
      <div><span>Extension</span><strong id="extension-value">0.0 cm</strong></div>
    </div>
    <div class="equation">
      <span>F = kx</span>
      <small>Spring constant k = ${hooke.springConstant.toFixed(1)} N/m</small>
    </div>
    <button id="reset-hooke" class="control-button reset-experiment">Reset experiment</button>
  `;

  document.querySelector('#add-mass').addEventListener('click', createPendingMass);
  document.querySelector('#remove-mass').addEventListener('click', removeMass);
  document.querySelector('#reset-hooke').addEventListener('click', resetHooke);

  updateHookeUI();
}

function activateHooke() {
  hooke.active = true;
  setupHooke();

  instructions.innerHTML = `
    <h2>Hooke's Law</h2>
    <p>Investigate how the extension of a spring changes when a load is added.</p>
    <ol>
      <li>Click <strong>Get 100 g mass</strong>.</li>
      <li>Drag the mass from the bench to the spring.</li>
      <li>Drop it near the spring to attach it.</li>
      <li>Add more masses and compare force with extension.</li>
    </ol>
  `;

  showHookeControls();
}

// Pointer interaction for equipment and the Hooke mass.
function setPointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

renderer.domElement.addEventListener('pointerdown', event => {
  setPointer(event);
  raycaster.setFromCamera(pointer, camera);

  const targets = [...equipment];
  if (hooke.pendingMass) targets.push(hooke.pendingMass);

  const hits = raycaster.intersectObjects(targets, true);
  if (!hits.length) return;

  selected = hits[0].object;

  while (
    selected.parent &&
    !selected.userData.equipmentType &&
    !selected.userData.isHookeMass
  ) {
    selected = selected.parent;
  }

  controls.enabled = false;
});

renderer.domElement.addEventListener('pointermove', event => {
  if (!selected) return;

  setPointer(event);
  raycaster.setFromCamera(pointer, camera);

  if (selected.userData.isHookeMass && !selected.userData.attached) {
    if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
      selected.position.x = dragPoint.x;
      selected.position.z = dragPoint.z;
      selected.position.y = 0.72;
    }
    return;
  }

  if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
    selected.position.x = dragPoint.x;
    selected.position.z = dragPoint.z;
  }
});

window.addEventListener('pointerup', () => {
  if (selected?.userData?.isHookeMass && !selected.userData.attached) {
    const nearSpring =
      Math.abs(selected.position.x) < 0.8 &&
      Math.abs(selected.position.z) < 0.8;

    if (nearSpring && selected === hooke.pendingMass) {
      attachPendingMass();
    }
  }

  selected = null;
  controls.enabled = true;
});

window.addEventListener('resize', () => {
  camera.aspect = lab.clientWidth / lab.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(lab.clientWidth, lab.clientHeight);
});

document.querySelectorAll('[data-equipment]').forEach(button => {
  button.addEventListener('click', () => addEquipment(button.dataset.equipment));
});

const experiments = {
  hooke: {
    title: "Hooke's Law",
    description: 'Investigate how a spring responds to increasing loads.',
  },
  'acid-base': {
    title: 'Acid / Base',
    description: 'Prototype workflow for a guided chemistry practical.',
    steps: ['Place a beaker.', 'Add reagent models when available.', 'Mix the contents and record the observation.'],
  },
  circuit: {
    title: 'Simple Circuit',
    description: 'Prototype workflow for an interactive electricity practical.',
    steps: ['Place the circuit components.', 'Connect the components.', 'Toggle the switch and observe the bulb.'],
  },
};

document.querySelectorAll('[data-experiment]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.experiment').forEach(item => item.classList.remove('active'));
    button.classList.add('active');

    const id = button.dataset.experiment;
    const data = experiments[id];

    if (id === 'hooke') {
      activateHooke();
      return;
    }

    clearHooke();
    experimentControls.innerHTML = '';
    instructions.innerHTML = `
      <h2>${data.title}</h2>
      <p>${data.description}</p>
      <ol>${data.steps.map(step => `<li>${step}</li>`).join('')}</ol>
    `;
  });
});

document.querySelector('#reset').addEventListener('click', () => {
  for (const object of equipment) scene.remove(object);
  equipment.length = 0;
  selected = null;
  activateHooke();
});

activateHooke();

function animate() {
  controls.update();
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
