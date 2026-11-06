# Merowe Dam

Reviewed 2026-11-03. **49 current catalog views and seven runtime-stage views inspected.**

The original geometry includes the curved 9.45 km embankment alignment, 154 m central spillway, twelve low-level recesses, two surface gate sections, ten domed turbine housings along the powerhouse, its service platform and rounded stair tower.

The map frame uses anchor [32.050277777, 18.668888888] and heading 0. Local +X points east and +Z points downstream. The preview uses an absolute elevation datum that holds the modeled crest at 303 m. Its bounds span both banks. Three occupied concrete ground openings retain the native roads and buildings.

Six shared graphs supply board-formed and plain concrete, gravel, painted steel, standing-seam metal and glazing. All six GLBs have zero embedded images. Eviction releases the model geometry and restores the terrain.

The 27 terrain views use 42 standard Terrarium tiles with unchanged elevations and five mapped water polygons. Seven installed-model views use three selected level 14 polygon pieces sampled with the production method. Level 14 and 15 probes near the crossing give 252.43–271.86 m for the reservoir and 250.22–255.31 m for the tailwater.

The detailed master contains 10,302 triangles. Viewer tiers contain 994, 2478, 5942, 7822 triangles. Skyline plus district are 289,916 bytes and close-up is 624,776 bytes. Four focused checks verify exact source pins, absolute elevation and bounded ground openings, all twelve low sluices, both surface gate sections, ten turbine domes, and both embankment end ties, and byte-for-byte LOD reconstruction with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

The sampled reservoir lies 28–48 m below the 300 m design pool and exposes substantially more of the upstream wall. The split sampled fixture covers the central crossing and shows a visible step in the tailwater. Outer banks use the full mapped design-pool fixture for review. Exact embankment profiles, gate settings and service machinery are exterior interpretations. Physical-device timing remains unmeasured.

Rebuild with `node packages/worldgen/scripts/generate-merowe-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=merowe_dam`.
