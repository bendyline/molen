# St. Mary's Cathedral

![Molen preview](preview.png)

Individual Tokyo St. Mary's Cathedral by Kenzo Tange: eight curved stainless-steel sails, narrow cross-shaped roof skylight, unequal tall glazed end slots and steel ribs, wood entry doors, low beige masonry annexes and detached slender concrete belfry with unequal blades and open bell slot. Four existing shared graphs, linear tints, metric UVs, flat architectural normals and four browser levels. Standard viewer DEM side foundations. Exact steel joints/panel fabrication, stained glass, hidden room/annex plans, structural engineering, inscriptions, sculpture, full interiors, neighboring halls, surveyed paving and certified walking excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:St._Mary%27s_Cathedral_Tokyo.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:20030702_2_July_2003_Tokyo_Cathedorale_3_Tange_Kenzou_Sekiguchi_Tokyo_Japan.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:20030702_2_July_2003_Tokyo_Cathedorale_Belfry_Tange_Kenzou_Sekiguchi_Tokyo_Japan.jpg)
- [Reference](https://culturenow.org/site/64695f04-4c41-41d4-b377-048b43e369a8)

Four existing shared256-square stainless steel, concrete, granite and plain wood graphs. Linear silver/beige tints, metric UVs and flat architectural normals. Closed glazing and bell accents use geometric PBR colors. No embedded images, bespoke facade textures or baked shadows.

## Model and axes

11,020 triangles; 33,060 vertices; 6 material groups; 1,326,044 bytes. Native bounds: -25.971, -0.410, -30.377 to 43.831, 62.001, 32.068. Source hash: `sha256:d5ae7c9140d64e144bad46d51a5874d6e516e30cf414769cb4536e623b328472`.

{"x":"east-southeast along cross skylight from long western arm to high eastern end","y":"up","z":"south-southwest toward detached belfry courtyard and separate long hall"}

Standard viewer DEM datum 30.944234m; display offset0.4m, mapped perimeter terrain -0.06..2.81m. Side footings follow coarse terrain. Bell base uses local DEM+0.15m; main entry steps/threshold estimate uses local DEM+0.2m with a short visual transition to shell floor. Exact courtyard grading, cuts/fills, steps/ramps/thresholds, absolute altitude and walking remain unverified. No global flattening or road replacement.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0371` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact-QID OSM way120704384/Q1193480 matches current main35184492793216. Its full45-vertex low-envelope plan and current12-vertex cross skylight part35184492793214 remain rigidly rotated, without rescaling; absent height/min_height on main and absent min_height on part remain absent. The part40m tag describes the narrow roof cross envelope, not a solid whole church. Retained39.4m fact controls main high eastern shell tip; center27.5m, western30m, north32m, south26.5m, low annex6m, panel valley feet and internal subdivisions are picture estimates. Eight ruled curved sails approximate the exterior, not engineering-exact hyperbolic paraboloids. Bell tower position[-13,16]m,3.2x2.6m footprint,61.6m auxiliary height, unequal blades/bells and8x8m courtyard pocket are picture/context estimates with5m position/5degree orientation uncertainty, not PMTiles controls or surveyed data. Tower height is separate from39.4m main shell fact. Derived Boolean inputs round0.1mm; raw plans stay exact.
- Standard viewer DEM datum 30.944234m; display offset0.4m, mapped perimeter terrain -0.06..2.81m. Side footings follow coarse terrain. Bell base uses local DEM+0.15m; main entry steps/threshold estimate uses local DEM+0.2m with a short visual transition to shell floor. Exact courtyard grading, cuts/fills, steps/ramps/thresholds, absolute altitude and walking remain unverified. No global flattening or road replacement.
- Medium-fi exterior from three useful Commons building/belfry photos, one architect aerial and current standard PMTiles/DEM only. Eight ruled surfaces approximate the hypar shells; steel panel fabrication/joints, exact structural geometry, glass artwork, modern hidden annex/interior plans, bell count/proportions, sculpture, inscriptions, neighboring halls, surveyed paving/thresholds and certified walking excluded or approximate. Belfry/courtyard are explicitly picture-estimated rather than mapped. Physical laptop/phone timing pending.
- Skyline keeps eight sails, cross slots, annexes and open belfry silhouette. District adds cached surfaces, wood doors and coarse glazing/bells. Street adds shell inner thickness, skylight mullions, recessed closed glazing and annex ribbon openings; closeup/master refine curve tessellation and bells. Synthetic cottage context is a review fixture.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.
