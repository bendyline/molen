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

## What calibration writes

`packages/entities/scripts/vehicle-dynamics.mjs` turns a row into a complete `vehicle.spec`:

- mass (curb plus a 75 kg driver), driven wheels, and the center of mass along the wheelbase
  from the front weight share;
- a `powertrain`: power, engine speeds, torque curve and gear ratios. First gear runs out
  between 35 and 70 km/h, the top gear is a cruising overdrive, and the ratios between are
  spaced progressively. A CVT gets its two end ratios; an electric car one ratio that reaches
  the rev limit just past its top speed;
- tires: stickier ones are also stiffer (`corneringStiffness` 12 to 28), plus `rearGrip` for
  staggered fitments and `looseSurfaceGrip` for off-road tread;
- suspension by how sporting the car is (roll and pitch per g, spring frequency, damping),
  `rollBalance` from the weight distribution, `brakeBias`, and brakes strong enough that the
  tires set the stopping distance;
- drag from the drag area, a small lift (downforce on the fastest cars), the governed top speed,
  the differential and the stability and traction control flags;
- an engine `audioSource` whose pitch follows engine speed, by engine size and fuel. Electric
  cars have none.

It then runs the production solver to fit two figures: driveline efficiency (0.75 to 0.97; for
a single-speed electric car the motor speed where full power arrives, for a power-split hybrid
its lowest ratio) until the simulated 0–100 km/h time matches the row, and the tires' `grip`
until a simulated skidpad matches its figure.

## What the checks establish

`pnpm vehicles:bench` prints each car's simulated 0–100 km/h time, top speed, skidpad grip and
100–0 km/h stopping distance beside its row. At the last calibration all 124 cornered within 2%
of their skidpad figure, 122 reached within 8% of their top speed and 117 reached 100 km/h
within 10% of their time. The seven that miss are slower than their rows: rear-drive pickups
(F-150, Silverado, Ram, Tundra, Ranger) and the Mustang, whose published times assume
four-wheel drive or a prepared launch and which are traction-limited here, and the Hummer EV on
all-terrain tires.

The fit is a calibration, not a validation: the same two figures that are fitted are the ones
reported. Stopping distances and top speeds are not fitted and land near real values (a sedan
stops from 100 km/h in about 38 m, a 911 in 29 m, a city bus in 78 m). Handling balance comes
from the weight distribution and a class-based suspension, not from measured understeer
gradients. Gear ratios are generated, not the real gearbox's.
