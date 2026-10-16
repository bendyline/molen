# Dubrovnik Cathedral

![Molen preview](preview.png)

Individual Dubrovnik Cathedral: pale coursed limestone Baroque front, four free-standing columns/recessed wood entry beneath canopy, two side doors, outer figure niches, shoulder balustrades/statues and upper rectangular glazing/shallow balcony/volutes/triangular crown. Gray metal nave/aisle/transept roofs; central pale windowed drum, dark gray ribbed dome and slender pale lantern/finial/cross. Side upper windows/lower lunettes and broad transept glazing/door complete map-led body. Four existing shared limestone/continuous limestone/standing-seam metal/wood graphs, linear tints, metric UVs and four browser levels. Fine Corinthian carving/statue identity/ironwork, full interiors, exact hidden rear details and surveyed paving/thresholds are approximate or excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Fa%C3%A7ana_de_la_catedral_de_Dubrovnik.JPG)
- [Reference](https://commons.wikimedia.org/wiki/File:Dubrovnik_2016-05-26_DSC06252_view_from_the_wall_-_cropped.jpg)

Four existing cached256-square coursed limestone, continuous limestone, standing-seam metal and plain-wood graphs. Linear pale-stone/gray/wood tints, metric UVs and flat architectural normals; glazing/metal accents use geometric PBR colors. No embedded images, unique facade maps or baked shadows.

## Model and axes

17,137 triangles; 51,411 vertices; 6 material groups; 2,060,112 bytes. Native bounds: -21.300, -1.327, -14.023 to 20.653, 45.600, 14.321. Source hash: `sha256:0d950157262e6a122a998a0c5278ab51f7b2d2b1563ec3c019b0aec27942e3b2`.

{"x":"eastward from projecting western front toward nave/rear","y":"up","z":"southward toward opposite side aisle"}

Standard viewer DEM datum 13.547986m; display floor0.6m, raw whole perimeter -0.98..0.29m. Footings extend below coarse terrain; short local stairs approach a threshold0.3m above model floor. Exact old-town paving/door joins, absolute altitude and walking remain unverified. No global flattening or road replacement.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0380` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact-QID OSM way737699509/Q584428 matches current main35185109788341. All77 current raw vertices/tags reproduce by rigid rotation without rescale. No map height/min_height, measured height facts or independent cathedral component controls are supplied. An unrelated31-vertex building_part north of the church is excluded. Western central projection (-X) and broad long roof toward+X sign the facing. Original multilingual identity and earlier control remain verbatim. Internal Boolean roof/ground/entry partitions, dome center[1.5,-0.8]m/radius5.5m and all heights are picture estimates: main walls19m/gray metal roof22.5m, aisles11m/roofs13.5m, transept20.5m/roof24m, dome shaft19..29.5m (exposed above roof), ribbed gray dome37m, pale lantern41.5m/hat43m/cross45m. Front lower13.4m with four free-standing columns and canopy, upper23.2m/triangular crown28.2m; wood portal behind the columns at x-19m, column plane-20.3m. Side doors, outer figure niches, shoulder balustrades/statues, central window/balcony/volutes and side lunette/window rhythm are approximate. Full original footprint stays retained; ground wall omits the projection air space and inserts the inset entry plan. No survey/engineering accuracy claimed.
- Standard viewer DEM datum 13.547986m; display floor0.6m, raw whole perimeter -0.98..0.29m. Footings extend below coarse terrain; short local stairs approach a threshold0.3m above model floor. Exact old-town paving/door joins, absolute altitude and walking remain unverified. No global flattening or road replacement.
- Medium-fi exterior from two inspected2011 front/2016 elevated-side pictures and standard viewer PMTiles/DEM only. All heights and internal partitions are picture estimates. Fine Corinthian carving/statue identity, ironwork, inscriptions, full interiors, exact hidden rear/current finishes and surveyed paving/thresholds remain approximate or excluded. The nearby bell tower and other church are separate buildings. Physical phone/laptop timings pending.
- Skyline retains pale front/columns/crown, gray roofs and dome/lantern/cross; small windows and balustrades omitted. District adds shared surfaces and flat fields. Street adds actual recessed glazing/wood portals/figure niches, dome ribs, pilasters, balcony/open balustrades and simplified statues; closeup/master refine frames/capitals. Synthetic cottages are fixtures.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.
