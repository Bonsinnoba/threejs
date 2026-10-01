import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadModel, normalizeModel } from './model-loader.js';

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
let flaskModel = null;
let flaskLoadPromise = null;
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

async function loadRealFlask() {
  if (flaskModel) return flaskModel;
  if (flaskLoadPromise) return flaskLoadPromise;

  flaskLoadPromise = loadModel('./models/erlenmeyer-flask.glb')
    .then(model => {
      normalizeModel(model, 1.65);
      model.userData.equipmentType = 'flask';
      model.traverse(object => {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
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

async function addFlask() {
  const model = await loadRealFlask();
  if (!model) {
    addEquipment('flask');
    return;
  }
  const flask = model.clone(true);
  addToEquipment(flask, 'flask');
  const index = equipment.length;
  flask.position.set(-3 + (index % 3) * 2.5, 0.34, -1 + Math.floor(index / 3) * 1.7);
  scene.add(flask);
  equipment.push(flask);
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
  massPerUnit: 0.1,
  springConstant: 19.6,
  naturalLength: 1.35,
  minLength: 0.75,
  maxLength: 2.55,
};

function makeSpringCurve(length) {
  const points = [];
  const turns = 18;
  const radius = 0.23;
  const topY = 3.93;
  const anchorX = 1.05;
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
  const length = THREE.MathUtils.clamp(hooke.naturalLength + extension, hooke.minLength, hooke.maxLength);
  scene.remove(hooke.spring);
  hooke.spring.geometry.dispose();
  hooke.spring = createSpring(length);
  scene.add(hooke.spring);
  const bottomY = 3.93 - length;
  hooke.masses.forEach((mass, index) => mass.position.set(1.05, bottomY - 0.25 - index * 0.32, 0));
}

function updateHookeUI() {
  const { massKg, force, extension } = getHookeMeasurements();
  const set = (selector, value) => { const el = document.querySelector(selector); if (el) el.textContent = value; };
  set('#mass-count', hooke.massCount);
  set('#mass-value', `${Math.round(massKg * 1000)} g`);
  set('#force-value', `${force.toFixed(2)} N`);
  set('#extension-value', `${(extension * 100).toFixed(1)} cm`);
  set('#pending-mass', hooke.pendingMass ? 'Drag the mass to the spring' : 'No mass waiting');
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
    <div class="control-row"><button id="add-mass" class="control-button primary">+ Get 100 g mass</button><button id="remove-mass" class="control-button">− Remove</button></div>
    <div class="drag-status" id="pending-mass">No mass waiting</div>
    <div class="measurement-grid"><div><span>Masses attached</span><strong id="mass-count">0</strong></div><div><span>Total mass</span><strong id="mass-value">0 g</strong></div><div><span>Force</span><strong id="force-value">0.00 N</strong></div><div><span>Extension</span><strong id="extension-value">0.0 cm</strong></div></div>
    <div class="equation"><span>F = kx</span><small>Spring constant k = ${hooke.springConstant.toFixed(1)} N/m</small></div>
    <button id="reset-hooke" class="control-button reset-experiment">Reset experiment</button>`;
  document.querySelector('#add-mass').addEventListener('click', createPendingMass);
  document.querySelector('#remove-mass').addEventListener('click', removeMass);
  document.querySelector('#reset-hooke').addEventListener('click', resetHooke);
  updateHookeUI();
}

function activateHooke() {
  hooke.active = true;
  setupHooke();
  instructions.innerHTML = `<h2>Hooke's Law</h2><p>Investigate how the extension of a spring changes when a load is added.</p><p class="model-note"><strong>3D model evidence:</strong> the Flask tool uses a real GLB asset with attribution documented below.</p><ol><li>Click <strong>Get 100 g mass</strong>.</li><li>Drag the mass from the bench to the spring hanging from the arm.</li><li>Drop it near the spring to attach it.</li><li>Add more masses and compare force with extension.</li></ol>`;
  showHookeControls();
}

// ---------------- Acid / Base visual chemistry lab ----------------
const chemistry = {
  active: false,
  mode: 'indicator',
  liquid: null,
  liquidTargetColor: new THREE.Color(0x78d7ff),
  beaker: null,
  reagent: null,
  bubbles: [],
  precipitate: [],
  droplets: [],
  stirPhase: 0,
  volume: 0.65,
  acid: 0,
  base: 0,
  soluteA: 0,
  soluteB: 0,
  temperature: 25,
  message: 'Ready for a new observation.'
};

function clearChemistry() {
  if (chemistry.beaker) scene.remove(chemistry.beaker);
  if (chemistry.reagent) scene.remove(chemistry.reagent);
  chemistry.bubbles.forEach(b => scene.remove(b));
  chemistry.precipitate.forEach(p => scene.remove(p));
  chemistry.droplets.forEach(d => scene.remove(d));
  chemistry.bubbles = [];
  chemistry.precipitate = [];
  chemistry.droplets = [];
  chemistry.liquid = null;
  chemistry.beaker = null;
  chemistry.reagent = null;
}

function createChemBeaker() {
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
    new THREE.CylinderGeometry(0.82, 0.72, 0.72, 48),
    new THREE.MeshPhysicalMaterial({ color: chemistry.liquidTargetColor, transparent: true, opacity: 0.82, roughness: 0.12 })
  );
  liquid.position.y = 0.82;
  group.add(liquid);
  chemistry.liquid = liquid;
  group.position.set(0, 0.35, 0);
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
  scene.add(drop);
  chemistry.droplets.push(drop);
}

function spawnBubble() {
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.035 + Math.random() * 0.045, 12, 8), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.42, roughness: 0, transmission: 0.2 }));
  bubble.position.set((Math.random() - 0.5) * 1.25, 0.7 + Math.random() * 0.2, (Math.random() - 0.5) * 1.25);
  bubble.userData.speed = 0.35 + Math.random() * 0.55;
  bubble.userData.life = 0;
  scene.add(bubble);
  chemistry.bubbles.push(bubble);
}

function spawnPrecipitate() {
  const particle = new THREE.Mesh(new THREE.SphereGeometry(0.025 + Math.random() * 0.04, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf5f5dc, roughness: 0.8 }));
  particle.position.set((Math.random() - 0.5) * 1.3, 0.52 + Math.random() * 0.9, (Math.random() - 0.5) * 1.3);
  particle.userData.sink = 0.08 + Math.random() * 0.16;
  scene.add(particle);
  chemistry.precipitate.push(particle);
}

function setChemistryLiquid(color, height = 0.72) {
  if (!chemistry.liquid) return;
  chemistry.liquidTargetColor.set(color);
  chemistry.liquid.material.color.lerp(chemistry.liquidTargetColor, 0.35);
  chemistry.liquid.scale.y = Math.max(0.15, height / 0.72);
  chemistry.liquid.position.y = 0.46 + height / 2;
}

function chemistryState() {
  if (chemistry.mode === 'indicator') {
    const net = chemistry.base - chemistry.acid;
    const pH = THREE.MathUtils.clamp(7 + net * 1.7, 1, 13);
    let color = 0xf3f1a7;
    let label = 'Near neutral';
    if (pH < 4) { color = 0xf05a67; label = 'Acidic'; }
    else if (pH < 6.5) { color = 0xff9f43; label = 'Weakly acidic'; }
    else if (pH > 10) { color = 0x7b61ff; label = 'Basic'; }
    else if (pH > 7.5) { color = 0x4fd1c5; label = 'Weakly basic'; }
    return { pH, color, label };
  }
  if (chemistry.mode === 'bubbles') {
    const reacted = Math.min(chemistry.acid, chemistry.base);
    return { reacted, color: 0x9bdcff, label: reacted > 0 ? 'Carbon dioxide is being simulated' : 'Ready to add acid' };
  }
  return { reacted: Math.min(chemistry.soluteA, chemistry.soluteB), color: 0xd9e7ff, label: chemistry.precipitate.length ? 'Solid precipitate is forming' : 'Clear solution' };
}

function applyChemistryAction(action) {
  if (chemistry.mode === 'indicator') {
    if (action === 'acid') chemistry.acid += 0.65;
    if (action === 'base') chemistry.base += 0.65;
    chemistry.volume = Math.min(1.2, chemistry.volume + 0.08);
    addChemDroplet(action === 'acid' ? 0xf05a67 : 0x7b61ff);
    const state = chemistryState();
    setChemistryLiquid(state.color, chemistry.volume);
    chemistry.message = `Indicator observation: ${state.label.toLowerCase()}.`;
  } else if (chemistry.mode === 'bubbles') {
    if (action === 'acid') {
      chemistry.acid += 1;
      chemistry.volume = Math.min(1.2, chemistry.volume + 0.06);
      for (let i = 0; i < 10; i++) spawnBubble();
      addChemDroplet(0xf05a67);
      chemistry.message = 'Acid added to carbonate: visible gas bubbles are simulated.';
    } else if (action === 'carbonate') {
      chemistry.base += 1;
      chemistry.volume = Math.min(1.2, chemistry.volume + 0.06);
      for (let i = 0; i < 8; i++) spawnBubble();
      addChemDroplet(0xd5d0a8);
      chemistry.message = 'Carbonate added: watch the gas bubbles rise.';
    }
    setChemistryLiquid(0x9bdcff, chemistry.volume);
  } else {
    if (action === 'saltA') chemistry.soluteA += 1;
    if (action === 'saltB') chemistry.soluteB += 1;
    chemistry.volume = Math.min(1.2, chemistry.volume + 0.06);
    addChemDroplet(action === 'saltA' ? 0x4f86c6 : 0xe8c96a);
    if (chemistry.soluteA > 0 && chemistry.soluteB > 0) {
      for (let i = 0; i < 5; i++) spawnPrecipitate();
      setChemistryLiquid(0xd9e7ff, chemistry.volume);
      chemistry.message = 'Two clear solutions have been mixed; a solid precipitate is simulated.';
    } else {
      setChemistryLiquid(0xcfefff, chemistry.volume);
      chemistry.message = 'Add the second solution to observe the visible change.';
    }
  }
  updateChemistryUI();
}

function resetChemistry() {
  chemistry.acid = 0;
  chemistry.base = 0;
  chemistry.soluteA = 0;
  chemistry.soluteB = 0;
  chemistry.temperature = 25;
  chemistry.volume = 0.65;
  chemistry.message = 'Ready for a new observation.';
  chemistry.bubbles.forEach(b => scene.remove(b));
  chemistry.precipitate.forEach(p => scene.remove(p));
  chemistry.droplets.forEach(d => scene.remove(d));
  chemistry.bubbles = [];
  chemistry.precipitate = [];
  chemistry.droplets = [];
  setChemistryLiquid(chemistry.mode === 'indicator' ? 0x78d7ff : 0xcfefff, 0.65);
  updateChemistryUI();
}

function updateChemistryUI() {
  const state = chemistryState();
  const status = document.querySelector('#chem-status');
  const metric = document.querySelector('#chem-metric');
  const observation = document.querySelector('#chem-observation');
  if (status) status.textContent = state.label;
  if (observation) observation.textContent = chemistry.message;
  if (metric) {
    if (chemistry.mode === 'indicator') metric.textContent = `pH ${state.pH.toFixed(1)}`;
    if (chemistry.mode === 'bubbles') metric.textContent = `${chemistry.bubbles.length} visible bubbles`;
    if (chemistry.mode === 'precipitate') metric.textContent = `${chemistry.precipitate.length} solid particles`;
  }
}

function showChemistryControls() {
  const buttonText = chemistry.mode === 'indicator'
    ? ['Add acid', 'Add base']
    : chemistry.mode === 'bubbles'
      ? ['Add acid', 'Add carbonate']
      : ['Add solution A', 'Add solution B'];

  experimentControls.innerHTML = `
    <div class="control-title">Acid / Base visual reactions</div>
    <div class="chem-tabs">
      <button class="chem-tab ${chemistry.mode === 'indicator' ? 'active' : ''}" data-chem-mode="indicator">Color change</button>
      <button class="chem-tab ${chemistry.mode === 'bubbles' ? 'active' : ''}" data-chem-mode="bubbles">Bubbles</button>
      <button class="chem-tab ${chemistry.mode === 'precipitate' ? 'active' : ''}" data-chem-mode="precipitate">Precipitate</button>
    </div>
    <div class="control-row"><button id="chem-action-a" class="control-button primary">${buttonText[0]}</button><button id="chem-action-b" class="control-button">${buttonText[1]}</button></div>
    <div class="measurement-grid"><div><span>Status</span><strong id="chem-status">Ready</strong></div><div><span>Observation</span><strong id="chem-metric">pH 7.0</strong></div></div>
    <div class="drag-status" id="chem-observation">Ready for a new observation.</div>
    <button id="reset-chem" class="control-button reset-experiment">Reset experiment</button>`;

  document.querySelectorAll('[data-chem-mode]').forEach(button => button.addEventListener('click', () => {
    chemistry.mode = button.dataset.chemMode;
    setupChemistry();
  }));
  document.querySelector('#chem-action-a').addEventListener('click', () => applyChemistryAction(chemistry.mode === 'indicator' || chemistry.mode === 'bubbles' ? 'acid' : 'saltA'));
  document.querySelector('#chem-action-b').addEventListener('click', () => applyChemistryAction(chemistry.mode === 'indicator' ? 'base' : chemistry.mode === 'bubbles' ? 'carbonate' : 'saltB'));
  document.querySelector('#reset-chem').addEventListener('click', resetChemistry);
  updateChemistryUI();
}

function setupChemistry() {
  clearChemistry();
  chemistry.active = true;
  chemistry.beaker = createChemBeaker();
  scene.add(chemistry.beaker);
  const reagentColor = chemistry.mode === 'indicator' ? 0x64748b : chemistry.mode === 'bubbles' ? 0xd5d0a8 : 0x4f86c6;
  chemistry.reagent = createReagentBottle('reagent', reagentColor);
  scene.add(chemistry.reagent);
  resetChemistry();
  showChemistryControls();
}

function activateChemistry() {
  clearHooke();
  chemistry.mode = 'indicator';
  setupChemistry();
  instructions.innerHTML = `<h2>Acid / Base: visible reactions</h2><p>This milestone demonstrates three different observable chemistry changes using a simple simulation.</p><ol><li><strong>Color:</strong> add acid or base and watch the indicator respond to pH.</li><li><strong>Bubbles:</strong> add acid and carbonate and observe simulated gas bubbles rising.</li><li><strong>Precipitate:</strong> mix two clear solutions and observe simulated solid particles forming.</li></ol><p class="model-note"><strong>Research note:</strong> these are visual educational simulations; the displayed effects are driven by experiment state rather than a full chemical solver.</p>`;
}


// ---------------- Simple Circuit experiment ----------------
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
  message: 'Place the components on their matching pads.'
};

function clearCircuit() {
  circuit.components.forEach(c => scene.remove(c.group));
  circuit.wires.forEach(w => {
    scene.remove(w.line);
    if (w.geometry) w.geometry.dispose();
    if (w.material) w.material.dispose();
  });
  circuit.electrons.forEach(e => scene.remove(e));
  circuit.components = [];
  circuit.wires = [];
  circuit.electrons = [];
  circuit.current = 0;
  circuit.switchClosed = false;
  circuit.connected = false;
  circuit.bulbGlow = 0;
}

function makeCircuitComponent(type, label) {
  const group = new THREE.Group();
  group.userData.isCircuitComponent = true;
  group.userData.circuitType = type;
  group.userData.label = label;
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.35, roughness: 0.4 });

  if (type === 'battery') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.55, 0.7), bodyMat);
    body.position.y = 0.62;
    group.add(body);
    const positive = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.18,16), new THREE.MeshStandardMaterial({color:0xef4444, metalness:0.5}));
    positive.position.set(0.22,0.98,0); group.add(positive);
    const negative = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.18,16), new THREE.MeshStandardMaterial({color:0x111827, metalness:0.5}));
    negative.position.set(-0.22,0.98,0); group.add(negative);
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
  return group;
}

function addCircuitComponent(type, target) {
  const group=makeCircuitComponent(type,type);
  group.position.copy(target);
  scene.add(group);
  const item={type,group,target:target.clone(),placed:true};
  circuit.components.push(item);
  return item;
}

function circuitTargets() {
  return {
    battery:new THREE.Vector3(-2.3,0,-0.9),
    resistor:new THREE.Vector3(0,0,-0.9),
    switch:new THREE.Vector3(2.3,0,-0.9),
    bulb:new THREE.Vector3(0,0,1.45)
  };
}

function setupCircuit() {
  clearCircuit();
  circuit.active=true;
  const t=circuitTargets();
  addCircuitComponent('battery',t.battery);
  addCircuitComponent('resistor',t.resistor);
  addCircuitComponent('switch',t.switch);
  addCircuitComponent('bulb',t.bulb);
  buildCircuitWires();
  updateCircuitUI();
}

function circuitComponent(name) { return circuit.components.find(c=>c.type===name); }

function wireBetween(a,b) {
  const points=[a.clone().add(new THREE.Vector3(0,0.72,0)),b.clone().add(new THREE.Vector3(0,0.72,0))];
  const geometry=new THREE.BufferGeometry().setFromPoints(points);
  const material=new THREE.LineBasicMaterial({color:0x334155,linewidth:3});
  const line=new THREE.Line(geometry,material); scene.add(line);
  return {line,geometry,material,a,b};
}

function buildCircuitWires() {
  circuit.wires.forEach(w=>{scene.remove(w.line);w.geometry.dispose();w.material.dispose();});
  circuit.wires=[];
  const b=circuitComponent('battery')?.group.position;
  const r=circuitComponent('resistor')?.group.position;
  const sw=circuitComponent('switch')?.group.position;
  const bulb=circuitComponent('bulb')?.group.position;
  if(!b||!r||!sw||!bulb) return;
  circuit.wires.push(wireBetween(b,r),wireBetween(r,sw),wireBetween(sw,bulb),wireBetween(b,bulb));
}

function allCircuitComponentsPlaced() {
  return circuit.components.length===4 && circuit.components.every(c=>c.group.position.distanceTo(c.target)<0.35);
}

function toggleCircuitSwitch() {
  if(!circuit.connected){circuit.message='Place all four components on their matching pads first.'; updateCircuitUI(); return;}
  circuit.switchClosed=!circuit.switchClosed;
  circuit.message=circuit.switchClosed?'Switch closed: current is flowing.':'Switch open: current stopped.';
  const sw=circuitComponent('switch');
  if(sw?.group.userData.lever) sw.group.userData.lever.rotation.z=circuit.switchClosed?-0.35:0.35;
  updateCircuitUI();
}

function checkCircuit() {
  circuit.connected=allCircuitComponentsPlaced();
  if(circuit.connected){
    circuit.message='Circuit connected. Close the switch to light the bulb.';
  } else {
    circuit.message='Some components are not on their matching pads yet.';
  }
  updateCircuitUI();
}

function updateCircuitUI(){
  const status=document.querySelector('#circuit-status');
  const current=document.querySelector('#circuit-current');
  const bulb=document.querySelector('#circuit-bulb');
  const obs=document.querySelector('#circuit-observation');
  if(status) status.textContent=circuit.connected?'Connected':'Not connected';
  circuit.current=circuit.connected&&circuit.switchClosed?circuit.voltage/circuit.resistance:0;
  if(current) current.textContent=`${circuit.current.toFixed(2)} A`;
  if(bulb) bulb.textContent=circuit.current>0?'ON':'OFF';
  if(obs) obs.textContent=circuit.message;
}

function showCircuitControls(){
  experimentControls.innerHTML=`
    <div class="control-title">Simple Circuit controls</div>
    <div class="control-row"><button id="check-circuit" class="control-button primary">Check connections</button><button id="toggle-switch" class="control-button">Close switch</button></div>
    <div class="measurement-grid"><div><span>Connection</span><strong id="circuit-status">Not connected</strong></div><div><span>Bulb</span><strong id="circuit-bulb">OFF</strong></div><div><span>Voltage</span><strong>6.00 V</strong></div><div><span>Current</span><strong id="circuit-current">0.00 A</strong></div></div>
    <div class="equation"><span>V = IR</span><small>Battery 6 V · Resistor 12 Ω</small></div>
    <div class="drag-status" id="circuit-observation">Place the components on their matching pads.</div>
    <button id="reset-circuit" class="control-button reset-experiment">Reset experiment</button>`;
  document.querySelector('#check-circuit').addEventListener('click',checkCircuit);
  document.querySelector('#toggle-switch').addEventListener('click',()=>{toggleCircuitSwitch();document.querySelector('#toggle-switch').textContent=circuit.switchClosed?'Open switch':'Close switch';});
  document.querySelector('#reset-circuit').addEventListener('click',setupCircuit);
  updateCircuitUI();
}

function activateCircuit(){
  clearHooke();
  clearChemistry();
  setupCircuit();
  showCircuitControls();
  instructions.innerHTML=`<h2>Simple Circuit</h2><p>Build a basic series circuit and observe the relationship between voltage, resistance, current, and bulb state.</p><ol><li>Drag each component onto its matching pad.</li><li>Click <strong>Check connections</strong>.</li><li>Close the switch.</li><li>Observe the bulb and calculated current.</li></ol><p class="model-note"><strong>Research evidence:</strong> component placement, circuit state, and visual feedback are all driven by the same experiment state.</p>`;
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
  const hits = raycaster.intersectObjects(targets, true);
  if (!hits.length) return;
  selected = hits[0].object;
  while (selected.parent && !selected.userData.equipmentType && !selected.userData.isHookeMass && !selected.userData.isCircuitComponent) selected = selected.parent;
  if (selected.userData.isCircuitComponent && selected.userData.circuitType === 'switch') {
    toggleCircuitSwitch();
    selected = null;
    return;
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
  if (selected.userData.isCircuitComponent) {
    if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
      selected.position.x = dragPoint.x;
      selected.position.z = dragPoint.z;
      selected.position.y = 0;
      const item=circuit.components.find(c=>c.group===selected);
      if(item && selected.position.distanceTo(item.target)<0.35){
        selected.position.copy(item.target);
      }
      buildCircuitWires();
      circuit.connected=false;
      circuit.switchClosed=false;
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
    const nearSpring = Math.abs(selected.position.x - 1.05) < 0.8 && Math.abs(selected.position.z) < 0.8;
    if (nearSpring && selected === hooke.pendingMass) attachPendingMass();
  }
  if (selected?.userData?.isCircuitComponent) {
    const item=circuit.components.find(c=>c.group===selected);
    if(item && selected.position.distanceTo(item.target)<0.6) selected.position.copy(item.target);
    buildCircuitWires();
    circuit.connected=allCircuitComponentsPlaced();
    circuit.message=circuit.connected?'Circuit connected. Close the switch to light the bulb.':'Keep placing components on their matching pads.';
    updateCircuitUI();
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
  button.addEventListener('click', () => {
    if (button.dataset.equipment === 'flask') addFlask();
    else addEquipment(button.dataset.equipment);
  });
});

const experiments = {
  hooke: { title: "Hooke's Law", description: 'Investigate how a spring responds to increasing loads.', steps: ['Click Get 100 g mass.', 'Drag the mass to the spring hanging from the arm.', 'Drop it near the spring to attach it.', 'Add more masses and compare force with extension.'] },
  'acid-base': { title: 'Acid / Base', description: 'Explore visible changes produced by simulated chemistry interactions.', steps: ['Choose Color change, Bubbles, or Precipitate.', 'Add the two reagents shown in the controls.', 'Watch the liquid, particles, and status change.', 'Reset and try another observation.'] },
  circuit: { title: 'Simple Circuit', description: 'Prototype workflow for an interactive electricity practical.', steps: ['Place the circuit components.', 'Connect the components.', 'Toggle the switch and observe the bulb.'] }
};

document.querySelectorAll('[data-experiment]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.experiment').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    const id = button.dataset.experiment;
    if (id === 'hooke') { activateHooke(); return; }
    if (id === 'acid-base') { activateChemistry(); return; }
    if (id === 'circuit') { activateCircuit(); return; }
    clearHooke();
    clearChemistry();
    clearCircuit();
    experimentControls.innerHTML = '';
    instructions.innerHTML = `<h2>${experiments[id].title}</h2><p>${experiments[id].description}</p><ol>${experiments[id].steps.map(step => `<li>${step}</li>`).join('')}</ol>`;
  });
});

document.querySelector('#reset').addEventListener('click', () => {
  equipment.forEach(object => scene.remove(object));
  equipment.length = 0;
  clearCircuit();
  selected = null;
  document.querySelectorAll('.experiment').forEach(item => item.classList.remove('active'));
  document.querySelector('[data-experiment="hooke"]').classList.add('active');
  activateHooke();
});

function animate(time = 0) {
  controls.update();
  chemistry.stirPhase = time * 0.001;
  if (chemistry.active) {
    chemistry.bubbles.forEach((bubble, index) => {
      bubble.position.y += bubble.userData.speed * 0.006;
      bubble.position.x += Math.sin(time * 0.002 + index) * 0.0009;
      if (bubble.position.y > 1.95) bubble.position.y = 0.62;
    });
    chemistry.precipitate.forEach(p => {
      p.position.y = Math.max(0.43, p.position.y - p.userData.sink * 0.002);
      p.position.x += Math.sin(time * 0.001 + p.position.y) * 0.0005;
    });
    chemistry.droplets.forEach(drop => {
      drop.userData.life += 0.035;
      drop.position.y -= 0.055;
      if (drop.userData.life > 1 || drop.position.y < 0.8) {
        scene.remove(drop);
        const i = chemistry.droplets.indexOf(drop);
        if (i >= 0) chemistry.droplets.splice(i, 1);
      }
    });
    if (chemistry.liquid) chemistry.liquid.material.color.lerp(chemistry.liquidTargetColor, 0.045);
  }
  if (circuit.active) {
    const bulb = circuitComponent('bulb');
    const glass = bulb?.group.userData.glass;
    circuit.current = circuit.connected && circuit.switchClosed ? circuit.voltage / circuit.resistance : 0;
    if (glass) {
      circuit.bulbGlow = THREE.MathUtils.lerp(circuit.bulbGlow, circuit.current > 0 ? 1 : 0, 0.08);
      glass.material.emissive.set(circuit.current > 0 ? 0xffd166 : 0x000000);
      glass.material.emissiveIntensity = circuit.bulbGlow * 1.7;
      glass.material.color.set(circuit.current > 0 ? 0xfff4b8 : 0xf8fafc);
    }
    if (circuit.current > 0 && circuit.electrons.length < 18) {
      const e=new THREE.Mesh(new THREE.SphereGeometry(0.035,8,8),new THREE.MeshStandardMaterial({color:0x38bdf8,emissive:0x0ea5e9,emissiveIntensity:1.2}));
      e.userData.t=Math.random(); scene.add(e); circuit.electrons.push(e);
    }
    circuit.electrons.forEach(e=>{
      e.userData.t=(e.userData.t+0.0025)%1;
      const b=circuitComponent('battery')?.group.position;
      const r=circuitComponent('resistor')?.group.position;
      const sw=circuitComponent('switch')?.group.position;
      const bl=circuitComponent('bulb')?.group.position;
      if(b&&r&&sw&&bl){
        const points=[b,r,sw,bl,b];
        const scaled=e.userData.t*(points.length-1); const i=Math.floor(scaled); const f=scaled-i;
        const a=points[i], z=points[Math.min(i+1,points.length-1)];
        e.position.lerpVectors(a,z,f); e.position.y+=0.75;
      }
    });
    updateCircuitUI();
  }
  renderer.render(scene, camera);
}

activateHooke();
renderer.setAnimationLoop(animate);
