# Virtual Laboratory — Physics Integration Milestone

## Purpose

This milestone adds a first physics-engine integration using **cannon-es** while preserving the existing Three.js experiment architecture.

### Architecture

- **Three.js** — renders the laboratory and visual objects.
- **cannon-es** — simulates gravity and rigid-body motion for attached Hooke's Law masses.
- **Experiment logic** — continues to calculate Hooke's Law measurements and educational state.

### What to inspect

1. Open Hooke's Law.
2. Get a 100 g mass.
3. Drag it to the spring and attach it.
4. Observe that the attached mass is now backed by a cannon-es physics body.
5. Reset and compare the interaction with the previous milestone.

The prototype deliberately keeps the physics integration small. It demonstrates the bridge between a Three.js mesh and a Cannon physics body without pretending that the physics engine itself is the scientific model.

### Why this matters

This gives the research project evidence for separating:

`rendering → physics → experiment/scientific rules`

That separation will make it easier to decide which future experiments need a physics engine and which can use direct mathematical simulation.

## Technology

- Three.js 0.180.0
- cannon-es 0.20.0


## Important Vite note

`cannon-es` is an npm dependency. Vite resolves the package from `node_modules`, so the project must run `npm install` before Vite starts. The milestone installer now performs this step automatically.


## Package setup

This milestone explicitly declares all runtime/build dependencies in `package.json`:

- `three` 0.180.0
- `cannon-es` 0.20.0
- `vite`

The installer runs `npm install` after copying the files. The project no longer depends on a browser import map for these npm packages.
