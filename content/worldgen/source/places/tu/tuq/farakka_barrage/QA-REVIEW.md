# Farakka Barrage

Reviewed 2026-11-03. **49 current catalog views and seven runtime-stage views inspected.**

The model includes the 2,245 m barrage with 109 bays, the paired two-tier fish-lock gates in bay 25, the raised steel hoist gallery, the NH12 road and twin rail tracks, the control house, the 11-bay head regulator and the existing open navigation chamber.

The mapped NH12 crossing sets anchor [87.933014411, 24.804552732] and heading 0.334179189760 radians. Local +X follows the crossing northeast and +Z points southeast toward the downstream Ganga. The road mask replaces 13 overlapping road and rail fragments and preserves the separate feeder crossing and its approaches.

Seven existing graphs provide brick, board-formed and plain concrete, gravel, painted steel, standing-seam roofing and glazing. All six GLBs have zero embedded images. Eviction releases the model geometry and restores the terrain.

The 27 terrain views use 12 standard Terrarium tiles with unchanged elevations and eight native or chamber water polygons. The production sampler gives 23.48–23.64 m upstream and 18.42 m downstream of the main barrage. It gives 25.53 m in the feeder and 25.71 m in the navigation chamber. Those higher stages were rendered separately and the structures and gate tops remain above water.

The detailed master contains 91,368 triangles. Viewer tiers contain 976, 3682, 14508, 61392 triangles. Skyline plus district are 389,384 bytes and close-up is 5,313,332 bytes. Four focused checks verify exact source pins, selective replacement, all 109 bays, the two fish-lock tiers, the eleven regulator bays and the navigation chamber, and byte-for-byte LOD reconstruction with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

The gate settings are illustrative and the bank ties and control machinery use approximate exterior geometry. The higher sampled feeder and chamber levels cover more of the lower gate leaves. A short stepped shoreline join remains at the outer end of the regulator. The newer parallel navigation chamber and separate feeder road and rail crossing are outside this asset. Physical-device timing remains unmeasured.

Rebuild with `node packages/worldgen/scripts/generate-farakka-barrage.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=farakka_barrage`.
