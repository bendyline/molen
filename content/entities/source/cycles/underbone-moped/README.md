# Bendy Moped

Original brief: more representative personal and shared vehicles around the world: tuk-tuks, scooters and mopeds, skateboards and shared electric kick scooters.

Editable recipe: models/recipe.json. Shared engine authoring capability: packages/entities/scripts/light-vehicles.mjs, built with the cycle tools of fleet-geometry.mjs. Regenerate in the engine repository with `node packages/entities/scripts/generate-fleet.mjs --ids=underbone-moped`. The frame in light-vehicles.mjs owns the rider contacts this bundle's grips, footrests, seat and eye repeat.

Dimensions: 1.92 m long × 0.7 m wide × 1.08 m; 1.24 m wheelbase on 17-inch spoked wheels; seat 0.78 m. +Y up, +Z forward; tyres contact Y=0. The 100–125 cc underbone of South and Southeast Asia, China and Africa: a step-through backbone under a plastic tunnel, broad leg shields, a horizontal single-cylinder engine, telescopic fork, a chain case and twin shocks, a long dual seat and a rack. A generic design, not a licensed make.

Rideable through `installVehicles` and the shared mount/drive/exit API. The driver seat anchors the pelvis; grips and footrests drive the rider pose. Self-balancing handling leans into turns. No reverse.
