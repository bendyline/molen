# Masjid al-Qiblatain

![Molen preview](preview.png)

Individual medium-fi Masjid al-Qiblatain exterior: exact irregular main footprint, pale main dome and smaller western side dome, paired stepped square/octagonal minarets with projecting balconies and pointed caps, light roof cornices, open original diamond parapets and recessed pointed entrance/window rhythms. Internal plan, roof/tower centers and all heights are explicit picture estimates. Five existing shared 256² graphs serve six merged roles and four separate budgeted browser LODs. Newer surrounding decks, shade canopies, parking, garden, city, fine historic screen artwork and furnished interiors omitted.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Masjid_al-Qiblatain.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Mezquita_de_al-Qiblatayn,_Medina,_Arabia_Saudita,_2025-05-22,_DD_10-12_HDR.jpg)

Five existing shared 256² stucco, raw limestone, lime plaster, plain wood and cast bronze graphs serve six merged roles including local opaque blue-grey fields. Metric UVs, linear colors and zero embedded images, copied photographs, facade atlases or baked lighting. Parapet diamonds are original coarse geometry, not copied historic screen artwork.

## Model and axes

14,874 triangles; 44,622 vertices; 6 material groups; 1,788,640 bytes. Native bounds: -45.416, -4.763, -21.648 to 45.553, 40.831, 21.592. Source hash: `sha256:fb17d4aa0c916c225cfbc19a059af56251225e65b7e7639d18aae97611687fab`.

{"x":"east-northeast","y":"up","z":"south-southeast"}

Normal viewer DEM datum 609.4174649335225 m; working floor -1.1692176058288168 m is the median of 90 outside-perimeter samples at 1 m offset plus 0.3 m. 292 raw footprint samples span -4.2495680797585464..2.3436222551545143 m. Adaptive perimeter footings follow the raw main outline. Preview terrain seats that outline and a 1.5 m margin; paving covers the raw cutout. Exact road approach, entry steps, parking/deck levels and current terrain joins remain unverified.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0461` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact way 66510098 / Q2334553 is current viewer building 35184438598930. Original anchor and heading and all 15 current raw outer vertices retained; there are no mapped holes. Positive X approximately east-northeast, positive Z south-southeast. A lower western wing is partitioned at estimated local X=-14. The larger pale dome is estimated at [11,1], small side dome at [-20,1] and paired minarets at [-7.5,-12] / [27,-7.8]. These roof/tower centers and the division are picture-led visualizations within the map outline, not separate surveyed controls. No current or retained heights or independent roof/tower geometry exist. The older image camera coordinates are approximate and do not establish facade facing. Surrounding buildings, newer surrounding decks/parking and shade structures, palms, gardens, roads and city remain host content.
- No current or retained numeric heights or level counts are available. Picture-led visualization estimates above working floor: podium 1 m; west wing eaves 8 m; main hall eaves 10.8 m; main flat roof 11.2 m and parapet 12.6 m. Main dome drum 11.2–13 m, pale pointed cap to 21.4 m and finial 23 m; side dome base 8.2 m, cap to 12.2 m and finial 13.5 m. Twin minarets have square bases to 12 m, tapered octagonal shafts to 25 m, projecting balcony around 25–26.3 m, upper tiers to 34 m, smaller balcony and pale pointed cap/finial to 42 m. Every vertical dimension, window rhythm, parapet module, tier, balcony and dome profile is approximate. No engineering or furnished interior claim.
- Normal viewer DEM datum 609.4174649335225 m; working floor -1.1692176058288168 m is the median of 90 outside-perimeter samples at 1 m offset plus 0.3 m. 292 raw footprint samples span -4.2495680797585464..2.3436222551545143 m. Adaptive perimeter footings follow the raw main outline. Preview terrain seats that outline and a 1.5 m margin; paving covers the raw cutout. Exact road approach, entry steps, parking/deck levels and current terrain joins remain unverified.
- Individual medium-fi mosque exterior. No independent roof/tower controls or height tags. Exact raw footprint retained; internal hall/wing division, two dome centers, tower positions, facade facing, bays, ornament rhythm and every height are estimates. Pointed doors/panes close recesses; no furnished or free-walking interior claim. Fine calligraphy, exact historic interlacing, fixtures, palms, gardens, newer surrounding parking/decks and shade sails remain omitted. Coarse DEM fixture does not establish current thresholds, road grade or engineering. Physical-device timings remain pending.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.
