# Aircraft in the world explorer

The world explorer includes 53 aircraft: the P-51D Mustang, OH-6 interpretation, Bendy Small Airliner
and fifty additional real-type interpretations. Each has an editable GLB, reusable entity type,
flight physics, an instrumented cockpit and a chase camera. The additions include ten helicopters,
ten general aviation aircraft, ten fighters, five cargo transports, the MV-22B Osprey, AV-8B Harrier
and thirteen utility, regional, historic and business aircraft. All use clean configurations without
external weapons.

Compare national markings and camouflage in the [livery gallery](livery-gallery.md), then
find every aircraft’s choices and reference evidence in the [livery catalog](livery-catalog.md#aircraft).

Use the **P-51 Mustang**, **OH-6** or **Bendy Small Airliner** buttons to visit the practice airfield, then press **E** to
board. The aircraft buttons also work from the example hub's world view. A direct link can use
`?aircraft=p51d`, `?aircraft=oh6` or `?aircraft=airliner`. The **Aircraft catalog** selector visits
the additional models; direct links also accept suffixes such as `?aircraft=uh_1h`,
`?aircraft=f_16b`, `?aircraft=c_17a` and `?aircraft=mv_22b`.
The three original practice models load initially. Additional GLBs load on selection, with one
additional request in flight and intermediate selections coalesced. Replacing a selection releases
its model and ECS entity; an occupied aircraft is retained. The host's content-pack byte cache
still follows its own cache budget. The catalog does not download all fifty new models on entry.
See [Vehicle interiors and instruments](vehicle-interiors.md)
for cockpit source files, per-model instrument bindings and the shared exterior/seated GLB
contract.

The practice airfield is a raised 4,500-meter runway and helipad near the initial camera position.
Its foundation clears streamed buildings; it is a fictional practice location, not a mapped airport.
The aircraft stay in the ECS and retain their position throughout the session, across terrain
streaming and floating-origin changes. Reloading starts a fresh session.

## Controls

| Control | Action |
| --- | --- |
| E | Board, or exit after landing, stopping and engine shutdown |
| I | Start/stop engine; allow the propeller or rotor to spool |
| = / − | Increase/decrease throttle or helicopter collective; fighter afterburners engage above 85% throttle |
| W / S | Nose down / nose up |
| A / D | Bank left / right; helicopter cyclic |
| Z / C | Left / right rudder or anti-torque pedals; ground steering in the Mustang |
| Space | Wheel brakes |
| G | Retract/extend airplane gear while airborne |
| F | Toggle airplane flaps |
| J | Cycle powered-lift lever: forward, 22.5°, 45°, 67.5°, vertical; Osprey/Harrier only |
| V | Cockpit / chase |
| Mouse | Look around the cockpit |
| R | Recover at the airfield after an impact |

Mustang: start the engine, set flaps, hold the brake while raising throttle, then release the brake.
The propeller swings the nose left as the tail gets light, and a crosswind turns it into the wind:
hold a little right rudder (C), or rudder away from the wind, to keep the runway centerline.
Rotate around 85–100 knots and release the pitch key once the nose is about 10 degrees up; the
airplane keeps the attitude it lifted off at. At climb power the propeller's torque rolls it
slowly left, so tap right bank (D) as needed. Retract gear and flaps after climbing. Reduce
throttle on approach, lower gear and flaps, and land with wings level and a gentle descent.
Gear-up and hard landings register an impact. To accelerate, ease the nose down toward level
flight after cleaning up; holding the takeoff attitude spends engine power on climbing. During a
stall, lower the nose, add power and gently level the wings. Let airspeed rebuild before pulling
out; hauling back immediately can stall the wing again, and rudder in a stall drops a wing. A
stall recovery requires altitude.

There are no attitude limits: hold A or D to roll through inverted, hold S at speed to loop.
Releasing the stick holds the flight path the airplane is on; a brief tap of W or S changes it
by a degree or so. Above about 250 knots full back stick stops at 6 g. In a bank the wing's lift
no longer holds the airplane up, so add back pressure to keep a turn level. Gusts and turbulence
from the Weather setting bump, roll and yaw the airplane, more so near the ground on windy days.

OH-6: start the engine and allow roughly six simulation seconds to reach full rotor speed. Raise
collective gradually toward 50%; exact hover power varies with altitude and ground effect. Small
cyclic inputs tilt rotor thrust to travel. Lower collective gently to land. Switch off the engine
and wait for the rotor to stop before exiting. An aircraft cannot be exited or switched to free
flight while airborne. After an impact, R resets its aircraft state and places it on the airfield.

Bendy Small Airliner: the generic 39-meter twin uses the same airplane controls, with slower
responses and a lower load-factor limit than the Mustang. Its two independently named engines
use the jet thrust model, calibrated to a representative Mach 0.78 cruise. It is a fictional
aircraft. The flight deck has an animated yoke; its display
markings are decorative, while live flight readings come from the HUD. Board at the forward
entry point. Its larger footprint needs substantially more runway and clearance.

Osprey and Harrier: use J to select vertical thrust (the parked Osprey starts there), allow the nacelles/nozzles to
reach 90°, start the engine and increase power smoothly. W/S, A/D and Z/C provide powered pitch,
roll and yaw control in a hover. Transition toward forward thrust gradually while gaining airspeed;
the nacelles take 12 seconds for full travel and Harrier nozzles take 3. These are simplified
powered-lift dynamics, with finite travel, vertical thrust, engine-dependent hover authority and
airspeed blending. They do not simulate a real conversion corridor, transmission cross-shaft,
vortex-ring state, hot-gas ingestion or a certified nozzle schedule. Fixed landing gear remains
down regardless of G. Cargo aircraft have larger clearance and runway requirements.

Cockpit needles show airspeed, altitude, heading, vertical speed and RPM; the artificial horizon
banks with the aircraft. The HUD supplies precise knot/feet/feet-per-minute readings, AGL height,
g load, power, engine/gear/flap state, stall alerts and terrain waiting status. It distinguishes
KTAS from equivalent airspeed (KEAS), shows local Mach and afterburner percentage, and flags
airframe/surface overspeed and developed departures. KEAS is not calibrated indicated airspeed.
Propellers, both helicopter
rotors, controls, gear, flaps, ailerons, elevators and rudder animate from simulation state. The
Mustang's gear takes 12 seconds: its inner wheel doors open, each main leg swings inboard into a
well in the wing root, the tail wheel folds forward into the fuselage, and the doors close behind
them. Its flaps take 13 seconds to run down to 50°.

## Collisions and breakable sections

Aircraft contacts apply impulses at the point of impact, including angular response, friction
and a small rebound. A wingtip strike can turn the aircraft while it keeps moving; a wreck
continues to fall, tumble and slide. Terrain is tested at the airframe probes as well as at the
landing origin, so a banked wing can hit the runway before the wheels or fuselage.

The Mustang has detachable wings, tail surfaces and propeller; the OH-6 has separate main rotor,
tail rotor and tail sections; the small airliner has detachable wings (with their engines) and
tail. Every animated rotor, propeller and fan in the aircraft catalog has its own collision disc
and breakable joint. Strong impacts
or repeated loaded scrapes consume joint integrity. Separation removes the section's collision
probes, reduces lift/control authority and can disable its attached engines. An asymmetric wing
loss produces a rolling moment. Detached geometry retains its own velocity and spin, then falls,
bounces and slows against terrain and resident obstacles. Debris expires after 20 simulation
seconds; the missing section stays missing. **R** repairs the aircraft and clears debris.
Losing both wings switches the fuselage to ballistic wreck motion, disabling thrust and flight
controls. Ground and obstacle contact dissipates wreck spin as well as sliding motion, so the
fuselage settles after impact; airborne wrecks continue to fall and tumble.
Other aircraft retain their existing airframe probes alongside their independent rotor parts;
additional wing, tail and gear separation requires authored section bindings.

Rotors collide across their complete swept disc, including its interior and the spaces between
the old tip probes. The obstacle adapter clips triangles to the disc's thickness and tests the
radial boundary: geometry above or below a horizontal rotor clears it. Both rotors on tandem
helicopters and both Osprey proprotors are independent; the latter follow the actual nacelle
conversion position. Blade speed contributes to joint damage, so hovering beside a post can
break a spinning rotor even when the hub is stationary. Propeller loss disables its engine;
tail-rotor loss removes anti-torque authority and produces yaw. These conservative swept
volumes remain active when stopped, regardless of visible blade phase.

For custom models, `spec.collisionParts` replaces `collisionProbes`. Every section declares a
unique `id`, a `role` (`body`, `leftWing`, `rightWing`, `tail`, `rotor`, `tailRotor`, `gear` or `engine`), local
probe centers and sphere `radius`, a section `center`, `massFraction`, and GLB `nodes`. Add
`breakSpeed` in m/s for a breakable joint and `engines` for engines carried by that section.
Keep a non-detachable `body` and at least 20% of the mass. Optional `fragments` selects triangles
from shared static detail meshes using a model-space bounding box, so markings follow a wing.
`disc` replaces a section's sphere probes with a model-space `center`, unit `normal`, `radius`,
`halfThickness` and `rotor` node from `visual.rotors`. Its optional `tilt` hinge (`pivot`, unit
`axis`, `angle`) follows `thrustVectorPosition`. A `parent` part id makes a rotor separate when
its supporting wing or tail breaks, with no duplicate geometry or debris. Detached rotors
inherit their shaft spin. Terrain uses deterministic samples of the disc interior, rim and
lowest point; arbitrary height fields are not exact triangle meshes.

These are gameplay approximations with authored joint strengths, not a structural engineering
or accident-reconstruction model. Detached pieces use sphere collision proxies; mesh deformation, fire,
debris-to-debris contacts and impulse transfer into other vehicles are not simulated. The obstacle
adapter uses oriented boxes for other cars and body-center spheres for other aircraft.

Hosts provide `AircraftEnvironment.contacts(probes, entity)` with world-space contact points,
outward normals and penetration depths. `aircraftObstacleContacts` from `client/aircraft`
adapts a collision tree, cars and other aircraft to this contract; the Earth view and world
explorer use it. The legacy `canOccupy` callback remains supported with a simple recoil because
it supplies no contact normal. `aircraftState.damage` and `debris` are serializable and survive
keyframes; `crashed` means damage requiring recovery and no longer freezes motion.

## Reuse in another experience

All 53 aircraft are registered in the `molen.entities` content pack, with their type documents and models.
`npx molen pack fetch https://molen.dev/packs/index.json molen.entities` downloads it and lists it
in your project.json `packs`, and the CLI then resolves the types; in a browser, open it with `openPack` from `@bendyline/molen-pack` and pass
`createPackSet([pack]).assetProvider()` as the client's asset provider. The entity type IDs and
glTF refs are `molen.entities.aircraft.p51d`, `molen.entities.aircraft.oh6` and
`molen.entities.aircraft.airliner`. Fly them in
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
`VehicleCameraOptions` that `@bendyline/molen-client/vehicles` exports. The gear and flaps follow
`aircraftState.gearPosition` and `flapPosition` as they travel. `spec.visual.animation` adds
exterior moving parts as [model-signal bindings](vehicle-interiors.md#exterior-animation), with
keyframed curves so one gear position can sequence doors and legs.

Exposed airplane propellers fade from individual blades into a translucent, soft-edged disk
between 20 and 60 rad/s (about 190–570 RPM). The disk follows actual shaft speed, including
independent engines and spool-down, so blades cannot appear frozen at normal operating RPM.
Its size and radial colors come from the blade geometry and materials; separate central hubs stay solid.
This render-only effect needs no model changes and works with WebGL and WebGPU. Helicopter
rotors and enclosed jet fans retain their existing animation.

For powered lift, declare `spec.poweredLift` with positive `transitTime`, `controlFadeSpeed`,
`pitchAuthority`, `rollAuthority`, `yawAuthority` and `damping`, and mark the participating
forward-facing engine installations `vectored: true`. `aircraftInput.thrustVector` is 0–1;
`aircraftState.thrustVectorPosition` is its actual actuator position. The model signal
`thrustVector` follows that position, so visuals and forces remain synchronized. Thrust rotates
from local +Z to +Y; off-center engines generate moments. Hover controls require available
engine thrust and fade with axial airspeed. `spec.airplane.fixedGear` keeps fixed undercarriage
extended independently of the pilot's selection.

The deterministic airplane solver is a six-degree-of-freedom rigid body. The transform's
quaternion is the attitude, with no pitch or bank stops, so loops, rolls, inverted flight and
spins follow from the forces; `aircraftState.yaw`, `pitch` and `roll` report that attitude (roll
is ±π inverted). Forces are lift, induced/profile/gear/flap drag, side force, propeller thrust
or jet thrust and gravity at the center of mass, from wind-relative airflow and air density. Moments are
angle-of-attack (pitch) and weathercock (yaw) stability, roll, pitch and yaw damping, dihedral
effect, roll from yaw rate, inertia coupling, asymmetric thrust, and, scaled by
`propellerEffects`, propeller torque, P-factor and slipstream yaw, and gyroscopic precession.
The airframe turns about its center of mass in flight and about its wheels on the ground.

Stall depends on wing incidence, including camber, rather than a fixed true-airspeed cutoff.
Separated flow progressively loses lift and control authority, adds drag, breaks the nose toward
attached flow, and loses roll damping so yaw drops a wing. Lift remains perpendicular to airflow.
Elevator and rudder retain limited propwash authority at low speed. Throttle controls shaft
power for propellers and dry/reheat thrust for jets, with a transient RPM spool limit.

### Propulsion, altitude and performance

All 53 shipped aircraft have separate performance profiles. `engine.propulsion: 'propeller'`
uses shaft power, propeller efficiency and an altitude lapse, with `ratedDensityRatio` representing
supercharging or flat rating. `'jet'` uses `dryThrust` in newtons, density lapse and a Mach-dependent
ram term. `afterburnerThrust` is total augmented thrust per engine. The last 15% of throttle
commands reheat by default (`afterburnerDetent: 0.85`); it takes 0.6 seconds to light fully after
the engine reaches operating RPM. Engine failure or cutoff extinguishes it. Ordinary turbofans
and the Harrier have no afterburner. Omitting `propulsion` retains legacy constant-power behavior.

The atmosphere has standard temperature lapse layers, including the tropopause; sound speed
therefore changes with altitude. Wind-relative TAS drives forces; `equivalentAirspeed` is
`TAS * sqrt(density / 1.225)` and `mach` uses local sound speed. `criticalMach` and `waveDrag`
add a continuous transonic drag rise. Ground effect reduces induced drag near the surface.
`maxMach`, `maxEquivalentAirspeed`, `gearLimitSpeed` and `flapLimitSpeed` set overspeed alerts;
they do not impose a velocity cap or silently break the airframe. Surface limits are EAS
approximations, not exact POH calibrated-airspeed limits. Flap input can be a boolean or a
fraction from 0 to 1, allowing intermediate settings through commands.

The F-14 profile has an empirical high-alpha departure model: directional stability fades,
rudder/elevator authority is blanked, aileron response can reverse, and yaw autorotation can
sustain a flat spin. A symmetric stall does not receive an arbitrary spin direction. The
torque-free angular integrator preserves rotational energy through rapid rotations. NASA's
[F-14 model research](https://www.nasa.gov/pdf/601262main_ModelingFlight-ebook.pdf), especially
printed pages 126–127, supports these mechanisms; it does not supply a validated F-14D
coefficient set. This model does not reproduce the F-14A's TF30 compressor stalls, the later
digital flight-control system, or automatic variable wing sweep aerodynamics.

Helicopters retain assisted cyclic and collective controls. An actuator-disc power budget limits
lift by installed shaft power, induced power, rotor profile losses and parasitic drag power;
increasing payload cannot create extra engine power. Their calibrated parasitic drag,
density-dependent lift, ground effect and translational lift are supplemented by optional
vortex-ring lift loss in powered, slow descent and retreating-blade lift loss above an authored
equivalent speed. These are qualitative approximations, not blade-element models or an
autorotation training model. Powered-lift conversion has the separate limitations described above.

### Headless fleet experiments

In the engine repository, build the packages before running the graphics-free harness:

```sh
pnpm aircraft:bench --flight --check --out=.artifacts/aircraft-performance.json
pnpm aircraft:bench --id=f-14d --json
```

The harness uses the production kernel. It solves steady lift/thrust/drag balance, sweeps five
altitudes, and runs three-minute controlled flights from 85% of each reference speed. It reports
multiple equilibrium branches rather than assuming a supersonic branch can always be reached.
The fleet unit suite also checks a withheld DA42 cruise point, F-22 dry supercruise, dirty
configuration, hot air, uniform-wind invariance and timestep convergence. Kernel tests exercise
spin symmetry, energy conservation, engine failures and reheat transients.

Reference conditions and provenance live in the
[performance ledger](https://github.com/bendyline/molen/blob/main/content/entities/source/aircraft-performance.json).
Published cruise, maximum and operating speeds are different quantities. Where a source does
not specify weight, altitude or throttle, the test condition is explicitly estimated. Some
aircraft still have engineering-estimate anchors. Passing a fitted anchor establishes internal
consistency, not independent real-world validation. All polar, lapse and high-alpha coefficients
remain approximations. Fuel burn, stores, continuous CG changes, detailed engine maps, icing,
fatigue, load-induced structural failures and certified flight-control laws are not modeled.

Flight assistance is limited to the pitch axis, so a keyboard can fly it. The stick moves an
elevator (deflecting at `pitchResponse` per second and springing back four times faster) that
adds up to `pitchAuthority` radians of angle of attack to a trim angle; the airframe's
short-period dynamics (`pitchFrequency`, `pitchDamping`) fly toward it. Trim follows the angle of
attack that keeps the flight path straight at `autoTrim` per second (0 leaves it fixed, like a
real stick-fixed airplane), is captured at liftoff, and never exceeds the stall. Full stick stops
at `maxLoadFactor` / `minLoadFactor` g at high speed. Ailerons command a roll rate
(`rollAuthority`) against roll damping (`rollResponse`). The rudder is a yaw moment
(`rudderAuthority`) against `directionalStability` and `yawDamping`; yaw damping acts on half the
turn rate, so turns need little rudder while dihedral (`dihedralEffect`) still levels the wings
slowly hands-off. Rates are given at `controlAuthoritySpeed` and scale with dynamic pressure.

On the ground a steerable tailwheel (`groundSteerSpeed`) and tire side grip (`groundTrackRate`)
hold the rolling direction to the nose, sharing the load with the wing: as lift builds the
tires let go, so crosswind weathervaning and propeller swing grow through the takeoff roll and
drift persists after touchdown. The gear holds the wings level and the nose at its resting
attitude until the elevator lifts it, up to `maxGroundPitch`.

The gear and flaps travel rather than switch. `aircraftInput.gear` and `flaps` select a position,
and `aircraftState.gearPosition` and `flapPosition` (0 up, 1 down) move toward it over
`airplane.gearTransitTime` seconds for a full gear cycle, doors included, and `flapTransitTime`
for full flap travel. Gear drag, flap lift and flap drag scale with the positions. A
weight-on-wheels lock holds the gear still on the ground, so selecting it up before takeoff raises
it once the wheels leave the runway. Touching down before the gear locks down is a belly landing,
which counts as a crash. Both times default to 0, which switches instantly as before, and a state
without positions starts at the selection.

Each engine's `propellerRotation` (default `clockwise` seen from the cockpit, the left-turning
case) and `propellerInertia` set the direction and size of the propeller effects;
`airplane.propellerEffects` scales them from 0 (none, the default) to 1. The shipped Mustang uses
0.2, enough to feel on the takeoff roll and at climb power; raise it toward 1 for the full
handful. `rollInertia`, `pitchInertia` and `yawInertia` set the moments of inertia.
`airplane.stallTransitionAngle` sets the separation transition width (radians, default `0.12`).
`stallDrag` is the broadside separated-flow coefficient, scaled by separation and
`sin(alpha)^2`. The legacy `stallSpeed` tuning reference no longer triggers aerodynamic stall.
Wing position remains metadata rather than a distributed lift model.

`levelFlightAngleOfAttack(spec, airspeed, density?)` returns the angle of attack that carries an
airplane's weight. Start an airplane in flight with that as its pitch and `pitchTrim` (the Earth
view's airborne launch does) and it holds level flight hands-off.

### Wind and turbulence

Aircraft feel the weather's wind field, not only its mean `windVelocity`: a shear profile with
height above ground, turbulence carried downwind, gusts along the wind, and slope flow that lifts
air up windward hillsides and sinks it, rougher, in the lee (see
[Weather](weather.md#wind-shear-turbulence-and-gusts)). The airplane samples it at its center of
mass and both wingtips, so uneven gusts across the span roll it; the helicopter samples across
its rotor disc. The field is a function of the weather, the position and simulation time, so
replays and keyframes reproduce every bump. `installAircraft` hands the solver the world clock;
callers of `stepAircraft` pass `time` in the environment. An explicit uniform `wind` override
turns the structure off.

## In an Earth view

`mountEarthView` flies the same aircraft without a practice airfield: `view.setMode('fly')` puts the
viewer in a P-51D already airborne over the current view, and `{ aircraft:
'molen.entities.aircraft.oh6' }` picks the helicopter. `view.vehicleStatus()` reports airspeed,
altitude, vertical speed, attitude, power and engine/gear/flap state for a HUD, and
`view.recover()` restarts the flight above an impact. See [Earth view](earth-view.md#modes).
Hosts composing their own view use `EarthAircraft` from `@bendyline/molen-earth/client`: it
spawns any aircraft type into the vehicles' ECS world, on the ground or with
`airborne: { speed, power }`, boards and releases the pilot, applies `EarthPilotControls` and
draws the models. To start from a real runway, ask `view.airfields` for one and spawn at its
`threshold` placement; see [Airfields](earth-view.md#airfields).

## Engine sound

The P-51D carries an `audioSource` that plays `aircraft.engine.piston`, a Rolls-Royce Merlin
recording. The OH-6 plays `aircraft.engine.helicopter`. Both take pitch and gain from
`aircraftState.rpm`: they are silent until `I` starts the engine, and spool up and down with it.
The OH-6 also leans a little on `aircraftInput.power`, since its governed rotor holds rpm while the
collective changes load. Any host that plays audio from the entity world hears them with no extra
code; see [Sound and music](audio.md).

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
sets yaw inertia in kg m² (default `mass * (span² + length²) / 12`). The thrust moment joins the
airframe's other yaw moments in `aircraftState.yawRate`, against weathercock stability and yaw
damping in the air and tire grip on the ground.

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
The world explorer supplies common and individual engine controls; failure scenarios are authored through
this API, without automatic random failures.

`aircraftState.engines[id]` stores `rpm`, `rotorAngle`, `failed` and current `thrust` in newtons.
The solver initializes missing engine state from the legacy RPM/phase, then the per-engine state
is authoritative. The aggregate `rpm` is the maximum across engines, and aggregate `rotorAngle`
follows the first engine. Set `visual.rotors[].engine` to animate independent propellers; omitted
bindings retain the common phase. Body rates, trim, all engine state and input overrides survive
keyframes/replay and pause at terrain gaps. Boarding and exit checks consider every engine.

This extension models thrust imbalance and, for vectored engines, pitch and roll moments from
the thrust line. Feathering, windmilling drag and a calibrated minimum-control-speed envelope
are not included; propeller torque, P-factor and precession come from `propellerEffects` above. Helicopters continue to use
one `engine` driving the shared rotor; multiple turbines feeding a common gearbox require a
different shaft-power model and are not represented by independent propeller engines.

Helicopter forces include rotor spool, collective lift, cyclic tilt, ground effect,
translational lift, air drag and assisted yaw; the helicopter keeps the assisted model, in which
cyclic commands a disc tilt bounded by `maxTilt`, and gusts across the disc tip it. State includes velocity, attitude/rates, rotor phase
and controls for checkpoint/replay. Translational lift uses air-relative horizontal speed, so
wind and forward motion give consistent results. Collision sampling is at least 120 Hz and at most one meter
of translation per substep. Unknown terrain pauses at the last known position and resumes when
support is available.

Hosts can supply `groundHeight`, `wind` and `contacts(probes, entity)` (or the legacy
`canOccupy(transform, spec, entity)`). The world view
checks nearby resident geometry, the airfield, cars and other aircraft. Cars and exits also check
conservative aircraft bounds. Imported collision hulls are
available for hosts that need a different collision solver. Without either obstacle callback, the kernel only
collides with terrain. Do not add a second physics body that also writes the aircraft transform.

This is a game flight model with recognizable polygonal aircraft, not a full aircraft systems
simulation or a calibrated replica of any airplane's handling. Rotor blade-element aerodynamics,
autorotation, a quantitatively validated spin model, fuel, automatic engine damage, detailed
avionics and weapons are outside this implementation. Primary cockpit controls operate the simulated
systems as described below; switches for unsupported systems remain decorative. Collision uses coarse airframe probes and resident world
geometry; it does not model deformation or distant unloaded obstacles.

## Clickable cockpits

Earth views and the world explorer enable pointer controls while occupying the cockpit. Drag a
yoke or cyclic sideways to bank and down to pull up; release it to center. Pedals drag sideways
and also center on release. Drag a throttle or collective upward to increase its retained setting.
Modeled gear selectors toggle on click; flap and thrust-vector levers accept intermediate positions.
Solid panel geometry blocks clicks behind it. Dragging empty space still looks around.

All 53 bundled cockpits have physical controls for their supported systems, including engine
master switches, individual engine switches and throttles for airplanes with named engine banks,
parking brakes, and applicable gear, flap and nozzle controls. Supplemental labeled modules fill
gaps in the original models; their layout approximates the aircraft rather than reproducing every
real switch. The Cessna 172's existing master rocker and flap selector are directly operable.
Moving common power (including =/− or the modeled **PWR ALL** handle)
synchronizes all throttle levers while preserving individual engine cutoffs, mixtures and propeller settings. A throttle indicates
commanded power; shaft RPM follows the simulation's spool response. Retractable airplane gear is
locked on the ground. Helicopters retain the existing shared engine/gearbox model and collective.
Manual-mixture aircraft have operable mixture controls, and aircraft with manual propeller governors
have operable propeller RPM controls. Fuel selectors, avionics and other unmodeled systems remain decorative.

### Mixture and propeller governors

`AircraftInputData.mixture` and `.propeller` are retained 0–1 selections, both defaulting to 1.
The same fields in `engines[id]` override the common selections independently. A common adjustment
synchronizes only its own control, preserving throttle, cutoff and the other engine settings.
Drag the modeled mixture or propeller lever upward to increase its setting.

An engine with `mixtureControl: true` uses a reduced fuel/air model: 0 cuts fuel immediately;
1 is full rich. At reduced intake-air density a lower setting can recover power, while excessive
leaning or enrichment reduces combustion, thrust and available shaft power. The existing
`ratedDensityRatio` approximates boosted intake air before leaning becomes necessary. Mixture
cutoff spools the engine down without latching a failure; restoring mixture can restart it when
the engine master is on. This assisted restart does not model a starter or ignition sequence.

`propellerControl: { minRpm: 0.6 }` enables a constant-speed governor: the lever selects between
60% and 100% of rated RPM. It does not directly set blade angle. At sufficient power the governor
holds selected RPM; at low power the fine-pitch stop permits RPM to fall. Reduced selected RPM
limits shaft power in the torque-limited approximation and lowers the static thrust cap. RPM,
propeller rotation, torque and thrust all follow these inputs. This follows the distinction between
throttle, mixture and governed RPM in the [FAA engine-controls overview](https://www.faasafety.gov/gslac/ALC/libview_printerfriendly.aspx?id=6849).

These are estimated simulation curves, not aircraft performance tables or operating procedures.
There is no fuel consumption, EGT/CHT, detonation, feathering, reverse thrust or blade-element model.
Fixed-pitch Cessna 172S and Cherokee aircraft expose mixture without a propeller lever; the DA42
and PC-12 NGX retain automatic scheduling. Turboprops have no piston mixture. Combined condition
levers used for propeller RPM currently cover the governed range; engine cutoff remains a separate
switch. The R44's mixture affects the shared piston/rotor power model without adding a propeller control.

Per-engine `aircraftState.engines[id].combustion` reports effectiveness (0–1), and `shaftPower`
reports delivered watts. Model signals expose these as `engines.<id>.combustion` and `.shaftPowerW`;
`.mixture` and `.propeller` are commanded lever positions. The live cockpit review shows these
settings alongside RPM and shaft power so cutoff and independent engine effects are visible.

Hosts pass the camera to `visual.updateView(camera)` each frame (in the coordinates of
`visual.object.position`). The cabin, the interior's `nodes`, is drawn only within three times
the aircraft's length or span of it (at least 60 m): cockpits held most of an aircraft's draw calls
and as many again in the shadow pass, yet from farther away they are a few pixels behind the canopy.
Boarded and chase views are always near enough. Earth views and the world explorer also prepare an
aircraft's shaders before its model joins the scene.

`createAircraftVisual` exposes `cockpit`, a mesh picker and control inventory derived from the
interior's authored primary-input bindings and glTF node `extras.aircraftControl` metadata.
An `AircraftControlNode` declares a supported `action`, optional engine ID, and optional
rest-relative `motion` (`property`, `axis`, `scale`, optional `offset`). Switches and selectors animate their commands;
gear, flaps and engine RPM still follow the simulation's transit/spool response.
Separate throttle levers are associated with engine
positions from pilot-left to pilot-right; duplicated collective/thrust levers remain linked.
`bindAircraftCockpitPointer` from `@bendyline/molen-client/aircraft` binds a canvas, camera and
active pilot session. The HTML companion panel is opt-in with `companionPanel: true`, for
accessibility or older models with incomplete geometry. Call its `update()` each frame
and `dispose()` on teardown. Hosts apply changes with `applyAircraftControl`, submit the result
through `flyAircraft`, and mix `AircraftPointerAxes` with their keyboard/gamepad inputs. Session
release must clear transient axes. The binder cancels drags on exit, view change, blur and pointer
cancellation; it does not write simulation components directly.

In the engine repository, build the client and kernel, then run a local live review of all 53 bundled aircraft:

```sh
pnpm --filter @bendyline/molen-examples-world-explorer exec vite --config ../../packages/entities/scripts/cockpit-controls-vite.mjs
```

Open `http://127.0.0.1:4322/packages/entities/scripts/cockpit-controls.html`. The review runs the
real aircraft solver, displays commanded power beside actual RPM, and offers parked, airborne
and exterior views.

## Reproducible review

The source brief, generator, provenance and verification notes are in the engine repository, in
the copyable [P-51 source bundle](https://github.com/bendyline/molen/blob/main/content/entities/source/aircraft/p-51/README.md) and
[OH-6 source bundle](https://github.com/bendyline/molen/blob/main/content/entities/source/aircraft/oh-6/README.md).
`content/entities/scenes/aircraft.scene.json` there is the neutral apron scene. The browser flight
scenario is `examples/world-explorer/test/visual/aircraft.play.json`.

`packages/kernel/test/aircraft-performance.test.ts` exercises level acceleration, part-throttle
power, configuration drag, stall recovery from either bank direction, coordinated turns,
unpowered energy loss, wind equivalence and 30/60/120 Hz consistency.
`packages/kernel/test/aircraft-dynamics.test.ts` covers full rolls, loops and the load-factor
limit, flight-path hold, trimmed launches, propeller swing and crosswind on the takeoff roll,
and turbulence that matches across host rates and keyframes. Current fleet calibration targets
and their evidence are recorded in the performance ledger above. The test pilot's altitude
hold is a harness feature, not a player control or a certified performance chart.

`packages/kernel/test/aircraft-engines.test.ts` covers symmetric two/four-engine layouts,
mirrored engine failures, counter-rudder, thrust moment arms, independent switches/spool,
explicit repair, terrain rollback, exit safety, keyframe restoration and 30/60/120 Hz consistency.

Exterior mechanisms use the snapshot-owned [graduated actuator system](vehicle-interiors.md#graduated-mechanisms).
Canopies, hooks and speed brakes accept fractional targets through `aircraftInput.actuators`;
`aircraftState.actuators` holds actual travel. Ordinary mechanisms reverse immediately from
their current position. Speed-brake drag follows deployment. Retractable helicopter gear
uses `helicopter.fixedGear: false` and `gearTransitTime`; skids remain fixed by default.
The supplied aircraft expose only fitted equipment. Helicopter blade release is a gameplay
escape effect, triggered by the latched `eject` actuator, and removes rotor lift after release.
