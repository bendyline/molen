# Ljubljana Cathedral

![Molen preview](preview.png)

Individual medium-fi Ljubljana Cathedral: paired western cream clock/belfry towers, octagonal crowns, stacked green copper caps and open dark lanterns; broad green crossing dome on octagonal arched-window drum and small lantern, red tiled nave/choir/cross roofs, lower green aisle roofs, pale classical pilasters/cornices, segmental west gable with round window and closed wood entries. Standard mapped plans and terrain-following foundations. Sculpture/door reliefs, text/icons/sundial numerals, separate neighbors/market, interiors and certified walking excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Cathedral_of_Ljubljana.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:StNicholas-Ljubljana.JPG)

Five existing shared256-square plaster, flat tile, copper, granite and plain wood graphs. Cream walls/pale trim, red tile and pale-green copper use linear tints/metric UVs. Glass, dark louvers and gold accents use flat PBR vertex colors. Zero embedded images, bespoke facade textures or baked shadows/weathering.

## Model and axes

16,896 triangles; 50,688 vertices; 8 material groups; 2,032,100 bytes. Native bounds: -28.030, -3.171, -14.420 to 27.054, 30.900, 13.436. Source hash: `sha256:a9d372d4c330ede15017cfdc7b991f3a61bcb9456ac0ed1c5b96f39aed81f235`.

{"x":"east toward dome and choir","y":"up","z":"south"}

Standard DEM datum304.007768m; display datum offset0.4m and perimeter terrain-2.82..2.29m. Wall foundations follow terrain. West/north entry bottoms use local standard DEM plus0.22m, with short approximate steps; they are exterior visualization thresholds, not surveyed interior floors. No flattening, absolute-altitude certification, bespoke survey or certified walking.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=ljubljana_cathedral` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact-QID OSMway176486012/Q1236564 matches current main35184548574844. Eleven unscaled main/part controls retain all raw tags. The main11m tag and retained roof:height5m guide nave eave/ridge11/16m. Tower square19m, octagonal crown25m, dome drum17m and small dome lantern23m are raw total-height tags without min_height. Wall/eave subdivisions, low aisle roofs, dome curves, lantern bottoms and ornament above tagged stages are explicit picture estimates. The retained OSM note says heights estimated; no surveyed heights claimed.
- Standard DEM datum304.007768m; display datum offset0.4m and perimeter terrain-2.82..2.29m. Wall foundations follow terrain. West/north entry bottoms use local standard DEM plus0.22m, with short approximate steps; they are exterior visualization thresholds, not surveyed interior floors. No flattening, absolute-altitude certification, bespoke survey or certified walking.
- Medium-fi exterior from two inspected elevated/north pictures and standard viewer PMTiles/DEM. Lower front is partly obscured. Exact profiles, ornaments, doorway positions, bronze reliefs, clock numerals, sundial/text/icons, market/urban neighbors, interiors and certified walking excluded or approximate. Physical laptop/phone timings pending.
- Skyline keeps the paired tiered towers, three open lanterns, crossing dome, red gables and low green ranges. District adds shared textures, flat glazing/louvers/clocks and upper ocelli. Street adds facade/drum recesses, sparse mullions/louver bars, pilasters and steps. Closeup/master refine curve/arch facets and clock marks. Ocelli remain flat decorative discs, not interior openings. Synthetic context neighbors are not mapped Ljubljana buildings.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.
