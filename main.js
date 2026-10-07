import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadModel, normalizeModel, setupModelShadows, cloneModel } from './model-loader.js';
import {
  createPhysicsWorld,
  createSpringSystem,
  addSpringSystemToWorld,
  updateSpringMass,
  resetSpringSystem,
  removeSpringSystemFromWorld,
  stepPhysics,
  syncMeshToBody
} from './physics.js';

const canvas = document.querySelector('#lab-canvas');
const lab = document.querySelector('.lab');
const instructions = document.querySelector('#instructions');
const experimentControls = document.querySelector('#experiment-controls');
const experimentSelect = document.getElementById('experiment-select');
const leftSidebar = document.getElementById('left-sidebar');
const rightSidebar = document.getElementById('right-sidebar');
const toggleLeftBtn = document.getElementById('toggle-left-sidebar');
const toggleRightBtn = document.getElementById('toggle-right-sidebar');
const app = document.querySelector('.app');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdbe4e8);

const camera = new THREE.PerspectiveCamera(55, lab.clientWidth / lab.clientHeight, 0.1, 100);
camera.position.set(5.5, 5.5, 7);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(lab.clientWidth, lab.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// cannon-es owns the physical simulation; Three.js only visualizes it.
const physicsWorld = createPhysicsWorld();
const physicsSystems = [];

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.2, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2.05;
const standardCameraPosition = camera.position.clone();
const standardCameraUp = camera.up.clone();

function setCircuitCamera(active) {
  if (active) {
    camera.up.copy(standardCameraUp);
    camera.position.set(0, 10, 1.8);
  } else {
    camera.up.copy(standardCameraUp);
    camera.position.copy(standardCameraPosition);
  }
  controls.target.set(0, 1.2, 0);
  camera.lookAt(controls.target);
  controls.update();
}

scene.add(new THREE.HemisphereLight(0xffffff, 0x64748b, 2.2));
const light = new THREE.DirectionalLight(0xffffff, 2.5);
light.position.set(4, 8, 5);
light.castShadow = true;
scene.add(light);

// Create a more realistic lab workbench
const benchGroup = new THREE.Group();

// Main tabletop
const benchTop = new THREE.Mesh(
  new THREE.BoxGeometry(12, 0.4, 8),
  new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.6 })
);
benchTop.position.y = 1.0;
benchTop.receiveShadow = true;
benchTop.castShadow = true;
benchGroup.add(benchTop);

// Add wooden texture detail with slight variation
const benchDetail = new THREE.Mesh(
  new THREE.BoxGeometry(11.8, 0.35, 7.8),
  new THREE.MeshStandardMaterial({ color: 0x7a6248, roughness: 0.7 })
);
benchDetail.position.y = 0.95;
benchGroup.add(benchDetail);

// Legs
const legPositions = [
  [-5.2, 0.5, -3.5],
  [5.2, 0.5, -3.5],
  [-5.2, 0.5, 3.5],
  [5.2, 0.5, 3.5]
];

const legMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.8 });
legPositions.forEach(pos => {
  const leg = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 1.0, 0.3),
    legMaterial
  );
  leg.position.set(...pos);
  leg.castShadow = true;
  leg.receiveShadow = true;
  benchGroup.add(leg);
});

// Bottom shelf
const shelf = new THREE.Mesh(
  new THREE.BoxGeometry(11, 0.15, 7),
  new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.65 })
);
shelf.position.y = 0.4;
shelf.receiveShadow = true;
shelf.castShadow = true;
benchGroup.add(shelf);

scene.add(benchGroup);

const wall = new THREE.Mesh(
  new THREE.BoxGeometry(12, 5, 0.25),
  new THREE.MeshStandardMaterial({ color: 0xf1f5f9 })
);
wall.position.set(0, 2.5, -4);
wall.receiveShadow = true;
scene.add(wall);

const grid = new THREE.GridHelper(12, 24, 0x64748b, 0x94a3b8);
grid.position.y = 0.42;
scene.add(grid);

const equipment = [];
let selected = null;
let selectedEquipmentForRemoval = null;
let selectedCircuitComponent = null;
let flaskModel = null;
let flaskLoadPromise = null;
let bunsenBurnerModel = null;
let testTubeRackModel = null;
let tripodStandModel = null;
let funnelModel = null;
const previewModels = {
  flask: './models/erlenmeyer-flask.glb',
  'bunsen-burner': './virtual labs/bunsen_burner.glb',
  'test-tube-rack': './virtual labs/test_tube_rack.glb',
  'tripod-stand': './virtual labs/tripod_stand.glb',
  funnel: './virtual labs/cc0_-_funnel_3.glb'
};
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.0);
const dragPoint = new THREE.Vector3();

function updateEquipmentCardSelection() {
  document.querySelectorAll('.equipment-card').forEach(card => {
    const isSelected = selectedEquipmentForRemoval &&
      selectedEquipmentForRemoval.userData.equipmentType === card.dataset.equipment &&
      equipment.includes(selectedEquipmentForRemoval);
    card.classList.toggle('is-selected', Boolean(isSelected));
    card.setAttribute('aria-label', `${card.querySelector('.equipment-card-label').textContent}. ${isSelected ? 'Selected on workspace.' : 'Click to add or drag to workspace.'}`);
    card.querySelector('.equipment-remove').hidden = !isSelected;
  });
}

function selectEquipmentForRemoval(object) {
  selectedEquipmentForRemoval = object && equipment.includes(object) ? object : null;
  updateEquipmentCardSelection();
}

function removeEquipmentObject(object) {
  const index = equipment.indexOf(object);
  if (index < 0) return;

  scene.remove(object);
  equipment.splice(index, 1);
  if (selected === object) selected = null;
  const nextSelection = selectedEquipmentForRemoval === object
    ? [...equipment].reverse().find(item => item.userData.equipmentType === object.userData.equipmentType) ?? null
    : selectedEquipmentForRemoval;
  selectEquipmentForRemoval(nextSelection);
}

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

async function loadRealFlask() {
  if (flaskModel) return flaskModel;
  if (flaskLoadPromise) return flaskLoadPromise;

  flaskLoadPromise = loadModel('./virtual labs/Erlenmeyer flask by Poly by Google - advGpqPqy0P.glb')
    .then(model => {
      normalizeModel(model, 1.65);
      model.userData.equipmentType = 'flask';
      setupModelShadows(model);
      flaskModel = model;
      return model;
    })
    .catch(error => {
      console.error('Could not load Erlenmeyer flask GLB:', error);
      flaskLoadPromise = null;
      return null;
    });

  return flaskLoadPromise;
}



async function loadBunsenBurner() {
  if (bunsenBurnerModel) return bunsenBurnerModel;

  bunsenBurnerModel = await loadModel('./virtual labs/bunsen_burner.glb')
    .then(model => {
      normalizeModel(model, 1.2);
      setupModelShadows(model);
      return model;
    })
    .catch(error => {
      console.error('Could not load bunsen burner GLB:', error);
      return null;
    });

  return bunsenBurnerModel;
}

async function loadTestTubeRack() {
  if (testTubeRackModel) return testTubeRackModel;

  testTubeRackModel = await loadModel('./virtual labs/test_tube_rack.glb')
    .then(model => {
      normalizeModel(model, 1.0);
      setupModelShadows(model);
      return model;
    })
    .catch(error => {
      console.error('Could not load test tube rack GLB:', error);
      return null;
    });

  return testTubeRackModel;
}

async function loadTripodStand() {
  if (tripodStandModel) return tripodStandModel;

  tripodStandModel = await loadModel('./virtual labs/tripod_stand.glb')
    .then(model => {
      normalizeModel(model, 1.1);
      setupModelShadows(model);
      return model;
    })
    .catch(error => {
      console.error('Could not load tripod stand GLB:', error);
      return null;
    });

  return tripodStandModel;
}

async function loadFunnel() {
  if (funnelModel) return funnelModel;

  funnelModel = await loadModel('./virtual labs/cc0_-_funnel_3.glb')
    .then(model => {
      normalizeModel(model, 0.5);
      setupModelShadows(model);
      return model;
    })
    .catch(error => {
      console.error('Could not load funnel GLB:', error);
      return null;
    });

  return funnelModel;
}

async function loadConicalFlask() {
  if (chemistry.conicalFlaskModel) return chemistry.conicalFlaskModel;

  chemistry.conicalFlaskModel = await loadModel('./virtual labs/conical_flask.glb')
    .then(model => {
      normalizeModel(model, 1.4);
      groundCircuitModel(model);
      setupModelShadows(model);
      return model;
    })
    .catch(error => {
      console.error('Could not load conical flask GLB:', error);
      return null;
    });

  return chemistry.conicalFlaskModel;
}

async function loadCircuitModels() {
  if (circuit.batteryModel && circuit.resistorModel && circuit.switchModel) {
    return { battery: circuit.batteryModel, resistor: circuit.resistorModel, switch: circuit.switchModel };
  }

  const [battery, resistor, switchModel] = await Promise.all([
    loadModel('./virtual labs/aa_battery.glb').then(m => {
      normalizeModel(m, 0.6);
      groundCircuitModel(m);
      setupModelShadows(m);
      circuit.batteryModel = m;
      return m;
    }).catch(() => null),
    loadModel('./virtual labs/10k_ohm_resistor.glb').then(m => {
      normalizeModel(m, 0.35);
      groundCircuitModel(m);
      setupModelShadows(m);
      circuit.resistorModel = m;
      return m;
    }).catch(() => null),
    loadModel('./virtual labs/switch.glb').then(m => {
      normalizeModel(m, 0.35);
      groundCircuitModel(m);
      setupModelShadows(m);
      circuit.switchModel = m;
      return m;
    }).catch(() => null)
  ]);

  return { battery, resistor, switch: switchModel };
}

function groundCircuitModel(model) {
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y -= bounds.min.y;
  model.position.z -= center.z;
  return model;
}

async function addFlask() {
  const model = await loadRealFlask();
  if (!model) {
    addEquipment('flask');
    return;
  }
  const flask = model.clone(true);
  addToEquipment(flask, 'flask');
  const index = equipment.length;
  flask.position.set(-3 + (index % 3) * 2.5, 1.0, -1 + Math.floor(index / 3) * 1.7);
  scene.add(flask);
  equipment.push(flask);
  selectEquipmentForRemoval(flask);
}

function makeEquipment(type) {
  const group = new THREE.Group();

  if (type === 'beaker') {
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.58, 1.25, 32, 1, true),
      new THREE.MeshPhysicalMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.45 })
    );
    body.position.y = 0.625;
    group.add(body);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.64, 0.045, 10, 32),
      new THREE.MeshStandardMaterial({ color: 0xdbeafe })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.25;
    group.add(rim);
  }

  if (type === 'flask') {
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 32, 16),
      new THREE.MeshStandardMaterial({ color: 0xc7e9ff, transparent: true, opacity: 0.55 })
    );
    body.position.y = 0.35;
    group.add(body);

    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.34, 1, 24),
      new THREE.MeshStandardMaterial({ color: 0xc7e9ff, transparent: true, opacity: 0.55 })
    );
    neck.position.y = 1.1;
    group.add(neck);
  }

  if (type === 'test-tube') {
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 1.6, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.55 })
    );
    tube.position.y = 0.8;
    group.add(tube);
  }

  if (type === 'ruler') {
    const ruler = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.08, 0.35),
      new THREE.MeshStandardMaterial({ color: 0xf4d06f })
    );
    ruler.position.y = 0.04;
    group.add(ruler);
    for (let i = 0; i <= 16; i++) {
      const mark = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, 0.12, i % 2 === 0 ? 0.22 : 0.14),
        new THREE.MeshStandardMaterial({ color: 0x1f2937 })
      );
      mark.position.set(-1.5 + i * 0.2, 0.13, 0);
      group.add(mark);
    }
  }

  return addToEquipment(group, type);
}

async function addRealEquipment(type) {
  let model = null;

  if (type === 'bunsen-burner') {
    model = await loadBunsenBurner();
  } else if (type === 'test-tube-rack') {
    model = await loadTestTubeRack();
  } else if (type === 'tripod-stand') {
    model = await loadTripodStand();
  } else if (type === 'funnel') {
    model = await loadFunnel();
  }

  if (model) {
    const equipmentModel = cloneModel(model);
    addToEquipment(equipmentModel, type);
    const index = equipment.length;
    let yPos = 1.0;
    if (type === 'tripod-stand') yPos = 0.5;
    if (type === 'test-tube-rack') yPos = 0.5;
    if (type === 'funnel') yPos = 1.2;
    equipmentModel.position.set(-3 + (index % 3) * 2.5, yPos, -1 + Math.floor(index / 3) * 1.7);
    scene.add(equipmentModel);
    equipment.push(equipmentModel);
    selectEquipmentForRemoval(equipmentModel);
  } else {
    // Fallback to abstract equipment
    addEquipment(type);
  }
}

function addEquipment(type) {
  const object = makeEquipment(type);
  const index = equipment.length;
  let yPos = 1.2;
  if (type === 'beaker') yPos = 1.0;
  if (type === 'flask') yPos = 1.0;
  if (type === 'test-tube') yPos = 1.0;
  if (type === 'ruler') yPos = 1.0;
  object.position.set(-3 + (index % 3) * 2.5, yPos, -1 + Math.floor(index / 3) * 1.7);
  scene.add(object);
  equipment.push(object);
  selectEquipmentForRemoval(object);
}

function setupEquipmentPreview(card) {
  const type = card.dataset.equipment;
  const modelPath = previewModels[type];
  const previewHost = card.querySelector('.equipment-preview');
  if (!previewHost || !modelPath) return;

  const canvas = document.createElement('canvas');
  previewHost.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0.9, 2.8);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(previewHost.clientWidth, previewHost.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const ambient = new THREE.HemisphereLight(0xffffff, 0x364152, 1.8);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
  keyLight.position.set(2, 3, 3);
  scene.add(keyLight);

  loadModel(modelPath)
    .then(asset => {
      const model = cloneModel(asset);
      normalizeModel(model, 1.25);
      setupModelShadows(model);
      model.rotation.y = -0.8;
      scene.add(model);
      renderer.render(scene, camera);
    })
    .catch(error => {
      console.error(`Could not load equipment preview for ${type}:`, error);
    });

  const resizeObserver = new ResizeObserver(() => {
    const width = previewHost.clientWidth || 64;
    const height = previewHost.clientHeight || 72;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  });
  resizeObserver.observe(previewHost);
}

function getBenchDropPoint(event) {
  const rect = lab.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hitPoint = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
    return null;
  }
  return hitPoint;
}

async function addEquipmentAtWorkbenchLocation(type, x, z) {
  if (type === 'flask') {
    const model = await loadRealFlask();
    if (model) {
      const flask = cloneModel(model);
      addToEquipment(flask, 'flask');
      flask.position.set(x, 1.0, z);
      scene.add(flask);
      equipment.push(flask);
      selectEquipmentForRemoval(flask);
      return;
    }
  }

  if (['bunsen-burner', 'test-tube-rack', 'tripod-stand', 'funnel'].includes(type)) {
    const model = await (type === 'bunsen-burner'
      ? loadBunsenBurner()
      : type === 'test-tube-rack'
        ? loadTestTubeRack()
        : type === 'tripod-stand'
          ? loadTripodStand()
          : loadFunnel());

    if (model) {
      const equipmentModel = cloneModel(model);
      addToEquipment(equipmentModel, type);
      let yPos = 1.0;
      if (type === 'tripod-stand') yPos = 0.5;
      if (type === 'test-tube-rack') yPos = 0.5;
      if (type === 'funnel') yPos = 1.2;
      equipmentModel.position.set(x, yPos, z);
      scene.add(equipmentModel);
      equipment.push(equipmentModel);
      selectEquipmentForRemoval(equipmentModel);
      return;
    }
  }

  const object = makeEquipment(type);
  const yPos = type === 'ruler' ? 1.0 : 1.2;
  object.position.set(x, yPos, z);
  scene.add(object);
  equipment.push(object);
  selectEquipmentForRemoval(object);
}

// ---------------- Hooke's Law experiment ----------------
const hooke = {
  active: true,
  spring: null,
  masses: [],
  pendingMass: null,
  support: null,
  massCount: 0,
  massPerUnit: 0.1,
  springConstant: 19.6,
  naturalLength: 1.35,
  minLength: 0.75,
  maxLength: 2.55,
  physicsSystem: null,
  physicsLoadMarker: new THREE.Object3D(),
};

function makeSpringCurve(length) {
  const points = [];
  const turns = 18;
  const radius = 0.23;
  const topY = 4.55;
  const anchorX = 2.1;
  for (let i = 0; i <= turns * 12; i++) {
    const t = i / (turns * 12);
    const angle = t * Math.PI * 2 * turns;
    points.push(new THREE.Vector3(anchorX + Math.cos(angle) * radius, topY - t * length, Math.sin(angle) * radius));
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
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.28, 32), new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.55, roughness: 0.35 }));
  body.position.y = 0;
  body.castShadow = true;
  group.add(body);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 10, 24), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.25 }));
  hook.position.y = 0.19;
  hook.rotation.x = Math.PI / 2;
  group.add(hook);
  group.userData.isHookeMass = true;
  group.userData.attached = false;
  return group;
}

function createHookeSupport() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.65, roughness: 0.3 });
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.9, 0.18), metal);
  post.position.set(0, 2.25, 0);
  group.add(post);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.14), metal);
  arm.position.set(0.55, 4.05, 0);
  group.add(arm);
  const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.18, 16), metal);
  hanger.position.set(1.05, 3.95, 0);
  group.add(hanger);
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 1.1), new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.4 }));
  base.position.set(0, 0.6, 0);
  group.add(base);
  group.userData.isHookeObject = true;
  group.position.set(1.05, 0.6, 0);
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
  destroyHookePhysicsSystem();
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

function createHookePhysicsSystem() {
  const anchorPosition = {
    x: 2.1,
    y: 4.55,
    z: 0
  };

  const system = createSpringSystem({
    massKg: hooke.massCount * hooke.massPerUnit,
    anchorPosition,
    initialPosition: {
      x: anchorPosition.x,
      y: anchorPosition.y - hooke.naturalLength,
      z: anchorPosition.z
    },
    restLength: hooke.naturalLength,
    stiffness: hooke.springConstant,
    damping: 1.15
  });

  addSpringSystemToWorld(physicsWorld, system);
  physicsSystems.push(system);
  hooke.physicsSystem = system;
  return system;
}

function destroyHookePhysicsSystem() {
  const system = hooke.physicsSystem;
  if (!system) return;

  removeSpringSystemFromWorld(physicsWorld, system);

  const index = physicsSystems.indexOf(system);
  if (index !== -1) {
    physicsSystems.splice(index, 1);
  }

  hooke.physicsSystem = null;
}

function syncHookePhysics() {
  const system = hooke.physicsSystem;
  if (!system || !hooke.spring) return;

  // The physics body represents the combined load.
  syncMeshToBody(hooke.physicsLoadMarker, system.load);

  const simulatedLength = Math.max(
    0.05,
    system.anchor.position.y - system.load.position.y
  );

  const visualLength = THREE.MathUtils.clamp(
    simulatedLength,
    hooke.minLength,
    hooke.maxLength
  );

  scene.remove(hooke.spring);
  hooke.spring.geometry.dispose();
  hooke.spring = createSpring(visualLength);
  scene.add(hooke.spring);

  // Stack the visible 100 g masses around the simulated load position.
  hooke.masses.forEach((mass, index) => {
    mass.position.set(
      system.load.position.x,
      system.load.position.y - index * 0.32,
      system.load.position.z
    );
  });
}

function updateHookePhysicsMass() {
  if (!hooke.physicsSystem) return;

  updateSpringMass(
    hooke.physicsSystem,
    Math.max(hooke.massCount * hooke.massPerUnit, 0.001)
  );
  hooke.physicsSystem.load.wakeUp();
}

function updateHooke() {
  if (!hooke.spring) return;

  const { extension } = getHookeMeasurements();
  const length = THREE.MathUtils.clamp(
    hooke.naturalLength + extension,
    hooke.minLength,
    hooke.maxLength
  );

  if (!hooke.physicsSystem) {
    scene.remove(hooke.spring);
    hooke.spring.geometry.dispose();
    hooke.spring = createSpring(length);
    scene.add(hooke.spring);

    const bottomY = 3.93 - length;
    hooke.masses.forEach((mass, index) => {
      mass.position.set(1.05, bottomY - index * 0.32, 0);
    });
  } else {
    updateSpringMass(
      hooke.physicsSystem,
      Math.max(hooke.massCount * hooke.massPerUnit, 0.001)
    );
    syncHookePhysics();
  }
}

function getPhysicsExtension() {
  if (!hooke.physicsSystem) return null;
  return Math.max(
    0,
    hooke.physicsSystem.anchor.position.y - hooke.physicsSystem.load.position.y
      - hooke.naturalLength
  );
}

function updateHookeUI() {
  const { massKg, force, extension } = getHookeMeasurements();
  const set = (selector, value) => { const el = document.querySelector(selector); if (el) el.textContent = value; };
  set('#mass-count', hooke.massCount);
  set('#mass-value', `${Math.round(massKg * 1000)} g`);
  set('#force-value', `${force.toFixed(2)} N`);
  const physicsExtension = getPhysicsExtension();
  const shownExtension = physicsExtension ?? extension;
  set('#extension-value', `${(shownExtension * 100).toFixed(1)} cm`);
  set('#pending-mass', hooke.pendingMass ? 'Drag the mass to the spring' : 'No mass waiting');
  set(
    '#physics-status',
    hooke.physicsSystem
      ? 'Physics: active — gravity, spring force and damping are simulated.'
      : 'Physics: ready — attach a mass to activate the spring simulation.'
  );
}

function createPendingMass() {
  if (hooke.pendingMass || hooke.massCount >= 5) return;
  const mass = createMass();
  mass.position.set(-2.1, 1.15, 0);
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

  if (!hooke.physicsSystem) {
    createHookePhysicsSystem();
  } else {
    updateSpringMass(
      hooke.physicsSystem,
      hooke.massCount * hooke.massPerUnit
    );
    hooke.physicsSystem.load.wakeUp();
  }

  updateHooke();
  updateHookeUI();
}

function removeMass() {
  if (!hooke.massCount) return;
  const mass = hooke.masses.pop();
  scene.remove(mass);
  hooke.massCount -= 1;

  if (hooke.massCount > 0 && hooke.physicsSystem) {
    updateSpringMass(
      hooke.physicsSystem,
      hooke.massCount * hooke.massPerUnit
    );
    hooke.physicsSystem.load.wakeUp();
  } else {
    destroyHookePhysicsSystem();
  }

  updateHooke();
  updateHookeUI();
}

function resetHooke() {
  destroyHookePhysicsSystem();
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
    <div class="control-row"><button id="add-mass" class="control-button primary">+ Get 100 g mass</button><button id="remove-mass" class="control-button">− Remove</button></div>
    <div class="drag-status" id="pending-mass">No mass waiting</div>
    <div class="measurement-grid"><div><span>Masses attached</span><strong id="mass-count">0</strong></div><div><span>Total mass</span><strong id="mass-value">0 g</strong></div><div><span>Force</span><strong id="force-value">0.00 N</strong></div><div><span>Extension</span><strong id="extension-value">0.0 cm</strong></div></div>
    <div class="equation"><span>F = kx</span><small>Spring constant k = ${hooke.springConstant.toFixed(1)} N/m</small></div>
    <div class="physics-status" id="physics-status"><strong>Physics:</strong> ready — attach a mass to activate the spring simulation.</div>
    <button id="reset-hooke" class="control-button reset-experiment">Reset experiment</button>`;

  setTimeout(() => {
    const addMassBtn = document.querySelector('#add-mass');
    const removeMassBtn = document.querySelector('#remove-mass');
    const resetHookeBtn = document.querySelector('#reset-hooke');

    if (addMassBtn) {
      addMassBtn.addEventListener('click', createPendingMass);
      console.log('Add mass button listener attached');
    } else {
      console.log('Add mass button not found');
    }
    if (removeMassBtn) removeMassBtn.addEventListener('click', removeMass);
    if (resetHookeBtn) resetHookeBtn.addEventListener('click', resetHooke);
  }, 10);

  updateHookeUI();
}

async function activateHooke() {
  setCircuitCamera(false);
  hooke.active = true;
  await setupHooke();
  instructions.innerHTML = `<h2>Hooke's Law</h2><p>Investigate how the extension of a spring changes when a load is added.</p><p class="model-note"><strong>3D model evidence:</strong> the Flask tool uses a real GLB asset with attribution documented below.</p><ol><li>Click <strong>Get 100 g mass</strong>.</li><li>Drag the mass from the bench to the spring hanging from the arm.</li><li>Drop it near the spring to attach it.</li><li>Add more masses and compare force with extension.</li></ol>`;
  showHookeControls();
}

// ---------------- Acid / Base visual chemistry lab ----------------
const chemistry = {
  active: false,
  mode: 'acid-base',
  experimentType: 'acid-base',
  liquid: null,
  liquidTargetColor: new THREE.Color(0x78d7ff),
  beaker: null,
  beakerModel: null,
  conicalFlaskModel: null,
  acidBottle: null,
  baseBottle: null,
  precipitateBottle: null,
  gasBottle: null,
  bunsenBurner: null,
  thermometer: null,
  bubbles: [],
  precipitate: [],
  droplets: [],
  gasParticles: [],
  stirPhase: 0,
  volume: 0,
  acidRemaining: 0.3,
  baseRemaining: 0.3,
  precipitateRemaining: 0.3,
  gasRemaining: 0.3,
  acid: 0,
  base: 0,
  precipitateReagent: 0,
  gasReagent: 0,
  ph: 7,
  temperature: 25,
  isHeating: false,
  heatIntensity: 0,
  reactionComplete: false,
  message: 'Select a reagent to add to the flask.'
};
const chemistryStockConcentration = 0.1;

function clearChemistry() {
  if (chemistry.beaker) scene.remove(chemistry.beaker);
  if (chemistry.acidBottle) scene.remove(chemistry.acidBottle);
  if (chemistry.baseBottle) scene.remove(chemistry.baseBottle);
  if (chemistry.precipitateBottle) scene.remove(chemistry.precipitateBottle);
  if (chemistry.gasBottle) scene.remove(chemistry.gasBottle);
  if (chemistry.bunsenBurner) scene.remove(chemistry.bunsenBurner);
  if (chemistry.thermometer) scene.remove(chemistry.thermometer);
  if (chemistry.dropper) scene.remove(chemistry.dropper);
  if (chemistry.crucible) scene.remove(chemistry.crucible);
  if (chemistry.petriDish) scene.remove(chemistry.petriDish);
  chemistry.bubbles.forEach(b => scene.remove(b));
  chemistry.precipitate.forEach(p => scene.remove(p));
  chemistry.droplets.forEach(d => scene.remove(d));
  chemistry.gasParticles.forEach(g => scene.remove(g));
  chemistry.bubbles = [];
  chemistry.precipitate = [];
  chemistry.droplets = [];
  chemistry.gasParticles = [];
  chemistry.liquid = null;
  chemistry.beaker = null;
  chemistry.acidBottle = null;
  chemistry.baseBottle = null;
  chemistry.precipitateBottle = null;
  chemistry.gasBottle = null;
  chemistry.bunsenBurner = null;
  chemistry.thermometer = null;
  chemistry.dropper = null;
  chemistry.crucible = null;
  chemistry.petriDish = null;
  chemistry.isHeating = false;
  chemistry.heatIntensity = 0;
  chemistry.reactionComplete = false;
}

async function createChemBeaker() {
  const model = await loadConicalFlask();
  if (model) {
    const flask = new THREE.Group();
    const visual = cloneModel(model);
    visual.traverse(object => {
      if (!object.isMesh) return;
      const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
      const glassMaterials = sourceMaterials.map(material => {
        const glass = material.clone();
        glass.transparent = true;
        glass.opacity = 0.28;
        glass.depthWrite = false;
        glass.side = THREE.DoubleSide;
        return glass;
      });
      object.material = Array.isArray(object.material) ? glassMaterials : glassMaterials[0];
    });
    flask.add(visual);
    flask.position.set(0, 1.2, 0);
    flask.userData.isChemFlask = true;
    flask.userData.flaskTopY = new THREE.Box3().setFromObject(visual).max.y;

    const liquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.3, 0.3, 32),
      new THREE.MeshPhysicalMaterial({ color: chemistry.liquidTargetColor, transparent: true, opacity: 0.68, roughness: 0.18, depthWrite: false })
    );
    liquid.position.y = 0.45;
    liquid.renderOrder = 1;
    flask.add(liquid);
    chemistry.liquid = liquid;

    return flask;
  }

  // Fallback to abstract model
  const group = new THREE.Group();
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 0.82, 1.65, 48, 1, true),
    new THREE.MeshPhysicalMaterial({ color: 0xcfefff, transparent: true, opacity: 0.24, roughness: 0.05, transmission: 0.1 })
  );
  glass.position.y = 1.12;
  group.add(glass);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.055, 12, 48), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 1.95;
  group.add(rim);
  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.3, 0.3, 32),
    new THREE.MeshPhysicalMaterial({ color: chemistry.liquidTargetColor, transparent: true, opacity: 0.68, roughness: 0.18, depthWrite: false })
  );
  group.add(liquid);
  liquid.renderOrder = 1;
  groundCircuitModel(group);
  const flask = new THREE.Group();
  flask.position.set(0, 1.2, 0);
  flask.userData.isChemFlask = true;
  flask.userData.flaskTopY = new THREE.Box3().setFromObject(group).max.y;
  flask.add(group);
  liquid.position.y = 0.45;
  chemistry.liquid = liquid;
  return flask;
}

function createAcidBottle() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.28, 0.8, 24),
    new THREE.MeshStandardMaterial({ color: 0xf05a67, roughness: 0.4 })
  );
  body.position.y = 0.9;
  group.add(body);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.12, 0.25, 16),
    new THREE.MeshStandardMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.75 })
  );
  neck.position.y = 1.4;
  group.add(neck);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16),
    new THREE.MeshStandardMaterial({ color: 0x7c2d12 })
  );
  cap.position.y = 1.55;
  group.add(cap);

  const label = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.15, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );
  label.position.set(0, 0.9, 0.27);
  group.add(label);

  group.userData.isAcidBottle = true;
  group.position.set(-2.5, 0.7, 0);
  setupModelShadows(group);
  return group;
}

function createBaseBottle() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.28, 0.8, 24),
    new THREE.MeshStandardMaterial({ color: 0x7b61ff, roughness: 0.4 })
  );
  body.position.y = 0.9;
  group.add(body);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.12, 0.25, 16),
    new THREE.MeshStandardMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.75 })
  );
  neck.position.y = 1.4;
  group.add(neck);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16),
    new THREE.MeshStandardMaterial({ color: 0x7c2d12 })
  );
  cap.position.y = 1.55;
  group.add(cap);

  const label = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.15, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );
  label.position.set(0, 0.9, 0.27);
  group.add(label);

  group.userData.isBaseBottle = true;
  group.position.set(2.5, 0.7, 0);
  setupModelShadows(group);
  return group;
}

function createPrecipitateBottle() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.28, 0.8, 24),
    new THREE.MeshStandardMaterial({ color: 0xf5f5dc, roughness: 0.4 })
  );
  body.position.y = 0.9;
  group.add(body);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.12, 0.25, 16),
    new THREE.MeshStandardMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.75 })
  );
  neck.position.y = 1.4;
  group.add(neck);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16),
    new THREE.MeshStandardMaterial({ color: 0x7c2d12 })
  );
  cap.position.y = 1.55;
  group.add(cap);

  const label = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.15, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );
  label.position.set(0, 0.9, 0.27);
  group.add(label);

  group.userData.isPrecipitateBottle = true;
  group.position.set(-3.5, 0.7, 0.5);
  setupModelShadows(group);
  return group;
}

function createGasBottle() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.28, 0.8, 24),
    new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.4 })
  );
  body.position.y = 0.9;
  group.add(body);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.12, 0.25, 16),
    new THREE.MeshStandardMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.75 })
  );
  neck.position.y = 1.4;
  group.add(neck);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16),
    new THREE.MeshStandardMaterial({ color: 0x7c2d12 })
  );
  cap.position.y = 1.55;
  group.add(cap);

  const label = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.15, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );
  label.position.set(0, 0.9, 0.27);
  group.add(label);

  group.userData.isGasBottle = true;
  group.position.set(3.5, 0.7, 0.5);
  setupModelShadows(group);
  return group;
}

function createBunsenBurner() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.4, 0.12, 24),
    new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.6, roughness: 0.3 })
  );
  base.position.y = 0.06;
  group.add(base);

  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.12, 0.7, 16),
    new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.5, roughness: 0.4 })
  );
  tube.position.y = 0.47;
  group.add(tube);

  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.08, 16),
    new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.6, roughness: 0.3 })
  );
  collar.position.y = 0.65;
  group.add(collar);

  group.userData.isBunsenBurner = true;
  group.position.set(0, 0.35, 1.2);
  setupModelShadows(group);
  return group;
}

function createThermometer() {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 1.2, 12),
    new THREE.MeshStandardMaterial({ color: 0xe5e7eb, transparent: true, opacity: 0.7 })
  );
  stem.position.y = 0.6;
  group.add(stem);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xef4444 })
  );
  bulb.position.y = 0.06;
  group.add(bulb);

  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.8, 8),
    new THREE.MeshStandardMaterial({ color: 0xef4444 })
  );
  liquid.position.y = 0.45;
  group.add(liquid);

  group.userData.isThermometer = true;
  group.position.set(0.8, 1.2, 0);
  setupModelShadows(group);
  return group;
}

function createDropper() {
  const group = new THREE.Group();
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.7 })
  );
  bulb.position.y = 0.6;
  group.add(bulb);

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.02, 0.5, 12),
    new THREE.MeshStandardMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.7 })
  );
  stem.position.y = 0.25;
  group.add(stem);

  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.02, 0.08, 12),
    new THREE.MeshStandardMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.7 })
  );
  tip.position.y = 0.01;
  group.add(tip);

  group.userData.isDropper = true;
  group.position.set(-0.8, 1.5, 0);
  setupModelShadows(group);
  return group;
}

function createCrucible() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.22, 0.35, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.6, roughness: 0.4 })
  );
  body.position.y = 0.175;
  group.add(body);

  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(0.25, 0.02, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.6, roughness: 0.4 })
  );
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.35;
  group.add(lip);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.08, 16),
    new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.6, roughness: 0.4 })
  );
  base.position.y = 0.04;
  group.add(base);

  group.userData.isCrucible = true;
  group.position.set(1.5, 0.5, -0.5);
  setupModelShadows(group);
  return group;
}

function createPetriDish() {
  const group = new THREE.Group();
  const dish = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.38, 0.08, 32, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xe5e7eb, transparent: true, opacity: 0.85 })
  );
  dish.position.y = 0.04;
  group.add(dish);

  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.02, 32),
    new THREE.MeshStandardMaterial({ color: 0xe5e7eb, transparent: true, opacity: 0.7 })
  );
  lid.position.y = 0.55;
  group.add(lid);

  group.userData.isPetriDish = true;
  group.position.set(-1.5, 0.35, -0.5);
  setupModelShadows(group);
  return group;
}

function createReagentBottle(label, color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.95, 32), new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
  body.position.y = 0.8;
  group.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.35, 24), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.75 }));
  neck.position.y = 1.43;
  group.add(neck);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0x334155 }));
  cap.position.y = 1.66;
  group.add(cap);
  group.userData.reagentLabel = label;
  group.userData.isChemReagent = true;
  group.position.set(2.35, 0.35, 0.55);
  return group;
}

function addChemDroplet(color) {
  const drop = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.9 }));
  drop.position.set(2.35, 2.05, 0.55);
  drop.userData.life = 0;
  drop.userData.color = color;
  drop.userData.targetY = 0.85;
  scene.add(drop);
  chemistry.droplets.push(drop);
}

function updateChemistryLiquid(color, height = 0.3) {
  if (!chemistry.liquid) return;
  chemistry.liquidTargetColor.set(color);
  chemistry.liquid.material.color.lerp(chemistry.liquidTargetColor, 0.15);
  chemistry.liquid.visible = height > 0;
  chemistry.liquid.scale.y = height > 0 ? height / 0.3 : 0.001;
  chemistry.liquid.position.y = 0.05 + height / 2;
}

function spawnBubble() {
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.035 + Math.random() * 0.045, 12, 8), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.42, roughness: 0, transmission: 0.2 }));
  bubble.position.set((Math.random() - 0.5) * 0.8, 0.7 + Math.random() * 0.2, (Math.random() - 0.5) * 0.8);
  bubble.userData.speed = 0.35 + Math.random() * 0.55;
  bubble.userData.life = 0;
  scene.add(bubble);
  chemistry.bubbles.push(bubble);
}

function spawnPrecipitate() {
  const particle = new THREE.Mesh(new THREE.SphereGeometry(0.025 + Math.random() * 0.04, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf5f5dc, roughness: 0.8 }));
  particle.position.set((Math.random() - 0.5) * 0.7, 0.52 + Math.random() * 0.6, (Math.random() - 0.5) * 0.7);
  particle.userData.sink = 0.08 + Math.random() * 0.16;
  scene.add(particle);
  chemistry.precipitate.push(particle);
}

function spawnGasParticle() {
  const particle = new THREE.Mesh(
    new THREE.SphereGeometry(0.04 + Math.random() * 0.03, 8, 6),
    new THREE.MeshPhysicalMaterial({ color: 0x10b981, transparent: true, opacity: 0.6, roughness: 0.1 })
  );
  particle.position.set((Math.random() - 0.5) * 0.6, 0.7 + Math.random() * 0.3, (Math.random() - 0.5) * 0.6);
  particle.userData.rise = 0.15 + Math.random() * 0.2;
  particle.userData.wobble = Math.random() * Math.PI * 2;
  scene.add(particle);
  chemistry.gasParticles.push(particle);
}

function createHeatingEffect() {
  const group = new THREE.Group();
  const flameColors = [0xff6b35, 0xffd700, 0xff4500];
  for (let i = 0; i < 5; i++) {
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.08 + Math.random() * 0.04, 0.25 + Math.random() * 0.1, 8),
      new THREE.MeshBasicMaterial({ color: flameColors[i % 3], transparent: true, opacity: 0.8 })
    );
    flame.position.set((Math.random() - 0.5) * 0.1, 0.12, (Math.random() - 0.5) * 0.1);
    flame.userData.phase = Math.random() * Math.PI * 2;
    group.add(flame);
  }
  return group;
}

function setChemistryLiquid(color, height = 0.72) {
  if (!chemistry.liquid) return;
  chemistry.liquidTargetColor.set(color);
  chemistry.liquid.material.color.lerp(chemistry.liquidTargetColor, 0.35);
  chemistry.liquid.scale.y = Math.max(0.15, height / 0.72);
  chemistry.liquid.position.y = 0.46 + height / 2;
}

function chemistryState() {
  if (chemistry.volume <= 0) {
    return { ph: null, color: 0xcfefff, label: 'Empty', concentration: null, concentrationLabel: 'No solution', reaction: 'None' };
  }

  let color = 0xf3f1a7;
  let label = 'Neutral';
  let reaction = 'None';

  // Acid-Base reaction
  const net = chemistry.base - chemistry.acid;
  const totalReagent = chemistry.acid + chemistry.base;
  const concentration = chemistryStockConcentration * Math.abs(net) / totalReagent;
  if (net < 0) chemistry.ph = THREE.MathUtils.clamp(-Math.log10(concentration), 1, 7);
  else if (net > 0) chemistry.ph = THREE.MathUtils.clamp(14 + Math.log10(concentration), 7, 13);
  else chemistry.ph = 7;
  const concentrationLabel = net < 0
    ? `${concentration.toFixed(2)} M acid`
    : net > 0
      ? `${concentration.toFixed(2)} M base`
      : '0.00 M (neutral mix)';

  if (chemistry.ph < 4) { color = 0xf05a67; label = 'Acidic'; }
  else if (chemistry.ph < 6.5) { color = 0xff9f43; label = 'Acidic'; }
  else if (chemistry.ph > 10) { color = 0x7b61ff; label = 'Basic'; }
  else if (chemistry.ph > 7.5) { color = 0x4fd1c5; label = 'Basic'; }

  // Precipitation reaction
  if (chemistry.precipitateReagent > 0.1) {
    color = 0xf5f5dc;
    label = 'Precipitate forming';
    reaction = 'Precipitation';
  }

  // Gas evolution reaction
  if (chemistry.gasReagent > 0.1) {
    color = 0x6ee7b7;
    label = 'Gas evolving';
    reaction = 'Gas Evolution';
  }

  // Heating effect
  if (chemistry.temperature > 50) {
    label += ' (Heated)';
    reaction = 'Heating';
  }

  return { ph: chemistry.ph, color, label, concentration, concentrationLabel, reaction, temperature: chemistry.temperature };
}

function applyChemistryAction(type) {
  const remainingMap = {
    'acid': 'acidRemaining',
    'base': 'baseRemaining',
    'precipitate': 'precipitateRemaining',
    'gas': 'gasRemaining'
  };
  const remainingKey = remainingMap[type];
  if (chemistry[remainingKey] <= 0) {
    chemistry.message = `The ${type} bottle is empty.`;
    updateChemistryUI();
    return;
  }
  if (chemistry.volume >= 0.6) {
    chemistry.message = 'The flask is full. Reset to start a new experiment.';
    updateChemistryUI();
    return;
  }
  chemistry[remainingKey] = Math.max(0, Math.round((chemistry[remainingKey] - 0.05) * 100) / 100);
  chemistry.volume = Math.min(0.6, chemistry.volume + 0.05);

  if (type === 'acid') {
    chemistry.acid += 0.3;
    const state = chemistryState();
    updateChemistryLiquid(state.color, chemistry.volume);
    chemistry.message = `Acid added. ${state.label}; ${state.concentrationLabel}.`;
  } else if (type === 'base') {
    chemistry.base += 0.3;
    const state = chemistryState();
    updateChemistryLiquid(state.color, chemistry.volume);
    chemistry.message = `Base added. ${state.label}; ${state.concentrationLabel}.`;
  } else if (type === 'precipitate') {
    chemistry.precipitateReagent += 0.3;
    const state = chemistryState();
    updateChemistryLiquid(state.color, chemistry.volume);
    for (let i = 0; i < 8; i++) spawnPrecipitate();
    chemistry.message = `Precipitate reagent added. Solid particles forming at the bottom.`;
  } else if (type === 'gas') {
    chemistry.gasReagent += 0.3;
    const state = chemistryState();
    updateChemistryLiquid(state.color, chemistry.volume);
    for (let i = 0; i < 12; i++) spawnGasParticle();
    chemistry.message = `Gas-producing reagent added. Bubbles rising from the solution.`;
  }
  updateChemistryUI();
}

function resetChemistry() {
  chemistry.acid = 0;
  chemistry.base = 0;
  chemistry.precipitateReagent = 0;
  chemistry.gasReagent = 0;
  chemistry.ph = 7;
  chemistry.temperature = 25;
  chemistry.volume = 0;
  chemistry.acidRemaining = 0.3;
  chemistry.baseRemaining = 0.3;
  chemistry.precipitateRemaining = 0.3;
  chemistry.gasRemaining = 0.3;
  chemistry.isHeating = false;
  chemistry.heatIntensity = 0;
  chemistry.reactionComplete = false;
  chemistry.message = 'The flask is empty. Add a reagent to begin.';
  chemistry.bubbles.forEach(b => scene.remove(b));
  chemistry.precipitate.forEach(p => scene.remove(p));
  chemistry.droplets.forEach(d => scene.remove(d));
  chemistry.gasParticles.forEach(g => scene.remove(g));
  chemistry.bubbles = [];
  chemistry.precipitate = [];
  chemistry.droplets = [];
  chemistry.gasParticles = [];
  updateChemistryLiquid(chemistryState().color, chemistry.volume);
  updateChemistryUI();
}

function toggleHeating() {
  chemistry.isHeating = !chemistry.isHeating;
  chemistry.message = chemistry.isHeating ? 'Heating on. Temperature will rise gradually.' : 'Heating off. Temperature will cool down.';
  const heatBtn = document.querySelector('#toggle-heat');
  if (heatBtn) {
    heatBtn.classList.toggle('active', chemistry.isHeating);
  }
  updateChemistryUI();
}

function updateChemistryUI() {
  const state = chemistryState();
  const phValue = document.querySelector('#chem-ph');
  const phState = document.querySelector('#chem-state');
  const volumeValue = document.querySelector('#chem-volume');
  const phMarker = document.querySelector('#chem-ph-marker');
  const concentrationValue = document.querySelector('#chem-concentration');
  const observation = document.querySelector('#chem-observation');
  const temperatureValue = document.querySelector('#chem-temperature');
  const reactionValue = document.querySelector('#chem-reaction');
  const acidRemaining = document.querySelector('#chem-acid-remaining');
  const baseRemaining = document.querySelector('#chem-base-remaining');
  const precipitateRemaining = document.querySelector('#chem-precipitate-remaining');
  const gasRemaining = document.querySelector('#chem-gas-remaining');
  if (phValue) phValue.textContent = state.ph === null ? 'pH --' : `pH ${state.ph.toFixed(1)}`;
  if (phState) phState.textContent = state.label;
  if (volumeValue) volumeValue.textContent = `${Math.round(chemistry.volume * 100)} mL`;
  if (concentrationValue) concentrationValue.textContent = state.concentrationLabel;
  if (phMarker) {
    phMarker.hidden = state.ph === null;
    if (state.ph !== null) phMarker.style.left = `${((state.ph - 1) / 12) * 100}%`;
  }
  if (temperatureValue) {
    temperatureValue.textContent = `${state.temperature.toFixed(1)} °C`;
    temperatureValue.style.color = state.temperature > 50 ? '#f59e0b' : state.temperature > 75 ? '#ef4444' : '#f8fafc';
  }
  if (reactionValue) {
    reactionValue.textContent = state.reaction;
    reactionValue.style.color = state.reaction === 'None' ? '#94a3b8' :
                              state.reaction === 'Precipitation' ? '#d4a574' :
                              state.reaction === 'Gas Evolution' ? '#4fd1c5' :
                              state.reaction === 'Heating' ? '#f59e0b' : '#f8fafc';
  }
  if (acidRemaining) acidRemaining.textContent = `${Math.round(chemistry.acidRemaining * 100)} mL left`;
  if (baseRemaining) baseRemaining.textContent = `${Math.round(chemistry.baseRemaining * 100)} mL left`;
  if (precipitateRemaining) precipitateRemaining.textContent = `${Math.round(chemistry.precipitateRemaining * 100)} mL left`;
  if (gasRemaining) gasRemaining.textContent = `${Math.round(chemistry.gasRemaining * 100)} mL left`;
  if (observation) observation.textContent = chemistry.message;
}

function showChemistryControls() {
  experimentControls.innerHTML = `
    <div class="control-title">Chemistry Experiments</div>
    <div class="chemistry-section-header">Reagents</div>
    <div class="chemistry-dose-controls">
      <button id="add-acid" class="control-button acid-dose"><span>Add Acid</span><small id="chem-acid-remaining">30 mL left</small></button>
      <button id="add-base" class="control-button base-dose"><span>Add Base</span><small id="chem-base-remaining">30 mL left</small></button>
      <button id="add-precipitate" class="control-button precipitate-dose"><span>Add Precipitate</span><small id="chem-precipitate-remaining">30 mL left</small></button>
      <button id="add-gas" class="control-button gas-dose"><span>Add Gas Reagent</span><small id="chem-gas-remaining">30 mL left</small></button>
    </div>
    <div class="chemistry-section-header">Conditions</div>
    <div class="chemistry-heating-controls">
      <button id="toggle-heat" class="control-button heat-toggle"><span>Toggle Heating</span><small>Temperature control</small></button>
    </div>
    <div class="chemistry-section-header">Measurements</div>
    <div class="measurement-grid">
      <div><span>pH</span><strong id="chem-ph">pH --</strong><small id="chem-state">Empty</small></div>
      <div><span>Solution</span><strong id="chem-volume">0 mL</strong></div>
      <div><span>Temperature</span><strong id="chem-temperature">25.0 °C</strong></div>
      <div><span>Reaction</span><strong id="chem-reaction">None</strong></div>
    </div>
    <div class="chem-mixture-reading"><span>Concentration</span><strong id="chem-concentration">No solution</strong></div>
    <div class="chemistry-section-header">pH Scale</div>
    <div class="ph-scale" aria-label="pH scale from acidic to basic"><div class="ph-scale-bar"><span id="chem-ph-marker"></span></div><div class="ph-scale-labels"><span>Acidic</span><span>7 is neutral</span><span>Basic</span></div></div>
    <div class="drag-status" id="chem-observation">The flask is empty. Add a reagent to begin.</div>
    <div class="model-note">Mix reagents to observe different reaction types: acid-base, precipitation, gas evolution, and heating effects.</div>
    <button id="reset-chem" class="control-button reset-experiment">Reset experiment</button>`;

  document.querySelector('#add-acid').addEventListener('click', () => applyChemistryAction('acid'));
  document.querySelector('#add-base').addEventListener('click', () => applyChemistryAction('base'));
  document.querySelector('#add-precipitate').addEventListener('click', () => applyChemistryAction('precipitate'));
  document.querySelector('#add-gas').addEventListener('click', () => applyChemistryAction('gas'));
  document.querySelector('#toggle-heat').addEventListener('click', toggleHeating);
  document.querySelector('#reset-chem').addEventListener('click', resetChemistry);
  updateChemistryUI();
}

async function setupChemistry() {
  clearChemistry();
  chemistry.active = true;
  chemistry.beaker = await createChemBeaker();
  scene.add(chemistry.beaker);
  chemistry.acidBottle = createAcidBottle();
  scene.add(chemistry.acidBottle);
  chemistry.baseBottle = createBaseBottle();
  scene.add(chemistry.baseBottle);
  chemistry.precipitateBottle = createPrecipitateBottle();
  scene.add(chemistry.precipitateBottle);
  chemistry.gasBottle = createGasBottle();
  scene.add(chemistry.gasBottle);
  chemistry.bunsenBurner = createBunsenBurner();
  scene.add(chemistry.bunsenBurner);
  chemistry.thermometer = createThermometer();
  scene.add(chemistry.thermometer);
  chemistry.dropper = createDropper();
  scene.add(chemistry.dropper);
  chemistry.crucible = createCrucible();
  scene.add(chemistry.crucible);
  chemistry.petriDish = createPetriDish();
  scene.add(chemistry.petriDish);
  resetChemistry();
  showChemistryControls();
}

async function activateChemistry() {
  setCircuitCamera(false);
  clearHooke();
  await setupChemistry();
  instructions.innerHTML = `<h2>Chemistry Reactions</h2><p>Explore different types of chemical reactions with visual feedback.</p><ol><li>The flask starts empty. Choose any reagent to add 5 mL.</li><li><strong>Acid/Base:</strong> Mix acids and bases to see pH changes and color shifts.</li><li><strong>Precipitation:</strong> Add precipitate reagent to see solid particles form at the bottom.</li><li><strong>Gas Evolution:</strong> Add gas reagent to see bubbles rise from the solution.</li><li><strong>Heating:</strong> Toggle heating to raise temperature and observe increased bubble formation.</li><li>Use the thermometer to monitor temperature changes in real-time.</li></ol><p class="model-note">Combine different reagents to observe multiple reaction types simultaneously. The color and particle effects provide visual feedback for each reaction type.</p>`;
}


// ---------------- Simple Circuit experiment ----------------
const circuitTerminalGeometry = new THREE.SphereGeometry(0.085, 12, 8);
const circuitTerminalHitGeometry = new THREE.SphereGeometry(0.18, 12, 8);
const circuitTerminalMaterial = new THREE.MeshStandardMaterial({ color: 0xc4d0d7, metalness: 0.72, roughness: 0.26 });
const circuitPositiveTerminalMaterial = new THREE.MeshStandardMaterial({ color: 0xe64b43, metalness: 0.38, roughness: 0.34 });
const circuitNegativeTerminalMaterial = new THREE.MeshStandardMaterial({ color: 0x25323c, metalness: 0.68, roughness: 0.3 });
const circuitHitTargetGeometry = new THREE.SphereGeometry(0.58, 12, 8);
const circuitHitTargetMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, opacity: 0 });
const circuitLayout = {
  battery: [-1.7, 0],
  resistor: [0, -1.55],
  bulb: [1.7, 0],
  switch: [0, 1.55]
};
const circuitOrder = ['battery', 'resistor', 'bulb', 'switch'];
const circuit = {
  active: false,
  components: [],
  wires: [],
  current: 0,
  voltage: 6,
  resistance: 12,
  switchClosed: false,
  connected: false,
  bulbGlow: 0,
  electrons: [],
  message: 'Select components from the palette and place them on the bench.',
  batteryModel: null,
  resistorModel: null,
  switchModel: null,
  bulbModel: null,
  connectionMode: false,
  connectionStart: null,
  tempWire: null,
  shortCircuited: false,
  fireEffect: null,
  overloadConnected: false,
  overloadTime: 0,
  bulbBlown: false,
  burnoutEffect: null,
  burnoutTime: 0
};

function clearCircuit() {
  circuit.components.forEach(c => scene.remove(c.group));
  circuit.wires.forEach(w => {
    scene.remove(w.mesh);
    w.mesh.geometry.dispose();
    w.mesh.material.dispose();
  });
  removeTempWire();
  removeShortCircuitEffect();
  removeBulbBurnoutEffect();
  removeCircuitElectrons();
  circuit.components = [];
  circuit.wires = [];
  circuit.electrons = [];
  circuit.current = 0;
  circuit.switchClosed = false;
  circuit.connected = false;
  circuit.bulbGlow = 0;
  circuit.connectionMode = false;
  circuit.connectionStart = null;
  circuit.shortCircuited = false;
  circuit.overloadConnected = false;
  circuit.overloadTime = 0;
  circuit.bulbBlown = false;
  circuit.burnoutTime = 0;
  selectedCircuitComponent = null;
  controls.enabled = true;
}

async function makeCircuitComponent(type, label) {
  const models = await loadCircuitModels();
  const makeModelRoot = model => {
    const root = new THREE.Group();
    root.userData.isCircuitComponent = true;
    root.userData.circuitType = type;
    root.userData.label = label;
    root.rotation.y = getCircuitDefaultRotation(type);
    root.add(preorientCircuitModel(cloneModel(model), type));
    addCircuitTerminals(root, type);
    addCircuitHitTarget(root, type);
    return root;
  };

  if (type === 'battery' && models.battery) {
    return makeModelRoot(models.battery);
  }

  if (type === 'resistor' && models.resistor) {
    return makeModelRoot(models.resistor);
  }

  if (type === 'switch' && models.switch) {
    return makeModelRoot(models.switch);
  }

  // Fallback to abstract models
  const group = new THREE.Group();
  group.userData.isCircuitComponent = true;
  group.userData.circuitType = type;
  group.userData.label = label;
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.35, roughness: 0.4 });

  if (type === 'battery') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 1.05), bodyMat);
    body.position.y = 0.24;
    group.add(body);
    const positive = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.18,16), new THREE.MeshStandardMaterial({color:0xef4444, metalness:0.5}));
    positive.rotation.x = Math.PI / 2;
    positive.position.set(0,0.24,-0.6); group.add(positive);
    const negative = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.18,16), new THREE.MeshStandardMaterial({color:0x111827, metalness:0.5}));
    negative.rotation.x = Math.PI / 2;
    negative.position.set(0,0.24,0.6); group.add(negative);
  }
  if (type === 'resistor') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,0.75,24), new THREE.MeshStandardMaterial({color:0xd6b07a, roughness:0.6}));
    body.rotation.z=Math.PI/2; body.position.y=0.58; group.add(body);
    for (let i=-2;i<=2;i++) {
      const band=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.46,0.46), new THREE.MeshStandardMaterial({color:[0x7c2d12,0x1d4ed8,0xf59e0b,0x7c2d12,0x111827][i+2]}));
      band.position.set(i*0.12,0.58,0); group.add(band);
    }
  }
  if (type === 'switch') {
    const base=new THREE.Mesh(new THREE.BoxGeometry(0.95,0.16,0.62),bodyMat); base.position.y=0.48; group.add(base);
    const lever=new THREE.Mesh(new THREE.BoxGeometry(0.62,0.08,0.08),new THREE.MeshStandardMaterial({color:0x60a5fa,metalness:0.4}));
    lever.position.set(0,0.68,0); group.add(lever); group.userData.lever=lever;
  }
  if (type === 'bulb') {
    const base=new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.3,0.38,24),bodyMat); base.position.y=0.52; group.add(base);
    const glass=new THREE.Mesh(new THREE.SphereGeometry(0.42,32,20),new THREE.MeshPhysicalMaterial({color:0xf8fafc,transparent:true,opacity:0.72,roughness:0.08,transmission:0.25,emissive:0x000000,emissiveIntensity:0}));
    glass.position.y=1.0; group.add(glass); group.userData.glass=glass;
  }
  group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  groundCircuitModel(group);
  const root = new THREE.Group();
  root.userData.isCircuitComponent = true;
  root.userData.circuitType = type;
  root.userData.label = label;
  root.userData.glass = group.userData.glass;
  root.userData.lever = group.userData.lever;
  root.rotation.y = getCircuitDefaultRotation(type);
  root.add(group);
  addCircuitTerminals(root, type);
  addCircuitHitTarget(root, type);
  return root;
}

async function addCircuitComponent(type, target) {
  const group=await makeCircuitComponent(type,type);
  group.position.copy(target);
  group.position.y = 1.2;
  scene.add(group);
  const item={type,group,target:target.clone(),placed:true};
  circuit.components.push(item);
  return item;
}

async function addCircuitComponentFromPalette(type) {
  const group=await makeCircuitComponent(type,type);
  const layout = circuitLayout;
  const duplicateIndex = circuit.components.filter(component => component.type === type).length;
  const [x, z] = layout[type] ?? [0, 0];
  group.position.set(x + duplicateIndex * 0.65, 1.2, z + duplicateIndex * 0.65);
  scene.add(group);
  const item={type,group,placed:true};
  circuit.components.push(item);
  circuit.message = `Added ${type}. Select Add Wire to connect components by hand.`;
  updateCircuitUI();
}

function setupCircuit() {
  clearCircuit();
  circuit.active=true;
  updateCircuitUI();
}

function circuitComponent(name) { return circuit.components.find(c=>c.type===name); }

function getCircuitDefaultRotation(type) {
  const index = circuitOrder.indexOf(type);
  if (index < 0) return 0;
  const previousType = circuitOrder[(index + circuitOrder.length - 1) % circuitOrder.length];
  const nextType = circuitOrder[(index + 1) % circuitOrder.length];
  const previous = circuitLayout[previousType];
  const next = circuitLayout[nextType];
  const axisX = type === 'battery' ? previous[0] - next[0] : next[0] - previous[0];
  const axisZ = type === 'battery' ? previous[1] - next[1] : next[1] - previous[1];

  return type === 'battery' ? Math.atan2(axisX, axisZ) : Math.atan2(-axisZ, axisX);
}

function removeCircuitElectrons() {
  circuit.electrons.forEach(electron => {
    scene.remove(electron);
    electron.geometry.dispose();
    electron.material.dispose();
  });
  circuit.electrons = [];
}

function addCircuitHitTarget(root, type) {
  const radius = 0.58;
  const target = new THREE.Mesh(circuitHitTargetGeometry, circuitHitTargetMaterial);
  target.position.y = radius;
  target.userData.isCircuitHitTarget = true;
  root.add(target);
}

function addCircuitTerminals(root, type) {
  const terminalPositions = {
    battery: [[0, 0.08, -0.3], [0, 0.08, 0.3]],
    resistor: [[-0.22, 0.12, 0], [0.22, 0.12, 0]],
    switch: [[-0.25, 0.12, 0], [0.25, 0.12, 0]],
    bulb: [[-0.48, 0.1, 0], [0.48, 0.1, 0]]
  };
  root.userData.circuitTerminals = (terminalPositions[type] ?? terminalPositions.bulb).map(([x, y, z], index) => {
    const material = type === 'battery'
      ? index === 0 ? circuitPositiveTerminalMaterial : circuitNegativeTerminalMaterial
      : type === 'bulb'
        ? index === 0 ? circuitPositiveTerminalMaterial : circuitNegativeTerminalMaterial
        : circuitTerminalMaterial;
    const terminal = new THREE.Mesh(circuitTerminalGeometry, material);
    terminal.position.set(x, y, z);
    terminal.userData.circuitTerminalIndex = index;
    terminal.castShadow = false;
    terminal.receiveShadow = false;
    root.add(terminal);
    const hitTarget = new THREE.Mesh(circuitTerminalHitGeometry, circuitHitTargetMaterial);
    hitTarget.position.copy(terminal.position);
    hitTarget.userData.circuitTerminalIndex = index;
    root.add(hitTarget);
    return terminal;
  });
}

function preorientCircuitModel(model, type) {
  const desiredAxis = type === 'battery' ? 'z' : 'x';
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const axisNames = ['x', 'y', 'z'];
  const dimensions = [size.x, size.y, size.z];
  const longestAxis = axisNames[dimensions.indexOf(Math.max(...dimensions))];

  if (longestAxis !== desiredAxis) {
    const axisVectors = {
      x: new THREE.Vector3(1, 0, 0),
      y: new THREE.Vector3(0, 1, 0),
      z: new THREE.Vector3(0, 0, 1)
    };
    model.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(axisVectors[longestAxis], axisVectors[desiredAxis]));
    groundCircuitModel(model);
  }
  return model;
}

function getCircuitTerminalWorldPosition(component, terminalIndex) {
  const terminal = component.group.userData.circuitTerminals[terminalIndex];
  return terminal.getWorldPosition(new THREE.Vector3());
}

function getNearestCircuitTerminalIndex(component) {
  const terminals = component.group.userData.circuitTerminals;
  return terminals.reduce((nearestIndex, terminal, index) => {
    const projected = terminal.getWorldPosition(new THREE.Vector3()).project(camera);
    const nearest = terminals[nearestIndex].getWorldPosition(new THREE.Vector3()).project(camera);
    const distance = Math.hypot(projected.x - pointer.x, projected.y - pointer.y);
    const nearestDistance = Math.hypot(nearest.x - pointer.x, nearest.y - pointer.y);
    return distance < nearestDistance ? index : nearestIndex;
  }, 0);
}

function circuitUsesBothTerminals() {
  return circuit.components.every(component => [0, 1].every(terminalIndex =>
    circuit.wires.some(wire =>
      (wire.from === component && wire.fromTerminal === terminalIndex) ||
      (wire.to === component && wire.toTerminal === terminalIndex)
    )
  ));
}

function circuitGraph(excludedType = null) {
  const components = circuit.components.filter(component => component.type !== excludedType);
  const adjacency = new Map(components.map(component => [component, new Set()]));
  circuit.wires.forEach(wire => {
    if (adjacency.has(wire.from) && adjacency.has(wire.to)) {
      adjacency.get(wire.from).add(wire.to);
      adjacency.get(wire.to).add(wire.from);
    }
  });
  return { components, adjacency };
}

function circuitGraphHasCycle(graph, start = null) {
  const visited = new Set();
  const visit = (component, parent) => {
    visited.add(component);
    for (const neighbor of graph.adjacency.get(component) ?? []) {
      if (neighbor === parent) continue;
      if (visited.has(neighbor) || visit(neighbor, component)) return true;
    }
    return false;
  };
  const first = start && graph.adjacency.has(start) ? start : graph.components[0];
  return first ? visit(first, null) : false;
}

function circuitGraphIsConnected(graph) {
  if (!graph.components.length) return false;
  const visited = new Set();
  const pending = [graph.components[0]];
  while (pending.length) {
    const component = pending.pop();
    if (visited.has(component)) continue;
    visited.add(component);
    graph.adjacency.get(component).forEach(neighbor => pending.push(neighbor));
  }
  return visited.size === graph.components.length;
}

function removeShortCircuitEffect() {
  const effect = circuit.fireEffect;
  if (!effect) return;
  scene.remove(effect.root);
  effect.coneGeometry.dispose();
  effect.smokeGeometry.dispose();
  effect.flameMaterials.forEach(material => material.dispose());
  effect.smokeMaterial.dispose();
  circuit.fireEffect = null;
}

function createShortCircuitEffect() {
  const battery = circuitComponent('battery');
  if (!battery) return null;

  const root = new THREE.Group();
  root.position.copy(battery.group.position);
  scene.add(root);

  const coneGeometry = new THREE.ConeGeometry(0.13, 0.38, 7);
  const flameMaterials = [0xff4d20, 0xff8a24, 0xffd24a].map(color => new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.92,
    depthWrite: false
  }));
  const flames = Array.from({ length: 9 }, (_, index) => {
    const mesh = new THREE.Mesh(coneGeometry, flameMaterials[index % flameMaterials.length]);
    mesh.position.set((index % 3 - 1) * 0.14, 0.74 + (index % 3) * 0.13, index % 2 ? 0.1 : -0.1);
    mesh.userData.phase = index / 9;
    mesh.userData.baseY = mesh.position.y;
    mesh.userData.speed = 0.7 + (index % 4) * 0.12;
    root.add(mesh);
    return mesh;
  });
  const smokeGeometry = new THREE.SphereGeometry(0.12, 8, 8);
  const smokeMaterial = new THREE.MeshBasicMaterial({
    color: 0x64717a,
    transparent: true,
    opacity: 0.28,
    depthWrite: false
  });
  const smoke = Array.from({ length: 5 }, (_, index) => {
    const mesh = new THREE.Mesh(smokeGeometry, smokeMaterial);
    mesh.position.set((index % 3 - 1) * 0.12, 0.95 + index * 0.12, 0.02);
    mesh.userData.phase = index / 5;
    mesh.userData.speed = 0.22 + (index % 3) * 0.04;
    root.add(mesh);
    return mesh;
  });
  const light = new THREE.PointLight(0xff6b2e, 2.2, 2.4);
  light.position.set(0, 0.9, 0);
  root.add(light);

  return { root, flames, smoke, coneGeometry, smokeGeometry, flameMaterials, smokeMaterial, light, time: 0 };
}

function setCircuitShorted(shorted) {
  if (circuit.shortCircuited === shorted) return;
  circuit.shortCircuited = shorted;
  if (shorted) {
    circuit.switchClosed = false;
    removeCircuitElectrons();
    circuit.fireEffect = createShortCircuitEffect();
  } else {
    removeShortCircuitEffect();
  }
}

function checkCircuitConnectivity() {
  circuit.overloadConnected = false;
  const requiredTypes = ['battery', 'resistor', 'switch', 'bulb'];
  const hasAllComponents = requiredTypes.every(type => circuit.components.some(component => component.type === type));
  const hasResistor = circuit.components.some(component => component.type === 'resistor');
  const battery = circuitComponent('battery');
  const withoutResistor = circuitGraph('resistor');
  const shorted = hasResistor && battery && circuitGraphHasCycle(withoutResistor, battery);
  setCircuitShorted(Boolean(shorted));

  if (circuit.shortCircuited) {
    circuit.connected = false;
    circuit.message = 'SHORT CIRCUIT: the loop bypasses the resistor. Clear the wires to stop the simulated fire.';
    updateCircuitUI();
    return;
  }

  const graph = circuitGraph();
  const loopComplete = circuitGraphIsConnected(graph) &&
    circuitGraphHasCycle(graph, battery) &&
    circuitUsesBothTerminals();
  const overloadComponents = circuit.components.length === 3 &&
    ['battery', 'switch', 'bulb'].every(type => circuit.components.some(component => component.type === type));
  circuit.overloadConnected = !hasResistor && overloadComponents && loopComplete;
  circuit.connected = loopComplete && (hasAllComponents || circuit.overloadConnected);
  circuit.message = circuit.overloadConnected
    ? circuit.bulbBlown
      ? 'LED blown from sustained overcurrent. Reset the experiment to try again.'
      : 'Resistor-free loop complete. Close the switch to see the LED overheat.'
    : circuit.connected
      ? 'Circuit complete. Close the switch to light the LED.'
      : 'Connect one lead to each terminal and complete the loop through the resistor.';
  updateCircuitUI();
}

function getCircuitCurrent() {
  if (circuit.shortCircuited) return circuit.voltage / 0.6;
  if (circuit.overloadConnected && circuit.switchClosed && !circuit.bulbBlown) {
    return Math.min(3, 0.35 + circuit.overloadTime * 0.65);
  }
  return circuit.connected && circuit.switchClosed ? circuit.voltage / circuit.resistance : 0;
}

function createBulbBurnoutEffect() {
  const bulb = circuitComponent('bulb');
  if (!bulb) return;
  const root = new THREE.Group();
  root.position.copy(bulb.group.position);
  scene.add(root);

  const sparkGeometry = new THREE.TetrahedronGeometry(0.08, 0);
  const sparkMaterials = [0xffd166, 0xff7138].map(color => new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    depthWrite: false
  }));
  const sparks = Array.from({ length: 12 }, (_, index) => {
    const mesh = new THREE.Mesh(sparkGeometry, sparkMaterials[index % sparkMaterials.length]);
    const angle = (index / 12) * Math.PI * 2;
    mesh.userData.velocity = new THREE.Vector3(Math.cos(angle) * 0.7, 0.5 + (index % 3) * 0.18, Math.sin(angle) * 0.7);
    mesh.position.set(0, 0.95, 0);
    root.add(mesh);
    return mesh;
  });
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff0b3, transparent: true, opacity: 0.9, depthWrite: false })
  );
  flash.position.y = 0.95;
  root.add(flash);
  circuit.burnoutEffect = { root, sparks, flash, sparkGeometry, sparkMaterials, time: 0 };
}

function removeBulbBurnoutEffect() {
  const effect = circuit.burnoutEffect;
  if (!effect) return;
  scene.remove(effect.root);
  effect.sparkGeometry.dispose();
  effect.sparkMaterials.forEach(material => material.dispose());
  effect.flash.geometry.dispose();
  effect.flash.material.dispose();
  circuit.burnoutEffect = null;
}

function blowCircuitBulb() {
  if (circuit.bulbBlown) return;
  circuit.bulbBlown = true;
  circuit.switchClosed = false;
  circuit.burnoutTime = 0;
  removeCircuitElectrons();
  createBulbBurnoutEffect();
  const sw = circuitComponent('switch');
  if (sw?.group.userData.lever) sw.group.userData.lever.rotation.z = 0.35;
  circuit.message = 'LED blown: sustained overcurrent overheated the bulb. Reset the experiment to replace it.';
  updateCircuitUI();
}

function animateBulbBurnout(deltaSeconds) {
  const effect = circuit.burnoutEffect;
  if (!effect) return;
  effect.time += deltaSeconds;
  effect.sparks.forEach(spark => {
    spark.position.addScaledVector(spark.userData.velocity, deltaSeconds);
    spark.userData.velocity.y -= deltaSeconds * 1.5;
    spark.scale.multiplyScalar(Math.max(0, 1 - deltaSeconds * 0.8));
  });
  effect.flash.material.opacity = Math.max(0, 0.9 - effect.time * 1.8);
  effect.flash.scale.setScalar(1 + effect.time * 2.5);
  if (effect.time > 1.2) removeBulbBurnoutEffect();
}

function animateShortCircuitEffect(deltaSeconds) {
  const effect = circuit.fireEffect;
  if (!effect) return;
  effect.time += deltaSeconds;
  effect.flames.forEach(flame => {
    const progress = (effect.time * flame.userData.speed + flame.userData.phase) % 1;
    const flicker = 0.82 + Math.sin(effect.time * 28 + flame.userData.phase * 8) * 0.18;
    flame.position.y = flame.userData.baseY + progress * 0.28;
    flame.scale.set(flicker, 0.68 + (1 - progress) * 0.42, flicker);
    flame.visible = progress < 0.9;
  });
  effect.smoke.forEach(puff => {
    const progress = (effect.time * puff.userData.speed + puff.userData.phase) % 1;
    puff.position.y = 0.92 + progress * 0.85;
    puff.scale.setScalar(0.45 + progress * 2.4);
    puff.visible = progress < 0.82;
  });
  effect.light.intensity = 1.5 + Math.sin(effect.time * 24) * 0.7;
}

function getCircuitCurrentPath() {
  const battery = circuitComponent('battery');
  if (!battery || !circuit.connected || !circuit.switchClosed || circuit.shortCircuited) return [];

  const path = [];
  let current = battery;
  let previousWire = null;
  for (let index = 0; index < circuit.wires.length; index += 1) {
    const wire = circuit.wires.find(candidate => candidate !== previousWire &&
      (candidate.from === current || candidate.to === current));
    if (!wire) break;

    const forward = wire.from === current;
    current = forward ? wire.to : wire.from;
    path.push({ curve: wire.mesh.geometry.parameters.path, length: wire.mesh.geometry.parameters.path.getLength(), forward });
    previousWire = wire;
    if (current === battery) break;
  }

  return current === battery ? path : [];
}

function toggleCircuitSwitch() {
  if (circuit.shortCircuited) {
    circuit.message = 'Short circuit present. Clear the wires before operating the switch.';
    updateCircuitUI();
    return;
  }
  if(!circuit.connected){
    circuit.connected = false;
    circuit.message = 'Complete the circuit loop before closing the switch.';
    updateCircuitUI();
    return;
  }
  if (circuit.bulbBlown) {
    circuit.message = 'LED blown. Reset the experiment to replace it.';
    updateCircuitUI();
    return;
  }
  circuit.switchClosed=!circuit.switchClosed;
  if (circuit.overloadConnected) circuit.overloadTime = 0;
  circuit.message=circuit.switchClosed?'Switch closed: current is flowing.':'Switch open: current stopped.';
  const sw=circuitComponent('switch');
  if(sw?.group.userData.lever) {
    sw.group.userData.lever.rotation.z=circuit.switchClosed?-0.35:0.35;
  } else if (sw?.group) {
    sw.group.rotation.y = circuit.switchClosed ? Math.PI / 4 : 0;
  }
  updateCircuitUI();
}

function toggleConnectionMode() {
  circuit.connectionMode = !circuit.connectionMode;
  controls.enabled = !circuit.connectionMode;
  circuit.connectionStart = null;
  removeTempWire();
  const btn = document.querySelector('#connect-mode');
  btn.textContent = circuit.connectionMode ? 'Cancel Wire' : 'Add Wire';
  btn.classList.toggle('primary', circuit.connectionMode);
  circuit.message = circuit.connectionMode ? 'Click near one terminal, then another terminal to add a lead.' : 'Select Add Wire to connect components by hand.';
  updateCircuitUI();
}

function clearWires() {
  circuit.wires.forEach(w => {
    scene.remove(w.mesh);
    w.mesh.geometry.dispose();
    w.mesh.material.dispose();
  });
  circuit.wires = [];
  circuit.connected = false;
  circuit.current = 0;
  circuit.switchClosed = false;
  setCircuitShorted(false);
  circuit.overloadConnected = false;
  circuit.overloadTime = 0;
  circuit.bulbBlown = false;
  circuit.burnoutTime = 0;
  removeBulbBurnoutEffect();
  circuit.message = 'Wires cleared. Select Add Wire to reconnect components.';
  updateCircuitUI();
}

function makeWireGeometry(positionA, positionB, radius = 0.035) {
  const start = positionA.clone();
  const end = positionB.clone();
  const controlA = start.clone().lerp(end, 1 / 3);
  const controlB = start.clone().lerp(end, 2 / 3);
  controlA.y = 1.3;
  controlB.y = 1.3;
  const curve = new THREE.CubicBezierCurve3(start, controlA, controlB, end);
  return new THREE.TubeGeometry(curve, 24, radius, 8, false);
}

function createWireMaterial(color, isPreview = false) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.42,
    metalness: 0.12,
    transparent: isPreview,
    opacity: isPreview ? 0.72 : 1
  });
}

function removeTempWire() {
  if (!circuit.tempWire) return;
  scene.remove(circuit.tempWire);
  circuit.tempWire.geometry.dispose();
  circuit.tempWire.material.dispose();
  circuit.tempWire = null;
}

function updateTempWire(endPosition) {
  if (!circuit.connectionStart) return;
  const startPosition = getCircuitTerminalWorldPosition(
    circuit.connectionStart.component,
    circuit.connectionStart.terminalIndex
  );
  const previewEnd = endPosition.clone();
  previewEnd.y = 1.3;
  if (!circuit.tempWire) {
    circuit.tempWire = new THREE.Mesh(makeWireGeometry(startPosition, previewEnd, 0.027), createWireMaterial(0x55b7d8, true));
    scene.add(circuit.tempWire);
  } else {
    circuit.tempWire.geometry.dispose();
    circuit.tempWire.geometry = makeWireGeometry(startPosition, previewEnd, 0.027);
  }
}

function createWireBetween(endpointA, endpointB) {
  const sameConnection = wire =>
    (wire.from === endpointA.component && wire.fromTerminal === endpointA.terminalIndex && wire.to === endpointB.component && wire.toTerminal === endpointB.terminalIndex) ||
    (wire.from === endpointB.component && wire.fromTerminal === endpointB.terminalIndex && wire.to === endpointA.component && wire.toTerminal === endpointA.terminalIndex);
  if (circuit.wires.some(sameConnection)) {
    circuit.message = 'Those two terminals are already connected.';
    return false;
  }
  const color = circuit.wires.length % 2 === 0 ? 0xc84a45 : 0x283744;
  const mesh = new THREE.Mesh(
    makeWireGeometry(
      getCircuitTerminalWorldPosition(endpointA.component, endpointA.terminalIndex),
      getCircuitTerminalWorldPosition(endpointB.component, endpointB.terminalIndex)
    ),
    createWireMaterial(color)
  );
  mesh.castShadow = true;
  scene.add(mesh);
  circuit.wires.push({
    mesh,
    from: endpointA.component,
    fromTerminal: endpointA.terminalIndex,
    to: endpointB.component,
    toTerminal: endpointB.terminalIndex
  });
  return true;
}

function updateWiresForComponent(component) {
  circuit.wires.forEach(wire => {
    if (wire.from.group === component || wire.to.group === component) {
      wire.mesh.geometry.dispose();
      wire.mesh.geometry = makeWireGeometry(
        getCircuitTerminalWorldPosition(wire.from, wire.fromTerminal),
        getCircuitTerminalWorldPosition(wire.to, wire.toTerminal)
      );
    }
  });
}

function updateCircuitUI(){
  const current=document.querySelector('#circuit-current');
  const bulb=document.querySelector('#circuit-bulb');
  const obs=document.querySelector('#circuit-observation');
  const fault=document.querySelector('#circuit-fault');
  const overloadActive = circuit.overloadConnected && circuit.switchClosed && !circuit.bulbBlown;
  circuit.current=getCircuitCurrent();
  if(current) current.textContent=`${circuit.current.toFixed(2)} A`;
  if(bulb) {
    bulb.textContent=circuit.shortCircuited?'FAULT':circuit.bulbBlown?'BLOWN':overloadActive&&circuit.overloadTime>1.4?'HOT':circuit.current>0?'ON':'OFF';
    bulb.classList.toggle('is-on', circuit.current > 0 && !circuit.shortCircuited);
  }
  if(fault) {
    fault.classList.toggle('active', circuit.shortCircuited || overloadActive || circuit.bulbBlown);
    fault.classList.toggle('overload', !circuit.shortCircuited && (overloadActive || circuit.bulbBlown));
    fault.textContent = circuit.shortCircuited
      ? 'SHORT CIRCUIT · A wire bypasses the resistor.'
      : circuit.bulbBlown
        ? 'LED BLOWN · Sustained overcurrent overheated the bulb. Reset to replace it.'
        : overloadActive
          ? 'NO RESISTOR · LED current is rising; sustained overload will blow the bulb.'
          : 'SHORT CIRCUIT · Resistor bypassed. Clear wires to stop the simulated fire.';
  }
  if(obs) obs.textContent=circuit.message;
}

function showCircuitControls(){
  experimentControls.innerHTML=`
    <div class="circuit-panel-heading"><span>DC SERIES CIRCUIT</span><strong>Components</strong></div>
    <div class="circuit-palette">
      <button class="circuit-palette-btn" data-component="battery"><strong>Battery</strong><small>6 V source</small></button>
      <button class="circuit-palette-btn" data-component="resistor"><strong>Resistor</strong><small>12 Ω load</small></button>
      <button class="circuit-palette-btn" data-component="switch"><strong>Switch</strong><small>SPST control</small></button>
      <button class="circuit-palette-btn" data-component="bulb"><strong>LED</strong><small>Output indicator</small></button>
    </div>
    <div class="circuit-subheading">Connections</div>
    <div class="control-row">
      <button id="connect-mode" class="control-button">Add Wire</button>
      <button id="clear-wires" class="control-button">Clear Wires</button>
    </div>
    <div class="measurement-grid"><div><span>LED</span><strong id="circuit-bulb">OFF</strong></div><div><span>Voltage</span><strong>6.00 V</strong></div><div><span>Current</span><strong id="circuit-current">0.00 A</strong></div></div>
    <div class="equation"><span>V = IR</span><small>Ohm's law · 6 V / 12 Ω</small></div>
    <div class="circuit-fault" id="circuit-fault" role="status">SHORT CIRCUIT · Resistor bypassed. Clear wires to stop the simulated fire.</div>
    <div class="drag-status" id="circuit-observation">Select components and place them on the bench.</div>
    <button id="reset-circuit" class="control-button reset-experiment">Reset experiment</button>`;

  document.querySelectorAll('.circuit-palette-btn').forEach(btn => {
    btn.addEventListener('click', () => addCircuitComponentFromPalette(btn.dataset.component));
  });

  document.querySelector('#connect-mode').addEventListener('click', toggleConnectionMode);
  document.querySelector('#clear-wires').addEventListener('click', clearWires);
  document.querySelector('#reset-circuit').addEventListener('click', setupCircuit);
  updateCircuitUI();
}

async function activateCircuit(){
  clearHooke();
  clearChemistry();
  await setupCircuit();
  setCircuitCamera(true);
  showCircuitControls();
  instructions.innerHTML=`<h2>Simple Circuit</h2><p>Build a working series loop with a battery, resistor, switch, and LED.</p><ol><li>Add the components to the bench.</li><li>Select <strong>Add Wire</strong>, then click two terminals to join them.</li><li>Connect battery positive through the resistor, LED, and switch back to battery negative.</li><li>Close the switch to observe current. A resistor-free loop overheats the LED; bypassing a resistor causes a short.</li><li>Select a component and press <strong>R</strong> to rotate right or <strong>L</strong> to rotate left.</li></ol><p class="model-note"><strong>Research evidence:</strong> circuit topology drives current, LED state, and fault feedback.</p>`;
}

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
  if (circuit.active) circuit.components.forEach(c => targets.push(c.group));
  if (chemistry.active) {
    if (chemistry.acidBottle) targets.push(chemistry.acidBottle);
    if (chemistry.baseBottle) targets.push(chemistry.baseBottle);
    if (chemistry.precipitateBottle) targets.push(chemistry.precipitateBottle);
    if (chemistry.gasBottle) targets.push(chemistry.gasBottle);
  }
  const hits = raycaster.intersectObjects(targets, true);
  if (!hits.length) {
    selected = null;
    selectEquipmentForRemoval(null);
    return;
  }
  const terminalHit = circuit.active && circuit.connectionMode
    ? hits.find(hit => Number.isInteger(hit.object.userData.circuitTerminalIndex))
    : null;
  const selectionHit = terminalHit ?? hits[0];
  selected = selectionHit.object;
  while (selected.parent && !selected.userData.equipmentType && !selected.userData.isHookeMass && !selected.userData.isCircuitComponent && !selected.userData.isAcidBottle && !selected.userData.isBaseBottle) selected = selected.parent;
  selectEquipmentForRemoval(equipment.includes(selected) ? selected : null);
  if (selected.userData.isCircuitComponent) selectedCircuitComponent = selected;

  // Circuit connection mode
  if (circuit.active && circuit.connectionMode && selected.userData.isCircuitComponent) {
    const component = circuit.components.find(c => c.group === selected);
    if (component) {
      const terminalIndex = terminalHit?.object.userData.circuitTerminalIndex ?? getNearestCircuitTerminalIndex(component);
      const endpoint = { component, terminalIndex };
      const terminalLabel = component.type === 'battery'
        ? endpoint.terminalIndex === 0 ? 'Positive (+)' : 'Negative (-)'
        : component.type === 'bulb'
          ? endpoint.terminalIndex === 0 ? 'Anode (+)' : 'Cathode (-)'
          : endpoint.terminalIndex === 0 ? 'A' : 'B';
      if (!circuit.connectionStart) {
        const label = component.type === 'bulb' ? 'LED' : component.type[0].toUpperCase() + component.type.slice(1);
        circuit.connectionStart = endpoint;
        circuit.message = `${label} terminal ${terminalLabel} selected. Click another terminal to connect it.`;
      } else if (circuit.connectionStart.component !== component || circuit.connectionStart.terminalIndex !== endpoint.terminalIndex) {
        if (createWireBetween(circuit.connectionStart, endpoint)) {
          circuit.message = 'Lead added. Click two more terminals to continue wiring.';
          checkCircuitConnectivity();
        } else {
          updateCircuitUI();
        }
        circuit.connectionStart = null;
        removeTempWire();
      } else {
        circuit.message = 'Choose the other terminal or another component terminal.';
      }
      updateCircuitUI();
    }
    selected = null;
    return;
  }

  if (selected.userData.isCircuitComponent && selected.userData.circuitType === 'switch') {
    toggleCircuitSwitch();
    selected = null;
    return;
  }
  if (chemistry.active && (selected.userData.isAcidBottle || selected.userData.isBaseBottle || selected.userData.isPrecipitateBottle || selected.userData.isGasBottle)) {
    const type = selected.userData.isAcidBottle ? 'acid' :
                selected.userData.isBaseBottle ? 'base' :
                selected.userData.isPrecipitateBottle ? 'precipitate' : 'gas';
    applyChemistryAction(type);
    selected = null;
    controls.enabled = true;
    return;
  }
  controls.enabled = false;
});

renderer.domElement.addEventListener('pointermove', event => {
  if (!selected) {
    if (circuit.active && circuit.connectionMode && circuit.connectionStart) {
      setPointer(event);
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) updateTempWire(dragPoint);
    }
    return;
  }
  setPointer(event);
  raycaster.setFromCamera(pointer, camera);
  if (selected.userData.isHookeMass && !selected.userData.attached) {
    if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
      selected.position.x = dragPoint.x;
      selected.position.z = dragPoint.z;
      selected.position.y = 1.15;
    }
    return;
  }
  if (selected.userData.isCircuitComponent) {
    if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
      selected.position.x = dragPoint.x;
      selected.position.z = dragPoint.z;
      selected.position.y = 1.2;
      updateWiresForComponent(selected);
      if (circuit.fireEffect && circuitComponent('battery')?.group === selected) {
        circuit.fireEffect.root.position.copy(selected.position);
      }
      circuit.connected=false;
      circuit.switchClosed=false;
      circuit.overloadTime=0;
      updateCircuitUI();
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
    const nearSpring = Math.abs(selected.position.x - 2.1) < 0.8 && Math.abs(selected.position.z) < 0.8;
    if (nearSpring && selected === hooke.pendingMass) attachPendingMass();
  }
  if (selected?.userData?.isCircuitComponent) {
    checkCircuitConnectivity();
  }
  selected = null;
  controls.enabled = !circuit.connectionMode;
});

window.addEventListener('keydown', event => {
  const rotationKey = event.key.toLowerCase();
  if (!['r', 'l'].includes(rotationKey) || !circuit.active || !selectedCircuitComponent) return;
  if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
  const direction = rotationKey === 'r' ? 1 : -1;
  selectedCircuitComponent.rotation.y += direction * Math.PI / 12;
  updateWiresForComponent(selectedCircuitComponent);
  if (circuit.fireEffect && circuitComponent('battery')?.group === selectedCircuitComponent) {
    circuit.fireEffect.root.position.copy(selectedCircuitComponent.position);
  }
  circuit.message = `${selectedCircuitComponent.userData.label} rotated ${direction > 0 ? 'right' : 'left'}.`;
  updateCircuitUI();
});

function handleResize() {
  camera.aspect = lab.clientWidth / lab.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(lab.clientWidth, lab.clientHeight);
}

window.addEventListener('resize', handleResize);

document.querySelectorAll('.equipment-card').forEach(card => {
  setupEquipmentPreview(card);

  card.addEventListener('dragstart', event => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', card.dataset.equipment);
    card.classList.add('dragging');
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
  });

  card.addEventListener('click', async event => {
    if (event.target.closest('.equipment-remove')) return;
    const type = card.dataset.equipment;
    const index = equipment.length;
    const x = -3 + (index % 3) * 2.5;
    const z = -1 + Math.floor(index / 3) * 1.7;
    await addEquipmentAtWorkbenchLocation(type, x, z);
  });

  card.addEventListener('keydown', event => {
    if (event.target !== card || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    card.click();
  });

  card.querySelector('.equipment-remove').addEventListener('click', event => {
    event.stopPropagation();
    const type = card.dataset.equipment;
    const object = selectedEquipmentForRemoval?.userData.equipmentType === type
      ? selectedEquipmentForRemoval
      : [...equipment].reverse().find(item => item.userData.equipmentType === type);
    if (object) removeEquipmentObject(object);
  });
});

const equipmentSearch = document.getElementById('equipment-search');
const equipmentEmptyState = document.querySelector('.equipment-empty');

equipmentSearch.addEventListener('input', () => {
  const query = equipmentSearch.value.trim().toLowerCase();
  let visibleCount = 0;

  document.querySelectorAll('.equipment-card').forEach(card => {
    const label = card.querySelector('.equipment-card-label').textContent.toLowerCase();
    const type = card.dataset.equipment.replaceAll('-', ' ').toLowerCase();
    const matches = `${label} ${type}`.includes(query);
    card.hidden = !matches;
    if (matches) visibleCount += 1;
  });

  equipmentEmptyState.hidden = visibleCount > 0;
});

lab.addEventListener('dragover', event => {
  if (!event.dataTransfer || !event.dataTransfer.types.includes('text/plain')) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
});

lab.addEventListener('drop', async event => {
  const type = event.dataTransfer?.getData('text/plain');
  if (!type) return;
  event.preventDefault();

  const point = getBenchDropPoint(event);
  if (!point) return;

  const x = Math.min(4.2, Math.max(-4.2, point.x));
  const z = Math.min(2.9, Math.max(-2.9, point.z));
  await addEquipmentAtWorkbenchLocation(type, x, z);
});

// Sidebar toggle functionality
toggleLeftBtn.addEventListener('click', () => {
  leftSidebar.classList.toggle('collapsed');
  toggleLeftBtn.textContent = leftSidebar.classList.contains('collapsed') ? '▶' : '◀';

  // Update grid columns
  const leftCollapsed = leftSidebar.classList.contains('collapsed');
  const rightCollapsed = rightSidebar.classList.contains('collapsed');

  app.classList.remove('left-collapsed', 'right-collapsed', 'both-collapsed');
  if (leftCollapsed && rightCollapsed) {
    app.classList.add('both-collapsed');
  } else if (leftCollapsed) {
    app.classList.add('left-collapsed');
  } else if (rightCollapsed) {
    app.classList.add('right-collapsed');
  }

  setTimeout(handleResize, 300);
});

toggleRightBtn.addEventListener('click', () => {
  rightSidebar.classList.toggle('collapsed');
  toggleRightBtn.textContent = rightSidebar.classList.contains('collapsed') ? '◀' : '▶';

  // Update grid columns
  const leftCollapsed = leftSidebar.classList.contains('collapsed');
  const rightCollapsed = rightSidebar.classList.contains('collapsed');

  app.classList.remove('left-collapsed', 'right-collapsed', 'both-collapsed');
  if (leftCollapsed && rightCollapsed) {
    app.classList.add('both-collapsed');
  } else if (leftCollapsed) {
    app.classList.add('left-collapsed');
  } else if (rightCollapsed) {
    app.classList.add('right-collapsed');
  }

  setTimeout(handleResize, 300);
});

const experiments = {
  hooke: { title: "Hooke's Law", description: 'Investigate how a spring responds to increasing loads.', steps: ['Click Get 100 g mass.', 'Drag the mass to the spring hanging from the arm.', 'Drop it near the spring to attach it.', 'Add more masses and compare force with extension.'] },
  chemistry: { title: 'Chemistry Reactions', description: 'Explore different types of chemical reactions with visual feedback.', steps: ['Choose a reagent to add to the flask.', 'Mix acids and bases to see pH changes.', 'Add precipitate reagent to see solid particles form.', 'Add gas reagent to see bubbles rise.', 'Toggle heating to raise temperature.'] },
  circuit: { title: 'Simple Circuit', description: 'Prototype workflow for an interactive electricity practical.', steps: ['Place the circuit components.', 'Connect the components.', 'Toggle the switch and observe the bulb.'] }
};

experimentSelect.addEventListener('change', async () => {
  const id = experimentSelect.value;
  if (id === 'hooke') { await activateHooke(); return; }
  if (id === 'chemistry') { await activateChemistry(); return; }
  if (id === 'circuit') { await activateCircuit(); return; }
  clearHooke();
  clearChemistry();
  clearCircuit();
  experimentControls.innerHTML = '';
  instructions.innerHTML = `<h2>${experiments[id].title}</h2><p>${experiments[id].description}</p><ol>${experiments[id].steps.map(step => `<li>${step}</li>`).join('')}</ol>`;
});

document.querySelector('#reset').addEventListener('click', async () => {
  equipment.forEach(object => scene.remove(object));
  equipment.length = 0;
  clearCircuit();
  selected = null;
  selectEquipmentForRemoval(null);
  experimentSelect.value = 'hooke';
  await activateHooke();
});

let lastPhysicsTime = performance.now();

function animate(time = 0) {
  const now = performance.now();
  const deltaSeconds = Math.min((now - lastPhysicsTime) / 1000, 0.05);
  lastPhysicsTime = now;

  stepPhysics(physicsWorld, physicsSystems, deltaSeconds);
  syncHookePhysics();

  controls.update();
  chemistry.stirPhase = time * 0.001;
  if (chemistry.active) {
    if (chemistry.liquid) chemistry.liquid.material.color.lerp(chemistry.liquidTargetColor, 0.08);

    // Animate precipitate particles
    chemistry.precipitate.forEach(p => {
      p.position.y -= p.userData.sink * deltaSeconds;
      if (p.position.y < 0.52) p.position.y = 0.52;
    });

    // Animate gas particles
    chemistry.gasParticles.forEach(g => {
      g.position.y += g.userData.rise * deltaSeconds;
      g.userData.wobble += deltaSeconds * 2;
      g.position.x += Math.sin(g.userData.wobble) * 0.01;
      g.position.z += Math.cos(g.userData.wobble) * 0.01;
      g.material.opacity = Math.max(0, 0.6 - (g.position.y - 0.7) * 0.8);
      if (g.position.y > 1.3) {
        scene.remove(g);
        const index = chemistry.gasParticles.indexOf(g);
        if (index > -1) chemistry.gasParticles.splice(index, 1);
      }
    });

    // Heating effect
    if (chemistry.isHeating) {
      chemistry.temperature = Math.min(100, chemistry.temperature + deltaSeconds * 8);
      chemistry.heatIntensity = THREE.MathUtils.lerp(chemistry.heatIntensity, 1, 0.05);
    } else {
      chemistry.temperature = Math.max(25, chemistry.temperature - deltaSeconds * 3);
      chemistry.heatIntensity = THREE.MathUtils.lerp(chemistry.heatIntensity, 0, 0.03);
    }

    // Spawn gas bubbles when heating
    if (chemistry.isHeating && chemistry.volume > 0 && Math.random() < 0.3) {
      spawnBubble();
    }

    // Update thermometer
    if (chemistry.thermometer) {
      const tempHeight = (chemistry.temperature - 25) / 75 * 0.4;
      chemistry.thermometer.children[2].scale.y = 0.5 + tempHeight;
      chemistry.thermometer.children[2].position.y = 0.25 + tempHeight / 2;
    }

    updateChemistryUI();
  }
  if (circuit.active) {
    const bulb = circuitComponent('bulb');
    const glass = bulb?.group.userData.glass;
    if (circuit.overloadConnected && circuit.switchClosed && !circuit.bulbBlown) {
      circuit.overloadTime += deltaSeconds;
      if (circuit.overloadTime >= 4.5) blowCircuitBulb();
    }
    circuit.current = getCircuitCurrent();
    animateShortCircuitEffect(deltaSeconds);
    animateBulbBurnout(deltaSeconds);
    if (glass) {
      const lampOn = circuit.current > 0 && !circuit.shortCircuited && !circuit.bulbBlown;
      const overloadHeat = circuit.overloadConnected ? THREE.MathUtils.clamp(circuit.overloadTime / 4.5, 0, 1) : 0;
      circuit.bulbGlow = THREE.MathUtils.lerp(circuit.bulbGlow, lampOn ? 1 : 0, 0.08);
      glass.material.emissive.set(lampOn ? (overloadHeat > 0.65 ? 0xff4b20 : 0xffd166) : 0x000000);
      glass.material.emissiveIntensity = circuit.bulbGlow * (1.7 + overloadHeat * 3.8);
      glass.material.color.set(circuit.bulbBlown ? 0x383b3e : lampOn && overloadHeat > 0.55 ? 0xffffb0 : lampOn ? 0xfff4b8 : 0xf8fafc);
      if ('opacity' in glass.material) glass.material.opacity = circuit.bulbBlown ? 0.38 : 0.72;
    }
    const currentPath = getCircuitCurrentPath();
    const pathLength = currentPath.reduce((total, segment) => total + segment.length, 0);
    if (pathLength > 0 && circuit.electrons.length < 18) {
      const e=new THREE.Mesh(new THREE.SphereGeometry(0.035,8,8),new THREE.MeshStandardMaterial({color:0x38bdf8,emissive:0x0ea5e9,emissiveIntensity:1.2}));
      e.userData.t=Math.random(); scene.add(e); circuit.electrons.push(e);
    }
    if (pathLength === 0 && circuit.electrons.length) removeCircuitElectrons();
    circuit.electrons.forEach(e=>{
      e.userData.t=(e.userData.t+0.0025)%1;
      let distance = e.userData.t * pathLength;
      for (const segment of currentPath) {
        if (distance <= segment.length) {
          const progress = distance / segment.length;
          e.position.copy(segment.curve.getPointAt(segment.forward ? progress : 1 - progress));
          break;
        }
        distance -= segment.length;
      }
    });
    updateCircuitUI();
  }
  renderer.render(scene, camera);
}

activateHooke().catch(err => console.error('Failed to initialize Hooke experiment:', err));
renderer.setAnimationLoop(animate);
