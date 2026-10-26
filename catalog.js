// Item catalog: one place that says what exists in the lab and how to build it.
// Later phases (reaction model, experiment library) read the same ids.
import * as THREE from 'three';
import { createGlassware, makeGlassMaterial, getGlassEnv, glassLabel } from './glassware.js';
import { buildRetortStand, buildWhiteTile, buildPipetteFiller } from './apparatus.js';

export const REAGENTS = {
  hcl:    { name: 'Hydrochloric acid',        short: 'HCl 0.1 M',       color: 0xe6e49a },
  naoh:   { name: 'Sodium hydroxide',         short: 'NaOH 0.1 M',      color: 0xb8e2f2 },
  cuso4:  { name: 'Copper(II) sulfate',       short: 'CuSO₄ 0.1 M',     color: 0x2f8fe0 },
  agno3:  { name: 'Silver nitrate',           short: 'AgNO₃ 0.1 M',     color: 0xdfeaf0 },
  na2co3: { name: 'Sodium carbonate',         short: 'Na₂CO₃ 0.1 M',    color: 0xeeeeee },
  kmno4:  { name: 'Potassium permanganate',   short: 'KMnO₄ 0.02 M',    color: 0x8b1fa9 },
  phph:   { name: 'Phenolphthalein indicator', short: 'Phenolphthalein', color: 0xf2dbe8 },
  mo:     { name: 'Methyl orange indicator',  short: 'Methyl orange',   color: 0xf2a03a },
};

const VESSELS = ['beaker', 'round-flask', 'conical-flask', 'measuring-cylinder', 'test-tube', 'burette', 'pipette', 'volumetric-flask', 'funnel'];
const SMALL = {
  'watch-glass': 'Watch glass',
  'petri-dish': 'Petri dish',
  crucible: 'Crucible + lid',
  'stirring-rod': 'Glass stirring rod',
  spatula: 'Spatula',
  cork: 'Cork stopper',
};
const APPARATUS = {
  'retort-stand': { name: 'Retort stand + clamp', build: buildRetortStand },
  'white-tile': { name: 'White tile', build: buildWhiteTile },
  'pipette-filler': { name: 'Pipette filler', build: buildPipetteFiller },
};

/**
 * Size classes decide where things can be stored:
 *   small = drawers too, tall = shelves and cupboard (<= ~2.3 high), long = back counter only (stands, burettes, pipettes)
 */
const LONG = new Set(['burette', 'pipette', 'retort-stand']);
const SMALL_APPARATUS = new Set(['white-tile', 'pipette-filler']);
export const itemSize = (defId) => (defId in SMALL || SMALL_APPARATUS.has(defId) ? 'small' : LONG.has(defId) ? 'long' : 'tall');

/** Tags let attach points ask for "a burette" or "a titration vessel" rather than a size class. */
const TAGS = {
  'conical-flask': ['titration-vessel', 'flask'],
  beaker: ['titration-vessel', 'flask'],
  'round-flask': ['flask'],
  'volumetric-flask': ['flask'],
  burette: ['burette'],
  pipette: ['pipette'],
  funnel: ['funnel'],
  cork: ['cork'],
  'white-tile': ['tile'],
  'retort-stand': ['stand'],
};
export const itemTags = (defId) => (defId.startsWith('bottle:') ? ['reagent'] : TAGS[defId] ?? []);
export const itemInfo = (defId) => ({ size: itemSize(defId), tags: itemTags(defId) });

/**
 * Attach points a built item offers to other items (local to the item, origin = bottom centre).
 * The stand numbers match buildRetortStand(): clamp ring at y = 5.0 grips the burette 3.0 above its tip.
 */
const ATTACH = {
  'retort-stand': [
    { id: 'clamp', local: [0.1, 2.0, 0], accepts: ['burette'] },
    { id: 'base', local: [0.1, 0.14, 0], accepts: ['tile', 'titration-vessel'] },
  ],
  'white-tile': [{ id: 'vessel', local: [0, 0.08, 0], accepts: ['titration-vessel'] }],
  'conical-flask': [{ id: 'cork', local: [0, 1.55, 0], accepts: ['cork'] }],
  'test-tube': [{ id: 'cork', local: [0, 1.45, 0], accepts: ['cork'] }],
};

function buildSmall(defId, env) {
  const g = new THREE.Group();
  const add = (geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  const glass = () => makeGlassMaterial(env);
  const porcelain = new THREE.MeshStandardMaterial({ color: 0xf3f0e8, roughness: 0.85, side: THREE.DoubleSide });
  const steel = new THREE.MeshStandardMaterial({ color: 0xd5dadd, metalness: 1, roughness: 0.3 });
  switch (defId) {
    case 'watch-glass': {
      const R = 1.6;
      const m = add(new THREE.SphereGeometry(R, 40, 10, 0, Math.PI * 2, 0, 0.45), glass(), 0, R + 0.02, 0);
      m.rotation.x = Math.PI; // dome flipped into a shallow bowl
      m.renderOrder = 2;
      break;
    }
    case 'petri-dish':
      add(new THREE.CylinderGeometry(0.9, 0.9, 0.17, 40), glass(), 0, 0.085, 0).renderOrder = 2;
      add(new THREE.CylinderGeometry(0.95, 0.95, 0.05, 40), glass(), 0, 0.2, 0).renderOrder = 2;
      break;
    case 'crucible':
      add(new THREE.CylinderGeometry(0.42, 0.3, 0.55, 28, 1, true), porcelain, 0, 0.275, 0);
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 28), porcelain, 0, 0.015, 0);
      add(new THREE.CylinderGeometry(0.44, 0.44, 0.05, 28), porcelain, 0, 0.59, 0);
      add(new THREE.CylinderGeometry(0.07, 0.07, 0.07, 12), porcelain, 0, 0.65, 0);
      break;
    case 'stirring-rod': {
      const m = add(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 12), glass(), 0, 0.05, 0);
      m.rotation.z = Math.PI / 2;
      m.renderOrder = 2;
      break;
    }
    case 'spatula': {
      const h = add(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 10), steel, -0.35, 0.05, 0);
      h.rotation.z = Math.PI / 2;
      add(new THREE.BoxGeometry(0.55, 0.012, 0.14), steel, 0.57, 0.05, 0);
      break;
    }
    case 'cork':
      add(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 20), new THREE.MeshStandardMaterial({ color: 0xc79a61, roughness: 0.9 }), 0, 0.15, 0);
      break;
    default:
      throw new Error(`Unknown small item: ${defId}`);
  }
  g.traverse((o) => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
  return g;
}

/**
 * Build the 3D object + metadata for a catalog id.
 * ids: a vessel type, 'bottle:<reagent>', or one of the small items.
 * Returns { root, vessel|null, name, size, contents|null, height }.
 */
export function createItemObject(defId) {
  const env = getGlassEnv();
  let root, vessel = null, name, contents = null;

  if (defId.startsWith('bottle:')) {
    const key = defId.slice(7);
    const r = REAGENTS[key];
    if (!r) throw new Error(`Unknown reagent: ${key}`);
    vessel = createGlassware('reagent-bottle', { envMap: env, label: r.short, color: r.color });
    const ml = Math.round(vessel.capacityMl * 0.7);
    vessel.setVolume(ml);
    root = vessel.group;
    name = r.name;
    contents = { reagent: key, ml };
  } else if (VESSELS.includes(defId)) {
    vessel = createGlassware(defId, { envMap: env });
    root = vessel.group;
    name = `${glassLabel(defId)}${defId === 'funnel' ? '' : ` ${vessel.capacityMl} mL`}`;
  } else if (defId in APPARATUS) {
    root = APPARATUS[defId].build();
    name = APPARATUS[defId].name;
  } else {
    root = buildSmall(defId, env);
    name = SMALL[defId];
  }
  root.userData.equipmentType = undefined; // keep the legacy picker away from catalog items
  const box = new THREE.Box3().setFromObject(root);
  const size3 = box.getSize(new THREE.Vector3());
  return {
    root, vessel, name, contents,
    size: itemSize(defId),
    tags: itemTags(defId),
    attach: ATTACH[defId] ?? [],
    parts: vessel?.parts ?? {},
    height: size3.y,
    radius: Math.max(size3.x, size3.z) / 2,
  };
}

/** Where things live at the start (groups are slot groups created by labBench). */
export const DEFAULT_STOCK = [
  { group: 'wall-a-s1', items: ['bottle:hcl', 'bottle:naoh', 'bottle:cuso4', 'bottle:agno3', 'bottle:na2co3'] },
  { group: 'wall-a-s2', items: ['bottle:kmno4', 'bottle:phph', 'bottle:mo', 'measuring-cylinder', 'measuring-cylinder'] },
  { group: 'wall-a-s3', items: ['beaker', 'beaker', 'conical-flask', 'conical-flask', 'round-flask'] },
  { group: 'wall-b-s1', items: ['beaker', 'beaker', 'beaker', 'conical-flask', 'conical-flask'] },
  { group: 'wall-b-s2', items: ['round-flask', 'round-flask', 'test-tube', 'test-tube', 'test-tube'] },
  { group: 'wall-b-s3', items: ['test-tube', 'test-tube', 'measuring-cylinder', 'beaker'] },
  { group: 'drawer-1', items: ['watch-glass', 'watch-glass', 'watch-glass', 'petri-dish', 'petri-dish'] },
  { group: 'drawer-2', items: ['crucible', 'crucible', 'crucible', 'cork', 'cork', 'cork'] },
  { group: 'drawer-3', items: ['stirring-rod', 'stirring-rod', 'stirring-rod', 'spatula', 'spatula'] },
  // titration kit lives on the back counter (long items can't go on the 2.4-high shelves)
  { group: 'counter-stand', items: ['retort-stand'] },
  { group: 'counter-narrow', items: ['burette', 'burette', 'pipette', 'pipette'] },
  { group: 'counter-front', items: ['white-tile', 'white-tile', 'funnel', 'pipette-filler', 'volumetric-flask', 'volumetric-flask'] },
  { group: 'door-s1', items: ['beaker', 'beaker', 'conical-flask', 'conical-flask'] },
  { group: 'door-s2', items: ['measuring-cylinder', 'round-flask', 'test-tube', 'test-tube'] },
];
