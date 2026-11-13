# Bendy Skateboard

Original brief: more representative personal and shared vehicles around the world: tuk-tuks, scooters and mopeds, skateboards and shared electric kick scooters.

Editable recipe: models/recipe.json. Shared engine authoring capability: packages/entities/scripts/light-vehicles.mjs, built with the cycle tools of fleet-geometry.mjs. Regenerate in the engine repository with `node packages/entities/scripts/generate-fleet.mjs --ids=skateboard`. The frame in light-vehicles.mjs owns the rider contacts this bundle's grips, footrests, seat and eye repeat.

Dimensions: 0.8 m × 0.21 m popsicle deck with kicktails, 0.36 m between the trucks, 53 mm urethane wheels; deck top about 0.09 m. +Y up, +Z forward; wheels contact Y=0. Seven-ply maple edge, grip tape and mounting bolts above, a painted graphic beneath; trucks with baseplates, kingpins, bushings, hangers and axles. A generic board, not any maker's graphic.

Rideable through `installVehicles`. `cycle.stance` is `sideways`: the rider stands across the deck, left foot forward over the front bolts, and looks down the board. `cycle.kick` makes it push-powered: under power the rider turns forward and pushes off with the rear foot once per 2.2 m, then rides sideways again. Both trucks turn with the steering; the board leans into turns. No reverse.
