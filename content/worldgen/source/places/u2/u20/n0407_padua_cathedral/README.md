# Padua Cathedral

![Molen preview](preview.png)

Individual medium-fi Padua Cathedral: unfinished three-door brick east front with stepped gable/oculi, terracotta-roofed nave/aisles, three tall rounded apses and two lower western chapels, pale crossing drum and lead-colored hemispherical dome/lantern/cross, and separate mapped northwest square brick campanile. Six existing shared graphs, eight groups and four browser LODs. Retain current irregular church whole/tower control; exclude the separate baptistery and canonical houses. Heights/details and exact ground joins estimated or unverified.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Duomo_(Padua)_-_Facade.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Abside_Cattedrale_Padova.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Duomo,_cupola_(Padova)_02.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Duomo_(Padua)_-_Exterior_-_Bell_Tower.jpg)

Six existing shared256² brick,raw limestone,lime plaster,flat tile,painted metal and plain wood graphs with local blue-grey glazing. Linear tints,metric UVs,flat architectural normals. No embedded images,unique facade photographs,bespoke textures or baked lighting.

## Model and axes

21,127 triangles; 63,381 vertices; 8 material groups; 2,539,928 bytes. Native bounds: -47.933, -0.879, -34.123 to 48.640, 58.300, 34.121. Source hash: `sha256:82da41808bad947b2f84758574156b26b84212b6bb97e35da5f610b9c79a40bf`.

{"x":"east toward unfinished front/plaza","y":"up","z":"south"}

Standard viewer DEM datum21.225210m; selected perimeter-0.53 to1.20m relative to it. Floor0.5m; adaptive footings crossY=0 and extend below retained samples. No flattening, cutout or road replacement. Exact plaza/pavement, thresholds, steps, adjoining-house and baptistery joins, altitude and walking remain unverified.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0407` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Exact retained way/131977001 and Q2407092 identify Duomo di Padova / Padua Cathedral. Current standard viewer church whole35184504065833, same-ID named POI and separate tower part35185013113163 retain73 raw outline points and all properties, alongside the earlier whole/multilingual tags. Anchor[11.87124763,45.406526605] and heading0.135977608274rad unchanged; no horizontal rescale. Native+X east unfinished brick front/plaza,−X west rear apses,+Z south. Signed facing follows the facade photograph and the separate mapped baptistery to its north. Church apse/crossing/nave/aisle partitions are picture estimates within the current envelope. Separate Battistero35184576956654 and surrounding canonical houses/palaces remain host content.
- No selected map height/level tags or independent height/dimension facts. Every vertical dimension is estimated above floor0.5m: low outline/accessory ranges13.2m, aisle outer eave15.2m/inner18.8m, nave/choir/transept wall24.2m and ridge29.8m; front unfinished central gable31.3m and aisle shoulders18.8m. Three major rounded apses wall24.2m and tile crown27.5m, small western side apses13.2/15.2m. Crossing drum26.8–38.8m, lead-colored dome49.7m, lantern55.8m and cross57.8m. Northwest campanile has shaft40.3m, belfry41.7–47.4m, shallow cap48.2m and vane49.3m. Details, bays, exact roof/apse profiles and hidden partitions are approximate.
- Standard viewer DEM datum21.225210m; selected perimeter-0.53 to1.20m relative to it. Floor0.5m; adaptive footings crossY=0 and extend below retained samples. No flattening, cutout or road replacement. Exact plaza/pavement, thresholds, steps, adjoining-house and baptistery joins, altitude and walking remain unverified.
- Individual medium-fi exterior from four inspected pictures and standard viewer PMTiles/DEM. All heights,roof/apse/lantern partitions and details are estimates. Unfinished front,crest/pilasters,cornices,dentils,lead roof ribs and vane are abstractions. Faithful sculpture/inscriptions,window artwork,interiors/bells,hidden adjoining walls,current finish,engineering,exact plaza/threshold/step/base contact and physical phone/laptop timing remain simplified,excluded or unverified. Doors and belfry fields are recessed timber;glazing is blue-grey. No navigable interior or open-belfry claim. Baptistery,canonical houses,palaces,trees and town remain host content. Italian palazzo neighbors are synthetic fixtures.
- Skyline retains stepped brick east front,three major round apses,long terracotta nave/aisles,crossing dome/lantern/cross and square northwest campanile. District adds shared materials,front portals/oculi,coarser apse and clerestory windows,drum lights and belfry. Street adds full apse/window rhythm,pilasters,cornices,steps,slits/mullions and dome ribs. Close-up/master refine curved sampling.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
