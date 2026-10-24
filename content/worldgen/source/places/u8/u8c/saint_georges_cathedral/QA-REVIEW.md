# saint_georges_cathedral — Saint George's Cathedral review

Reviewed 2026-10-14 against current source/runtime bytes. Accepted for the recorded medium-fi exterior and approximate geographic scope.

![Molen summary preview](preview.png)

## Built result

Inspected all 11 final portable/source-terrain views. The individual cathedral preserves the mapped cross plan, yellow plaster and pale Baroque trim, bowed west facade, single closed recessed door and tall arched window, projecting pilasters/cornices, curved gable and selected faceted standing/equestrian silhouettes, split stairs with a central recessed grotto, chamfered central drum, dark metal dome and gold lantern/cross. Enlarged side windows, added main side pilasters/balcony ledges and closed narrow roof-edge gaps after the first inspection. Sculpture and crest fields remain simplified.

Individual medium-fi exterior guided by three inspected pictures and standard viewer PMTiles/DEM. The current 5m map height is inconsistent with the pictures and explicitly rejected. All vertical proportions are estimates: 19.5m eave,23m ridge,31m drum top,35.8m dome crown,39.4m lantern and42m cross top above the raised floor;front crown 28.5m and selected figure 32.5m. No measured vertical dimensions. Exact sculpture/crests,full interiors,separate palace/courtyard wings,gates,belltower and certified walking excluded. Physical phone/laptop timings remain pending.

## Shared materials and placement

Inspected all 11 final shared-material/geographic views. Five existing 256-square graphs provide lime plaster, raw limestone, weathered limestone, standing-seam metal and wood. Dark roofs and gold lantern share the metal graph with distinct linear tints. Glass is flat blue-gray; UVs are metric. Each graph reads once. Unloading leaves zero live model geometries and restores ground. The flat placement view checks the signed map outline; source heightmap views complement the approximate terrain fit. Ground colors are diagnostic.

Retained exact-QID way165546187 and one current PMTiles parent preserve the approximately 42x24m cathedral cross plan. The west court and flanking low wings resolve the facade/stairs at native-X, with rear sanctuary at native+X and heading -0.0888164054rad. Raw map transforms match exactly without rescaling. Only the cathedral parent is replaced; other compound buildings and roads remain separate. Standard DEM datum 316.656407m and estimated 3.9m raised floor clear the sampled footprint peak 1.228m. Foundation/stair approach follow coarse terrain; exact court/stair thresholds remain approximate.

Inspected all 27 final Earth-lighting views: Economy/High, noon/late, three distances, silhouette, six detail cameras, four matched whole-model levels and four transitions. Skyline retains cross plan, bowed front, curved gable, central drum/dome/lantern/cross and coarse stair mass with mean material tints. District adds shared graphs, front/side recessed closed door and glazing, selected facade figures and balcony. Street adds recessed drum glazing, open lantern, ribs/bands/pilasters and stair balustrades; closeup refines arch, figure and stair detail. Level changes are visible. Procedural Italian-palazzo neighbors are synthetic context, not local mapped buildings.

## Browser budgets

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 593 | 60580 | 1 |
| district | 3491 | 322428 | 7 |
| street | 8055 | 726144 | 7 |
| closeup | 10368 | 935184 | 7 |

Skyline plus district: **383008 bytes** of geometry. Source master: **1248464 bytes / 10368 triangles**. Five shared graphs cached separately; no embedded images. Initial geometry excludes graph definitions/texture generation. Separate POSITION/NORMAL streams have equal CPU/GPU buffer totals. Physical device timings pending.

## Verification

- Exact targeted source reproduction with --ids=saint_georges_cathedral --check; current source/import/derivative/review hashes match.
- Six GLBs pass Khronos with zero errors, warnings or embedded images. All four browser levels meet triangle/draw/download budgets.
- Raw current parent, retained exact-QID outline, signed frame and standard DEM match. All six outputs retain the declared estimated 42m cross top above the raised floor; the erroneous 5m map height is unused.
- **186 imported probes** pass: nave/cross roofs, dome/lantern roof and floor, sculpture plinth, doorway/stair platforms across all levels; closed door, front/side/rear glass recesses and grotto backing in district/street/closeup; drum glass recesses and eight open lantern arches in street/closeup.
- Five material graphs read once; unloading disposes geometry and restores ground.
- Source inventory/schema, map-frame and medium-fi readiness bindings pass.
- Scene validation and 30-tick simulation pass: sha256:8b0351eb9e9d85012ab0a9db7320d661eaba4e2f19fa37d5dc969764c267ba3a.
- Inspected **49 current frames**: 11 portable,11 shared/placement,27 medium-fi. Reports retain cameras,paths and hashes; bulk views remain local/ignored.

Source hash: sha256:df5d3b87e14964530ae727fcf3bbb7f7f9f5a4ca4ea49aa5bd70fe089f452f11. Runtime hash: sha256:3bc69464b41f314c08ad2e634f9490104293e31a73d725b504232c84afd73078. Input hash: sha256:c1b20f99043a14e4821c714c6b8846fa195cab2c2ae13c7a47e68d0cf9803249.

Commands: targeted generate/import/LOD; capture-structure-models.mjs --ids=saint_georges_cathedral --reflections --antialias --fit-shadows; capture-landmark-library.mjs --ids=saint_georges_cathedral --reflections --adaptive-clipping --bounded-placement; capture-medium-fi.mjs --ids=saint_georges_cathedral --reflections; molen validate; molen sim run --ticks 30 --hash. No repository-wide engine suite/audit or full source rebuild repeated; next routine source checkpoint follows transfiguration_cathedral.

## Limits

- Current exact-QID parent supplies the approximately 42x24m cross plan, but its 5m height is clearly inconsistent with all inspected photographs and is rejected as an architectural height. All vertical stages are approximate picture proportions: 19.5m eave,23m nave ridge,23..31m central drum,35.8m dome crown,39.4m lantern and42m cross top above the estimated church floor;front cornice22m,curved gable28.5m and selected equestrian silhouette32.5m. No independent measured vertical dimensions.
- Standard DEM datum 316.656407m;estimated church floor 3.9m includes a raised entry platform above sampled footprint peak 1.228m and perimeter -0.87..1.23m. Foundation and lower stair approach follow coarse terrain. Precise court/stair thresholds and heights are picture-led approximations;no survey or certified walking.
- Individual exterior approximation from three inspected pictures and standard map/terrain. Exact coat-of-arms reliefs,equestrian/standing sculptures,side/rear decoration,full interiors,separate palace/courtyard wings,gates and belltower excluded. Split stairs/grotto are approximate;physical phone/laptop measurements pending.
- Skyline retains cross plan,bowed facade,curved gable,central drum/dark dome,gold lantern/cross and coarse split stair mass. District adds shared textures,recessed closed door/front and side glazing,selected facade figures and balcony. Street adds recessed drum glazing,open lantern,bands/ribs,pilasters and stair balustrades;closeup refines arch/figure/stair details. Detail transitions remain visible.

Readiness accepts this exterior scope. The 1,000-candidate goal remains incomplete.
