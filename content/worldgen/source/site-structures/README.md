# Original 100 structure catalog

The 100 assets in the [World Explorer structure plan](../../../../examples/world-explorer/STRUCTURE-EXPANSION-PLAN.md)
have deterministic source GLBs, imported Molen sidecars, lit previews and stable IDs in
`content/worldgen/project.json` and `stylepack.json`. Their fidelity and geographic review
vary; an imported model is not automatically a surveyed replica.

This directory retains the original catalog's [preview gallery](gallery.html) and
[97-model asset index](asset-index.json). Canonical model bundles now live in geographic
folders for named places and semantic folders for reusable buildings and infrastructure.
The [combined gallery](../places/gallery.html), [layout guide](../places/README.md) and
[source index](../structure-index.json) cover both this collection and authored models from
the [next 1,000 candidate catalog](../next-1000/README.md).

| Plan ID | Reference model | Current source |
| --- | --- | --- |
| A01 | Space Needle | [c2/c22/space-needle](../places/c2/c22/space-needle/README.md) |
| C01 | Golden Gate Bridge | [9q/9q8/golden-gate-bridge](../places/9q/9q8/golden-gate-bridge/README.md) |
| C02 | SR 520 floating bridge | [c2/c23/sr-520-floating-bridge](../places/c2/c23/sr-520-floating-bridge/README.md) |

Each model retains its `spec.json`, `models/source.glb`, `source.json`, `scene.json`, preview,
shots and README together. The other 97 models cover 19 Pacific landmarks, 20 global
landmarks, 18 bridges, 20 reusable urban recipes and 20 reusable infrastructure recipes.
All named models now have sourced organizational coordinates. Imported runtime bundles mirror
their source geography under `content/worldgen/assets/places/`; reusable bundles use
`assets/reusable/`. Runtime asset IDs and placement records are independent of folder names.

After `pnpm -r build`, regenerate the three reference masters with
`node packages/worldgen/scripts/generate-site-structures.mjs`. For the other 97 models, use
`node packages/worldgen/scripts/generate-structure-catalog.mjs`,
`node packages/worldgen/scripts/import-structure-catalog.mjs`, and
`node packages/worldgen/scripts/capture-structure-catalog.mjs` (requires Chromium).
The authoring scripts resolve their outputs through the source registry; `--check` verifies
the deterministic sources without writing them. `node scripts/check-source-bundles.mjs`
verifies source hashes against imported sidecars.

To refresh catalog links after reorganizing sources without reimporting GLBs, run
`node packages/worldgen/scripts/import-structure-catalog.mjs --index-only`.
