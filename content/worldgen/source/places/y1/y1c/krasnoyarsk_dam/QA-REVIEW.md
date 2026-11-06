# Krasnoyarsk Dam

Reviewed 2026-11-03. **46 current views inspected.**

The unique model includes the straight concrete gravity wall, regularly divided spillway, three crest gantries, right-bank powerhouse and the northwest inclined ship lift. The lift includes a round turntable, a parked caisson and concrete landing piers. The two banks connect to authored abutments that share the dam profile and terminate against the sampled hillside.

The dam spans the water boundary between PMTiles reservoir 12728533 and downstream river 64482123, with the crest road 35184859541115 and native powerhouse 35185554367336. The signed frame is [92.294444, 55.934722], heading 2.53505751713827 radians. Local +X follows the crest northwest and +Z faces downstream. The crossing separation and exact native power hall and rail bridge replacement passed the focused production checks. The downstream public road bridge remains present.

Five existing graphs supply board-formed and plain concrete, painted metal, standing-seam roofing and glazing. The skyline uses one draw and the closer tiers use at most five. All six GLBs have zero embedded images. Eviction releases model geometry and restores ground.

The 26 site views use 18 standard Terrarium tiles sampled at 16 m, both native Yenisei reaches, and occupied dam and lift masks. The fixture retains the raw 66,049 terrain samples. A local diagnostic comparison attributed some irregular bank edges to 194 anomalously low samples. The comparison did not replace the raw review fixture.

The detailed master contains 9,206 triangles. Viewer tiers contain 976, 2892, 5558, 8450 triangles. Skyline plus district are 334,528 bytes and close-up is 711,008 bytes. Four focused checks verify exact source pins, selective replacement, the seven modeled gates, powerhouse roof, both abutments and inclined rail bed, and byte-for-byte LOD reconstruction with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

The gate division, caisson, machinery and rail elevations are visual estimates. The source terrain still has local bank artifacts and coarse grade transitions. Physical-device timings remain unmeasured.

Rebuild with `node packages/worldgen/scripts/generate-krasnoyarsk-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=krasnoyarsk_dam`.
