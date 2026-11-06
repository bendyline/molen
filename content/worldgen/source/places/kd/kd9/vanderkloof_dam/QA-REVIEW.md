# Vanderkloof Dam

Reviewed 2026-11-03. **43 current catalog views and five standard-water comparison views inspected.**

The model reproduces the 770 m curved crest road, fourteen ribbed overflow openings, four south-flank radial gates with distinct chutes, and six recessed lower outlet openings.

The retained crest road and both water polygons bind the frame at [24.7317, −29.9922] with a heading of −π/2. Local +X runs south along the crest and +Z runs west downstream. The 1180 m road grade is absolute. The modeled road ends are extended from the mapped crest trace to reach the documented length.

Three shared graphs supply board-formed concrete, plain concrete and painted steel. All six GLBs have zero embedded images. Eviction releases the model geometry and restores terrain.

The 25 terrain views use nine standard Terrarium tiles with two separately sampled water stages. Five comparison views use representative stages of 1165.33 m upstream and 1102.63 m downstream. The separate reference fixture uses 1170.5 m full supply and an illustrative 1106 m tailwater. The rectangular review window clips the far reservoir edge.

The detailed master contains 2,264 triangles. The four viewer tiers contain 928, 1192, 1902, 2216 triangles. Skyline plus district are 165,840 bytes and close-up is 165,284 bytes. Four focused checks verify the signed crest frame, bounded replacement, gate counts and negative spaces, and exact browser-tier reconstruction with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

The northern and southern banks mask parts of the outer concrete wings in the standard terrain. The southern low outlets and the lower reaches of the radial chutes are partly occluded. The exact tie, outlet and lower chutes are approximate. Operating discharge and the underground generating station are outside the exterior model.

Rebuild with `node packages/worldgen/scripts/generate-vanderkloof-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=vanderkloof_dam`.
