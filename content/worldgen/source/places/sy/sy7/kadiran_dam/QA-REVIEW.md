# Kadiran Dam

Reviewed 2026-11-03. **49 current catalog views inspected.**

The model includes the 2.56 km regulating crest, paved road and curved lamps, recessed spillway gates and hoists, a crest gantry, the mapped powerhouse and its graded service apron, and the adjacent tailrace outlets.

The named Baath Dam road fixes the anchor at [38.747195011, 35.885219106] and the heading at 2.782194682538 radians. Local +X follows the crest northwest and +Z points downstream. The model replaces only the mapped powerhouse footprint and occupied crest paving. The separate downstream bridge and surrounding access roads remain native.

Six shared graphs supply board-formed and plain concrete, gravel, painted steel, standing-seam metal and glazing. All six GLBs have zero embedded images. Unloading releases the model geometry and restores the terrain.

The 27 terrain views use eleven standard Terrarium tiles and three retained water polygons. The production sampler gives 253.64–253.66 m in the reservoir and 246.75–247.50 m in the tailwater. The apron and adjacent graded edges cover the cut and the powerhouse windows remain visible. The fixture uses one continuous tailwater level within the sampled range.

The detailed master contains 4,608 triangles. Viewer tiers contain 544, 1212, 2988, 4272 triangles. Skyline plus district are 149,288 bytes and close-up is 339,572 bytes. Four focused checks verify exact source pins, absolute elevation and selective replacement of the mapped powerhouse and crest pavement, spillway and tailrace recesses, the powerhouse roof and apron, and the continuous crest, and byte-for-byte LOD reconstruction with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

The five modeled spillway bays are an exterior interpretation. The exact gate count and operating machinery remain unconfirmed. Powerhouse trim, the apron and three tailrace portals use approximate exterior geometry. Physical-device timing remains unmeasured.

Rebuild with `node packages/worldgen/scripts/generate-kadiran-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=kadiran_dam`.
