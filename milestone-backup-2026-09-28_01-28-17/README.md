# Virtual Laboratory — Three.js Research Milestone

## Milestone: Hooke's Law + GLB + Acid/Base visible-reaction lab

This milestone demonstrates:

1. An interactive Hooke's Law practical with a spring suspended from the bent support arm.
2. Loading a real `.glb` laboratory model with `GLTFLoader` and runtime scale normalization.
3. Three chemistry mini-experiments that communicate different observable changes.

## Acid / Base milestone

The Acid / Base experiment contains three modes:

### 1. Color change — indicator response
- Add acid or base.
- The simulated pH changes.
- The liquid transitions through indicator-like colors.
- A live pH readout communicates the experiment state.

### 2. Bubbles — gas evolution
- Add acid and carbonate.
- Visible bubbles rise through the liquid.
- The UI reports the simulated gas-evolution observation.
- This is a visual educational simulation, not a full chemical reaction solver.

### 3. Precipitate — formation of a visible solid
- Add solution A and solution B.
- Particles appear in the liquid and settle toward the bottom.
- The UI reports that a solid precipitate is being simulated.

These three modes deliberately demonstrate different visual communication techniques: **color transition, animated particles/gas bubbles, and particle formation/settling**.

## Research significance

This milestone provides evidence that Three.js can do more than display static laboratory models. It can connect user actions to an experiment state and then communicate that state through animation, material changes, particle effects, and measurements.

The chemistry layer is intentionally a lightweight educational model. A production system could replace these rules with a domain-specific chemistry engine, validated equations, reaction data, or a backend scientific model.

## GLB model evidence

The Flask equipment button loads:

`models/erlenmeyer-flask.glb`

Runtime normalization is included because imported assets can have very different coordinate scales.

### Required attribution

Erlenmeyer flask by Poly by Google [CC-BY] (https://creativecommons.org/licenses/by/3.0/) via Poly Pizza (https://poly.pizza/m/advGpqPqy0P)

## Run

Serve the project from a local development server (for example Vite) so ES modules and the GLB asset can load correctly.
