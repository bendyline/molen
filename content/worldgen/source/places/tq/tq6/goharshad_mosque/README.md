# Goharshad Mosque

![Molen preview](preview.png)

Individual medium-fi Goharshad Mosque: exact named courtyard and separate dome control, clipped mosque-only portion of merged shrine ranges, four pointed iwans with tall Maqsura facade and twin balcony minarets, turquoise bulb dome, two-tier blue/pale pointed courtyard fields and low flat roof ranges. Current court/dome geometry fixes scale and axis; envelope, minaret origins, component heights, bays, vault profiles and facing details remain explicit estimates. Six existing shared 256² graphs serve seven merged roles and four independent LODs. Adjacent shrine, golden dome, Quds pavilion/court, fine art and furnished interiors omitted.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Goharshad_Mosque_Maqsura_Iwan.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Goharshad-mosque-mashhad-IRAN.jpg)

Six existing shared 256² brick, raw limestone, mosaic tile, lime plaster, marble and plain wood graphs serve seven merged roles. Cyan dome and pale tiled minarets use vertex tint on the same mosaic graph as blue facades. Metric UVs, linear colors and no embedded images or copied artwork.

## Model and axes

11,924 triangles; 35,772 vertices; 7 material groups; 1,435,096 bytes. Native bounds: -34.211, -3.220, -38.104 to 80.163, 44.190, 42.912. Source hash: `sha256:f0c4f4823f007f00d92ccd9111ad5820f6714f657039725f4f26f391c2c5fd0f`.

{"x":"northeast along first court edge","y":"up","z":"southeast"}

Normal viewer DEM datum 981.3131407720962 m; working floor 1.1899544108328428 m is the median of 134 outside-campus samples at 1 m offset plus .3 m. 1053 raw campus samples span -2.8558678939205038..5.157968103347912 m. Foundation/paving follow the clipped campus; preview terrain seats that outline and 1.5 m margin. The open raw court and four estimated iwan recesses remain clear above the paving. Exact shrine paving, thresholds, stairs, basements, drains and current grade joins remain unverified.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=goharshad_mosque` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained Q2393680 reference anchor [59.614722222,36.2875] is unchanged. Current named Gowharshad Mosque POI 17592500373595 and Persian courtyard POI/landuse 35184757341598 support the identity. Courtyard is the exact four-vertex pedestrian polygon; dome is separate 19-vertex building part 35185137727260. The map merges surrounding ranges into larger shrine buildings 35184757341590 and 35185838521529. The authored campus is their intersection with an explicit estimated mosque envelope: courtyard limits plus 14 m ranges, extending west to the mapped dome radius plus 8 m. This clipped source scope is not an exact independent mosque way. Whole-building replacement is disabled; a buildingCutout removes only this campus from merged parents and preserves surrounding shrine geometry. Heading 0.7432519684678092 radians follows the first courtyard edge: positive X northeast along the court, positive Z southeast. Main Maqsura iwan faces positive X from the western local court edge. Tower centers flank that iwan at estimated offsets, not independent map controls. Golden Imam Reza dome, Quds courtyard/pavilion, adjacent halls, libraries, streets and other shrine structures remain host content.
- Retained source fact gives overall height 43 m without a component qualifier. No current mosque/dome/tower heights exist; the neighboring aggregate outline has a 9 m tag that is not assigned to this mosque. The model uses 43 m as the overall finial height of both minarets and the dome; the source does not assign that fact to one component. Picture-led estimates above working floor: paving .7 m; two-tier courtyard ranges 13 m; Maqsura iwan 28 m with a 23 m pointed opening, other iwans 21 m with 17 m openings; dome drum 15–22 m, turquoise bulb to 42 m and small finial to 43 m. Minaret shafts to 31 m, balcony around 32–34 m, narrower upper stage/cap to 43 m. These component allocations, profiles, facade bays, roof recesses and all local architectural divisions remain estimates, not surveyed engineering.
- Normal viewer DEM datum 981.3131407720962 m; working floor 1.1899544108328428 m is the median of 134 outside-campus samples at 1 m offset plus .3 m. 1053 raw campus samples span -2.8558678939205038..5.157968103347912 m. Foundation/paving follow the clipped campus; preview terrain seats that outline and 1.5 m margin. The open raw court and four estimated iwan recesses remain clear above the paving. Exact shrine paving, thresholds, stairs, basements, drains and current grade joins remain unverified.
- The mosque lacks an independent complete outer way in this map. Its campus is an explicit clipped portion of merged shrine polygons, with estimated range widths and envelope. Partial building replacement preserves the host remainder. The exact courtyard and dome define scale/axis; tower positions, profiles, iwan recesses, facade rhythm and component height allocations are estimates. Fine floral/diamond art, calligraphy, exact muqarnas, fixtures, crowds, fountain and furnished interiors omitted. Golden shrine dome, Quds court/pavilion and adjacent halls remain host content. No surveyed engineering, collision-certified interior or physical-device timing claim.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.
