# Tacoma Narrows Bridges — C06 structure asset

![Lit Molen preview](preview.png)

Original stylized geometry generated from the [100-structure plan](../../../../../../../examples/world-explorer/STRUCTURE-EXPANSION-PLAN.md) by `packages/worldgen/scripts/generate-structure-catalog.mjs`. Visual brief: Twin suspension corridor.

Provisional dimensions: 1800 × 170 × 30 meters (X × Y × Z). These dimensions are artistic working values and require measured terrain/footprint alignment before geographic placement. +Y is up; the model is centered at ground or water datum. The runtime asset ID is `molen.worldgen.structure.c06_tacoma_narrows_bridges`.

Source: `spec.json`, `models/source.glb`; the imported runtime GLB and sidecar are under `content/worldgen/assets/places/c2/c22/c06_tacoma_narrows_bridges`. `source.json` pins the source hash. There are no third-party meshes, bitmap textures or texture-generation prompts. The preview is rendered by Molen from `scene.json`.

Rebuild and re-import from the repository root using `node packages/worldgen/scripts/generate-structure-catalog.mjs` and `node packages/worldgen/scripts/import-structure-catalog.mjs`. Verify with `node packages/worldgen/scripts/generate-structure-catalog.mjs --check`, `node scripts/check-source-bundles.mjs`, and `molen asset inspect molen.worldgen.structure.c06_tacoma_narrows_bridges --project content/worldgen/project.json --verify`.

The full-span design master needs tile-sized sections, measured approach transitions and segmented driveable collision before Earth placement.
