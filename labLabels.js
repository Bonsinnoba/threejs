// DOM label layer: a Labels on/off button, non-overlapping name tags, and a hover tooltip.
// DOM (not sprites) keeps text crisp, constant-size, and lets us hide tags that would collide.
import * as THREE from 'three';
import { placeLabels } from './lab-logic.js';

const CSS = `
.lab-labels{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:5}
.lab-tag{position:absolute;left:0;top:0;padding:2px 7px;border-radius:5px;white-space:nowrap;
  font:600 11px/1.25 Inter,system-ui,sans-serif;color:#f1f5f9;background:rgba(15,23,42,.88);
  border:1px solid rgba(148,163,184,.4);will-change:transform;display:none}
.lab-tag small{display:block;font-weight:400;font-size:10px;color:#9fb0bd}
.lab-tag.fixture{background:rgba(8,70,64,.9);border-color:rgba(94,234,212,.5)}
.lab-tag.container{background:rgba(67,56,20,.9);border-color:rgba(250,204,21,.5)}
.lab-tip{position:absolute;left:0;top:0;z-index:6;padding:5px 9px;border-radius:6px;pointer-events:none;display:none;
  font:600 12px/1.3 Inter,system-ui,sans-serif;color:#f8fafc;background:rgba(15,23,42,.94);border:1px solid rgba(148,163,184,.45)}
.lab-tip small{display:block;font-weight:400;font-size:11px;color:#a8b8c4}
.lab-toggle{position:absolute;top:12px;right:12px;z-index:7;padding:7px 12px;border-radius:7px;cursor:pointer;
  font:600 12px Inter,system-ui,sans-serif;color:#e5e7eb;background:rgba(15,23,42,.9);border:1px solid #475569}
.lab-toggle:hover{background:#1e293b}
.lab-toggle[aria-pressed="true"]{background:#0f766e;border-color:#5eead4;color:#fff}
`;

export class LabelLayer {
  constructor(container, camera, renderer) {
    this.container = container;
    this.camera = camera;
    this.renderer = renderer;
    this.enabled = false;
    this.tags = new Map();
    this._v = new THREE.Vector3();

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    this.root = document.createElement('div');
    this.root.className = 'lab-labels';
    this.tip = document.createElement('div');
    this.tip.className = 'lab-tip';
    this.root.appendChild(this.tip);
    container.appendChild(this.root);

    this.button = document.createElement('button');
    this.button.className = 'lab-toggle';
    this.button.type = 'button';
    this.button.addEventListener('click', () => this.setEnabled(!this.enabled));
    container.appendChild(this.button);
    this.setEnabled(false);
  }

  setEnabled(on) {
    this.enabled = on;
    this.button.textContent = on ? 'Labels: on' : 'Labels: off';
    this.button.setAttribute('aria-pressed', String(on));
    if (!on) this.tags.forEach((t) => { t.el.style.display = 'none'; });
  }

  _tag(e) {
    let t = this.tags.get(e.key);
    const html = `${e.title}${e.sub ? `<small>${e.sub}</small>` : ''}`;
    if (!t) {
      const el = document.createElement('div');
      el.className = `lab-tag ${e.kind ?? ''}`;
      el.innerHTML = html;
      this.root.appendChild(el);
      el.style.display = 'block';
      t = { el, html, w: el.offsetWidth, h: el.offsetHeight };
      el.style.display = 'none';
      this.tags.set(e.key, t);
    } else if (t.html !== html) {
      t.el.innerHTML = html;
      t.html = html;
      t.el.style.display = 'block';
      t.w = t.el.offsetWidth;
      t.h = t.el.offsetHeight;
    }
    return t;
  }

  /** entries: [{key, title, sub?, kind?, anchor: Vector3}] — call once per frame. */
  update(entries) {
    if (!this.enabled) return;
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;
    const cands = [];
    for (const e of entries) {
      this._v.copy(e.anchor).project(this.camera);
      if (this._v.z < -1 || this._v.z > 1) continue;
      const x = (this._v.x * 0.5 + 0.5) * w;
      const y = (-this._v.y * 0.5 + 0.5) * h;
      if (x < -20 || x > w + 20 || y < -20 || y > h + 20) continue;
      const t = this._tag(e);
      const kindBias = e.kind === 'fixture' ? -5 : e.kind === 'container' ? -3 : 0; // fixtures win ties
      cands.push({ key: e.key, x, y, w: t.w, h: t.h, priority: e.anchor.distanceTo(this.camera.position) + kindBias });
    }
    const keep = placeLabels(cands);
    const pos = new Map(cands.map((c) => [c.key, c]));
    this.tags.forEach((t, key) => {
      if (keep.has(key)) {
        const c = pos.get(key);
        t.el.style.display = 'block';
        t.el.style.transform = `translate(${Math.round(c.x - t.w / 2)}px, ${Math.round(c.y - t.h - 4)}px)`;
      } else {
        t.el.style.display = 'none';
      }
    });
  }

  showTip(title, sub, x, y) {
    this.tip.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
    this.tip.style.display = 'block';
    this.tip.style.transform = `translate(${Math.round(x + 14)}px, ${Math.round(y + 16)}px)`;
  }

  hideTip() {
    this.tip.style.display = 'none';
  }
}
