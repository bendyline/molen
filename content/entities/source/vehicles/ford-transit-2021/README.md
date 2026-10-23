# 2021 Ford Transit

![Molen preview](preview.png)

T-250 cargo, regular length, medium roof; cargo-van. Original polygonal reference interpretation for close-view driving.

Rounded authoring envelope: 5.585 × 2.065 × 2.55 m, excluding mirrors and rear spare; wheelbase 3.3 m. Geometry includes actual wheel openings, hollow cabin, seats, controls, mirrors, wipers, lamps and separate wheel/caliper transforms. Model-specific proportions and features are editable in models/recipe.json.

[Reference context](https://media.ford.com/content/dam/fordmedia/North%20America/US/product/2021/transit/21Transit_TechSpecs.pdf) — manufacturer material, including archived brochures where necessary. Sources establish generation/design context; not every authored dimension or trim detail is independently measured. No downloaded geometry or bitmap textures. Dashboard graphics and handling are simplified for play. The cargo area has solid panels and a cab partition; doors do not open. 

Generate: node packages/entities/scripts/generate-fleet.mjs --ids=ford-transit-2021. Import the resulting GLB using the source manifest ID. Capture: node packages/entities/scripts/capture-fleet.mjs --ids=ford-transit-2021. The shared generator is packages/entities/scripts/road-vehicle-geometry.mjs. Bulk renders stay in ignored shots/; see content/entities/VARIETY-VEHICLE-REVIEW.md for batch evidence.
