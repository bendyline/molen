# Aircraft in the world explorer

The world explorer includes 54 aircraft: the P-51D Mustang, OH-6 interpretation, Bendy Small Airliner
and fifty-one additional real-type interpretations. Each has an editable GLB, reusable entity type,
flight physics, an instrumented cockpit and a chase camera. The additions include ten helicopters,
ten general aviation aircraft, ten fighters, five cargo transports, the MV-22B Osprey, AV-8B Harrier,
thirteen utility, regional, historic and business aircraft, and the OV-10A Bronco twin-boom
observation aircraft. All use clean configurations without external weapons.

Compare national markings and camouflage in the [livery gallery](livery-gallery.md), then
find every aircraft’s choices and reference evidence in the [livery catalog](livery-catalog.md#aircraft).

Use the **P-51 Mustang**, **OH-6** or **Bendy Small Airliner** buttons to visit the practice airfield, then press **R** to
board. The aircraft buttons also work from the example hub's world view. A direct link can use
`?aircraft=p51d`, `?aircraft=oh6` or `?aircraft=airliner`. The **Aircraft catalog** selector visits
the additional models; direct links also accept suffixes such as `?aircraft=uh_1h`,
`?aircraft=f_16b`, `?aircraft=c_17a`, `?aircraft=mv_22b` and `?aircraft=ov_10`.
The three original practice models load initially. Additional GLBs load on selection, with one
additional request in flight and intermediate selections coalesced. Replacing a selection releases
its model and ECS entity; an occupied aircraft is retained. The host's content-pack byte cache
still follows its own cache budget. The catalog does not download all fifty-one new models on entry.
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
| R | Board, or exit after landing, stopping and engine shutdown |
| Ctrl+R | World Explorer: eject in flight, or from a wreck still moving (R alone never fires the seat) |
| I | Start/stop engine; allow the propeller or rotor to spool |
| Z / C | Decrease/increase throttle or helicopter collective (− / =, numpad − / + and Page Down / Up do too). On a fighter, holding C stops at military power (MIL); press again to push on into the afterburner |
| W / S | Nose down / nose up |
| A / D | Bank left / right; helicopter cyclic |
| Q / E | Left / right rudder or anti-torque pedals; steering on the wheels |
| Space | Wheel brakes |
| G | Retract/extend airplane gear while airborne |
| F | Toggle airplane flaps |
| J | Cycle powered-lift lever: forward, 22.5°, 45°, 67.5°, vertical; Osprey/Harrier only |
| M | Assisted or direct controls. Helicopter: a cyclic that levels itself and feet that hold the heading, or the swashplate and tail rotor themselves. Airplane: the assist that holds the flight path, or the stick and pedals straight on the elevator, ailerons and rudder (not on fly-by-wire types) |
| V | Cockpit / chase; World Explorer: cockpit, chase, flyby in turn (F5 toggles flyby directly) |
| Mouse | Look around the cockpit |
| Backspace | Recover at the airfield after an impact |

Mustang: start the engine, set flaps, hold the brake while raising throttle, then release the brake.
Held at full power on the brakes, the tail comes a few degrees off the ground.
The propeller swings the nose left through the roll, and a crosswind turns the airplane into the
wind and carries it sideways on its tires: hold a little right rudder (E), or rudder away from
the wind, to keep the runway centerline.
Rotate around 85–100 knots and release the pitch key once the nose is about 10 degrees up; the
airplane keeps the attitude it lifted off at. At climb power the propeller's torque rolls it
slowly left, so tap right bank (D) as needed. Retract gear and flaps after climbing. Reduce
throttle on approach, lower gear and flaps, and land with wings level and a gentle descent.
Arrive firmly and the gear gives part of it back: the airplane skips into the air again, more
so the Mustang, whose main wheels sit ahead of its center of mass and pitch the nose up as they
touch. Ease the stick forward and let it settle. The wheel brakes do little until the wing has
stopped flying, and braking hard lifts the Mustang's tail.
Gear-up and hard landings register an impact. To accelerate, ease the nose down toward level
flight after cleaning up; holding the takeoff attitude spends engine power on climbing. During a
stall, lower the nose, add power and gently level the wings. Let airspeed rebuild before pulling
out; hauling back immediately can stall the wing again, and rudder in a stall drops a wing. A
stall recovery requires altitude. The stall announces itself: a few degrees before it the
airflow starts to break away and the cockpit view shakes, harder the closer you get.

There are no attitude limits: hold A or D to roll through inverted, hold S at speed to loop.
Releasing the stick holds the flight path the airplane is on; a brief tap of W or S changes it
by a degree or so. Above about 250 knots full back stick stops at 6 g. Hold a hard pull and
the pilot feels it: after a few seconds above 4.5 g (6.5 g in the fighters, whose pilots wear
g-suits) the edges of the view dim, then the middle; ease off and it clears in a few seconds.
Sustained negative g reddens the view. In a bank the wing's lift
no longer holds the airplane up, so add back pressure to keep a turn level. Gusts and turbulence
from the Weather setting bump, roll and yaw the airplane, more so near the ground on windy days.

Press M in an airplane to fly it on its own control surfaces, without the assist (the status
line shows "Direct controls"). The stick is then the elevator and ailerons and the pedals the
rudder. The airplane holds a speed, not a flight path: let go and the nose seeks the speed it
is trimmed for, rising and falling around it for a minute or so before it settles. Hold the
stick and the trim slowly follows, so you can let go at a new speed. Rolling into a turn swings
the nose the other way until you lead with rudder (Q or E toward the turn), a sideslip rocks
the wings as it dies out, and a bank left alone slowly tightens or rights itself depending on
the type. With an engine out on a twin, the live engine turns and rolls the airplane toward
the dead one until you hold it with the opposite pedal. Fly-by-wire types (the F-16, F/A-18,
F-22, F-35, Typhoon, Rafale, Gripen, the Airbuses, E175, C-17, A400M and G650) have no such
mode: their pilots never fly the bare airframe. On the wheels direct control is the bare
airplane too: nobody's feet damp a swing, nothing holds the tail down under the brakes, and the
elevator does only what the stick says.

OH-6: start the engine and allow roughly six simulation seconds to reach full rotor speed. Raise
collective gradually toward 50%; exact hover power varies with altitude and ground effect. It
hovers as the real one does, nose a few degrees up and left skid low, leaning against its tail
rotor. Small cyclic inputs tilt rotor thrust to travel. Pull more collective than the
transmission can pass and the rotor slows a few percent; the assist eases the lever to keep it
turning. Lower collective gently to land. Switch off the engine
and wait for the rotor to stop before exiting. If the engine stops in flight (press I to try
it), lower the collective at once: the air rising through the rotor keeps it turning, and the
helicopter comes down steadily at about 2,000 feet a minute instead of falling. Keep some
forward speed, and just above the ground raise the collective to spend the rotor's speed on a
soft touchdown. Hold the collective up instead and the rotor slows, the HUD warns of low rotor
RPM, and the lift goes with it. An aircraft cannot be exited or switched to free
flight while airborne. After an impact, Backspace resets its aircraft state and places it on the airfield.

The helicopter's controls start assisted: W/S and A/D ask for a tilt of up to about 30°, the
helicopter levels itself when you let go, and the pedals ask for a turn while the tail rotor is
worked for you against the main rotor's torque. Under way you turn with the stick: bank, and the
nose follows the turn. The pedals swing the nose, and the heading they give is kept: the assist
banks gently to bring the flight path round to it, as a pilot would. Press M for direct controls: the stick is then
the swashplate and the pedals the tail rotor's pitch, and the helicopter is the real, unstable
thing. The controls stay where the assist had them when you take over, so nothing lurches, but
nothing levels it either: a hover has to be flown, every change of collective swings the nose
until a pedal answers it (more collective, left pedal), and the nose rises by itself as the
helicopter gathers speed. Every type has a speed it should not pass (167 knots in the AW139).
Push on to it assisted and the airframe starts to shake, the HUD warns, and the nose comes up by
itself to hold it. Fly past it directly, or pull hard near it, and the blades on the retreating
side stall: the nose pitches up, the helicopter rolls toward them (left, in most), and the rotor
slows. Lower the collective and ease the stick back. A stick or pedal that is held slowly becomes
where that control
rests, which is how to trim on a keyboard. Keys are all-or-nothing and the swashplate is quick:
full aft stick pitches the OH-6 at about 180° a second, so fly it in taps, or with a pointer or
touch stick. There are no attitude limits. Keep the rotor loaded: control comes mostly from the
rotor's thrust, so with the collective down, or pushing over into weightlessness, the stick does
far less, and an inverted rotor drives the helicopter toward the ground. Press M again in any
attitude to hand back to the assist, which rolls the helicopter upright and levels it. The
tandem-rotor Chinook has no rotor model of its own yet and keeps the earlier direct cyclic (a
rate command that holds its attitude).

Bendy Small Airliner: the generic 39-meter twin uses the same airplane controls, with slower
responses and a lower load-factor limit than the Mustang. Its two independently named engines
use the jet thrust model, calibrated to a representative Mach 0.78 cruise. It is a fictional
aircraft. The flight deck has an animated yoke; its display
markings are decorative, while live flight readings come from the HUD. Board at the forward
entry point. Its larger footprint needs substantially more runway and clearance.

Osprey and Harrier: use J to select vertical thrust (the parked Osprey starts there), allow the nacelles/nozzles to
reach 90°, start the engine and increase power smoothly. W/S, A/D and Q/E provide powered pitch,
roll and yaw control in a hover. Transition toward forward thrust gradually while gaining airspeed;
the nacelles take 12 seconds for full travel and Harrier nozzles take 3. These are simplified
powered-lift dynamics, with finite travel, vertical thrust, engine-dependent hover authority and
airspeed blending. They do not simulate a real conversion corridor, transmission cross-shaft,
vortex-ring state, hot-gas ingestion or a certified nozzle schedule. Fixed landing gear remains
down regardless of G. Cargo aircraft have larger clearance and runway requirements.

Cockpit needles show airspeed, altitude, heading, vertical speed and RPM; the artificial horizon
banks with the aircraft. The HUD supplies precise knot/feet/feet-per-minute readings, AGL height,
g load, power, fuel remaining, engine/gear/flap state, stall, buffet, low-rotor-RPM, low-fuel
and greyout alerts and terrain waiting status. It distinguishes
KTAS from equivalent airspeed (KEAS), shows local Mach, and flags
airframe/surface overspeed and developed departures. A fighter's throttle reads 0–100% up to
military power, `MIL` at the detent and `AB n%` past it, marked `lighting` until the afterburner
has caught up, and the fuel readout adds the burn in kg/h. KEAS is not calibrated indicated airspeed.
Propellers, both helicopter
rotors, controls, gear, flaps, ailerons, elevators and rudder animate from simulation state. A
rotor turning too fast for a display to sample fades from blades into a translucent disc, so a
propeller at full power cannot alias into looking stopped; the hub stays solid, and the disc's size
comes from the model (see the blur details below). The Mustang's gear takes 12 seconds: its inner
wheel doors open, each main leg swings inboard into a well in the wing root, the tail wheel folds
forward into the fuselage, and the doors close behind them. Its flaps take 13 seconds to run down
to 50°.

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
seconds; the missing section stays missing. **Backspace** repairs the aircraft and clears debris.
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

All 54 aircraft are registered in the `molen.entities` content pack, with their type documents and models.
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
`VehicleCameraOptions` that `@bendyline/molen-client/vehicles` exports. The chase view aims at
the center of mass, the point the airframe turns about in flight, so a roll or a loop turns the
aircraft about the middle of the frame. The gear and flaps follow
`aircraftState.gearPosition` and `flapPosition` as they travel, and the gear legs ride on their
struts ([landing gear](#landing-gear)). `spec.visual.animation` adds
exterior moving parts as [model-signal bindings](vehicle-interiors.md#exterior-animation), with
keyframed curves so one gear position can sequence doors and legs.

Exposed airplane propellers fade from individual blades into a translucent, soft-edged disk
between 20 and 60 rad/s (about 190–570 RPM). The disk follows actual shaft speed, including
independent engines and spool-down, so blades cannot appear frozen at normal operating RPM.
Its size and radial colors come from the blade geometry and materials; separate central hubs stay solid.
This render-only effect needs no model changes and works with WebGL and WebGPU. Fading blades use
transparent copies of their materials, listed in `userData.materialVariants`: a preparing renderer
builds them on request, and the blades stay solid until they are built rather than stalling the
frame the engine starts. Every other rotor (helicopter main and tail rotors, and fans a jet model
binds as rotors) blurs between 35 and 78 rad/s instead: its blades fade into a faint disc with a
slightly darker tip ring, sized from the model, and its hub stays solid.

Neither casts a sun shadow while it turns fast. A fading propeller's blades leave the shadow
pass, and so does a rotor above 20 rad/s, hub and all: its blades, grips and pitch links turned
up to half their spacing between frames, and their hard shadows flashed about the cabin (an
OH-6's four blades at 50 rad/s, 48 degrees a frame). A slow rotor's shadow turns with it.

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
The airframe turns about its center of mass, in flight and standing on its
[landing gear](#landing-gear).

Stall depends on wing incidence, including camber, rather than a fixed true-airspeed cutoff.
Separated flow progressively loses lift and control authority, adds drag, breaks the nose toward
attached flow, and loses roll damping so yaw drops a wing. Lift remains perpendicular to airflow.
Elevator and rudder retain limited propwash authority at low speed. Throttle controls shaft
power for propellers and dry/reheat thrust for jets, with a transient RPM spool limit.

### Propulsion, altitude and performance

All 54 shipped aircraft have separate performance profiles. `engine.propulsion: 'propeller'`
uses shaft power, propeller efficiency and an altitude lapse, with `ratedDensityRatio` representing
supercharging or flat rating. With `engine.propellerDiameter`, thrust follows momentum theory:
the propeller turns power into thrust by speeding up the air through its disc, so the same power
pulls less in the climb than in cruise and gives a finite thrust at rest (without a diameter,
thrust is `propellerEfficiency × power / speed`). `lowSpeedThrust` adds what real blades lose
when slow, most of all a fixed-pitch propeller, which also holds the engine below its rated
speed; `windmillDrag` makes an idling propeller a brake, which is why a power-off glide is
steeper than the airframe alone would manage. An unsupercharged piston engine loses power a
little faster than the air thins (`densityExponent` 1.17), and only gives its best with the
mixture leaned as the airplane climbs: left full rich, it loses more than a quarter of its
power by 18,000 ft. `'jet'` uses `dryThrust` in newtons and a density lapse. A turbofan with a
`bypassRatio` loses thrust as the airplane speeds up, faster for a larger fan, so an airliner
has about three fifths of its static thrust at cruise Mach number before the thin air takes its
share; engines without one use the Mach-dependent ram term `ramRise`, as the fighters do.
`afterburnerThrust` is total augmented thrust per engine. Reheat is not a separate control, as in
the real aircraft: it is the same throttle lever pushed on past its military-power detent, so the
last 15% of the lever commands reheat by default (`afterburnerDetent: 0.85`). It takes 0.6 seconds
to light fully after the engine reaches operating RPM. Engine failure or cutoff extinguishes it.
Ordinary turbofans and the Harrier have no afterburner. Omitting `propulsion` retains legacy
constant-power behavior.

Held keys and buttons work the lever through `AircraftThrottleRamp` from
`@bendyline/molen-client/aircraft`: held forward from below, the lever stops at the detent, and a
second push carries it into reheat; pulling back passes the detent freely. An absolute throttle
(a joystick axis or an on-screen lever) moves straight through. `aircraftReheatDetent(spec)` and
`aircraftThrottleReading(spec, power)` give a host the detent and the lever as a pilot reads it.

#### Afterburner flame and variable nozzles

`spec.visual.exhausts` places each jet nozzle's exit (`engine`, `position`, open `radius`, and for
a variable nozzle `closedRadius`; `direction` and a rectangular nozzle's `aspect` are optional).
The aircraft visual draws a flame there with the afterburner lit: a pale blue-violet cone at
minimum reheat, an orange-yellow one at full, with shock diamonds spaced by the Prandtl–Pack
estimate `1.306 · D · √(Mj² − 1)` from the jet's expanded Mach number. The flame lengthens and
widens in thin air, and the hot tailpipe glows dull orange from behind at high dry power. The
flame adds light to what is behind it and hides a little of it, so it reads orange against a
bright sky and glows at night; it is one unlit mesh with a standard material on both renderers,
casts no shadow, and is never hit by a ray. The ten afterburning fighters declare their exits.

Afterburning engines also publish an `engines.<id>.nozzle` signal for exterior bindings: 0 with
the nozzle closed to its minimum area, 1 open to its maximum. It follows a generic schedule:
about 80% open at idle and with the engine stopped (to cut idle thrust), closing as the engine
winds up to military power, and opening with the reheat lit, through a 0.35 s actuator lag. The
F-15C, F-16B and F/A-18C nozzles are rings of hinged petals bound to it.

The atmosphere has standard temperature lapse layers, including the tropopause; sound speed
therefore changes with altitude. Wind-relative TAS drives forces; `equivalentAirspeed` is
`TAS * sqrt(density / 1.225)` and `mach` uses local sound speed. `criticalMach` and `waveDrag`
add a continuous transonic drag rise. Ground effect reduces induced drag near the surface.
`maxMach`, `maxEquivalentAirspeed`, `gearLimitSpeed` and `flapLimitSpeed` set overspeed alerts;
they do not impose a velocity cap or silently break the airframe. Surface limits are EAS
approximations, not exact POH calibrated-airspeed limits. Flap input can be a boolean or a
fraction from 0 to 1, allowing intermediate settings through commands.

Each wing has its own lift curve. `liftSlope` follows from the wing's aspect ratio, so a long
wing gains lift faster with angle of attack than a short one, and `stallAngle` and `flapLift`
are set so the airplane stalls at its published speeds, clean and in the landing configuration,
at the weight the handbook states. A fighter's short wing therefore stalls near 26–32°, a
light airplane's near 17–21°.

### Control surfaces and handling

An airplane with `airplane.surfaces` turns, once it is off the wheels, by the forces on its
surfaces instead of by response constants. The wing is four panels, two a side, each meeting
the air at its own speed and angle: rolling, the down-going panels gain lift and the up-going
ones lose it (roll damping), and their lift leans forward and back (adverse yaw); in a slip,
`dihedral` raises the angle of the wing the slip comes from; near the stall, the panel that
stalls first drops. The wing's lift acts `liftArm` ahead of the center of mass and the
tailplane (`tailArea` at `tailArm`, in the wing's `downwash`) balances it, which is what makes
the airplane seek a speed; the downwash reaches the tail a moment after it leaves the wing,
which damps pitching. The fin (`finArea` at `finArm`, `finHeight` above the center of mass)
weathervanes the nose and damps yaw, against the fuselage's pull the other way (`bodyYaw`).
`sideForce` is the whole airframe's side force in a slip. A propeller ahead of the tail keeps
the elevator and rudder working at low speed (`slipstream`). In straight flight the four panels
add up to the same lift and drag as before, so performance does not change; tail and fin act as
moments only.

`aircraftInput.controlMode` picks who works the surfaces. `assisted` (the default) flies as
airplanes here always have: the elevator is worked so the nose follows the path-holding
response, a turn coordinator holds the rudder against sideslip and a yaw damper steadies it.
Where the tail cannot give what the assist asks, the airplane does what its tail can. `direct`
puts the stick, pedals and trim straight on the surfaces: `pitch` moves the elevator about
`aircraftState.elevatorTrim`, which `pitchTrim` (-1..1) moves at a quarter of its travel per
second; with no `pitchTrim` the trim follows a held stick at that rate. A type marked
`surfaces.flyByWire` ignores `direct`. `aircraftState.surfaces` reports the elevator, aileron
and rudder positions either way, for models and instruments. The surfaces work on the wheels
as they do in the air. The F-14 and the powered-lift types keep the response constants
throughout.

Calibration sizes the surfaces from the wing and fuselage by class: tail and fin volumes, a
static margin, effective dihedral, roll inertia and the fuselage's share of yaw and side force.
It sets the tailplane to trim the type's cruise with the elevator neutral and the ailerons to
the roll rate the roll stage fixed. The class figures come from published mass properties and
mode data (NASA CR-2144 for the C-5A, B-747 and F-4C, Nelson's Navion), not from each type.
The handling cards of [the trial scorecard](https://github.com/bendyline/molen/blob/main/content/entities/source/AIRCRAFT-TRIALS.md)
fly the result in direct control: phugoid, short period, Dutch roll, roll time constant and
spiral, held to MIL-F-8785C's Level 1 cruise limits for every type with surfaces that is not
fly-by-wire, and to published figures where a type has them (a Cessna 182 analysis in NASA
CR-1975 and the C-5A's measured modes).

The F-14 profile has an empirical high-alpha departure model: directional stability fades,
rudder/elevator authority is blanked, aileron response can reverse, and yaw autorotation can
sustain a flat spin. A symmetric stall does not receive an arbitrary spin direction. The
torque-free angular integrator preserves rotational energy through rapid rotations. NASA's
[F-14 model research](https://www.nasa.gov/pdf/601262main_ModelingFlight-ebook.pdf), especially
printed pages 126–127, supports these mechanisms; it does not supply a validated F-14D
coefficient set. This model does not reproduce the F-14A's TF30 compressor stalls, the later
digital flight-control system, or automatic variable wing sweep aerodynamics.

### Helicopters

A helicopter with a `helicopter.rotor` block flies on its rotors: ten of the eleven shipped
types do (all but the tandem CH-47F, which keeps the [earlier model](#helicopters-without-a-rotor-block)).
It is a rigid body with these forces on it, each acting where it acts:

- **The main rotor.** Thrust comes from the blades' pitch (the collective lever sweeps
  `collective`, the pitch at three quarters of the radius), their number, `chord` and
  `tipSpeed`, and the air coming through the disc. That air is a state of its own: the rotor's
  induced flow follows its thrust with a lag, by momentum theory, with a measured curve where
  momentum theory has no answer (a descent into its own wake). `inducedFactor` is the induced
  power over the ideal. The blades stall at a mean lift coefficient `maxLift`, sooner in fast
  flight, which is what sets the ceiling; power is induced, profile (`profileDrag`) and the
  work of climbing.
- **Retreating-blade stall.** The blades on the side that goes away from the wind meet less of
  it the faster the helicopter flies, and carry less: a line from the hover's `maxLift` to 1.2
  times the weight at 1.11 times the type's limit speed (`retreatingBladeSpeed`). The line is
  straight because a rotor's measured limit is (CL/σ 0.156 in a hover, 0.104 at an advance ratio
  of 0.4: McHugh, NASA CR 145217), and 1.11 is as fast as a type is shown safe. Weight, height, a
  hard turn or a slowed rotor bring it on sooner. Asked for more than it carries, the disc tilts
  back (about 1° at the limit, 3 to 4° a third past it) and a third as much toward the retreating
  side, the thrust stops growing, the blades drag, and `aircraftState.buffet` shakes the view.
- **Flapping.** The disc does not stay square to the shaft. It tilts back from the air it flies
  into and toward its advancing side, and it follows a pitching or rolling shaft late (by
  16 / (`lock` × rotor speed) seconds: the rotor's own damping). The swashplate tilts it by up
  to `cyclic` radians aft and to each side, and 1.4 times that forward, because speed blows the
  disc back (a Black Hawk has 16.5° forward and 12.3° aft; the default is 16° and 11.5°). The
  thrust acts at the hub along the tilted disc, so it turns
  the helicopter by the hub's height above the center of mass; a `hingeOffset` adds a moment
  that does not need thrust (0 for a teetering rotor, which has no control at zero g, about
  0.04 articulated, 0.12 hingeless).
- **Torque.** The engines turn the main rotor against the fuselage, which is twisted the other
  way: to the right for a rotor turning counterclockwise seen from above (`rotation`, the
  default), to the left for a clockwise one. The tail rotor (`tail`: radius, blades, chord, tip
  speed, arm and height) is a small rotor of the same kind pushing sideways on the boom. It
  takes its own share of the power, and its push is why a helicopter hovers leaning: left skid
  low for a counterclockwise rotor. Lose it and the helicopter spins. Eight blades or more are a
  fan in a duct, which carries half of the thrust and lets the wake run straight out, for about
  0.7 of the power.
- **The fuselage.** Drag on `dragArea`, more broadside; the rotor's wash on it in a hover
  (`download`); a fin and a stabilizer (`finArea`, `stabilizerArea`) that keep the nose into the
  wind once it is moving. The body itself turns the other way, further off the air it meets, and
  takes back part of what the stabilizer does (about a third on a Black Hawk), and air that
  meets it from above or below pushes it down or up. Both are a Black Hawk's measured figures,
  scaled by mass.
- **The governor and the rotor's speed.** The rotor holds `rotorInertiaTime` seconds of hover
  power. The governor gives the rotors what they take, up to what the engines and the gearbox
  (`transmission`, and the engine's rated power) can deliver. Ask for more and the rotor slows.
- **The skids**, on the same struts as the airplanes' [landing gear](#landing-gear): the
  helicopter gets light on them as the collective comes up, and can slide, tip and bounce.
  Steel slides where a tire grips (friction 0.4), so a run-on landing skids to a stop:
  about 50 m from 33 knots with the lever down.

`aircraftState.rotor` reports the induced flow, the collective, cyclic and tail rotor pitches,
the trims held in direct control and the torque on the mast as a share of the gearbox limit.

Calibration builds the block from the type's published rotor (blade count, chord, tip speed,
tail rotor, the entries marked `rotor` in the trial ledger) and fits four figures to published
performance: `inducedFactor` to the hover ceiling out of ground effect, the rotor's
`groundEffect` to the ceiling in it, `dragArea` to the cruise speed and `maxLift` to the
service ceiling. The limit speed is the type's published never-exceed speed (`neverExceedKt` in
the ledger) or 1.13 times its cruise, and a tail rotor whose chord is not published is sized to
hold full torque in the thinnest air the engines still make full power in. The OH-6 comes out at an induced factor of 1.02 and 0.54 m² of drag area
(published: 0.46). Rates of climb and autorotation descents are not fitted; they are checks on
[the scorecard](https://github.com/bendyline/molen/blob/main/content/entities/source/AIRCRAFT-TRIALS.md).

#### Assisted and direct controls

`aircraftInput.cyclicMode` and `pedalMode` pick who works the swashplate and the tail rotor.

`assisted` (the default for both) is a pilot's hands and feet on the real controls, not a
different helicopter:

- The stick asks for a tilt of the disc, `cyclicTilt × stick` bounded by `maxTilt`, and the
  swashplate is put where the rotor turns the helicopter toward it, with the stiffness and
  damping of `cyclicResponse` and `cyclicDamping`. Stick centered, the thrust stands upright
  but for the lean that answers the tail rotor, and the helicopter hangs under its rotor
  nose-up by about the shaft's tilt.
- Near the hover with the stick left alone, a little more tilt (up to 0.08 rad) is held
  against any drift over the ground, as a pilot holds a hover by eye: the helicopter stays
  over its spot in a wind and stops from a creep. It fades out between 4 and 10 m/s; under
  way, a helicopter whose stick is let go keeps its speed and has to be slowed.
- The pedals ask for a rate of turn (`yawRate` at full pedal) and the tail rotor is set to
  give it, holding the main rotor's torque whatever the collective does. Under way (from 15 m/s
  of air, fully by 25) the assist keeps the nose on the air it flies through, as a pilot keeps
  the ball in the middle. While the stick banks, the feet follow the turn and take a sideslip
  out in about half a second. Otherwise the feet hold the heading, against the fin too, and the
  hands bank (up to 0.45 rad, taking the sideslip out over about three seconds) to bring the
  flight path round to the nose, so a heading the pedals gave is kept; they leave it while the
  stick is pushed or pulled. A held pedal has its way. In the hover and slow flight the feet hold
  the heading.
- When the rotor falls below 97% under power, the lever is eased down to keep it turning, and
  it is held to what the retreating blades carry. With the engines out the lever is the
  pilot's alone.
- The stick does not push past the type's limit speed. The forward tilt it can ask for runs out
  over the last 20 knots or so and the nose comes up to hold about 1.05 times it, falling with
  height (about 3 knots indicated per 1,000 ft, as the H125's does). Direct controls have no such
  hand.

The assist can only do what the controls can: with the swashplate at its stop, the tail rotor
at full pitch or the rotor unloaded, the helicopter does what it does.

`direct` hands over the controls themselves. The stick is the swashplate and the pedals are
the tail rotor's pitch (`pedalMode` follows `cyclicMode` unless set, so a host can give direct
cyclic with assisted feet). Each rests at a trim, `aircraftState.rotor.trim` and `pedalTrim`,
that starts where the assist had that control and follows a stick or pedal that is held at a
quarter of its travel a second. What the pilot then has to do is what a helicopter pilot does:

- Hold the hover. Nothing levels the helicopter or keeps it over its spot; left alone it
  wanders off and tips.
- Put in a foot with every change of power: more collective, left pedal (for a rotor turning
  counterclockwise), and right pedal with the engine out, when there is no torque to hold.
- Push forward as it gathers speed, against the disc flapping back.
- Watch the rotor's speed: nothing eases the lever.

Full stick is the whole swashplate. In the OH-6 that is a pitch rate building to about 180° a
second, which is the rotor's own rate response (cyclic travel × `lock` × rotor speed / 16), so
a held key is a violent input. Switching back to assisted in any attitude flies the helicopter
level again: from 60° nose-up in about two seconds, from inverted in about three.

#### Helicopters without a rotor block

A helicopter spec with no `rotor` block, the CH-47F among the shipped ones, flies on the
earlier response model. Lift is the collective times `liftMultiplier`, limited by a
momentum-theory power budget (`rotorEfficiency`, `groundEffect`, fitted to the two hover
ceilings) and by `liftLimit` times the weight of `liftMass` at sea-level density (fitted to
the service ceiling). The pedals command a yaw rate with no torque to hold, the fin
weathervanes the nose at `directionalStability × airspeed / length` rad/s per radian of
sideslip, and optional terms take lift away in a powered slow descent (`vortexRing`) and above
`retreatingBladeSpeed`. Its assisted cyclic commands a tilt of `cyclicTilt × stick` bounded by
`maxTilt` that springs back to level; its direct cyclic commands pitch and roll rates
(`cyclicRate` at full stick, with `hubStiffness` of the control power kept at zero g), holds
the attitude when released and behaves as assisted on the skids, which are a contact at the
origin, not struts.

### Autorotation

With its engines out in flight a helicopter's rotor freewheels, and its speed follows an
energy balance: the rotor holds `helicopter.rotorInertiaTime` seconds of hover power at full
speed (default 2), spends it on the thrust the collective asks for and on its own drag, and is
turned by the air it descends through. On the rotor model that last part is not a rule: air
coming up through the disc meets the blades at a steeper angle and drives them, and the
collective goes down so they are not stalled by it. Lever left at the hover, the rotor is gone
in a few seconds, assist or no assist. Lever down, the descent settles at a steady rate: the
OH-6 comes down at about 1,500 ft/min at 60 knots with the rotor in its range (published:
1,800), the R44 at about 1,450 at 55 (published: 1,350). Pulling the collective near the
ground spends rotor speed on a cushion, a second or two of it; a heavy rotor (the UH-1H's
3.5 s) forgives a late or early pull, a light one (the R44's 1.6 s, the OH-6's 1.5 s) does
not. Held too high, the collective drags the rotor down and the lift with it. With no torque
on the mast the tail rotor has nothing to hold: in direct control the hover's pedal position
now turns the helicopter left. On the ground the rotor runs down, and a restart in flight
spools it back up. There is no height-velocity curve in the HUD and no blade-by-blade stall.

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
consistency, not independent real-world validation.

The trial scorecard is that validation. In the engine repository:

```sh
pnpm aircraft:trials
pnpm aircraft:trials --ids=cessna_172s,oh6
```

Each aircraft flies a set of trial cards on the production solver (a stall, a power-off glide,
a level acceleration for climb and top speed, a full-aileron roll, a takeoff, hover ceilings)
and is scored against published figures in the
[trial ledger](https://github.com/bendyline/molen/blob/main/content/entities/source/aircraft-trials.json),
each with its source, the weight it applies to and how far it can be trusted. Calibration may
use the figures marked `fit`, in stages so one error cannot hide in another: stall speeds fix
the lift curve, a glide ratio the drag (or the idling propeller's), the speed anchor the thrust
at altitude, a climb rate the propeller's thrust when slow. The figures marked `check` it may
not use. The
[scorecard](https://github.com/bendyline/molen/blob/main/content/entities/source/AIRCRAFT-TRIALS.md)
lists every card with its error; it is a budget that later changes may not lower, not a claim
that every card passes. The procedures are in `@bendyline/molen-kernel/trials` for use in your
own tests.

All polar, lapse and high-alpha coefficients remain approximations. Stores, a center of gravity that moves as fuel burns, detailed engine
maps, icing, fatigue, load-induced structural failures and certified flight-control laws are not
modeled.

### Fuel and weight

An aircraft with a `spec.fuel` block carries fuel: `capacity` is the usable load in kg, and
`spec.mass` is the aircraft with full tanks. `aircraftState.fuel` starts full and burns with
the power in use, the aircraft flies lighter as it goes (it climbs and turns a little better on
empty tanks), and when the tanks are dry every engine stops: an airplane becomes a glider and a
helicopter autorotates. A propeller or rotor engine burns by the shaft work it delivers
(`engine.fuelConsumption` in kg per joule; default 7.5e-8 with a manual mixture, about 0.27
kg/kWh, and 9.5e-8 otherwise), a jet by its thrust (kg per newton-second; default 2e-5), and
`afterburnerFuelConsumption` (default 5.4e-5, per newton of total thrust at full reheat; the two
defaults are about 0.71 and 1.9 lb/lbf/h) is why the afterburner is for moments: an F-16 that
flies over half an hour at military power empties its tanks in about eight minutes with the
burner lit. `aircraftTotalFuelFlow(spec, state, power)` from `@bendyline/molen-kernel/aircraft`
is the burn the step applies, in kg/s, for a host's readout. Engines never burn less than an idle
flow. All 54 shipped aircraft carry fuel, sized by class as a share of their mass (13–17% for
propeller aircraft, 22% for airliners and transports, 28% for fighters and small jets, 14% for
helicopters): estimates, not flight-manual capacities. Recovering (Backspace) starts a fresh aircraft
with full tanks, and so does boarding one that is parked: the Earth view and the world explorer
call `refuelAircraft(world, id)`, which fills the tanks of an aircraft standing on the ground
with its engines stopped. Without a `fuel` block, fuel is unlimited and the mass constant, as before.

`aircraftFuelFlow(engine, engineState)` from `kernel/aircraft` returns an engine's burn in
kg/s for a fuel-flow gauge or a range estimate.

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

On the wheels an airplane is the same rigid body, standing on its landing gear (below), and
its surfaces keep working. The takeoff is therefore flown, not scheduled: with back stick the
tailplane lifts the nose wheel when it has the air to do it (well short of flying speed in a
jet, sooner with a propeller blowing on the tail), the airplane rotates about its main wheels,
and it flies off when the wing carries it, at 1.1 to 1.5 times the stall speed. The assist
works the elevator as it does in the air and winds more on while the nose stays short of what
the stick asks. It stops at `maxGroundPitch`, or sooner where the airframe's own tail would
meet the runway (a 737's strikes at about 10°), holds the nose below that just after liftoff
until the airplane has climbed clear, and keeps a braking taildragger off its nose. Its feet
damp any swing the pedals did not ask for and keep the nose along the track, and its hands
hold the wings level with the ailerons. That leaves the
pilot the propeller's pull and the crosswind: about 3° of heading by liftoff in a Mustang in
still air, about 9° and forty meters of runway width in a 12-knot crosswind. The pedals turn
the steered wheel far at a taxi and little at speed (`groundSteerSpeed`), for a turn of at
most 0.65 rad/s. In direct control none of this is done for you.

### Landing gear

Every airplane stands on three legs, and a helicopter that flies on its rotors on the four
ends of its skids. Each leg is a strut with a spring and a damper and, at its foot, the tire
the road vehicles use: it pushes up by how far the ground has compressed it, grips sideways by
how it slips, and is braked through its grip. Those forces turn the airframe about its center
of mass by where they act, and what the gear does follows from that:

- **Weight on the wheels.** Brakes (`brakeDeceleration`) and rolling drag act through the
  tires, so they grow as the wing hands the weight back: braking right after touchdown does
  little, and a wet or snowy runway lengthens the stop.
- **Braking tips the airplane forward.** A nosewheel airplane dips onto its nose strut. A
  taildragger lifts its tail, and stood on its brakes would go over; the assist brakes as hard
  as keeps the tail down, so it takes longer to stop.
- **Touchdown.** A firm arrival strokes the struts: the airframe sinks on them and a main wheel
  carries three or four times its standing load for a moment. `gear.damping` sets how much
  comes back. `airplane.tailwheel: true` puts the main wheels ahead of the center of mass, so
  touching down on them with the tail up pitches the nose up, into more lift and back into the
  air, where a nosewheel airplane pitches down onto its nose gear and stays. The Mustang,
  Beaver, Porter, Beech 18 and DC-3 are taildraggers. Landed banked, an airplane comes level
  on both wheels. A sink rate beyond `hardLandingSpeed` is still damage, not a bounce.
- **Running straight.** With all three wheels down either kind runs straight. A taildragger
  with its tail up is on two wheels ahead of its center of mass: a swing feeds itself into a
  ground loop unless feet on the pedals stop it, and so does a nosewheel airplane held down
  onto its nose wheel alone. The assist's feet catch both.
- **Wind.** A crosswind turns the nose into it as far as the tires allow, lifts the upwind
  wing, and blows the airplane further off its line on snow. Touching down still crabbed into
  the wind, the tires pull the airplane straight at their own height, below its center of
  mass: left alone a Cessna in a 15-knot crosswind goes over onto a wingtip, and aileron into
  the wind (the assist's hands) keeps it on its wheels. A tail in the propeller's wash meets
  its air from ahead whatever the wind is doing.
- **Standing.** Tires hold by friction: a parked airplane stays put, holds against power on
  its brakes until the engine out-pushes them, and rolls away down a slope without them.

Where the spec's `gear` block gives no dimensions they follow from the airframe: a wheelbase
of a third of the length (0.55 with a tailwheel), the main wheels just behind the center of
mass (ahead of it with a tailwheel) so the small wheel carries a tenth of the weight (7%), a
track of a fifth of the span, and struts that bounce at 1.4 Hz with 0.65 of critical damping.
`gear.wheelbase`, `track`, `auxiliaryShare`, `frequency`, `damping`, `travel`, `wheelRadius`
and `grip` override them. No shipped type authors its own yet, so a Mustang stands on a
narrower track than the real one and an airliner on a wider one. `aircraftState.wheels` reports each wheel's spin,
the load on it and its strut's `travel`: how far the ground holds the strut closed from where
it rests, in meters. Standing, that is zero. In flight every leg hangs at its full reach (the
spring's static deflection: 13 cm at 1.4 Hz), a touchdown closes the legs to their stops
(`gear.travel`, 0.6 of the reach unless authored), braking closes the nose leg and opens the
mains, and the nose leg runs out to its reach as the airplane rotates. `aircraftGearLayout(spec)`
from `@bendyline/molen-schema` gives where each leg stands and its reach and travel, resolved
from the `gear` block and the class rules above.

The aircraft visual draws that travel. `createAircraftVisual` looks in the model for its gear
legs (the outermost nodes named as gear or wheels whose geometry stands on the ground the
model stands on) and slides each along the airframe's up axis, so a tire stays on the runway
while the airframe sinks onto its struts, and the legs hang longer in flight. The model's
wheels are rarely where the flight model's legs are, so each leg is moved by what the plane
through the reported travel gives at its own tire. `visual.gear.legs` lists what was found.
A model whose gear is part of its shell (most fixed-gear light aircraft) or that stands on
skids has no legs to move, and is drawn as before.

The taildraggers' models are posed tail-down and their wings are rigged to that pose, so body
pitch 0 is both the three-point attitude and zero incidence. The tailwheel has some soft give
below where it rests so the airplane can be rotated to its liftoff angle, and in the air these
five fly nose-high by their ground angle (13° for the Mustang). A datum for the wing apart
from the model's pose would fix both; it has not been done.

### Buffet and the pilot under g

`aircraftState.buffet` (0–1) rises from 0.07 rad (4°) before the stall angle to 1 at the stall
and stays there in separated flow, scaled down where the air is too slow to shake anything. It
is a cue, not a force: the flight path is unchanged. `aircraftCameraPose` takes
`shake: { amount, time }` and shakes the seated view by it (the Earth view and the world
explorer pass the buffet), and the world explorer's HUD warns. On a helicopter that flies on its
rotors it is the retreating blades: nothing until they carry 0.9 of what they can, and 1 a fifth
past it.

`aircraftState.greyout` and `redout` (0–1) are the pilot's accumulated strain. Above
`airplane.pilotGTolerance` (default 4.5 g, or 6.5 g where `maxLoadFactor` is 7.5 or more: a
g-suit), `greyout` builds at a twentieth of the excess g per second, so 9 g in a fighter dims
the view after about three seconds and takes it away in eight; a g below the tolerance and it
recovers in four. Below -1.5 g, `redout` builds a sixth of the excess per second. The controls
keep working throughout: this is what the pilot sees, for a host to draw (the world explorer
narrows the view to a tunnel, then darkens it, and tints it red), not a loss of consciousness.
`view.vehicleStatus()` reports `buffet`, `greyout`, `redout`, and `fuel` with `fuelCapacity` and
the burn `fuelFlow` (kg/s); an afterburning jet adds `reheatDetent`, the lit `afterburner` and
`throttleCaught` (held keys resting at military power).

### The pilot's body in the seat

`PilotMotion` from `@bendyline/molen-client/aircraft` moves the cockpit camera the way a load
moves someone strapped into the seat. Like the buffet shake it is a cue for the view: it reads the
aircraft's motion and never changes the flight.

- **Heave.** In a pull the eye sinks into the seat and the chin drops; unloaded, the pilot floats
  up against the straps.
- **Surge.** Thrust presses the pilot into the seat back; braking throws them forward onto the
  straps and nods the head.
- **Sway.** A skid, or a turn on the ground, throws them to the outside and tilts the head with
  the body.
- **Lag.** The head is left behind for a moment when a roll, pitch or yaw starts quickly.
- **Horizon lean.** In a bank the head tilts toward the horizon, as pilots do.
- **Bracing.** The body gives way when a load arrives, then the pilot recovers part of the travel
  over about a second, and is left leaning the other way for a moment when the load comes off.

What the pilot feels is the specific force in the seat's own axes: the aircraft's acceleration
less gravity, which is 1 g straight up through the seat when parked or in level flight. The model
takes it from the change in the aircraft's velocity between simulation ticks, so it works for
every airplane and helicopter, on the ground and in the air, with no change to the flight model.
The body is three damped springs driven by how far that load is from 1 g up, and the head three
more. It runs in simulation time: a paused world holds the pilot still.

```ts
import {
  aircraftCameraPose,
  PilotMotion,
  pilotMotionSample,
} from '@bendyline/molen-client/aircraft';

const pilot = new PilotMotion();

// Each frame, with the flown aircraft's transform and aircraftState:
const motion = pilot.update(pilotMotionSample(world.tick * world.dt, transform, state));
const pose = aircraftCameraPose(transform, spec, { view: 'cockpit', motion });
```

Call `update` in every view, so the body is already settled when the cockpit view returns, and
`reset()` when the pilot changes aircraft. A teleport or a respawn is recognized (the aircraft
moved farther than its speed carries it) and starts the pilot settled in the seat; an impact is
felt as a jolt. Chase views ignore `motion`. `pilot.load` is the load last felt, in g, as
`[left, up, forward]`, for a HUD.

The defaults are sized to be felt more than seen. Flown through the flight model: a 6 g pull in
the P-51D lowers the eye 3 cm, presses it a centimeter back and drops the chin 1.5°; full brakes
throw the pilot nearly 3 cm forward, half of which they recover as they brace; a 60° bank tilts
the head 3°. `pilot.tuning` holds every number and is live, so a host can adjust it while flying:

| Tuning | Default | Meaning |
|---|---|---|
| `enabled` | `true` | The switch: off, the eye stays at the authored `pilotEye`. |
| `intensity` | `1` | Scales every displacement and rotation before its limit. |
| `maxLoad` | `12` | Loads beyond this many g on an axis are clipped: an impact jolts, it does not launch. |
| `braceTime` | `1.2` | Seconds the pilot takes to brace against a sustained load. |
| `heave`, `surge`, `sway` | | One body axis each: `travel` (meters per g), `limit` (meters, `[negative, positive]`, approached softly), `frequency` (Hz), `damping` (ratio) and `brace` (share of a sustained load recovered, 0–1). |
| `head.nod` | `0.006` | Chin drop per g above 1, radians. |
| `head.surgeNod` | `0.04` | Chin drop per g of deceleration, radians. Pressed back, the head meets the headrest. |
| `head.swayTilt` | `0.05` | Head roll per g of sideways load, radians. |
| `head.lag` | `0.004` | Radians of lag per rad/s² of airframe angular acceleration. |
| `head.horizonLean` | `0.12` | Radians of tilt per radian of bank at small angles; it peaks at 45° and is gone at knife-edge and inverted. |
| `head.limit` | `0.1` | Largest head rotation about one axis, radians, approached softly. |
| `head.neck` | `0.12` | Height of the eyes above the neck's pivot, meters: a tilted head also moves the eye. |
| `head.frequency`, `head.damping` | `2.4`, `0.6` | The head's spring. |

`new PilotMotion(false)` or `pilot.configure(false)` switches the whole effect off;
`pilot.configure({ heave: { travel: 0.012 } })` changes the fields it names. In an Earth view the
effect is on by default: mount with `pilotMotion: false` (or a partial tuning), and call
`view.setPilotMotion(...)` to change it while flying. World Explorer has a "Pilot feels g"
checkbox; `?pilotMotion=0` starts with it off and `?pilotMotion=3` exaggerates it threefold to
show what moves.

> [!NOTE]
> An Earth view's cockpit camera keeps a level horizon, so the head's roll (the horizon lean and
> the lag of a roll) does not show there; the eye's travel and the nod do. Hosts that apply the
> pose's `rotation`, as World Explorer does, show all of it.

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

Helicopter forces are the main and tail rotors, the fuselage, the fin and stabilizer and the
skids, as [above](#helicopters); gusts reach the rotor as the air it flies in. State includes velocity, attitude/rates, rotor phase,
the rotor's induced flow and control positions for checkpoint/replay. Everything is
air-relative, so wind and forward motion give consistent results. Collision sampling is at least 120 Hz and at most one meter
of translation per substep. Unknown terrain pauses at the last known position and resumes when
support is available.

Hosts can supply `groundHeight`, `wind` and `contacts(probes, entity)` (or the legacy
`canOccupy(transform, spec, entity)`). The world view
checks nearby resident geometry, the airfield, cars and other aircraft. Cars and exits also check
conservative aircraft bounds. Imported collision hulls are
available for hosts that need a different collision solver. Without either obstacle callback, the kernel only
collides with terrain. Do not add a second physics body that also writes the aircraft transform.

This is a game flight model with recognizable polygonal aircraft, not a full aircraft systems
simulation or a calibrated replica of any airplane's handling. Blade-by-blade rotor
aerodynamics (the rotor is solved as a whole disc), a quantitatively validated spin model, fuel tanks and their selection, a moving center of
gravity, automatic engine damage, detailed avionics and weapons are outside this implementation. Primary cockpit controls operate the simulated
systems as described below; switches for unsupported systems remain decorative. Collision uses coarse airframe probes and resident world
geometry; it does not model deformation or distant unloaded obstacles.

## Clickable cockpits

Earth views and the world explorer enable pointer controls while occupying the cockpit. Drag a
yoke or cyclic sideways to bank and down to pull up; release it to center. Pedals drag sideways
and also center on release. Drag a throttle or collective upward to increase its retained setting.
Modeled gear selectors toggle on click; flap and thrust-vector levers accept intermediate positions.
Solid panel geometry blocks clicks behind it. Dragging empty space still looks around.

All 54 bundled cockpits have physical controls for their supported systems, including engine
master switches, individual engine switches and throttles for airplanes with named engine banks,
parking brakes, and applicable gear, flap and nozzle controls. Supplemental labeled modules fill
gaps in the original models; their layout approximates the aircraft rather than reproducing every
real switch. The Cessna 172's existing master rocker and flap selector are directly operable.
Moving common power (including Z/C or the modeled **PWR ALL** handle)
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
There is no EGT/CHT, detonation, feathering, reverse thrust or blade-element model, and
leaning does not change the fuel burn.
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
Boarded and chase views are always near enough, but within the cabin a part too small to see from
the camera (an angular radius under 0.002 rad, a few pixels at 1080p) leaves the frame: from a chase
camera a P-51's 415 cockpit meshes were a quarter of a takeoff's draws. That culling uses the
part's render layers, so the `visible` that bindings and damage set is never overridden. A
`flight-controls` group (the generated cockpit controls) counts as cabin too. Earth views and the
world explorer also prepare an aircraft's shaders before its model joins the scene.

Double-sided transparent materials (canopies, windscreens, instrument covers) draw in one pass:
three otherwise draws each such pane twice and builds a program before each face, every frame.
Glass casts no sun shadow: a mesh whose materials all blend at less than full opacity, or whose
name contains `canopy` or `bubble`. Three's shadow pass draws a pane as solid, so a windscreen
shaded its whole cockpit.

The flown aircraft casts its sun shadow from a map of its own, which travels with it: hosts pass
`EarthAircraft.shadowSubject` (its model and measured sphere, `undefined` while none is flown) to
`renderer.setShadowSubject` each frame, as for the driven car. The sun's main map is fixed to the
ground, and an aircraft crossing it lands on different texels every frame: an OH-6 30 m up is in
7 cm texels, and the canopy frame's shade crawled over its panel. Its own map holds it at about
13 mm a texel (up to 2048 texels across for a larger aircraft, where the main map has as many),
and its ground shadow reaches ten times its radius down the light before it fades. See
[the sky guide](sky.md) for the map itself. WebGL only: `setShadowSubject` returns false on
WebGPU, and the rule below applies there instead.

Without that map, for the aircraft a view follows (flown or watched), hosts pass
`renderer.shadowTexelSize` to `visual.updateShadows(texel)` each frame, and `undefined` for every
other aircraft. Over a wide view the sun's shadow map coarsens (on High, 0.2 m texels 100 m above
the ground, 1.6 m in cruise at 2,500 ft). It then cannot resolve the aircraft's own canopy frame
and seat, and their shadows on the cockpit jumped from frame to frame as the aircraft crossed the
map's texel grid. Coarser than 0.15 m, the aircraft casts no sun shadow; at 0.12 m or finer it
casts again. It still receives shadows from terrain, buildings and clouds. The Earth view and
the world explorer do this for the mounted aircraft, and pass `undefined` while it has its own
map.

`createAircraftVisual` exposes `cockpit`, a mesh picker and control inventory derived from the
interior's authored primary-input bindings and glTF node `extras.aircraftControl` metadata.
An `AircraftControlNode` declares a supported `action`, optional engine ID, and optional
rest-relative `motion` (`property`, `axis`, `scale`, optional `offset`). Switches and selectors animate their commands;
gear, flaps and engine RPM still follow the simulation's transit/spool response.
Separate throttle levers are associated with engine
positions from pilot-left to pilot-right; duplicated collective/thrust levers remain linked.
`cockpit.floor` is the height of the floor at the pilot's feet in the model's frame, measured as the
bottom of the rudder pedals nearest their eye, for seating a figure (undefined without pedals).
`bindAircraftCockpitPointer` from `@bendyline/molen-client/aircraft` binds a canvas, camera and
active pilot session. The HTML companion panel is opt-in with `companionPanel: true`, for
accessibility or older models with incomplete geometry. Call its `update()` each frame
and `dispose()` on teardown. Hosts apply changes with `applyAircraftControl`, submit the result
through `flyAircraft`, and mix `AircraftPointerAxes` with their keyboard/gamepad inputs. Session
release must clear transient axes. The binder cancels drags on exit, view change, blur and pointer
cancellation; it does not write simulation components directly.

The same inventory drives the [vehicle console](vehicle-console.md)'s touch controls, which copy
the modeled stick, pedals and levers out of the cockpit and pose them from `AircraftVisual.signals`
(the readings the cockpit was last posed with). The console works the controls in any view, so the
Earth view's `EarthAircraft.controlSession()` is the cockpit session without its cockpit-view
check.

In the engine repository, build the client and kernel, then run a local live review of all 54 bundled aircraft:

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
