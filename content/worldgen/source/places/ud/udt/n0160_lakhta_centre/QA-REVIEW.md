# Lakhta Centre — main tower exterior

Reviewed 2026-10-09 to medium-fi. **44 images inspected**: 10 portable, 10 shared
material/placement and 24 browser light, silhouette, distance and LOD views.

[Designer documentation](https://gorproject.ru/en/projects/lakhta-center/) and four
designer images support the 462 m five-petal tower, lower bulge and helical sweep.
[Facade-contractor press release](https://www.mignat.com/en/unternehmenskommunikation-en/tallest-european-skyscraper-in-saint-petersburg-reached-its-final-height-of-462-meters/)
documents the separate 13 m steel tip. The main tower is the asset's scope; adjoining
low wings and entrance arch are excluded. Reference photographs are not redistributed.

The **15202-triangle source master is unchanged**, including its original hash.
The new skyline resamples pairs of the original skin bands, preserving the source
envelope, signed five-petal plan and twist. It adds the same separate tip at lower
radial resolution. Sampling source skin vertices and cell centers against the coarser
triangles stays within its 1 m reservation. Fine framing and curved-pane sag remain
near/detail concerns. Facade band subdivisions are a reconstructed grid, not a claim
of exact occupied-floor or 16505-module correspondence.

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| Skyline | 904 | 100860 | 1 |
| District | 3999 | 457052 | 3 |
| Street | 15202 | 1443868 | 3 |
| Closeup | 15202 | 1443868 | 3 |

Initial download is **557912 bytes**. District reports 0.868 m reduction error; inspected
crown, tip and transitions remain recognizable. The two canonical granite/painted-metal
graphs load once and unload disposes all model geometries. Local glass uses opaque PBR.
Six GLBs validate with zero Khronos errors/warnings and no embedded images. Two focused
checks pass for sampled skyline deviation/full height and exact source/four-level bytes.
Selected source reproduction, LOD and strict medium-fi checks pass.

The attributed dated relation 18102137, Q4255374, and separate upper parts are preserved
in the source frame. Ground native outline is exact to the stored snapshot; +X is
75.3354 degrees ENE and +Z 165.3354 degrees SSE. Rotation is counterclockwise in
geographic east/north coordinates. Enlarged lower and twisting upper envelopes extend
beyond the ground plan intentionally. Intermediate taper is reconstructed, not a
survey of each floor. Flat stage does not verify plaza grade; host supplies Y=0 contact.
Convex collision is exterior-only. Physical-device timing and scene memory are unmeasured.
