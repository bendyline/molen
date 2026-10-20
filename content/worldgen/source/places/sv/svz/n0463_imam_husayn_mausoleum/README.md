# Imam Husayn Mausoleum

![Molen preview](preview.png)

Individual medium-fi Imam Husayn shrine: mapped covered gallery and central core, golden pointed bulb dome on blue drum, two tall golden balcony minarets, gold-columned front portico, ten mapped gate ranges, Qibla gate upper clock stage and repeated shallow courtyard roof caps. Coarse blue faience fields and pale stone surfaces use six existing shared 256² graphs across seven merged roles. Four independent browser LODs. Component centers and total map heights are controlled; internal profiles, bays, facade facing, rooflights and ornament are explicit visualization estimates. Separate expansion, fine calligraphy/artwork, furnishings, crypts, festivals and city omitted.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Karbala_in_2019.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:A_view_court_yard_Imam_Husayn_shrine.jpeg)

Six existing shared 256² stucco, raw limestone, lime plaster, marble, cast bronze and mosaic tile graphs serve seven merged roles. Metric UVs, linear colors, no embedded images or photographs. Fine inscriptions and artwork omitted.

## Model and axes

50,808 triangles; 152,424 vertices; 7 material groups; 6,101,216 bytes. Native bounds: -60.657, -3.159, -68.867 to 84.605, 43.905, 86.758. Source hash: `sha256:ae7a3982a393f4a48c3910d22fd6fc860be9eacdb60ffd7644878d8390450b9d`.

{"x":"east-southeast along core front","y":"up","z":"south-southwest toward minarets"}

Normal viewer DEM datum 36.01129166781902 m; working floor -0.09479425652329782 m is outside-perimeter median plus 0.3 m (124 samples). 899 raw central-footprint samples span -1.695055331448394..0.9917247749518623 m. Adaptive foundation and paving cover the central gallery outer footprint; gate foundations follow their own outlines. Preview terrain seats this outline and 1.5 m margin. Exact street thresholds, drains, crypt levels and present grade joins remain unverified.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0463` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained Q773704 reference anchor [44.0325,32.616388888] is unchanged. The older record is reference-only. Current named shrine POI 52776572251048, courtyard/gallery 52776572301940, tomb 35185528314643 and Qibla Gate 17601319459877 support this identity. Main gallery 52776572301940 surrounds the exact central four-vertex core 35185434669244. Dome 35185101411085 and paired balcony/upper-minaret controls fix their own centers. Ten mapped gate roofs and small 14.5 m roof caps are retained individually. Heading -0.22117434116265272 radians aligns the front core edge with positive X east-southeast; positive Z south-southwest faces the minarets and principal portico. Current ring is mapped as roofed, and the supplementary courtyard photograph shows rooflights: the model follows that covered footprint, not the earlier open-court photograph. Facade facing and internal bays are picture-led approximations. External western expansion, crypts, tomb furniture, streets and surrounding city remain host content or omitted.
- Current map: gallery 12.5 m, core 12 m, golden dome 32 m with min_height 12 m, minaret balconies 34–34.5 m and upper minaret parts 34.5–44 m. Gate roofs 11.3 m; small roof caps 14.5 m; Qibla gate upper square 17.3 m and octagonal upper control 21.3 m. Total heights are honored. Internal picture-led estimates: main blue drum 12–17 m, golden bulb to 31.4 m and finial to 32 m; gold shafts to 32.5 m, projecting balcony to 34.5 m, slender upper stage to 40 m, cap/finial to 44 m. Covered-court rooflights, entrance arch divisions, dome/minaret curves, gold portico spacing and clock divisions are estimates. Coarse map heights do not establish those internal levels. No surveyed engineering or furnished interior claim.
- Normal viewer DEM datum 36.01129166781902 m; working floor -0.09479425652329782 m is outside-perimeter median plus 0.3 m (124 samples). 899 raw central-footprint samples span -1.695055331448394..0.9917247749518623 m. Adaptive foundation and paving cover the central gallery outer footprint; gate foundations follow their own outlines. Preview terrain seats this outline and 1.5 m margin. Exact street thresholds, drains, crypt levels and present grade joins remain unverified.
- Current named map controls resolve the older reference-only record. Total heights and part centers are mapped; detailed vertical profiles, facade facing, portico bays, window rhythm, rooflights, small roof caps and clock division are estimates. The currently roofed annulus follows the map and covered-court photograph; no historic snapshot or furnished interior claim. Festivals, crowds, flags, chandeliers, calligraphy, fine faience art and crypts omitted. External expansion, city and streets remain host content. Physical phone/tablet/laptop timings pending.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.
