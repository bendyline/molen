# Entity model quality

How to judge and improve the moving models: road vehicles, cycles, boats, transit, aircraft,
people, animals and the animated diorama structures. It complements the
[medium-fi style guide](../../docs-src/guide/medium-fi.md), which sets the look and the budgets;
this page records what a whole-fleet review found, the rules that came out of it, and the
tools that make the next review fast.

## The look review of 2026-10-29

Proportions passed, but side-profile landmarks miss what people see from the three-quarter
views, so every model was then graded on overall "look" by reviewers who had not built it. Each
grader compares the model with photographs of the right generation at matched cameras (front
3/4, rear 3/4, side, front, rear; aircraft also from below) and scores five criteria
(silhouette, glass, front, rear, details), each 100 minus listed deductions: trivial −1,
minor −2 to −3, noticeable −4 to −6, major −8 to −15. Flat colours, absent small details and
faceting within the polygon budget are not deducted. A model passes at a mean of 96 or more
with every criterion at 92 or more and no major deduction. First-pass grades: cars 74–89 (mean
83), aircraft 86–92, boats 86–91, cycles 91–94, transit 89–90; no model passed.

| Family | What was wrong | What changed |
| --- | --- | --- |
| F-14 and other fighters | The F-14's "flattened" nozzles were open single-sided shells (`caps: false`, front faces only) seen from inside and culled from behind; the F-16 intake duct had the same defect. Thin same-grey canards, plain box intakes, low canopies, a flat AV-8B spine. | Double-sided nozzles with a closed lip; thin F-14 beaver tail; raked F-15 ramps; dark F-16 smile; thicker canards; split Typhoon intake; rounded F-35 forebody; F-22 wedge nozzle flaps; AV-8B humpback and drooped nose. |
| Road-vehicle builder | The side fit had no landmark for the rear-header height or where the side glass ends, so a fastback K5 scored 98 while reading as a shooting brake. In 3/4 views bodies read as a soap bar: section widest at mid-door, glass on the body edge, pillow hood, rounded slab tails. Fixed-size tail lamps that vanished on red paint, one headlamp vocabulary, stud-mesh grilles, chrome-disc wheels, a see-through slot on raised-roof vans. | Five builder rounds (see the keys below): flat doors to a crisp crease and shoulder, glass inset to 0.43 W, a crowned hood with a crisp edge and fender peaks, 0.18–0.24 m tail corners and narrowing tailgates; independent rear roof fall and blind quarters; tail and head lamps with size, wrap, shape and graphics; intakes, grille bars and frames, fog lamps, skids, diffusers; alloy, steel, mesh and aero wheels; flares, cladding and trim finishes; commercial bumpers and dual wheels. Every recipe refitted at matched cameras with the two new landmarks. |
| Airliners and bizjets | Every type shared one nose, windscreen and small round window. | Per-type radomes, pane layouts, windows (G650 ovals), nacelle sections (737 flat lip), winglets (sharklets, canted E1), flap-track fairings, measured turboprop blades. |
| Helicopters and GA | Cabins built from vertical flat sides with small roof chamfers: boxes head-on. | A curved cabin shell (`cabinShell` in `robinson-r44.mjs`, used by six helicopters) with glazing cut into the curved skin; GA cabins with tumblehome; fins and rudders as tapered airfoils; bulky DA42 diesels, 208B cargo pod. |
| Boats, cycles, transit | Merchant houses read as office blocks; glass-box wheelhouses; a tender-like speedboat; boxy cruiser and scooter; an upright tram cab. | Stepped houses with bridge wings and funnels; raked flared wheelhouses; higher tug and ferry bridges (helm eyes raised); a bowrider hull; V-twin, Vespa-style scooter, current road frame; S70-style LRV cab with skirts; a modern bus front. |

Status at the end of the day (independent graders, latest grade per model; the record is in
[proportion-review-2026-10-29.json](source/proportion-review-2026-10-29.json) under
`finalGrade`):

| Group | Graded | Pass | Notes |
| --- | ---: | ---: | --- |
| Aircraft (53) | 46 | 38 | A400M and H145 noses fail a criterion; R44, C-17A, CH-47F, MV-22B miss by under 1 point. AV-8B and Bell 412EP were fixed after their failing grade. Not yet graded at their final builds: H125, Bell 206B/407, King Air, Beech 18, DC-3, P-51. |
| Watercraft (8) | 8 | 5 | Bulk carrier, container ship and speedboat at 95.4–95.8 (square sterns, short bridge wings, speedboat sheer). |
| Cycles (6) | 6 | 3 | Cruiser, scooter and standard motorcycle were reworked after their failing grade. |
| Transit (2) | 2 | 0 | Both reworked after their failing grade (bus front, LRV cab). |
| Road vehicles (116) and motorhomes (7) | 0 | – | Refit self-grades 82–94 (mean 89.5, from an independent 83); motorhomes 95.4–96.2. None is at 96 yet; the remaining gap is listed in the backlog. |

Graders disagree by 1–2 points, so a model fixed to exactly 96 often fails the next grader: aim
for 97 or more.

## The proportion review of 2026-10-29

The 2026-10-26 pass fixed construction; this one fixed proportion. Every vehicle model (111
recipe road vehicles, the five Bendy generics, six motorhomes, the box truck, bus, light rail,
six cycles, eight boats and 53 aircraft) was compared with public-domain or Creative Commons
photographs and, for aircraft, three-view drawings, using calibrated overlays: the model is
rendered with a camera matched to the photograph (perspective) or drawing (orthographic),
aligned by two known points (the near-side wheel hubs, or nose and tail), and landmarks are read
in metres. The proportion score is 100 × (1 − mean relative landmark error), with heights
relative to overall height and lengthwise positions relative to length; the bar is 96 with no
single landmark above 6 %. After a final verification pass on the finished builder, all 192
models meet it: scores 97.4–100 (mean 99.1, from 95.1) and no landmark worse than 5.9 %.
Per-model references, scores, changes and remaining gaps are in
[proportion-review-2026-10-29.json](source/proportion-review-2026-10-29.json).

| Family | What was wrong | What changed |
| --- | --- | --- |
| Road vehicles (shared builder) | Every body was a vertical slab: flat vertical fascias, a straight hood falling to a high blunt nose, a flat roof and a trapezoid greenhouse. | Rounded body section (rocker tuck, fullest at mid-door, shoulder roll-in); fascias lean back above the bumper line and tuck under below it, with lamps, grilles and plates following; the hood rolls over at the front; the belt rises toward the C pillar; windshield and backlight bow and wrap, with pillars and side glass sharing their edge; the greenhouse narrows toward the rear header. |
| Road vehicles (recipes) | Templated forms (belt about 0.61 of height): belts 5–25 cm too low, which is what made every cabin look tall; windshield bases 0.2–0.5 m too far forward; hoods, trunk decks and SUV sills too low; several cabs (Hilux, D-Max) too far forward. | Each recipe refitted to a side profile of its generation. Typical modern belts are now 0.66–0.72 of height. |
| Bendy generics | The five original masters were boxy hand-built GLBs; the SUV read as a sedan and the pickup as a sedan with a tub. | Rebuilt on the road-vehicle builder (`"output": "detailed.glb"`; the tracked `source.glb` masters are now unused legacy files) and fitted to class exemplars. |
| Fighters | Boxy aft nacelles ending in small rings (F-14, F-15), squashed oval nozzles (MiG-29), needle radomes (F-14, F-16, AV-8B), zero-thickness fins (F-22, F-35). | Round engine bays and nozzles, ogive radomes, fins with thickness, nozzle spacing from rear photographs. |
| Transports and airliners | Gear at fixed fractions of fuselage length; wings, nacelles and tails 2–4 m out of place; untapered tail cones; tailplanes without dihedral. | Per-type gear, wing, nacelle and tail stations from three-views; upswept tail cones, kinked trailing edges, tailplane dihedral; the C-130J ramp upsweep and beaver tail; the An-124 anhedral. |
| General aviation | Greenhouses and wings a hand-width too tall (Cessnas); faceted wedge or pyramid noses (Baron, DA42, King Air, Twin Otter, SR22T). | Lowered roofs and wings; rounded noses joined to the windshield section; tail cones ending under the rudder. |
| Helicopters | Wrong-side tail rotor (AW139), wedge tail cone (UH-60), V-wedge cabin (R44), oversized egg (OH-6), pointed noses. | Rebuilt noses, booms and cabins against three-views. |
| Cycles and boats | Road bike bars above the saddle, cruiser footpegs behind the seat, cargo bike on a city-bike layout; slab hulls with generic superstructures. | Cycle builder rewritten around measured frame geometry with real steering axes; hulls and superstructures per vessel type. |

New road-vehicle form keys (defaults keep older recipes valid): `beltRise`, `deck` (tail or bed
rail height), `hoodCurve`, `tuck`, `shoulder`, `noseSlope`, `chin`, `bumperLine`, `tailSlope`,
`tailTuck`, `rearBumperLine`, `windshieldBow`, `rearBow`, `windshieldWrap`, `rearWrap`,
`roofPeak`, `roofTaper`, `cowlRise` (raises the hood's rear centre and windshield base above
the belt, a truck power dome), `dloDrop` (paints a band between the side glass and the roof
edge on vans and off-roaders) and `railsInHeight` (the quoted height includes the roof rails).

Keys added in the look review (all default to the previous output unless noted; ranges and
meanings are in the comments beside each key in `road-vehicle-geometry.mjs`):

- Roof and glass: `roofDropRear`, `dloEnd`, `dloEndTop`, `dloEndBulge`, `dloFall`, `dloSplit`,
  `beltKink`, `beltDip`, `glassBase`, `rearGlassBase`, `rearGlassWidth`, `rearPanel`, `capRun`
  (default on cargo vans), `aPillar`, `frameRadius`, `frameFinish`, `tridion`, `alpine`.
- Body: `crease` (now a default flat door to a crisp crease), `noseCorner`, `tailCorner`
  (default 0.18–0.24 m), `tailLip`, `rearShoulder`, `noseShape`, `tailShape`, `fenderPeak`,
  `deckPeak`, `hoodEdge`, `hoodDome`, `hoodDrop`, `ducktail`, `doorCrease`, `engineLid`,
  `cabRake`, `bedRail`, `tonneau`.
- Cladding and trim: `flare`, `flareTop`, `flareShape`, `flareDepth`, `flareFinish`, `rocker`,
  `rockerFinish`, `rockerStrip`, `bumperTrim`, `bumperFinish`, `bumperIntake`, `bumperWrap`,
  `railStyle` (flush by default), `blackRails`, `sideSteps`, `rollBar`, `spareCover`,
  `mirrorScale`.
- Fascia: `intake` styles with `intakeWidth/Height/Y`; grille `band`, `twin`, `tall`,
  `three-port`, `grilleTrim`, `grilleFill`, `grilleMesh`, `grilleBars`, `grilleBar`,
  `grilleFrame`; `lampShape`, `lampDrl`, `lampX/Y/Width/Height/Sweep/Drop`, `lampLens`; tail
  styles `boomerang`, `racetrack`, `twin-line`, `pixel-band`, `black-panel`, `band-l`,
  `round-wrap`, `slashes`, a real `c`, with `tailX/Y/Width/Height/Wrap/Bezel/Count/Band`,
  `tailHousing`, `tailStack`, `tailNotch`; `fogLamps`, `skid`, `garnish`, `diffuser`,
  `tailgateCap`, `deckGrille`, `hoodVents`, `sideIntakeZ`, `exhaust`; `spoiler` is a lip
  (`'wing'` for a raised wing). `road-fascia.test.mjs` rejects unknown style values.
- Wheels: `wheelStyle` (`alloy`, `split`, `multi`, `mesh`, `dial`, `aero`, `steel`, `hubcap`),
  `wheelFinish`, `dually`, `tread` (`road` by default, `at` on off-roaders, `mt`), `ventWindow`.

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

Heights measured on the 2026-10-29 profiles (fractions of overall height; check each vehicle):

| Body | Belt (side glass bottom) | Hood leading edge | Deck / tail top | Sill |
| --- | --- | --- | --- | --- |
| Sedan, fastback | 0.67–0.72, rising 3–8 cm to the C pillar | 0.50–0.60 | 0.65–0.76 (high, short trunk) | 0.13–0.19 m |
| Coupe, roadster | 0.68–0.72 | 0.50–0.56 | 0.67–0.76 | 0.12–0.15 m |
| Hatchback, city car | 0.64–0.70 | 0.54–0.60 | 0.68–0.80 | 0.16–0.22 m |
| SUV, crossover | 0.65–0.74 | 0.57–0.64 | 0.66–0.80 | 0.23–0.30 m |
| Minivan, van | 0.53–0.66 | 0.46–0.60 | — | 0.22–0.38 m |
| Pickup | 0.66–0.76 | 0.59–0.72 (rail about at the belt) | 0.69–0.77 | 0.38–0.47 m |

The windshield base usually sits 0.15–0.25 L ahead of the centre on cars and well behind the
front axle; a long-hooded profile with the base at 0.25 L or more reads as a 1980s car.

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
- Cars do not yet reach 96 on look (refit self-grades 82–94). The most common builder limits
  the refits ran into: a hood-to-grille edge and per-corner fascia lean so noses stop reading as upright slabs under a
  soft hood; a shoulder crease across tailgates and trunk lids with a plate recess and a rear
  bumper shelf; the cabin interior showing through the tinted glass; free-form grille outlines
  (Tacoma hexagon, Lincoln star, Jeep/Escape shapes); lamps on the bonnet or fender top (Mini,
  Leaf); pontoon fenders (Chevrolet SSR, PT Cruiser); stepped roofs (Element, Defender);
  roadster headrest fairings; a roof-edge radius on boxy bodies. Then refit the cars again and
  have fresh graders grade them.
- Aircraft that still fail an independent grade: A400M nose (pointed drooping ogive, larger
  windscreen), H145 nose cap, C-17A windscreen, CH-47F aft pylon and nose length, MV-22B
  nacelles, R44 fin sweep; re-grade the AV-8B and Bell 412EP (fixed after grading) and grade the
  seven not yet graded at their final builds.
- Boats: round, overhanging sterns and full-beam bridge wings on the bulk carrier and container
  ship; drop the speedboat's gunwale toward the transom and open its bow. Re-grade the cruiser,
  scooter, standard motorcycle, bus and light-rail car (reworked after their failing grade).
- Weakest references: Casper Electric, Octavia Combi, Outback and the Bendy station wagon have no
  Commons side profile and were scored from camera-matched three-quarter photographs; Ioniq 5,
  Ram 1500 and the MDX rear glass also rely on angled views. Their scores are less firm.
- Taildraggers (P-51, PC-6, DC-3, Beaver, Beech 18) are built posed in their real three-point
  attitude, because the kernel holds body pitch 0 on the ground. The same pose is drawn in
  flight, so they fly visibly nose-high (P-51 13°). A kernel rest-pitch (three-point attitude on
  the ground, level datum in the air) would fix all five; until then the P-51's tail collision
  probes stay in the flight datum so takeoff rotation does not strike the tail.
- Budgets: the look work kept plain road-vehicle builds within about +1.5k triangles each
  (most 20–27k source triangles), cycles at most 14k, boats at most 14.5k, aircraft at most
  about 90k. The articulation layer (`road-articulation.mjs`, `aircraft-articulation.mjs`)
  adds 6–9k triangles to every road vehicle, which takes many past the 22k runtime caps in the
  fleet tests; measure look changes with `articulate: false`.
- The tracked Bendy `source.glb` masters (compact, sedan, SUV, pickup, van) are no longer read
  by any generator and can be deleted.
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

Import each changed bundle with `pnpm assets:build --no-generate`, then run
`generate-models.mjs` and `preview-liveries.mjs --capture` (see
[repository GLBs](../ASSET-PACKS.md)).
