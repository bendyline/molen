# Cathedral of Saint Mother Teresa in Pristina

![Molen preview](preview.png)

Individual medium-fi two-tower Saint Mother Teresa Cathedral: tiered open square campaniles with clock/blank clock field, round rose, large gabled open front porch and closed wood entry, red-tiled raised nave/aisles/transept, map-shaped rear apse, broad entry steps and low mapped platform/basement. Exact sculpture, lettering, stained-glass pictures, full interiors and certified walking excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Saint_Mother_Teresa_Cathedral_Prishtina8.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Cathedral_of_Saint_Mother_Teresa_(Pristina)_in_2025.01.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Mother_Teresa_Cathedral3.jpg)

Five existing256-square ashlar,raw limestone,ceramic tile,granite and plain wood graphs. Pale coursed stone,light trim,terracotta roof,brown doors and flat blue-gray glazing use linear tints and metric UVs. Clock fields/metal are flat PBR colors;no embedded images or baked shading.

## Model and axes

19,100 triangles; 57,300 vertices; 7 material groups; 2,296,148 bytes. Native bounds: -37.812, -2.781, -45.948 to 58.863, 71.800, 21.187. Source hash: `sha256:c1bf5e61c56bdbb51de66cb04785738486bfb0f2ee20768c6aa1aa87ae9328a4`.

{"x":"toward northeast-facing main porch","y":"up","z":"toward clocked tower left of the front"}

Standard DEM datum 585.753036m; estimated common church floor 1.8m clears sampled church/tower peak 1.433m. Foundations and low platform edge follow coarse terrain; front stairs are an estimated transition, not surveyed steps. Raw5m platform height retained but interpreted at common floor. Exact court/street/door thresholds, absolute altitude and certified walking unverified.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0356` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact-QID way 105555618 matches current main numeric PMTiles identity. Current unscaled main, two separate 70m tower footprints and one lower 5m building outline are retained. August2025 picture confirms two completed towers versus the older one-tower views. Tower 70m tops include shallow cap/cross; individual open stages and nave/aisle/transept/apse/porch heights are picture-led estimates. Lower 5m mapped building is interpreted as a low platform/basement edge reaching the common church floor over coarse DEM, not an independent 5m wall above that floor.
- Standard DEM datum 585.753036m; estimated common church floor 1.8m clears sampled church/tower peak 1.433m. Foundations and low platform edge follow coarse terrain; front stairs are an estimated transition, not surveyed steps. Raw5m platform height retained but interpreted at common floor. Exact court/street/door thresholds, absolute altitude and certified walking unverified.
- Medium-fi exterior from three useful pictures and standard viewer PMTiles/DEM. August2025 two-tower state supersedes older single-tower construction images. Nave/transept/apse/aisle/porch proportions,stage divisions,paired windows,rose,corbels and steps are picture-led estimates. Rear apse and low platform/basement facades/functions are map-led approximations. Exact lettering,sculpture,clock numerals,stained-glass pictures,full interiors and certified walking excluded. Absolute thresholds/altitude and physical device timings pending.
- Skyline retains two open tiered four-post towers,clock body,shallow caps/crosses,red-roofed basilica/apse/transept,coarse porch piers and inclined entry. District adds shared surfaces,flat windows/doors,front rose and clock fields,real open porch and solid-pier arched tower panels. Street cuts actual paired windows,rose and tower walls,adds sparse pilasters/cornices/railings and stepped entry. Paired top openings use wider bays and thinner upper masonry than the single-bay lower stages. All tower feet follow the coarse terrain. Closeup/master refine curves,rose spokes/corbels/clock marks/rail uprights. Openings,ornament and small roof profiles change visibly. Synthetic Swedish-cottage neighbors are not local mapped buildings.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.
