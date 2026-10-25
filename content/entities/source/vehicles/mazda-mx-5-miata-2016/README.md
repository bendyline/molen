# 2016 Mazda MX-5 Miata

![Molen preview](preview.png)

Club roadster, roof lowered; roadster. Original polygonal reference interpretation for close-view driving.

Rounded authoring envelope: 3.914 × 1.735 × 1.234 m, excluding mirrors and rear spare; wheelbase 2.309 m. Geometry includes actual wheel openings, hollow cabin, seats, controls, mirrors, wipers, lamps and separate wheel/caliper transforms. Model-specific proportions and features are editable in models/recipe.json.

[Reference context](https://news.mazdausa.com/download/2016_Mazda_MX-5_Press_Kit.pdf) — manufacturer material, including archived brochures where necessary. Sources establish generation/design context; not every authored dimension or trim detail is independently measured. No downloaded geometry or bitmap textures. Dashboard graphics and handling are simplified for play. The open roof is fixed in its lowered position; no roof animation. 

Generate: node packages/entities/scripts/generate-fleet.mjs --ids=mazda-mx-5-miata-2016. Import the resulting GLB using the source manifest ID. Capture: node packages/entities/scripts/capture-fleet.mjs --ids=mazda-mx-5-miata-2016. The shared generator is packages/entities/scripts/road-vehicle-geometry.mjs. Bulk renders stay in ignored shots/; see content/entities/VARIETY-VEHICLE-REVIEW.md for batch evidence.
