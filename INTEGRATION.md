# Integration guide (glassware + lab room + interactive storage)

Copy these next to `main.js`: `glass-profiles.js`, `glassware.js`, `apparatus.js`, `lab-logic.js`, `catalog.js`,
`labBench.js`, `labLabels.js`, `labInventory.js`.  Run `node test-profiles.mjs && node test-logic.mjs` to check the pure maths.

## 1. main.js — imports
```js
import { setupGlassEnvironment, createGlassware, renderGlassPreview, isGlassType } from './glassware.js';
import { createLabBench } from './labBench.js';
import { LabelLayer } from './labLabels.js';
import { LabInventory } from './labInventory.js';
```

## 2. main.js — scene, camera, lights
```js
scene.background = new THREE.Color(0x56636b);              // matches the room, so nothing looks like a void

camera.position.set(4, 6.5, 13.5);                         // frames island + wall shelves
const defaultTarget = new THREE.Vector3(0, 3, -3);
controls.target.copy(defaultTarget);
controls.minDistance = 3;
controls.maxDistance = 24;
```
Because the experiments call `setCircuitCamera(false)`, change the target line inside it:
```js
function setCircuitCamera(active) {
  ...
  controls.target.copy(active ? new THREE.Vector3(0, 1.2, 0) : defaultTarget);   // was controls.target.set(0, 1.2, 0)
  ...
}
```
Lights (replace the existing hemisphere/directional block):
```js
scene.add(new THREE.HemisphereLight(0xffffff, 0x64748b, 1.3));
const light = new THREE.DirectionalLight(0xffffff, 2.2);
light.position.set(6, 22, 12);
light.castShadow = true;
light.shadow.mapSize.set(2048, 2048);
Object.assign(light.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
light.shadow.bias = -0.0005;
scene.add(light);
```

## 3. main.js — replace the old bench
Delete everything from `// Create a more realistic lab workbench` through `scene.add(grid)` (benchGroup, wall, grid).
Then, once `controls` exists and `circuit` is declared further down is fine (it's only read inside the callback):
```js
setupGlassEnvironment(renderer, scene);
const labBench = createLabBench(scene);
const labels = new LabelLayer(lab, camera, renderer);          // adds the "Labels: off" button + tooltips
const inventory = new LabInventory({
  scene, camera, renderer, bench: labBench, labels,
  setControlsEnabled: (v) => { controls.enabled = v && !circuit.connectionMode; },
});
inventory.stock();                                             // fills shelves, drawers and cupboard
// optional: inventory.onChange((type, data) => console.log(type, data));   // pick / place / surface / toggle / select
```

## 4. main.js — per-frame, reset, spawn height
```js
// in animate(), right after stepPhysics(...)
inventory.update(deltaSeconds);

// in the '#reset' click handler
inventory.reset();

// the bench surface is y = 1.2 (was treated as 1.0 for dragging)
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.2);
```
Hint text: `document.querySelector('.hint').textContent = 'Drag items from shelves and drawers. Click drawers and doors to open them.';`

## 5. Palette glassware (optional, from step 1)
Same snippets as before: in `addEquipmentAtWorkbenchLocation` spawn with `createGlassware(type)` at `y = 1.2`,
and in `setupEquipmentPreview` use `renderGlassPreview(type)`. New palette types you can add:
`reagent-bottle`, `round-flask`, `conical-flask`, `measuring-cylinder` (plus `beaker`, `test-tube`).

## 6. Existing bug worth fixing now
In the chemistry scene the Bunsen burner, crucible and petri dish spawn at y = 0.35 / 0.5 / 0.35 — below the
worktop (1.2) — so they are buried. Set their y to 1.2.

## What you can do in the lab now
- Drag any item from a wall shelf, drawer or cupboard onto the island or back counter (it snaps clear of neighbours).
- Drop onto an empty shelf/drawer slot (cyan ring shows the target). Drop in empty space and it returns home.
- Click a drawer or cupboard door to open/close it; things inside are only pickable while it is open.
- Drawers hold small items only (a flask is refused and goes home); shelves and cupboard hold anything.
- Labels button: tags for items, fixtures and storage, hidden automatically where they would overlap (zoom in for more).

## Phase 2 — apparatus and attach points (no new main.js edits needed)

New items: burette (graduated 0-50 mL with a stopcock that turns), volumetric pipette, volumetric flask (with stopper),
glass funnel, retort stand with clamp ring, white tile, pipette filler. They live on the **back counter** (long items
cannot go on the 2.4-high shelves; the stand sits in the gap between the two shelf bays).

**Attach points.** Items can offer slots to other items, using tags instead of size classes:

| Host | Slot | Accepts |
|---|---|---|
| Retort stand | clamp ring | burette (hangs tip-down, ready over the base) |
| Retort stand | base | white tile, or a titration vessel directly |
| White tile | top | titration vessel (conical flask or beaker) |
| Conical flask, test tube | neck | cork |

Drag a burette near the clamp ring, a tile near the stand base, a flask near the tile (cyan ring = valid target).
Moving the stand carries everything attached to it. Picking an attached item detaches it.

Add your own: one entry in `ATTACH` in `catalog.js` (local position + accepted tags) and, if needed, a tag in `TAGS`.

Events for later phases: `inventory.onChange((type, data) => ...)`; `place` now carries `attachedTo` (the host item, or null).
`inventory.attachedTo(stand, 'burette')` returns what hangs on a host, which is what the step checker will use.

Burette stopcock: `item.parts.stopcock.setOpen(true|false)` (the 3D handle is tagged `userData.part = 'stopcock'` for clicking in phase 3).
Burette scale: volumes are measured between the 0 and 50 marks, so `vessel.setVolume(50)` fills to the 0 mark.
