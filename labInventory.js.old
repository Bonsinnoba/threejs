// Interaction engine for the lab: stock the shelves, pick items up, drag them anywhere, drop them into a
// free slot (shelf / drawer / cupboard), onto the island or back counter, or send them back where they came from.
// Click a drawer or door to open it. Hover for a tooltip. Emits events so later phases (steps, chemistry) can listen.
import * as THREE from 'three';
import { createItemObject, DEFAULT_STOCK, itemInfo } from './catalog.js';
import { pickSlot, nudgeFree, inRect, planStock, slotAccepts, hostChainIncludes } from './lab-logic.js';

const UP = new THREE.Vector3(0, 1, 0);
const SNAP_PX = 60;   // how close (screen px) the cursor must be to a slot to snap to it
const DRAG_PX = 5;    // movement before a press becomes a drag (otherwise it's a click)

export class LabInventory {
  constructor({ scene, camera, renderer, bench, labels, setControlsEnabled = () => {} }) {
    Object.assign(this, { scene, camera, renderer, bench, labels, setControlsEnabled });
    this.dom = renderer.domElement;
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.items = new Map();
    this.attachSlots = []; // slots that belong to items (clamp on a stand, vessel spot on a tile, neck of a flask...)
    this.listeners = [];
    this.tweens = [];
    this.down = null;
    this.drag = null;
    this.n = 0;
    this._tmp = new THREE.Vector3();

    this.marker = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.04, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, depthTest: false, transparent: true, opacity: 0.95 })
    );
    this.marker.rotation.x = Math.PI / 2;
    this.marker.renderOrder = 30;
    this.marker.visible = false;
    scene.add(this.marker);

    this.hoverBox = new THREE.BoxHelper(new THREE.Object3D(), 0x22d3ee);
    this.hoverBox.material.depthTest = false;
    this.hoverBox.renderOrder = 29;
    this.hoverBox.frustumCulled = false;
    this.hoverBox.visible = false;
    scene.add(this.hoverBox);

    this._onDown = (e) => this.onDown(e);
    this._onMove = (e) => this.onMove(e);
    this._onUp = (e) => this.onUp(e, false);
    this._onCancel = (e) => this.onUp(e, true);
    this._onLeave = () => { if (!this.drag) this.setHover(null); };
    this.dom.addEventListener('pointerdown', this._onDown, { capture: true }); // before OrbitControls / legacy picker
    this.dom.addEventListener('pointermove', this._onMove);
    this.dom.addEventListener('pointerup', this._onUp);
    this.dom.addEventListener('pointercancel', this._onCancel);
    this.dom.addEventListener('pointerleave', this._onLeave);
  }

  // ---------- events ----------
  onChange(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter((f) => f !== fn); }; }
  emit(type, data) { this.listeners.forEach((fn) => fn(type, data)); }

  // ---------- items ----------
  spawn(defId) {
    const o = createItemObject(defId);
    const item = {
      id: `item-${++this.n}`, defId, name: o.name, size: o.size, tags: o.tags, root: o.root, vessel: o.vessel, parts: o.parts,
      contents: o.contents ? { ...o.contents } : null, height: o.height, radius: o.radius,
      slot: null, state: 'stored', home: null, origin: null, attachSlots: [],
    };
    o.root.userData.labItem = item;
    for (const spec of o.attach) {
      const slot = {
        id: `${item.id}:${spec.id}`, group: `${item.id}:${spec.id}`, accepts: spec.accepts, host: item, item: null,
        parent: o.root, local: new THREE.Vector3(...spec.local),
        // usable only while the host item itself can be reached (not hidden in a closed drawer)
        container: { name: item.name, isOpen: () => this.isAccessible(item) },
        world(out = new THREE.Vector3()) { o.root.localToWorld(out.copy(this.local)); return out; },
      };
      item.attachSlots.push(slot);
      this.attachSlots.push(slot);
    }
    this.scene.add(o.root);
    this.items.set(item.id, item);
    return item;
  }

  stock(plan = DEFAULT_STOCK) {
    this.bench.group.updateMatrixWorld(true);
    for (const { slot, defId } of planStock(this.bench.slots, plan, itemInfo)) {
      const item = this.spawn(defId);
      this.placeInSlot(item, slot, false);
      item.home = { slot };
    }
  }

  reset() {
    this.drag = null;
    this.down = null;
    this.tweens.length = 0;
    this.marker.visible = false;
    this.setHover(null);
    this.bench.containers.forEach((c) => c.setOpen?.(false, true));
    this.allSlots().forEach((s) => { s.item = null; });
    this.items.forEach((it) => { it.slot = null; });
    this.bench.group.updateMatrixWorld(true);
    this.items.forEach((it) => { if (it.home?.slot) this.placeInSlot(it, it.home.slot, false); });
  }

  allSlots() {
    return [...this.bench.slots, ...this.attachSlots];
  }

  /** What is attached to `host` (optionally only items carrying `tag`). */
  attachedTo(host, tag) {
    return host.attachSlots.map((s) => s.item).filter((it) => it && (!tag || it.tags.includes(tag)));
  }

  isAccessible(item) {
    return item.state === 'held' || !item.slot || item.slot.container.isOpen();
  }

  placeInSlot(item, slot, animate = true) {
    if (item.slot && item.slot !== slot) item.slot.item = null;
    slot.item = item;
    item.slot = slot;
    item.state = slot.host ? 'attached' : 'stored';
    slot.parent.attach(item.root); // keeps its world position, so the tween starts where the item was dropped
    item.root.rotation.set(0, 0, 0);
    this.tweenTo(item.root, slot.local, animate ? 0.28 : 0);
    this.emit('place', { item, slot, attachedTo: slot.host ?? null });
  }

  placeOnSurface(item, worldPos) {
    if (item.slot) { item.slot.item = null; item.slot = null; }
    item.state = 'bench';
    this.scene.attach(item.root);
    item.root.rotation.set(0, item.root.rotation.y, 0);
    this.tweenTo(item.root, worldPos, 0.25);
    this.emit('surface', { item, position: worldPos });
  }

  returnHome(item) {
    const o = item.origin;
    if (o?.slot && !o.slot.item) return this.placeInSlot(item, o.slot);
    if (o?.pos) return this.placeOnSurface(item, o.pos);
    const free = this.bench.slots.find((s) => !s.item && slotAccepts(s, item) && s.container.isOpen());
    if (free) return this.placeInSlot(item, free);
    return undefined;
  }

  tweenTo(obj, to, dur) {
    this.tweens = this.tweens.filter((t) => t.obj !== obj);
    if (dur <= 0) { obj.position.copy(to); return; }
    this.tweens.push({ obj, from: obj.position.clone(), to: to.clone(), t: 0, dur });
  }

  // ---------- picking ----------
  setRay(e) {
    const r = this.dom.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return r;
  }

  pick(e) {
    this.setRay(e);
    const roots = [];
    this.items.forEach((it) => { if (this.isAccessible(it)) roots.push(it.root); });
    const targets = [...roots, ...this.bench.openables, ...this.bench.occluders];
    for (const h of this.raycaster.intersectObjects(targets, true)) {
      let o = h.object;
      let skip = false;
      while (o) {
        const it = o.userData.labItem;
        if (it) {
          if (this.isAccessible(it)) return { type: 'item', item: it, point: h.point };
          skip = true; // item hidden inside a closed drawer/door: look at the next hit instead
          break;
        }
        if (o.userData.openable) return { type: 'openable', c: o.userData.openable };
        o = o.parent;
      }
      if (!skip) return null; // plain furniture is in front: nothing to pick
    }
    return null;
  }

  // ---------- pointer handlers ----------
  onDown(e) {
    if (e.button !== 0) return;
    const hit = this.pick(e);
    if (!hit) return;
    e.stopImmediatePropagation();
    this.setControlsEnabled(false);
    this.down = { hit, x: e.clientX, y: e.clientY, id: e.pointerId };
    try { this.dom.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
  }

  onMove(e) {
    if (this.down) {
      const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > DRAG_PX;
      if (!this.drag && moved && this.down.hit.type === 'item') this.beginDrag(e);
      if (this.drag) this.dragTo(e);
      return;
    }
    if (e.buttons !== 0) return; // orbiting the camera
    this.hover(e);
  }

  onUp(e, cancelled) {
    const down = this.down;
    this.down = null;
    if (!down) return;
    this.setControlsEnabled(true);
    try { this.dom.releasePointerCapture(down.id); } catch { /* not fatal */ }
    if (this.drag) { this.drop(cancelled); return; }
    if (cancelled) return;
    if (down.hit.type === 'openable') {
      down.hit.c.toggle();
      this.emit('toggle', { container: down.hit.c });
    } else {
      this.emit('select', { item: down.hit.item });
    }
  }

  // ---------- drag & drop ----------
  beginDrag(e) {
    const item = this.down.hit.item;
    item.origin = item.slot ? { slot: item.slot } : { pos: item.root.position.clone() };
    if (item.slot) { item.slot.item = null; item.slot = null; }
    item.state = 'held';
    this.scene.attach(item.root);
    this.tweens = this.tweens.filter((t) => t.obj !== item.root);

    this.setRay(e);
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    this.drag = {
      item,
      plane: new THREE.Plane().setFromNormalAndCoplanarPoint(dir, this.down.hit.point), // camera-facing, through the grab point
      offset: item.root.position.clone().sub(this.down.hit.point),
      target: item.root.position.clone(),
      cand: null,
      surface: null,
    };
    this.setHover(null);
    this.labels?.hideTip();
    this.dom.style.cursor = 'grabbing';
    this.emit('pick', { item });
  }

  dragTo(e) {
    const rect = this.setRay(e);
    const { item } = this.drag;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const cands = [];
    for (const s of this.allSlots()) {
      if (s.item || !slotAccepts(s, item) || !s.container.isOpen()) continue;
      if (s.host && hostChainIncludes(s.host, item)) continue; // can't attach something to itself or to its own attachments
      s.world(this._tmp);
      this._tmp.y += item.height / 2;
      this._tmp.project(this.camera);
      if (this._tmp.z > 1) continue;
      cands.push({ slot: s, x: (this._tmp.x * 0.5 + 0.5) * rect.width, y: (-this._tmp.y * 0.5 + 0.5) * rect.height });
    }
    const best = pickSlot(cands, cx, cy, SNAP_PX);
    this.drag.cand = best ? best.slot : null;
    this.drag.surface = null;

    if (best) {
      best.slot.world(this.drag.target);
      this.marker.position.copy(this.drag.target);
      this.marker.position.y += 0.03;
      this.marker.visible = true;
      this.drag.target.y += 0.35;
      return;
    }
    this.marker.visible = false;
    const sh = this.surfaceHit(this.raycaster.ray);
    if (sh) {
      this.drag.surface = sh;
      this.drag.target.copy(sh.point);
      this.drag.target.y += 0.5;
      return;
    }
    if (this.raycaster.ray.intersectPlane(this.drag.plane, this._tmp)) this.drag.target.copy(this._tmp).add(this.drag.offset);
  }

  surfaceHit(ray) {
    const p = new THREE.Vector3();
    for (const s of this.bench.dropSurfaces) {
      if (!ray.intersectPlane(new THREE.Plane(UP, -s.y), p)) continue;
      if (!inRect(p.x, p.z, s) || s.exclude.some((r) => inRect(p.x, p.z, r))) continue;
      return { point: p.clone(), surface: s };
    }
    return null;
  }

  drop(cancelled) {
    const { item, cand, surface } = this.drag;
    this.drag = null;
    this.marker.visible = false;
    this.dom.style.cursor = '';
    if (!cancelled && cand) { this.placeInSlot(item, cand); return; }
    if (!cancelled && surface) {
      const others = [];
      this.items.forEach((o) => {
        if (o !== item && o.state === 'bench') others.push({ x: o.root.position.x, z: o.root.position.z, minDist: o.radius + item.radius + 0.15 });
      });
      const s = surface.surface;
      const p = nudgeFree({ x: surface.point.x, z: surface.point.z }, others, 1.5, s);
      if (!s.exclude.some((r) => inRect(p.x, p.z, r))) {
        this.placeOnSurface(item, new THREE.Vector3(p.x, s.y, p.z));
        return;
      }
    }
    this.returnHome(item);
  }

  // ---------- hover ----------
  hover(e) {
    const hit = this.pick(e);
    if (!hit) { this.setHover(null); return; }
    const r = this.dom.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (hit.type === 'item') {
      const it = hit.item;
      const sub = it.slot?.host ? `On ${it.slot.host.name}` : it.contents ? `${it.contents.ml} mL` : it.vessel ? 'Empty — drag to move' : 'Drag to move';
      this.hoverBox.setFromObject(it.root);
      this.hoverBox.visible = true;
      this.dom.style.cursor = 'grab';
      this.labels?.showTip(it.name, sub, x, y);
    } else {
      const c = hit.c;
      this.hoverBox.setFromObject(c.pick);
      this.hoverBox.visible = true;
      this.dom.style.cursor = 'pointer';
      this.labels?.showTip(c.name, c.target ? 'Click to close' : 'Click to open', x, y);
    }
  }

  setHover(h) {
    if (h) return;
    this.hoverBox.visible = false;
    if (!this.drag) this.dom.style.cursor = '';
    this.labels?.hideTip();
  }

  // ---------- per-frame ----------
  update(dt) {
    this.bench.update(dt);
    for (const t of this.tweens) {
      t.t += dt;
      const k = Math.min(1, t.t / t.dur);
      t.obj.position.lerpVectors(t.from, t.to, 1 - (1 - k) ** 3);
    }
    this.tweens = this.tweens.filter((t) => t.t < t.dur);
    if (this.drag) this.drag.item.root.position.lerp(this.drag.target, 1 - Math.exp(-dt * 20));
    if (this.hoverBox.visible) this.hoverBox.update();
    if (this.labels?.enabled) this.labels.update(this.collectLabels());
  }

  collectLabels() {
    const out = [];
    this.items.forEach((it) => {
      if (!this.isAccessible(it)) return;
      const anchor = it.root.getWorldPosition(new THREE.Vector3());
      anchor.y += it.height + 0.12;
      out.push({ key: it.id, title: it.name, sub: it.contents ? `${it.contents.ml} mL` : undefined, kind: 'item', anchor });
    });
    this.bench.fixtures.forEach((f) => out.push({ key: `fx-${f.id}`, title: f.name, sub: f.sub, kind: 'fixture', anchor: f.anchor() }));
    this.bench.containers.forEach((c) => out.push({
      key: `ct-${c.id}`, title: c.name, sub: c.kind === 'shelf' ? undefined : c.isOpen() ? 'open' : 'closed', kind: 'container', anchor: c.anchor(),
    }));
    return out;
  }

  dispose() {
    this.dom.removeEventListener('pointerdown', this._onDown, { capture: true });
    this.dom.removeEventListener('pointermove', this._onMove);
    this.dom.removeEventListener('pointerup', this._onUp);
    this.dom.removeEventListener('pointercancel', this._onCancel);
    this.dom.removeEventListener('pointerleave', this._onLeave);
    this.scene.remove(this.marker, this.hoverBox);
  }
}
