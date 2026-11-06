# Mangla Dam

Reviewed 2026-11-03. **46 current views inspected. Western spillway placement and native terrain fit pending.**

The original exterior includes the curved rock-fill embankment and service-road crown, a separate western nine-bay spillway with broad curved chute, retaining banks and inspection walk, and the long roof and enclosed plinth of the lower powerhouse. The plant wall faces and physical footing support were corrected after inspecting the first site captures.

The retained Q1286541 reference, signed reservoir shoreline, crest-side service road and separate native powerhouse identify Mangla. In the model frame +X points east and +Z south. The selected 3,350.958 m visual ridge trace is distinct from the 3,140 m retained source length. The western ridge follows the lake edge and standard terrain fit, and its downstream gate locations are provisional. The map places the powerhouse on the separate eastern outlet. The native footprint mask replaces only that one mapped hall. All 800 road fragments, including the downstream bridge, are retained.

Six existing shared 256 px graphs supply basalt, gravel, concrete, painted metal, standing-seam roofing and window glazing. One skyline draw and seven material groups on nearer tiers use metric UVs and linear tints. All six GLBs have zero embedded images. Shared runtime eviction restores the ground and disposes the model.

The 26 site views use 49 standard Terrarium tiles sampled at 48 m, plus two mapped water reaches with five polygons and six island holes. Three masks limit terrain changes to the embankment, chute and powerhouse. All fifteen interior probes clear the masks and the original terrain source stays intact. Ten anomalously low elevation samples remain in the raw fixture and are excluded only from toe-grade interpolation.

The detailed master contains 7,496 triangles. Viewer tiers contain 618, 1784, 2468, 5156 triangles. Skyline plus district are 234,988 bytes and close-up is 462,028 bytes. Four focused checks verify source pins and signed frame, selective powerhouse replacement, all modeled gate leaves and openings, basin floor, deck and front-facing plant plinth in the six GLBs, and exact tier rebuilds with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks. Physical-device timing remains unmeasured.

The western spillway gate axis is an estimate from photographs and the mapped tail channel. The retained water polygon starts at the runout and does not establish an upstream connection at the authored gate. A narrow gap remains outside the west chute wall, and DEM transitions are visible at the embankment and canal edges. The auxiliary works, exact gate count and operating levels need geographic review. Keep the placement provisional.

Rebuild with `node packages/worldgen/scripts/generate-mangla-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=mangla_dam`.
