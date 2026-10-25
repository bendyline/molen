# Loarre Castle — current visual review

Reviewed 2026-10-13 against the current source, imported master and four independently authored browser levels. Machine-readable hashes and inspected frame paths are in `qa.json` and the three capture reports.

## Identity and fit

Two exterior aerial photographs, linked in `reference-metadata.json`, were inspected. They show the unequal square towers, roofless rocky compound, roofed chapel and rounded apse terrace, detached slender tower, and downhill curtain with hollow open-backed round towers.

The standard viewer PMTiles extract supplies seven component building polygons, the named Castillo de Loarre and Capilla de Santa María POIs, and a cliff line. The model anchor is shifted 55 m west and 8 m south of the catalog reference to the upper compound, at longitude −0.6126127150641428, latitude 42.32548368977727. Heading 0.046476909037922114 rad makes native +X follow the chapel toward its eastern apse and +Z face the downhill southern enclosure. All seven retained polygons are transformed into this frame. No exact-QID outer footprint is claimed.

**The upper and lower curtains are picture-led estimated plans.** The mapped components establish approximate scale and facing; they do not establish the precise curtain, gate or archaeological room plan. Native Y=0 corresponds to the retained standard viewer DEM at 1061.4069 m. The authored upper court sits at Y=4 m; foundation skirts, detached tower, lower curtain and stairs follow the sampled hillside. Exact terrain contact and blending remain approximate.

## Geometry and shared materials

The deterministic source master has 6,723 triangles and 810,196 bytes. The imported master has 809,704 bytes. The chapel's outside plan and projecting rounded end follow PMTiles; the northern keep, central tower and detached tower retain their individual mapped positions and plans. Roofless ranges, court partitions, exposed rock, arched entry and selected masonry openings are actual geometry. Curtain tower wells and open backs are unobstructed, and the lower gate has a passage through both gate faces and curtain.

Five existing 256² graphs supply coursed limestone, continuous limestone for crags, sandstone for the stone-colored roof, courtyard paving and painted metal rails. Metric UVs and sRGB-to-linear vertex tints are used. No embedded images, bespoke textures or research photographs ship inside the six GLBs. Shared renderer reads each graph once and disposes all model geometry on unloading.

| Level | Triangles | Bytes | Gzip bytes | Draws |
| --- | ---: | ---: | ---: | ---: |
| Skyline | 990 | 101,572 | 23,137 | 1 |
| District | 1,735 | 163,916 | 52,854 | 4 |
| Street | 5,911 | 557,128 | 164,702 | 4 |
| Closeup | 6,371 | 597,720 | 177,003 | 5 |

Initial skyline plus district geometry totals **265,488 bytes** (75,991 gzip bytes), below the phone and laptop limits. Position and normal GPU streams are separate; CPU and GPU buffer totals agree.

## Inspected renders and corrections

All **49 current frames** were inspected: 11 portable/source-terrain views, 11 shared-material/geographic views and 27 medium-fi views. The latter include Economy and High, noon and late afternoon, three distances, textures-off skyline, six details, four matching LOD views and four transitions.

The first renders led to these corrections: reduce the chapel roof's flat crown; broaden crags into irregular ridged forms; align southern entrance stairs to the mapped entry range and sampled terrain; leave round curtain towers open across their backs; cut both lower gate faces; simplify only the distant tower shells and selected ruined ranges to meet the skyline budget. The final levels retain the chapel roof/apse, unequal keeps and lower curtain. District introduces minor ranges and hollow tower tops; street adds openings and stairs; closeup adds selected buttresses and rails. Those detail changes are visible in the matching views, while the main compound persists.

The geographic shared capture uses a flat Y=0 fixture, so it **clips much of the downhill curtain and low footings**. It verifies geographic facing and shared surfaces, not hillside contact. The source-terrain and medium-fi captures provide the complementary retained DEM view. Their white terrain patch and synthetic surrounding houses are review context, not the actual site ground palette or neighboring buildings.

## Checks and limitations

Six current GLBs pass Khronos validation with zero errors and zero warnings. Twenty geometry probes pass, including the eight lower tower wells and open backs, detached square well, lower gate through passage, southern entrance arch and open western court. Source/import checks, CLI asset hash verification, scene validation and a 30-tick simulation pass. The simulation emits zero events and hash `sha256:3ef6963941f3948467d815d1c352b550daa93c0d1794b29e3c138dcec29765bd`.

This is a medium-fi exterior reconstruction. Heights, wall thicknesses, curtain profiles and plans, rock forms, stair slope and exact ground joins remain approximate. Full interiors, archaeological chronology, site vegetation and certified walkable collision are excluded. The imported coarse convex hull is an asset inspection output, not a walkable castle collision model. Physical laptop and phone performance measurements remain pending.

The source master and four levels are reproducible through `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=loarre_castle`, standard authored import, and `node packages/tooling/scripts/generate-landmark-lods.mjs --ids=loarre_castle`. GLBs are ignored build outputs. This model joins the source inputs for the next full asset-bundle build milestone; it is not present in the previously built release bundle.
