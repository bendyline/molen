# Dyke Kokaral

Reviewed 2026-11-03. **46 current views inspected.**

The full V-shaped embankment and both shoreline ties follow the retained map shape. Close views show the flared intake and outlet, nine steel leaves with partly open flow gaps, dividing piers, bracing, rails, lights and the continuous KNA-22 crest deck. The close regulator is the catalog preview and the full dyke has a separate overview.

The model uses the signed exact way 82650638 and Q1166032 frame at [60.79475474, 46.098499985], heading −0.435207816096 radians. The 57.325 m regulator spans the two mapped shoulders. The North Aral reservoir lies on the northeast side and the modeled regulator drains southwest into the native outlet. The 12,759.79 m sampled KNA-22 crest trace is distinct from the 13,034 m retained source length. Seven centerline probes across the regulator fall inside the authored deck. All 27 native road records remain in the fixture and the placement carries no road replacement.

Four existing shared 256 px material graphs supply gravel, basalt, concrete and painted metal. A single skyline draw and at most five near groups use metric UVs and linear tints. All six outputs have zero embedded images. Shared runtime eviction disposes the model geometry and restores ground.

The 26 lighting, silhouette, component and tier-transition views use the 64 m standard Terrarium grid and separate mapped reservoir and outlet surfaces. The viewer shoreline clipping and bank meshing keep the shallow reservoir visible without modifying the original heightfield. The three structure masks cover only the occupied embankment and regulator. All eight interior probes clear terrain and preserve the source values. At corridor scale the saved water polygons stop at the PMTiles extract boundaries.

The detailed master contains 5,575 triangles. Skyline, district, street and close-up retain 804, 3106, 4682, 4912 triangles, respectively. Skyline plus district total 383,068 bytes and close-up is 486,856 bytes. Four focused checks verify placement and source pins, native road and water retention, the nine gates and continuous deck, and exact tier rebuilds with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

Crest, sill and tailwater grades are approximate at 64 m terrain resolution. Minor seams remain where the low banks meet the regional terrain. The operating level and unpictured machinery are illustrative. The full live PMTiles/terrain stream and physical-device timings were outside this local fixture review.

Rebuild with `node packages/worldgen/scripts/generate-dyke-kokaral.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=dyke_kokaral`.
