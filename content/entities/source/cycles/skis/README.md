# Bendy Skis

Original brief: snow cover for the world, with skis, a snowboard and a snowmobile to ride on it, good enough to ski down Mount Rainier.

Editable recipe: models/recipe.json. Shared engine authoring capability: packages/entities/scripts/snow-vehicles.mjs, built with the cycle tools of fleet-geometry.mjs. Regenerate in the engine repository with `node packages/entities/scripts/generate-fleet.mjs --ids=skis`. The frame in snow-vehicles.mjs owns the rider contacts this bundle's grips, footrests, seat and eye repeat.

Dimensions: a pair of 1.70 m all-mountain skis, 84 mm at the waist and 118 mm at the shovel, 0.26 m apart, with tips turned up 6 cm; alpine bindings on riser plates (toe piece, anti-friction pad, heel piece with its lever, brake arms); two 1.07 m poles with grips, straps, baskets and tips. +Y up, +Z forward; the bases lie on Y=0. A generic pair, not any maker's graphic.

Rideable through `installVehicles`. `vehicle.spec.runners` makes them slide: on the weather's lying snow (`weather.snowCover`) friction is 0.05 of their weight, their edges hold the full `grip`, and gravity along the slope moves them from a stand unless the brake is on; off the snow they scrape to a stop. `cycle.stance` is `standing`: the rider stands over the bindings with a hand on each pole. Poles stand planted at rest and swing back in the hands once moving (`pole-left`, `pole-right`, bound to speed); the `handlebar` group carries them round with the steering. Throttle poles along the flat to 4.5 m/s; steering carves; brake or back-throttle stops on the edges. No reverse.
