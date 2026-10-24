# Nuremberg Castle

![Molen preview](shots/shared/angle-0.png)

Three adjoining castle precincts: cylindrical Sinwell with flared observation floor and pointed Renaissance helm,Palas/Kemenate/double chapel/Heidenturm around open court,half-timbered forecourt ranges and well,Hasenburg and three physical passages,Walburgis/Pentagonal Tower,eastern Kaiserstallung with tiered dormers and Luginsland corner oriels,mapped bastions and original schematic gardens.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://api.openstreetmap.org/api/0.6/map?bbox=11.0712,49.4567,11.0801,49.4601)
- [Reference](https://www.kaiserburg-nuernberg.de/englisch/castle/plan.htm)
- [Reference](https://www.kaiserburg-nuernberg.de/englisch/castle/sinwell.htm)
- [Reference](https://www.kaiserburg-nuernberg.de/englisch/castle/palas.htm)
- [Reference](https://www.kaiserburg-nuernberg.de/englisch/castle/bower.htm)
- [Reference](https://www.kaiserburg-nuernberg.de/bilder/burg/plaene/gesamtplan_dt.pdf)
- [Reference](https://www.nuernberg.de/internet/stadtportal/nh_kaiserburg.html)
- [Reference](https://www.nuernberg.de/imperia/md/stadtportal/dokumente/nh98_burg.pdf)
- [Reference](https://www.kaiserburg-nuernberg.de/bilder/burg/brunnenhaus-sinwell-slider/luftbild_www.kreativ-instinkt.de_DI026142-575.jpg)
- [Reference](https://www.kaiserburg-nuernberg.de/bilder/burg/brunnenhaus-sinwell-slider/vorhof_DI020537-575.jpg)
- [Reference](https://www.kaiserburg-nuernberg.de/bilder/burg/brunnenhaus-sinwell-slider/brunnenhaus-sinwellturm_socialmedia-575.jpg)
- [Reference](https://www.kaiserburg-nuernberg.de/bilder/burg/brunnenhaus-sinwell-slider/brunnenhaus_DI020982-575.jpg)
- [Reference](https://www.kaiserburg-nuernberg.de/bilder/burg/modell_nuernberg575a.jpg)

Six existing256-square shared graphs with linear tints and central metric UV repeats; flat glass/grass. No embedded/new image,photo texture,downloaded model or traced printed drawing. Roofs clip to actual footprints and courts remain physically open.

## Model and axes

8,168 triangles; 24,504 vertices; 7 material groups; 984,248 bytes. Native bounds: -144.420, -14.147, -84.781 to 212.824, 45.952, 77.690. Source hash: `sha256:984ff94c7f3a2738254c5f4fbd58cd7f392a1548ab362b33c9c233580e4ec6fe`.

{"up":"+Y","front":"South-facing city prospect with Palas/double chapel and Sinwell in native East/South coordinates","longitudinal":"+X east along castle complex","origin":"Site anchor; Y0 standard PMTiles working datum."}

The inspected aerial picture supports Sinwell's cylindrical body/capped roof, square towers, open court, red tiled roof groups and timber/plaster wings. Retained east/south map geometry sets approximate extent and orientation. Standard viewer PMTiles supply surrounding ground; the old study is translated-15m, lower reconstructed building/tower floors are raised only as needed above sampled coarse terrain, terrace toes reach it and the outer approach joins its sampled endpoint. Original detailed master remains preserved. Anchor 11.0753908,49.4580789; heading 0; standard PMTiles datum 337.1664037330291m. Floors are reconstructed and foundations extend below the coarse sampled ground.

## Reproduce

Run `node packages/worldgen/scripts/generate-signature-towers.mjs --ids=nuremberg_castle` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Approximate exterior and fit from inspected picture and standard viewer PMTiles; no bespoke survey or exact thresholds.
- Detailed original master/hash/recipe preserved. Building floors, terrace/ruin detail, roof partitioning and restoration fixtures are interpreted; interiors and collision excluded.
- Five common graphs plus explicit glass/foliage color slots; zero embedded images. Bounded courts/gardens/terraces retained, surrounding hill supplied by host.
- Footprint replacement remains off; physical-device timing unmeasured.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

© OpenStreetMap contributors; Bayerische Schlösserverwaltung; Stadt Nürnberg; Mapzen/SRTM, NASA/USGS.
