# Vehicle variety review — 2026-10-20

Forty additional real vehicle identities from 2005–2024, all mountable and drivable. [Roster and usage](VARIETY-VEHICLES.md). Source recipes, imported models and camera evidence are recorded in [variety-vehicle-review.json](variety-vehicle-review.json).

## Final batch

- 14,745–20,538 triangles and 26–31 material primitives per model.
- 21.25 MiB across the forty runtime GLBs; no bitmap textures.
- All source pins, imported source/runtime hashes and capture hashes agree.
- The earlier fleet remains byte-identical under the shared generator reproducibility check.
- Four exterior angles plus neutral scene and exact driver-eye views per model; bulk images remain local. [Exterior preview](variety-vehicles-preview.png) and [interior preview](variety-vehicle-interiors-preview.png).

## Visual review

The collection spans city cars, wagons, retro hatchbacks, roadsters, coupes, sedans, utility vehicles, pickups and cargo vans. New opt-in geometry includes open passenger cells and roll hoops, solid van cargo panels/partitions, distinct windshield heights, sculpted fenders, contrast roofs, split/triangular grilles, quad lamps, pixel lamps, vertical oval lamps and period radio/dial layouts. Cabins retain seats, belts, door cards, vents, pedals, consoles, mirrors and steering controls.

Reviewed exterior silhouettes, front/rear fittings, wheel openings, driver sightlines and instrument visibility. Corrections included lowering dashboards that intersected windscreens, raising instrument pods above lowered dashboards, separating cargo-van roof and windshield heights, adjusting the Smart front overhang, and conforming hood stripes to sculpted bodywork. Geometry remains deliberately polygonal; trim, cabin layouts and handling are simplified reference interpretations rather than exact factory reconstructions.

Doors, roofs, tailgates and cargo doors do not animate. Open-top cars use a fixed lowered-roof state. Digital displays are illustrative; analog speed needles and steering are bound where present. Near masters rely on host proxy/distance policies rather than separate GLB LOD files.

## Checks

Passed:

```sh
pnpm --filter @bendyline/molen-entities build
pnpm --filter @bendyline/molen-entities typecheck
pnpm --filter @bendyline/molen-entities lint
pnpm --filter @bendyline/molen-entities test:unit
pnpm --filter @bendyline/molen-earth test:unit
node packages/entities/scripts/generate-fleet.mjs --check
```

Entity tests: **366 passed**. Earth tests: **136 passed**. All forty new vehicles are covered for boarding, acceleration, steering, braking, reverse and exit, plus geometry bounds, animation nodes and import hashes. Every new asset passed import and verification. The local World Explorer entity pack was rebuilt. The targeted model workflow was used; repository-wide engine/release CI was not rerun.

Capture command: `node packages/entities/scripts/capture-fleet.mjs --ids=<comma-separated slugs from source/variety-vehicles.json>`, with `PLAYWRIGHT_BROWSERS_PATH` pointing at installed Chromium. Build outputs and bulk review captures are local, with no upload or publication.
