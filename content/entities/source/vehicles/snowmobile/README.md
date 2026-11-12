# Bendy Sled

Original brief: snow cover for the world, with skis, a snowboard and a snowmobile to ride on it, good enough to ski down Mount Rainier.

Editable recipe: models/recipe.json. Shared engine authoring capability: packages/entities/scripts/snow-vehicles.mjs, built with the cycle tools of fleet-geometry.mjs. Regenerate in the engine repository with `node packages/entities/scripts/generate-fleet.mjs --ids=snowmobile`. The frame in snow-vehicles.mjs owns the rider contacts this bundle's grips, footrests, seat and eye repeat.

Dimensions: a 2.9 m two-up trail snowmobile, 1.15 m wide over the skis (1.0 m between their spindles), seat at 0.70 m, windscreen top at 1.1 m; a 0.38 m lugged track running 1.3 m on the snow under a tunnel with running boards; a cowl over the engine with a headlamp in its nose; two 1.06 m skis on double wishbones with coil-over shocks. +Y up, +Z forward; skis and track on Y=0. A generic sled, not any maker's styling or colours.

Drivable through `installVehicles` on the car solver, with `spec.handlebar` giving the driver's hand and foot contacts and a passenger seat behind. `vehicle.spec.runners` suits it to snow: on the weather's lying snow (`weather.snowCover`) the track's paddles hold the full `grip`, it floats over any depth where wheeled vehicles bog down, and it coasts down against 0.12 of its weight; off the snow it drags at 2.2 m/s² but still drives. The skis (`ski-left`, `ski-right`) and the `handlebar` turn with the steering. Traction and stability control are off: full power spins the track.
