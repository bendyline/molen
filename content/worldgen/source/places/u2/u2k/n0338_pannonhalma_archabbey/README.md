# Pannonhalma Archabbey

![Molen preview](preview.png)

Pannonhalma mapped historic core: cream monastic ranges, two open courtyards, red basilica/tile roofs, dark hipped library, square clock tower with round columned gallery/copper dome, adjoining gatehouse and approximate retaining terrace/split entry stairs.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Pannonhalmi_Főapátság_épülete,_légifotó,_HB_PH01.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:JS_Hirth_-_Pannonhalma_Archabbey_tower_from_courtyard.jpg)

Seven existing shared256-square plaster,raw limestone,ceramic tile,slate,standing-seam copper,weathered limestone and wood graphs; metric UVs,linear vertex tints and flat blue-gray glass. No embedded images.

## Model and axes

33,623 triangles; 100,869 vertices; 8 material groups; 4,039,468 bytes. Native bounds: -80.000, -26.134, -85.000 to 43.417, 57.200, 70.867. Source hash: `sha256:a4ce8a6d3647a27853447f55f4e478a4fc4efd0feee79769f988149aef881051`.

{"x":"east along long monastic frontage from clock-tower end","y":"up","z":"south toward downslope forecourt"}

Core exterior from two useful pictures and standard viewer PMTiles/DEM. NativeY0 follows273.595795m standardDEM; estimated level floor0.8m clears coarse core perimeter-22.83..-0.12m and sampled courtyard peak0.454m. Buildings and photo-led terrace use foundations following retained terrain; retaining outline,height stages,court/step joins remain approximate. No surveyed floors,parcel boundary or certified walking surfaces.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0338` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- No retained published height facts or current PMTiles architectural heights. Main22m front eave/29.5m roof,23/32m basilica,19/26m library,15..21m other range eaves,36.5m square clock stage,37.5..46m colonnade,50.3..54.8m dome and56.4m overall crown are picture-led estimates. Ground datum follows standard viewerDEM; flat floor/terrace, retaining boundaries and all thresholds remain approximate. Six mapped controls retain the main ranges,basilica,tower,library,link and gatehouse; the two unioned courts stay open.
- Core exterior from two useful pictures and standard viewer PMTiles/DEM. NativeY0 follows273.595795m standardDEM; estimated level floor0.8m clears coarse core perimeter-22.83..-0.12m and sampled courtyard peak0.454m. Buildings and photo-led terrace use foundations following retained terrain; retaining outline,height stages,court/step joins remain approximate. No surveyed floors,parcel boundary or certified walking surfaces.
- Modern school,sports/visitor buildings,vegetation and neighboring campus are excluded. Selected window/clock/belfry/entry rhythms approximate pictures; no exact reliefs,clock numerals,sculpture,complete interiors,surveyed floor/roof plans,parcel boundary or certified walking surfaces. Courtyard paving and split stair joins approximate the hilltop terrace. Physical laptop/phone timings pending.
- Skyline uses mean tints/coarser octagonal dome and columns,solid belfry; district adds shared textures,window rhythm,clock hands and actual belfry recesses; street adds pilasters,framing/gallery windows and finer roofs; closeup refines dome/columns,clock ticks,louvers and steps. Detail/profile changes remain visible.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.
