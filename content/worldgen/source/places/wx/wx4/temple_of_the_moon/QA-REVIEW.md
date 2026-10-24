# temple_of_the_moon — Temple of the Moon

Reviewed 2026-10-19 in one continuous author/build/inspect/fix round.

![Temple of the Moon](preview.png)

## Appearance

Inspected52 current source/shared/medium-fi/native/fallback views in the same construction round. Standing Yuetan heritage compound: red bell tower with separate lower eave/large green hip-and-gable upper roof, true round ground passage and recessed upper lattice; three-arch red roofed park gate with open center and closed studded side leaves; mapped west hall with swept green roof and six recessed lattice panels. Gray inner enclosure/three blocked pale stone Lingxing portals and short red northern wall runs. First views prompted more specific hip-and-gable roofs, stronger ridge scrolls/painted bands, supported stone gate footings and joining the roofed gate to its wing walls. Original abstract beam/finial/ridge vocabulary, no copied text/story/sculpture atlas. No hypothetical intact altar reconstruction.

## Shared materials and browser levels

Five existing256-square graphs: plaster_lime, stone_limestone_raw, tile_ceramic, wood_plain and metal_bronze_cast. Eleven authored roles/tints merge to at most five runtime draws; plain wood grain is reused under red/blue/green/gold paint tints. Metric UVs and linear tints, each graph loaded once, zero embedded images. Master6490triangles/782216bytes. Four levels899/2846/5914/6490; initial371324bytes. Separate GPU streams and matching CPU/GPU accounting; eviction releases model geometry. Flat shared stage at anchor datum can bury negative-offset lower rooms; source/native terrain views show complete buildings with these same shared graphs.

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 899 | 95500 | 1 |
| district | 2846 | 275824 | 4 |
| street | 5914 | 574488 | 5 |
| closeup | 6490 | 629784 | 5 |

Inspected current noon/late/economy/high, context/silhouette, four levels/transitions and four detail views. Skyline retains double roofs, actual bell/central gate passages and three blocked stone portals; closed side gate arches and hall door fields simplify at distance. District adds hip-and-gable roofs/ridge scrolls and painted beam bands; street/close-up add lattice/studs and denser ornament. Palette remains coherent. Flat shared stage hides much of the lower hall and gate because their floors lie below anchor datum; terrain-bearing source/native and medium-fi views, plus actual approach/footing probes, establish contact. Independent procedural buildings, landscaping, paths and water are host context.

## Approximate map fit

Bell Tower POI/building35184978202234 and Yuetan Park POI/landuse35184604818092 correlate candidateQ680679; no exact-QID heritage footprint claim. Three actual roof controls35184978202234/35185035849079/35184978202235 fix bell, northern park gate and west hall. Anchor116.346005,39.915867, heading0/native east-south axes. Each building uses its measured near-east-west roof axis; bell/hall front approximately south, park gate north-facing/two-sided. Historical gate/hall name allocation is approximate: gate picture English North/Chinese South captions conflict. Inner70x82m enclosure and west-facing Lingxing gate centered[-38,-15] lack separately mapped footprints: picture-led allocation inside open northern park, roughly25m/20degree uncertainty. Replace only three corresponding shells with2cm tolerance, zero residual. All155 independent resident inputs, original6m ground/paths and237.34572390280664m2 native water retained. Loaded155 native records, failed load158 full originals; unload restores surfaces and frees geometry. Individually buried occupied footings/short approaches and grade-following narrow walls only; no broad park slab, flattening or ground/water cutout.

## Limits

Accepted medium-fi from four inspected ordinary2009 bell/gate/hall/Lingxing photographs plus standard PMTiles/Mapzen, carried into the same build/inspection round. This is the standing heritage-building model; the no-longer-intact altar is not reconstructed. Modern lattice transmission mast, southern park garden pavilions/landscaping and hidden ritual interiors are outside this model and remain host context, not claimed as authored. Roof/capital/ridge/painted-beam/door/stud inventories, heights and absolute thresholds are approximate. Main three roof locations/axes are map-controlled, gate/hall historical names and unmapped inner enclosure/portal allocation explicitly uncertain. Lingxing portals are deliberately blocked as pictured. Coarse terrain produces negative datum-relative floors and cannot resolve paving; flat review stages can bury lower rooms while terrain-bearing views establish fit. No source pixels/text/sculpture copied. Physical-device/dense-city timings remain pending.

## Selected checks

Six Khronos files: zero errors/warnings.209 actual mesh/contact probes; 52 current inspected views. Scene validation/sim30 and strict selected medium-fi audit pass. Source and runtime hashes/material bindings/LOD caps verified.

Rebuild: node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=temple_of_the_moon; node packages/worldgen/scripts/import-structure-models.mjs --ids=temple_of_the_moon; node packages/tooling/scripts/generate-landmark-lods.mjs --ids=temple_of_the_moon --force.

Source: sha256:f0a82e615a606027f65d289c269f0994f1cf656a0901d3cd22a1e9fc08fd9848

Runtime: sha256:d608070f9f14017c34827cee71aa5458b667f05f76f9c5bb498337b3ae4f77cf

Input: sha256:d30b456093e2be9f015e7e24b927bb14c83a7623514685d103e07f332accd90b

## Viewed ordinary pictures

https://commons.wikimedia.org/wiki/File:Bell_Tower(Temple_of_Moon).JPG — Dirrival; CC-BY-SA-3.0 / GFDL. Viewed only; no pixels copied.

https://commons.wikimedia.org/wiki/File:North_Holy_Gate_(Temple_of_Moon).JPG — Dirrival; CC-BY-SA-3.0 / GFDL. Viewed only; no pixels copied.

https://commons.wikimedia.org/wiki/File:Dressing_Hall(Temple_of_Moon).JPG — Dirrival; CC-BY-SA-3.0 / GFDL. Viewed only; no pixels copied.

https://commons.wikimedia.org/wiki/File:Lingxing_Gate(Temple_of_Moon).JPG — Dirrival; CC-BY-SA-3.0 / GFDL. Viewed only; no pixels copied.
