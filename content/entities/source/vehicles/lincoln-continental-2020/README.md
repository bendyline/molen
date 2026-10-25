# 2020 Lincoln Continental

![Molen preview](preview.png)

Reserve sedan; sedan. Original polygonal reference interpretation for close-view driving.

Rounded authoring envelope: 5.116 × 1.913 × 1.487 m, excluding mirrors and rear spare; wheelbase 2.994 m. Geometry includes actual wheel openings, hollow cabin, seats, controls, mirrors, wipers, lamps and separate wheel/caliper transforms. Model-specific proportions and features are editable in models/recipe.json.

[Reference context](https://media.lincoln.com/content/dam/lincolnmedia/lna/us/product/2017/continental/17CON_TechSpecs_R04.pdf) — manufacturer material, including archived brochures where necessary. Sources establish generation/design context; not every authored dimension or trim detail is independently measured. No downloaded geometry or bitmap textures. Dashboard graphics and handling are simplified for play. 

Generate: node packages/entities/scripts/generate-fleet.mjs --ids=lincoln-continental-2020. Import the resulting GLB using the source manifest ID. Capture: node packages/entities/scripts/capture-fleet.mjs --ids=lincoln-continental-2020. The shared generator is packages/entities/scripts/road-vehicle-geometry.mjs. Bulk renders stay in ignored shots/; see content/entities/VARIETY-VEHICLE-REVIEW.md for batch evidence.
