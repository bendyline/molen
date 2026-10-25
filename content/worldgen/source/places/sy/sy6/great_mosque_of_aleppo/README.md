# Great Mosque of Aleppo

![Molen preview](preview.png)

Individual medium-fi Great Mosque of Aleppo exterior from four inspected2009 pictures:banded square stone minaret/open timber crown and shallow pyramidal cap,rectangular court with three pointed arcades,tall closed timber prayer-facade fields/raised dark-patterned portal,grey prayer roof dome,two independent domed column pavilions and broad original court paving bands. Five existing shared256² graphs,at most seven merged groups,four authored budgeted browser levels. Current six-point outer/four-point court controls retain exact plan;all untagged heights and landmark component plans are explicit picture estimates. Historical exterior approximation;current restoration state,unseen roofs/interiors and precise terrain contacts unverified.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Aleppo_Great_Mosque_front_at_courtyard_8991.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Aleppo_Great_Mosque_courtyard_9204.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Aleppo_Great_Mosque_minaret_from_courtyard_8973.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Aleppo_Great_Mosque_courtyard_9203.jpg)

Five existing shared256² ashlar,limestone,standing-seam metal,plain wood and mosaic graphs;seven or fewer merged groups. Pale stone,grey domes,warm timber and sparse dark portal bands use linear vertex tints/metric UVs. Zero embedded images,baked lighting/weathering or copied calligraphy/carvings. Court stripes are a broad original abstraction.

## Model and axes

11,949 triangles; 35,847 vertices; 7 material groups; 1,438,120 bytes. Native bounds: -50.520, -0.350, -39.628 to 50.604, 47.385, 39.673. Source hash: `sha256:a9ac3199639ee0065d7e25dfefc7fcb1a38ba368fead48d4c2cec43515b27a00`.

{"x":"approximately east,opposite west court arcade","y":"up","z":"south/model prayer range,opposite north arcade and estimated northwest minaret"}

Standard viewer DEM datum389.814833m;whole perimeter0.08..2.09m relative to anchor. Working floor2.385m uses maximum bilinear core sample at2m spacing plus0.3m. Raw DEM retained without cutout/flattening;footings extend below it and crossY=0. Paving stays inside whole footprint. This clearance plane is not surveyed paving;exact altitude,street/threshold/terrain joins and walking remain unverified.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=great_mosque_of_aleppo` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact relation/71855 /Q1481968 matches current standard PMTiles whole52776558205103 (3*2^44+71855). Current single building control has six outer vertices/four court vertices,no tagged height or minaret component. Earlier six-vertex outer/four-vertex court retained separately. Anchor[37.156906549,36.199308821] and heading0.017131698562rad unchanged,no horizontal rescale. Native+X approximately east,+Z south/model prayer range;minaret is estimated at the northwest court corner. Arcades follow actual current courtyard edges. Main portal,dome,pavilions,minaret and facade facing are picture estimates,not extra mapped controls. Neighbouring souks,streets and other city buildings remain host content.
- Retained height/width/length fact arrays and the current PMTiles building height tags are empty. Working exterior heights are picture-based estimates:arcade/outer eaves7.8m,main range9.2m,raised prayer portal10.5m,main roof dome17m and square minaret45m including finial. Large/small courtyard pavilions8.4m/6.4m. Minaret shaft5.1m across and decorative stage heights,roof/pavilion profiles/openings are estimates within about3m/5m vertically and facing about4°. These are working visualization dimensions,not measured or independently documented heights. Four inspected2009 photographs establish a historical exterior;present damage/reconstruction/finish and engineering remain unverified.
- Standard viewer DEM datum389.814833m;whole perimeter0.08..2.09m relative to anchor. Working floor2.385m uses maximum bilinear core sample at2m spacing plus0.3m. Raw DEM retained without cutout/flattening;footings extend below it and crossY=0. Paving stays inside whole footprint. This clearance plane is not surveyed paving;exact altitude,street/threshold/terrain joins and walking remain unverified.
- Historical2009 exterior approximation. Current damage/reconstruction/finish state unverified. Main/minaret/pavilion heights and placements are picture estimates;no current map component heights or surveyed component plans. Three courtyard arcades and pavilion/top-minaret stages are exterior voids;main timber fields and minaret niches close before interiors. Skyline opens eleven coarse arcade bays and uses closed prayer-facade proxies/four pavilion posts;district opens26 bays,near levels restore33-bay rhythm/selected trim/brackets. Fine inscriptions,carved stone screens,paving motifs,rails/wires/signage/fixtures and unseen rooms/stairs omitted or unverified. Adjacent souks/city/streets remain host content. Exact altitude/street/threshold/terrain contact,free walking,engineering and physical-device timing unverified.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
