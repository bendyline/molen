# Fleet model review

For the current 142-model cabin pass, references and validation, see the
[interior review and citation ledger](source/INTERIORS.md). The counts and measurements below
describe the original fleet batch and are retained as historical evidence.

The brief was diverse cars, motorcycles, bicycles, boats, cargo ships and ferries, with sea traffic support. This batch adds 20 original, generic medium-fi models: six mountable road vehicles, six rideable cycles and eight ambient watercraft. Cycle riding with assisted lean and rider animation was subsequently added (see [the riding review](CYCLE-RIDING-REVIEW.md)). Boat helm physics and mounting were also added; see docs-src/guide/boats.md for that runtime extension.

Each model owns its recipe in `source/<category>/<name>/models/recipe.json`; `packages/entities/scripts/fleet-geometry.mjs` is the shared authoring capability. No external model, texture, reference image or image-generation output is used. Models use flat PBR materials and metre units, +Y up and +Z forward. Cycle/car tires meet ground at Y=0; vessel origins use the waterline, with the hull below it.

## Geometry and binding checks

All source pins, imported sidecar source hashes and runtime file hashes match. Every model is below 2,000 triangles, with no texture images. The combined runtime size is 510,524 bytes and geometry totals 12,825 triangles. Wheel groups preserve their named spin children; the shared paint material is `vehicle-paint-and-trim`. Watercraft carry dimensioned boat/ferry ambient roles and require navigable water routes.

| Model | Triangles | Runtime bytes |
| --- | ---: | ---: |
| Delivery box truck | 444 | 23008 |
| Electric hatchback | 360 | 18208 |
| Off-road utility | 384 | 19828 |
| Sports coupe | 372 | 18652 |
| Station wagon | 384 | 19828 |
| City taxi | 372 | 19044 |
| Front-box cargo bicycle | 924 | 32152 |
| City bicycle | 888 | 30380 |
| Touring cruiser | 716 | 25744 |
| Step-through scooter | 716 | 25820 |
| Drop-bar road bicycle | 928 | 30612 |
| Standard motorcycle | 692 | 24804 |
| Geared bulk carrier | 856 | 28860 |
| Roll-on car ferry | 960 | 36592 |
| Container feeder ship | 1032 | 43160 |
| Coastal fishing boat | 600 | 22104 |
| Passenger ferry | 1056 | 40176 |
| Coastal sailboat | 281 | 14824 |
| Open speedboat | 144 | 9060 |
| Harbor tug | 716 | 27668 |

## Visual review

Four 640×480 turntable views of every imported model were inspected with antialiasing and reflections. Car wheel visibility was corrected and all six cars recaptured. The `fleet` and `harbor` scenes were inspected at 1600×1000 after 90 simulation ticks, including shadows and waterline placement. The harbor scene includes two moving ferries.

Local captures are ignored build outputs: `source/<category>/<name>/shots/angle_0.png` through `angle_3.png`, plus `shots/fleet.png` and `shots/harbor.png`. `shots/fleet-review.json` records exact source/runtime hashes and model statistics. Recreate the views with:

```sh
node packages/entities/scripts/capture-fleet.mjs
# Narrow a later review:
node packages/entities/scripts/capture-fleet.mjs --ids=sports-coupe,tugboat
# Then refresh the tracked preview.png files and contact sheets from the captures:
node packages/entities/scripts/preview-fleet.mjs
```

## Reproduction and validation

The byte comparison `node packages/entities/scripts/generate-fleet.mjs --check` passed. The latest full source generation and resumed import produced 2,348 verified GLBs as `assets-7fafb022c67e8b96`; see [the cycle riding review](CYCLE-RIDING-REVIEW.md) for the latest validation evidence. Use `--ids=<slug>,<slug>` for targeted source regeneration. After a recipe edit, import and verify each changed model, for example:

```sh
node packages/entities/scripts/generate-fleet.mjs --ids=tugboat
node packages/tooling/dist/cli.mjs asset import content/entities/source/watercraft/tugboat/models/source.glb --id molen.entities.watercraft.tugboat --project content/entities/project.json --force
node packages/tooling/dist/cli.mjs asset inspect molen.entities.watercraft.tugboat --project content/entities/project.json --verify
node packages/tooling/dist/cli.mjs validate content/entities/scenes/harbor.scene.json
node packages/tooling/dist/cli.mjs sim run content/entities/scenes/harbor.scene.json --ticks 600 --hash
```

All 20 imports passed verification. Both demo scenes validate. The harbor's 600-tick simulation completed with two boats on two water lanes. Automated coverage checks model budgets/pivots, water height, starboard routing, one-way lanes, route/type and size compatibility, ferry terminal assignment, speed caps, dwell/resume, keyframe determinism and Earth model bindings.

The complete engine gates passed: `pnpm verify`, `pnpm smoke:packed`, `pnpm docs:site:check` and `pnpm test:golden`. The latest packed smoke test installed 17 tarballs and built all seven templates. The production audit passed the configured critical-severity gate while reporting one high-severity advisory. Dependency changes were outside this batch.
