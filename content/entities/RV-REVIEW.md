# RV model review — 2026-10-20

Six drivable motorhomes. [Roster and usage](RVS.md). [Hash-bound evidence](rv-review.json). [Exterior preview](rvs-preview.png). [Cab and coach preview](rv-interiors-preview.png).

- 21,750–27,352 triangles, 32–42 material primitives per model.
- 4.49 MiB across six runtime GLBs; no bitmap textures.
- Every source pin, import hash and capture hash agrees. No GLBs or bulk captures are published.
- Model footprints include protruding mirrors, ladder and stowed awning. Extra rear tires and the Grand tag axle retain correct wheel spin and fixed brake nodes.

Reviewed silhouettes, wheel openings, body/cab joins, roof fixtures, front/rear/side details, clear driver sightlines, instruments and coach furnishings. Revisions closed the Class C cab transition, replaced the Class B panoramic sides with tapered van panels and framed windows, cleared Class A windshield visibility and lowered parked wipers, moved Class A dining furniture behind the cab, and removed degenerate clipping triangles.

Cabins have seats, belts, door panels, mirrors, pedals and bound steering/speed instruments. Coaches contain galley counters, sink/faucet, cooktop rings, cabinets, refrigerator, dining cushions/table, rear partition and bed/sofa dressing. Coach shells have genuine side-window openings, batched decals and fasteners, service ports, hatches, lights, awning cassette, roof air conditioners/vents/solar modules and rear ladder.

- Original polygonal reference interpretation of the 2022 View 24D; simplified trim and floorplan, not manufacturer CAD
- Five other RVs are original Bendy designs
- Driving controls, steering, wheel spin and analog speed needle are live; screen graphics illustrative
- Doors, slideouts, awnings, furnishings and leveling equipment do not animate; stowed touring configuration
- Living area is visual geometry, not walkable or interactable RV systems
- Near-view masters rely on existing host distance/proxy policies; no separate authored GLB LOD chain

## Validation

Passed 385 entity tests and 136 Earth tests, including RV boarding, acceleration, steering, braking, reverse and exit, geometry/bounds, six-model roster, source/import integrity and all animation bindings.

```sh
node packages/entities/scripts/generate-fleet.mjs --ids=<slugs from source/rvs.json>
node packages/entities/scripts/generate-models.mjs
node packages/entities/scripts/generate-fleet.mjs --check
pnpm --filter @bendyline/molen-entities build
pnpm --filter @bendyline/molen-entities typecheck
pnpm --filter @bendyline/molen-entities lint
pnpm --filter @bendyline/molen-entities test:unit
pnpm --filter @bendyline/molen-earth test:unit
node packages/entities/scripts/capture-fleet.mjs --ids=<slugs from source/rvs.json>
```

Import/inspection uses importAsset({path,id,projectPath,force:true}) then inspectAsset({ref,projectPath,verify:true}) through the built tooling API. Captures use installed Chromium via PLAYWRIGHT_BROWSERS_PATH, reflections, antialiasing and neutral AgX lighting. Extra coach captures use the same screenshotScene API and their explicit camera poses are recorded in rv-review.json. Bulk images stay in ignored shots/ folders. The local World Explorer pack was rebuilt; the targeted model workflow was used, without repository-wide engine/release CI.
