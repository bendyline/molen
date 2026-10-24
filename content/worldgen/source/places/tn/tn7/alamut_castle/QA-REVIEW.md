# Alamut Castle — reviewed upper-castle exterior

Reviewed 2026-10-11. **110 final images actually inspected.** Detailed original master remains independently reproducible.

## Exterior and browser levels

Actually inspected 110 final images: 23 portable, 23 shared, 39 medium-fi and 25 normal-terrain views. Compared the mapped upper castle with actual UNESCO 2024 aerial and ground-photo pixels and Burgenwelt 2014 site photographs and Willey plan. Retains narrow northwest cistern/cell ridge, broader southeast excavation, roofless broken wall groups, brick arches and tall pier, retaining curtain, cut reservoirs and interpreted last approach. Corrected lowered review cameras make reservoir floors, central arches and route visible. Removed regularly spaced stone chips and masonry joints on bedrock; repaired local cliff foot contact against retained numeric terrain. Original unshifted cameras are retained as historical viewpoints; their high close views do not independently establish lower features.

All 39 current medium-fi frames actually inspected, covering two light settings, economy/high quality, original and corrected architecture cameras, four whole-castle LODs and transitions. Skyline keeps mapped outline, roofless rooms and five open reservoirs plus the highest brick pier at 801 triangles. District adds major arches and approach ramp at 1543 triangles. Street adds stair treads and smaller ruin groups at 3697 triangles. Close-up retains ladder, rail, plaster fragments, brick relief on the tall pier and irregular low walls at 8275 triangles. Small close details fade at far levels; no roof or temporary shelter fills the excavated rooms.

skyline: 801 triangles / 68412 bytes / 1 draws; district: 1543 triangles / 126988 bytes / 4 draws; street: 3697 triangles / 292168 bytes / 5 draws; closeup: 8275 triangles / 676056 bytes / 7 draws. Initial skyline plus district: 195400 bytes. Physical laptop/phone measurements remain pending.

## Shared surfaces

Six canonical shared graphs: rubble masonry, weathered limestone, brick, lime plaster, plain timber and painted metal. Bedrock uses weathered stone and ruined walls use rubble masonry. Recesses and interpreted green-tinted reservoir floors share weathered stone. Skyline bakes canonical linear material means into one draw. All six GLBs contain zero images. Actual shared renders show consistent walls, brick, stone and timber; each graph is read once and model geometry is disposed on unload. No reference-photo pixels were copied into textures. The flat shared stage alone does not prove hillside placement.

## Placement and terrain

Fresh OSM way 590499418 v3 identifies exact Q4706020. All retained components agree with fresh coordinates within 0.662 mm. Native +X points southeast at 135.629 degrees and +Z southwest at 225.629 degrees. Northwest cistern ridge, southeast excavation/gate, approach and Willey north arrow sign heading -0.796374558514 rad at [50.586098381,36.44473323]. No mirror or rescaling. Retained public Terrarium inputs generate 16641 native heights at 4 m spacing over 512 m. Y0 is decoded 2098.7457 m anchor working datum, not a surveyed regional or ellipsoidal datum. One rigid -25.47 m architectural shift gives 12.53 m sloping-plateau intercept, constrained by ruin bases, reservoir floors and approach samples plus 0.25 m. Local cliff and occupied ledge feet extend 4 m below sampled terrain. The host supplies the remaining mountain; no whole-precinct terrain replacement/cutout.

Actually inspected all 25 final normal-placement images: five cameras for source plus four browser levels. Signed heading and retained terrain reference give zero model-origin offset within 0.1 mm. Open-ground probes match independently reconstructed triangular ground with approximately 0.015 m fixture offset; the separate raw bilinear difference reaches 0.127 m in one steep cell. All five open reservoir floor rays and front-facing local cliff probes pass at all levels. Five unloads restore ground and release model geometry. Numeric Terrarium images are height inputs, not model textures; OSM and terrain-provider attribution are retained.

## Checks and limits

Three focused tests pass: independently reproduce original master bytes; current source/runtime/map/terrain hashes agree and exact signed map frame is accepted; all five reservoirs remain genuine open cuts and cliff faces point outward at all four levels. Child-process LOD builds reproduce exact bytes, stay within 1000/4000/16000/64000 triangles, eight draws and 3 MB initial download. POSITION/NORMAL have separate 12-byte streams. All six GLBs pass Khronos with zero errors, warnings and images; strict medium-fi has no findings. Normal terrain placement confirms zero model-origin offset, outward cliff contact, five reservoir floors above host terrain at every level and five unloads with zero remaining model geometries. Ground-ray probes match the rendered triangular heightfield within 0.0151 m; one steep cell differs from raw bilinear sampling by 0.127 m, explicitly recorded. These sampled checks are not an architectural survey or exhaustive manifold certification.

Accepted medium-fi reconstruction of the mapped upper castle only. Detailed original 271061-triangle, 26756940-byte master is independently reproducible at sha256:9b4f6d2f2a9967113c0bd7b502235807b944b8a44fe682a1a7fd30d4bf9bd588 from unchanged alamut-castle-model.mjs#alamutStudy.build. The lower/onion castle, passing zone and complete mountain are outside this source scope. Temporary 2014 excavation canopies/scaffolding are omitted in the 2024 interpretation. Coarse numeric terrain does not establish source DEM resolution, vintage or vertical accuracy. Geological ribs, wall/arch heights, cistern positions/depths, floor tint and last approach are plan/photo interpretations. Interior caves/tunnels are not supplied. No universal host-terrain compatibility or physical-device timing claim.

## Inspected references

- [UNESCO: upper-castle aerial](https://whc.unesco.org/en/documents/220797) — Payam Entekhabi, 2024-01-01, © ACHB; actual displayed pixels inspected, reference only under attribution/no-derivatives terms.
- [UNESCO: excavated masonry](https://whc.unesco.org/en/documents/220798) — Pardis Zanjirian, 2024-12-22, © ACHB; actual displayed pixels inspected, same reference-only terms.
- [UNESCO: Castle of Alamut](https://whc.unesco.org/en/list/1770/) — official scope of the larger property.
- [Burgenwelt: site photography and Willey plan](https://www.burgenwelt.org/iran/alamut/object.php) — 2014 site photographs and published 2005 plan, actual pixels inspected; reference only, not redistributed.
- [Identified OSM way](https://www.openstreetmap.org/way/590499418) — fresh geometry, © OpenStreetMap contributors, ODbL.
- [Terrain dataset](https://registry.opendata.aws/terrain-tiles/) and [provider attribution](https://github.com/tilezen/joerd/blob/master/docs/attribution.md) — retained numeric inputs, uncertain regional vertical reference.
