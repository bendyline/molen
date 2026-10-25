# Koutoubia Mosque

![Molen preview](preview.png)

Individual medium-fi Koutoubia mosque exterior:original mapped compound with two unfilled courts,parallel brown nave roofs,transverse raised bays,ochre walls/selected horseshoe doors,pale inner arcade,and tall square minaret with different facade fields,green tile bands,pointed parapet crest,smaller lantern,ribbed ochre cap and globe finial. Seven existing shared256² graphs,seven merged roles,four authored browser levels. Exact roof details,carvings,room plans,current condition and walking remain approximate or unverified.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Koutoubia_minaret_DSCF8275.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Kutubiyya_Mosque_from_a_different_angle.jpg)
- [Reference](https://www.visitmorocco.com/fr/node/2049)

Seven existing shared256² sandstone,limestone,lime plaster,fired clay,mosaic tile,plain wood and cast bronze graphs;seven merged roles,metric UVs,linear tints. Brown roofs,ochre masonry,pale court arcade,muted green friezes and original sparse relief. No embedded images,unique atlas,baked lighting or copied carvings/calligraphy.

## Model and axes

10,036 triangles; 30,108 vertices; 7 material groups; 1,208,652 bytes. Native bounds: -47.156, -0.744, -33.041 to 47.278, 77.318, 38.175. Source hash: `sha256:6487e616f979da9674b03e3c1627fafb2c5488472440398f66f656c03f3b79cd`.

{"x":"toward eastern tower side","y":"up","z":"negative toward tower/court front;positive toward transverse rear range"}

Standard viewer DEM datum465.550273m. Hall and tower floors use independent maximum2m/vertex samples plus0.25m:hall:2.846627m (1196samples,-0.531..2.597); tower:0.818348m (48samples,-0.343..0.568). Footings extend below retained terrain;no flattening/cutout. DEM does not resolve exact courtyard paving,steps or archaeological terraces;thresholds and walking remain unverified.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=koutoubia_mosque` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained OSM relation12255861 has exact Q1137533 and supplies the compound anchor/axis. Current encoded relation52776570389109 matches its distinctive open court and service void;individual current height-tagged roof parts,shaft/lantern/cap and a contiguous southern annex constrain the exterior. Original anchor[-7.993581375,31.623738656] and heading0.378293139479rad retained. PositiveX runs toward the tower/eastern side of this local frame;negativeZ toward the tower/court front. Exact facade hand follows the mapped tower corner and inspected pictures,with15-degree visual orientation allowance;not a surveyed doorway bearing.
- Current height controls retained:main shaft62m,lantern min_height62/top69m,cap min_height69/top71m;roof bays10/11m,south bays13/14.5m,outer wing parts7.5/9m and attached annex8m. The source68m height claim has no qualifier defining its datum and differs from current mapped tower tags. It remains in the source fact field without silently rescaling those controls. The cap is a shallow ribbed masonry dome guided by the aerial picture;an estimated bronze finial with three broad globes ends76.5m above the tower working plane.68m is not claimed as a measured finial or shaft datum. Exact height partitions,ornament counts and current condition remain unverified. The12.5m width claim is retained as a tower-scale comparison;current mapped footprint controls the actual shaft.
- Standard viewer DEM datum465.550273m. Hall and tower floors use independent maximum2m/vertex samples plus0.25m:hall:2.846627m (1196samples,-0.531..2.597); tower:0.818348m (48samples,-0.343..0.568). Footings extend below retained terrain;no flattening/cutout. DEM does not resolve exact courtyard paving,steps or archaeological terraces;thresholds and walking remain unverified.
- Medium-fi compound exterior. Court arcades use estimated2.6m-deep closed gallery recesses;outer doors and tower windows use closed wood proxies. Curved openings and original relief abstract the pictures;precise horseshoe/lobed profiles,lattice/inscriptions,ornament counts,roof junctions,finial measurements,current condition,interior rooms/stairs,archaeological foundations and threshold/terrain/walking joins remain unverified. Skyline uses flat arch proxies and coarse crest/globes. No navigable interior,ground slab or bespoke research. Physical-device performance remains unverified.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
