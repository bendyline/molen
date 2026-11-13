# Bendy E-Moped

Original brief: more representative personal and shared vehicles around the world: tuk-tuks, scooters and mopeds, skateboards and shared electric kick scooters.

Editable recipe: models/recipe.json. Shared engine authoring capability: packages/entities/scripts/light-vehicles.mjs, built with the cycle tools of fleet-geometry.mjs. Regenerate in the engine repository with `node packages/entities/scripts/generate-fleet.mjs --ids=electric-moped`. The frame in light-vehicles.mjs owns the rider contacts this bundle's grips, footrests, seat and eye repeat.

Dimensions: 1.78 m long × 0.68 m wide × 1.12 m; 1.3 m wheelbase on 12-inch cast wheels; floor 0.3 m, seat 0.8 m. +Y up, +Z forward; tyres contact Y=0. The battery scooter of Chinese, Taiwanese and Southeast Asian streets: a squared apron with a lamp bar, a flat floor over the battery tray, a slim tail with a carrier, a rear hub motor on a single-sided arm and a basket on the bars. A generic design, not a licensed make.

Rideable through `installVehicles` and the shared mount/drive/exit API. The driver seat anchors the pelvis; grips and floor footrests drive the rider pose. Self-balancing handling leans into turns. Silent: no engine sound. No reverse.
