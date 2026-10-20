# N0546 — Capela dos Ossos

Reviewed 2026-10-19 in one continuous author/build/inspect/fix round.

![Capela dos Ossos](preview.png)

## Appearance

Inspected53 current source/shared/medium-fi/native/fallback views in the same construction round. Chapel is integrated into the connected Sao Francisco host: tall ashlar nave, five true pointed west portico bays, recessed church door/window, crenellated gable/parapets, conical corner pinnacles/cross and lower white/tile-roof ranges. West courtyard enters a real vestibule/north chapel portal. Interior has three aisles/eight round bone piers, five groin-vault bays/curved ribs, three high east openings, original simplified skull cavities/longbone lining and gilded altar/twisted shafts/cross. Current views cover whole host, accessible interior, wall relief and altar. Same-round fixes filled sparse bone lining, wrapped pier relief and protected shared map edges.

## Shared materials and browser levels

Seven existing256-square graphs reused across eight roles: stone_ashlar, stone_limestone, plaster_lime (plaster and bone tints), tile_ceramic, metal_painted, metal_bronze_cast and stone_limestone_raw. Each graph read once; metric UVs/linear tints, zero embedded images. At most eight draws; separate GPU streams and matching CPU/GPU accounting. LODs972/3637/14685/54368triangles; initial432640bytes. Optional close-up5844868bytes. Eviction releases model geometry.

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 972 | 98960 | 1 |
| district | 3637 | 333680 | 8 |
| street | 14685 | 1496332 | 8 |
| closeup | 54368 | 5844868 | 8 |

Current noon/late/economy/high/context, four levels/transitions and detail views inspected. Skyline preserves the host silhouette, chapel envelope and actual entries while omitting hidden interior detail; district restores plain piers/vaults/altar; street adds ribs and simplified bone relief; close-up adds dense original bone lining, cavity detail and ceiling curls. Interior lighting is dim in several native/medium views; brighter shared views and the native altar detail establish the forms. Whole exterior views do not expose the hidden chapel interior; portal/interior/detail cameras cover it. Flat shared-stage ground differs from the terrain-relative native threshold. Green native ground, independent procedural neighbors, paths and water remain host context.

## Approximate map fit

Exact-QID node6763794307/Q2561983 and named PMTiles museum point17598949838723 correlate occupied parent church control35184534465311. Anchor-7.9083714,38.5687532; heading0, internalaxis-.19rad. Parent outline controls host extent; there is no separately mapped chapel interior footprint. Approximate chapel allocation in the southern wing, north portal and south altar are explicitly uncertain. Parent mask excludes ten bounding-box-relevant independent footprints with1mm halo; all3630 independent resident inputs remain unchanged. A0.75511201583m2 parent residual is entirely inside protected independent envelopes+1.1mm, with zero outside area; this preserves shared overlap edges. Loaded levels retain3631 records including this fragment; failure restores3631 full originals. Original6m ground and3151.800622m2 native water unchanged, no ground/water cutout or broad city slab. Local occupied bases are buried; unload restores ground/water and frees geometry.

## Limits

Accepted medium-fi from four inspected ordinary whole-chapel, altar/detail, complete host exterior and entrance pictures plus standard PMTiles/Mapzen. Additional exterior/entry views filled specific host/portal coverage gaps. No bespoke research. Shared textures and original abstract bone/ceiling ornament; no copied painting, inscription, narrative tile or bone photo atlas. Bone anatomy/count, sculptural inventory, hidden room/roof divisions, heights, exact chapel allocation/facing and threshold levels remain approximations. Host church/museum interiors are unmodeled; chapel and vestibule are accessible. Coarse urban DEM cannot resolve paving/steps or absolute room levels. No museum barriers/individual relic inventory. Physical-device/dense-city timings remain pending.

## Selected checks

Six Khronos files: zero errors/warnings.148 actual mesh/map-envelope probes; 53 current inspected views. Scene validation/sim30 and strict selected medium-fi audit pass. Source and runtime hashes/material bindings/LOD caps verified.

Rebuild: node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0546; node packages/worldgen/scripts/import-next-1000-models.mjs --ids=N0546; node packages/tooling/scripts/generate-landmark-lods.mjs --ids=N0546 --force.

Source: sha256:d618ff81f2b2bf282bd2b515b04fc766677f04b7920693946e6c3375bdec84c8

Runtime: sha256:1cf19ea0ed79f981ee1ca8482a246bd89edc59f7f532a8eb68a6f84a691f96a8

Input: sha256:c40778813ab2ca5c6806aeff3874898482b089fd91cc744597ec32a129c9657e

## Viewed ordinary pictures

https://commons.wikimedia.org/wiki/File:Capela_dos_ossos.jpg — Nuno Sequeira Andre; CC-BY-SA-2.0. Viewed only; no pixels copied.

https://commons.wikimedia.org/wiki/File:Capela_dos_Ossos_-_Apr_2011.jpg — Ken & Nyetta; CC-BY-2.0. Viewed only; no pixels copied.

https://commons.wikimedia.org/wiki/File:Fachada_da_Igreja_de_São_Francisco,_Évora.JPG — PESP/Wikimedia; CC-BY-SA-3.0. Viewed only; no pixels copied.

https://commons.wikimedia.org/wiki/File:Capela_dos_ossos_entrada.jpg — Nuno Sequeira Andre; CC-BY-SA-2.0. Viewed only; no pixels copied.
