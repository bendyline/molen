# Ava Bridge

Reviewed 2026-10-27. **Dated medium-fi intact exterior and approximate native placement complete.**

![Ava in the native viewer](preview.png)

Historical-only model, represented on 2010-02-08 with explicit validity [2010-02-08,2010-02-09). This conservative one-day window follows the inspected photograph date, not the physical lifetime of the bridge. Native current/before/after scenarios make zero model requests. The 2025 collapse photo and 2026 PMTiles destroyed tag preclude automatic intact present-day placement. Contemporary context is preserved; no repaired or ruined 2026 structure is claimed.

Inspected 71 current frames: 13 portable, 13 dated shared-material/geographic, 25 medium-fi and 20 native. The intact Ava exterior retains nine principal pale polygonal truss bays with open vertical/diagonal webs, top crossframes, flanged members/gussets, central rails/sleepers, outside narrow road decks and walks, red masonry pier shafts, pale chamfered footings and short approach supports. Corrected inward deck winding and buried bank edges during this same authoring pass. Far levels retain the principal silhouette and simplify web/rail detail. Automatic end-on turntables are necessarily narrow for this 1.2 km asset; the explicit side, pier, deck and bank cameras provide the usable detail evidence.

Three existing shared 256px material graphs: metal_painted, brick and concrete_plain. Metric UVs, linear vertex tints, three merged material groups near and one mean-tinted group at skyline. No embedded/private images or copied photograph pixels. Each graph is read once per native view; all four runtime GLBs have separate position/normal/UV/color GPU streams.

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 972 | 87244 | 1 |
| district | 3756 | 323908 | 3 |
| street | 15980 | 1326384 | 3 |
| closeup | 53684 | 4880752 | 3 |

Detailed source: 77468 triangles / 9298644 bytes. Runtime: 972 / 3756 / 15980 / 53684 triangles; 87244 / 323908 / 1326384 / 4880752 bytes; 1 / 3 / 3 / 3 draws. Initial skyline plus district is 411152 bytes. Strict medium-fi ceilings pass. Physical laptop/phone timing remains unmeasured.

Named Ava Bridge POI 17598272665331 and destroyed rail record 35184412388137 establish the original crossing independently of the neighboring Yadanabon Bridge. No exact-QID map footprint is claimed. Anchor [95.99202543497086,21.871690856512807], heading -0.7194333043712112: +X southeast toward Inwa/Mandalay, -X northwest toward Sagaing, +Z southwest along the Ayeyawady. The nominal 1128 m structure reference, photo-led 966 m principal truss group and 1209.771 m mapped rail extent are recorded separately; extra apron overlap fits standard terrain. Ten bank width samples retain model support at every LOD. Five meet existing paving within 0.000508m at street/closeup; skyline/district simplify the cross-slope and differ by at most 0.136939m. Remaining samples lie above unpaved ground, with at least 0.075m clearance. These are renderer-fit results, not surveyed geographic or historical bank accuracy.

All 4511 resident buildings and 387 independent road records remain exact inputs. Four records for the separate Yadanabon crossing remain and receive no authored connections. Raw roads, DEM samples, rendered ground and water are unchanged. No road replacement, terrain cutout, approach grading or support geometry is applied. Failed loading retains the map; date exclusion makes no model request; unload releases every model geometry while retaining ground/water.

## Reconstruction limits

- Intact exterior reconstructed from ordinary photographs, represented only on 2010-02-08. The one-day historical window is conservative evidence scope, not a claim that the bridge existed for only one day. It never appears in the default current world.
- The 2025-08-20 photograph shows collapsed spans; standard 2026-10-26 PMTiles marks the old rail route destroyed. No October 2026 repair status or current damaged-geometry reconstruction is claimed.
- Nine principal polygonal truss bays, 966 m principal length and three short approach bays per bank are photo-led visualization controls. The nominal 1128 m reference includes approaches; map rail extent is 1209.771 m and includes extra bank alignment. No surveyed span schedule is claimed.
- The 12.8 m overall deck, 4.8 m truss spacing, central metre-gauge rail, two outside narrow road strips and raised walks are inferred visual proportions. They are not a traffic-safety, route-capacity or engineering representation.
- Deck grade, pier footing depth, member sections, gussets, joint spacing and bank caps are approximate. Final bank aprons use source-local native paving/ground heights and 1.5m overlap beyond the mapped rail ends; distant levels simplify their cross-slopes. Coarse standard Mapzen/PMTiles provide fit; present-day terrain and neighboring buildings are context, not a 2010 city reconstruction.
- The Yadanabon Bridge is a separate map feature and is preserved. No downloaded meshes, photo pixels, private images, microtexture, trains, vehicles, signs or transient objects are included. Physical-device performance remains unmeasured.
- Distant apron cross-slopes differ from existing paving by up to 13.7 cm; this is not described as a millimetre-level match at every LOD. Current procedural quays, roads, banks, generic neighboring bridge and buildings are context, not reconstructed historical geometry.
