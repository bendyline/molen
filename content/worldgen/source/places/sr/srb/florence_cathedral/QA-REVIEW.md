# florence_cathedral — Florence Cathedral

Reviewed 2026-10-13 as a **medium-fi exterior reconstruction**. Two inspected aerial
photographs and standard viewer PMTiles/DEM guide the cathedral and adjacent Giotto
campanile. The eight-sided red dome, pale ribs/open lantern/gold crown, stepped marble
west front, three closed portals/roses, nave, three tribunes and four buttress bodies
are individually authored. All 49 current portable, shared/geographic and Earth-lighting
frames were inspected, including the retained 1024×640 summary.

## Geometry and shared surfaces

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| Source master | 9,500 | 1,143,988 | 7 |
| Runtime master | 9,500 | 1,143,356 | 7 |
| Skyline | 858 | 89,496 | 1 |
| District | 3,916 | 351,452 | 7 |
| Street | 9,322 | 829,268 | 7 |
| Closeup | 9,500 | 844,084 | 7 |

Initial skyline + district geometry totals **440,948 bytes**. Three existing shared 256²
graphs supply marble, terracotta tile and continuous foundation limestone. Cream/green/pink
marble uses linear tints and metric UVs. Glass, closed doors and gold use simple vertex colors.
Each model graph loads once; the fixture also reads its existing basalt outline material.
Unloading leaves zero live model geometries. Four LODs have separate position/normal streams
and matching CPU/GPU upload accounting. All six GLBs validate with zero errors, warnings or
embedded images.

Thirteen current PMTiles controls, unioned across fragments by ID, match retained geometry:
the main cathedral, separate campanile and eleven roof/dome/tribune/buttress/crown components.
Both nave roof planes are retained; their outer convex envelope bridges a sub-metre map seam.
The exact-QID outline and signed west-facing front/east dome/south tower match. Actual indexed
vertices preserve nominal **114.5 m dome-group** and **85 m campanile** tops relative to the
estimated common floor. Main walls retain 25 m; nave and subsidiary roof groups retain 45 m.
A small mapped part with incompatible `min_height:114.5` / `height:17` is excluded from height
inference. Thirty imported-GLB probes pass: twenty real tower/lantern apertures, representative
jambs/heads, three closed portal doors, the dome shell and both nave roof planes.

The targeted generator reproduces the master. Asset inspection/hash verification, scene
validation and a 30-tick simulation pass. Current hashes, exact commands and inspected image
lists are recorded by `spec.json`, `qa.json` and the concise capture reports.

## Corrections and distance behavior

Lower campanile panels were moved from its smaller crown footprint onto actual shaft faces.
Drum panes were moved in front of marble insets. North-facing pane/frame offsets now respect
the outward normal. Belfry cuts cross the entire shell thickness. Skyline uses simpler buttress
profiles and broad surface ribs; their winding was corrected so pale ribs stay visible.
District uses a broad belfry opening with two merged pillars per face, then street/closeup
restore three individually cut pointed arches. District drops pink insets and selected
frames/pinnacles; street/closeup restore them. Minor profile/detail changes remain visible
when levels switch, while the overall dome/nave/tower silhouette holds.

## Accepted limits

Native Y=0 follows standard DEM at **73.4272 m**. The estimated **−5 m common floor** uses typical
perimeter samples instead of the raised anchor. Coarse DEM varies around −10.4 m at the west
front, −6.65 m at the tower and −5.18 m at the east apse. Residual foundation skirts/embedding
and precise plaza/doorstep joins remain approximate. Source-terrain views complement the flat
geographic fixture; no surveyed elevation, navigable interior or certified walking collision
is claimed. The first exaggerated raised-floor pedestal was reduced.

Drum/shell/lantern subdivision, tower intermediate levels, tribune curves, window/portal
rhythm, roses, panels, cornices, pinnacles and ornament are picture-led approximations.
Small facade windows are surface panes; entrance doors are closed. Exact sculpture, reliefs,
lettering, masonry plans, structural shell thickness and full interiors are excluded.
The separate baptistery/museum, surrounding city and vegetation remain host content.
Context neighbors use the synthetic Italian palazzo style. Physical laptop/phone measurements
remain pending. Bulk captures stay local and ignored; one small summary preview is retained.
