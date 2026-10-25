// Lab island + room (v2). Scale: 1 unit ~ 10 cm. The floor sits at y = -7.8 so the worktop stays at
// y = 1.2 (a 90 cm bench) and the existing experiments don't move.
//
// Interactive storage: wall shelves (always open), five drawers and a two-door cupboard.
// Everything storable is described by `slots`; containers expose isOpen()/toggle()/update(dt).
import * as THREE from 'three';

export const BENCH = { topY: 1.2, floorY: -7.8, halfX: 6, halfZ: 4 };
const TOP = BENCH.topY;
const FLOOR = BENCH.floorY;

// ---------- textures ----------
function oakTexture(vertical) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#e0c394';
  g.fillRect(0, 0, 512, 512);
  let seed = vertical ? 7 : 3;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 420; i++) {
    const p = rnd() * 512, start = rnd() * 512, len = 80 + rnd() * 400, drift = (rnd() - 0.5) * 6;
    g.strokeStyle = rnd() > 0.5 ? `rgba(255,240,215,${0.05 + rnd() * 0.12})` : `rgba(150,105,60,${0.04 + rnd() * 0.12})`;
    g.lineWidth = 0.6 + rnd() * 2.2;
    g.beginPath();
    if (vertical) { g.moveTo(p, start); g.lineTo(p + drift, start + len); }
    else { g.moveTo(start, p); g.lineTo(start + len, p + drift); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function decalTexture(kind, text1, text2) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 122;
  const g = c.getContext('2d');
  g.fillStyle = '#f7f8f8';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#8b979c';
  g.lineWidth = 4;
  g.strokeRect(2, 2, c.width - 4, c.height - 4);
  let tx = 24;
  if (kind === 'warning') {
    g.fillStyle = '#f5c518';
    g.beginPath(); g.moveTo(58, 14); g.lineTo(102, 104); g.lineTo(14, 104); g.closePath(); g.fill();
    g.strokeStyle = '#222'; g.lineWidth = 5; g.stroke();
    g.fillStyle = '#222'; g.font = 'bold 54px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('!', 58, 78);
    tx = 124;
  }
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#1b2a30';
  g.font = 'bold 40px "Segoe UI", sans-serif';
  g.fillText(text1, tx, 52);
  g.fillStyle = '#4d5f66';
  g.font = '30px "Segoe UI", sans-serif';
  g.fillText(text2, tx, 92);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---------- builder ----------
export function createLabBench(scene) {
  const group = new THREE.Group();
  group.name = 'lab-bench';

  // Restrained palette: dark floor, cool-grey walls, white worktop and oak as the only bright accents.
  const M = {
    top: new THREE.MeshStandardMaterial({ color: 0xf3f5f5, roughness: 0.22 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xd5dadd, metalness: 1, roughness: 0.28 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 1, roughness: 0.3 }),
    oakH: new THREE.MeshStandardMaterial({ map: oakTexture(false), roughness: 0.55 }),
    oakV: new THREE.MeshStandardMaterial({ map: oakTexture(true), roughness: 0.55 }),
    inner: new THREE.MeshStandardMaterial({ color: 0xe3e8ea, roughness: 0.7 }),
    trim: new THREE.MeshStandardMaterial({ color: 0xc3cbcf, roughness: 0.55 }),
    plinth: new THREE.MeshStandardMaterial({ color: 0x4b565c, roughness: 0.6 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.6 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.5 }),
    wallBack: new THREE.MeshStandardMaterial({ color: 0xd3dce0, roughness: 0.95 }),
    wallSide: new THREE.MeshStandardMaterial({ color: 0xbfcad0, roughness: 0.95 }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0xe4e9eb, roughness: 1 }),
    floor: new THREE.MeshStandardMaterial({ color: 0x56636b, roughness: 0.5 }),
    counter: new THREE.MeshStandardMaterial({ color: 0x7f929b, roughness: 0.6 }),
    counterTop: new THREE.MeshStandardMaterial({ color: 0xe9eef0, roughness: 0.3 }),
    shelfFrame: new THREE.MeshStandardMaterial({ color: 0xaab8bf, roughness: 0.6 }),
    shelfBack: new THREE.MeshStandardMaterial({ color: 0x7d8f98, roughness: 0.8 }),
  };

  const add = (parent, geo, mat, x = 0, y = 0, z = 0, { shadow = true } = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (parent, w, h, d, mat, x, y, z, o) => add(parent, new THREE.BoxGeometry(w, h, d), mat, x, y, z, o);
  const cyl = (parent, rt, rb, h, mat, x, y, z, seg = 24) => add(parent, new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  const slots = [];
  const containers = [];
  const fixtures = [];
  const openables = [];

  const addSlots = (groupId, container, parent, pts, accepts) => {
    pts.forEach((p, i) => {
      slots.push({
        id: `${groupId}:${i}`, group: groupId, container, parent, local: p.clone(), accepts, item: null,
        world(out = new THREE.Vector3()) {
          parent.localToWorld(out.copy(this.local));
          return out;
        },
      });
    });
  };

  // ----- room (smaller, darker floor, inward-facing walls) -----
  const planeAt = (w, h, mat, x, y, z, ry = 0, rx = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0);
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const WALL_TOP = 15;
  const wallH = WALL_TOP - FLOOR;
  const wallY = (WALL_TOP + FLOOR) / 2;
  planeAt(26, 28, M.floor, 0, FLOOR, 2, 0, -Math.PI / 2);
  planeAt(26, 28, M.ceiling, 0, WALL_TOP, 2, 0, Math.PI / 2);
  planeAt(26, wallH, M.wallBack, 0, wallY, -9);
  planeAt(26, wallH, M.wallSide, 0, wallY, 17, Math.PI);
  planeAt(28, wallH, M.wallSide, -13, wallY, 2, Math.PI / 2);
  planeAt(28, wallH, M.wallSide, 13, wallY, 2, -Math.PI / 2);

  // back run of base units (a second work surface to put things on)
  const COUNTER_H = TOP - FLOOR - 0.1;
  box(group, 20, COUNTER_H, 1.4, M.counter, 0, FLOOR + COUNTER_H / 2, -8.3);
  box(group, 20.2, 0.1, 1.5, M.counterTop, 0, TOP - 0.05, -8.3);
  for (let x = -9.5; x <= 9.5; x += 2.5) box(group, 0.03, COUNTER_H - 0.6, 0.03, M.plinth, x, FLOOR + COUNTER_H / 2, -7.59, { shadow: false });

  // ----- wall shelving bays (always open) -----
  const SHELF_YS = [6.2, 8.6, 11.0];
  const wallContainers = [];
  [{ id: 'wall-a', x: -4.6, name: 'Wall shelf A' }, { id: 'wall-b', x: 4.6, name: 'Wall shelf B' }].forEach((bay) => {
    box(group, 6.6, 7.3, 0.04, M.shelfBack, bay.x, 9.75, -8.97, { shadow: false });
    box(group, 0.06, 7.3, 0.9, M.shelfFrame, bay.x - 3.3, 9.75, -8.5, { shadow: false });
    box(group, 0.06, 7.3, 0.9, M.shelfFrame, bay.x + 3.3, 9.75, -8.5, { shadow: false });
    box(group, 6.6, 0.06, 0.9, M.shelfFrame, bay.x, 13.4, -8.5, { shadow: false });
    const c = {
      id: bay.id, name: bay.name, kind: 'shelf', isOpen: () => true, toggle() {}, update() {}, pick: null,
      anchor: () => V(bay.x, 13.8, -8.5),
    };
    containers.push(c);
    wallContainers.push(c);
    SHELF_YS.forEach((y, n) => {
      box(group, 6.6, 0.06, 0.9, M.shelfFrame, bay.x, y - 0.03, -8.5, { shadow: false });
      const pts = Array.from({ length: 5 }, (_, i) => V(bay.x - 2.5 + i * 1.25, y, -8.45));
      addSlots(`${bay.id}-s${n + 1}`, c, group, pts, ['tall', 'small']);
    });
  });

  // ----- island carcass (hollow, so drawers and doors have real interiors) -----
  const BASE_Y = FLOOR + 0.4;          // plinth top
  const BODY_TOP = 0.9;                // underside of the worktop
  const BODY_H = BODY_TOP - BASE_Y;
  const BODY_MID = (BASE_Y + BODY_TOP) / 2;
  const FRONT_TOP = 0.14;
  const FRONT_BOTTOM = BASE_Y + 0.06;
  const FRONT_H = FRONT_TOP - FRONT_BOTTOM;

  box(group, 11.6, 0.4, 7.6, M.plinth, 0, FLOOR + 0.2, 0);
  box(group, 11.8, 0.06, 7.8, M.inner, 0, BASE_Y + 0.03, 0);
  box(group, 0.06, BODY_H, 7.8, M.oakV, -5.87, BODY_MID, 0);
  box(group, 0.06, BODY_H, 7.8, M.oakV, 5.87, BODY_MID, 0);
  box(group, 11.8, BODY_H, 0.06, M.oakV, 0, BODY_MID, -3.87);
  box(group, 0.06, BODY_H, 7.7, M.inner, 0, BODY_MID, 0);               // divider between drawers and cupboard
  box(group, 11.8, BODY_TOP - FRONT_TOP, 0.06, M.trim, 0, (BODY_TOP + FRONT_TOP) / 2, 3.87); // apron

  // drawers (left half): 5 stacked, each slides out on z
  const DRAWER_N = 5, GAP = 0.05;
  const fh = (FRONT_H - GAP * (DRAWER_N - 1)) / DRAWER_N;
  const DRAWER_X = -2.95, DRAWER_ZC = 0.64, TRAVEL = 3.6;
  for (let i = 1; i < DRAWER_N; i++) {
    const yb = FRONT_TOP - i * (fh + GAP) + GAP / 2; // shelf sitting between drawer i and i+1
    box(group, 5.8, 0.04, 7.6, M.inner, DRAWER_X, yb, 0, { shadow: false });
  }
  for (let i = 0; i < DRAWER_N; i++) {
    const y0 = FRONT_TOP - (i + 1) * fh - i * GAP;
    const dg = new THREE.Group();
    dg.position.set(DRAWER_X, y0, DRAWER_ZC);
    box(dg, 5.76, fh, 0.06, M.oakH, 0, fh / 2, 3.23);                   // front
    box(dg, 1.5, 0.08, 0.1, M.steel, 0, fh / 2, 3.31);                  // handle
    box(dg, 5.5, 0.05, 6.4, M.inner, 0, 0.12, 0);                        // tray floor
    box(dg, 0.05, 1.0, 6.4, M.inner, -2.725, 0.62, 0);
    box(dg, 0.05, 1.0, 6.4, M.inner, 2.725, 0.62, 0);
    box(dg, 5.5, 1.0, 0.05, M.inner, 0, 0.62, -3.2);
    group.add(dg);
    const d = {
      id: `drawer-${i + 1}`, name: `Drawer ${i + 1}`, kind: 'drawer', t: 0, target: 0, pick: dg,
      isOpen() { return this.t > 0.35; },
      toggle() { this.target = this.target ? 0 : 1; },
      setOpen(v, instant) { this.target = v ? 1 : 0; if (instant) this.t = this.target; this.apply(); },
      apply() { dg.position.z = DRAWER_ZC + this.t * TRAVEL; },
      update(dt) {
        if (Math.abs(this.target - this.t) > 1e-3) this.t += (this.target - this.t) * Math.min(1, dt * 9);
        else this.t = this.target;
        this.apply();
      },
      anchor: () => dg.localToWorld(V(0, fh / 2, 3.5)),
    };
    dg.userData.openable = d;
    openables.push(dg);
    containers.push(d);
    const pts = [];
    for (const z of [-1.9, 0, 1.9]) for (const x of [-1.8, 0, 1.8]) pts.push(V(x, 0.145, z));
    addSlots(d.id, d, dg, pts, ['small']);
  }

  // cupboard (right half): two doors, three shelf levels behind them
  const DOOR_W = (5.8 - 0.05) / 2;
  const doorFor = {};
  [{ id: 'door-left', name: 'Cupboard door (left)', hx: 0.05, sign: 1 }, { id: 'door-right', name: 'Cupboard door (right)', hx: 5.85, sign: -1 }].forEach((cfg) => {
    const pivot = new THREE.Group();
    pivot.position.set(cfg.hx, (FRONT_TOP + FRONT_BOTTOM) / 2, 3.87);
    box(pivot, DOOR_W, FRONT_H, 0.06, M.oakV, cfg.sign * DOOR_W / 2, 0, 0);
    box(pivot, 0.55, 0.1, 0.08, M.steel, cfg.sign * (DOOR_W - 0.5), FRONT_H / 2 - 0.5, 0.07);
    group.add(pivot);
    const door = {
      id: cfg.id, name: cfg.name, kind: 'door', t: 0, target: 0, pick: pivot,
      isOpen() { return this.t > 0.35; },
      toggle() { this.target = this.target ? 0 : 1; },
      setOpen(v, instant) { this.target = v ? 1 : 0; if (instant) this.t = this.target; this.apply(); },
      apply() { pivot.rotation.y = -cfg.sign * 1.75 * this.t; },
      update(dt) {
        if (Math.abs(this.target - this.t) > 1e-3) this.t += (this.target - this.t) * Math.min(1, dt * 7);
        else this.t = this.target;
        this.apply();
      },
      anchor: () => pivot.localToWorld(V(cfg.sign * DOOR_W / 2, FRONT_H * 0.25, 0.2)),
    };
    pivot.userData.openable = door;
    openables.push(pivot);
    containers.push(door);
    doorFor[cfg.id] = door;
  });
  const SHELF_SURF = [BASE_Y + 0.06, -4.57, -1.87];
  box(group, 5.8, 0.06, 7.6, M.inner, 2.95, -4.6, 0, { shadow: false });
  box(group, 5.8, 0.06, 7.6, M.inner, 2.95, -1.9, 0, { shadow: false });
  SHELF_SURF.forEach((y, n) => {
    const pts = [];
    const owner = [];
    for (const z of [1.6, -0.6]) for (let i = 0; i < 5; i++) { const x = 0.75 + i * 1.1; pts.push(V(x, y, z)); owner.push(x < 2.95 ? doorFor['door-left'] : doorFor['door-right']); }
    pts.forEach((p, i) => addSlots(`door-s${n + 1}#${i}`, owner[i], group, [p], ['tall', 'small']));
  });
  // merge the per-slot door groups back into shelf groups ("door-s1:0", ...)
  slots.forEach((s) => { if (s.group.startsWith('door-s')) { s.group = s.group.split('#')[0]; } });
  const doorCount = {};
  slots.forEach((s) => { if (s.group.startsWith('door-s')) { doorCount[s.group] = (doorCount[s.group] ?? 0); s.id = `${s.group}:${doorCount[s.group]++}`; } });

  // ----- worktop with a sink cut-out -----
  const SINK = { x0: -5.6, x1: -3.9, z0: -3.95, z1: -3.05 };
  const W = 12.4, D = 8.4;
  const shape = new THREE.Shape();
  shape.moveTo(-W / 2, -D / 2); shape.lineTo(W / 2, -D / 2); shape.lineTo(W / 2, D / 2); shape.lineTo(-W / 2, D / 2); shape.closePath();
  const hole = new THREE.Path(); // shape y = -world z after the -90deg X rotation
  hole.moveTo(SINK.x0, -SINK.z1); hole.lineTo(SINK.x1, -SINK.z1); hole.lineTo(SINK.x1, -SINK.z0); hole.lineTo(SINK.x0, -SINK.z0); hole.closePath();
  shape.holes.push(hole);
  const bt = 0.012, depth = 0.276;
  const worktop = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bt, bevelSize: bt, bevelSegments: 2 }),
    M.top
  );
  worktop.rotation.x = -Math.PI / 2;
  worktop.position.y = TOP - depth - bt; // top face lands exactly on y = 1.2
  worktop.castShadow = worktop.receiveShadow = true;
  group.add(worktop);

  // ----- sink basin + gooseneck tap -----
  const sw = SINK.x1 - SINK.x0, sd = SINK.z1 - SINK.z0, scx = (SINK.x0 + SINK.x1) / 2, scz = (SINK.z0 + SINK.z1) / 2;
  const bh = 0.9, wt = 0.03, wallHt = bh - 0.006, by = TOP - 0.006 - wallHt / 2;
  box(group, sw, wt, sd, M.steel, scx, TOP - bh + wt / 2, scz);
  box(group, sw, wallHt, wt, M.steel, scx, by, SINK.z0 + wt / 2);
  box(group, sw, wallHt, wt, M.steel, scx, by, SINK.z1 - wt / 2);
  box(group, wt, wallHt, sd, M.steel, SINK.x0 + wt / 2, by, scz);
  box(group, wt, wallHt, sd, M.steel, SINK.x1 - wt / 2, by, scz);
  cyl(group, 0.09, 0.09, 0.012, M.dark, scx, TOP - bh + wt + 0.006, scz, 24);

  const tap = new THREE.Group();
  tap.position.set(-3.55, TOP, -3.5);
  cyl(tap, 0.12, 0.12, 0.08, M.steel, 0, 0.04, 0);
  const neck = new THREE.CatmullRomCurve3(
    [[0, 0.08], [0, 0.7], [0, 1.15], [-0.06, 1.42], [-0.28, 1.56], [-0.55, 1.52], [-0.7, 1.36], [-0.72, 1.18]].map(([x, y]) => V(x, y, 0))
  );
  add(tap, new THREE.TubeGeometry(neck, 64, 0.04, 12, false), M.steel);
  cyl(tap, 0.055, 0.05, 0.1, M.steel, -0.72, 1.14, 0);
  cyl(tap, 0.02, 0.02, 0.28, M.steel, 0.1, 0.18, 0).rotation.z = Math.PI / 2.4;
  group.add(tap);

  // ----- gas tap -----
  const gas = new THREE.Group();
  gas.position.set(3.2, TOP, -3.5);
  cyl(gas, 0.15, 0.15, 0.03, M.steel, 0, 0.015, 0);
  cyl(gas, 0.07, 0.07, 0.5, M.brass, 0, 0.28, 0);
  cyl(gas, 0.1, 0.1, 0.05, M.steel, 0, 0.5, 0);
  cyl(gas, 0.085, 0.085, 0.1, M.brass, 0, 0.6, 0);
  add(gas, new THREE.SphereGeometry(0.06, 16, 12), M.steel, 0, 0.67, 0);
  cyl(gas, 0.045, 0.045, 0.4, M.brass, 0, 0.3, 0.2).rotation.x = Math.PI / 2;
  for (const z of [0.3, 0.36, 0.42]) cyl(gas, 0.065, 0.065, 0.025, M.steel, 0, 0.3, z).rotation.x = Math.PI / 2;
  group.add(gas);

  // ----- socket box -----
  const sock = new THREE.Group();
  sock.position.set(5.0, TOP, -3.45);
  box(sock, 1.0, 0.3, 0.5, M.steel, 0, 0.15, 0);
  for (const x of [-0.24, 0.24]) {
    box(sock, 0.38, 0.22, 0.012, M.white, x, 0.15, 0.256, { shadow: false });
    for (const sx of [-0.06, 0.06]) box(sock, 0.02, 0.07, 0.014, M.dark, x + sx, 0.18, 0.259, { shadow: false });
    add(sock, new THREE.CircleGeometry(0.017, 16), M.dark, x, 0.1, 0.263, { shadow: false });
  }
  group.add(sock);

  fixtures.push(
    { id: 'sink', name: 'Sink & tap', sub: '316L stainless steel', anchor: () => V(-4.6, TOP + 1.8, -3.5) },
    { id: 'gas-tap', name: 'Gas tap', sub: 'Brass / chrome', anchor: () => V(3.2, TOP + 0.9, -3.5) },
    { id: 'socket', name: 'Electrical socket', sub: 'Switched outlets', anchor: () => V(5.0, TOP + 0.5, -3.45) },
    { id: 'island', name: 'Work island', sub: 'MOD-72A', anchor: () => V(0, TOP + 0.05, 0.5) },
    { id: 'counter', name: 'Back counter', sub: 'Spare work surface', anchor: () => V(0, TOP + 0.05, -8.3) },
  );

  // ----- stickers on the apron -----
  const decal = (tex, w, x) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, (w * 122) / 512), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    p.position.set(x, (BODY_TOP + FRONT_TOP) / 2, 3.903);
    group.add(p);
  };
  decal(decalTexture('warning', 'CAUTION', 'Chemical hazard — wear PPE'), 1.5, -4.4);
  decal(decalTexture('warning', 'CAUTION', 'Hot surfaces / open flame'), 1.5, -0.6);
  decal(decalTexture('plate', 'LAB ISLAND', 'MOD-72A'), 1.5, 4.5);

  scene.add(group);

  // static geometry that can hide things from the picker (taken before any item is added)
  const occluders = [];
  group.traverse((o) => { if (o.isMesh) occluders.push(o); });

  const dropSurfaces = [
    { id: 'island', y: TOP, x0: -5.8, x1: 5.8, z0: -3.8, z1: 3.8, exclude: [SINK] },
    { id: 'counter', y: TOP, x0: -9.7, x1: 9.7, z0: -8.9, z1: -7.7, exclude: [] },
  ];

  return {
    group, slots, containers, fixtures, openables, occluders, dropSurfaces,
    topY: TOP, floorY: FLOOR,
    defaultView: { position: [4, 6.5, 13.5], target: [0, 3, -3] },
    update(dt) { containers.forEach((c) => c.update(dt)); },
  };
}
