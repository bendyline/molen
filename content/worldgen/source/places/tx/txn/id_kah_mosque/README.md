# Id Kah Mosque

![Molen preview](preview.png)

Individual Id Kah Mosque compound: retained irregular ring and open courtyard,yellow entrance portal and wings with white pointed blind-arch trim,a real central passage,two tapered minarets with blue geometric bands and open capped lanterns,low pale roof ranges and a sheltered west prayer-hall veranda with green timber columns,white beams and coarse brackets. Garden,trees,street furniture,adjacent buildings,inscriptions,carpets,furnished interiors and engineering are excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:IdKahMosque.JPG)
- [Reference](https://commons.wikimedia.org/wiki/File:Kashgar_May_2007_467.jpg)

Seven existing shared256² graphs for yellow glazed brick,pale raw/coursed limestone,lime plaster,green timber,blue ceramic bands and cast bronze. Metric UVs,linear tints,no embedded images or unique atlas. No historic artwork,calligraphy or photo pixels are reproduced.

## Model and axes

9,819 triangles; 29,457 vertices; 7 material groups; 1,182,636 bytes. Native bounds: -53.660, -3.330, -67.948 to 65.317, 23.169, 72.636. Source hash: `sha256:646d9e506bb13b677f3f5325ef44eaf53ac31af0d3c0764d2dc042e12808dbfd`.

{"x":"estimated eastern gate","y":"up","z":"west edge toward southern end"}

Standard Protomaps20261014 and Mapzen/USGS viewer extractN0479;datum 1300.191498056187 m. The floor is the median of 344 outer/court edge samples plus0.25 m. 1103 mapped-ring samples range -2.956909692738691 to 2.7874161669869864 m. Footings follow sampled grade;the exact court hole remains open in the replacement mask. The synthetic fixture seats only the mapped ring and a3 m margin to avoid raster interpolation at walls. Exact steps,thresholds,drains and finished ground levels remain approximate.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=id_kah_mosque` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained Q1325825 reference anchor is unchanged. Current PMTiles has one named Id Kah Mosque point inside a single large courtyard building,52776572429281,with13 outer and27 inner vertices. The building has no exact Wikidata tag;selection is a reviewed approximate association from the named point,location and compound shape. The west outer edge supplies an undirected alignment;the eastern projecting gate and inspected gateway picture supply approximate facing. The courtyard hole stays open. No measured facade,roof partition or signed survey bearing is claimed.
- The mapped whole-building height4 m controls the low courtyard ranges. Estimated levels above the local floor: prayer-hall roof4 m,veranda ceiling3.8 m,front wings7.2 m,portal13.8 m and two minarets22.6 m including finials. Gate dimensions,blind niches,tower positions/profiles,columns,brackets and roof details are visual estimates. No retained dimensional facts or individual part height tags exist.
- Standard Protomaps20261014 and Mapzen/USGS viewer extractN0479;datum 1300.191498056187 m. The floor is the median of 344 outer/court edge samples plus0.25 m. 1103 mapped-ring samples range -2.956909692738691 to 2.7874161669869864 m. Footings follow sampled grade;the exact court hole remains open in the replacement mask. The synthetic fixture seats only the mapped ring and a3 m margin to avoid raster interpolation at walls. Exact steps,thresholds,drains and finished ground levels remain approximate.
- Gateway and hall pictures establish vocabulary only. Exact current condition,internal layout,front facade measurements,garden,interiors,engineering and physical-device/full-city performance remain unverified.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain.
