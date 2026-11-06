# Kainji Dam

Reviewed 2026-11-03. **52 current views inspected.**

The model follows the curved 3.44 km rock-fill embankment and includes the four recessed radial spillway bays, the long glazed generating hall and its tailrace, both open navigation chambers and their gate equipment.

The model follows native way/481361068 at [4.606956596, 9.859472954], heading 0.584587905952 radians. Local +X follows the embankment northeast and +Z points southeast toward the downstream Niger. Replacement removes the single mapped generating-hall footprint and preserves the native crest road, separate F211 bridges and neighboring buildings.

Six existing graphs provide board-formed and plain concrete, gravel, painted steel, standing-seam roofing and glazing. All six GLBs have zero embedded images. Model eviction restores the terrain and releases the geometry.

The 28 terrain views use eight standard Terrarium tiles with unchanged elevation samples and six water polygons. The review uses 139.00 m upstream and 108.42 m at the tailrace. The native sampler returned 139.51–139.65 m upstream and 103.15–109.05 m downstream. Both chambers remain open against the retained terrain and mapped canal.

The detailed master contains 6,488 triangles. Viewer tiers contain 726, 2022, 2954, 6080 triangles. Skyline plus district are 241,512 bytes and close-up is 532,320 bytes. Four focused checks verify exact source pins, selective replacement, four radial bays, the mapped power hall and both open navigation chambers, and byte-for-byte LOD reconstruction with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

The lock cycle and staged water surfaces are illustrative. Gate machinery, grades inside the lock cuts and some bank joins are approximate. The downstream stage varies by branch. The model covers the main dam and lock canal, with the surrounding terrain and roads provided by the native viewer. Physical-device timing remains unmeasured.

Rebuild with `node packages/worldgen/scripts/generate-kainji-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=kainji_dam`.
