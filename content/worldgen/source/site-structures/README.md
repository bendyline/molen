# Site-specific structure assets

All 100 assets in the [World Explorer structure plan](../../../../examples/world-explorer/STRUCTURE-EXPANSION-PLAN.md)
now have original deterministic source GLBs, imported Molen sidecars, lit previews, and IDs in
`content/worldgen/project.json` and `stylepack.json`. The default worldgen pack contains 108
assets (the 100 structures, five next-catalog studies, and three existing props). Its asset
provider resolves every structure ID to a runtime GLB. These models are stylized studies with
provisional dimensions; Earth coordinate matching, measured placement, LODs, and segmented
bridge streaming remain future work.

The [next 1,000 candidate catalog](../next-1000/README.md) adds five more imported structure
studies. Its searchable [gallery](../next-1000/gallery.html) keeps the remaining 995 candidates
separate from finished model assets.

| Plan ID | Asset | Source | State |
| --- | --- | --- | --- |
| A01 | [Space Needle](space-needle/README.md) | `space-needle/spec.json` | Reference model imported |
| C01 | [Golden Gate Bridge](golden-gate-bridge/README.md) | `golden-gate-bridge/spec.json` | Reference suspension section imported |
| C02 | [SR 520 floating bridge](sr-520-floating-bridge/README.md) | `sr-520-floating-bridge/spec.json` | Reference floating section imported |

Browse all 100 renders in the [preview gallery](gallery.html). The [asset index](asset-index.json)
lists the other 97 IDs, source folders, triangle counts, and
runtime bytes. Each folder contains `spec.json`, `models/source.glb`, `source.json`, `scene.json`,
`preview.png`, and an asset-specific README. The generated models cover 19 additional Pacific
landmarks, 20 global landmarks, 18 bridges, 20 urban building recipes, and 20 infrastructure
recipes.

After `pnpm -r build`, regenerate the editable masters with
`node packages/worldgen/scripts/generate-site-structures.mjs`. Re-import each changed GLB using
the command in its README. `--check` verifies the deterministic source, and
`node scripts/check-source-bundles.mjs` verifies source hashes against imported sidecars.
For the 97 catalog models, use `node packages/worldgen/scripts/generate-structure-catalog.mjs`,
`node packages/worldgen/scripts/import-structure-catalog.mjs`, and
`node packages/worldgen/scripts/capture-structure-catalog.mjs` (requires the installed Chromium
capture runtime). Both generation and import scripts support `--check`.
