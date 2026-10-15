# St Giles' Cathedral

![Molen preview](preview.png)

Individual medium-fi St Giles cathedral with open eight-rib crown steeple, tiered finial/pinnacles and triple louvered tower windows; broad silver-gray nave/choir, crossing, aisles and stepped lower ranges; three-bay east and five-bay west Gothic fronts, sparse tracery, doors, buttresses, corner turret and lower southeast Thistle Chapel. Terrain-following foundations and estimated west entry steps. Exact sculpture, adjacent statue/town buildings, lettering, stained-glass art, full interiors and certified walking excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:St_Giles%27_Cathedral_-_aerial_-_2025-04-19_04.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:St_Giles_steeple.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:St_Giles_Cathedral_-_01.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Cath%C3%A9drale_St_Giles_%C3%89dimbourg_10.jpg)

Five existing shared 256² coursed/raw sandstone, standing-seam metal, granite and plain wood graphs. Warm gray sandstone walls, pale trim, silver-gray lead-like roofs, stone foundation and brown door use linear tints and metric UVs. Flat blue-gray glass and restrained metallic finial/louvers. No embedded images, bespoke facade textures or baked weathering/shadows.

## Model and axes

16,957 triangles; 50,871 vertices; 7 material groups; 2,038,984 bytes. Native bounds: -34.967, -2.257, -21.871 to 33.915, 40.160, 21.785. Source hash: `sha256:6612156fd0c6553fe4d79ad40e0a926763bd3f989200499cbf16569726a754b8`.

{"x":"east toward choir end","y":"up","z":"south toward Thistle Chapel"}

Standard DEM datum 94.402203m; estimated common architectural floor 1.16m above it, with terrain-following foundations. Raw perimeter terrain spans -1.91..0.91m. West steps approximate a short street transition. Exact thresholds, absolute altitude, terrain cut/fill and certified walking are unverified; no terrain flattening or bespoke survey.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0358` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact-QID way 42407060/Q1547466 matches current main feature35184414495892. Thirteen current building parts retain their unscaled plans and raw heights: tower39m, nave/crossing20m, broad aisle16m, side ranges/Thistle Chapel14m and low projections6m. These heights govern total massing; wall/eave divisions, crown curves, finial/pinnacles, windows/tracery, buttresses and steps are picture-led estimates. Aisle plans subtract the higher nave/crossing from the raw16m control.
- Standard DEM datum 94.402203m; estimated common architectural floor 1.16m above it, with terrain-following foundations. Raw perimeter terrain spans -1.91..0.91m. West steps approximate a short street transition. Exact thresholds, absolute altitude, terrain cut/fill and certified walking are unverified; no terrain flattening or bespoke survey.
- Medium-fi exterior from four useful inspected pictures and standard viewer PMTiles/DEM. Main masses use fourteen current controls and recorded aisle subtraction with sparse approximate windows, tracery, buttresses, turret, pinnacles, chapel and steps; body rings simplify map buttress notches within about1.4m while the foundation retains the raw envelope. Exact sculpture, adjacent monument/town buildings, lettering, stained-glass art, full interiors and certified walking excluded. Absolute thresholds and physical device timings pending.
- Skyline keeps the open eight-rib crown/finial, central tower, broad church roofs, main gable pinnacles, northwest turret and inclined entrance. District adds shared textures, flat windows/louvers/door and sparse stepped buttresses. Street opens recesses and adds mullions, crown railing and louver slats; closeup/master refine crown curves, pointed heads and sparse geometric tracery. Synthetic Swedish-cottage neighbors are not mapped Edinburgh buildings.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.
