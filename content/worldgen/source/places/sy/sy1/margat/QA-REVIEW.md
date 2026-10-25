# margat — Margat review

Reviewed 2026-10-12 against the medium-fi standard. This is an approximate exterior visualization, with a separate detailed source master and four browser models.

## Inspected result

Inspected all 61 final frames: 11 portable/source views, 11 shared-material/geographic views, 27 medium-fi views and 12 supplementary context comparisons. The open inner ward, southern round keep, separate pointed chapel portal with its upper opening and cut barrel vault, western entrance stair, battered bastions and outer vault bays remain recognizable. The entrance cuts through the hall instead of being covered by its solid shell. Thin coping bands, inward normals and window offsets were corrected before acceptance.

Shared basalt supplies masonry courses; continuous limestone supplies pale portal trim; gravel supplies roof and court surfaces. The three canonical 256² graphs were each read once; no photograph or unique bitmap is embedded. Distant colors use their measured linear means. The shared renderer released all model geometry on unload.

Economy and High were inspected at noon and late afternoon, at street, block and skyline distances. The supplemental flat context shows nearby procedural apartments for palette comparison; it is not real site context. The six-sided skyline becomes rounder at district and street distance; the shared silhouette, court, roof and gateway persist. Fine ruin crests and outer vault openings enter at street distance. Four comparison frames record the transitions.

## Geographic fit

The named Qal`at al Marqab PMTiles point is the anchor: longitude 35.94962865114212, latitude 35.15100353726311. Heading 0 preserves native +X east, +Z south and +Y up. Five standard PMTiles building envelopes control the inner halls and chapel. The footprint overlay follows the mapped eastern wing/round-end polygon; it does not claim that the reconstructed outer curtain is mapped.

The PMTiles height grid and its 354.02029067906426 m anchor datum are retained as source inputs. Foundations descend to this coarse hillside; the open ward, stair and chapel use explicitly reconstructed architectural levels. Source and medium-fi hill views show their approximate contact. The shared geographic fixture has flat terrain and hides below-datum foundations/stairs; it proves horizontal placement, orientation and texture binding, not hillside or surveyed threshold accuracy. Other host terrain resolutions can change contact.

## Costs and verification

| Model | Triangles | Bytes | Material draws |
| --- | ---: | ---: | ---: |
| Source master | 7,669 | 923,060 | 4 |
| Skyline | 565 | 60,000 | 1 |
| District | 947 | 91,356 | 4 |
| Street | 3,191 | 285,772 | 4 |
| Closeup | 4,217 | 369,188 | 4 |

Initial skyline plus district is 151,356 bytes (41,619 bytes gzip), below the 3 MB phone and 6 MB laptop targets. Browser vertex streams are separate; recorded CPU and GPU geometry costs agree. Khronos validation passed for the source, imported model and all four LODs: zero errors, zero warnings, zero embedded images. Source regeneration, asset hash verification, scene validation, headless simulation, current placement and source inventory were checked in the targeted loop.

## Reproduce

```sh
node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=margat
node packages/worldgen/scripts/import-structure-models.mjs --ids=margat
node packages/tooling/scripts/generate-landmark-lods.mjs --ids=margat
```

The registered additional-landmarks job also reconstructs this model during the batch source build. `qa.json` binds acceptance to current inputs, source/runtime bytes, LODs, placement, shared graphs and inspected pixels.

## Limits

Heights, portal bearing, outer fortifications, broken profiles and terrace/threshold levels are picture-led estimates. Northern settlement, lost works, vegetation, modern antenna fixtures, frescoes, room interiors and certified traversable collision are excluded. The imported collision hull is a broad discovery bound. Physical laptop and phone frame-rate measurements remain pending. This is not a surveyed, engineering or archaeological reconstruction.
