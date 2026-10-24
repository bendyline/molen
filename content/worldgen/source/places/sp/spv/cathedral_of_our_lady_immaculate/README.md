# Cathedral of Our Lady Immaculate

![Molen preview](preview.png)

Individual Monaco Cathedral:pale coursed Romanesque front with three deep round porches/wood portals,paired two-stage columns,central wheel rose/three lights,clustered round upper windows,blind arcades,shaped gables/abstract relief and finials. Red-tiled nave/aisles,gabled transepts with round doorway/window tiers,scalloped rear ambulatory/rounded high apse,broad east chapel,paired flat-capped rear open belfries and octagonal crossing lantern;front rounded corner chapel/stair and gray-roof polygonal turret. Four existing shared stone/continuous limestone/tile/wood graphs,metric UVs,linear tints and four browser levels. Fine sculpture/heraldry/tracery,hidden rear details/interiors and precise ground joins are approximate or excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Monaco_Cath%C3%A9drale_Notre-Dame-de-l%27Immacul%C3%A9e-Concepcion_Ext%C3%A9rieure_Facade_1.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Monaco_Cath%C3%A9drale_Notre-Dame-de-l%27Immacul%C3%A9e-Concepcion_Ext%C3%A9rieure_Face_Ouest_3.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Monaco_-_panoramio_(168).jpg)

Four existing cached256-square coursed limestone,continuous limestone,flat tile and plain-wood graphs serve six merged groups. Linear pale stone/red tile/wood tints,metric UVs,flat architectural normals and geometric PBR glass/stone accents. No embedded images,unique facade maps or baked shadows.

## Model and axes

42,641 triangles; 127,923 vertices; 6 material groups; 5,120,572 bytes. Native bounds: -42.050, -18.625, -18.433 to 38.826, 38.000, 22.749. Source hash: `sha256:7b6c0a029638f1310409c99d1c9ec77fd87abc0007ad869d875acaa7a4d4aeb5`.

{"x":"northward from southern three-porch front toward scalloped apse","y":"up","z":"eastward toward broad rounded side chapel"}

Standard viewer DEM datum58.459324m;display floor1.5m,raw whole perimeter-16.53..9.98m. About26.5m slope crosses the building;raw samples remain retained. Source review uses an explicitly estimated local0.4m plaza grade within the footprint plus8m and a16m blend beyond it;this diagnostic fixture is not applied to host terrain. Runtime terrain-contact remains anchored to the coarse DEM;front skirt exposure/rear base clipping,exact street/door joins,absolute altitude and walking are unverified. Footings extend below raw samples. No global flattening or road replacement.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=cathedral_of_our_lady_immaculate` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact-QID OSM way362871296/Q667450 matches current main35184734960128. Current71-vertex whole differs from earlier109-vertex retained control;no independent components or map height/min_height/measured-height facts are supplied. All current raw vertices/tags reproduce rigidly without rescale. Signed long nave edge corrects older minimum-rectangle heading1.389590982208rad by6.887668degrees to1.5098034602171353rad: native-X south front versus+X northern scalloped apse. Original multilingual identity/control remain verbatim. Internal Boolean front/nave/aisles/transepts/choir/apse/chapel partitions and tower/lantern/turret positions are picture estimates. Heights are estimated:front wall26.5m/gabled crown32.5m,raised central crown34.5m/abstract tip36.5m;nave18/24m,aisles10.5/13m,transepts24/28.5m,choir/apse18/24m,ambulatory10.5/13m,broad east-side chapel15.2/18.5m. Rear paired square towers have lower paired arched fields24..28m and four open upper arches30..34.5m,flat red caps35m/tip36m;central octagonal lantern24..29m/shallow tiled cap31m. Rounded front corner/stair8.5m and small gray polygonal turret11.5/14m. Three deep round front porches/wood doors,rose/three lights,round gallery/side window rhythm and relief/finials are simplified. No survey/engineering accuracy claimed.
- Standard viewer DEM datum58.459324m;display floor1.5m,raw whole perimeter-16.53..9.98m. About26.5m slope crosses the building;raw samples remain retained. Source review uses an explicitly estimated local0.4m plaza grade within the footprint plus8m and a16m blend beyond it;this diagnostic fixture is not applied to host terrain. Runtime terrain-contact remains anchored to the coarse DEM;front skirt exposure/rear base clipping,exact street/door joins,absolute altitude and walking are unverified. Footings extend below raw samples. No global flattening or road replacement.
- Medium-fi exterior from three inspected2015/2021 front and west-transept pictures plus standard viewer PMTiles/DEM only. All heights/internal partitions,opposite/hidden rear/roof/tower details and minor chapel functions are estimates. Wheel rose/tracery,abstract relief/figures,porch carving,roof decoration,full interiors and exact paving/street thresholds are simplified or excluded. Physical phone/laptop timings pending.
- Source preview includes a bounded estimated plaza grade to show the exterior on noisy coarse coastal terrain;it does not alter host DEM. Runtime front skirt exposure/rear clipping and exact terrain/door contact remain unverified.
- Skyline retains three-porch front silhouette,red roofs,rounded rear/side forms,paired low tower caps and octagonal lantern;small windows/recesses omitted. District adds shared surfaces,flat glazing/doors,actual porch recesses/open belfries. Street adds major recessed body glazing/deep portals,flat small fields,rose spokes and columns/cornices;closeup/master add the small recesses,shallow blind arcades,abstract relief/figures and finer frames. Synthetic cottages are fixtures.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
