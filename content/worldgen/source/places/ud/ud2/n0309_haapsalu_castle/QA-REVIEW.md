# Haapsalu Castle — completed medium-fi exterior review

Reviewed 2026-10-09. Candidate **N0309**, asset `molen.worldgen.structure.n0309_haapsalu_castle`.
The current hashes and all 48 inspected frames are bound in [qa.json](qa.json).

## Repairs and placement

- Built the previously unbuilt entrance-side wall.
- Replaced separately capped wall segments with shared joints, preserving mapped entrance gaps.
- Matched courtyard paving to the review terrain triangulation; grass no longer intersects it.
- Added attributed official Estonian ground samples, downward foundation extensions and terrain-following curtain walls.
- Corrected surface UVs to use each face's metric plane, including vertical walls.
- Registered the signed East/South map frame at heading zero and exterior Y0 = 7.2 m EH2000.
- Exercised bounded geographic placement through the actual viewer renderer. Complete geometry, transformed bounds, north-up footprint alignment, local loading and unload/disposal passed.

The flat shared-material stage verifies rendering and transforms. The separate portable and
medium-fi views use the attributed local DTM to review ground fit. Synthetic neighboring houses
are style context. Footprint replacement remains disabled.

## Browser outputs

| Level | Triangles | Model bytes | Material draws |
| --- | ---: | ---: | ---: |
| Skyline | 755 | 70,316 | 1 |
| District | 3,284 | 312,628 | 6 |
| Street | 5,973 | 598,244 | 7 |
| Closeup | 5,973 | 598,244 | 7 |

Initial skyline plus district: **382,944 bytes**, below both device download limits.
The editable source master is preserved. Five shared material graphs provide the existing
256-square surfaces; model GLBs contain no images. Each graph reads once during the viewer review.

Eight focused checks pass. All six GLBs validate with zero errors and warnings. Selected source
reproduction, import integrity, current LOD and strict medium-fi checks pass. No repository-wide
build, dependency audit or unrelated generator was run for this model round.

## Scope and limits

The declared present-day exterior includes the roofed cathedral/side roofs/round chapel, clock
tower, roofless upper U-castle, contemporary pavilion/folded stairs, curtain walls and defensive
tower remains. Fine masonry damage, exact window counts, exhibits/interiors, historical roofs,
trees and adjacent city buildings are excluded.

Architectural sections and opening rhythms are original medium-fi estimates, not a surveyed
reconstruction. The official DTM can retain raised built terraces. The architect's interior
zero at 8.30 m is separate from the exterior attachment datum. Host terrain must use compatible
mean-sea-level elevations and adequate resolution. Walkable collision and physical laptop/phone
frame rates have not been certified.

Reference photographs/drawings remain in the private research cache and are not model textures.
The numeric terrain controls and review heightfield are attributed in [terrain-grid.json](terrain-grid.json).
