# Aircraft in the world explorer

See [Vehicle interiors and instruments](vehicle-interiors.md) for cockpit source files,
per-model instrument bindings and the shared exterior/seated GLB contract.

The world explorer includes a P-51D Mustang and OH-6 interpretation, each with an editable
GLB, reusable entity type, flight physics, an instrumented cockpit and a chase camera. Use the
**P-51 Mustang** or **OH-6** buttons to visit the practice airfield, then press **E** to board.
The aircraft buttons also work from the example hub's world view. A direct link can use
`?aircraft=p51d` or `?aircraft=oh6`.

The practice airfield is a raised 900-meter runway and helipad near the initial camera position.
Its foundation clears streamed buildings; it is a fictional practice location, not a mapped airport.
Both aircraft stay in the ECS and retain their position throughout the session, across terrain
streaming and floating-origin changes. Reloading starts a fresh session.

## Controls

| Control | Action |
| --- | --- |
| E | Board, or exit after landing, stopping and engine shutdown |
| I | Start/stop engine; allow the propeller or rotor to spool |
| Shift / Ctrl | Increase/decrease throttle (Mustang) or collective (OH-6); holds its setting on release |
| W / S | Nose down / nose up |
| A / D | Bank left / right; helicopter cyclic |
| Q / Z | Left / right rudder or anti-torque pedals; ground steering in the Mustang |
| Space | Wheel brakes |
| G | Retract/extend Mustang gear while airborne |
| F | Toggle Mustang flaps |
| V | Cockpit / chase |
| Mouse | Look around the cockpit |
| R | Recover at the airfield after an impact |

Mustang: start the engine, set flaps, hold the brake while raising throttle, then release the brake.
Rotate gently around 85–100 knots and release the pitch key once the nose is about 10 degrees up.
Retract gear and flaps after climbing. Reduce throttle on approach, lower gear and flaps, and land
with wings level and a gentle descent. Gear-up and hard landings register an impact.
To accelerate, ease the nose down toward level flight after cleaning up; holding the takeoff
attitude spends engine power on climbing. During a stall, lower the nose, add power and gently
level the wings. Let airspeed rebuild before pulling out; hauling back immediately can stall
the wing again. A stall recovery requires altitude.

OH-6: start the engine and allow roughly six simulation seconds to reach full rotor speed. Raise
collective gradually toward 50%; exact hover power varies with altitude and ground effect. Small
cyclic inputs tilt rotor thrust to travel. Lower collective gently to land. Switch off the engine
and wait for the rotor to stop before exiting. An aircraft cannot be exited or switched to free
flight while airborne. After an impact, R resets its aircraft state and places it on the airfield.

Cockpit needles show airspeed, altitude, heading, vertical speed and RPM; the artificial horizon
banks with the aircraft. The HUD supplies precise knot/feet/feet-per-minute readings, AGL height,
power, engine/gear/flap state, stall alerts and terrain waiting status. Propellers, both helicopter
rotors, controls, gear, flaps and ailerons animate from simulation state.

## Reuse in another experience

Both aircraft ship in the `molen.entities` content pack, with their type documents and models.
`npx molen pack fetch https://molen.dev/packs/index.json molen.entities` downloads it and lists it
in your project.json `packs`, and the CLI then resolves the types; in a browser, open it with `openPack` from `@bendyline/molen-pack` and pass
`createPackSet([pack]).assetProvider()` as the client's asset provider. The entity type IDs and
glTF refs are `molen.entities.aircraft.p51d` and `molen.entities.aircraft.oh6`. Fly both in
[World Explorer](https://molen.dev/play/world-explorer/) to see the finished integration.

These are not kernel presets. Each type document contains the concrete aircraft's mass and center
of gravity, engine and thrust geometry, wing or rotor geometry, control response, lift/drag or
rotor-force coefficients, landing limits, collision probes, GLB reference, animation-node bindings,
seats, and behavior scripts. Molen supplies only the generic `airplane` and `helicopter` algorithms.

```js
import { installAircraft, flyAircraft } from '@bendyline/molen-kernel/aircraft';
import { mountEntity, unmountEntity } from '@bendyline/molen-kernel/vehicles';

export function setup(world) {
  const ground = { groundHeight: (x, z) => 0 };
  installAircraft(world, ground);
  world.registerCommand('board', () => mountEntity(world, 'pilot', 'mustang'));
  world.registerCommand('fly', (_w, command) => flyAircraft(world, 'pilot', command.payload));
  world.registerCommand('exit', () => unmountEntity(world, 'pilot', ground));
}
```

Declare the commands and spawn the pilot and aircraft in your scene, using the type registry.
`Aircraft`, `AircraftInput`, `AircraftState`, `aircraftMounts`, `initialAircraftState` and
`stepAircraft` are exported by `kernel/aircraft`; serializable spec shapes are in schema, while
concrete values live in the external type documents.
The aircraft capability installs the same seat follower as cars, once per world. Mounted actors
bypass walking physics. Only the occupied pilot seat can submit flight intent.

The render half is `@bendyline/molen-client/aircraft`: `createAircraftVisual(loadedGlb, spec)` takes
ownership of a loaded GLB and animates the nodes named by `spec.visual` from aircraft state, and
`aircraftCameraPose(transform, spec, options)` returns the cockpit or chase pose from the same
`VehicleCameraOptions` that `@bendyline/molen-client/vehicles` exports.

The deterministic solver uses lift, induced/profile/gear/flap drag, propeller thrust, air density,
wind-relative airspeed, gravity, ground friction, damped control response and a progressive stall
envelope for the plane. Stall depends on wing incidence, including camber, rather than a fixed
true-airspeed cutoff. Separated flow progressively loses lift and control authority, adds drag,
and unloads the nose toward attached flow for both positive and negative incidence. Lift remains
perpendicular to airflow. Turn assistance follows the lift actually produced; fin stability
aligns the aircraft with the relative wind instead of forcing a level-flight turn during a stall.
Elevator and rudder retain limited propwash authority at low speed. Throttle controls shaft power
with a transient RPM spool limit, avoiding a second steady power penalty from RPM.

`airplane.stallTransitionAngle` sets the separation transition width (radians, default `0.12`),
and `airplane.yawStability` sets sideslip restoring response (1/s at reference airspeed, default
`1`). `stallDrag` is the broadside separated-flow coefficient, scaled by separation and
`sin(alpha)^2`. The legacy `stallSpeed` tuning reference no longer triggers aerodynamic stall.
The authored engine thrust axis is respected. Engine positions relative to the center of mass
produce thrust-induced yaw; wing position remains metadata rather than a distributed lift model.

## Multiple engines and engine failures

An airplane can keep the existing `spec.engine` (implicitly named `main`), or replace it with a
nonempty `spec.engines` array. Supply exactly one form. Every engine has a unique `id`, local
`position`, `thrustAxis`, shaft `power` in watts, and its own RPM/spool configuration. Power and
thrust limits are **per engine**; splitting one engine into two without changing total power or
static thrust means halving each engine's power and thrust cap. Optional engine `propellerEfficiency`, `maxThrust` and
`minPropellerSpeed` override the shared `airplane` values.

For example, derive a synthetic twin from an existing single-engine airplane spec:

```ts
const { engine, ...airframe } = singleEngineSpec;
if (!engine || !airframe.airplane) throw new Error('Expected a single-engine airplane');
const twinSpec = {
  ...airframe,
  engines: [
    { ...engine, id: 'left', position: [2.5, 1, 1], power: engine.power / 2,
      maxThrust: airframe.airplane.maxThrust / 2 },
    { ...engine, id: 'right', position: [-2.5, 1, 1], power: engine.power / 2,
      maxThrust: airframe.airplane.maxThrust / 2 },
  ],
  visual: {
    ...airframe.visual,
    rotors: [
      { node: 'left-propeller', engine: 'left', axis: 'z', multiplier: 1 },
      { node: 'right-propeller', engine: 'right', axis: 'z', multiplier: 1 },
    ],
  },
};
```

Positions are meters from the aircraft's landing-contact origin, with +Z forward, +Y up and
**+X to the pilot's left**. The solver sums each engine's force and computes its yaw moment from
`(position - centerOfMass) × thrust`. A failed left engine therefore leaves the right engine
yawing the nose left. Rudder can counter the yaw; cutting the remaining engine removes the
powered asymmetry. Greater lateral separation produces a larger moment. `airplane.yawInertia`
sets yaw inertia in kg m² (default `mass * (span² + length²) / 12`), while `thrustYawDamping`
sets the thrust-induced yaw-rate damping in 1/s at reference airspeed (default `1.2`). Damping
scales with airspeed, with a 20% floor; ground tracking adds damping while on the wheels.

The normal throttle and engine switch still control the whole bank. Optional
`aircraftInput.engines` entries override individual throttles or switches; omitted fields inherit
the common controls. The common `engine: false` always shuts every engine down. In a host setup:

```js
import { flyAircraft, setAircraftEngineFailed } from '@bendyline/molen-kernel/aircraft';

flyAircraft(world, 'pilot', {
  power: 0.8, engine: true, pitch: 0, roll: 0, yaw: 0,
  gear: false, flaps: false, brake: false,
  engines: { left: { power: 0.6 }, right: { enabled: true } },
});
setAircraftEngineFailed(world, 'twin', 'left');        // latch a failure
setAircraftEngineFailed(world, 'twin', 'left', false); // explicit repair
```

`setAircraftEngineFailed` returns false for an unknown aircraft or engine. A failure immediately
removes powered thrust and lets that propeller spool down; pilot throttle/switch input cannot
repair it. Failure triggers belong to the experience (for example a damage or training command).
The shipped world explorer still has its two single-engine aircraft and common controls; this
API does not add a twin-engine model, failure key or automatic random failures.

`aircraftState.engines[id]` stores `rpm`, `rotorAngle`, `failed` and current `thrust` in newtons.
The solver initializes missing engine state from the legacy RPM/phase, then the per-engine state
is authoritative. The aggregate `rpm` is the maximum across engines, and aggregate `rotorAngle`
follows the first engine. Set `visual.rotors[].engine` to animate independent propellers; omitted
bindings retain the common phase. `thrustYawRate`, all engine state and input overrides survive
keyframes/replay and pause at terrain gaps. Boarding and exit checks consider every engine.

This extension models propeller aircraft thrust imbalance within the assisted flight solver.
It does not add roll/pitch thrust moments, propeller reaction torque, P-factor, feathering,
windmilling drag or a calibrated minimum-control-speed envelope. Helicopters continue to use
one `engine` driving the shared rotor; multiple turbines feeding a common gearbox require a
different shaft-power model and are not represented by independent propeller engines.

Helicopter forces include rotor spool, collective lift, cyclic tilt, ground effect,
translational lift, air drag and assisted yaw. State includes velocity, attitude/rates, rotor phase
and controls for checkpoint/replay. Translational lift uses air-relative horizontal speed, so
wind and forward motion give consistent results. Collision sampling is at least 120 Hz and at most one meter
of translation per substep. Unknown terrain pauses at the last known position and resumes when
support is available.

Hosts can supply `groundHeight`, `wind` and `canOccupy(transform, spec, entity)`. The world view
checks nearby resident geometry, the airfield, cars and other aircraft. Cars and exits also check
conservative aircraft bounds. Imported collision hulls are
available for hosts that need a different collision solver. Without `canOccupy`, the kernel only
collides with terrain. Do not add a second physics body that also writes the aircraft transform.

This is an assisted game flight model with recognizable polygonal aircraft, not a full aircraft
systems simulation. Pitch and bank are bounded; aerobatic loops, spin recovery, rotor blade-element
aerodynamics, autorotation, vortex-ring state, fuel, automatic engine damage, detailed avionics and weapons
are outside this implementation. Cockpit switches and pedals are visual details; the listed input
controls operate the simulated systems. Collision uses coarse airframe probes and resident world
geometry; it does not model deformation or distant unloaded obstacles.

## Reproducible review

The source brief, generator, provenance and verification notes are in the engine repository, in
the copyable [P-51 source bundle](https://github.com/bendyline/molen/blob/main/content/entities/source/aircraft/p-51/README.md) and
[OH-6 source bundle](https://github.com/bendyline/molen/blob/main/content/entities/source/aircraft/oh-6/README.md).
`content/entities/scenes/aircraft.scene.json` there is the neutral apron scene. The browser flight
scenario is `examples/world-explorer/test/visual/aircraft.play.json`.

`packages/kernel/test/aircraft-performance.test.ts` exercises level acceleration, part-throttle
power, configuration drag, stall recovery from either bank direction, coordinated turns,
unpowered energy loss, wind equivalence and 30/60/120 Hz consistency. In calm air at 1,000 m,
starting at 60 m/s and using a test pilot to hold altitude for 120 seconds, the tuned Mustang
reaches approximately 311 knots at full throttle, 262 knots at 65% throttle, and 203 knots with
gear and flaps extended. These are simulation regression targets, not a certified performance
chart or an altitude-hold feature available to the player.

`packages/kernel/test/aircraft-engines.test.ts` covers symmetric two/four-engine layouts,
mirrored engine failures, counter-rudder, thrust moment arms, independent switches/spool,
explicit repair, terrain rollback, exit safety, keyframe restoration and 30/60/120 Hz consistency.
