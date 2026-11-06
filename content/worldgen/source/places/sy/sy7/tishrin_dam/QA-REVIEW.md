# Tishrin Dam

Reviewed 2026-11-03. **52 current views inspected.**

The authored exterior includes the long curved embankment, gray reservoir face, divided crest road with painted curbs, six pale blue vaulted roof bays, concrete galleries, control tower, electrical apron and six recessed outlet faces.

The signed position [38.184086288, 36.380875047], heading −0.015370903072 radians, uses the 70-point outline of relation/11009910. Local +X points east along the dam and +Z points toward the downstream Euphrates. The model uses the native crest and approach traces and preserves the separate roads and buildings.

Six existing graphs supply concrete, gravel, painted steel, standing-seam metal and glazing. The skyline uses one draw and the nearer tiers use six or fewer. All six GLBs have zero embedded images. The shared-surface viewer releases geometry and restores ground on eviction.

The 28 site views use nine standard Terrarium tiles sampled at 16 m and two PMTiles water surfaces, with unchanged height samples. The retained PMTiles feature 11423860 spans both sides of the dam. Its two components are separated in the fixture. The reservoir review elevation is 326.55 m and the production sampler returned 327.20 m. The tailwater review elevation is 316.64 m. The production sampler returned 314.82 m immediately below the powerhouse and 304.96–311.01 m across the other downstream windows. Those diagnostic windows are independent of live tile boundaries.

The detailed master contains 19,524 triangles. Viewer tiers contain 804, 3910, 5832, 13260 triangles. Skyline plus district are 425,396 bytes and close-up is 1,226,904 bytes. Four focused checks verify exact source pins, selective replacement, six roof bays and outlet recesses, the supported apron and the crest deck, and byte-for-byte LOD reconstruction with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

Tishrin remains a catalog preview pending downstream waterline verification. The default sampler varies by nearly 10 m between the downstream windows. Local embankment and shoreline contacts are approximate, and the apron electrical equipment and outlet recess dimensions follow visible exterior cues. Physical-device timing remains unmeasured.

Rebuild with `node packages/worldgen/scripts/generate-tishrin-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=tishrin_dam`.
