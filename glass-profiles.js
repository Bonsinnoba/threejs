// Pure profile maths for lab glassware. No three.js import, so it can be unit-tested in Node.
// A profile is an array of [radius, y] points, bottom -> top, describing the OUTER wall.
// Inner wall is derived by offsetting along the 2D normal, so every vessel gets real glass thickness.

const PI = Math.PI;

function arc(cx, cy, r, a0, a1, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

function dedupe(pts) {
  return pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-6);
}

// Offset a bottom->top outer profile inward by t (outward normal on the right side is +r).
export function offsetProfile(pts, t) {
  return pts.map((p, i) => {
    const a = pts[Math.max(i - 1, 0)];
    const b = pts[Math.min(i + 1, pts.length - 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const nx = ty; // outward normal
    const ny = -tx;
    return [Math.max(p[0] - nx * t, 0), p[1] - ny * t];
  });
}

const DEFS = {
  'reagent-bottle': {
    label: 'Reagent bottle', thickness: 0.04, capacityMl: 500, fillTopY: 1.05,
    outer() {
      const R = 0.55, cr = 0.07, bodyH = 0.9, rn = 0.3, f = 0.08, sr = R - rn - f;
      const neckTop = 1.4, rl = 0.36, topY = 1.52;
      return dedupe([
        [0, 0], ...arc(R - cr, cr, cr, -PI / 2, 0, 6),
        [R, bodyH],
        ...arc(R - sr, bodyH, sr, 0, PI / 2, 10),
        ...arc(rn + f, bodyH + sr + f, f, -PI / 2, -PI, 5),
        [rn, neckTop], [rl, neckTop + 0.06], [rl, topY],
      ]);
    },
    label_: { kind: 'cyl', radius: 0.55, y: 0.5, h: 0.42, arc: 1.5, text: 'Reagent', paper: true },
    stopper: { rTop: 0.24, rBot: 0.2, y0: 1.22, y1: 1.5, capR: 0.41, capY0: 1.5, capY1: 1.58 },
  },
  'round-flask': {
    label: 'Round-bottom flask', thickness: 0.03, capacityMl: 250, fillTopY: 1.2,
    outer() {
      const R = 0.62, rn = 0.16, neckTop = 1.75, rl = 0.2, topY = 1.82;
      const aEnd = Math.acos(rn / R);
      return dedupe([
        ...arc(0, R, R, -PI / 2, aEnd, 32),
        [rn, neckTop], [rl, neckTop + 0.04], [rl, topY],
      ]);
    },
    label_: { kind: 'sphere', radius: 0.62, cy: 0.62, phiLen: 0.9, thetaLen: 0.36, text: '250 mL' },
  },
  beaker: {
    label: 'Beaker', thickness: 0.035, capacityMl: 400, fillTopY: 1.15,
    outer() {
      const R = 0.6, H = 1.3, cr = 0.06;
      return dedupe([[0, 0], ...arc(R - cr, cr, cr, -PI / 2, 0, 6), [R, H - 0.06], [R + 0.035, H]]);
    },
    label_: { kind: 'cyl', radius: 0.6, y: 0.68, h: 0.95, arc: 0.5, grad: { max: 400, steps: 8, major: 2 } },
  },
  'conical-flask': {
    label: 'Conical flask', thickness: 0.03, capacityMl: 250, fillTopY: 1.05,
    outer() {
      const R = 0.65, cr = 0.06, rn = 0.2, y1 = 1.3, neckTop = 1.65, rl = 0.26, topY = 1.7;
      return dedupe([[0, 0], ...arc(R - cr, cr, cr, -PI / 2, 0, 6), [rn, y1], [rn, neckTop], [rl, neckTop + 0.04], [rl, topY]]);
    },
    label_: { kind: 'cone', rTop: 0.3815, rBottom: 0.5266, y: 0.6, h: 0.4, arc: 1.8, text: '250 mL' },
  },
  'measuring-cylinder': {
    label: 'Measuring cylinder', thickness: 0.03, capacityMl: 100, fillTopY: 2.4,
    outer() {
      const r = 0.28, H = 2.6, cr = 0.05;
      return dedupe([[0, 0], ...arc(r - cr, cr, cr, -PI / 2, 0, 5), [r, H - 0.05], [r + 0.04, H]]);
    },
    label_: { kind: 'cyl', radius: 0.28, y: 1.35, h: 2.0, arc: 1.8, grad: { max: 100, steps: 20, major: 5 } },
  },
  'test-tube': {
    label: 'Test tube', thickness: 0.025, capacityMl: 25, fillTopY: 1.4,
    outer() {
      const r = 0.2, H = 1.6;
      return dedupe([...arc(0, r, r, -PI / 2, 0, 10), [r, H - 0.05], [r + 0.03, H]]);
    },
    label_: null,
  },
};

export const GLASS_TYPES = Object.keys(DEFS);
export const isGlassType = (t) => t in DEFS;
export const glassLabel = (t) => DEFS[t].label;

export function buildProfile(type) {
  const d = DEFS[type];
  if (!d) throw new Error(`Unknown glassware type: ${type}`);
  const outer = d.outer();
  const inner = offsetProfile(outer, d.thickness);
  return {
    type, outer, inner,
    thickness: d.thickness, capacityMl: d.capacityMl, fillTopY: d.fillTopY,
    labelSpec: d.label_, stopper: d.stopper ?? null,
  };
}

// Volume table over the inner wall so fill-by-mL gives the correct liquid height for any shape.
export function makeFillTable(inner, fillTopY, capacityMl) {
  const rows = [];
  for (const [r, y] of inner) {
    if (rows.length && y <= rows[rows.length - 1].y + 1e-6) continue; // keep y strictly rising
    if (y > fillTopY) {
      const prev = rows[rows.length - 1];
      if (prev && prev.y < fillTopY) {
        const k = (fillTopY - prev.y) / (y - prev.y);
        rows.push({ r: prev.r + (r - prev.r) * k, y: fillTopY, v: 0 });
      }
      break;
    }
    rows.push({ r, y, v: 0 });
  }
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    rows[i].v = a.v + (PI * (a.r * a.r + a.r * b.r + b.r * b.r) / 3) * (b.y - a.y);
  }
  const total = rows[rows.length - 1].v;
  const rAt = (y) => {
    for (let i = 1; i < rows.length; i++) {
      if (y <= rows[i].y) {
        const a = rows[i - 1], b = rows[i];
        return a.r + ((b.r - a.r) * (y - a.y)) / (b.y - a.y || 1);
      }
    }
    return rows[rows.length - 1].r;
  };
  const heightForMl = (ml) => {
    const v = Math.min(Math.max(ml / capacityMl, 0), 1) * total;
    for (let i = 1; i < rows.length; i++) {
      if (v <= rows[i].v) {
        const a = rows[i - 1], b = rows[i];
        return a.y + ((v - a.v) / (b.v - a.v || 1)) * (b.y - a.y);
      }
    }
    return rows[rows.length - 1].y;
  };
  // Closed liquid profile up to height h: bottom centre -> wall -> surface -> axis.
  const liquidProfile = (h) => {
    const pts = rows.filter((p) => p.y < h).map((p) => [p.r, p.y]);
    pts.push([rAt(h), h], [0, h]);
    return pts;
  };
  return { rows, totalVolume: total, heightForMl, liquidProfile, rAt };
}
