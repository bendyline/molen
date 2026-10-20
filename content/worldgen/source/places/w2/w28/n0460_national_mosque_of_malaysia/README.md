# National Mosque of Malaysia

![Molen preview](preview.png)

Individual medium-fi National Mosque of Malaysia campus: broad turquoise sixteen-point folded umbrella roof, pale rib bands and sixteen-sided hall, low mapped roof ranges with repeated shallow white square caps, open colonnades and courts, raised entry canopy and tall square pale minaret with pleated pointed cap. Exact three map controls retained; internal roof/hall layout, facade rhythms and component heights remain estimates except current 11 m main and 73 m tower total tags. Five existing shared 256² graphs serve six merged material roles. Four separate browser LODs. No bespoke photography, inscriptions, fine screen artwork, neighboring mausoleum/ranges or furnished interiors.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Masjid_Negara_and_its_minaret_(18790212558).jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Majid_Negara_Kuala_Lumpur_Malaysia.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Masjid_Negara_view_from_Kuala_Lumpur_Tower_2023.jpg)

Five existing shared 256² stucco, marble, membrane, mosaic tile and plain wood graphs serve six merged material roles including local opaque blue-grey glazing. Metric UVs, linear tints, original coarse geometric screen rhythm and no embedded images. No copied facade photograph, inscriptions, fine screen artwork or baked lighting.

## Model and axes

9,087 triangles; 27,261 vertices; 6 material groups; 1,094,160 bytes. Native bounds: -89.279, -14.176, -76.964 to 89.286, 65.040, 82.150. Source hash: `sha256:88d319d583d2078eafc8d6c4ef64d152237baf34bfa9ec353f8e872d4ebae990`.

{"x":"north-northeast","y":"up","z":"east-southeast"}

Normal viewer DEM datum 48.907660164596706 m; working floor -7.960260800153894 m is the median of 291 outside-perimeter samples at 1 m offset plus 0.3 m. 1621 raw campus samples span -13.699828863443386..0.8451278515805143 m. Adaptive perimeter footings support a paved podium over the union outer outline, including its two open roof gaps. Preview terrain seats that outer outline and 1.5 m margin. Exact street approach, garden walls, stairs, reflecting-pool levels and present terrain joins remain unverified.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0460` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact main way 585264338 / Q1356818 is viewer building 35184957353170. Current main outline has 28 raw vertices; raised connector 35184494096317 and minaret base 35184494096321 each have four. Original anchor and heading retained. Positive X approximately north-northeast; positive Z east-southeast. The three mapped controls form one connected campus with two gaps. Their union outer outline controls the paved podium and terrain cutout; the two gaps remain open above that podium. Main roof/hall center [4.3,-6], cap grid, column spacing and entry division are picture-led visualization estimates. Minaret center is the actual mapped tower bounding-box center, not an arbitrary offset. Separate surrounding ranges, gardens, fountains, streets and city remain host content. Six estimated approach treads extend to local Z=82.15, about 6 m beyond the mapped southeast roof edge. The three raw control outlines and cutout remain unchanged.
- Current main building height tag is 11 m; current tower height tag is 73 m; the connector has layer=1 and no height. Retained main building has three levels and no numeric height. Main low roofs use 11 m above the working floor. Picture estimates: raised podium 2.4 m; sixteen-sided prayer hall eaves 11 m; folded umbrella valleys 11.5 m, projecting tips 15.3 m and central hub 26 m. The blue roof therefore rises above the coarse main building height tag, explicitly reconstructed from pictures. Tower total height respects 73 m, with estimated slender square shaft to 56 m, projecting square platform to 59 m and pleated pointed white cap/finial to 73 m. The 73 m tag does not establish those internal levels. Entry stairs, canopy fingers, roof caps and lattice proportions are approximate; no surveyed engineering or interior claim.
- Normal viewer DEM datum 48.907660164596706 m; working floor -7.960260800153894 m is the median of 291 outside-perimeter samples at 1 m offset plus 0.3 m. 1621 raw campus samples span -13.699828863443386..0.8451278515805143 m. Adaptive perimeter footings support a paved podium over the union outer outline, including its two open roof gaps. Preview terrain seats that outer outline and 1.5 m margin. Exact street approach, garden walls, stairs, reflecting-pool levels and present terrain joins remain unverified.
- Medium-fi exterior reconstruction. Main 11 m and tower 73 m current height tags retained. Tall blue folded roof is picture-led above the low roof tag. Three mapped control outlines retained with union-derived paved podium; roof gaps remain open above paving. Detailed hall center, cap grid, columns, lattice rhythm, entry canopy/fingers, stairs and tower tier heights are estimates. Reflecting pools, gardens, fine lettering, furniture, services and furnished interiors omitted. Separate surrounding buildings stay host content. Exact present finish/grade and physical-device timings remain unverified.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.
