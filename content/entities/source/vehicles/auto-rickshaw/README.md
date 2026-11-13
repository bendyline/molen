# Bendy Auto

Original brief: more representative personal and shared vehicles around the world: tuk-tuks, scooters and mopeds, skateboards and shared electric kick scooters.

Editable recipe: models/recipe.json. Shared engine authoring capability: packages/entities/scripts/light-vehicles.mjs, built with the cycle tools of fleet-geometry.mjs. Regenerate in the engine repository with `node packages/entities/scripts/generate-fleet.mjs --ids=auto-rickshaw`. The frame in light-vehicles.mjs owns the driver contacts this bundle's grips, footrests, seat and eye repeat.

Dimensions: 2.63 m long × 1.3 m wide × 1.76 m; 2.0 m wheelbase, 1.15 m rear track, 8-inch wheels. +Y up, +Z forward; tyres contact Y=0. The rear-engined passenger three-wheeler of India and South Asia, also common in East Africa, Egypt and Southeast Asia: a steel body in the paint colour under a yellow canvas canopy with rolled side curtains, open sides, a nose cowl over the single steered front wheel with its leading-link suspension, a windscreen with one wiper, handlebar steering, a driver's saddle, a three-seat rear bench and a fare meter. A generic design, not a licensed make; the plates read MLN 3W.

Drivable through `installVehicles`: the car solver on three wheels, driven at the rear, with reverse. `spec.handlebar` places the driver's hands and feet, with the saddle as the pelvis anchor; the two rear passengers sit as in a car. `ambientRole.weight` is 0: it is never a default pick, and appears only where a fleet profile weights it.
