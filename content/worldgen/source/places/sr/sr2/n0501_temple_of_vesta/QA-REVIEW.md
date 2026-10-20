# N0501 — Temple of Vesta

Reviewed2026-10-19. Accepted for the specific medium-fi present-day Roman Forum ruin and approximate PMTiles/DEM fit.

![Current modeled ruin](preview.png)

## Exterior and shared materials

Inspected all9 portable views. The present-day Roman Forum ruin has three tall fluted columns, the northeastern low stump, curved broken entablature, a shorter marble cella sector, exposed-brick circular podium and three specifically mapped low masonry fragments. Initial picture interpretation was corrected: the stump moved to the northeastern mapped end, and the cella wall now stops inside the western bay so the western tall column stands open. The roofless centre and missing remainder of the historic colonnade remain absent. Bases, flutes, coarse Corinthian leaf/volute masses and sparse dentils are selected medium-fi geometry. Exact damage and carved ornament are approximate.

Inspected all9 shared-material views. Four common256-square graphs provide marble, long-format brick, weathered limestone and gravel with metric UVs and linear tints. No copied photographs, embedded images or unique atlas. Each graph is read once across the model; eviction frees geometry. Four near draws and one skyline draw. The flat stage intentionally exposes some buried foundation geometry; actual contact was reviewed on the retained raw DEM separately.

## Browser levels

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 630 | 65152 | 1 |
| district | 1830 | 169156 | 4 |
| street | 3494 | 323152 | 4 |
| closeup | 5486 | 503812 | 4 |

Inspected all25 medium-fi views: street/block/skyline with procedural neighbors at noon and late afternoon in Economy/High, an untextured silhouette, four architectural details, four complete-ruin levels and all transitions. Levels630/1830/3494/5486 retain the roofless circular podium, three tall columns plus stump, shorter cella wall and broken curved entablature. District adds base profiles and podium marble panels; street adds coarse flutes, capitals and dentils; closeup adds selected finer shaft fluting and leaf masses. Initial skyline+district geometry234308bytes plus four common material graphs. Separate attribute streams avoid duplicate GPU uploads. Physical-device and dense-city measurements remain pending.

## Geographic fit

Reviewed approximate full-site fit on the unchanged161-square/6m standard DEM. Eight mapped components retain raw east/south coordinates; three tall columns and the northeastern stump identify the signed northwest surviving sector. The cella wall ends inside the western open bay, while the broken entablature spans the tall columns. The circular occupied base is seated above original terrain, with retaining faces reaching below the lowest perimeter sample. Across2826 mesh-height/boundary probes, the top foundation clears native terrain by at least0.1476m, so no ground or water opening is needed. Full-site loading replaces all8 authored records and preserves2080 independent tile buildings exactly. All2702 independent records in the local extract were checked outside the replacement envelope;409 nearby records remain in source for inspection. Nine native water features retain127659.45095056188 square metres. Failure preserves all2088 native tile buildings and terrain; eviction frees geometry. Synthetic10m partial residency deliberately clips the circular podium and outer entablature, but preserves original ground under and outside the clipped model with no terrain opening. Partial architectural completeness is not claimed. The surrounding unmodeled Forum ruins use the existing generic procedural renderer and are not historical reconstructions. Heights, thresholds, damaged profiles and coarse DEM grade remain approximate.

## Scope and limitations

Accepted for the specific medium-fi present-day Temple of Vesta ruin in the Roman Forum and approximate standard-map/DEM placement. Eight raw map component footprints and57 vertices remain intact; mapped column centres are preserved. Ordinary northwest and reverse photos determine which three columns retain full height, the northeastern stump and open western bay. These survival heights are not supplied by PMTiles. The occupied foundation is14.9m across; the ordinary article describes an approximately15m historic podium and20 original columns, which are context rather than a full reconstruction. Podium2.05m,10.35m entablature top above the occupied floor, curved profiles, surviving wall ends, low fragments and carving are picture-guided visualization estimates. All2826 original triangle-height/boundary probes leave at least0.1476m clearance beneath the opaque base; retaining faces join below the terrain. No terrain/water cutout is needed, including under partial residency. Synthetic10m loading intentionally clips the podium and entablature; complete architecture requires surrounding tiles, while the native ground stays intact. Independent Forum ruins retain the existing generic procedural appearance and are not historical reconstructions. Exact damage patterns, navigable interiors, buried chambers, the missing roof and the remainder of the former colonnade are outside scope. No bespoke survey or archival research was used.

## Source and checks

Two registered recipes plus retained map, terrain and reference metadata rebuild the master and browser levels. Master5486triangles/661284bytes. Six Khronos validations have zero errors/warnings. All60 shape/opening probes,57 map vertices and320 occupied-floor samples pass. Inspected43 official and22 site/failure/partial views. Bulk captures stay local.

The full cached extract has2710 map buildings; all2702 independent records were checked outside the occupied footprint. Source retains409 nearby records plus all authored controls; the pinned PMTiles URL/bounds and terrain inputs reproduce the wider context. The960m integration tile contains2088 records:8 authored components are replaced and2080 independent records remain byte-identical. Nine native water features retain127659.45095056188m². A negative native min_height is omitted in the review fixture exactly as in the production MVT decoder; raw map properties remain unchanged.

Selected source/import/placement/LOD checks, strict medium-fi audit, scene validate and sim30 pass. Full source rebuild and asset-lock refresh remain batch milestones. No dependency audit, Git mutation or upload was performed.

Rebuild: node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0501; node packages/worldgen/scripts/import-next-1000-models.mjs --ids=N0501; node packages/tooling/scripts/generate-landmark-lods.mjs --ids=N0501.

Source: sha256:f60dec979709bc2a381ac7fc2bc164dcb8d87eecadf19ae897ad23b8a1dd6f89

Runtime: sha256:b041271b85e908912b2b32e2900ce8d143c21546d0a117aefa70619d5a8716a8

Input: sha256:02a02f7f84a397112c410e6d94e39f7d374d0c64f69e101a4216dd3dff26e70d

## Ordinary pictures

https://commons.wikimedia.org/wiki/File:Temple_of_Vesta_(Rome).jpg — Wknight94; CC BY-SA3.0; viewed only. No pixels shipped.

https://commons.wikimedia.org/wiki/File:Temple_of_Vesta_Forum_Romanum_Rome.jpg — Jebulon; CC0; viewed only. No pixels shipped.

https://commons.wikimedia.org/wiki/File:Temple_Vesta_Forum_Romanum_Rome_Italy.jpg — Jebulon; CC0; viewed only. No pixels shipped.
