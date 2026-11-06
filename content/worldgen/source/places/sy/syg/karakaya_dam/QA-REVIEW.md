# Karakaya Dam

Reviewed 2026-11-03. **46 current views inspected. Canyon terrain fit pending.**

The original exterior includes the curved concrete arch, ten tapered ogee chutes with gate leaves and splitters, the crest decks and railings, the southeast yellow gantry, the lower powerhouse and both platforms. The arch underside and chute sides are closed with structural concrete. The review includes both faces and all four runtime tiers.

The 478.526 m trace of the reservoir edge establishes the arch location and southwest downstream facing at [39.13481220602989, 38.22573566468985] with heading −0.745454173118395 radians. The signed 382.112 m chord differs from the published 462 m length, which remains a separate source fact. The photos and mapped geometry establish the site. The reservoir feature carries the geometry and is not a separately tagged dam way. One native powerhouse footprint is replaced, 147 other building records remain and all 125 native road records, including the downstream bridge, are retained.

Four existing 256 px shared graphs supply concrete, basalt paving, painted metal and window glazing. One skyline draw and five groups for the other levels use metric UVs and linear tints. None of the six GLBs embeds images. The shared runtime eviction check restores terrain and frees the model geometry.

The 26 site renders use the 12 m standard terrain samples and two native water surfaces. The occupied mask follows the central sill, chute runout and lower facilities. Nine interior probes clear the mask and preserve the original terrain source. Narrowing the mask and closing the spillway side faces remove the large open gap beneath the wing.

The detailed master contains 8,790 triangles. Viewer tiers contain 930, 1950, 5530, 6982 triangles. Skyline plus district are 262,000 bytes and close-up is 633,508 bytes. Four focused checks verify the exact source pins and signed frame, selective native footprint replacement, all ten sluice paths and the plant roof in six GLBs, and byte-for-byte LOD reconstruction with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks. Physical-device timings remain unmeasured.

The standard grid still obscures sections of both concrete wings and intrudes beside the lower powerhouse terrace in the close views. The west reservoir bank has a stepped DEM-to-water edge. The actual crest and tailwater operating levels and abutment contacts remain approximate. Keep native terrain fit pending.

Rebuild with `node packages/worldgen/scripts/generate-karakaya-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=karakaya_dam`.
