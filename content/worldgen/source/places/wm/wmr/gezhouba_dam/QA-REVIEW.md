# Gezhouba Dam

Reviewed 2026-11-03. **43 current catalog views and five standard-water comparison views inspected.**

The 2.6065 km crossing has 27 main spillway bays, nine western silt sluices, six eastern silt sluices, two separately outlined powerhouse wings, red traveling gantries and three distinct locks.

The PMTiles crest road gives the anchor at [111.27196732, 30.73910240] and heading −0.33975578 radians. Local +X runs east-southeast and +Z runs downstream. Both powerhouse roof outlines and all three lock axes follow the retained map. The fixed crest elevation is 70 m.

Shared board-formed concrete, plain concrete, painted metal, standing seam roof and glazing graphs supply the finish. All six GLBs have zero embedded images. Viewer eviction releases the model geometry and restores native terrain.

The design fixture uses 66 m upstream and 39 m downstream with illustrative lock chamber stages. Five comparison views use representative stages from eleven standard Terrarium tiles. The standard sampler gives 62.62 m upstream and 42.78 m downstream, and returns 48.92 m, 56.16 m and 58.39 m for the three lock windows.

The detailed master contains 10,948 triangles. The four viewer tiers contain 980, 2996, 9400, 10912 triangles. Skyline plus district are 323,912 bytes and close-up is 857,784 bytes. Four focused checks verify byte pins, signed placement, 42 gate faces and upper apertures, both roofs, the widths and gate states of three chambers, and deterministic viewer tiers. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

The retained terrain contains 71 elevations below 10 m, including artifacts near the crossing. Terrain can distort native bank slopes and the sampled water stages differ from the design fixture. The placement remains a preview. Lock 3 represents the closed legacy chamber; temporary cofferdams and ongoing expansion are outside the model. Exact equipment spacing and approach grades are approximate.

Rebuild with `node packages/worldgen/scripts/generate-gezhouba-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=gezhouba_dam`.
