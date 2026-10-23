# 2005 Chevrolet SSR

![Molen preview](preview.png)

LS roadster pickup, roof lowered; pickup. Original polygonal reference interpretation for close-view driving.

Rounded authoring envelope: 4.862 × 1.996 × 1.631 m, excluding mirrors and rear spare; wheelbase 2.946 m. Geometry includes actual wheel openings, hollow cabin, seats, controls, mirrors, wipers, lamps and separate wheel/caliper transforms. Model-specific proportions and features are editable in models/recipe.json.

[Reference context](https://news.chevrolet.com/content/dam/company/no_search/heritage-archive-docs/vehicle-information-kits/chevrolet/2005-Chevrolet-SSR.pdf) — manufacturer material, including archived brochures where necessary. Sources establish generation/design context; not every authored dimension or trim detail is independently measured. No downloaded geometry or bitmap textures. Dashboard graphics and handling are simplified for play. The open roof is fixed in its lowered position; no roof animation. 

Generate: node packages/entities/scripts/generate-fleet.mjs --ids=chevrolet-ssr-2005. Import the resulting GLB using the source manifest ID. Capture: node packages/entities/scripts/capture-fleet.mjs --ids=chevrolet-ssr-2005. The shared generator is packages/entities/scripts/road-vehicle-geometry.mjs. Bulk renders stay in ignored shots/; see content/entities/VARIETY-VEHICLE-REVIEW.md for batch evidence.
