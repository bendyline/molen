# Roseires Dam

Reviewed 2026-11-03. **52 current views inspected.**

The original reconstruction shows the ochre concrete barrage and its repeated buttresses, seven recessed gate and chute bays, the low generator gallery with twelve tailrace recesses, crest control buildings and both immediate embankment ties.

The model uses way/28322101 at [34.387517056, 11.798093465], heading −2.173664636942 radians. Local +X points southwest and +Z points toward the downstream Blue Nile. The replacement mask removes the two tagged crest bridge fragments and preserves all 154 other native road fragments, including the separate downstream bridges.

Six existing graphs provide board-formed and plain concrete, gravel, painted steel, standing-seam roofing and glazing. The skyline uses one draw and the closer tiers at most six. All six GLBs have zero embedded images. Model eviction restores the terrain and releases the geometry.

The 28 terrain views use nine standard Terrarium tiles with unchanged height samples and two native water polygons. The upstream model datum is 483.02 m and the downstream channel sample is 451.00 m. The production sampler returned 483.62–483.65 m upstream and 450.48–452.77 m downstream across the retained windows. The apron openings remain visible at the native shoreline.

The detailed master contains 8,358 triangles. Viewer tiers contain 926, 3316, 4878, 7266 triangles. Skyline plus district are 387,456 bytes and close-up is 642,436 bytes. Four focused checks verify exact source pins, selective replacement, seven sluice channels, twelve outlet recesses, the supported apron and crest deck, and byte-for-byte LOD reconstruction with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

The original geometry covers the mapped 934 m barrage and its immediate grade ties. More distant reservoir embankments use the native terrain. Concrete grades and equipment detail are approximate. Physical-device timing remains unmeasured.

Rebuild with `node packages/worldgen/scripts/generate-roseires-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=roseires_dam`.
