# N0554 — Temple of Vesta

Reviewed 2026-10-19 in one continuous author/build/inspect/fix round.

![Temple of Vesta](preview.png)

## Appearance

Inspected 48 current source, shared-material, medium-fi, native and failed-load views in this construction round. Standing Tivoli temple: roofless hollow cella, real southwest doorway and southeast window, blocked eastern relieving arch, ten fluted columns, partial curved entablature and recessed annular coffers. Original simplified floral capitals and horned/swag/rosette frieze; restraint rods and circular occupied podium. Construction views caught a lintel partly buried in the curved wall; moved the complete pale frame forward. Added quiet reticulate masonry patches and calibrated their contrast. No absent column ring or complete conical roof restored.

## Shared materials and browser levels

Five existing 256-square graphs: stone_ashlar, stone_limestone_raw, stone_travertine, brick_longformat and metal_painted. Seven roles merge into at most five runtime draws; wall/rubble and stone/column share their respective graphs. Each graph read once, metric UVs/linear tints, zero embedded images. Master 35,234 triangles/4,231,512 bytes. Levels 995/2858/14876/35234 triangles, initial 346140 bytes. Separate GPU streams and equal CPU/GPU accounting; eviction releases geometry. Reticulate patches use the existing raw-limestone surface with close stone tints, without a bespoke texture.

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 995 | 102448 | 1 |
| district | 2858 | 243692 | 4 |
| street | 14876 | 1458060 | 5 |
| closeup | 35234 | 3675632 | 5 |

Inspected current noon/late/economy/high context, silhouette, all four levels/transitions and three detail views. Skyline preserves ten supports, open door/window, hollow roofless cella, missing western arc and partial entablature; district restores molded column forms, street adds flutes/leafy capitals/coffers and quiet masonry, close-up increases capital/ornament density. Coarse wall colors blend the two stone tints to limit a color jump. Native/source/medium-fi terrain views establish contact; the flat shared stage exposes the below-grade footing. Synthetic surrounding procedural buildings are comparison context, not authored neighbors.

## Approximate map fit

Exact-QID OSM way/432883964 and named PMTiles cella35184804972796 identifyQ1219688. The approximately9.1m map footprint is the cella; picture-led column/podium radii6.25/7.25m extend outside it. Anchor12.800822243,41.966639022, heading0, native center[.0135748544,-.0109101368]. Southwest door/southeast window and eastern-southern surviving arc are approximate from pictures and independent Sibyl-north/restaurant-west context; retain30degree facing uncertainty. Only matching cella shell replaced with2cm numeric tolerance, zero residual. All292 independent resident inputs (including Temple of the Sibyl35184580229500), paths/original6m cliff ground and65713.10864765145m2 native water retained. Loaded292/failure293 original records; unload restores surfaces/frees geometry. No surrounding acropolis slab, ground/water cutout or flattening.

## Limits

Accepted medium-fi standing-state approximation from the three retained ordinary2014/2017 pictures and standard PMTiles/Mapzen, continued from the saved brief without restarting research. Detailed carving, wall damage, column arc/window/door inventory and heights remain picture-led estimates; original simplified motifs are not traced sculpture or copied inscriptions. Neighboring Sibyl temple, restaurant furniture, retaining structures and landscaping remain independent host context. Floor4.1542317132m above coarse anchor datum is at least.2m above the occupied envelope and.6m above its southwest approach. Ground-following buried footing bottoms produce varying exposed podium depth because DEM blurs the cliff; this is a visualization fit, not a measured ancient foundation section. Flat stage exposes those feet. Physical-device/dense-city timings remain pending.

## Selected checks

Six Khronos files: zero errors/warnings.203 actual mesh/contact probes; 48 current inspected views. Scene validation/sim30 and strict selected medium-fi audit pass. Source and runtime hashes/material bindings/LOD caps verified.

Rebuild: node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0554; node packages/worldgen/scripts/import-next-1000-models.mjs --ids=N0554; node packages/tooling/scripts/generate-landmark-lods.mjs --ids=N0554 --force.

Source: sha256:cb537c0ee602da672b567313615b60572a615078ad01d467876b227abbb65edf

Runtime: sha256:6a93453fcba2c313793ee30058483070e3f6bc3914794ef585ae3316301e2ab9

Input: sha256:fa8bf84c8a0fefb80dec212d4badf750d38432ccfad396d6abc6f168797e486f

## Viewed ordinary pictures

https://commons.wikimedia.org/wiki/File:Temple_of_Vesta,_built_in_the_early_1st_century_BC_on_the_acropolis_of_Tibur,_Tivoli_(14940758021).jpg — Carole Raddato; CC-BY-SA-2.0. Viewed only; no pixels copied.

https://commons.wikimedia.org/wiki/File:Temple_of_Vesta_(Tivoli)_2017.1.jpg — Oursana; CC0-1.0. Viewed only; no pixels copied.

https://commons.wikimedia.org/wiki/File:Temple_of_Vesta,_built_in_the_early_1st_century_BC_on_the_acropolis_of_Tibur,_Tivoli_(14920855626).jpg — Carole Raddato; CC-BY-SA-2.0. Viewed only; no pixels copied.
