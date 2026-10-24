# Abuja National Mosque

![Molen preview](preview.png)

Individual Abuja National Mosque exterior: mapped stepped square envelope with inward-battered warm stone facades,narrow dark recesses,an upper cross-shaped mass,broad golden central dome and small roof cupolas,four slender cream minarets with flared collars and pointed caps,a recessed-looking west entrance with brass doors and original coarse colored panels,and a low cusped parapet. The separate grounds buildings,boundary walls,landscaping,street,interiors,historic artwork,inscriptions and engineering are excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:National_Mosque_-_Abuja.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Main_entrance_to_the_Abuja_National_Mosque.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:AbujaNationalMosque.jpg)

Six existing shared256² sandstone,raw/weathered limestone,membrane,bronze and ceramic graphs;seven merged roles include local opaque glazing. Metric UVs and linear tints,no embedded images or unique atlas. Original coarse door/panel/roof abstractions;no historic inscriptions or mosaic artwork copied.

## Model and axes

4,962 triangles; 14,886 vertices; 7 material groups; 599,708 bytes. Native bounds: -36.400, -14.756, -41.870 to 42.165, 47.393, 39.216. Source hash: `sha256:acec79152a9bac13d03c713b87e1f3cc15873ec4ffa857ad8d6ac4732a40637c`.

{"x":"east","y":"up","z":"south"}

Standard Protomaps20261014/Mapzen-USGS viewer extractN0485;datum 498.1265962123871 m. 1244 occupied samples range -14.247668434609295 to 0.9322398987239922 m;floor -7.606917910409891 m is the median of 157 occupied-edge samples plus0.25 m. Five masks seat only the main hall and four corner bases,with an8 m fixture margin. No whole-site landscaping,roads,terraces or finished grades are surveyed.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=abuja_national_mosque` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained Q1430127 had only reference point[7.4925,9.060833333],no physical footprint and no dimensions. Current ordinary PMTiles supplies two Abuja National Mosque POIs;one shares the24-vertex main building id35184560926061. That named footprint and ten associated roof/minaret parts establish the current physical site,about305 m west of the old reference. The current named point fixes the model anchor;the old reference is retained verbatim. Cardinal axes and the west entrance are approximate visualization choices from map shape and inspected pictures.
- Current upper part retains min_height25/height30 m;roof retains min_height30/height40 m;four tower bases retain height6 m;two column parts retain height55 m and two have no height. The source uses the upper part25–30 m as a roof-zone envelope,roof top40 m and overall tower tips55 m above the local floor;the other two tower tips infer the same55 m. Lower hall top25 m,body batter,small cupolas,roof finial42 m,shaft/balcony/cap subdivisions and parapets are visual estimates. Map height datums are unspecified. The mapped roof min_height30 m is retained as a tag but is not treated as a surveyed spring:the pictured dome is reconstructed from an estimated27 m spring to its mapped40 m top. The upper drum/terrace subdivisions are estimates within the mapped roof-zone envelope.
- Standard Protomaps20261014/Mapzen-USGS viewer extractN0485;datum 498.1265962123871 m. 1244 occupied samples range -14.247668434609295 to 0.9322398987239922 m;floor -7.606917910409891 m is the median of 157 occupied-edge samples plus0.25 m. Five masks seat only the main hall and four corner bases,with an8 m fixture margin. No whole-site landscaping,roads,terraces or finished grades are surveyed.
- Two exterior pictures and an entrance detail guide appearance. Signed facing,facade batter,roof and minaret transitions,small cupolas and current condition remain approximate. Interiors,engineering and physical-device/full-city performance are unverified.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain.
