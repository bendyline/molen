# Stratford regional station

Reviewed 2026-11-02. **Geometry and browser tiers built; native terrain fit pending. This model is not counted ready.**

The source covers the regional interchange: its sweeping hall roof, sloped glazing, Meridian Square entrance, eight other canopy sections, service shelters, eastern lift/entry and complete open-top public footbridge. The detailed master remains separate from the four browser tiers. Stratford International, Westfield, neighbouring towers, bus station and independent streets remain separate.

Three ordinary exterior photographs and standard PMTiles establish the physical fit. Anchor: [-0.003716824948567502,51.54138049458524]; heading: 0.7853981633974483. +X points northeast along the main line; +Z points southeast toward Meridian Square and the southern branches. The footbridge follows mapped path 35184502965940. The production test replaces exactly 20 of 2,707 building components, preserving all 2,687 neighbours, roads and water features.

This continuous pass corrected the roof envelope over mapped service notches and the sloped glass facade. All 43 final views were inspected: nine portable, nine with shared materials and 25 with standard terrain, lighting variants and explicit LOD views. Four focused tests pass. All six GLBs pass the Khronos validator without errors or warnings. Scene validation and 30 simulation ticks pass.

The detailed source has 88,887 triangles and 10,670,340 bytes. Browser tiers have 732 / 3,757 / 12,767 / 39,221 triangles. Skyline plus district download: 406,180 bytes. Close-up: 3,506,932 bytes. Five existing 256px material graphs are actually bound: limestone, granite, standing-seam metal, painted metal and window grid. Six near material groups arise from painted metal occupying two semantic slots. The declared membrane surface is unused and loads no runtime texture. There are no embedded or private images. Geometry uses metric UVs, linear colours and separate GPU streams. Unloading disposes geometry and restores the ground.

Four unchanged global Terrarium tiles supply the field. The common datum is 5.109632m at the outside Meridian Square sample [85,60]; the hall floor is 0.65m above it. Its 162 boundary samples range from 1.936m above the field to 0.366m below. Entry sample [75,52] is 0.883m above the field. Only the actual inset hall floor receives a ground mask; all nine opening probes remain uncovered and source field values unchanged.

**Placement remains pending because the field covers parts of the platform floors and rail sections outside that mask.** At [0,-20], the platform floor is approximately 1.854m below the field, although the canopy eave remains 2.396m above it. The footbridge floor at [95,-40] is 5.655m above the field. Platform grades, southern underground branches, rail clearance and accessible entrance transitions remain approximate. This pass did not flatten the site or add a blanket ground opening across the railway.

Roof sections, hidden facades, frame counts and stairs are medium-fi interpretations. No navigable underground interior, trains, people, advertisements, roundels or lettering are included. Physical laptop/phone and dense-city timings, and numerical LOD errors, remain unmeasured.

Rebuild: node packages/worldgen/scripts/generate-stratford-station.mjs; append --check to verify exact source bytes. Import/LOD/placement select --ids=stratford_railway_station. GLBs remain ignored outputs. Canonical source is authoritative; ignored preparation scripts may predate final corrections.
