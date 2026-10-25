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

## Procedural Models

The lab uses procedurally generated 3D models organized into separate modules by purpose:

### Glassware (`glassware.js`)
All glass vessels (beakers, flasks, measuring cylinders, test tubes, reagent bottles) are generated from 2D profiles defined in `glass-profiles.js`. Each vessel shape is defined as a 2D cross-section of `[radius, y]` points, which is then rotated around the Y-axis using Three.js `LatheGeometry` to create the 3D vessel. This approach provides:
- Dynamic liquid levels (fill/drain by milliliters)
- Real glass thickness with inner/outer walls
- Consistent physical glass materials with reflections
- Small file size compared to GLB models

### Lab Environment (`labBench.js`)
The laboratory workspace is procedurally generated, including:
- Lab island with worktop, drawers, and cupboards
- Wall shelving for storage
- Procedural textures (oak wood grain, warning decals)
- Fixtures: sink, gooseneck tap, gas tap, electrical socket
- Room walls, floor, and ceiling

### Small Lab Equipment (`catalog.js`)
Small procedural equipment items:
- Watch glass, petri dish, crucible
- Stirring rod, spatula, cork stopper
- Uses glass material for glass items, porcelain/steel for others

### External GLB Models
Complex equipment is loaded from GLB files:
- Bunsen burners, test tube racks, tripod stands
- Funnels, circuit components (batteries, resistors, switches)
- Located in `models/` and `virtual labs/` directories

## Dependencies

- three 0.180.0
- cannon-es 0.20.0
- Vite

The installer runs `npm install` after copying the milestone files.
