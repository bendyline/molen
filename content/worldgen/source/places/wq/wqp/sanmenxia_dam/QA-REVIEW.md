# Sanmenxia Dam

Reviewed 2026-11-03. **49 current catalog views and seven runtime-stage views inspected.**

The model follows the 713 m bowed main dam and includes the 12 upper west outlets, 12 lower east outlets and spillway aprons, two red crest gantries, the photographed inscriptions, the powerhouse and sloped service apron, and the mapped downstream divider.

The retained PMTiles crest sets anchor [111.344695197, 34.829672083] and heading 0.097144258939 radians. Local +X follows the crest east-northeast and +Z points downstream. The native replacement removes the mapped powerhouse and preserves the downstream crossing and neighboring buildings.

Six shared material graphs cover the structure, with zero embedded images in all six GLBs. Eviction releases the model geometry and restores the terrain.

The 27 terrain views use six standard Terrarium tiles and two continuous mapped water polygons at 316.96 m upstream and 281.57 m downstream. Seven additional views use the production sampler. In both sets a light strip remains beside the divider and terrain occludes part of the west abutment and powerhouse approach.

The detailed master contains 3,908 triangles. Viewer tiers contain 962, 2002, 2936, 3704 triangles. Skyline plus district are 271,908 bytes and close-up is 339,284 bytes. Four focused checks verify exact source pins, selective replacement, all 24 recessed outlets, the powerhouse roof, the divider crest and both gantries, and byte-for-byte LOD reconstruction with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

The model is available for preview while the divider shoreline gap and west-side terrain fit remain open. The gate machinery is approximate exterior geometry. The auxiliary earth embankment and buried tunnels are outside this asset. Physical-device timing remains unmeasured.

Rebuild with `node packages/worldgen/scripts/generate-sanmenxia-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=sanmenxia_dam`.
