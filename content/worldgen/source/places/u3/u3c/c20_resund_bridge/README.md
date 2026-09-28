# Øresund Bridge — C20 structure asset

![Lit Molen preview](preview.png)

Original stylized geometry generated from the [100-structure plan](../../../../../../../examples/world-explorer/STRUCTURE-EXPANSION-PLAN.md) by `packages/worldgen/scripts/generate-structure-catalog.mjs`. Visual brief: Cable stayed and approach viaduct.

Provisional dimensions: 1550 × 170 × 29 meters (X × Y × Z). These dimensions are artistic working values and require measured terrain/footprint alignment before geographic placement. +Y is up; the model is centered at ground or water datum. The runtime asset ID is `molen.worldgen.structure.c20_resund_bridge`.

Source: `spec.json`, `models/source.glb`; the imported runtime GLB and sidecar are under `content/worldgen/assets/places/u3/u3c/c20_resund_bridge`. `source.json` pins the source hash. There are no third-party meshes, bitmap textures or texture-generation prompts. The preview is rendered by Molen from `scene.json`.

Rebuild and re-import from the repository root using `node packages/worldgen/scripts/generate-structure-catalog.mjs` and `node packages/worldgen/scripts/import-structure-catalog.mjs`. Verify with `node packages/worldgen/scripts/generate-structure-catalog.mjs --check`, `node scripts/check-source-bundles.mjs`, and `molen asset inspect molen.worldgen.structure.c20_resund_bridge --project content/worldgen/project.json --verify`.

The full-span design master needs tile-sized sections, measured approach transitions and segmented driveable collision before Earth placement.
