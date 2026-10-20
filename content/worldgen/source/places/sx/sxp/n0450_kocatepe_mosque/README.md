# Kocatepe Mosque

![Molen preview](preview.png)

Individual medium-fi Kocatepe Mosque and mapped raised platform: windowed main dome/four cascading semi-domes/corner caps, four three-balcony minarets, open pointed courtyard with low basin,side loggia/raised doors and stairs,mapped eastern annex and open Bankacı tunnel passage. Nine raw current map controls and two tagged tunnel centre-lines retained. Main vertical partitions,curved roofs,arcade/bay counts,unmapped small details,annex function and precise ground joins remain estimates. Six existing shared graphs,seven merged roles,four browser levels. Current finish,temporary courtyard cover,fine artwork,basement shops and unseen interiors remain limited.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Ankara_asv2021-10_img41_Kocatepe_Mosque.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Kocatepe_Camii,_Ankara_01.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Ankara_Kocatepe_Mosque_Exterior_in_2018_12.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Ankara_Kocatepe_Mosque_Courtyard_in_2018_13.jpg)

Six existing shared256² limestone,continuous limestone,standing-seam metal,plain wood,cast bronze and plain concrete graphs;seven merged roles including local opaque glazing. Metric UVs,linear tints,faceted architecture;zero embedded images,unique atlases,copied calligraphy or baked lighting.

## Model and axes

48,621 triangles; 145,863 vertices; 7 material groups; 5,838,792 bytes. Native bounds: -74.220, -8.878, -54.579 to 90.881, 91.383, 153.068. Source hash: `sha256:bfdd0fb26e34381316125f00f78af577fff2dd406592ad6eef2c6b35c24c1465`.

{"x":"SSE prayer hall;negative NNW courtyard","y":"up","z":"WSW public side loggia"}

Standard viewer DEM datum907.8431686498072m. Platform/court plane2.483275388141692m is the median of256 outside-perimeter samples every3m at1m offset plus the mapped5m platform height. Raw platform samples range-8.47059724090093..4.2058253506558m. The foundation follows raw boundary heights;the preview seats terrain under the mapped platform. Two tagged Bankacı tunnel centre-lines retain raw geometry;7m carriageway widths and4.8m clearance are visualization estimates. The tunnel floor follows the retained DEM,with open side portals and no replacement of host roads. This approximates a raised terrace on a coarse hillside DEM;exact road thresholds,stairs,retaining heights and street joins remain unverified.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0450` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact OSM relation6276462 / Q853935 is the current standard viewer whole52776564409710 with its open courtyard. Current platform35184794287588 has a5m height tag; hall/dome parts and four circular minaret parts provide separate controls. The small eastern hexagonal annex is retained as a mapped ancillary mass with unverified function. All nine current controls and raw properties remain unchanged. PositiveX follows the main prayer hall toward SSE,negativeX the NNW courtyard,and positiveZ the WSW public side loggia. Original anchor/heading retained;no horizontal rescale. Current map tags omit QID on the tile geometry,so relation ID continuity and retained exact identity remain distinct from tile properties.
- The retained identity has no linked height/width/length facts. The lower platform5m tag is retained separately from all estimated architectural heights. Picture-proportioned exterior: hall walls15m; main dome drum31.5–37m with11.5m cap and1.5m finial; four cascading large/small semi-domes,corner caps/buttress turrets; four minarets with three balconies and estimated88.9m tips. Courtyard arcades/roof domes,side loggia,door/step positions,low courtyard basin/caged cap,eastern annex,parapets and fine profiles are estimates. The courtyard picture shows temporary overhead construction framing;it is omitted and present cover/finish remain unverified. Inscriptions,fine stonework,lattice,interiors,basement shops and exact engineering are not reconstructed.
- Standard viewer DEM datum907.8431686498072m. Platform/court plane2.483275388141692m is the median of256 outside-perimeter samples every3m at1m offset plus the mapped5m platform height. Raw platform samples range-8.47059724090093..4.2058253506558m. The foundation follows raw boundary heights;the preview seats terrain under the mapped platform. Two tagged Bankacı tunnel centre-lines retain raw geometry;7m carriageway widths and4.8m clearance are visualization estimates. The tunnel floor follows the retained DEM,with open side portals and no replacement of host roads. This approximates a raised terrace on a coarse hillside DEM;exact road thresholds,stairs,retaining heights and street joins remain unverified.
- Current raw whole,court,dome,minaret,platform and tagged tunnel geometries are retained separately from estimated reconstruction. Most height/room/roof partitions,bay counts,window patterns,side stairs,basin lattice,annex function and exact tunnel width/clearance are picture/layout estimates. Fine inscriptions,ornament,temporary construction framing,basement shops and unseen interiors are omitted. Original anchor/heading and map scale retained;exact ground/road/step joins,current finish,engineering and physical-device timings remain unverified.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
