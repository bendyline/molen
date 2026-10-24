# Wawel Castle

![Molen preview](shots/shared/angle-0.png)

Current Wawel royal palace with open irregular Renaissance courtyard, two arcaded gallery tiers and tall upper columns, steep red roofs, two copper Baroque corner helms, eastern Danish/Jordanka projections, adjacent brick Senator tower and physically open Berrecci gate.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://api.openstreetmap.org/api/0.6/map?bbox=19.9319,50.0520,19.9385,50.0565)
- [Reference](https://wawel.krakow.pl/en/information-about-museum)
- [Reference](https://wawel.krakow.pl/en/exhibition-constant/viewing-platform/arcaded-galleries)
- [Reference](https://wawel.krakow.pl/en/architectural-accessibility)
- [Reference](https://www.krakow.pl/odwiedz_krakow/1461,artykul,zamek_krolewski_na_wawelu.html)
- [Reference](https://wawel.krakow.pl/en/exhibition-constant/viewing-platform/viewing-platform)
- [Reference](https://wawel.krakow.pl/media/galleryimage/photoPath/original/crop-g3a9663.jpg)
- [Reference](https://wawel.krakow.pl/media/galleryimage/photoPath/original/crop-dia05227.jpg)
- [Reference](https://wawel.krakow.pl/media/galleryimage/photoPath/original/crop-dia06889-2.jpg)
- [Reference](https://wawel.krakow.pl/media/galleryimage/photoPath/original/crop-092.jpg)
- [Reference](https://wawel.krakow.pl/media/galleryimage/photoPath/original/crop-mg-2580.jpg)
- [Reference](https://wawel.krakow.pl/media/galleryimage/photoPath/original/crop-0605-ii.jpg)
- [Reference](https://plikimpi.krakow.pl/zalacznik/396678/4.jpg)
- [Reference](https://wawel.krakow.pl/media/exhibitionpageslide/photoPath/original/nowa-baszta.jpg)

Six existing shared 256-square graphs, linear tints and central metric UV repeats. Flat glass. No embedded/new image, photo texture, downloaded model or traced printed drawing.

## Model and axes

23,061 triangles; 69,183 vertices; 7 material groups; 2,771,520 bytes. Native bounds: -69.008, -9.277, -67.400 to 63.862, 37.550, 64.550. Source hash: `sha256:d64a83cf5b14811c835793ad8808a37da26f2bf1eb7bab825c69d038262c075f`.

{"up":"+Y","front":"West Berrecci entry; native +X east and +Z south","longitudinal":"+Z along eastern palace wing; coordinates bake all footprint angles","origin":"Site anchor; Y0 standard PMTiles working datum."}

The inspected courtyard pictures support two arcaded gallery levels, a taller upper colonnade, pale masonry and steep tiled roof groups. Retained east/south palace and tower map controls set approximate location, scale and orientation. Standard viewer PMTiles supply the surrounding hill; the derivative translates the old study-6m, retains the reconstructed courtyard floorY2.35 and extends palace/tower wall toes to coarse sampled ground. This is the palace asset, not every independent landmark on Wawel hill. Anchor 19.9366,50.0544; heading 0; standard PMTiles datum 230.8644554645171m. Floors are reconstructed and foundations extend below the coarse sampled ground.

## Reproduce

Run `node packages/worldgen/scripts/generate-signature-towers.mjs --ids=wawel_castle` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Approximate palace exterior and fit from inspected courtyard pictures and standard viewer PMTiles; no bespoke survey or exact thresholds.
- Detailed original master/hash/recipe preserved. Gallery/roof details and reconstructed floors are interpreted; cathedral, other hill buildings, full interiors and collision excluded.
- Six common graphs plus explicit glass color slot, zero embedded images. Host terrain supplies the surrounding hill; no terrain cutout or river simulation.
- Footprint replacement remains off; physical-device timing unmeasured.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

© OpenStreetMap contributors; Wawel Royal Castle; City of Kraków.
