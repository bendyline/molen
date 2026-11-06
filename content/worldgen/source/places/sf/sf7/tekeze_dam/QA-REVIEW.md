# Tekezé Dam

Reviewed 2026-11-03. **43 current catalog views and five standard-water comparison views inspected.**

The model reproduces the 420 m double-curvature arch, four recessed midlevel outlet mouths, four raised gate headworks, the separate power intake crane and the south thrust block.

The retained river mouth sets the anchor at [38.74320567, 13.34681021] and heading −2.24668629 radians. Local +X runs southwest across the crest and +Z runs northwest downstream. The retained reservoir shoulders bound the crest, and the 1145 m grade uses fixed absolute elevation.

Three shared graphs supply board-formed concrete, plain concrete and painted steel. All six GLBs have zero embedded images. Eviction releases model geometry and restores terrain.

The 25 design-terrain views use nine standard Terrarium tiles and an illustrative tailwater corridor traced from native river lines. The design fixture clips the reservoir at the upstream concrete face and uses 1140 m maximum retention. Five comparison views use representative sampled stages of 1012.03 m upstream and 997.28 m downstream.

The detailed master contains 1,348 triangles. The four viewer tiers contain 660, 926, 1286, 1336 triangles. Skyline plus district are 129,236 bytes and close-up is 105,836 bytes. Four focused checks verify exact source pins, signed placement, preserved crest curvature and grade, four recessed outlets, the intake deck, thrust block and byte-for-byte viewer tiers. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

The sampled upstream stage is about 128 m below maximum retention. The comparison exposes the upstream face and produces steep banks at the native polygon edges. The width of the tailwater corridor and the dimensions of the tie, gate works and intake are approximations. The model depicts dry closed gates. Underground generation and operating flow are outside the exterior asset.

Rebuild with `node packages/worldgen/scripts/generate-tekeze-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=tekeze_dam`.
