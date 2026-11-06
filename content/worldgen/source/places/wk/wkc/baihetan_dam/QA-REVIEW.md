# Baihetan Dam

Reviewed 2026-11-03. **46 current catalog views and six standard-water comparison views inspected.**

The model reproduces the 709 m asymmetric double-curvature arch, six surface spillway bays, seven deep outlets with chutes, crest galleries, red gantries, finned intake, concrete abutment ties and the auxiliary weir.

The reservoir shoreline and buried Jinsha crossing set the anchor [102.9030588, 27.2231173] and heading 3.109648611653 radians. Local +X faces west across the crest and +Z follows the river downstream. The 834 m crest uses a fixed absolute elevation. The narrow ground opening covers the occupied deck and intake. Nearby roads, tunnel paths and canyon slopes remain native.

Five shared graphs supply board-formed and plain concrete, gravel, painted steel and glazing. All six GLBs have zero embedded images. Eviction releases the model geometry and restores the terrain.

The 26 terrain views use nine standard Terrarium tiles and separate reservoir, plunge pool and tailwater stages. Six installed-model views compare the production sampler. The checked tiles give 676.79 m upstream and 637.62–641.76 m downstream. The design fixture uses the operator’s 825 m normal pool and an illustrative 643 m plunge pool.

The detailed master contains 3,214 triangles. Viewer tiers contain 758, 1434, 2654, 2774 triangles. Skyline plus district are 175,132 bytes and close-up is 208,964 bytes. Four focused checks verify exact source pins, absolute elevation and bounded ground openings, six upper and seven deep recessed bays, the 834 m crest, and the auxiliary weir, and byte-for-byte LOD reconstruction with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

The sampled reservoir is about 148 m below the normal pool. It exposes the upper part of the upstream wall and produces steep shoreline curtains on the standard terrain. Parts of the crest abutments lie within coarse native rock. The weir crest and plunge stage are approximate. Buried caverns, tunnels and operating discharge are outside the exterior asset. Physical-device timing remains unmeasured.

Rebuild with `node packages/worldgen/scripts/generate-baihetan-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=baihetan_dam`.
