# Supung Dam

Reviewed 2026-11-03. **46 current catalog views and six runtime-stage views inspected.**

The reconstruction includes the 899.5 m gravity dam, all 26 recessed spillway gates and their continuous apron, the seven-section southeast powerhouse and tailrace recesses, three crest gantries, five sealed log sluices and both concrete abutment ties.

Exact way/74727575 gives a signed anchor at [124.962054994, 40.461438194] and heading −0.929686248123 radians. Local +X runs southeast along the dam and +Z points southwest into the downstream Yalu. The separately mapped service building, road bridge and rail bridge remain native.

Six existing graphs provide board-formed concrete, plain concrete, gravel, painted metal, standing-seam roofing and glazing. All six GLBs have zero embedded images. Model eviction releases geometry and restores terrain.

The 26 terrain views use nine standard Terrarium tiles with unchanged source elevations and two native water polygons. The documented operating pool is 123.3 m. The sampled reservoir windows give 80.38–88.39 m and the downstream windows give 31.16–33.15 m. The six additional views use 80.38 m upstream and 31.16 m downstream to show the effect of the sampled stage.

The detailed master contains 5,394 triangles. Viewer tiers contain 886, 2594, 4518, 4686 triangles. Skyline plus district are 282,892 bytes and close-up is 389,104 bytes. Four focused checks verify exact source pins, selective replacement, 26 gate leaves, seven tailrace recesses, three gantries, five closed sluices and continuous aprons, and byte-for-byte LOD reconstruction with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

The sampled pool exposes an extra 42.92 m of the upstream wall in the comparison. The original terrain also produces sharp shoreline defects. Gate positions, abutment profiles and machinery are exterior reconstructions. The recorded site fit remains pending and physical-device timing remains unmeasured.

Rebuild with `node packages/worldgen/scripts/generate-supung-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=supung_dam`.
