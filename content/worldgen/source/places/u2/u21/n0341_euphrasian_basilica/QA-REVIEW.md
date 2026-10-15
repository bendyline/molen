# N0341 — Euphrasian Basilica review

Reviewed 2026-10-14 against current source/runtime bytes. Accepted for this medium-fi exterior and approximate geographic scope.

![Molen summary preview](preview.png)

## Built result

Inspected all 11 final portable/source-terrain views. Individual complex retains the long raised nave/round clerestory and lower red-tiled aisles,polygonal eastern apse,west triple windows/selected colored mosaic bands,open atrium/courtyard arcades,octagonal baptistery,separate square paired-arch belfry/steep stone spire and northern episcopal ranges/attached chapels. Corrected omitted lower connecting areas and overlapping palace ranges; made the stone spire more slender. Exact mosaic figures,tesserae and carved capitals are excluded.

Medium-fi individual exterior based on useful aerial,tower and atrium pictures plus standard viewer PMTiles/DEM. None of the seven selected map controls contains a height; retained source facts also have no published heights. All vertical dimensions are picture estimates: nave 13.6/16.2m,aisles 7.8..10m,apse 11.8..14.6m,baptistery 8.4..11.2m,tower 28m shaft/33m belfry/49m spire with nominal 50m cross,atrium 4.4..6.3m and palace 9..14m. These are authored approximations,not independent measurements. Roof roles,openings,arcade supports and mosaic bands remain approximate; exact figures/sculpture/full interiors,excavations,seawall/town and certified walking excluded. Physical phone/laptop timings pending.

## Shared materials and placement

Inspected all 11 final shared-material/geographic views. Five existing 256-square graphs provide raw limestone walls/trim,weathered limestone foundations,lime plaster,ceramic tile and plain wood. Colored mosaic bands share stone through linear vertex tints; flat blue-gray glass,metric UVs and far mean tints. Every graph reads once; unload releases all model geometry and restores ground. Source-terrain views complement the flat signed-placement check. Ground colors are diagnostic.

Retained exact-QID way298139426 and seven current PMTiles controls preserve the main 39x19m church and northern/western complex. Original map court remains open. Current controls transform exactly without rescaling; eastern apse versus western tower/baptistery resolves heading -0.133501279102rad. The compound is accounted for by interpreted nonoverlapping ranges,atrium,tower,baptistery envelope and lower connecting areas; zero missing mapped compound area in that decomposition. Octagonal baptistery shape is inferred within its rectangular joining envelope. StandardDEM datum 2.562043m and estimated 1m floor clear sampled footprint peak 0.682m. Exact terrain,town/courtyard joins and thresholds remain approximate. No road replacement or certified walking.

Inspected all 27 final Earth-lighting views: Economy/High,noon/late,three distances,silhouette,six details,four matched levels and four transitions. Skyline retains the compound/atrium opening,nave/apse,baptistery and solid coarse belfry/spire. District adds shared graphs,flat windows,selected mosaic bands,recessed closed door and actual atrium arches. Street restores actual belfry/clerestory apertures,selected roof bands/cross/columns. Closeup refines capitals,frames and arch segmentation. Level detail/profile changes remain visible. Italian-palazzo neighbors are synthetic context,not local map buildings.

## Browser budgets

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 581 | 61212 | 1 |
| district | 2044 | 200624 | 7 |
| street | 6368 | 565376 | 7 |
| closeup | 10524 | 941924 | 7 |

Skyline plus district: **261836 bytes** of geometry. Source master: **1267160 bytes /10524 triangles**. Five shared graphs are cached separately; no embedded images. Initial geometry excludes graph definitions/texture generation. Separate POSITION/NORMAL streams have equal CPU/GPU buffer totals. Physical device timings remain pending.

## Verification

- Exact targeted source reproduction with --ids=N0341 --check; current source/import/derivative/review hashes match.
- Six GLBs pass Khronos with zero errors,warnings or embedded images. Four browser levels meet triangle/draw/download budgets.
- Seven raw map controls,retained QID outline,original courtyard,signed frame and standard DEM match. All heights and architectural subdivisions remain picture-led estimates.
- Full mapped compound coverage through explicit interpreted ranges and lower connections; no global rescaling. Baptistery is a picture-led octagon within the mapped joining envelope.
- 280 imported probes pass: ridge/aisle/apse/tower/baptistery/connecting-roof support and open courtyard across all levels; recessed closed portal and twelve open atrium arches/retained piers in district/street/closeup; all eight belfry openings and seventeen clerestory/west-window recesses/glazing in street/closeup.
- Extended belfry cuts through the inner shell. Tiny clipped Float32 wedges are discarded before buffer emission; no degenerate exported triangles.
- Five graphs read once; unload leaves zero live model geometries and restores ground.
- Source inventory/schema and map-frame/medium-fi readiness bindings pass.
- Scene validation and 30-tick simulation pass: sha256:59a8950308829ca4c57fa1a2c05afe58548f49a511375a940d040d88ddcd3b6b.
- Inspected 49 current frames: 11 portable,11 shared/placement,27 medium-fi. Bulk views remain local/ignored; reports retain cameras,paths and hashes.

Source hash: sha256:4345630ee1e22098a7790c08920a329925f571a247e6a2f767268403ee50c498. Runtime hash: sha256:463bce1a22f113efa55419aee743bb649eb7c04e137160daf2e0b4e4a11eb7d9. Input hash: sha256:938afe8869e8facbc911921c756b1cf5f69e3958268faf65ffba85fa20c779c0.

Commands: targeted generate/import/LOD; capture-next-1000-models.mjs --ids=N0341 --reflections --antialias --fit-shadows; capture-landmark-library.mjs --ids=N0341 --reflections --adaptive-clipping --bounded-placement; capture-medium-fi.mjs --ids=n0341_euphrasian_basilica --reflections; molen validate; molen sim run --ticks 30 --hash. No catalog-wide source rebuild or engine suite repeated; routine source checkpoint follows N0359.

## Limits

- No height values are present on the selected standard map controls, and retained height/width/length facts have no published measurements. All vertical dimensions are picture-led estimates: main nave13.6m eave/16.2m ridge,aisles7.8..10m,polygonal apse11.8..14.6m,baptistery8.4..11.2m,tower28m shaft/33m belfry/49m spire plus1m cross,atrium4.4..6.3m and palace9..14m. These dimensions and interior division are approximate, not independently measured.
- Standard viewerDEM datum2.562043m; estimated level floor1.0m clears sampled footprint peak0.682m and perimeter-1.94..0.68m. Foundations follow coarse terrain. No independent floor/height survey; exact courtyard thresholds,stairs and terrain/town joins unverified.
- Octagonal baptistery inferred within the mapped rectangular joining envelope. Arcade piers,windows,selected mosaic bands/capitals,roofs and palace range roles approximate. Exact mosaic figures/tesserae,sculpture,full interiors,excavations,seawall/town and certified walking excluded. Physical phone/laptop timings pending.
- Skyline retains compound/atrium void,coarse nave/apse,baptistery and closed belfry/mean roofs. District adds textures,flat windows,mosaic bands,recessed closed door and actual atrium arches. Street adds actual belfry/clerestory apertures,columns,selected roof bands and cross. Closeup refines capitals/window frames and arch segmentation; detail changes remain visible.

Readiness accepts this exterior scope. The 1,000-candidate goal remains incomplete.
