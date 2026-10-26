# India Gate — aerial model review

Original procedural medium-fi geometry: 29 × 42 × 15 m approximate envelope; 42 m height is
supported by Delhi Tourism. The open passage, piers, plinth, cornice and bowl are retained.
Inscription, carvings and surrounding buildings are omitted. No texture generation or image pixels.

- Source SHA-256: `7311a957b6f0339354f8f435ac5a1629b17172ff4d70459bcd3b427bb1079ec6`.
- Imported master SHA-256: `e4a7552ecefdc2d66e1ef1a42b8075959c29121bf1d56564d3602a4d1b4fc19f`.
- 284 triangles, 476 vertices, one material, zero textures. All four source-derived runtime
  LODs retain the arch at 284 triangles; skyline geometry is 4,392 GPU bytes and one draw.
- Generator run twice: identical source hash. Asset inspection with `--verify` passed.
- Four turntable views and an explicitly lit Molen scene were inspected. Scene validation
  and 30 simulation ticks passed; tick-30 hash:
  `23a89003d04858073abb0499ca8beb58f2620bf49e4b89d273bacea95f0c3859`.
- Lit scene: two rendered entities, two draw calls, 296 triangles including the ground.
- Central Vista oblique capture inspected: arch replaces the generic multi-storey building.
  Small anchored placement uses host terrain and automatic footprint replacement; it does
  not require the extended-structure terrain sampler. Heading and dimensions other than
  height remain photographic estimates, not survey data.

Commands from repository root:

```sh
node packages/worldgen/scripts/generate-india-gate.mjs
node packages/tooling/dist/cli.mjs asset import content/worldgen/source/places/tt/ttn/india_gate/models/source.glb --id molen.worldgen.structure.india_gate --asset-dir content/worldgen/assets/places/tt/ttn/india_gate --project content/worldgen/project.json --trimesh
node packages/tooling/scripts/generate-landmark-lods.mjs --ids=molen.worldgen.structure.india_gate
node packages/worldgen/scripts/index-structure-sources.mjs
node packages/worldgen/scripts/validate-structure-asset-paths.mjs
node packages/tooling/dist/cli.mjs asset inspect content/worldgen/assets/places/tt/ttn/india_gate/asset.json --verify
node packages/tooling/dist/cli.mjs asset shot content/worldgen/assets/places/tt/ttn/india_gate/asset.json --angles 4 --out-dir .artifacts/aerial-implementation/india-gate
node packages/tooling/dist/cli.mjs validate .artifacts/aerial-implementation/india-gate.scene.json --project content/worldgen/project.json
node packages/tooling/dist/cli.mjs sim run .artifacts/aerial-implementation/india-gate.scene.json --ticks 30 --hash --project content/worldgen/project.json
node packages/tooling/dist/cli.mjs shot .artifacts/aerial-implementation/india-gate.scene.json --project content/worldgen/project.json --out .artifacts/aerial-implementation/india-gate/lit-scene.png
```

One compact preview is retained as `preview.png`; bulk captures remain ignored.
The repository-wide asset stamp/lock still needs reconciliation with the owner's merged model batch.
