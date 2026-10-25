# 2025 Wuling Hongguang MINI EV

![Molen preview](preview.png)

Prompt: add diverse recent vehicles for China, Japan, Korea, Europe, South America and Africa, with detailed polygonal driving views and regional traffic weights. Primary target: china; shared model IDs can serve other markets.

Configuration: four-door model introduced in 2025. Authoring body target 3.256 × 1.51 × 1.578 m, wheelbase 2.19 m. Measurements are rounded reference targets, not a certified dimension sheet. +Y up, +Z forward, ground origin; left-hand steering/driver eye.

Reference: [manufacturer material](https://www.gm.com.cn/zh/home/newsroom.detail.html/Pages/news/cn/zh/2024/dec/1210-wuling.html). Sources inform shape and identity; model-year trim, upholstery, fittings and handling are simplified. Original geometry, no manufacturer CAD, downloaded meshes or bitmap textures. Display graphics are illustrative.

Geometry: hollow cabin, transparent glazing, individual seats, door cards, belts, vents, controls, pedal boxes, wipers, mirror faces, tire sidewalls, wheel spokes, fixed brakes, grille and lamp optics. Named wheel and steering pivots support gameplay. Doors remain static. Budget: 32,000 triangles and 2 MiB per imported GLB.

Build: node packages/entities/scripts/generate-fleet.mjs --ids=wuling-hongguang-mini-ev-2025
Import: molen asset import source/vehicles/wuling-hongguang-mini-ev-2025/models/source.glb --id molen.entities.vehicle.wuling_hongguang_mini_ev_2025 --project content/entities/project.json
Verify: molen asset inspect molen.entities.vehicle.wuling_hongguang_mini_ev_2025 --project content/entities/project.json --verify

See REGIONAL-VEHICLES.md and regional-vehicles-review.json in the entities pack for the batch roster, hash-bound review and capture commands. Bulk captures remain in ignored shots/.
