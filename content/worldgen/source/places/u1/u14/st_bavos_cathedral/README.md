# St Bavo's Cathedral

![Molen preview](preview.png)

Individual St Bavo's Cathedral, Ghent: stepped pale stone west tower with deeply pointed entrance, large lower window, middle paired lancet tiers, tall upper field, four89m corner pinnacles and smaller dark central crown; no long central needle. Long slate-roofed nave/polygonal eastern choir with tall pointed clerestory, lean aisles, low irregular chapel ring/ranges, high transept with four46m turrets and two smaller western stair turrets. Shared ashlar/limestone/slate/wood, linear tints, metric UVs, flat architectural normals and four browser tiers. Standard terrain foundations. Exact sculpture/carvings/inscriptions/tracery/stained-glass artwork, crypt/interiors, adjoining town/paving, modern doorway surveys and certified walking excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Saint_Bavo%27s_Cathedral_viewed_from_the_Belfry_of_Ghent,_Belgium,_2025.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Gent._Kathedraal_Sint-Baafs_Exterieur_Algemeen_zicht_vanuit_het_zuidoosten,_van_hogerop,_GD010611.jpg)

Four existing shared256-square ashlar/limestone/slate/plain wood graphs, pale stone/slate linear tints, metric UVs and flat normals. Window/vault fields use flat geometric PBR colors. No embedded images, bespoke facade textures or baked shadows.

## Model and axes

10,793 triangles; 32,379 vertices; 6 material groups; 1,298,772 bytes. Native bounds: -60.946, -1.644, -25.137 to 60.608, 89.400, 24.960. Source hash: `sha256:b800e2fe7ff3fa590938661015315261ff7443b354f317c0fa437080349f9664`.

{"x":"east-southeast from western tower to round east choir","y":"up","z":"south-southwest toward south transept"}

Standard viewer DEM datum 17.738603m; display offset 0.4m, raw mapped perimeter terrain -1.01..0.51m. Side foundations follow coarse viewer terrain; estimated main portal uses local DEM+0.22m and secondary doors use floor+0.2m. Exact Sint-Baafsplein paving, steps/ramps/thresholds, absolute altitude and walking remain unverified. No global flattening or road replacement.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=st_bavos_cathedral` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Exact-QID way105192350/Q938154 matches current main35184477281182. All22 raw main/part plans/tags, including absent min_height, remain intact. Retained89m fact agrees with four main tower corner pinnacle controls89m; central upper core78m/crown83m, broad lower tower60m, nave/round choir/transept43m, four transept turrets46m, aisles/west chapels26m and two front turrets29m are whole component envelopes, not stacked wall solids. Main14m is interpreted as the low surrounding chapel envelope. Picture estimates subdivide these: high eaves34m/ridges43m, aisle walls18m/roof joins26m, low chapel eaves10m/roofs14m, west shaft18..60m plus upper core60..78m, crown roof78..83m, corner shafts to78m/cones89m, transept turret shafts38m/cones46m and front turret shafts22m/cones29m. Derived Boolean inputs round0.1mm; raw geometry rotates rigidly with no rescale. Entry, fenestration, turret subdivisions and modern hidden roof/chapel details are approximate.
- Standard viewer DEM datum 17.738603m; display offset 0.4m, raw mapped perimeter terrain -1.01..0.51m. Side foundations follow coarse viewer terrain; estimated main portal uses local DEM+0.22m and secondary doors use floor+0.2m. Exact Sint-Baafsplein paving, steps/ramps/thresholds, absolute altitude and walking remain unverified. No global flattening or road replacement.
- Medium-fi exterior from June2025 western picture, one undated historical southeast architectural picture and current standard PMTiles/DEM only. The old picture is used solely for visible building proportions; modern hidden roofs/chapels, north fenestration and doorway/paving levels remain approximate. Fine stone carving/sculpture/inscriptions, exact stained glass/tracery/parapets, town/roof furniture, full interiors/crypt and certified walking excluded. Tower glazing uses closed dark panels; the entrance has a dark vault backing and lower wood door. Physical device timing pending.
- Skyline preserves roof/chapel forms, stepped tower/four corner pinnacles, smaller central crown and front/transept turrets. District adds shared surfaces, flat pointed fields and support rhythm. Street opens facade/portal recesses with mullions and coarse flying supports; closeup/master refine nested entrance surrounds, tracery and pinnacle bands. Synthetic cottage context is a review fixture.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.
