// Procedural, physically-based lab glassware for the Virtual Laboratory (three r180).
// Exposes: setupGlassEnvironment, createGlassware, renderGlassPreview, GLASS_TYPES, isGlassType, glassLabel.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLASS_TYPES, isGlassType, glassLabel, buildProfile, makeFillTable } from './glass-profiles.js';

export { GLASS_TYPES, isGlassType, glassLabel };

let mainEnv = null;
export const getGlassEnv = () => mainEnv;

function makeEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return tex;
}

/**
 * Call once after creating the main renderer + scene.
 * Adds soft studio reflections (what makes glass read as glass) and filmic tone mapping.
 */
export function setupGlassEnvironment(renderer, scene, { sceneIntensity = 0.5, toneMapping = true } = {}) {
  mainEnv = makeEnvironment(renderer);
  scene.environment = mainEnv; // lights the bench/metal too, so keep it modest
  scene.environmentIntensity = sceneIntensity;
  if (toneMapping) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
  }
  return mainEnv;
}

// Transparent glass normally loses its reflections because alpha scales everything.
// This patch raises alpha where specular is strong and darkens the silhouette edge (a cheap fresnel rim),
// so the glass stays readable even against a white bench.
export function makeGlassMaterial(envMap, { frosted = false } = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xcfe0e6,
    metalness: 0,
    roughness: frosted ? 0.45 : 0.03,
    ior: 1.5,
    clearcoat: frosted ? 0 : 1,
    clearcoatRoughness: 0.02,
    transparent: true,
    opacity: frosted ? 0.6 : 0.1,
    envMap,
    envMapIntensity: 1.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float glassSpec = max(max(totalSpecular.r, totalSpecular.g), totalSpecular.b);
       float glassRim = pow(1.0 - clamp(abs(dot(normal, geometryViewDir)), 0.0, 1.0), 2.5);
       outgoingLight = mix(outgoingLight, vec3(0.16, 0.22, 0.26), glassRim * 0.55);
       diffuseColor.a = clamp(diffuseColor.a + glassSpec * 1.1 + glassRim * 0.45, 0.0, 1.0);
       #include <opaque_fragment>`
    );
  };
  m.customProgramCacheKey = () => 'glass-fresnel-v2';
  return m;
}

function roundRectPath(g, w, h, r) {
  g.beginPath();
  g.moveTo(r, 2); g.arcTo(w - 2, 2, w - 2, h - 2, r); g.arcTo(w - 2, h - 2, 2, h - 2, r); g.arcTo(2, h - 2, 2, 2, r); g.arcTo(2, 2, w - 2, 2, r);
  g.closePath();
}

function labelTexture(text, spec = {}) {
  const portrait = !!spec.grad;
  const c = document.createElement('canvas');
  c.width = portrait ? 160 : 512;
  c.height = portrait ? 512 : 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  if (portrait) {
    const { max, steps, major } = spec.grad;
    g.strokeStyle = 'rgba(235,242,246,0.85)';
    g.fillStyle = 'rgba(235,242,246,0.9)';
    g.lineWidth = 3;
    g.font = '26px "Segoe UI", sans-serif';
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    for (let i = 0; i <= steps; i++) {
      const y = 500 - (i / steps) * 488;
      const isMajor = i % major === 0;
      g.beginPath(); g.moveTo(14, y); g.lineTo(14 + (isMajor ? 64 : 34), y); g.stroke();
      if (isMajor) g.fillText(String(Math.round((max * i) / steps)), 86, y);
    }
  } else {
    if (spec.paper) {
      g.fillStyle = '#f3efe4';
      roundRectPath(g, c.width, c.height, 18);
      g.fill();
      g.strokeStyle = '#b9b3a2';
      g.lineWidth = 3;
      g.stroke();
    }
    g.fillStyle = spec.paper ? '#1c2b31' : 'rgba(235,242,246,0.82)';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = spec.paper ? 60 : 64;
    const weight = spec.paper ? '600' : '300';
    g.font = `${weight} ${size}px "Segoe UI", sans-serif`;
    while (g.measureText(text).width > c.width - 56 && size > 20) {
      size -= 2;
      g.font = `${weight} ${size}px "Segoe UI", sans-serif`;
    }
    g.fillText(text, c.width / 2, c.height / 2 + 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function makeLabel(spec, text) {
  if (!spec) return null;
  const mat = new THREE.MeshBasicMaterial({
    map: labelTexture(text ?? spec.text, spec),
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const e = 0.004;
  let mesh;
  if (spec.kind === 'cyl') {
    const r = spec.radius + e;
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, spec.h, 40, 1, true, -spec.arc / 2, spec.arc), mat);
    mesh.position.y = spec.y;
  } else if (spec.kind === 'cone') {
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(spec.rTop + e, spec.rBottom + e, spec.h, 40, 1, true, -spec.arc / 2, spec.arc), mat);
    mesh.position.y = spec.y;
  } else {
    mesh = new THREE.Mesh(
      new THREE.SphereGeometry(spec.radius + e, 32, 16, Math.PI / 2 - spec.phiLen / 2, spec.phiLen, Math.PI / 2 - spec.thetaLen / 2, spec.thetaLen),
      mat
    );
    mesh.position.y = spec.cy;
  }
  mesh.renderOrder = 3;
  return mesh;
}

const toVec2 = (pts) => pts.map(([r, y]) => new THREE.Vector2(r, y));

/**
 * Build a vessel. Returns an object with `group` plus a small state API that the
 * upcoming chemistry/pouring layer can drive:
 *   vessel.setVolume(ml), vessel.setLiquidColor(hex), vessel.volumeMl, vessel.capacityMl
 */
export function createGlassware(type, { envMap = mainEnv, label, volumeMl = 0, color = 0x4fb3ff } = {}) {
  const prof = buildProfile(type);
  const fill = makeFillTable(prof.inner, prof.fillTopY, prof.capacityMl);

  // Wall = outer going up, then inner coming back down, so the lathe has real thickness.
  const wall = [...prof.outer, ...[...prof.inner].reverse()];
  const glassGeo = new THREE.LatheGeometry(toVec2(wall), 64);
  const glass = new THREE.Mesh(glassGeo, makeGlassMaterial(envMap));
  glass.renderOrder = 2;

  const liquidMat = new THREE.MeshPhysicalMaterial({
    color,
    transparent: true,
    opacity: 0.72,
    roughness: 0.06,
    clearcoat: 0.6,
    envMap,
    envMapIntensity: 1.0,
    depthWrite: false,
  });
  const liquid = new THREE.Mesh(new THREE.BufferGeometry(), liquidMat);
  liquid.renderOrder = 1;
  liquid.visible = false;

  const group = new THREE.Group();
  group.add(liquid, glass);

  if (prof.stopper) {
    const s = prof.stopper;
    const frosted = makeGlassMaterial(envMap, { frosted: true });
    const plug = new THREE.Mesh(new THREE.CylinderGeometry(s.rTop, s.rBot, s.y1 - s.y0, 32), frosted);
    plug.position.y = (s.y0 + s.y1) / 2;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(s.capR, s.capR * 0.9, s.capY1 - s.capY0, 32), frosted);
    cap.position.y = (s.capY0 + s.capY1) / 2;
    plug.renderOrder = cap.renderOrder = 2;
    group.add(plug, cap);
  }

  const labelMesh = makeLabel(prof.labelSpec, label);
  if (labelMesh) group.add(labelMesh);

  const vessel = {
    type,
    group,
    capacityMl: prof.capacityMl,
    volumeMl: 0,
    liquidMesh: liquid,
    setLiquidColor(hex) {
      liquidMat.color.set(hex);
    },
    setVolume(ml) {
      const v = Math.min(Math.max(ml, 0), prof.capacityMl);
      vessel.volumeMl = v;
      liquid.visible = v > 0.01;
      if (!liquid.visible) return vessel;
      liquid.geometry.dispose();
      const h = fill.heightForMl(v);
      const pts = fill.liquidProfile(h).map(([r, y]) => new THREE.Vector2(r * 0.985, y)); // inset avoids z-fighting
      liquid.geometry = new THREE.LatheGeometry(pts, 48);
      return vessel;
    },
    dispose() {
      group.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          o.material.map?.dispose();
          o.material.dispose();
        }
      });
    },
  };
  vessel.setVolume(volumeMl);

  group.userData.equipmentType = type;
  group.userData.isGlassware = true;
  group.userData.vessel = vessel;
  return vessel;
}

// ---- Palette thumbnails: one shared renderer, results cached as PNG data URLs ----
let previewCtx = null;
const previewCache = new Map();

export function renderGlassPreview(type, px = 160) {
  const key = `${type}:${px}`;
  if (previewCache.has(key)) return previewCache.get(key);
  if (!previewCtx) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const env = makeEnvironment(renderer);
    scene.environment = env;
    scene.environmentIntensity = 0.6;
    scene.add(new THREE.DirectionalLight(0xffffff, 1.2));
    previewCtx = { renderer, scene, env, camera: new THREE.PerspectiveCamera(30, 1, 0.1, 50) };
  }
  const { renderer, scene, env, camera } = previewCtx;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(px, px, false);
  const vessel = createGlassware(type, { envMap: env, volumeMl: 0 });
  vessel.setVolume(vessel.capacityMl * 0.4);
  vessel.group.rotation.y = -0.5;
  scene.add(vessel.group);
  const box = new THREE.Box3().setFromObject(vessel.group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const dist = (Math.max(size.y, size.x) / 2 / Math.tan(THREE.MathUtils.degToRad(15))) * 1.25;
  camera.position.set(center.x, center.y + size.y * 0.05, center.z + dist);
  camera.lookAt(center);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  scene.remove(vessel.group);
  vessel.dispose();
  previewCache.set(key, url);
  return url;
}
