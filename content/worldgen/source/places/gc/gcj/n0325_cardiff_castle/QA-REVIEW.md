# N0325 — Cardiff Castle

Reviewed 2026-10-13 as a **medium-fi exterior reconstruction**. Two inspected pictures and
standard viewer PMTiles/DEM guide the individual shell keep, open court, motte/stairs,
western palace/towers, clock tower, outer/inner curtains, gates, north/west bridges and
simplified visitor range. All 49 current portable, shared/geographic and Earth-lighting
frames were inspected, including the retained 1024×640 summary preview.

## Geometry and shared surfaces

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| Source master | 22,875 | 2,749,476 | 8 |
| Runtime master | 22,875 | 2,748,756 | 8 |
| Skyline | 927 | 87,732 | 1 |
| District | 3,974 | 363,144 | 8 |
| Street | 15,793 | 1,258,584 | 8 |
| Closeup | 22,875 | 1,791,444 | 8 |

Initial skyline + district geometry totals **450,876 bytes**. Four existing shared 256²
graphs supply weathered limestone, slate, painted metal and lime plaster; each loads once.
Glass, grass and clock accents use linear vertex colors. Metric UVs and separate
position/normal streams are retained. Unloading leaves zero live model geometries.

All six GLBs validate with zero errors, warnings or embedded images. Twenty-four component
IDs produce 25 mapped polygons, including the keep courtyard. Six IDs crossing tile boundaries
were joined from all current PMTiles fragments. The exact-QID site outline, DEM and output
coordinate transform pass. Forty-nine passage, masonry, glazing, court/floor, roof, stair
and gate/deck probes pass. The targeted source generator reproduces the master; asset inspection,
scene validation and a 30-tick simulation pass.

## Corrections and placement

The north bridge was extended through its gate, clock corner pieces were seated on their roof
band, low facade panes were moved above the curtain and intersecting window reveals were cut
against neighboring openings. Tile-clipped southern tower/curtain sections were restored.
Distant merlons, stairs and facade rows were reduced to meet their level budgets.

The recipe authors in cardinal coordinates and rotates exported vertices/normals 135 degrees.
The inverse viewer heading restores the same geographic west palace, southwest clock tower,
south entrance and northwestern keep. Both bridge axes then satisfy the viewer's longitudinal
replacement rule. Actual North Gate Bridge and West Gate Bridge paths are suppressed;
unrelated bridge, untagged path and tunnel guards remain. The native DEM review was rotated
with the model, so terrain and cameras share its coordinate frame.

## Accepted limits

Component roles, untagged heights, roof/gable/turret profiles, window rhythm and clock/figure
decoration are picture-led estimates. The coarse DEM omits the small motte, which uses an
approximate 10.8 m plateau. Native Y=0 follows the retained standard DEM at 12.8751 m; palace
floor 2.8 m, west gate/deck levels, moat, foundations and terrain/approach joins remain approximate.
The flat shared/geographic fixture is complemented by the source-terrain views. No surveyed
walking surfaces, full interiors, underground shelters or exact sculpture/clock lettering are claimed.

Skyline keeps the main compound silhouette and omits the modern visitor range and ornament.
District uses sparse surface windows and coarse stairs; street restores one recessed facade
row, slits and treads; closeup restores both rows and denser trim/crenellations. Context neighbors
are synthetic English terraces. City, trees, visitors, exact animal-wall sculptures and gardens
remain host content. Physical laptop/phone performance measurements remain pending.

Current hashes and inspected image lists are in `qa.json` and the concise capture reports.
Bulk renders stay local and ignored; one small summary preview is retained in Git.
