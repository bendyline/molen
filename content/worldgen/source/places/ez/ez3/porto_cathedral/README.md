# Porto Cathedral

![Molen preview](preview.png)

Individual Porto Cathedral medium-fi exterior: granite fortress twin towers with domed caps/corner pinnacles, large west rose and layered portal, crenellated buttressed nave/transepts and red-tiled choir. North baroque loggia has open round arcades/blue-white tile abstractions. Immediate mapped Gothic cloister/Casa do Cabido ranges retain open courtyard and pointed arcade rhythm. Shared surfaces and four browser LODs. Separate bishop palace, exact narrative azulejos/sculpture, full interiors and surveyed terrace/stair engineering excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:PortoView.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Porto.Cathedral01.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Nt-se_do_porto2.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:PortoCathedral1.jpg)

Five existing shared256-square ashlar,granite,ceramic roof tile,plain wood and glazed tile graphs serve six material groups. Metric UVs,linear tints,flat normals,local blue-grey glazing.No embedded images,bespoke photograph textures or baked lighting.Blue-white tile panels are generic surface abstractions,not copies of narrative azulejos.

## Model and axes

11,673 triangles; 35,019 vertices; 6 material groups; 1,404,456 bytes. Native bounds: -35.500, -5.200, -19.000 to 34.150, 37.500, 45.578. Source hash: `sha256:dcb5d3487564bc675b524402f6d318b8ff8ca876544e16b5c752363993fe4e54`.

{"x":"east toward choir","y":"up","z":"south toward cloister courtyard"}

Standard viewer DEM datum 70.919308m; selected raw perimeter -4.85..2.36m. Floor0.5m and adaptive footings crossY=0. Exact hilltop terraces, square/door/step/base joins, absolute altitude and walking remain unverified. Raw DEM is retained without terrain cutout or flattening.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=porto_cathedral` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Exact retained way/210461448 and Q1441255 match current cathedral whole35184582550280 and its same-ID Sé do Porto POI. Preserve the raw whole, mapped architectural parts and immediate cloister/Casa do Cabido ranges. Anchor and heading0.027014727523rad unchanged. +X east toward choir, -X west twin-tower/rose facade, -Z north baroque loggia, +Z south cloister courtyard. No horizontal rescale. Separate southeastern bishop palace and neighboring buildings remain host content.
- Mapped part maxima retained: twin tower bodies31m and caps37m, central crossing26m, choir23m, nave/transept21m, side aisles16m, buttresses20m, north loggia9m, northeast round chapel13m and low north flank9m. Cloister10m, east range13m, west chapter range19m, south ranges17/20/11m. All roof eaves, stage divisions, dome/finial profiles, opening sizes, crenellations, porch steps and carved details are picture estimates within those mapped heights. Floor0.5m above local standard DEM datum; mapped heights are treated above that estimated attachment plane. No independent height/width/length facts.
- Standard viewer DEM datum 70.919308m; selected raw perimeter -4.85..2.36m. Floor0.5m and adaptive footings crossY=0. Exact hilltop terraces, square/door/step/base joins, absolute altitude and walking remain unverified. Raw DEM is retained without terrain cutout or flattening.
- Medium-fi exterior based on four inspected pictures and standard viewer PMTiles/DEM. Roof and opening divisions,domes,portal sculpture and tile scenes simplified or estimated.Full interior,liturgical sculpture,exact narrative azulejos,engineering,hidden roof joins,current finish,terrace/door/step ground fit and physical phone/laptop timing unverified or excluded.Synthetic Mediterranean neighbors are style fixtures,not reconstructed Porto streets.
- Skyline retains twin capped towers,rose facade,long nave/transepts,low north gallery and open cloister court.District adds belfry openings,rose spokes,portal/loggia rhythm and crenellations.Street adds recessed lights and cloister arcades.Close-up/master add selected court tracery and parapet details.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
