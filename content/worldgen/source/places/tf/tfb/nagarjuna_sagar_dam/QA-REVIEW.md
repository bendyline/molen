# Nagarjuna Sagar Dam

Reviewed 2026-11-03. **46 current views inspected.**

The original reconstruction shows a dark masonry barrage, 26 radial crest gates and the continuous curved spillway, stair towers on both sides, the high abutments and the cream north-bank generating hall.

The model follows way/101362710 at [79.31149984, 16.575274434], heading 1.268828532914 radians. Local +X follows the crest northeast and +Z points toward the downstream Krishna. Only the occupied sections of the three native crest fragments are clipped. Both outer approaches, the separate NH565 bridge, 446 unrelated road fragments and 100 neighboring buildings are retained.

Six existing material graphs supply concrete, gravel, painted metal, standing-seam roofing and glazing. All six GLBs have zero embedded images. Eviction releases the model geometry and restores the terrain.

The terrain views use eight standard Terrarium tiles sampled at 16 m, with native reservoir and downstream polygons. The upstream fixture is 160.12 m and the downstream fixture is 70.64 m. The production sampler returns 159.88–160.65 m upstream and 70.38–72.09 m downstream in the retained windows.

The detailed master contains 4,976 triangles. Viewer tiers contain 520, 1598, 1952, 4088 triangles. Skyline plus district are 171,328 bytes and close-up is 332,756 bytes. Four focused checks verify exact source pins, selective replacement, 26 radial gates, spillway chute, generating hall and crest deck, and byte-for-byte LOD reconstruction with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

The model covers the mapped 1,352 m concrete dam and generating hall. Remote perimeter dikes use native terrain. A small contact seam remains at the far southwest approach. Equipment details, gate elevations, stair interiors and apron grades are approximate. Physical-device timing remains unmeasured.

Rebuild with `node packages/worldgen/scripts/generate-nagarjuna-sagar-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=nagarjuna_sagar_dam`.
