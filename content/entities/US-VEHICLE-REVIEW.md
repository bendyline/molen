# U.S. vehicle review — 2026-10-20

Forty new original polygonal road vehicles, alongside the existing Bendy collection. [Roster and usage](US-VEHICLES.md). All forty are mountable and drivable; the geometry, cabin and controls share one GLB per vehicle.

## Final batch

- 14,465–20,564 triangles per model; 26–29 material primitives per imported master.
- 21.53 MiB of runtime GLBs for all forty. No bitmap textures.
- Source recipes, source model pins, imported model hashes and capture hashes agree. [Machine-readable evidence](us-vehicle-review.json).
- Named steering pivots, wheel spin nodes and fixed brake calipers; steering controls animate in the shared cabin. Analog speed needles bind to speed where present.
- Four exterior views and neutral-lit scene/driver-eye renders captured per model. Bulk images remain in ignored `shots/` directories; [summary preview](us-vehicles-preview.png).

## Review and corrections

Reviewed silhouettes, front/rear fitting placement, wheel openings, clear driver sightlines and cabin visibility. Refinements included rounded nose/roof surfaces, bowed glazing, conforming grille surfaces, separate pickup beds, rear pillar lamps, actual wheel arch openings, and moving the driver eye behind steep windscreens. Cabins include seats/headrests, door cards, belts, vents, pedals, consoles, mirrors and steering wheels. Grille/lamp patterns, roof and wheelbase proportions, pickup bed lengths, off-road spares, minivan sliding-door rails and dashboard layouts vary by recipe.

These are stylized reference interpretations, with rounded dimensions and simplified trim/cabin details. Handling is gameplay tuning; digital map/status screens are illustrative. No exact-CAD, engineering-validation, door-animation or damage claims. The Model Y is the 2024 original body. Near-view masters do not contain an automatic GLB LOD chain; host distance/proxy policies still apply.

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

Entity tests: **245 passed**, including all forty boarding, accelerating, steering, braking, reversing and exiting. Earth tests: **136 passed**. Every new asset was imported through `importAsset` and checked with `inspectAsset({verify:true})`. The local World Explorer entity pack was rebuilt. The targeted model loop was used; repository-wide engine/release CI was not rerun for this content batch.

Capture command: `node packages/entities/scripts/capture-fleet.mjs --ids=<comma-separated slugs from source/us-vehicles.json>`, with `PLAYWRIGHT_BROWSERS_PATH` set to the installed Chromium directory. All forty source/runtime hashes are recorded in the evidence JSON.
