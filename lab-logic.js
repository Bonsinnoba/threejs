// Pure helpers (no three.js) so the tricky bits can be unit-tested in Node.

export const slotAccepts = (slot, size) => slot.accepts.includes(size);

/** Nearest candidate to the cursor in screen pixels. cands: [{slot, x, y}] */
export function pickSlot(cands, cx, cy, maxPx) {
  let best = null;
  let bd = maxPx;
  for (const c of cands) {
    const d = Math.hypot(c.x - cx, c.y - cy);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function rectsOverlap(a, b, margin = 4) {
  return !(a.x1 + margin <= b.x0 || b.x1 + margin <= a.x0 || a.y1 + margin <= b.y0 || b.y1 + margin <= a.y0);
}

/**
 * Greedy label placement. entries: [{key, x, y, w, h, priority}] where (x, y) is the
 * bottom-centre anchor in screen px. Lower priority number wins. Returns Set of visible keys.
 */
export function placeLabels(entries) {
  const sorted = [...entries].sort((a, b) => a.priority - b.priority);
  const placed = [];
  const keep = new Set();
  for (const e of sorted) {
    const r = { x0: e.x - e.w / 2, x1: e.x + e.w / 2, y0: e.y - e.h, y1: e.y };
    if (placed.every((p) => !rectsOverlap(p, r))) {
      placed.push(r);
      keep.add(e.key);
    }
  }
  return keep;
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/** Push a drop point away from other items on a surface and keep it inside bounds b {x0,x1,z0,z1}. */
export function nudgeFree(p, others, minDist, b, iters = 16) {
  let x = clamp(p.x, b.x0, b.x1);
  let z = clamp(p.z, b.z0, b.z1);
  for (let k = 0; k < iters; k++) {
    let moved = false;
    for (const o of others) {
      const dx = x - o.x, dz = z - o.z;
      const d = Math.hypot(dx, dz);
      if (d < minDist) {
        const nx = d > 1e-6 ? dx / d : 1;
        const nz = d > 1e-6 ? dz / d : 0;
        x = clamp(o.x + nx * minDist, b.x0, b.x1);
        z = clamp(o.z + nz * minDist, b.z0, b.z1);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return { x, z };
}

export const inRect = (x, z, r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

/**
 * Turn a stock plan into assignments. plan: [{group, items:[defId...]}], slots carry .group/.item/.accepts.
 * sizeOf(defId) -> 'tall' | 'small' lets us reject items a slot cannot hold (e.g. a flask in a drawer).
 */
export function planStock(slots, plan, sizeOf) {
  const byGroup = new Map();
  for (const s of slots) {
    if (!byGroup.has(s.group)) byGroup.set(s.group, []);
    byGroup.get(s.group).push(s);
  }
  const used = new Set();
  const out = [];
  for (const entry of plan) {
    const list = byGroup.get(entry.group);
    if (!list) throw new Error(`Unknown slot group: ${entry.group}`);
    const free = list.filter((s) => !s.item && !used.has(s));
    if (entry.items.length > free.length) throw new Error(`Group ${entry.group} has ${free.length} free slots, ${entry.items.length} requested`);
    entry.items.forEach((defId, i) => {
      const slot = free[i];
      if (sizeOf && !slotAccepts(slot, sizeOf(defId))) throw new Error(`${defId} does not fit slot ${slot.id}`);
      used.add(slot);
      out.push({ slot, defId });
    });
  }
  return out;
}
