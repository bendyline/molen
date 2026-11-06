# Iron Gate I Hydroelectric Power Station

Reviewed 2026-11-03. **52 current views inspected.**

The authored barrage contains the central 14-bay spillway, the Serbian and Romanian generating halls, the observation tower, yellow crest cranes, both open two-stage lock channels and their mapped guide walls. The international road follows the mapped bend into Romania and crosses both open lock channels.

The signed placement is [22.529033389, 44.671508243], heading 0.866739086239 radians, using mapped facility way/28270536. Local +X points northeast toward Romania and +Z points downstream. Native feature tests remove only the composite barrage shell and five fragments of the owned international crossing. All 489 other retained road fragments, including the Romanian service bridge, remain.

Five existing material graphs provide board-formed and plain concrete, painted metal, standing-seam metal and glazing. The skyline uses one draw and the closer tiers use five or fewer. All six GLBs have zero embedded images. Eviction releases model geometry and restores the terrain.

The 28 terrain views use 13 standard Terrarium tiles sampled at 16 m. The two main Danube planes are 58 and 40 m and agree within 0.65 m with the production water sampler in the retained probe windows. Four separate chamber surfaces at two heights illustrate the lock stages. The occupied lock and barrage mask preserves all raw height values.

The detailed master contains 8,952 triangles. Viewer tiers contain 960, 3354, 5540, 7992 triangles. Skyline plus district are 359,520 bytes and close-up is 677,200 bytes. Four focused checks verify exact source pins, selective replacement, the 14 spillway gates, curved crossing, twin generating halls and four open lock chambers, and byte-for-byte LOD reconstruction with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

The navigation stage levels, gate equipment and structural elevations are visual interpretations. The stage water planes describe the review fixture and the live viewer samples the native water. Physical-device timing remains unmeasured.

Rebuild with `node packages/worldgen/scripts/generate-iron-gate-i.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=iron_gate_i_hydroelectric_power_station`.
