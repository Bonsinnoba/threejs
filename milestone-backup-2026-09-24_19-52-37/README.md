# Virtual Laboratory — Three.js Research Milestone

## Milestone: Hooke's Law + real GLB model integration

This milestone demonstrates two pieces of evidence for the virtual-lab proposal:

1. A guided, interactive Hooke's Law practical.
2. Loading a real `.glb` laboratory model into the browser and placing it on the 3D bench.

### Hooke's Law

- The spring is physically suspended from the free end of the bent support arm.
- 100 g masses can be spawned and dragged to the spring.
- Dropping a mass near the spring attaches it.
- Force and extension are calculated from `F = kx`.
- The current prototype uses `k = 19.6 N/m` and `g = 9.81 m/s²`.

### GLB model evidence

The **Flask** equipment button loads:

`models/erlenmeyer-flask.glb`

The model is normalized at runtime because imported 3D assets may use very different coordinate scales.

### Required attribution

Erlenmeyer flask by Poly by Google [CC-BY] (https://creativecommons.org/licenses/by/3.0/) via Poly Pizza (https://poly.pizza/m/advGpqPqy0P)

### Research observations

- Three.js can render imported GLB assets alongside procedurally generated lab equipment.
- `GLTFLoader` provides the browser-side loading path.
- Runtime normalization is useful when assets arrive at incompatible scales.
- Real models introduce additional evidence requirements: attribution, file size, geometry complexity, materials/textures, loading time, and interaction suitability.

## Run

Serve the project from a local development server (for example Vite) so ES modules and the GLB asset can load correctly.
