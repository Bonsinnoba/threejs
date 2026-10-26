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
  burette: {
    label: 'Burette', thickness: 0.03, capacityMl: 50, fillTopY: 5.2, fillBaseY: 1.2,
    outer() {
      return dedupe([[0.035, 0], [0.035, 0.3], [0.17, 0.75], [0.17, 5.45], [0.2, 5.5]]);
    },
    // 0 mL at the top mark, 50 mL at the bottom mark (reversed scale)
    label_: { kind: 'cyl', radius: 0.17, y: 3.2, h: 4.0, arc: 1.5, grad: { max: 50, steps: 50, major: 5, reverse: true }, canvas: [64, 1024] },
  },
  pipette: {
    label: 'Volumetric pipette', thickness: 0.02, capacityMl: 25, fillTopY: 3.0,
    outer() {
      const pts = [[0.03, 0], [0.03, 0.45], [0.07, 0.95], [0.07, 1.4]];
      for (let i = 1; i <= 16; i++) {
        const y = 1.4 + (1.1 * i) / 16;
        const s = Math.sin((PI * (y - 1.4)) / 1.1);
        pts.push([0.07 + 0.23 * Math.pow(Math.max(s, 0), 0.8), y]);
      }
      pts.push([0.07, 3.55], [0.085, 3.6]);
      return dedupe(pts);
    },
    label_: null,
  },
  'volumetric-flask': {
    label: 'Volumetric flask', thickness: 0.03, capacityMl: 250, fillTopY: 1.7,
    outer() {
      const R = 0.62, cy = 0.56, rn = 0.13, neckTop = 2.0, rl = 0.17, topY = 2.08;
      const a0 = Math.asin(-cy / R), rBase = Math.sqrt(R * R - cy * cy), aEnd = Math.acos(rn / R);
      return dedupe([[0, 0], [rBase, 0], ...arc(0, cy, R, a0, aEnd, 28), [rn, neckTop], [rl, neckTop + 0.04], [rl, topY]]);
    },
    label_: { kind: 'sphere', radius: 0.62, cy: 0.56, phiLen: 0.9, thetaLen: 0.36, text: '250 mL' },
    stopper: { rTop: 0.1, rBot: 0.085, y0: 1.85, y1: 2.1, capR: 0.23, capY0: 2.1, capY1: 2.17 },
  },
  funnel: {
    label: 'Glass funnel', thickness: 0.025, capacityMl: 100, fillTopY: 1.6,
    outer() {
      return dedupe([[0.08, 0], [0.08, 0.9], [0.8, 1.8], [0.84, 1.86]]);
    },
    label_: null,
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
    thickness: d.thickness, capacityMl: d.capacityMl, fillTopY: d.fillTopY, fillBaseY: d.fillBaseY ?? 0,
    labelSpec: d.label_, stopper: d.stopper ?? null,
  };
}

// Volume table over the inner wall so fill-by-mL gives the correct liquid height for any shape.
// baseY: the lower graduation mark. Volumes are measured from it, so e.g. a burette reads 0..50 mL between its
// two marks while the tip below the 50 mL mark stays full whenever there is any liquid.
export function makeFillTable(inner, fillTopY, capacityMl, baseY = 0) {
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
  const frustum = (r1, r2, dy) => (PI * (r1 * r1 + r1 * r2 + r2 * r2) / 3) * dy;
  for (let i = 1; i < rows.length; i++) rows[i].v = rows[i - 1].v + frustum(rows[i - 1].r, rows[i].r, rows[i].y - rows[i - 1].y);
  const y0 = rows[0].y;
  const rAt = (yy) => {
    const y = Math.max(yy, y0);
    for (let i = 1; i < rows.length; i++) {
      if (y <= rows[i].y) {
        const a = rows[i - 1], b = rows[i];
        return a.r + ((b.r - a.r) * (y - a.y)) / (b.y - a.y || 1);
      }
    }
    return rows[rows.length - 1].r;
  };
  const vAt = (yy) => {
    const y = Math.max(yy, y0);
    for (let i = 1; i < rows.length; i++) {
      if (y <= rows[i].y) return rows[i - 1].v + frustum(rows[i - 1].r, rAt(y), y - rows[i - 1].y);
    }
    return rows[rows.length - 1].v;
  };
  const vBase = vAt(baseY);
  const totalVolume = vAt(fillTopY) - vBase;
  const heightForMl = (ml) => {
    const target = vBase + Math.min(Math.max(ml / capacityMl, 0), 1) * totalVolume;
    let lo = Math.max(baseY, y0), hi = fillTopY;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      if (vAt(mid) < target) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  };
  // Closed liquid profile up to height h: bottom centre -> wall -> surface -> axis.
  const liquidProfile = (h) => {
    const pts = rows.filter((p) => p.y < h).map((p) => [p.r, p.y]);
    pts.push([rAt(h), h], [0, h]);
    return pts;
  };
  return { rows, totalVolume, heightForMl, liquidProfile, rAt };
}
