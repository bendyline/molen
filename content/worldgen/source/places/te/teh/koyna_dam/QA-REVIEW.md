# Koyna Dam

Reviewed 2026-11-03. **43 current catalog views and five standard-water comparison views inspected.**

The model reproduces the 807.72 m buttressed gravity dam, six radial gates below the crest deck, striped crest tower, mapped powerhouse and the retaining walls and apron of the stilling basin.

The named attraction and straight reservoir edge establish a signed anchor at [73.75160514, 17.40217853] and heading −0.53618712 radians. Local +X runs southeast and +Z runs southwest down the Koyna valley. The fixed 664.45 m crest includes approximate extensions on both banks. The native downstream bridge and access roads stay in place.

Five shared graphs supply board-formed and plain concrete, painted steel, standing-seam roofing and glazing. All six GLBs have zero embedded images. Eviction releases the model geometry and restores the terrain.

The 25 terrain views use nine standard Terrarium tiles and retained reservoir and stilling basin shorelines. Five comparison views use the production sampler’s representative stages of 642.45 m and 577.09 m. The design fixture uses the 659.43 m full pool and an illustrative 581 m basin level.

The detailed master contains 10,622 triangles. Viewer tiers contain 888, 1138, 1694, 7430 triangles. Skyline plus district are 157,068 bytes and close-up is 579,988 bytes. Four focused checks verify exact source pins, signed placement, retained bridge, six gates with open headspaces and five intermediate piers, mapped powerhouse, and byte-for-byte reconstruction of the four viewer tiers. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

The sampled upstream level is approximately 17 m below full pool. Parts of the eastern buttresses and basin walls intersect coarse terrain, and the reservoir banks include spurious low samples. The model shows closed gates and approximate abutment and power station sections.

Rebuild with `node packages/worldgen/scripts/generate-koyna-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=koyna_dam`.
