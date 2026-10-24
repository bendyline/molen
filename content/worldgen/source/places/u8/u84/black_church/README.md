# Black Church

![Molen preview](preview.png)

Individual Black Church in Brasov: long gray-tan ashlar Gothic hall with very steep muted red-brown tiled nave roof, lower polygonal eastern choir roof, stepped buttresses, tall pointed recessed glazing and sparse tracery. One tall southwest square clock tower with layered tiled hip/octagonal gallery/spire and slender metal tip, lower northwest corner roof, small south stair turret and small nave ridge fleche. Common shared masonry/tile/wood/metal; mapped footprint and standard-terrain footings. Exact clock mural/numerals, carved sculpture/inscriptions, interiors, trees/neighbor buildings and certified walking excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Exterior_of_Black_Church-Brasov.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Biserica_neagra.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Biserica_Neagra_-_Turnul_cu_ceas_din_lateral_BV-II-m-A-11412.jpg)

Five existing shared256-square ashlar, limestone, flat tile, plain wood and standing-seam metal graphs; linear gray-tan stone/red-brown tile tints and metric UVs. Glass, metal accents and a simplified clock use flat PBR vertex colors. Zero embedded images or bespoke facade textures, no baked soot/weathering/shadows.

## Model and axes

16,776 triangles; 50,328 vertices; 7 material groups; 2,017,224 bytes. Native bounds: -42.866, -1.960, -15.082 to 43.045, 65.400, 15.274. Source hash: `sha256:adcce469a81653595e082e5788694f979da432b27cbd76d7e0ef9500b3e60b59`.

{"x":"east-northeast toward choir","y":"up","z":"south-southeast toward clock tower side"}

Standard DEM datum597.075184m; display datum offset0.4m, perimeter terrain-1.46..-0.17m. Foundations follow terrain; approximate west/south thresholds use local DEM+0.22m with short steps. Coarse DEM does not certify absolute altitude, precise paving/steps, doorway thresholds, cut/fill, interiors or walking. No global terrain flattening.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=black_church` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact-QID OSMway866090450/Q910124 matches current main35185238179282. Current nave part35185238179280 is41m; choir and apse parts35185238179279/278 are37m, with no min_height. Treat these as approximate complete roof envelopes, not stacked solids: estimated nave eave24m/ridge41m and choir eave24m/ridge37m. Retained unqualified65m Wikidata height guides the single clock tower and finial; its masonry44.5m/crown subdivisions are picture estimates. Retained89m length/38m width claims are not used to rescale the unscaled81.4x26.1m mapped church footprint.
- Standard DEM datum597.075184m; display datum offset0.4m, perimeter terrain-1.46..-0.17m. Foundations follow terrain; approximate west/south thresholds use local DEM+0.22m with short steps. Coarse DEM does not certify absolute altitude, precise paving/steps, doorway thresholds, cut/fill, interiors or walking. No global terrain flattening.
- Medium-fi exterior from three useful pictures and standard viewer PMTiles/DEM. Exact clock mural/numerals, stone sculpture/inscriptions, tiny tracery/portal details, surrounding trees/town, interiors and certified walking excluded. Tower/stair/fleche divisions, facade rhythm and buttress widths are approximate; physical device timing pending.
- Skyline preserves the individual roof/tower profile and coarse buttresses. District adds shared textures, flat pointed glazing/doors, clocks and genuinely open crown gallery. Street adds facade/door recesses, stepped buttresses/pinnacles, restrained mullions/tracery and parapet rings. Closeup/master refine arch/ring facets. Synthetic context neighbors are not mapped Brasov buildings.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.
