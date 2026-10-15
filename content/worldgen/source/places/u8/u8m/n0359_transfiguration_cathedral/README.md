# Transfiguration Cathedral

![Molen preview](preview.png)

Individual medium-fi Odesa Transfiguration Cathedral: very tall bronze-brown needle bell spire over white tiered arched belfries/clock, large eastern drum/dome and two smaller western domes, low gray cruciform roofs, cream/white classical facades and open columned pediment porticoes. Retained raw main/part plans and terrain-following foundations. Exterior visualization from a2025 street view plus older aerial roof arrangement; exact repair/damage state, sculpture/text/icons, separate pavilion, full interiors and certified walking excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Odesa-Transfiguration_Cathedral_in_2025.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Спасо-Преображенський_кафедральний_собор_(Одеса)_DJI_0076.jpg)

Five existing shared256-square lime-plaster, standing-seam metal, cast-bronze, granite and plain-wood graphs. Cream walls/white trim, gray roofs, bronze-brown domes/spire, stone footings/steps and wood doors use linear tints/metric UVs. Blue-gray glazing, cream clock faces and restrained gold finials use flat colors. No embedded images, per-building textures or baked weathering/shadows.

## Model and axes

16,673 triangles; 50,019 vertices; 8 material groups; 2,005,360 bytes. Native bounds: -57.962, -1.971, -28.163 to 46.831, 72.500, 32.092. Source hash: `sha256:2d8c8b9c67929637f2be71a2b7c0618b14a279d053b0ffbb7e0ef66ab97f8573`.

{"x":"east toward main dome and eastern portico","y":"up","z":"south toward southern temple front"}

Standard DEM datum54.645605m; estimated model basement base0.5m above it. The retained3m eastern podium/column plane is the raised entry datum, sitting at modelY3.5m above perimeter terrain -1.62..3.28m. Western/side podiums and entry stairs approximate that transition. Foundations follow the terrain; some basement/plinth faces are naturally below the coarse hill. Exact street/door joins, absolute altitude, cut/fill and certified walking unverified; no terrain flattening or bespoke survey.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0359` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- ReferenceQ2299324 lies in the sole matching cathedral ensemble. Current main feature35184560011092 and eighteen architectural parts match the tower, three domes, crossing and four-column eastern portico visible in pictures. No retained exact-QID way is available. All plans and raw height/min_height tags are retained. Main0.1m envelope is a plinth/footprint marker, not church wall height;10/12/17/20/30/35/37m component tags establish body/stage boundaries. The unqualified retained72m height claim sets the modeled bell-spire/cross top; dome caps, spire above37m, wall details, western/side columns and stairs are picture-led estimates. Retained90x45m dimensions are context, not a geographic rescale.
- Standard DEM datum54.645605m; estimated model basement base0.5m above it. The retained3m eastern podium/column plane is the raised entry datum, sitting at modelY3.5m above perimeter terrain -1.62..3.28m. Western/side podiums and entry stairs approximate that transition. Foundations follow the terrain; some basement/plinth faces are naturally below the coarse hill. Exact street/door joins, absolute altitude, cut/fill and certified walking unverified; no terrain flattening or bespoke survey.
- Medium-fi exterior visualization from2025 tree-obscured street photo and older2021 aerial arrangement. Exact repair/damage and roof coverage after the2023 attack are not established; roof/ornament is a visual approximation, not a restoration claim. Retained1936 destruction metadata concerns the older structure and does not date the photographed modern rebuilding. Precise monument/pavilion/landscaping, sculpture, text/icons, clock numerals, full interiors and certified walking excluded. Physical device timings pending.
- Skyline keeps tall needle, three domes, open belfry/post colonnades, low cross roofs and inclined entries. District adds shared textures, flat glazing/doors/clock faces, actual belfry arches, column bases/capitals and coarse steps. Street opens wall/drum recesses and adds sparse window mullions/pilasters; closeup/master refine curves, profiles, arch facets and clock marks. Western/side columns, dome caps, spire above37m and entry transitions are estimated; eastern column controls and raw height/min_height tags are retained. Synthetic neighbors are not mapped Odesa buildings.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.
