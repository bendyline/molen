# modena_cathedral — Modena Cathedral review

Reviewed 2026-10-14 against current source/runtime bytes. Accepted for the recorded medium-fi exterior and approximate geographic scope.

![Molen summary preview](preview.png)

## Built result

Inspected all 11 final portable/source-terrain views. Individual cathedral/Ghirlandina retains stepped west gables,large recessed spoke rose,three closed recessed west portals,selected three-arch gallery bays/pilasters,two-tier west porch,pink southern Porta Regia,red-tiled raised nave/single-slope aisles,three eastern apses/four roof turrets and separate square/octagonal tiered belfry/stone spire. Corrected aisle roof slopes,the overlapping aisle wall that blocked the southern door,and unsupported roof-turret stems. Exact lions,figures and carved reliefs excluded.

Individual medium-fi exterior from useful aerial,west-facade and south-portal pictures plus standard viewer PMTiles/DEM. Current map height values constrain 21m long nave,22.4m choir/cross-roof strips,16.1m aisles,18.3m eastern side roofs,16.2/12.4m apses,12.6m southern porch,28.4/26.1m roof turrets and 47.5/57/85m Ghirlandina stages. Eaves,porch/gallery/window dimensions and octagonal/spire transition heights are picture-led interpretations,not independently surveyed dimensions. Selected blind galleries are shallow dark pane/arch/column representations. Exact sculpture/lions/reliefs,full interiors,town/square and certified walking excluded; physical phone/laptop timings pending.

## Shared materials and placement

Inspected all 11 final shared-material/geographic views. Four existing 256-square graphs provide raw/weathered limestone,ceramic tile and plain wood; pink trim reuses limestone with linear vertex tint. Glass is flat blue-gray; UVs are metric and skyline uses graph mean tints. All four graphs read once. Unload leaves zero live model geometries and restores ground. Flat placement checks signed plan; source heightmap views complement coarse terrain fit. Ground colors are diagnostic.

Retained exact-QID way548995705 plus 22 current church/tower parent/part controls transform exactly without rescaling. Three eastern apses versus west rose,southern Porta Regia and northeastern Ghirlandina resolve heading -0.525403755529rad. Full parent supplies the foundation; the lower church shell is clipped at the apse/porch joins and those profiles are authored separately. StandardDEM datum 43.367101m and estimated 0.8m floor clear sampled footprint peak 0.499m. Tower connecting arch and exact piazza/entry thresholds remain approximate; no road replacement or certified walking.

Inspected all 27 final Earth-lighting views: Economy/High,noon/late,three distances,silhouette,six details,four matched levels and four transitions. Skyline preserves stepped cathedral/triple apses/turrets and tall tower masses. District adds textures,rose,recessed closed doors,actual porch and connecting arches,flat belfry panes and simplified bays. Street adds actual square/octagonal belfry cuts,selected gallery columns/pilasters,roof bands and turret apertures; closeup refines arch segmentation,rose spokes and column capitals. Detail/profile changes remain visible. Italian-palazzo neighbors are synthetic context.

## Browser budgets

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 565 | 58936 | 1 |
| district | 2434 | 210716 | 6 |
| street | 15254 | 1274924 | 6 |
| closeup | 24852 | 2189484 | 6 |

Skyline plus district: **269652 bytes** of geometry. Source master: **2986052 bytes /24852 triangles**. Four shared graphs cached separately; no embedded images. Initial geometry excludes graph definitions/texture generation. Separate POSITION/NORMAL streams have equal CPU/GPU buffer totals. Physical phone/laptop timings pending.

## Verification

- Exact targeted source reproduction with --ids=modena_cathedral --check; source/import/derivative/review hashes match.
- Six GLBs pass Khronos with zero errors,warnings or embedded images; all four levels meet triangle/draw/download limits.
- All 22 raw map controls,retained exact-QID outline,signed frame and standardDEM match. Map heights guide interpreted stages and do not certify real measurements.
- All six outputs retain the map-derived 85m tower crown. Foundation follows coarse terrain beneath the estimated floor.
- 253 imported probes pass: nave/aisle/apse roof and tower platform support across levels; four portal recesses/closed doors,rose recess/glazing,six porch arches and tower connecting underpass in district/street/closeup; all40 square/octagonal belfry openings in street/closeup. Four turret-stem support checks repeat across all levels.
- Selected rose spokes and columns remain intentionally solid. The rose probe avoids a spoke; it was not a blocked-wall repair.
- Nearby aperture filtering removes unnecessary distant triangle splits. Street omits closeup column capitals to meet its16k ceiling; source master preserved. Float32-collapsed clipping wedges are discarded before emission.
- Four graphs read once; unload disposes geometry/restores ground. Pink trim shares limestone.
- Source inventory/schema,map-frame and medium-fi readiness bindings pass.
- Scene validation/30-tick simulation pass: sha256:fbfb5eeea712119fbd323aa21ed567b63745f8540d69694632d7dbf65c0d5ec1.
- Inspected 49 current frames: 11 portable,11 shared/placement,27 medium-fi. Reports retain paths,cameras and hashes; bulk views remain local/ignored.

Source hash: sha256:ab338cf7a6d5ca5d8414861465f275eab6001a317c6347713e85b2d04083b8fc. Runtime hash: sha256:a9009f35d32cc79bc310b4945f29bad2a2626724898a7c783c3a703f754274c8. Input hash: sha256:243b904d25d63e296691e72f80eb7e1e6907e8580d81e7a52870f118bf183702.

Commands: targeted generate/import/LOD; capture-structure-models.mjs --ids=modena_cathedral --reflections --antialias --fit-shadows; capture-landmark-library.mjs --ids=modena_cathedral --reflections --adaptive-clipping --bounded-placement; capture-medium-fi.mjs --ids=modena_cathedral --reflections; molen validate; molen sim run --ticks 30 --hash. No repository-wide engine suite/audit or full source rebuild repeated; next routine source checkpoint follows transfiguration_cathedral.

## Limits

- Current map constrains21m long nave,22.4m raised choir/cross-roof strips,16.1m aisles,18.3m eastern side ranges,16.2/12.4m apses,12.6m south porch,28.4m west/26.1m east turrets and47.5/57/85m tower stages. Eaves,inner belfry and octagonal/spire transition heights,porch/gallery/opening sizes and sculpture are picture-led interpretations; no independent measured heights or certified dimensions.
- StandardDEM datum43.367101m; estimated floor0.8m clears footprint peak0.499m and perimeter-0.21..0.50m. Terrain-following foundations; exact piazza/step/tower thresholds and all eave/gallery/roof-stage roles approximate. No independent survey or certified walking.
- Selected gallery bays are shallow pane/arch/column representations rather than fully excavated interiors. Rose spokes,porches,roof turrets,pink trim and connecting arch are approximate. Exact lions,sculpture/reliefs,full interiors,adjacent town/square and certified walking excluded. Physical phone/laptop timings pending.
- Skyline omits portals/gallery/porch details and uses solid tower masses/mean-tinted roofs. District adds textures,rose/recessed closed portals,actual porch/connecting arches and simplified flat belfry/grouped bays. Street adds actual square/octagonal belfry cuts,selected gallery columns/pilasters,roof bands and turret openings. Closeup refines arch segmentation,rose spokes and columns. Detail/profile changes remain visible.

Readiness accepts this exterior scope. The 1,000-candidate goal remains incomplete.
