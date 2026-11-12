# Mountable vehicles and driving

Vehicles can carry authored [glass surfaces](glass.md). Collision impulses load each pane by
its mass and orientation: laminated windshields crack while retained, tempered panes fragment,
and frame/interlayer failure is independent of fracture.

Generic vehicles use the Bendy house brand, with stable asset/type IDs. The Bendy Bus and
Bendy Light Rail are also mountable through the vehicle API. World Explorer has buttons for
both at the practice area: W/S applies traction or reverse, Space brakes, V switches view,
and E exits after stopping. The bus steers with A/D. Locomotives, rail cars and light rail
follow real track when the host supplies a track network; see
[Trains and track-guided vehicles](#trains-and-track-guided-vehicles).
See the [close-view vehicle standard](medium-fi.md#controllable-vehicles-close-view-fidelity)
for the extra model detail expected around the operator.

Compare car colors and RV graphics in the [livery gallery](livery-gallery.md). The
[complete livery catalog](livery-catalog.md) lists selection ids and reference evidence.

World Explorer's parking cars are external entity types with stable IDs and metric dimensions.
The entity pack includes eleven Bendy road models and eighty U.S. market reference vehicles:
forty recent models plus forty varied models from 2005–2024. These range from the F-150,
Prius and Model 3 to the Smart fortwo, MX-5 and Sprinter. You can walk up to one, get in and drive it.
See the [entity catalog](entities.md#road-cycle-and-water-fleets) for IDs and authoring details.

Each type owns its GLB reference, complete physics configuration, seats, named visual bindings,
and optional deterministic scripts. Dormant cars use generic dimension-driven instance proxies;
approaching or entering one loads its independent GLB with its own interior and controls. See
[Vehicle interiors](vehicle-interiors.md). No concrete car model or handling catalog is compiled
into schema, kernel, or client. The P-51D Mustang and OH-6 share the same mount/seat foundation
and add separate flight controls, physics, assets and cockpit cameras; see [Aircraft](aircraft.md).

In **Walk mode**, approach a car and press **E** to enter its driver seat. **W/S** accelerate or
brake then reverse; **A/D** steer; **Space** brakes; **Shift** pulls the handbrake; **V** switches
cockpit/chase views. Mouse look works while seated. Stop and press **E** to exit.

Every car drives like itself. Each has its own engine and gearbox, weight and weight
distribution, tires, suspension and aerodynamics, fitted to what a real one of its kind does: a
911 reaches 100 km/h in a little over four seconds and tops out near 300 km/h, a city car takes
thirteen and runs out of breath under 150, a motorhome leans and takes half a minute. The engine
revs through its gears and changes up near the rev limit; lift off and it brakes on the engine,
floor it at a cruise and the gearbox kicks down. Electric cars pull from rest in one gear and
slow by regeneration. The status line shows the gear and engine speed.

Cars drive on their tires. A nose-heavy front-drive hatchback runs wide when pushed; a
tail-heavy sports car turns in sharply and wants care. Traction and stability control, where
the real car has them, hold wheelspin and catch a slide, so holding a key through a corner or
braking in the middle of one keeps the car in line; the handful of cars built without them (the
2005 Ford GT, for one) will spin on full power in a corner. The handbrake still throws the back
out for a handbrake turn, and letting go of the wheel in a slide lets it countersteer by itself.
Brakes are anti-lock, so you can still steer while stopping. Rain and snow from the Weather
setting make the road slippery (about 40% and 100% longer stops), and gusts push on the body and
turn its nose. Leave the pavement and the ground matters: grass, gravel, dirt, sand and snow
grip less, drag at the wheels and shake the body, less so on off-road tires. The body dives
under braking, squats under power and leans out of turns. Hitting a wall or another car bounces
you off it, and a corner hit spins you. The controller checks both sides and then the rear;
blocked exits leave the rider seated. Switching to Fly also requires a safe stopped exit.

Modified cars stay where they were left throughout the current explorer session, even when their
original terrain tiles are evicted or rebuilt. Unmodified cars stream with their tiles. A page reload
starts a fresh session. Rendering uses absolute metric transforms under the floating-origin root.

## Reusable simulation

Import from `@bendyline/molen-kernel/vehicles`. `Vehicle`, `VehicleInput`, `VehicleState`,
`Mountable`, and `Mounted` are registered, validated components. The kernel owns the generic
wheeled-vehicle solver; every `vehicle` component supplies its own `spec` and `visual` data. Units
are meters and seconds; +Y is up, +Z forward, and +X is the driver's left side. Positive steering
turns right.

The car itself is data. List the `molen.entities` content pack in `project.json` `packs` and
declare it in the scene as `{ "id": "car", "type": "molen.entities.vehicle.sedan", ... }`; the
type supplies its `vehicle`, `mountable` and renderable components. The setup adds the player and
the commands:

```js
import {
  installVehicles, mountEntity, driveVehicle, unmountEntity,
} from '@bendyline/molen-kernel/vehicles';

export function setup(world) {
  const environment = {
    // A third argument gives the vehicle's height, to tell stacked decks apart.
    groundHeight: (x, z) => 0,
    // Return undefined where terrain is unavailable.
    // Add canOccupy(position, yaw, spec, entity) for static/dynamic collisions.
    // Add canExit(position, actor, vehicle) for safe person-sized exits.
  };
  installVehicles(world, environment);
  world.spawnRaw({ transform: { pos: [1.6, 0, 0], rot: [0, 0, 0, 1] } }, 'player');
  world.registerCommand('enter', () => mountEntity(world, 'player', 'car'));
  world.registerCommand('drive', (_w, command) =>
    driveVehicle(world, 'player', command.payload));
  world.registerCommand('exit', () => unmountEntity(world, 'player', environment));
}
```

Outside a scene, resolve a type's components from the pack's type documents with
`createTypeLibrary(docs).components('molen.entities.vehicle.sedan')` from
`@bendyline/molen-kernel/content`, and spawn a copy.

Declare commands and input bindings in the scene using the normal input schema. Give `drive`
a payload schema with `throttle` and `steering` numbers in [-1,1], a boolean `brake` and an
optional boolean `handbrake`.
Run this setup through `buildWorld`, the Worker, or `molen sim run --setup`.

`mountable.seats` is reusable for passenger seats or non-car mounts. Each seat has a unique
`id`, a `driver` or `passenger` role, and a local camera/rider anchor `position`. `exits` are
ordered local foot positions; `reach` limits mounting distance. A seat accepts one rider, and
only the current driver can submit vehicle intent. Mounted actors bypass the kernel character
and kinematics solvers. When the mount disappears, the rider is detached.

Passenger seats: every stock car carries a `passenger` seat beside the driver, mirrored across
the centreline, and the OH-6 one on the pilot's left; the P-51D has a rear `passenger` seat behind
the pilot, like the TF-51D trainer. Only the `driver` seat controls the vehicle.

The solver is a dynamic bicycle model substepped at 120 Hz or finer. Each axle's tires turn slip
angle into side force (`corneringStiffness` per unit load per radian) up to the road's grip, then
let go to about 85% of it as they slide. Side grip is `grip` (m/s², so `grip / 9.81` is the
friction coefficient; `rearGrip` where wider rear tires differ); straight-line grip is 15%
higher, and drive and brakes share it with cornering, so a car braking or under power at the
limit steers less. `drive` picks the front, rear or all wheels. `handbrake` locks the rear
wheels, which then slide. State carries the forward `speed`, the sideways `lateralSpeed`,
`yawRate` and a 0–1 `skid` for tire sounds or effects.

### Tire loads and balance

Weight moves between the wheels through the suspension: the sprung body pitches by
`pitchStiffness` and rolls by `rollStiffness` (radians per g) on springs of
`suspensionFrequency` and `suspensionDamping`. Braking loads the front tires. Cornering loads
the outside ones, each axle taking the share its roll stiffness gives it: `rollBalance` is the
front's (default 0.6). A tire's friction falls as its load rises (`tireLoadSensitivity`, the
share lost when the load doubles; default 0.25), so two unevenly loaded tires grip less than
two evenly loaded ones. That is what gives a car its balance: the heavier axle and the
stiffer-sprung axle give up first. A nose-heavy car (`centerOfMass` ahead of the wheelbase's
middle) with a stiff front end pushes wide and is stable; a tail-heavy or rear-stiff one
rotates. It also means a car corners at less than its tires' rated `grip`: the nose-heavy
sedan holds about 0.85 g on tires rated 1.0. Set `tireLoadSensitivity` to 0 for grip proportional to load, which
makes every car neutral at any weight distribution.

`bodyPitch` and `bodyRoll` add to the terrain `pitch` and `roll` in the transform, so the
cockpit view feels them too. Passed to the car visual as signals, they become suspension
travel: the wheels move against the lean and stay on the road. At walking pace the car simply
rolls where its wheels point, so it never turns in place and parks exactly.

### Engine and gearbox

`vehicle.spec.powertrain` gives a car an engine: `power` in watts at `peakPowerRpm`, a
`redline`, and a torque `curve` (`gasoline`, `turbo`, `diesel` or `electric`). `gears` lists the
overall ratios (gearbox × final drive), lowest first. Wheel force is engine torque through the
selected gear, less what it takes to spin the engine itself up (`inertia`), so a car pulls
hardest in first and runs out of power, not into a wall, at speed; `maxSpeed` remains a
governor. The automatic holds a gear to the rev limit under full throttle, short-shifts under a
light foot, kicks down when the pedal goes down, and drops most of the drive for `shiftTime`
seconds as it changes. Off the throttle the engine brakes the car (`engineBraking`); an electric
motor regenerates. `continuous: true` is a CVT ranging between the first and last ratios, which
holds the engine at its power peak. Delivered torque follows the pedal at the engine's own
pace (`response`: a turbo lags, a motor does not).

```json
"powertrain": {
  "power": 272000, "peakPowerRpm": 6500, "redline": 7500, "curve": "turbo",
  "gears": [13.73, 9.36, 6.87, 5.17, 3.95, 3.04, 2.36], "efficiency": 0.9
}
```

`vehicleState` carries the `gear` (-1 in reverse), the engine `rpm`, the delivered `engineLoad`
(0–1) and `shift`, all in keyframes and replays. Without a powertrain a vehicle keeps the
constant `engineForce` up to `maxSpeed`, as cycles and off-track rail vehicles do.
`powertrainWheelForce(powertrain, wheelRadius, speed, gear)` and `engineTorqueCurve(curve, x)`
are exported for tools that plot or check gearing.

Drive reaches the road through a differential. An open one (`limitedSlip` 0, the default)
pushes no harder than the unloaded inside wheel can hold, so a powerful car wastes its power
there out of a corner; toward 1 (locked) both wheels push, and both can spin.

### Traction control, stability control and brakes

Drive beyond the grip spins the wheels, which then hardly hold the car sideways: that is how a
rear-drive car without aids comes round on power. `tractionControl` (default on) backs the
engine off to hold the tires at their limit instead, and brakes a spinning inside wheel.
`stabilityControl` (default on) watches the rear tires: when they slide past their peak it
brakes the outside front wheel, which turns the car back into line, slows it and cuts the
engine. `vehicleState.assist` reports how hard either is working, for a dashboard light. Set
them to `false` for a car built without them. The handbrake suspends stability control so a
handbrake turn still works.

Anti-lock brakes split by `brakeBias` and stop just short of the tire limit, leaving the front
some side grip to steer with. The rear brakes ease off a cornering tire (brake-force
distribution), so the lightly loaded tail keeps its side grip: braking hard in the middle of a
corner runs the car wide and slows it, where it used to spin it.

### Steering

The driver's hands are part of the model. Steering lock fades with road speed
(`steeringFadeSpeed`), down to the angle that turns the car as hard as its tires can corner.
Turning in takes the same time at any speed (`maxSteer / steeringRate` when parking, half as
long again on a highway), so a tap on a key nudges the car across its lane and a held key
builds to the limit over about a second: past the lock the turn itself needs, the driver winds
on more only slowly, up to the slip angle where the front tires have all but their last percent
of grip, and no further, because more lock only slides them. In a slide the tires pull the
wheel toward the way the car is traveling, as caster does: let go and it countersteers by
itself; steer against the slide and the wheel goes to the opposite lock the tires can use.
Below a jogging pace the wheels simply point where they are turned.

### Air and weather

`aerodynamicResistance` is drag as an acceleration per (m/s)², `0.5 × air density × drag area /
mass`: with a real drag area a car's top speed comes from its power. `aerodynamicLift` (1/m,
negative for downforce) takes load off the tires at speed, or adds it. The wind field, gusts
included, pushes on the body's long side and, acting ahead of the center of mass, turns the
nose downwind. `installVehicles` reads the world's `weather`: rain takes up to 30% of the grip
and snow up to 60% (`weatherGrip(weather)`).

### Surfaces

Give the vehicle environment a `surface(x, z, y)` callback and the ground matters. It returns
a `VehicleSurface`: `grip` relative to dry pavement, `drag` (extra rolling resistance in m/s²)
and `roughness` (0–1, which works the springs as the car moves). `VEHICLE_SURFACES` holds stock
values by the names map data uses, and `vehicleSurface(name)` looks one up (undefined, which is
pavement, for names it does not know):

| Surface | Grip | Drag (m/s²) | Roughness |
|---|---|---|---|
| `asphalt`, `concrete`, `paved` | 1 | 0 | 0 |
| `stone` (cobbles, setts) | 0.9 | 0.05 | 0.35 |
| `wood`, `metal` | 0.85, 0.75 | 0.05, 0 | 0.2, 0.1 |
| `dirt` | 0.68 | 0.3 | 0.5 |
| `gravel` | 0.62 | 0.35 | 0.45 |
| `grass` | 0.55 | 0.6 | 0.6 |
| `leaves` (forest floor) | 0.5 | 0.7 | 0.75 |
| `sand` | 0.5 | 1.6 | 0.4 |
| `mud` | 0.42 | 1.4 | 0.55 |
| `snow` | 0.35 | 0.6 | 0.3 |

```js
import { installVehicles, vehicleSurface } from '@bendyline/molen-kernel/vehicles';

installVehicles(world, {
  groundHeight: (x, z) => 0,
  // The road is a 7 m strip along z; everything else is a field.
  surface: (x) => vehicleSurface(Math.abs(x) < 3.5 ? 'asphalt' : 'grass'),
});
```

`looseSurfaceGrip` (0–1, off-road tread) wins back up to half the grip a loose surface takes
and 40% of its drag. Surface and weather multiply: wet grass is worse than either. The callback
is asked once per step for each moving car; `vehicleState.surfaceGrip` reports the result. In
an Earth view the mapped roads and land cover answer it (see below).

Top and reverse speeds, rolling resistance, mass, wheel geometry and terrain tolerances come
from `vehicle.spec` as before, and `yawInertia` defaults from the body size.

Collision probes run at 120 Hz or finer through the host's `canOccupy` adapter. When it refuses a
move, the solver finds which way is open by probing around the car, and answers with an impulse at
the corner that struck: a bounce that grows with impact speed (none below walking pace, so a car
can rest against a wall), scraping friction along the obstacle, and a spin. `installVehicles` emits
`vehicle-impact` (5 m/s or more) and `vehicle-bump` (1.5 m/s or more) with the car's `entity` and
the closing `speed`; the Earth soundscape plays a metal impact for each. World explorer uses an
oriented chassis against other cars and nearby triangles for walls, fixtures and buildings; the
car it hits stays put. Terrain gaps pause motion; abrupt steps and slopes above 35 degrees stop
the car. Cockpit views use the full chassis quaternion; chase views shorten at obstructions.

This is a grounded driving model with assisted steering. It does not implement airborne
rotation, rollovers, crash deformation, pushing other cars, manual gear selection or a clutch,
individual wheel speeds (wheelspin and lock-up are force limits, not spinning wheels), tire
temperature and wear, fuel, different surfaces under different wheels, passenger animation,
multiplayer ownership, or disk persistence. Background traffic is a
separate package: [ambient life](ambient-life.md) moves NPC cars along lanes without this solver,
and they stop for a car someone is driving. Without collision hooks, the reusable kernel solver
supplies terrain driving only. Do not attach a second physics body to the same vehicle; the
vehicle solver owns its transform.

### Breakable parts

The ground-vehicle catalog (cars, buses, cycles and rail vehicles) binds independent wheels and
exterior panels to `spec.collisionParts`.
Hard contact reduces the struck part's joint integrity; a broken joint releases its named GLB
geometry as debris with its own velocity, spin, gravity and collisions. Other parts stay attached.
Lost wheels reduce grip and drive force on their axle; front-wheel loss also reduces steering.
Hard landings can break wheel joints. This remains a grounded chassis approximation: the body
does not roll over or simulate individual suspension collapse after losing a wheel.

Each part declares `id`, `role` (`frontWheel`, `rearWheel`, `panel` or `engine`), model-space
`center`, sphere `probes` and `radius`, `massFraction`, `breakSpeed` in m/s, and exact GLB `nodes`.
An optional `hinge` has a `pivot`, unit `axis`, full-travel `angle` and `actuator` name; it moves
door, hood and trunk probes with the panel. Joint strengths are gameplay tuning. Hosts supply
`VehicleEnvironment.contacts(probes, entity)` for detailed obstacles alongside `canOccupy` for
the chassis. Chassis impacts also load nearby joints using the inferred contact point, even
with only `canOccupy`. `vehicleObstacleContacts` from `client/vehicles` adapts resident triangle geometry
and nearby vehicles. Detailed contacts additionally detect parts extending beyond the chassis.

`vehicleState.damage` and `debris` survive keyframes. Debris expires after 20 simulation seconds;
the part stays missing. Pass the state as the sixth argument to `VehicleVisual.update` to apply
damage after animation; Earth view and World Explorer do this automatically. Press **R** once
stopped to repair parts in place. Hosts can call `EarthVehicles.recover()`, `EarthView.recover()`
in drive mode, or `repairVehicle(world, id)` from `kernel/vehicles`. Glass has its own fracture
state and is not repaired by this operation. Other vehicles remain static collision targets;
debris-to-debris collisions and damage transfer into the struck vehicle are not simulated.

All durable simulation state and mount relationships live in ECS components and survive keyframes
and replay. Install the same systems/environment when restoring. Host streaming and render resources
are separate from those checkpoints.

### The fleet's figures

The `molen.entities` cars are not tuned by hand. In the engine repository,
[`vehicle-dynamics.json`](https://github.com/bendyline/molen/blob/main/content/entities/source/vehicle-dynamics.json)
lists one common trim of each of the 124 road vehicles: curb mass, power and engine speeds,
gearbox, driven wheels, front weight share, top speed, 0–100 km/h time, skidpad grip, drag area
and whether it has stability and traction control. A calibration step turns each row into a
complete spec (gear ratios, tire stiffness, suspension, roll balance, brake bias, drag and
lift) and then runs the production solver to fit the two things a driver knows a car by: it
adjusts driveline efficiency (or a motor's peak-power speed) until the simulated 0–100 km/h
time matches, and the tires' `grip` until a simulated skidpad does.

```sh
# in the engine repository
pnpm vehicles:calibrate   # ledger → source type documents → aggregate catalog
pnpm vehicles:bench       # what each car does beside its reference figures
```

The figures are representative, compiled from general knowledge of published specifications
and typical road tests without per-row sources: treat them as estimates. All 124 cars corner
within 2% of their skidpad figure and 117 reach 100 km/h within 10% of their time; the rest
are traction-limited rear-drive pickups and muscle cars whose published times assume four-wheel
drive or a prepared launch. Adding a car is one row in the ledger.

## In an Earth view

`mountEarthView` drives the parked cars its street surfaces place, and can add one:
`view.setMode('drive', { vehicle: true })` puts the viewer in a car in the nearest mapped road
lane. `EarthVehicles` exposes the pieces for hosts that compose their own view: `spawn(kind,
position, yaw)` at an exact spot, `spawnNear(kind, x, z, yaw, { avoid })` on the nearest open
ground (under open sky, never a roof or deck), `board(id)` without walking to the door, and
`release()` to step out at once. A standing spawned car settles onto finer terrain as it streams
in. The entity's `vehicle.color`, when set, paints the model's `paintMaterial`; without one the
authored paint stays.

Cars feel the mapped ground under them: paved roads are pavement, tracks and unpaved roads
dirt or gravel, and off the road the land cover decides (grass, forest floor, sand, snow,
wetland). `mountEarthView` wires this itself. A host composing its own view passes
`surfaceAt: (x, z) => audioTerrain.sample(x, z).surface` to `EarthVehicles` (an
`EarthAudioTerrain` observing the semantic tiles); lookups are cached per two-meter cell, and
unmapped ground is pavement. `EarthVehicles.driveline` reports the driven car's `gear` (of
`gears`), `rpm`, `assist`, `surfaceGrip` and `skid` for a HUD, and `view.vehicleStatus()` carries `gear`, `rpm`,
`assist` and `surfaceGrip` for a car with a powertrain.

A host can make boarding two presses, as the world explorer does: `openDoor(eye)` opens the shut
front door (`doorFrontLeft` or `doorFrontRight`) on the walker's side of the nearest car in reach
and returns false when there is none, so the next press falls through to `enter(eye)`.
`closedDoor(id, eye)` names that door for a prompt. The door shuts behind the driver, or once
nobody is within reach; calling `openDoor(eye, id)` after `exit()` swings it open as the driver
steps out.

A stopped [ambient traffic](ambient-life.md#taking-a-stopped-car) car (slower than 0.5 m/s) is a
car in reach too, in `mountEarthView` and for these methods: `openDoor` or `enter` takes it out
of traffic, and a drivable car of its type and paint stands at its pose, after which the doors,
seats and exits work as for any parked car. `trafficSolids()` lists circles around the cars a
driver has left standing, for `EarthAmbient.sync`, so traffic queued behind one keeps its gap
until it drives off. A taken car nobody drove away rejoins traffic once its model unloads 65 m
away; one driven elsewhere stays parked. Moving traffic is never boardable.

Parked cars become simulation entities only within 300 m of the observer passed to `sync`, to
approach, board and collide with; farther ones that nobody moved are reclaimed and stay part of
their tile's merged mesh. Under an aircraft a town's parked cars were otherwise thousands of
dormant entities, spawned as each tile streamed in and visited every tick. The `vehicles` system
also passes over a dormant car after one lookup until a write replaces its state.

Passengers use the same mount contract. A `mountable` lists seats with a role: `driver` seats
drive, `passenger` seats ride. `mountEntity(world, actor, vehicle, 'passenger')` seats someone
beside the driver (stopped vehicle, within `reach` of the seat), the `mounted-seats` system carries
them along, and `unmountEntity` lets any seat out by the exits once the vehicle has stopped. A
passenger climbing in or out leaves the driver's controls alone; the driver leaving idles them.
`driveVehicle` accepts input only from a driver seat, and `self.occupied` engine sounds count only
non-passenger seats. The entities pack's cars and the OH-6 have a `passenger` seat and the P-51D a
rear one. In the Earth view, actors board and leave them (`{ kind: 'board', vehicle }` and
`{ kind: 'alight' }`; see [actors](earth-view.md#actors-companions-and-npcs)), and
`EarthVehicles.unmount(actor)` steps any mounted entity out by those rules.

## Trains and track-guided vehicles

A vehicle whose `spec` has a `rail` block runs on rails. With a track guide in the vehicle
environment it follows the track instead of steering; without one it drives straight with locked
steering, as before.

```json
"rail": { "truckCenters": 15.9, "couplerLength": 22.3, "power": 3100000, "gauge": 1.435 }
```

`truckCenters` is the distance between the two trucks (bogies): the body rides as the chord between
them on curves. `couplerLength` spaces cars in a train. `power` is the power at the rail in watts;
tractive effort is the spec's `engineForce` (the starting tractive effort) up to `power / speed`,
so a locomotive pulls hard from a stand and holds its power at speed. A car without `power` only
brakes. `brakeDeceleration` is the full-service brake, `rollingResistance` and
`aerodynamicResistance` the resistance terms, and grade pulls the train down hill. Wet or icy rail
from the weather reduces adhesion.

Controls are the vehicle input you already have. **W** (positive throttle) powers the train, and
**S** (negative throttle) brakes it to a stand and then backs it. **Space** applies the full brake.
**A** or **D** (steering) picks the left or right route at the next facing switch; the choice holds
until the train passes one, then returns to straight on. The end of the track stops the train,
and a hard stop raises `vehicle-impact`.

### Consists

A `coupled` component puts a car in a train: `{ "leader": "<lead entity>", "offset": 21.5 }`,
the distance in meters from the leader's center back to the car's center. The leader keeps a
trail of the track it ran over in `vehicleState.track.trail`. Its coupled cars ride that trail, so a
train leaving a siding keeps its tail on the siding until the tail passes the switch. Powered cars
add their traction to the leader's (multiple-unit control), and every car adds its mass and brakes.
`consistOffsets(specs)` gives the offsets for cars listed front to back.

```js
import {
  consistOffsets,
  Coupled,
  installVehicles,
  settleRailConsist,
  TrackNetwork,
} from '@bendyline/molen-kernel/vehicles';

const track = new TrackNetwork();
track.set('my-line', [{ points: [[0, -500], [0, 500]] }]);
const env = { groundHeight: () => 0, track };
installVehicles(world, env);
// ...spawn a locomotive 'loco' and cars 'car-1'..'car-n' with vehicle components, then:
const offsets = consistOffsets(specs);
cars.forEach((id, i) => world.set(id, Coupled, { leader: 'loco', offset: offsets[i + 1] }));
settleRailConsist(world, 'loco', env); // lay the trail and stand each car on the track
```

### Track guides

A `TrackGuide` has two calls. `snap(pose, radius)` finds the nearest track point. `advance(pose,
distance, route)` walks along the track and reports whether it passed a switch. `railTop` is the
height of the rail heads above the surface `groundHeight` reports on the track. `TrackNetwork` is
the stock guide over polylines. You hand it track centerlines in groups with `set(group, lines)`
and remove them with `delete(group)`, one group per streamed map tile for example. It continues
across the pieces map data splits a railway into. It treats near-identical copies (tile buffers,
coarser tiles under finer ones) as one track and follows the copy with the highest `rank`. It offers
a choice of route only where tracks really diverge. `nearest(x, z, radius, accept)` finds a
starting point by line tags and `tagsAt(pose)` reads a line's tags back.

### Trains in an Earth view

`EarthRailNetwork` observes the human-features tiles: wrap the features renderer with
`observeSemanticTiles(renderer, rail)`. It builds a `TrackNetwork` from their live railway lines
(not disused lines, tunnels or platforms) and collects stations and platforms. Pass `rail.network`
as `track` to `EarthVehicles`. Then `EarthTrains` makes up and runs trains on it.

```js
const rail = new EarthRailNetwork();
const vehicles = new EarthVehicles({ ...options, track: rail.network });
const trains = new EarthTrains({ vehicles, rail, types });
const train = trains.spawn('freight', x, z, { yaw }); // 'freight' | 'passenger' | 'light-rail'
trains.board(train, 'driver'); // or 'passenger': an engineer drives
// every frame, before vehicles.update(dt, input):
trains.update(dt);
```

`spawn` finds the nearest suitable track within 2.5 km, preferring running lines over yards.
Light-rail trains keep to tram and light-rail lines, and heavy trains keep off them. `EarthTrains.makeUp`
builds a consist from the entity library. A freight train is two road locomotives and a mixed
manifest in blocks of alike cars. A commuter train is a locomotive and bilevel coaches. A light-rail
train is two cars. You can also pass your own `cars`. Riding as a passenger, an engineer drives for
you. It keeps to line speed and slows for curves, stops with the middle of the train at each station
or platform, and waits and runs back the other way at the end of the line. Walking up to a stopped
train and pressing **E** takes the cab's driver's seat, or a free passenger seat in a coach;
`EarthVehicles.freeSeat` picks it. `trains.status()` describes the train the viewer is aboard for a
HUD: speed, mass, line name, route at the next switch and next stop.

A train you drive stops against standing cars and other trains rather than running through them.
Power toward them does nothing while it is up against them, and reversing takes it away. Engineers
stop short of them too. `EarthVehicles.parkedRailCars()` lists the cars standing in the shown yards
(see [rolling stock in yards](surface-rendering.md#railways)), and `addInputFilter` is the hook
`EarthTrains` uses to hold the throttle.

`trains.yard(observer, { max, radius })`, called every frame, keeps up to `max` switchers (default
2) working yard and siding tracks within `radius` meters (default 1400). Each is a yard locomotive
with three to eight cars on a stretch clear of standing cars. Its own engineer runs it back and forth
at about 15 km/h in moves of 70 to 300 m, waiting between them, and never takes it onto the main
line. Switchers left far behind go. You can ride one: walk up and take the conductor's seat.

In World Explorer, **Drive freight**, **Drive commuter** and **Ride commuter** put you on a train
on the nearest railway, and `?train=freight|commuter|ride|light-rail` does the same at startup.
Yards fill with standing cuts wherever parked cars are drawn, and with ambient life on,
switchers work near the camera.
`?yard=0` leaves the switchers out, and `?railCars=0.5` (an occupancy) thins the standing cars.
**Bendy Light Rail** runs on a real light-rail line when one is within 3 km. The `molen.entities`
pack carries the rolling stock: road and yard diesels, a commuter locomotive, bilevel coaches and
a cab car, and seven kinds of freight car. See [Reusable entities](entities.md).

## Riding cycles

The entities pack includes eleven rideable types under `molen.entities.cycle.`: the
`standard_motorcycle`, `cruiser_motorcycle` and `motor_scooter`; the `city_bicycle`, `road_bicycle`
and `cargo_bicycle`; an `underbone_moped` (the step-through commuter of South and Southeast Asia)
and an `electric_moped`; a shared electric `kick_scooter`; and a push `skateboard` and an
`electric_skateboard`. Mount, drive and exit them with the same APIs as cars. In the Earth view
example, select one beside **Drive**, then press **Drive**. **W** supplies motor or pedal power (on
the skateboard, the rider pushes off), **S** and **Space** brake, **A/D** steer, **V** changes view,
and **E** steps off once stopped. None has powered reverse. The Earth view API accepts the full
type ID:

```js
view.setMode('drive', { vehicle: 'molen.entities.cycle.city_bicycle', force: true });
```

`vehicle.spec.cycle` opts into two centreline tire contacts and automatic balance: the cycle
leans into the turn, limited by `maxLean`, and returns upright as it stops. Lean follows lateral
acceleration through damped springs; `g * tan(maxLean)` also limits steering at speed, so reducing the lean
limit increases the minimum turning radius. Braking, tire grip, weather, terrain gaps, collision hooks and safe exits use the existing solver. Bicycles have
lighter mass and lower power and speed limits. `cycle.pedals.ratio` specifies wheel revolutions
per crank revolution; snapshot-safe `vehicleState.pedalAngle` advances under forward power and
holds while coasting or braking. Wheel spin continues while coasting.

The driver seat is a pelvis anchor. `cycle.riderLean`, `handlebarPivot`, `grips`, `footrests` and
optional `pedals` describe metric contact points in model space. The figures capability and
Earth avatar renderer share the same pose evaluator: hands follow the turning handlebars and
feet follow the pedals or footrests. At low-speed steering lock the rider counterweights at the
saddle and turns the shoulders to keep both grips within reach. The stock dimensions fit an adult human; unusually small
or large figures may not reach every contact point of a seated cycle. The cockpit uses `spec.driverEye` separately
from the saddle. `vehicle.visual.animation` binds the moving parts in Earth; `model.signals`
provides the same steering, wheel and pedal animation in ordinary Molen scenes.

### Standing and sideways riders

`cycle.stance` says how the rider stands: on a saddle (`seated`, the default), upright on a deck
facing the bars (`standing`, the kick scooter), or across a board with the left foot forward
(`sideways`, the skateboards). A standing or sideways rider's driver seat is where an adult's hips
go; the pose stands on the idle pose rather than the seated one and raises or lowers the hips to
each body's own legs, so shorter and taller riders keep their feet on the deck and their hands on
the grips. A sideways rider turns across the board, looks down it and leans with it; their
`grips` are free hand positions held out beside the hips, which do not turn with the steering.

`cycle.kick` makes a cycle push-powered. Under power a sideways rider turns forward and pushes off
the ground with the rear foot, one push per `kick.stride` meters (never slower than a push from
rest), then rides sideways again. `vehicleState.pedalAngle` is the phase of the current push and
`vehicleState.kick` eases from 0 (sideways) to 1 (turned to push); a push under way when the power
stops finishes before the rider settles.

A board steers through its trucks rather than a turned wheel: its `visual.frontWheelNodes` is
empty and `visual.animation` turns `truck-front` and `truck-rear` against each other, each by half
the steering angle, which matches the turning circle of the solver's single steered axle.

### Handlebar three-wheelers

`spec.handlebar` gives a vehicle that does not lean (the `molen.entities.vehicle.auto_rickshaw`)
the same rider contacts as a cycle: `riderLean`, `handlebarPivot`, `grips` and `footrests`, with
the driver seat as the pelvis anchor. It drives on the car solver with three wheel nodes, one
steered at the front. Its passengers sit as they do in a car. The auto-rickshaw also has
`headlights` and `wipers` actuators, so **L** and **K** work in it as in a car.

Cycles use the existing `molenVehicle(types, id)` helper and are enumerated separately by
`MOLEN_CYCLE_ENTITY_IDS`; `MOLEN_VEHICLE_ENTITY_IDS` continues to enumerate cars, trucks and the
auto-rickshaw. Motor two-wheelers (the motorcycle, scooter and both mopeds) and the auto-rickshaw
carry an `ambientRole` of weight 0: they never appear in default traffic or parking, only in
regions whose fleet profile weights them (see [Regional vehicle fleets](regional-fleets.md)). In
traffic their riders are drawn on the saddle and two-wheelers lean into turns; parked, two-wheelers
stand two or three to a bay. Bicycles, kick scooters and skateboards never park or join traffic.
Balance is assisted; this is grounded riding, without falls, wheelies, jumps, gears or stunt
simulation.

For a repeatable mounted-rider review in the engine repository:

```sh
molen validate content/entities/scenes/cycles.scene.json
molen sim run content/entities/scenes/cycles.scene.json --setup content/entities/scenes/cycles.setup.mjs --ticks 120 --hash
molen shot content/entities/scenes/cycles.scene.json --setup content/entities/scenes/cycles.setup.mjs --ticks 60 --out content/entities/shots/cycles.png
```

## Engine sound

Every car and truck with a combustion engine carries an `audioSource`: petrol engines run
`vehicle.engine.car`, diesels `vehicle.engine.diesel`, pitched by engine size (a V8 lower than
a four). The engine plays only while someone drives (`self.occupied`), rises in pitch with
`vehicleState.rpm`, so it climbs through each gear and drops at every change, and grows louder
with `vehicleState.engineLoad`. Electric cars are silent; a hybrid's engine is quiet until it is
worked. Any host that plays audio from
the entity world, such as `mountEarthView` or a page with `createAudioLayer(...).attachWorld(world)`,
hears it with no extra code. Override the component on a type or entity to change the sound; see
[Sound and music](audio.md).

## Reusable views and parking data

`@bendyline/molen-client/vehicles` exports `createVehicleVisual`, `createParkedVehicleBatch`,
and `vehicleCameraPose`. `createVehicleVisual(loadedGlb, vehicleData)` binds wheel, steering, and
paint nodes named by `vehicle.visual`; dynamic visuals expose `update(steer, wheelAngle, signals)`
and `dispose()`. `signals` feeds the interior and `vehicle.visual.animation` bindings (see
[exterior animation](vehicle-interiors.md#exterior-animation)); `bodyRoll` and `bodyPitch` among
them keep the wheels planted. The camera helper accepts a transform, `vehicle.spec`, view, look offsets, and an
optional obstruction-distance callback.

Surface objects expose `userData.vehicles: VehiclePlacement[]`; each record has an `id`, external
type `kind`, `color`, resolved `spec`, absolute metric `position`, and `yaw`, with optional
terrain-alignment `pitch` and `roll`. IDs derive from world-space bay positions rather
than tile IDs. Instance meshes retain `userData.vehicleIds` for promotion and duplicate suppression.
The worker transports the same placement records as synchronous generation. Surface objects with
parked cars are tagged `'parked-vehicles'` and water surfaces `'water'` (`tagTerrainObject`), and
Earth view's vehicles visit `taggedTerrainObjects(tag)` shown under their root instead of walking
the whole scene five times a second; a host building its own such objects tags them the same way.

For repeatable visual review open
[World Explorer with `?synthetic=1&parking=1`](https://molen.dev/play/world-explorer/?synthetic=1&parking=1).
In the engine repository, the browser scenario
[`vehicles.play.json`](https://github.com/bendyline/molen/blob/main/examples/world-explorer/test/visual/vehicles.play.json)
visits a car, enters the cockpit, drives, turns in chase view, brakes, and exits; it is also a
working reference for scripting [`molen play`](experience-playback.md) against your own build:

```sh
# in the engine repository, from examples/world-explorer/
pnpm build
npx molen play dist --scenario test/visual/vehicles.play.json --out-dir .artifacts/vehicles
```

## Boats

[Boats and water](boats.md) use the same mounting, passenger seats and camera controls with a
separate hull solver. `mountable.entries` optionally locates a gangway away from the seat;
boat exits are checked against their local deck height. Earth view and World Explorer share
boat launching, driving and dry dockside exits through `EarthVehicles`.
