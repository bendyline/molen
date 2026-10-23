# 2024 Fiat Strada

![Molen preview](preview.png)

Prompt: add diverse recent vehicles for China, Japan, Korea, Europe, South America and Africa, with detailed polygonal driving views and regional traffic weights. Primary target: south-america; shared model IDs can serve other markets.

Configuration: double cab. Authoring body target 4.48 × 1.732 × 1.595 m, wheelbase 2.737 m. Measurements are rounded reference targets, not a certified dimension sheet. +Y up, +Z forward, ground origin; left-hand steering/driver eye.

Reference: [manufacturer material](https://www.media.stellantis.com/br-pt/fiat/fiat-strada-my-2024). Sources inform shape and identity; model-year trim, upholstery, fittings and handling are simplified. Original geometry, no manufacturer CAD, downloaded meshes or bitmap textures. Display graphics are illustrative.

Geometry: hollow cabin, transparent glazing, individual seats, door cards, belts, vents, controls, pedal boxes, wipers, mirror faces, tire sidewalls, wheel spokes, fixed brakes, grille and lamp optics. Named wheel and steering pivots support gameplay. Doors remain static. Budget: 32,000 triangles and 2 MiB per imported GLB.

Build: node packages/entities/scripts/generate-fleet.mjs --ids=fiat-strada-2024
Import: molen asset import source/vehicles/fiat-strada-2024/models/source.glb --id molen.entities.vehicle.fiat_strada_2024 --project content/entities/project.json
Verify: molen asset inspect molen.entities.vehicle.fiat_strada_2024 --project content/entities/project.json --verify

See REGIONAL-VEHICLES.md and regional-vehicles-review.json in the entities pack for the batch roster, hash-bound review and capture commands. Bulk captures remain in ignored shots/.
