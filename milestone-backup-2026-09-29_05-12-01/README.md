# Virtual Laboratory — Refined Physics Integration

## What this milestone demonstrates

The Hooke's Law experiment now uses an actual **cannon-es spring system** rather than only moving the mass to a mathematically calculated position.

### Separation of responsibilities

- **Three.js** renders the spring, support, masses, laboratory and UI.
- **cannon-es** simulates gravity, spring force, damping and the load's motion.
- **Hooke's Law experiment logic** defines the mass values and spring constant used by the experiment.

### What to inspect

1. Open Hooke's Law.
2. Click **Get 100 g mass**.
3. Drag the mass to the spring.
4. Release it near the spring.
5. Watch the mass move and settle instead of snapping immediately to a fixed position.
6. Add another mass and observe the load and spring respond to the increased mass.
7. Reset and repeat.

The displayed extension is based on the simulated load position once physics is active.

## Research evidence

This milestone demonstrates a meaningful reason to introduce a physics engine: the spring experiment now has dynamic motion and damping rather than only a static mathematical displacement.

It also shows why the physics engine should remain separate from the experiment/scientific model. `cannon-es` provides physical motion; the experiment layer still defines what the 100 g masses, spring constant, force and educational measurements mean.

## Important limitation

This is a prototype physics model, not a validated laboratory-grade mechanical solver. The spring is represented by a point-load physics body and a visual Three.js spring. Further refinement could add collision shapes, constraints, calibrated damping, multiple physical masses, and experimental uncertainty.

## Technology

- Three.js 0.180.0
- cannon-es 0.20.0
- Vite
