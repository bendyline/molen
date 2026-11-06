# Kölnbrein Dam

Reviewed 2026-11-03. **43 current catalog views and five standard-water comparison views inspected.**

The 626 m double-curvature arch has a continuous 7.6 m crest, the lower downstream concrete reinforcement, two mapped inspection cabins and the Airwalk. The Airwalk has a stair opening in the crest rail, a cantilevered steel frame and blended fritted glass panels.

The standard map sets the anchor at [13.3405002952, 47.0795749859] and heading 0.2383241038 radians. Local +X follows the crest east-northeast and +Z points downstream. Two short ties extend the 607.79 m mapped road to the documented 626 m concrete length. The modeled crest is at 1906.2 m. The Airwalk and cabin plans follow the native mapped features.

Six shared material graphs supply board-formed and plain concrete, painted steel, roofing, cabin glazing and blended fritted glass. The six GLBs have zero embedded images. Viewer eviction releases the model and restores the native ground.

Thirteen standard Terrarium tiles provide the terrain. The full-pool fixture uses 1902 m and the standard field yields 1892.80 m upstream. Both fixtures use the 1701.30 m sampled Galgenbichl forebay. The native rock shoulders and cover over the lower reinforcement stay intact.

The detailed master contains 4,167 triangles. The four viewer tiers contain 613, 1497, 3959, 4143 triangles. Skyline plus district are 174,848 bytes and close-up is 327,784 bytes. Four focused checks verify exact hashes, signed placement, curved crest, reinforcement, cabins, glass geometry and blended material in each tier. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

Crest elevation, end ties, below-water arch profile and the lower reinforcement section are exterior approximations. Small rock and concrete intersections remain at the flanks. The Airwalk steel, stair and pane details follow the reference appearance. The 9.20 m reservoir difference is between the two review fixtures. The neighboring hotel and downstream powerplant remain independent.

Rebuild with `node packages/worldgen/scripts/generate-kolnbrein-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=kolnbrein_dam`.
