# Saigon Notre-Dame Basilica

![Molen preview](preview.png)

Individual medium-fi Saigon Notre-Dame Basilica: red-brick twin square front towers with pale metal pointed spires/dormers/crosses;three-portal front with rose and clock beneath stepped gable;long red-tile nave/low aisles and round-headed window rhythm;projecting rose-window transept;high polygonal choir and three lower rear apsidal chapels. Five existing shared256² graphs,six groups and four browser LODs. Retained exact-QID whole controls footprint/orientation;all heights,fine profiles and exact terrain/site joins estimated or unverified.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Saigon_Notre-Dame_Basilica.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Saigon_Notre-Dame_Basilica_Side.JPG)
- [Reference](https://commons.wikimedia.org/wiki/File:Saigon_Notre-Dame_Basilica_from_Lê_Duẩn_St.jpg)

Five existing shared256² running-bond brick,raw limestone,flat tile,painted metal and plain wood graphs;local blue-grey glazing;six groups. Pale shared painted metal abstracts spire cladding. Linear tints,metric UVs and flat normals;no embedded images,bespoke textures or baked lighting.

## Model and axes

18,845 triangles; 56,535 vertices; 6 material groups; 2,265,144 bytes. Native bounds: -44.930, -3.970, -17.251 to 45.300, 60.000, 17.140. Source hash: `sha256:8accc775decaef8695abcdfd377b2c22fc0d4b22f31868cf97d9541560cafc2e`.

{"x":"southeast toward twin-spire front and Paris Commune Square","y":"up","z":"southwest"}

Standard viewer DEM datum17.778270m;selected perimeter-3.62 to6.42m relative to it. Floor0.5m;adaptive masonry footings crossY=0 and extend below retained samples. Coarse terrain is not used to infer precise pavement,entry steps or curbs. Exact surrounding road/square,threshold/step/base contact,altitude and walking remain unverified. No flattening,cutout or road replacement.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0410` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact way/801950766 and Q428129 identify Saigon Notre-Dame Cathedral Basilica. Current standard viewer PMTiles whole35185174039598 retains all31 raw outline points and properties,alongside earlier whole/multilingual tags and named POI. Anchor[106.699018856,10.779803253] and heading−0.767176969891rad unchanged;no horizontal rescale. Native+X southeast twin-spire front toward Paris Commune Square/central statue,−X northwest triple rear apse toward Lê Duẩn Street,+Z southwest side. Three matching front,side and rear pictures resolve signed facing,approximate3°. Separate church-related/town buildings,post office,roads,square/statue,trees and vehicles remain host content.
- No architectural height tags or independently retained height facts. All vertical subdivisions are picture estimates above floor0.5m:low aisles/rear chapels9.6m with tile crowns12.9–14.4m;upper nave and polygonal choir walls21.3m/tile ridge28m;transept22.1m/ridge29m;central front cornice23.5m/stepped gable29.6m;brick tower bodies35.5m/pale metal square spires57m/crosses59.5m. Doors,round-headed paired windows,rose,clock,belfry louvres,pilasters,dormers and cornices are estimated. These are visualizations,not surveyed heights,restoration records or exact roof/floor datum.
- Standard viewer DEM datum17.778270m;selected perimeter-3.62 to6.42m relative to it. Floor0.5m;adaptive masonry footings crossY=0 and extend below retained samples. Coarse terrain is not used to infer precise pavement,entry steps or curbs. Exact surrounding road/square,threshold/step/base contact,altitude and walking remain unverified. No flattening,cutout or road replacement.
- Individual medium-fi exterior from three inspected matching pictures and standard viewer PMTiles/DEM. All heights,roof/bay/portal/cornice/clock/step/spire/dormer profiles are estimated or abstracted. Fine carving,clock numerals,window artwork,iron ridge fencing,interiors/bells,engineering,current restoration finish and exact surrounding roads/square/threshold/step/base contact remain simplified,excluded or unverified. Windows,doors and louvred belfry fields are recessed panes/timber;no open-interior or open-belfry claim. Square/statue,trees and separate town buildings remain host content. Synthetic Paris-mansard neighbors do not reproduce Saigon;physical phone/laptop timing unverified.
- Skyline retains twin pale square spires/crosses,brick tower pair,central gabled front,long tile nave,projecting transept and stepped rear apses. District adds shared textures,front rose/portals/clock,coarse round-window rhythm and paired belfry fields. Street adds full window rhythm,rose spokes,louvres,cornices/corner pilasters,dormer profiles and simple entry steps. Close-up/master refine arches and add restrained spire seam ribs.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
