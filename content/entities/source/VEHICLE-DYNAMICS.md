# Road vehicle driving dynamics

All 124 road vehicles (cars, trucks, vans, motorhomes and the bus) have a row in
[vehicle-dynamics.json](vehicle-dynamics.json): one common trim of each, with its curb mass,
power and engine speeds, gearbox, driven wheels, front weight share, top speed, 0–100 km/h time,
skidpad grip, drag area, stability and traction control, differential and tires. The rows are
representative figures compiled from general knowledge of published specifications and typical
road tests. They carry no per-row sources: treat every number as an estimate. Bendy vehicles are
fictional and carry typical figures for their class.

## Reproduce

From the engine repository, after building the library packages:

```sh
pnpm vehicles:calibrate
pnpm vehicles:bench
pnpm --filter @bendyline/molen-kernel exec vitest run test/vehicle-powertrain.test.ts test/vehicle-dynamics.test.ts
```

Calibration updates only driving metadata (and the engine `audioSource`) in the source type
documents, then the aggregate catalog. It never generates meshes or changes asset locks. The
entities build checks the metadata for staleness.

[VEHICLE-TRIALS.md](VEHICLE-TRIALS.md) is the scorecard: every vehicle driven through its trial
cards and scored against this ledger's rows and against sourced road tests in
[vehicle-trials.json](vehicle-trials.json). `pnpm vehicles:trials` prints the cards outside
tolerance and `pnpm vehicles:trials --write` records the scorecard the entities tests hold later
runs to. [DYNAMICS-V2.md](DYNAMICS-V2.md) is the plan this is a part of.

## What calibration writes

`packages/entities/scripts/vehicle-dynamics.mjs` turns a row into a complete `vehicle.spec`:

- mass (curb plus a 75 kg driver), driven wheels, and the center of mass along the wheelbase
  from the front weight share;
- `wheels`: every road vehicle stands on four wheels with their own loads, grip and spin (the
  kernel's four-wheel model), and the fits below run on that model;
- a `powertrain`: power, engine speeds, torque curve and gear ratios. First gear runs out
  between 35 and 70 km/h, the top gear is a cruising overdrive, and the ratios between are
  spaced progressively. A CVT gets its two end ratios; an electric car one ratio that reaches
  the rev limit just past its top speed;
- tires: stickier ones are also stiffer (`corneringStiffness` 12 to 28), plus `rearGrip` for
  staggered fitments and `looseSurfaceGrip` for off-road tread;
- suspension by how sporting the car is (roll and pitch per g, spring frequency, damping),
  `rollBalance` from the weight distribution, `brakeBias`, and brakes strong enough that the
  tires set the stopping distance (a truck's or bus's air brakes are the limit instead, at
  about what it corners at);
- drag from the drag area, a small lift (downforce on the fastest cars), the governed top speed,
  the differential and the stability and traction control flags;
- an engine `audioSource` whose pitch follows engine speed, by engine size and fuel. Electric
  cars have none.

It then runs the production solver to fit two figures: driveline efficiency (0.75 to 0.97; for
a single-speed electric car the motor speed where full power arrives, for a power-split hybrid
its lowest ratio) until the simulated 0–100 km/h time matches the row, and the tires' `grip`
until a simulated skidpad matches its figure. A car can now go over: a vehicle that lifts a
side on the skidpad has shown its limit, and the trial reads what it held in its last second
on four wheels. At their fitted grips none of the 124 does. Every one slides first, the
tallest by a small margin: the class C motorhome's tires hold 0.66 g where half its track
over the height of its mass is 0.68.

## Cycles

The thirteen cycles are not in the ledger: their specs are written by hand in
`content/entities/source/cycles/`. The motorcycles, scooter and mopeds carry class estimates of
an engine and gearbox (a 52 kW middleweight with six gears, a 50 kW cruiser with five, a 9 kW
scooter on a variator, a 6.5 kW four-speed underbone, a 3 kW hub motor), a drag area with the
rider sitting up (0.6 to 0.8 m²) and the top speeds they had. The skis and snowboard carry a
sidecut radius (14 m and 8 m). None of these is a figure of a particular model, and no cycle
card is scored: `pnpm vehicles:trials` measures each cycle's top speed, steady lean, the time
it takes to lean into a turn and its largest slip angle round a figure-eight, so a change
shows.

## What the checks establish

`pnpm vehicles:bench` prints each car's simulated 0–100 km/h time, top speed, skidpad grip and
100–0 km/h stopping distance beside its row. At the last calibration all 124 cornered within 2%
of their skidpad figure, 122 reached within 8% of their top speed and 114 reached 100 km/h
within 10% of their time. The ten that miss are slower than their rows: rear-drive pickups
(F-150, Silverado, Ram, Tundra, Ranger), the Mustang and the Supra, whose published times
assume four-wheel drive or a prepared launch and which are traction-limited here, the Hummer EV
on all-terrain tires, and the Odyssey and Seagull, which sit at the end of the fit's range: on
four wheels a tire slips a few percent as it pulls, and that share of the power is lost.

The fit is a calibration, not a validation: the same two figures that are fitted are the ones
reported. The sourced road tests are the validation. Ten vehicles have them so far (instrumented
magazine tests and, for the bus, federal test-track reports), 44 cards that calibration never
reads: at the last recording 35 were within tolerance. The misses are braking (the Tesla and
911 stop 10–14% shorter than tested; on two axles it was 16–23%, when the engine's braking was
added to the brakes' past what the tires could take), the launches of the rear-drive F-150 and
the Tesla, the Tesla's and Hummer's skidpads (the road tests and the ledger rows disagree),
and the bus, which pulls away 25% quicker than a real one at seated load. Stopping distances
and top speeds are not fitted and land near real values (a sedan stops from 100 km/h in about
39 m, a 911 in 32 m, a city bus in 78 m). Handling balance comes
from the weight distribution and a class-based suspension, not from measured understeer
gradients. Gear ratios are generated, not the real gearbox's.
