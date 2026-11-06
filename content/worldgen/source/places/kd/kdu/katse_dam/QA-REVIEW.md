# Katse Dam

Reviewed 2026-11-03. **43 current catalog views and five standard-water comparison views inspected.**

The model reproduces the 710 m double-curvature arch, ten open overflow bays under the crest road, paired low outlet recesses, crest houses and the separate lower dam.

The retained shoreline and crest road set the anchor [28.50603056, -29.33708333] and heading 0.40069262057 radians. Local +X runs northeast and +Z follows the river southeast. The 2060 m crest uses fixed absolute elevation. The concrete footprint bounds the ground opening, and the adjacent access roads stay native.

Four shared graphs supply board-formed and plain concrete, painted steel and glazing. All six GLBs have zero embedded images. Eviction releases the model geometry and restores the terrain.

The 25 terrain views use nine standard Terrarium tiles with separate reservoir, plunge pool and tailwater stages. Five additional views use the production sampler’s representative stages of 2055.59 m, 1902.56 m and 1899.66 m. The design fixture uses the 2053 m full supply level and illustrative lower stages.

The detailed master contains 2,510 triangles. Viewer tiers contain 474, 722, 1258, 2510 triangles. Skyline plus district are 93,468 bytes and close-up is 187,168 bytes. Four focused checks verify exact source pins, signed placement, bounded ground openings, ten open overflow bays, two recessed outlets, both crests and byte-for-byte LOD reconstruction with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

Coarse standard terrain still intersects the eastern downstream face and yields steep triangular artifacts near the crest and hard banks around parts of the reservoir. The paired low outlets are visible in both water-stage fixtures. Exact subsurface, gate and lower dam sections are approximated. Operating discharge and underground works are outside the model.

Rebuild with `node packages/worldgen/scripts/generate-katse-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=katse_dam`.
