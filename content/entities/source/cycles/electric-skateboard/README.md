# Bendy E-Board

Original brief: more representative personal and shared vehicles around the world: tuk-tuks, scooters and mopeds, skateboards and shared electric kick scooters.

Editable recipe: models/recipe.json. Shared engine authoring capability: packages/entities/scripts/light-vehicles.mjs, built with the cycle tools of fleet-geometry.mjs. Regenerate in the engine repository with `node packages/entities/scripts/generate-fleet.mjs --ids=electric-skateboard`. The frame in light-vehicles.mjs owns the rider contacts this bundle's grips, footrests, seat and eye repeat.

Dimensions: 0.97 m × 0.25 m deck with a small kicktail, 0.66 m between the trucks, 90 mm wheels; deck top about 0.12 m. +Y up, +Z forward; wheels contact Y=0. A battery enclosure under the deck with its power button, a motor on the rear hanger driving the right rear wheel through a guarded belt. A generic board, not any maker's design.

Rideable through `installVehicles`. `cycle.stance` is `sideways`: the rider stands across the deck, left foot forward, and looks down the board. Both trucks turn with the steering; the board leans into turns and brakes by its motor. No reverse.
