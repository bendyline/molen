# N0592 — De La Fratta

Reviewed 2026-10-19 in one continuous author/build/inspect/fix round.

![De La Fratta](preview.png)

## Appearance

Inspected all47 current views:8 source,7 shared-material,24 medium-fi and8 native-map frames. Specific pentagonal keep/projected rounded corbel mouths, crenellated upper crown/small tile-roofed cabin, irregular lower enclosure/sparse grilled windows/recessed arched closed gate, exposed low hipped annex/central roofed room, narrow stack, supported short treads and bounded faceted rock are present. Corrected the coarse-DEM approach/court relation and keep/annex allocation while constructing; the low roofed annex is now visible. Whole views retain the complete fortress; detail views cover the crown, lower windows and gate/rock contact. No separate source/QA research restart.

## Shared materials and browser levels

Five existing256-square graphs: stone_limestone_raw, stone_ashlar, tile_ceramic, metal_painted and wood_plain. Limestone is reused on walls and rock in separate semantic slots; all textures are shared and read once. Restrained sRGB-to-linear palette tints/metric UVs, no embedded image or copied stone/photographic atlas. At most six runtime draws. Skyline uses averaged graph colors; separate POSITION/NORMAL streams and equal CPU/GPU buffer accounting verified. Unload disposes all model geometries.

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 838 | 85880 | 1 |
| district | 2154 | 183144 | 6 |
| street | 6704 | 602892 | 6 |
| closeup | 6726 | 604684 | 6 |

Four authored levels retain the fortress silhouette and low roofed parts:838/2154/6704/6726 triangles. Skyline+district geometry269024bytes, below3MB phone/6MB laptop initial limits. Inspected noon/late, economy/high, silhouette/details and four transition views. Distant corbel mouths simplify to dark insets or a solid projected band; street/closeup have actual rounded cut recesses. Thin masts/visitors/trees are not baked into the landmark. Synthetic context images establish style/LOD continuity; separate native-map frames establish placement.

## Approximate map fit

Exact-QID main OSMway59329686/PMTiles35184431418518 and corresponding parts35185154011759/760 fix the main envelope. Anchor12.451359066,43.932622165, heading0/native east-south axes; internal+1.23483791576rad puts local+X towardSSE. Pictured keep and low annex are allocated across the northern/central parts with about5m/30degree uncertainty; doorway side and fine inventory remain estimates. Only three corresponding shells replaced with2cm pad, zero residual. All342 independent resident building records remain unchanged from345 originals, including nearby unlabelled buildings. Original6m DEM/native paths/28.664380m2 water unchanged through all levels, failure and unloading. Failure restores345 original shells; unload frees all model geometry. The court is5.827237m relative to DEM datum697.825291m, nominally1.2m above the mapped-side approach endpoint; actual bounded rock/footing and descending treads contact native grade. No ridge-wide slab, flattening or ground/water cutout. Isolated shared review uses asset mode; native-map fixture verifies actual geographic placement.

## Limits

Two useful ordinary photographs:2024 whole fortress and2009 close corbel/curtain view, carried through this one construction pass. Map fixes the outer envelope/two parts, not internal room or keep inventory. No measured architectural height exists in retained facts: nominal court-to-upper-roof22.4m, lower curtain8m/merlons9.15m, low roofs7.4–9.7m and gate/rock levels are explicit picture/map visualization estimates. The nearby739m Monte Titano peak is not treated as a surveyed castle height. Standard DEM smooths the real cliff severely; bounded original rock geometry approximates local exposed limestone without modifying terrain or claiming surveyed cliff/foundation/accessible-route engineering. Exact current repair pattern, roof/window/corbel schedule and interior remain unverified. No furnished museum, copied inscriptions/crack atlas, whole ridge, temporary ropes/masts or independent structures authored. Medium-fi style and browser budgets govern detail; physical-device performance is not claimed.

## Selected checks

Six Khronos files: zero errors/warnings.127 actual mesh/material/contact checks; 47 current inspected views. Scene validation/sim30 and strict selected medium-fi audit pass. Source/runtime/LOD hashes and material bindings verified.

Rebuild: node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0592; node packages/worldgen/scripts/import-next-1000-models.mjs --ids=N0592; node packages/tooling/scripts/generate-landmark-lods.mjs --ids=N0592 --force.

Source: sha256:b6c027eebd1659a5f0d5745c3aac0d88075aa073f8db537371517eb84ff15bca

Runtime: sha256:50233aad5dfcc24cf4f9f4f13605a2c257fc6c6884ac32ac5b6ef30d517e2346

Input: sha256:81052a67cb27d4894358af78ee6ab6830f2f70b62394cd5539f7a00e6c030103

## Viewed ordinary pictures

https://commons.wikimedia.org/wiki/File:Torre_Cesta_-_San_Marino_-_GT_01_-_2024_04_30.jpg — Terragio67; CC-BY-SA-4.0. Viewed only; no pixels copied.

https://commons.wikimedia.org/wiki/File:Tower-Cesta-San-Marino-May-2009.jpg — Acediscovery; CC-BY-4.0. Viewed only; no pixels copied.
