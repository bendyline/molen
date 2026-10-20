# N0507 — Temple of Jupiter Optimus Maximus draft

Updated 2026-10-19. **Incomplete; no geographic or fidelity acceptance.**

![Molen foundation draft](preview.png)

## Authored this round

Two registered deterministic recipes generate a photographic draft of the exposed tufa wall and adjoining low remnants. The first render's ramp-like upper profile was revised to retain a mostly full-height wall and interrupted upper courses. Three ordinary museum photographs were inspected, including a wider 2024 panorama. The model represents surviving masonry; its dimensions, block courses, depth and fragment layout remain estimates. It is not the complete buried temple plan. Modern museum walls, display fragments, furniture and the lost ancient superstructure are excluded.

Master: 9,156 triangles / 1,100,272 bytes. One reused 256² raw-stone material graph, tinted to approximate the grey tufa; metric UVs and linear vertex colors. No embedded images or unique atlas. Four separate browser levels use one draw each and separate vertex attribute streams.

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 228 | 24600 | 1 |
| district | 228 | 20512 | 1 |
| street | 3924 | 378252 | 1 |
| closeup | 9156 | 796688 | 1 |

Initial skyline+district geometry totals 45,112 bytes, plus the shared graph. Six Khronos GLB checks have zero errors or warnings; strict medium-fi budget/material checks and scene validation pass. These are technical checks, not an architectural or placement approval.

## Inspected renders

Inspected all nine current portable views and all eight current shared-material views: long face, broken top, rear/parallel remains, masonry detail and plan. The common graph binds through the world viewer's material loader; the asset-review fixture unloads successfully. The coarse foundation silhouette, orderly stone joints and block proportions remain draft interpretations. Complete site and medium-fi review remain pending. The isolated stage is not evidence of underground fit.

## Placement still pending

The retained standard PMTiles resolve the museum, but no separate ancient foundation outline or excavation depth. museum-placement.json now records a proposed signed frame inside the mapped Esedra: anchor12.482268245,41.892642124; heading0.453161rad. The exposed face is inferred toward the rounded2024 camera geotag, with horizontal20m/azimuth45degree/floor4m uncertainty. The six original museum vertices are context only, transformed to the declared local frame. A conservative native-terrain overburden reference leaves the highest modeled stone at least0.28m beneath the35 bounding grid vertices. This is a burial envelope, not proof of the actual ancient wall position or excavation floor. The catalog remains draft, disables footprint replacement and has no building, ground or water cutout; it does not render automatically.

A production-renderer experiment forced the proposed entry only in a local test fixture. All four levels and failed-load fallback preserved1,859 native tile buildings byte-for-byte, unchanged terrain and202,947.109m² native water; eviction released all geometry. Inspected15 current site/failure views. The original procedural museum shells obscure the foundation in those views, including the proposed detail cameras. Therefore actual-site visibility and indoor integration failed to establish usability, and no geographic/fidelity acceptance is recorded. Removing the whole museum or opening an invented terrain pit would not resolve this correctly.

Pending integration work: provide a reviewed museum/excavation attachment frame and a host indoor or cutaway representation that preserves the modern exterior while exposing the real remains. Then review surviving scope and complete four-level site/medium-fi views before acceptance. N0507 remains in the incomplete backlog while ordinary above-ground production proceeds to N0508. Physical-device timings remain pending.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0507`, then the selected importer and landmark LOD generator. Both source recipes and all authoring inputs are registered. GLBs and bulk captures remain local build outputs.

Source: sha256:4d6691ea5b1c402850d067da15483a12dd9fb0c70e7a6989bd07c189048f1705

Runtime: sha256:df3afa04c7030aa3db1dc52f127c4302bf4f86d4254b2d0f032f51f5f90548c1

Input: sha256:188288de4180bf0e2057a0d5e0d7265ff8e8ab70ef4ee7650b47a7085d0890ca
