# Bendy Snowboard

Original brief: snow cover for the world, with skis, a snowboard and a snowmobile to ride on it, good enough to ski down Mount Rainier.

Editable recipe: models/recipe.json. Shared engine authoring capability: packages/entities/scripts/snow-vehicles.mjs, built with the cycle tools of fleet-geometry.mjs. Regenerate in the engine repository with `node packages/entities/scripts/generate-fleet.mjs --ids=snowboard`. The frame in snow-vehicles.mjs owns the rider contacts this bundle's grips, footrests, seat and eye repeat.

Dimensions: a 1.56 m twin-tip all-mountain board, 250 mm at the waist and 294 mm at the contact points, tip and tail turned up 6 cm; two strap bindings 0.52 m apart in a duck stance (+15° front, -9° rear) with baseplates, heel cups, highbacks and ankle and toe straps; a stomp pad between them. +Y up, +Z toward the nose; the base lies on Y=0. A generic board, not any maker's graphic.

Rideable through `installVehicles`. `vehicle.spec.runners` makes it slide: on the weather's lying snow (`weather.snowCover`) friction is 0.055 of its weight, its edges hold the full `grip`, and gravity along the slope moves it from a stand unless the brake is on; off the snow it scrapes to a stop. `cycle.stance` is `sideways`: the rider stands across the board, left foot forward, and looks down it. `cycle.kick` skates it along the flat: under power the rider turns forward and pushes with the rear foot, to 3.5 m/s. The board leans into turns. No reverse.
