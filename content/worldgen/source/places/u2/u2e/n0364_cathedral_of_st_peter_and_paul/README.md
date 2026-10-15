# Cathedral of St. Peter and Paul, Brno

![Molen preview](preview.png)

Individual Brno Petrov cathedral: broad higher western nave and lower polygonal east choir, twin square stone towers beside their junction, open Gothic belfry/crowns and very slender green-gray metal needle spires. Smaller choir ridge fleche, metal roofs with small nave dormers, warm mixed rubble stone/pale trim, tall pointed glazing, stepped buttresses, west gabled facade and open outer portal with closed wood entry behind it. Low northern chapels and southern vestry follow approximate clips within mapped envelope. Shared materials, standard-terrain foundations. Exact sculpture/inscriptions, tiny latticework, stained-glass art, bells/interiors, surrounding town/landscaping and certified walking excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Cathedral_of_Saints_Peter_and_Paul_in_Brno.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Brno_Cathedral_St._Peter_and_Paul-03.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Brno_St._Peter_and_Paul_Cathedral_01.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Brno_St._Peter_and_Paul_Cathedral_02.jpg)

Four existing shared256-square rubble stone, limestone, standing-seam metal and plain wood graphs. Roof and spires reuse the same metal graph with distinct gray-green tints; warm stone/pale trim use linear colors and metric UVs. Glass/clocks/accents are flat PBR vertex colors. No embedded images, bespoke textures or baked snow/soot/shadows.

## Model and axes

8,764 triangles; 26,292 vertices; 6 material groups; 1,055,332 bytes. Native bounds: -36.601, -3.503, -19.301 to 38.042, 84.400, 19.122. Source hash: `sha256:cfedb7f6fbe98f7689bb21b68380521d98915814c32b9f17667afa41ef9cde88`.

{"x":"east-southeast toward choir","y":"up","z":"south-southwest"}

Standard DEM datum 239.782823m; display datum offset 0.4m, mapped perimeter terrain -3.04..0.84m. Foundations follow terrain; approximate west/south exterior thresholds use local DEM +0.22m. Coarse standard DEM does not certify absolute altitude, Petrov terrace retaining walls, paving/step joins, thresholds, cut/fill, interiors or walking. No global flattening.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0364` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Exact-QID OSMway32877797/Q45033 matches current main35184404966629. Seven raw controls/tags are retained without rescale. Nave and short crossing parts are40m, choir30m, two tower envelopes84m and choir fleche45m, with no min_height values. These are approximate complete roof/spire envelopes, not stacked wall solids. Estimated nave eave28m/ridge40m, choir eave23m/ridge30m, tower square wall42m/open belfry55m/crown60.5m/needle and finial84m, and fleche above the30m roof to45m are picture-led subdivisions. Low chapel/annex plans clip the raw main envelope and have estimated7.5/10m eaves. Retained facts contain no independent measured dimensions. Raw tiny buttress notches remain in the detailed foundation; above that, the joined main/part volumes provide the architectural wall envelope.
- Standard DEM datum 239.782823m; display datum offset 0.4m, mapped perimeter terrain -3.04..0.84m. Foundations follow terrain; approximate west/south exterior thresholds use local DEM +0.22m. Coarse standard DEM does not certify absolute altitude, Petrov terrace retaining walls, paving/step joins, thresholds, cut/fill, interiors or walking. No global flattening.
- Medium-fi exterior based on four useful pictures and standard viewer PMTiles/DEM only. Eaves/roof slopes, tower subdivisions/crowns, small annex clipping, porch dimensions, dormers, facade rhythm, buttress widths and thresholds are estimates. Exact sculpture/inscriptions, stained-glass art, bells/interiors, Petrov terrace retaining walls, surrounding town/landscaping and certified walking excluded. Physical device timing pending.
- Skyline keeps twin needle spires at the junction, broad high nave, lower choir, fleche, open porch and coarse buttresses. District adds textures, flat glazing/doors, clocks/dormers and open belfries/crowns. Street adds recesses, stepped buttresses/pinnacles, portal bands and sparse tracery. Closeup/master refine facets. Synthetic context neighbors are not mapped Brno buildings.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.
