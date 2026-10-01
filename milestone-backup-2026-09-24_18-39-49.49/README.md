# Virtual Laboratory — Three.js Research Prototype

Three.js / 3D rendering proof-of-concept for the virtual laboratory project.

## Current milestone
- Three-column laboratory interface
- 3D laboratory bench
- Procedural placeholder equipment
- Select-and-drag equipment in 3D
- Orbit camera controls
- Hooke's Law, Acid/Base, and Simple Circuit experiment panels
- GLTFLoader integration point for real `.glb` / `.gltf` assets

## Models
Place licensed `.glb` or `.gltf` files in `models/`. Three.js recommends glTF/GLB for runtime assets.

## Running
Use a local development server such as VS Code Live Server.

## Next
1. Replace placeholders with the selected laboratory models.
2. Build reusable equipment interactions.
3. Implement Hooke's Law.
4. Implement chemistry and circuit mechanics.
5. Add `cannon-es` where physical simulation is useful.
6. Measure browser performance for the pitch.
