# Cathedral of Magdeburg

![Molen preview](preview.png)

Individual medium-fi Magdeburg Cathedral and attached cloister/chapter complex:western twin square/octagonal open-belfry towers/stone cones,central clock gable/portal,tall nave/transept/polygonal choir,aisle gables and buttresses,radiating chapels,eastern unfinished towers/crossing turret and mapped cloister galleries/ranges with open court. Exact sculptural/tracery/inscription detail,full interiors and certified walking excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Magdeburger_Dom_Luftbild_Westseite_2.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:MD_Dom_7h15_Chor_v_ONO_90005.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:MD_Dom981Langhaus_v._Kreuzgang.JPG)

Five existing 256-square raw limestone,slate,copper,granite and plain wood graphs. Warm stone walls/pale trim,gray slate roofs,restrained green-gray copper ledges and flat blue-gray glazing. Metric UVs,hard architectural normals,no embedded images. Stone spire cones use limestone with a muted gray tint;no baked age/soot.

## Model and axes

19,807 triangles; 59,421 vertices; 8 material groups; 2,381,552 bytes. Native bounds: -60.461, -3.125, -29.572 to 70.873, 101.800, 78.506. Source hash: `sha256:a8c115f483709781427c343305167cb6ede43a942294f4485c14d2d70a3e54d8`.

{"x":"east toward polygonal choir","y":"up","z":"south toward cloister"}

Standard DEM datum 57.575970m;estimated common floor 2.8m clears sampled compound peak 2.419m and perimeter -2.77..2.41m. Foundations follow coarse terrain. Exact court/street/door thresholds,absolute altitude and certified walking unverified;no independent survey.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=cathedral_of_magdeburg` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact-QID OSM way22993770 matches current main PMTiles feature35184395082602 by way-ID offset. Main/cloister and35 current parts retain unscaled plans/tags. Current western square blocks68m,central west part66m,upper belfry/spire parts68..99m,nave/transept/high choir42m,east flank towers32m and crossing turret54m control silhouette. Retained unqualified104m height fact conflicts with current99m parts;use current99m overall top and record uncertainty. Other tags and all wall/eave/cone/belfry/gable/roof subdivisions are picture-led interpretations. Lower aisle17m tag is used as eave with estimated23m gable tips.
- Standard DEM datum 57.575970m;estimated common floor 2.8m clears sampled compound peak 2.419m and perimeter -2.77..2.41m. Foundations follow coarse terrain. Exact court/street/door thresholds,absolute altitude and certified walking unverified;no independent survey.
- Medium-fi exterior from three useful exterior pictures and standard PMTiles/DEM. Exact twin-tower height inequality,wall/eave/roof/belfry/cone subdivisions,windows/doors/tracery,pinnacles,clock and arcade rhythm are estimated. Current 99m tower parts differ from retained unqualified 104m fact. Adjacent cloister/chapter massing retains current plans;peripheral facades/functions are not independently verified. Exact statues,inscriptions,clock numerals,full interiors and certified walking excluded. Absolute altitude/thresholds and physical device timings pending.
- Skyline keeps individual primary masses,coarse stone cones,four-post rectangular open western belfries and sparse gallery posts;aisle roofs use simple slopes and cloister ranges use flat roof masses. Two small overlapping peripheral masses are omitted;gallery floors use terrain. Its 6.5m error allowance reflects these roof/secondary-mass changes. District adds shared surfaces,flat facade fields,octagonal round-arched belfries,aisle gable rhythm,clock and pointed court arcades. Street opens major facade recesses and adds sparse mullions/pinnacles;closeup/master refine curved aperture/cone/trim detail and abstract crockets. Peripheral range fields remain shallow. Curvature,openings,aisle roof silhouette and ornament change visibly. Swedish-cottage context is synthetic,not local map buildings.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
