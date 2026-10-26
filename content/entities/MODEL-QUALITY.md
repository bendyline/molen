# Entity model quality

How to judge and improve the moving models: road vehicles, cycles, boats, transit, aircraft,
people, animals and the animated diorama structures. It complements the
[medium-fi style guide](../../docs-src/guide/medium-fi.md), which sets the look and the budgets;
this page records what a whole-fleet review found, the rules that came out of it, and the
tools that make the next review fast.

## The review of 2026-10-26

Every model was rendered from the same calibrated views (below), first family by family, then
one by one where a family sheet showed a problem. The defects were rarely in one model: most
came from a shared builder or a shared recipe habit, so one fix improved dozens of models.

| Family | Models | What was wrong | What changed |
| --- | ---: | --- | --- |
| Road vehicles (`road-vehicle-geometry.mjs`) | 106 + 6 motorhomes on its cab | SUVs, hatchbacks, wagons, vans and off-roaders had a sedan's raked rear glass and trunk deck. Every body sat at a car's sill height; pickups had no frame, a raked cab back, round car arches and a bed as deep as the sills. Rear doors and C pillars were placed from the rear glass, not the rear axle. Wheels detailed both faces and carried a 4 mm sidewall ring. | Rear glass base and run corrected per model (the [proportions test](../../packages/entities/test/vehicle-proportions.test.mjs) now guards it). Ride height and arch gap by body style; squared truck arches; frame rails, crossmembers, live rear axle and undertray; realistic bed floor; cab/bed shut line; rear doors and C pillars follow the axle; two-door cars get one long door; spare tires mounted on the tailgate. Inboard wheel faces are a dark disc (about 4,000 fewer drawn triangles per car). |
| Bendy generics (`fleet-geometry.mjs`) | 6 | Glass boxes on slabs: 24%-opacity greenhouses, a roof slab covering half the cabin, wheels outside the body. | Station wagon, taxi (with roof sign), electric hatchback, off-roader and sports coupe rebuilt on the road-vehicle builder; the box truck has its own builder (`box-truck-geometry.mjs`): shared cab, chassis, dual rear wheels, framed dry-freight box. |
| Watercraft | 8 | One slab-sided wedge hull for every boat; flat sheer, vertical stem; ships without funnels; hull lettering standing off the flared topsides (its shadow read as doubled text). | Lofted hulls per type: plan-view bow fullness, transom, raked stem, flare, deadrise, bilge, sheer rising to the bow, bulwarks with a cap rail, boot-top, antifouling, a sailboat fin keel and bulb. Ships gain funnels, accommodation windows and bridge wings; tugs a fender belt and hull-mounted tires. Fittings and lettering query the hull. |
| Cycles | 6 | The scooter was a motorcycle with a panel; brick saddles; motorcycles drawn on a scaled-up bicycle frame; box headlamps. | Step-through scooter (floorboard, leg shield, engine cowl, bar-mounted lamp); tapered saddles and seat posts; drop bars; a motorcycle chassis (backbone, down tube, swingarm, twin shocks); round headlamps. Rider contacts are unchanged except the scooter's floorboard stance. |
| Transit | 2 | Pure-white bodies; the bus hid its wheels behind flat panels. | Off-white paint (liveries still recolor it); bus wheel openings with arch lips and wells; tinted side glass. |
| Aircraft | 53 | Silhouettes and planforms were sound; the PA-28's wing used the stripe color while its flaps and ailerons were white. | PA-28 wing painted to match. Other aircraft unchanged (see backlog). |
| Wildlife (`wildlife-geometry.ts`) | 90 | Inflated ovoid bodies on straight stick legs; one template for every ungulate; flat-sheet bird wings; zebra stripes as floating rods; squirrel tails as upright eggs. | Jointed legs (stifle, hock, knee, fetlock); chest and rump masses; dark hooves; moose hump, bell and palmate antlers, oryx spear horns, lyre horns, zebra mane (new detail tags `palmate`, `straight-horns`, `mane`); stripes built into the body surface; bent bird wings; a squirrel plume. |
| Figures | 9 | The cat read as a small dog. | Cat preset: shorter legs, larger head. |
| Dioramas | 6 | The carousel was a disc over a platform. | Peaked canopy, valance, rounding board and twelve horses (six ridden). |

## Guidelines

These follow from the defects above. The [medium-fi style guide](../../docs-src/guide/medium-fi.md)
remains the standard; these are the checks that most often fail in practice.

### Review families side by side, not models one at a time

A shared builder fails the same way in every model it builds, and a single preview hides it.
Render a family as a grid of orthographic side views at one scale: identical silhouettes,
identical stances or a whole class with the wrong rear are obvious there and invisible in a
three-quarter preview. Name the object from the clay silhouette alone before judging detail.

### Proportion archetypes for road vehicles

| Body | Rear glass base from the rear end | Rear glass horizontal run | Sill height | Arch gap |
| --- | --- | --- | --- | --- |
| Sedan, coupe | trunk deck behind (about 0.35 L) | 0.5–0.9 m | about 0.48 × wheel radius | 4–5 cm, round |
| Hatchback, wagon, SUV, van | 0.10–0.25 m | 0.1–0.5 m (coupe-SUVs up to 1 m) | 0.6 × radius for SUVs | 6 cm |
| Off-roader | 0.08–0.12 m, spare on the tailgate | 0.1–0.2 m | 0.68 × radius, frame visible | 8 cm, squared |
| Pickup | cab back nearly vertical (under 0.15 m of rake) | — | about the wheel radius, frame visible; bed floor 0.55 m below the rail | 8 cm, squared |

Rear doors end over the rear wheel whatever the rear glass does; a long-roof body shows a C
pillar and a quarter window behind them. A two-door car has one door of about 1.2 m.

### Construction

- **Stance is a silhouette feature.** Sill height, arch gap and arch shape say "truck" or "car"
  before any detail does. Show what a raised body stands on: frame, axle, undertray, not sky.
- **Markings conform to the surface.** Lettering and decals lie on the skin and follow its
  slope; a floating letter casts a copy of itself as a shadow. Fittings query the surface they
  sit on (the boat hull's `deckAt` and `sideAt`) instead of assuming a box.
- **Interiors stay inside.** Put the driver's eye about 0.9 m behind an upright windshield's
  base, or the full-depth dashboard pierces the glass onto the hood.
- **Spend triangles where they are seen.** The inboard face of a wheel, the inside of a closed
  box, a 4 mm ring: none reach the screen. A body shell of 1,300 triangles beside wheels of
  8,000 is the wrong way round. Remember that import de-duplicates identical meshes, so the
  sidecar's triangle count can hide a drawn-triangle saving or cost.
- **Identity features are data.** Species and vehicle variants differ by named details
  (`palmate`, `straight-horns`, `mane`; `roofSign`, `spare`, `cargoVan`), not by a model-name
  switch inside a generator.
- **Stripes and liveries belong in the surface.** Build stripes into the mesh's own bands or
  vertex colors; never stack proud rings around a faceted body.
- **No pure white or black on a large surface.** Use off-whites and let liveries color.

### Contracts a model must keep

- Liveries bind by node name and material (`source/liveries.json`): a generator's node names
  and its paint material are part of its interface. Keep one node per livery slot when
  restructuring geometry.
- Named pivots (`wheel-*`, `-spin`, `-brakes`, `handlebar`, pedals, steering wheel, needles)
  and the spec's driver eye, grips, footrests and seats must still match the geometry.
- Generators stay byte-deterministic: `Math.pow` rather than `**`, no clocks, no randomness.

## Tools

- **Review sheets:** `node packages/entities/scripts/model-sheet.mjs` renders any source GLB,
  figure preset or wildlife recipe from calibrated views under an Earth-like rig: walk-around
  three-quarters, orthographic side, front, rear and top at one scale with the recipe's declared
  dimensions and wheel centers drawn on them, a clay silhouette and a traffic-distance view.
  `--compare=<dir>` stacks before and after; `--family=<name> --grid=N` builds a family grid;
  `--figures=all` and `--wildlife=base` bake procedural bodies first. Output goes to ignored
  `shots/model-sheets/`. Use `--gpu` on a machine with a GPU; the default is SwiftShader.
- **Proportions test:** `packages/entities/test/vehicle-proportions.test.mjs` fails a recipe
  with a sedan rear on a tailgate body, a pickup without frame-height sills, or a dashboard ahead
  of its windshield base.

Worth adding next:

- A family silhouette check: render each family's clay side views and flag pairs whose
  silhouettes overlap almost completely, so a template reused without its proportions is
  caught automatically.
- A floating-marking check: raycast each lettering and decal mesh onto its parent surface and
  fail gaps over a centimeter.
- An entity budget audit beside `check-medium-fi.mjs`: runtime draw calls (many aircraft run
  100–330 against the guide's "roughly eight batches"), drawn rather than unique triangles,
  and large near-white or near-black materials.
- An interior-clearance check that rays from the driver's eye through the glazing and fails
  cabin geometry outside the body shell.

## Backlog

- Aircraft draw calls: consolidate static detail by material in the per-aircraft builders.
- Human figures are shallow in profile (about 0.19 m chest depth against roughly 0.24 m).
- The cat's tail is thin; elephants are blocky; birds at rest could use more shape.
- The five original Bendy masters (sedan, compact, pickup, SUV, van) have no generator; rebuild
  them on the road-vehicle builder like the other generics.
- The smock windmill's skyline level shows dark, inverted-looking facets from automatic reduction.
- `molen types gen` writes `airport\scene.json` with a backslash into the generated header on
  Windows, so declarations made there differ from those made on Linux.

## Reproduce

```sh
node packages/entities/scripts/generate-fleet.mjs --ids=<slug,...>   # road, cycle, boat recipes
node content/entities/source/transit/bus/models/generate.mjs
node packages/entities/scripts/generate-aircraft.mjs --ids=pa-28-180
node content/wildlife/source/build-catalog.mjs                     # wildlife detail tags
node packages/entities/scripts/model-sheet.mjs --ids=<slug,...> --compare=<before-dir> --gpu
node packages/entities/scripts/capture-fleet.mjs --ids=<slug,...>   # then preview-fleet.mjs
```

Import each changed bundle with the asset pipeline, then refresh the lock for the batch with
`pnpm assets:build --update-lock` (see [repository GLBs](../ASSET-PACKS.md)).
