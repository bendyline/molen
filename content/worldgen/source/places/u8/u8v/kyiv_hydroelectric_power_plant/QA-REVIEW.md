# Kyiv Hydroelectric Power Plant

Reviewed 2026-11-03. **43 current catalog views and five standard-water comparison views inspected.**

The 288 m combined powerhouse and spillway has twenty recessed bays grouped into ten pairs, broad sloping supports, a continuous crest road, two blue gantries, a glazed control tower and two angular quay walls. The ship lock has a distinct chamber axis and its own road bridge.

Standard PMTiles set the anchor at [30.5116981667, 50.5883732122] and heading −0.3464413116 radians. Local +X points east-southeast along the road and +Z points downstream. The separate lock and bridge follow their native map features. The road override covers only the tagged bridge span, retaining the adjacent mapped roads.

Five shared material graphs supply board-formed and plain concrete, painted metal, roofing and glazing. All six GLBs have zero embedded images. Viewer eviction releases model geometry and restores the ground.

Seven standard Terrarium tiles supply the review terrain. The design views use 103 m headwater, 91.5 m tailwater and a 96.1 m illustrative chamber. Representative standard samples give 98.65 m, 90.65 m and 97.59 m respectively.

The detailed master contains 10,680 triangles. The four viewer tiers contain 956, 1440, 6420, 10584 triangles. Skyline plus district are 203,112 bytes and close-up is 833,308 bytes. Four focused checks verify exact hashes, signed placement, road replacement, twenty bay recesses, both gantry roofs, chamber width and bridge grade across the tiers. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

The plant exterior follows an August 2018 photo and the lock follows a June 2021 photo. Later restoration and the current exterior have not been verified. The standard headwater samples about 4.35 m below the reference fixture. The approximate crest and lock-wall grades, unmodeled neighboring facilities and static water are explicit scope limits.

Rebuild with `node packages/worldgen/scripts/generate-kyiv-hydroelectric-power-plant.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=kyiv_hydroelectric_power_plant`.
