# Volga Hydroelectric Station

Reviewed 2026-11-03. **46 current catalog views and six runtime-stage views inspected.**

The exterior includes the 725 m spillway and 27 recessed gate bays, the long glazed powerhouse, both traveling cranes, the crest road and overhead rail, the approach embankments, and navigation locks 30 and 31 with open chambers and gate towers.

The PMTiles crossing sets anchor [44.671849458, 48.825970788] and heading −0.419222746019 radians. Local +X follows the crest road southeast and +Z faces downstream. The mask selects nine fragments of the crest road and rail and preserves the separate lock crossing. The two powerhouse outlines own the corresponding native building parts.

Six existing graphs provide board-formed concrete, plain concrete, gravel, painted steel, standing-seam roofing and glazing. All six GLBs have zero embedded images. Eviction releases the model geometry and restores the terrain.

The 26 terrain views use 20 standard Terrarium tiles with unchanged elevation samples and 13 water polygons. The reference fixture uses 7.96 m upstream and −8.4 m downstream. The production sampler returns 8.29–9.03 m upstream and 2.15 m in the tailwater. Its sea-level floor triggers on these low inland water polygons. The same sample returns approximately −7.38 m below the dam with that floor disabled.

The detailed master contains 12,662 triangles. Viewer tiers contain 868, 3728, 6602, 10718 triangles. Skyline plus district are 383,776 bytes and close-up is 912,224 bytes. Four focused checks verify exact source pins, selective replacement, all 27 spillway bays, the powerhouse roof and both open lock chambers, and byte-for-byte LOD reconstruction with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

The six runtime-stage views show the 10.55 m higher tailwater covering the lower apron and part of the generating hall outlets. Bank joins, lock gate equipment and chamber levels are approximate. Remote dikes and the separate crossing at the locks use native geometry. Physical-device timing remains unmeasured.

Rebuild with `node packages/worldgen/scripts/generate-volga-hydroelectric-station.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=volga_hydroelectric_station`.
