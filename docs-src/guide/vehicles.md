# Mountable vehicles and driving

World explorer's parking cars are external entity types with stable IDs, metric dimensions, and five
models: compact, sedan, SUV, pickup and van. You can walk up to one, get in and drive it.

Each type owns its GLB reference, complete physics configuration, seats, named visual bindings,
and optional deterministic scripts. Dormant cars use generic dimension-driven instance proxies;
approaching or entering one loads its independent GLB with its own interior and controls. See
[Vehicle interiors](vehicle-interiors.md). No concrete car model or handling catalog is compiled
into schema, kernel, or client. The P-51D Mustang and OH-6 share the same mount/seat foundation
and add separate flight controls, physics, assets and cockpit cameras; see [Aircraft](aircraft.md).

In **Walk mode**, approach a car and press **E** to enter its driver seat. **W/S** accelerate or
brake then reverse; **A/D** steer; **Space** brakes; **V** switches cockpit/chase views. Mouse look
works while seated. Stop and press **E** to exit. The controller checks both sides and then the rear;
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
a payload schema with `throttle` and `steering` numbers in [-1,1] and a boolean `brake`.
Run this setup through `buildWorld`, the Worker, or `molen sim run --setup`.

`mountable.seats` is reusable for passenger seats or non-car mounts. Each seat has a unique
`id`, a `driver` or `passenger` role, and a local camera/rider anchor `position`. `exits` are
ordered local foot positions; `reach` limits mounting distance. A seat accepts one rider, and
only the current driver can submit vehicle intent. Mounted actors bypass the kernel character
and kinematics solvers. When the mount disappears, the rider is detached.

The fixed-step bicycle solver integrates signed speed, steering slew, wheel rotation, mass-scaled
engine force, rolling/air resistance, braking, reverse limits, lateral grip, gravity and four-wheel
terrain support. All chassis-specific coefficients, mass/center of gravity, wheel geometry, limits,
and terrain tolerances come from `vehicle.spec`. Collision probes run at 120 Hz or finer (through
the host's `canOccupy` adapter).
World explorer uses an oriented chassis against other cars and nearby triangles for walls,
fixtures and buildings. Terrain gaps pause motion; abrupt steps and slopes above 35 degrees stop
the car. Cockpit views use the full chassis quaternion; chase views shorten at obstructions.

This is a grounded driving foundation. It does not implement rigid-body rollovers, crash deformation,
traffic AI, passenger animation, multiplayer ownership, or disk persistence. Without collision hooks,
the reusable kernel solver supplies terrain driving only. Do not attach a second physics body to the
same vehicle; the vehicle solver owns its transform.

All durable simulation state and mount relationships live in ECS components and survive keyframes
and replay. Install the same systems/environment when restoring. Host streaming and render resources
are separate from those checkpoints.

## Reusable views and parking data

`@bendyline/molen-client/vehicles` exports `createVehicleVisual`, `createParkedVehicleBatch`,
and `vehicleCameraPose`. `createVehicleVisual(loadedGlb, vehicleData)` binds wheel, steering, and
paint nodes named by `vehicle.visual`; dynamic visuals expose `update(steer, wheelAngle)` and
`dispose()`. The camera helper accepts a transform, `vehicle.spec`, view, look offsets, and an
optional obstruction-distance callback.

Surface objects expose `userData.vehicles: VehiclePlacement[]`; each record has an `id`, external
type `kind`, `color`, resolved `spec`, absolute metric `position`, and `yaw`, with optional
terrain-alignment `pitch` and `roll`. IDs derive from world-space bay positions rather
than tile IDs. Instance meshes retain `userData.vehicleIds` for promotion and duplicate suppression.
The worker transports the same placement records as synchronous generation.

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
