# Mountable vehicles and driving

Vehicles can carry authored [glass surfaces](glass.md). Collision impulses load each pane by
its mass and orientation: laminated windshields crack while retained, tempered panes fragment,
and frame/interlayer failure is independent of fracture.

Generic vehicles use the Bendy house brand, with stable asset/type IDs. The Bendy Bus and
Bendy Light Rail are also mountable through the vehicle API. World Explorer has buttons for
both at the practice area: W/S applies traction or reverse, Space brakes, V switches view,
and E exits after stopping. The bus steers with A/D; light rail has locked steering on its
straight practice track. Player controls do not yet follow curved rail-network routes.
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

Cars drive on their tires. Push one past its grip and it slides: a front-drive sedan runs wide, a
rear-drive pickup on full power swings its tail round, and steering with the handbrake up throws
the back out for a handbrake turn. Brakes are anti-lock, so you can still steer while stopping.
Rain and snow from the Weather setting make the road slippery (about 40% and 100% longer stops),
and gusts push on the body. The body dives under braking, squats under power and leans out of
turns. Hitting a wall or another car bounces you off it, and a corner hit spins you. The controller checks both sides and then the rear;
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
friction coefficient); straight-line grip is 15% higher, and drive and brakes share it with
cornering, so a car braking or under power at the limit steers less. `drive` picks the front,
rear or all wheels; drive beyond the grip spins them. Anti-lock brakes split by `brakeBias` and
stop just short of the limit. `handbrake` locks the rear wheels, which then slide. State carries
the forward `speed`, the sideways `lateralSpeed`, `yawRate` and a 0–1 `skid` for tire sounds or
effects.

Weight moves between the axles through the suspension: the sprung body pitches by
`pitchStiffness` and rolls by `rollStiffness` (radians per g) on springs of
`suspensionFrequency` and `suspensionDamping`, so braking loads the front tires and lifting off
in a turn can tighten it. `bodyPitch` and `bodyRoll` add to the terrain `pitch` and `roll` in the
transform, so the cockpit view feels them too. Passed to the car visual as signals, they become
suspension travel: the wheels move against the lean and stay on the road. Steering lock and steering speed fade with road
speed (`steeringFadeSpeed`), and full lock never asks for more than half again the cornering the
tires can give, so a keyboard tap changes lanes instead of spinning the car. At walking pace the
car simply rolls where its wheels point, so it never turns in place and parks exactly.

`installVehicles` reads the world's `weather`: rain takes up to 30% of the grip and snow up to 60%
(`weatherGrip(weather)`), and the wind field, gusts included, pushes on the body's long side.
Engine force, top and reverse speeds, rolling and air resistance, mass, wheel geometry and terrain
tolerances come from `vehicle.spec` as before, and `yawInertia` defaults from the body size.

Collision probes run at 120 Hz or finer through the host's `canOccupy` adapter. When it refuses a
move, the solver finds which way is open by probing around the car, and answers with an impulse at
the corner that struck: a bounce that grows with impact speed (none below walking pace, so a car
can rest against a wall), scraping friction along the obstacle, and a spin. `installVehicles` emits
`vehicle-impact` (5 m/s or more) and `vehicle-bump` (1.5 m/s or more) with the car's `entity` and
the closing `speed`; the Earth soundscape plays a metal impact for each. World explorer uses an
oriented chassis against other cars and nearby triangles for walls, fixtures and buildings; the
car it hits stays put. Terrain gaps pause motion; abrupt steps and slopes above 35 degrees stop
the car. Cockpit views use the full chassis quaternion; chase views shorten at obstructions.

This is a grounded driving model. It does not implement airborne rotation, rollovers, crash
deformation or damage, pushing other cars, per-surface friction (grass and gravel grip like the
road), passenger animation, multiplayer ownership, or disk persistence. Background traffic is a
separate package: [ambient life](ambient-life.md) moves NPC cars along lanes without this solver,
and they stop for a car someone is driving. Without collision hooks, the reusable kernel solver
supplies terrain driving only. Do not attach a second physics body to the same vehicle; the
vehicle solver owns its transform.

All durable simulation state and mount relationships live in ECS components and survive keyframes
and replay. Install the same systems/environment when restoring. Host streaming and render resources
are separate from those checkpoints.

## In an Earth view

`mountEarthView` drives the parked cars its street surfaces place, and can add one:
`view.setMode('drive', { vehicle: true })` puts the viewer in a car in the nearest mapped road
lane. `EarthVehicles` exposes the pieces for hosts that compose their own view: `spawn(kind,
position, yaw)` at an exact spot, `spawnNear(kind, x, z, yaw, { avoid })` on the nearest open
ground (under open sky, never a roof or deck), `board(id)` without walking to the door, and
`release()` to step out at once. A standing spawned car settles onto finer terrain as it streams
in. The entity's `vehicle.color`, when set, paints the model's `paintMaterial`; without one the
authored paint stays.

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

## Riding cycles

The entities pack includes six rideable types: `molen.entities.cycle.standard_motorcycle`,
`cruiser_motorcycle`, `motor_scooter`, `city_bicycle`, `road_bicycle` and `cargo_bicycle` (the same
namespace prefix applies to each). Mount, drive and exit them with the same APIs as cars. In the
Earth view example, select a cycle beside **Drive**, then press **Drive**. **W** supplies motor or
pedal power, **S** and **Space** brake, **A/D** steer, **V** changes view, and **E** steps off once
stopped. These cycles have no powered reverse. The Earth view API accepts the full type ID:

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
or large figures may not reach every contact point. The cockpit uses `spec.driverEye` separately
from the saddle. `vehicle.visual.animation` binds the moving parts in Earth; `model.signals`
provides the same steering, wheel and pedal animation in ordinary Molen scenes.

Cycles use the existing `molenVehicle(types, id)` helper and are enumerated separately by
`MOLEN_CYCLE_ENTITY_IDS`; `MOLEN_VEHICLE_ENTITY_IDS` continues to enumerate cars and trucks.
Cycles are excluded from automatic car parking and ambient traffic. Balance is assisted; this
is grounded riding, without falls, wheelies, jumps, gears or stunt simulation.

For a repeatable mounted-rider review in the engine repository:

```sh
molen validate content/entities/scenes/cycles.scene.json
molen sim run content/entities/scenes/cycles.scene.json --setup content/entities/scenes/cycles.setup.mjs --ticks 120 --hash
molen shot content/entities/scenes/cycles.scene.json --setup content/entities/scenes/cycles.setup.mjs --ticks 60 --out content/entities/shots/cycles.png
```

## Engine sound

The original five road vehicle types carry an `audioSource`: the compact, sedan and SUV run
`vehicle.engine.car`, the pickup and van `vehicle.engine.diesel`, each with its own pitch. The
engine plays only while someone drives (`self.occupied`), rises in pitch with
`vehicleState.speed`, and grows louder with `vehicleInput.throttle`. Any host that plays audio from
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
