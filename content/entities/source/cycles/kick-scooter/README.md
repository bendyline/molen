# Bendy Share Scooter

Original brief: more representative personal and shared vehicles around the world: tuk-tuks, scooters and mopeds, skateboards and shared electric kick scooters.

Editable recipe: models/recipe.json. Shared engine authoring capability: packages/entities/scripts/light-vehicles.mjs, built with the cycle tools of fleet-geometry.mjs. Regenerate in the engine repository with `node packages/entities/scripts/generate-fleet.mjs --ids=kick-scooter`. The frame in light-vehicles.mjs owns the rider contacts this bundle's grips, footrests, seat and eye repeat.

Dimensions: 1.17 m long × 0.55 m across the bars × 1.2 m to the bars; 0.88 m wheelbase on 10-inch-class pneumatic tyres; deck top 0.16 m. +Y up, +Z forward; tyres contact Y=0. A dockless shared scooter of the common class: a thick battery deck, a raked stem with a display, bell, brake lever and thumb throttle, fenders front and rear, a kickstand and a stem plate with a scan code. A generic design, not any operator's livery or emblem: its two liveries follow photographs of privately owned scooters (black and graphite), and the stem plate carries only BENDY and a scan code.

Rideable through `installVehicles` and the shared mount/drive/exit API. `cycle.stance` is `standing`: the rider stands on the deck, left foot ahead, hands on the grips; the pose fits the hips to each body's legs. Self-balancing handling leans into turns. No reverse.
