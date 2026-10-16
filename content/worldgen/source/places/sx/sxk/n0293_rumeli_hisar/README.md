# Rumeli Hisarı

![Molen preview](shots/shared/angle-0.png)

Three stepped roofless towers over a sloping narrow enclosure: cylindrical Saruca and Zağanos,12-sided seaward Halil lower body, ten mapped minor bastions, estimated square forecourt defenses, real masonry gates, selected slits and a mapped mosque with tiled hip roof.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://api.openstreetmap.org/api/0.6/map?bbox=29.0538,41.0834,29.0578,41.0863)
- [Reference](https://turkishmuseums.kprod.kultur.gov.tr/museum/detail/2077-istanbul-rumeli-hisari/2077/1)
- [Reference](https://goturkiye.com/istanbul/rumeli-fortress)
- [Reference](https://www.turkishmuseums.com/Uploads/Müze/Foto/Fotoğraflar/35c0ee5a-ca31-4568-afc7-8721028ae56a.jpg)
- [Reference](https://www.turkishmuseums.com/Uploads/Müze/Foto/Fotoğraflar/4cd7cb2b-1c19-4c0b-9dae-4ab7189af351.jpg)
- [Reference](https://www.turkishmuseums.com/Uploads/Müze/Foto/Fotoğraflar/67f5bbde-8a55-4024-83d8-fd77912a2e59.jpg)
- [Reference](https://www.turkishmuseums.com/Uploads/Müze/Foto/Fotoğraflar/8b2c4eaf-ce01-473c-9b9e-c580ef96f665.jpg)
- [Reference](https://www.turkishmuseums.com/Uploads/Müze/Foto/Fotoğraflar/93ca2761-bf5c-4566-8ce8-6c947d8e7b72.jpg)
- [Reference](https://www.turkishmuseums.com/Uploads/Müze/Foto/Fotoğraflar/95131563-de5d-4443-9d3d-c1a6c7157ac2.jpg)
- [Reference](https://www.turkishmuseums.com/Uploads/Müze/Foto/Fotoğraflar/98cfd614-24ed-4e48-a884-52127cf3695c.jpg)
- [Reference](https://www.turkishmuseums.com/Uploads/Müze/Foto/Fotoğraflar/a0d4e764-2bc4-43d6-bf16-ae5c3011eb26.jpg)
- [Reference](https://www.turkishmuseums.com/Uploads/Müze/Foto/Fotoğraflar/b6cca14f-f14f-4f2f-918c-933e8b5621f4.jpg)
- [Reference](https://www.turkishmuseums.com/Uploads/Müze/Foto/Fotoğraflar/b92c1dca-bcca-4610-ad95-328c637d6c19.jpg)
- [Reference](https://www.turkishmuseums.com/Uploads/Müze/Foto/Fotoğraflar/bb6f6995-a1ab-45d2-a97b-23d13ceec39c.jpg)
- [Reference](https://cdn2.goturkiye.com/istanbul-ci-1-rumeli-fortress-1400x788.jpg?2026-04-10T19%3A43%3A05.956Z)
- [Reference](https://isprs-archives.copernicus.org/articles/XLII-2-W9/723/2019/)
- [Reference](https://s3.amazonaws.com/elevation-tiles-prod/terrarium/14/9514/6137.png)

Four existing shared material graphs with metric UVs; no embedded/new images or imported third-party mesh. Cropped coarse terrain, original pads and exact East/South map frame are source controls,not proof of real host placement.

## Model and axes

15,360 triangles; 46,080 vertices; 4 material groups; 1,846,108 bytes. Native bounds: -68.334, -12.849, -128.638 to 71.250, 49.754, 121.494. Source hash: `sha256:2f30ffb0b1c3596adf69d0840150492fcf4e990cb2a574695e66ad722ac0ab7f`.

{"up":"+Y","longitudinal":"+Z south","front":"+X east toward Bosphorus","origin":"Site anchor; Y0 standard PMTiles working datum."}

Inspected exterior tower picture confirms stepped roofless masonry crowns by the Bosphorus; the second picture informs stone/brick appearance only, with its interior excluded. Retained east/south wall, tower and courtyard geometry and standard viewer PMTiles set approximate location, scale and seaward orientation. The derivative omits the duplicated terrain patch, uses the same PMTiles sampler for all wall/tower-footing LODs and translates the old study datum to the21.351156683452786m PMTiles anchor datum. Tower floor pads retain a level rim above sampled coarse ground with bounded footings reaching it. Anchor 29.056189597,41.084874691; heading 0; standard PMTiles datum 21.351156683452786m. Floors are reconstructed and foundations extend below the coarse sampled ground.

## Reproduce

Run `node packages/worldgen/scripts/generate-signature-towers.mjs --ids=N0293` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Approximate current exterior and fit from inspected pictures and standard viewer PMTiles; no bespoke survey or exact thresholds.
- Detailed original master/hash/recipe preserved. Roofless towers, forecourt and mosque are an exterior interpretation; ongoing restoration and visitor fixtures are not exhaustively reconstructed.
- Four common graphs plus explicit color slot, zero embedded images. Terrain comes from the host; interiors, waterline/simulation, vegetation and terrain cutouts excluded.
- Footprint replacement remains off; physical-device timing unmeasured.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

© OpenStreetMap contributors;Turkish Museums;Türkiye Tourism Promotion and Development Agency;Mapzen/NASA/USGS.
