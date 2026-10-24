# Harlech Castle — current model review

Reviewed 2026-10-12 under `docs-src/guide/medium-fi.md`. All **49 current frames** were inspected: 11 portable, 11 geographic/shared-material and 27 medium-fi frames. Acceptance is bound to the current source, runtime, recipe inputs and captures in `qa.json`.

![Current shared-material courtyard view](medium-fi/open-court-and-west-ruins.png)

## Individual structure

Four hollow corner towers surround the grassy courtyard. The projecting gatehouse has two broad front drums, two smaller rear stair turrets, roofless room walls, true window voids and a clear central passage. High inner curtains, lower concentric walls with small round projections, western domestic room ruins, sparse stair treads, the grass/rock crag and actual curved entrance bridge remain separate forms.

The two linked aerial photographs in `reference-metadata.json` supply appearance. Standard viewer PMTiles supply the inner castle's approximately 69 × 58 m envelope, nine interior rings, approach bridge and terrain. The full original bridged MultiLineString is retained in `pmtiles-fit.json`; the model uses its castle entrance component. No bespoke survey or historical research was used.

## Browser cost

| Level | Triangles | Bytes | Draw calls |
| --- | ---: | ---: | ---: |
| Skyline | 864 | 87,620 | 1 |
| District | 1,748 | 155,268 | 5 |
| Street | 6,712 | 637,316 | 6 |
| Closeup | 14,912 | 1,402,364 | 6 |

The deterministic source master has **15,484 triangles**, six merged material groups and **1,861,836 bytes**. Initial skyline plus district geometry is **242,888 bytes**, or **63,303 bytes gzip**. Four runtime levels have separate POSITION/NORMAL streams and equal recorded CPU/GPU buffer totals.

Five existing 256² graphs provide rubble stone, granite, painted bridge metal, wood decking and the small entrance canopy. Lawn uses vertex color. Six near draws preserve these distinct surfaces. Metric UVs and sRGB-to-linear tints are used. Every graph was read once during shared capture; unloading left zero live model geometries. None of the six GLBs embeds an image.

## Corrections and verification

The first skyline exceeded its budget. Internal radial tower faces were removed while retaining the open wells. Wall foundations initially made the lower curtain appear too tall; architectural walls were attached to the plateau, with the crag represented separately. Cliff normals, grass/rock treatment, bridge profile and detail-camera height were corrected before the accepted captures.

All six GLBs pass Khronos validation with zero errors and warnings. Eleven current geometry probes pass: six main tower wells, two rear stair-turret wells, the complete central gate passage, a rear window aperture and the open courtyard. Source generation `--check`, import `--check`, placement `--check`, asset hash verification and scene validation pass. A 30-tick simulation produced `sha256:d7ef40c6b7114b8aa41226bbbee87cab72fc48fedb0e7338a83521d70a5c55bf`.

The geographic anchor is `[-4.109151127, 52.859959433]`; heading is `-0.30264497849639677` radians. Native +X follows the signed castle-to-visitor bridge chord. All four actual mapped bridge segments are suppressed by the replacement geometry; unrelated paths and a synthetic separate tunnel are preserved. The tunnel test does not assert that a tunnel exists here.

## Accepted limits

Heights, wall thickness, ruin profiles, room partitions and outer-wall projections are picture-led approximations. Native Y=0 is the retained DEM's 36.8763 m anchor sample. The approximate courtyard plateau at Y=19 m and bridge profile preserve the pictured near-level approach against the coarse visitor-side DEM. The crag's height/profile, wall embedding and precise gate/visitor joins remain approximate; this is not terrain carving or surveyed placement.

The small entrance canopy is simplified light metal, with no claim of exact glazing or bridge support engineering. Furnishings, full historical interiors and certified walkable collision are excluded. Flat geographic captures clip negative crag footings; source-terrain views provide complementary ground review. Synthetic English terraces and the bounded terrain fixture test style, not actual neighboring buildings. Detail switches change top caps and rails without removing the compound. Physical laptop and phone performance measurements remain pending.
