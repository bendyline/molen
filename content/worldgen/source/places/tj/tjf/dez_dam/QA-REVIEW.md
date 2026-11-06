# Dez Dam

Reviewed 2026-11-03. **49 current views inspected.**

The original model includes the thin double-curvature wall and its horizontal construction bands, two recessed east-bank spillway mouths, the west-bank intake ledge, three irrigation outlet collars and a local layered canyon collar.

The signed placement is [48.46404478, 32.60523128], heading −0.063561753723 radians. Nine retained native reservoir-edge vertices form the crest arc. Local +X points east along the chord and +Z downstream. The production elevation resolver sets a 354 m nominal crest using the west-bank contact. Native roads and buildings are preserved.

Four existing material graphs supply board-formed and plain concrete, gravel and painted metal. All six GLBs have zero embedded images. Model eviction disposes geometry and restores the terrain.

The 27 terrain views preserve the four raw Terrarium tiles sampled at 8 m. The captured reservoir plane is an illustrative 317 m partial fill. The default production sampler returns 364.72–377.19 m in the retained upstream windows, which is 10.7–23.2 m above the modeled crest. Downstream PMTiles has a river line through the gorge. The adjacent raw terrain crosses much of the arch height.

The detailed master contains 15,154 triangles. Viewer tiers contain 956, 2008, 3952, 9166 triangles. Skyline plus district are 309,552 bytes and close-up is 983,204 bytes. Four focused checks verify exact source pins, selective replacement, the 4.5–21 m tapered wall, two recessed tunnel mouths and the crest deck, and byte-for-byte LOD reconstruction with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

The individual model is a catalog preview pending native reservoir datum and canyon fit. The authored collar exposes the arch for review. Approximate cliff bands, rock contacts and visible outlet hardware remain, and some collar edges show at grazing angles. The tunnel interiors are visual recesses. Physical-device timing remains unmeasured.

Rebuild with `node packages/worldgen/scripts/generate-dez-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=dez_dam`.
