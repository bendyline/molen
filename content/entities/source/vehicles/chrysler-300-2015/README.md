# 2015 Chrysler 300

![Molen preview](preview.png)

300C sedan; sedan. Original polygonal reference interpretation for close-view driving.

Rounded authoring envelope: 5.044 × 1.902 × 1.483 m, excluding mirrors and rear spare; wheelbase 3.052 m. Geometry includes actual wheel openings, hollow cabin, seats, controls, mirrors, wipers, lamps and separate wheel/caliper transforms. Model-specific proportions and features are editable in models/recipe.json.

[Reference context](https://www.chrysler.com/assets/pdf/brochures/2015_chrysler_300_reveal.pdf) — manufacturer material, including archived brochures where necessary. Sources establish generation/design context; not every authored dimension or trim detail is independently measured. No downloaded geometry or bitmap textures. Dashboard graphics and handling are simplified for play. 

Generate: node packages/entities/scripts/generate-fleet.mjs --ids=chrysler-300-2015. Import the resulting GLB using the source manifest ID. Capture: node packages/entities/scripts/capture-fleet.mjs --ids=chrysler-300-2015. The shared generator is packages/entities/scripts/road-vehicle-geometry.mjs. Bulk renders stay in ignored shots/; see content/entities/VARIETY-VEHICLE-REVIEW.md for batch evidence.
