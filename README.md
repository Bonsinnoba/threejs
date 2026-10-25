# Virtual Laboratory — 3D Physics Lab Environment

A virtual laboratory with procedural glassware, lab inventory system, and physics-based experiments.

## Demonstration

1. Open Hooke's Law.
2. Get a 100 g mass.
3. Drag it to the spring and release it near the hanger.
4. The load is handed to `cannon-es`.
5. Gravity and spring force produce motion; damping lets it settle.
6. Add another mass and observe the changed response.
7. Reset and repeat.

## Architecture

- Three.js: rendering, camera, interaction and visible spring.
- cannon-es: physical body, gravity, spring force and damping.
- Experiment layer: mass values, spring constant and measurements.

## Dependencies

- three 0.180.0
- cannon-es 0.20.0
- Vite

The installer runs `npm install` after copying the milestone files.
