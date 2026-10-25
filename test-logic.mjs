import assert from 'node:assert/strict';
import { pickSlot, placeLabels, nudgeFree, planStock, inRect } from './lab-logic.js';

// pickSlot
assert.equal(pickSlot([{ id: 'a', x: 100, y: 100 }, { id: 'b', x: 140, y: 100 }], 130, 100, 60).id, 'b');
assert.equal(pickSlot([{ id: 'a', x: 0, y: 0 }], 200, 200, 60), null);

// placeLabels: overlapping labels resolved by priority, distant ones kept
const keep = placeLabels([
  { key: 'near', x: 100, y: 100, w: 80, h: 20, priority: 1 },
  { key: 'overlap', x: 110, y: 105, w: 80, h: 20, priority: 2 },
  { key: 'far', x: 400, y: 300, w: 80, h: 20, priority: 3 },
]);
assert.deepEqual([...keep].sort(), ['far', 'near']);

// nudgeFree: stays in bounds, ends at least minDist from others
const b = { x0: -5, x1: 5, z0: -3, z1: 3 };
const r = nudgeFree({ x: 0.1, z: 0 }, [{ x: 0, z: 0 }, { x: 1.4, z: 0 }], 1.4, b);
assert.ok(Math.hypot(r.x, r.z) >= 1.4 - 1e-6, 'clear of first item');
assert.ok(Math.hypot(r.x - 1.4, r.z) >= 1.4 - 1e-6, 'clear of second item');
const edge = nudgeFree({ x: 99, z: -99 }, [], 1.4, b);
assert.deepEqual(edge, { x: 5, z: -3 });
assert.ok(inRect(0, 0, b) && !inRect(9, 0, b));

// planStock
const mk = (group, n, accepts) => Array.from({ length: n }, (_, i) => ({ id: `${group}:${i}`, group, accepts, item: null }));
const slots = [...mk('shelf', 3, ['tall', 'small']), ...mk('drawer', 2, ['small'])];
const sizeOf = (d) => (d === 'beaker' ? 'tall' : 'small');
const out = planStock(slots, [{ group: 'shelf', items: ['beaker', 'cork'] }, { group: 'drawer', items: ['cork'] }], sizeOf);
assert.equal(out.length, 3);
assert.equal(out[0].slot.id, 'shelf:0');
assert.throws(() => planStock(slots, [{ group: 'drawer', items: ['beaker'] }], sizeOf), /does not fit/);
assert.throws(() => planStock(slots, [{ group: 'drawer', items: ['cork', 'cork', 'cork'] }], sizeOf), /free slots/);
assert.throws(() => planStock(slots, [{ group: 'nope', items: [] }], sizeOf), /Unknown/);
console.log('lab-logic: all assertions passed');
