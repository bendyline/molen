# N0556 — Osireion

Reviewed 2026-10-19 in one continuous author/build/inspect/fix round.

![Osireion](preview.png)

## Appearance

Inspected49 current source/shared/medium-fi/native/fallback/small-resident-tile views during the same construction pass. Specific open Osireion hall: ten massive plain granite square piers in two rows, worn bases/broken tops, incomplete longitudinal lintels/cap fragments, coursed masonry and actual shaded rectangular recesses with closed backs. Wet central island/two floor depressions, low opaque green moat and narrow supported timber descent. Construction fixed open inner earth sides, coarse-boundary skirts, excessive corner bevels, block-course scale and a stair/wall interference using a supported middle landing. No complete ancient roof, copied relief/graffiti atlas or speculative covered rooms.

## Shared materials and browser levels

Four existing256-square graphs: stone_granite, stone_sandstone_raw, wood_plain and metal_painted. Wall/soil/wet and water/metal reuse graphs with separate semantic roles/tints; at most five draws. Stone courses are broad original geometry over the shared raw sandstone, avoiding a small-brick texture scale or bespoke atlas. Metric UVs/linear tints, each graph read once in the full near view, zero embedded images and separate GPU streams. Current counts/bytes are in the table; initial skyline plus district geometry274940bytes. Matching CPU/GPU accounting and unload disposal pass.

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 924 | 98204 | 1 |
| district | 1832 | 176736 | 5 |
| street | 7612 | 735572 | 5 |
| closeup | 7612 | 735572 | 5 |

Inspected noon/late/economy/high context, silhouette, four levels/transitions and three details. Skyline retains all ten piers, incomplete lintel rows, closed excavation bed/rim, shallow moat and coarser timber descent; district restores pier bevels/base steps, recess bays, floor depressions and treads; street/close-up add separate large stone courses, worn blocks/loose caps and stair rails. Street and close-up share geometry because it fits the street budget. A synthetic review initially lacked a marked terrain input; supplying the retained terrain made its opening/unchanged-source-elevation checks pass, with no model change for that configuration fix. Source/flat shared stages show an isolated excavation cutaway; native/medium-fi terrain views establish actual opening contact.

## Approximate map fit

Exact-QID OSMway90456113/Q2033435 gives38.96x31.31m archaeological envelope; named standard PMTilesOsireionPOI35184462544945 coincides within0.16m. Anchor31.918428132,26.18413313, heading0/native east-south; internal NE/SW long axis-.97476887509rad is map-controlled. Signed bridge/recess/surviving-lintel arrangement is picture-led and may be reversed180degrees; this uncertainty is recorded rather than claiming a surveyed pier plan. A1219.68142m2 ground opening follows only that extent. Full opaque bed at-6.3m covers it at every LOD; fitted soil rim/skirts retain the native edge.624 native opening probes are covered by the model at each loaded level and in a10m resident tile. All eight independent native buildings, paths, original6m grid and zero native water records remain unchanged; no building shell replaced. Failure restores original ground/eight buildings, unloading restores original ground/water and releases geometry. Neighboring Seti I temple is independent.

## Limits

Accepted medium-fi standing open hall/excavation in the pictured2004 low-water state, informed by two ordinary2004/2011 photographs and standard PMTiles/Mapzen in one continuous build/inspect/fix round. Low-water opaque algae surface is a static visualization, not a live water level or hydrology. Exact pier/lintel/fracture/niche inventory, bridge routing, signed facing and floor/depths are approximate; the coarse DEM rises about4m across the opening and does not resolve the real excavation section. Complete ancient roof, covered subterranean rooms/long passage and neighboring temple are not claimed authored. Physical phone/laptop/dense-city timing remains pending.

## Selected checks

Six Khronos files: zero errors/warnings.3868 actual mesh/contact probes; 49 current inspected views. Scene validation/sim30 and strict selected medium-fi audit pass. Source and runtime hashes/material bindings/LOD caps verified.

Rebuild: node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0556; node packages/worldgen/scripts/import-next-1000-models.mjs --ids=N0556; node packages/tooling/scripts/generate-landmark-lods.mjs --ids=N0556 --force.

Source: sha256:24b60143ca9d7f946c7ed5e54ddb6ef1e19115c0010ce842c9900c9cd9df9639

Runtime: sha256:92c9391abd49833db4bac66885cc9b45914f70cc9ac0a99c30c5cea220214b32

Input: sha256:cb17b365c1930b12eb15c5f91320a57c43def3a1db82f8d52dfc05d0f910ede3

## Viewed ordinary pictures

https://commons.wikimedia.org/wiki/File:Osireion_02.JPG — Olaf Tausch; CC-BY-3.0 / GFDL. Viewed only; no pixels copied.

https://commons.wikimedia.org/wiki/File:Osireion_at_Abydos.jpg — User:Markh credited in description; RsAzevedo uploader; CC-BY-SA-3.0 / GFDL. Viewed only; no pixels copied.
