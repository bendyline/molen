# Shasta Dam

Reviewed 2026-11-03. **43 current catalog views and five standard-water comparison views inspected.**

The curved gravity section includes three curved closed drum gates between two raised towers, eighteen recessed outlet mouths arranged in three rows, five exposed penstocks with concrete saddles, a continuous crest road and the downstream powerhouse.

The standard map sets the anchor at [−122.4195653200, 40.7188837539] and heading −0.6937927924 radians. Local +X follows the crest southeast and +Z points downstream southwest. The original road is 918.89 m long. The concrete end ties reach into both mapped banks, for 1,052.44 m total crest length. Crest elevation is 328.422 m.

Five shared graphs supply board-formed and plain concrete, painted steel, standing seam roofing and glazing. All six GLBs have zero embedded images. Eviction releases model geometry and restores native ground.

Twelve standard Terrarium tiles supply the terrain. The design fixture uses 325.2216 m normal pool and a 179.7 m tailwater. The sampled comparison uses 326.071875 m and 180.365977 m. The standard field has no samples below 145 m. The central chute and mapped powerhouse use bounded ground openings and both wings retain native banks.

The detailed master contains 11,160 triangles. The four viewer tiers contain 918, 3220, 9956, 10980 triangles. Skyline plus district are 301,068 bytes and close-up is 823,828 bytes. Four focused checks verify source and runtime hashes, signed placement, drum gates, 18 recesses, crest grade, five pipes, the powerhouse roof and deterministic viewer tiers. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

Crest end ties, wing sections, outlet elevations and pipe support details are exterior approximations. The shoreline and concrete show small terrain intersections at the bank transitions. The model depicts closed gates and dry outlets. It excludes interior plant machinery and the independent switchyard.

Rebuild with `node packages/worldgen/scripts/generate-shasta-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=shasta_dam`.
