# Manantali Dam

Reviewed 2026-11-03. **46 current catalog views and six runtime-stage views inspected.**

The reconstruction includes the full concrete center and both rockfill flanks, eight recessed radial gates with continuous chutes, the ochre two-level generating hall and five tailrace recesses, the control tower, and the two crest gantries.

Exact way/190325901 gives a signed anchor at [−10.42949016, 13.197351992] and heading −1.528484012338 radians. Local +X follows the crest south and +Z faces the Bafing tailrace. The mask removes two overlapping crest road fragments and preserves both independent RN22 crossing fragments and the other roads.

Six existing graphs provide board-formed concrete, plain concrete, gravel, painted metal, standing-seam roofing and glazing. All six GLBs have zero embedded images. Model eviction releases geometry and restores terrain.

The 26 terrain views use five standard Terrarium tiles with unchanged source elevations and two native water polygons. The continuous review uses a 204.43 m reservoir reference and 162.22 m tailrace. The five sampled windows give 202.37–211.92 m upstream and 162.22–192.28 m downstream. The comparison illustrates the effect of those estimates on local water heights using simplified window boundaries.

The detailed master contains 6,298 triangles. Viewer tiers contain 944, 2744, 3536, 5890 triangles. Skyline plus district are 303,608 bytes and close-up is 492,024 bytes. Four focused checks verify exact source pins, selective replacement, eight spillway gates, five tailrace recesses and the continuous aprons and decks, and byte-for-byte LOD reconstruction with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

The original terrain contains sharp defects near the south reservoir shore. One retained pixel in tile 14/7717/7586 is −1,680.49 m among 239–244 m neighbors. The sampled tailwater also differs by about 30 m across nearby windows. Geographic readiness is pending with both effects recorded. Gate and plant equipment are exterior interpretations, and physical-device timing remains unmeasured.

Rebuild with `node packages/worldgen/scripts/generate-manantali-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=manantali_dam`.
