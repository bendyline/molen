# Dynamics v2: flight, driving and riding

A plan, written 2026-11-23, and worked through the same day; a follow-up on 2026-11-24 built
the four largest pieces that first pass had left. See [Status](#status) for what each phase
delivered, where it departed from the plan and what is still not built. It extends [AIRCRAFT-PERFORMANCE.md](AIRCRAFT-PERFORMANCE.md) and
[VEHICLE-DYNAMICS.md](VEHICLE-DYNAMICS.md), which describe the calibration.

## Summary

As first measured, the v1 models reached the figures they were fitted to and missed most of the
others. A Cessna 172 cruised at about the right speed but climbed at 1,800 ft/min (the handbook
says 730); a 737 rolled three times too fast and glided like a much draggier airplane; an OH-6
hovered out of ground effect twice as high as the real one.

The cause is the same in the air and on the road, and it is structure, not tuning:

1. **Motion about the center of mass is prescribed, not produced.** An airplane's pitch, roll and
   yaw follow response curves with the same constants for all 43 airplanes. A car's body roll,
   pitch and ride height are derived from its acceleration. A motorcycle's lean is computed from
   its turn rate. None of them comes from forces acting where they act.
2. **Each vehicle is fitted to one or two figures, and the bench reports those same figures.** One
   cruise speed cannot separate thrust from drag, so errors in one are absorbed by the other.

v2 is three pieces, built in this order:

- **Trials**: headless test procedures (a stall, a climb, a skidpad, a lane change) run on the
  production kernel and scored against published figures, with the figures a model is fitted to
  kept apart from the ones that check it. This comes first and changes no behavior.
- **A shared rigid-body core** where forces act at points: wing and tail surfaces, wheels on
  struts with tires, propellers and rotors. Airplanes, helicopters, cars and two-wheelers all
  stand on it, so landing gear and car suspension are the same code.
- **Assists as a layer above the physics.** Today's hands-off path hold, automatic countersteer
  and automatic balance stay available as the default feel, but stop being part of the physics,
  so the bare vehicle can be tested against the real one.

## Status

All seven phases were worked through on 2026-11-23. Phases 0 to 3 did what the plan asked;
4, 5 and 6 delivered the behavior it was after inside the solvers there were, not the rebuilt
solvers it described. On 2026-11-24 the owner asked for the four largest of those gaps, and
the [follow-up](#follow-up-2026-11-24) built them: a free body for cars, landing gear on the
wheel element, a rotor element with tail rotor torque, and a contact impulse shared by
aircraft and vehicles. [What is left](#what-is-left) gathers what remains. Nothing here has
been flown, driven or ridden by a person yet: it is held by headless trials and tests, and the
feel in the hosts is the owner's to judge.

| | Scored cards within tolerance | Earlier |
|---|---:|---|
| Aircraft | 359 of 403 | 363 before the follow-up; 184 of 232 after Phase 1, before the handling cards |
| Road vehicles | 395 of 416 | 395 of 416 on two axles |

**Phase 0.** The trial library is `@bendyline/molen-kernel/trials` (a new subpath: `/testing`
loads the scripting runtime, which the asset generators that import calibration must not). The
ledgers are [aircraft-trials.json](aircraft-trials.json) (178 published figures across the 54
aircraft, 105 sources) and [vehicle-trials.json](vehicle-trials.json) (44 road-test figures for
10 vehicles). `pnpm aircraft:trials` and `pnpm vehicles:trials` score them;
[AIRCRAFT-TRIALS.md](AIRCRAFT-TRIALS.md) and [VEHICLE-TRIALS.md](VEHICLE-TRIALS.md) are the
recorded scorecards, and the entities tests fail when a card that passed stops passing. The
calibration scripts and the bench fly the library's procedures; nothing else flies its own.

**Phase 1.** Flight figures, within v1's structure:

| Aircraft, at the published weight | Quantity | v1 | Now | Published | |
|---|---|---:|---:|---:|---|
| Cessna 172S | Rate of climb, sea level | 1,810 ft/min | 771 | 730 | fit |
| | Top speed, sea level | 145 kt | 128 | 126 | check |
| | Best glide ratio | 13.5 | 9.2 | 9.1 | fit |
| | Service ceiling | 21,300 ft | 16,750 | 14,000 | check, 20% high |
| P-51D | Rate of climb, sea level | 4,240 ft/min | 3,414 | 3,600 | fit |
| | Service ceiling | 36,900 ft | 39,230 | 41,600 | check |
| DC-3 | Rate of climb, sea level | 2,840 ft/min | 1,191 | 1,140 | fit |
| | Service ceiling | 31,200 ft | 28,230 | 23,200 | check, 22% high |
| 737-800 | Best glide ratio | 12.5 | 17.5 | 17.5 (estimate) | fit |
| | Rate of climb, sea level, 60 t | 8,700 ft/min | 6,100 | none found | |
| | Roll rate at 250 kt | 59°/s | 25 | none found | |
| F-16 | Roll rate at 400 kt | 173°/s | 306 | 308 | fit |
| | Liftoff, stick held back | 186 kt | 160 | 150–160 | |
| OH-6 | Hover ceiling out of ground effect | 15,600 ft | 7,340 | 7,300 | fit |
| | Hover ceiling in ground effect | 17,900 ft | 11,780 | 11,800 | fit |
| | Rate of climb | 1,800 ft/min | 1,300 | 1,840 | check, 29% low |

The v1 column was measured at each type's authored mass, before the figures were sourced. After
Phase 1, 184 of 232 scored cards were within tolerance across the fleet: 155 of 157 fitted
figures and 29 of 75 checks. [AIRCRAFT-PERFORMANCE.md](AIRCRAFT-PERFORMANCE.md) describes the stages of the fit and
lists the failing checks with their causes; most wait for a later phase.

What changed in the flight solver:

- Propeller thrust from momentum theory over the propeller's disc, with a loss when slow and
  drag when idling; turbofan thrust falling with Mach number by bypass ratio; unsupercharged
  piston power falling a little faster than density.
- A lift curve per type: slope from the aspect ratio, greatest lift from the published stall
  speeds.
- Roll rate from a published figure or the wing's span, roll damping from the wing.
- Takeoff rotation about the main wheels to a liftoff attitude, limited by each airframe's own
  tail-strike angle, with tail clearance held just after liftoff.
- Helicopters turn about their center of mass in flight; rotor power is the transmission's
  limit; rotor efficiency and ground effect come from the two hover ceilings.
- The chase camera aims at the center of mass.

Departures from the plan as written:

- **Tolerances** are 5% on speeds, 10% on climb, ceiling and glide, 15% on distances and roll
  rate, 20% on handling periods, not 5% on all performance: published climb and distance figures
  carry more uncertainty in their conditions than speeds do. A ledger row can set its own.
- **Fleet coverage.** Every aircraft has its anchor and whatever else could be sourced; 12
  fighters and the largest transports have few cards, because their manuals are not public.
  Road sources cover ten vehicles; the cycles are measured but have nothing to be scored against.
- **Not every Phase 1 card passes.** The 46 failing checks are kept as the work list rather than
  tuned away. Two attempted fits were dropped for being unphysical: fighter ceilings (operating
  limits, not performance) and a floatplane's uncalibrated stall speeds for the Beaver.
- **The mixture matters now.** The trial pilot leans for best power, as the handbooks' figures
  assume. A player who climbs at full rich loses power with altitude as a real engine does.

**Phase 2.** The rigid-body step the airplane branch of `stepAircraft` carried is now
`packages/kernel/src/dynamics/rigid-body.ts`: substep count, turning a body by its angular
velocity, Euler's equations, the center-of-mass and origin bookkeeping, loads accumulated as a
force and a moment, and a box's inertia. Airplanes and helicopters step through it, and 27
recorded flights (takeoffs, loops, stalls, hovers, engine failures) came out bit for bit as
before. Left for Phase 4, where the wheels need them: the one environment query and the single
contact resolver.

**Phase 3.** Airplanes turn on their surfaces. Forty of the 43 (all but the F-14, Osprey and
Harrier) carry `airplane.surfaces`: a wing of four panels, a tailplane and a fin, sized by class
from the wing and fuselage each type has. Off the wheels their roll, yaw and pitch come from
those forces. `controlMode: 'direct'` puts the stick and pedals on the surfaces, with a trim;
the default assist works the elevator to fly the path-holding response airplanes had, and
coordinates turns. Flown directly, the airplanes have the modes real ones have:

| Aircraft, condition | Quantity | Now | Published | |
|---|---|---:|---:|---|
| C-5M, sea level, 298 kt, 297 t | Short-period frequency | 1.69 rad/s | 1.57 (C-5A) | |
| | Short-period damping ratio | 0.71 | 0.71 | |
| | Dutch roll frequency | 1.00 rad/s | 0.88 | |
| | Dutch roll damping ratio | 0.25 | 0.21 | |
| | Roll time constant | 0.48 s | 0.69 | 32% quick |
| | Phugoid damping ratio | 0.041 | 0.061 | 34% low |
| Cessna 182, 5,000 ft, 121 kt | Short-period frequency | 5.0 rad/s | 5.98 | |
| | Short-period damping ratio | 0.61 | 0.68 | |
| | Phugoid period | 35.5 s | 34.9 | |
| | Phugoid damping ratio | 0.11 | 0.075 | see below |
| Cessna 172, 90 kt | Dutch roll frequency, damping | 2.7 rad/s, 0.20 | 2.4, 0.20 (Navion, 104 kt) | not scored |
| | Roll time constant | 0.09 s | 0.12 (Navion) | not scored |

The published columns are NASA CR-2144 (C-5A, stability augmentation off), NASA CR-1975 (a
computed Cessna 182) and Nelson's Navion. Each of the 27 airplanes that has surfaces and is not
fly-by-wire is also held to MIL-F-8785C's Level 1 cruise limits on six cards (phugoid, short
period, Dutch roll damping and frequency, roll mode, spiral): 159 of 162 pass, and the three
that do not are the phugoid damping of the 737, the C-5M and the MiG-29, a few thousandths under
0.04 as the real B-747's is. With the handling cards the scorecard stands at 354 of 403.

What changed in the flight solver, beyond the surfaces themselves:

- Roll and yaw are physical in both control modes: roll rate and its build-up come from the
  ailerons against the wing's damping and the roll inertia, yaw from the fin. Only pitch is
  worked by the assist, by solving for the elevator.
- Yaw inertia, where a type does not author one, is the pitch inertia plus the roll inertia (a
  flat body's), not a solid box's, which was four to six times too large. Roll inertia is by
  class, from published mass properties.
- The side force in a slip is the airframe's, growing with speed, where the airplane flies on
  surfaces.
- The trial pilot's rudder pushed the wrong way against a slip. The old weathercock response
  hid it.
- `aircraftState.surfaces` reports elevator, aileron and rudder positions.

Departures from the plan as written:

- **Not opt-in per type.** The whole class-sized fleet moved at once, since every existing
  behavioral test passes with the default assist. There is no `dynamics` version on the spec.
- **Sized by class, not solved per type.** The plan had surfaces generated from each model's
  geometry and solved against fit cards. No type has enough published handling figures to fit,
  so tail, fin, dihedral, margin and inertia are class figures set against the few airplanes
  that do, and every handling card is a check.
- **Adverse yaw, wing drop at the stall and engine-out are kernel tests**, not ledger cards:
  no published figure was found to score them against.
- **Not modeled:** trim drag (tail and fin act as moments only, so the Phase 1 performance
  figures stand unchanged), thrust lines above or below the center of mass, spins beyond a
  wing dropping, and the fly-by-wire types' own control laws (they keep the assist).
- **The Cessna 182's phugoid damping fails its card** at 0.11 against 0.075. The published
  analysis holds thrust constant; a propeller at fixed power loses thrust as the airplane
  speeds up, which damps the phugoid by about that much. Left failing, not tuned.

**Phase 4.** Cars stand on four wheels. The wheel is a shared element
(`packages/kernel/src/dynamics/wheel.ts`): a tire whose force comes from combined slip (slip
angle and slip ratio sharing one grip), a wheel that spins under drive and brake torque, two
wheels on a differential, and a strut. `vehicle-wheels.ts` puts a car on four of them: each
wheel has its own load from its own spring, damper and anti-roll bar, its own patch of road
and its own speed; the body heaves, pitches and rolls on the struts under the tire forces. All
124 calibrated road vehicles carry `wheels` and were refitted on the model.

What a car now does that it did not:

- Wheelspin and lock-up are states. A wheel braked past its grip stops and slides, and a
  locked front wheel steers almost nothing; a driven wheel with more torque than grip spins up
  and takes the engine speed with it.
- Anti-lock brakes, traction control and stability control are controllers on the wheels.
  Anti-lock holds each wheel short of its peak, the rear pair at what the worse-placed of them
  can take, and lets go of a wheel that has broken loose until it turns again.
- An open differential gives the loaded wheel only what the spinning one can hold; a
  limited-slip one drags them together.
- Split grip: braking with two wheels on ice pulls the car toward the grippy side, mildly with
  anti-lock and into a spin without it.
- Engine braking goes through the tires. On two axles it was added past the tires' limit,
  which is why EVs with strong regeneration stopped up to 23% shorter than tested.
- A car that drops onto the road lands on its springs.
- `vehicleInput.controlMode: 'direct'` is the bare car (steering is the wheel angle, no
  controllers) and `brakePedal` an analog brake.

| Vehicle | Quantity | Two axles | Four wheels | Published |
|---|---|---:|---:|---:|
| Tesla Model 3 | Braking, 70–0 mph | 41.9 m | 46.9 | 54.3 |
| Porsche 911 | Braking, 70–0 mph | 37.2 m | 39.7 | 44.2 |
| Hummer EV | Braking, 70–0 mph | 49.5 m | 57.5 | 60.7 |
| Toyota Camry | 0–60 mph | 6.9 s | 6.9 | 7.0 |
| Honda Odyssey | 0–100 km/h | 7.6 s | 7.95 | 7.0 (estimate) |

The road scorecard stands at 395 of 416, as before: the Hummer's braking and the Hilux's top
speed were gained, and two launches that sat at the end of the fit's range were lost (Odyssey,
Seagull), because a tire now slips a few percent as it pulls. A step costs about 16 µs against
9 µs, at the same 120 Hz substeps: the wheel's spin is advanced implicitly, so the stiff tire
does not need a finer step.

Departures from the plan as written:

- **Not a six-degree-of-freedom body** (since built, for a car that leaves the road's plane:
  see the follow-up). The car still moves in the plane of the road it is
  following, with heave, pitch and roll on the struts as small angles on top. So there was no
  rollover and no tumbling in the air. Terrain following, steps and slopes as barriers,
  collisions, parking, snow, the travel boost and rail all work in that plane, and replacing
  them was not attempted. The wheel element does not depend on it.
- **The whole fleet moved**, as for airplanes, since the existing driving tests pass on four
  wheels with two restated: the roll split still matters slightly with load-proportional tires
  (the steered outside tire drags its side back), and a sedan covers 19.8 m of road snow in
  six seconds where 20 was asked.
- **No host control for direct mode yet.** It is an input field; where a player switches it is
  the owner's decision below.
- **Road handling cards were not added.** No sourced understeer gradients, roll gradients or
  lane-change speeds were gathered; the new behavior is held by kernel tests instead.
- **Not done in this phase:** aircraft landing gear on the wheel element and the single
  contact resolver (both built in the follow-up), the single environment query, a clutch or
  manual gears.

**Phase 6.** Rotors. Two things stood between the helicopters and their published figures, and
neither needed a new rotor:

- **The blades had no limit of their own.** Lift at full collective was the same multiple of
  the weight for every type, so every service ceiling came out where that multiple ran out of
  air, near 20,000 to 24,000 ft. `helicopter.liftLimit` is the thrust the rotor can make at
  sea-level density as a multiple of the weight of `liftMass`, fitted to the published service
  ceiling at the weight it is quoted for. Flown heavier, the helicopter runs out of rotor lower.
- **The autorotation trial left the collective on the floor.** A handbook's rate of descent is
  flown with the rotor speed held in its range by the collective; lever down, the rotor has
  speed to spare and the helicopter descends a third faster. The trial pilot holds rotor speed.

| Helicopter | Quantity | Before | Now | Published |
|---|---|---:|---:|---:|
| OH-6 | Service ceiling | 21,630 ft | 15,500 | 15,800 |
| | Autorotation descent, 60 kt | 2,345 ft/min | 1,560 | 1,800 |
| R44 | Autorotation descent, 55 kt | 2,261 ft/min | 1,380 | 1,350 |
| UH-60M | Service ceiling | 24,160 ft | 14,700 | 15,000 |
| CH-47F | Service ceiling | 24,160 ft | 19,700 | 20,000 |
| Bell 206B | Service ceiling | 19,780 ft | 13,200 | 13,500 |

46 of 52 rotor cards are within tolerance (37 before). Sourced gearbox limits replaced the
engines' own power as what reaches the rotor on the H145 (838 kW, not 1,334) and the CH-47
(7,500 hp, a CH-47D figure), which took the H145's fitted rotor efficiency from an implausible
0.45 to 0.72; the AW139's climb is flown at the gross weight its figure is quoted at and now
passes. Five rates of climb still fail: they are the power left over at the best climb speed,
and come out high where the published figure's weight or power rating is not known (H145,
CH-47, Bell 412), on the H125 (39% high at maximum continuous torque) and low on the OH-6 (18%,
whose flight-test report gives a higher transmission limit than the one used).

Departures from the plan as written, all three since closed by the follow-up for the ten
single-rotor types:

- **No rotor element.** Thrust was collective times a multiple of the weight, limited by
  the blades and by a momentum-theory power budget; there was no inflow state, no flapping or
  disc tilt from airspeed, and the hub's height above the center of mass played no part.
- **No tail rotor torque.** The pedals commanded a yaw rate and the tail rotor was taken to
  hold the heading at any power, in direct cyclic too.
- **Service ceilings were fitted to a lift multiple**, since a blade-loading limit needs blade
  area the specs did not carry.

**Phase 5.** Two-wheelers are ridden. A cycle's steering input asks for a lean, and a rider
controller gets it by steering: out of the turn first (countersteer), then into it. The lean is
a balance between gravity and the turn the rider is steering for, brought round at a rate the
remaining grip can stop, and the bar is worked until the machine actually turns that hard.
Leaned tires push sideways by camber thrust. The motorcycles, scooter and mopeds have engines
and gears; the skis and snowboard carve the arc their sidecut and edge angle give.

| Machine | Quantity | Before | Now |
|---|---|---:|---:|
| Motorcycle, full steering held at 20 m/s | Largest slip angle | spins, stops, keeps yawing | 1.3° |
| | Lean reached, and time to reach it | 36° in half a second, sliding | 29° in 0.7 s |
| | Countersteer on the way in | none | 1.5° |
| Motorcycle | 0–50 km/h | 1.9 s, one constant push | 2.3 s through the gears |
| Every tire-borne cycle (11) | Figure-eight at 60% of top speed | not tried | completed |
| Skis at 7 m/s, edged | Turn radius | as steered | sidecut × cos(lean) |

The spin was the old steering asking the tires for half again what they could give. The rider
asks for about two thirds, and keeps the rest to steer with.

Departures from the plan as written:

- **The rider always saves it** (owner decision 4, assumed): the lean follows the turn the
  rider is steering for, not the tires' actual force, so a slide does not tip the machine
  over. There are no low-sides, high-sides, wheelies or stoppies. A first version balanced the
  lean on the real tire force; the lag between bar and tire made it fall in every time, which
  is the honest physics and not a ride anyone would want from a key press.
- **No direct mode for cycles** (steering torque): the rider is the only way to ride.
- **Engines are class estimates.** The cycles are generic types with no published figures, so
  nothing about them is scored; the riding cards are measured only.
- **Skateboards steer as bicycles do**, by the rider controller, not by a truck model.

Also fixed on the way: a cycle's weight no longer shifts forward under air drag (only tire
forces move it), which had left the rear tire light at speed.

### Follow-up, 2026-11-24

The owner asked for the four items that headed "What is left", and on the helicopter said:
build the most realistic physics we can, and add an automatic torque helper for keyboards (or
a simplified helicopter mode) back in if it is needed. All four were built. The helper was
not removed and re-added: it is the default assist, described below, and it sits on top of
the same physics direct control flies.

**One contact impulse.** `packages/kernel/src/dynamics/contact.ts` holds the impulse a rigid
body takes at a contact: along the normal with a bounce, friction across it, a joint's limit
where a part breaks first, and the push apart, with a form for a body in the plane of its
road. Aircraft collisions, vehicle damage and the car body below all use it. 53 recorded
crashes and drives came out bit for bit as before the move. What was not unified is the query:
aircraft and vehicles still ask their hosts about obstacles through their own adapters.

**A car that can leave its road.** On the road a car stays in the planar solver, which the
parking, snow, rail, travel-boost and terrain-following rules are written for. It becomes a
free rigid body (`packages/kernel/src/vehicle-body.ts`, six degrees of freedom, the same four
struts, tires, differentials and controllers) when it is in the air, when one whole side or
end of its wheels has come off the road and the body has leaned 0.08 rad on the other pair,
or when the ground ahead falls away more steeply than `maxSlope`; and it is handed back once
it is on three or more wheels, upright, nearly still about its axes and on ground it could
drive on. Free, each wheel finds its own ground, and where no wheel reaches the body lands on
its sills, roof corners and bottomed wheels through the shared contact impulse.

- Cars jump: off a ledge the nose drops because the rear wheels are still on it, off a ramp
  they keep the climb it gave them, and they land on their springs.
- Tall vehicles roll over when their tires grip harder than their track can stand. On a
  tilting table a motorhome goes over near the angle its track and the height of its mass
  give. No shipped vehicle goes over on a flat, dry skidpad on its own tires: the skidpad
  trial now reports a tip, the calibration refitted the grip of the four tallest against it,
  and the class C motorhome's tires hold 0.66 g where its track could stand 0.68.
- A car tumbles down a bank without gaining energy and can come to rest on its side or roof.
  `rightVehicle` sets it back on its wheels; the hosts do that on R, with the repair.
- On the road the transform now carries the body's heave (a fraction of a millimeter under
  power), and the wheel visuals take it back out.

A step costs about 19 µs driving, against 16. The road scorecard is unchanged at 395 of 416.
Not built: one car pushing or tripping another, a curb tripping a rollover, body deformation,
and a sourced tilt-table card (measured center-of-mass heights were gathered for five
vehicles, and the fleet's SUVs look low against them).

**Landing gear.** Every airplane stands on three legs, and a helicopter with a rotor block on
the four ends of its skids (`packages/kernel/src/aircraft-gear.ts`): struts with springs and
dampers and the cars' tire at the foot, their forces applied where the wheels are. The v1
ground laws for airplanes are gone. Brakes and rolling drag work through the tires by the
load on them; the nose wheel comes up when the tailplane can lift it; a taildragger with its
tail up or a nosewheel airplane on its nose wheel alone swings round unless feet stop it; a
crosswind turns and blows the airplane as far as its tires allow; a firm touchdown strokes the
struts; a parked airplane is held by friction. Control surfaces work on the wheels, in both
control modes. The assist keeps what a keyboard needs: it works the elevator toward what the
stick asks and winds more on, stops short of a tail strike, keeps a braking taildragger off
its nose, and its feet damp any swing the pedals did not ask for.

| Takeoff, at the published weight | Now | Published | |
|---|---:|---:|---|
| P-51D ground roll | 351 m | 305 | 15% long; was inside tolerance |
| Cessna 172S ground roll | 304 m | 293 | |
| DC-3 ground roll | 524 m | 518 | |
| PC-12 distance over 50 ft | 630 m | 758 | 17% short; was inside tolerance |

Two things found by flying it as a player would, both fixed:

- With the surfaces live on the ground, a tail in the propeller's wash took the wash's
  pressure at the free air's angle. Standing in a 12-knot crosswind at full power that is a
  fin taken to be broadside in the wash: the Mustang and the 172 swung 55° to 65° into the
  wind in the first seconds of the roll, and a tailwind tipped the 172 onto its nose strut. The wash now brings
  its direction with its pressure (`tailFlow` in `flight-surfaces.ts`). In flight the same
  correction moved the propeller types' handling figures by a few percent, none across a
  tolerance.
- The assist's feet damped yaw too weakly to match what the v1 tires had done. Compared with
  the committed kernel on the same takeoffs, hands off the pedals:

  | Heading and sideways drift at liftoff | v1 | Now |
  |---|---:|---:|
  | P-51D, still air | 3.1°, 13 m | 2.7°, 14 m |
  | P-51D, 12 kt crosswind | 10.8°, 26 m | 8.5°, 43 m |
  | Cessna 172S, 10 kt crosswind | 17.1°, 27 m | 17.2°, 44 m |

  The feet's gain was set for those headings. The airplane is carried further sideways than
  before because its tires now slip under the wind's side load.
- v1's gear held the wings level. On struts, a touchdown still crabbed into a crosswind tips
  the airplane: the tires pull it straight at ground level while the wind is under the upwind
  wing. A Cessna left alone after touching down in a 10-knot crosswind went onto a wingtip.
  The assist now has hands as well as feet on the wheels: aileron against the bank. The
  class rule for track was also narrower than light aircraft are (it was capped by the
  wheelbase); it is a fifth of the span.

Not built: per-type wheelbase and track (class rules from the airframe's size; a Mustang
stands on a narrower track than the real one), brakes worked one side at a time,
tire wear and burst, and a datum for the taildraggers' wings (below).

**A finding for the owner: the taildraggers' datum.** The five taildragger models (P-51, DC-3,
Beaver, Porter, Beech 18) are posed tail-down, and the aerodynamics take that pose as zero
incidence. So body pitch 0 is the three-point attitude on the ground and level flight in the
air: these airplanes cruise nose-high by their ground angle (13° for the Mustang), and on the
ground the wing has no extra angle of attack from sitting on its tail. v1 hid the second half
with a rotation law. The gear gives the tailwheel a soft give below where it rests so the
airplane can be rotated to its liftoff angle, which reproduces v1's takeoff. The proper fix
is a wing datum separate from the model's pose (`airplane.stance`, a pitch offset between
them): the airplane would cruise level, sit at its real angle of attack on three points, and
could be wheel-landed. It moves every taildragger test and the cockpit sight picture, so it
was left for a decision.

**Rotors.** Ten of the eleven helicopters carry `helicopter.rotor`, built by calibration from
the rotor each type really has (sourced in the trial ledger), and fly on it
(`packages/kernel/src/dynamics/rotor.ts`, `helicopter-rotor.ts`): blade-element thrust with
an induced flow that follows momentum theory with a lag, a blade stall limit that falls with
advance ratio, flapping (the disc tilts back and to its advancing side, and follows a turning
shaft late), a hub that carries a moment by its hinge offset, the mast's torque on the
fuselage, a tail rotor that is a small rotor of the same kind, a fin, a stabilizer, fuselage
drag and download, skids on struts, and a rotor speed the governor holds until more is asked
than the gearbox passes. The CH-47's tandem rotors are not covered and it keeps the response
model.

What a helicopter does now that it did not: it hovers nose-up and left skid low, leaning
against its tail rotor (right skid low for the clockwise H125); the nose swings with every
change of collective unless a pedal goes with it; it spins without its tail rotor; the disc
blows back as it gathers speed, so the stick goes forward to keep accelerating; the rotor
droops when overpitched; a teetering rotor (UH-1H, 206B, R44) loses its control with its
thrust; and with the engine out the air coming up through the disc turns the blades.

| Helicopter | Quantity | Before | Now | Published |
|---|---|---:|---:|---:|
| OH-6 | Rate of climb | 1,530 ft/min | 1,780 | 1,860 |
| | Autorotation descent, 60 kt | 1,560 ft/min | 1,530 | 1,800 |
| | Induced power over the ideal, fitted | | 1.02 | |
| | Fuselage drag area, fitted | | 0.54 m² | 0.46 |
| H125 | Rate of climb | 2,330 ft/min | 2,070 | 1,673 |
| UH-1H | Rate of climb | 1,460 ft/min | 1,395 | 1,600 |
| UH-60M | Rate of climb | 2,170 ft/min | 2,515 | 2,020 |
| Bell 412 | Hover ceiling out of ground effect | 5,120 ft | 2,030 | 5,200 |

44 of 52 rotor cards are within tolerance, against 46. The Bell 412's two published hover
ceilings ask for different rotors and its fit ends at a bound; the UH-60M needs an induced
factor of 1.39 to hover where published, more than a rotor has, and then climbs too well.
Those are the honest reading of a model with fewer free constants: the response model had a
rotor efficiency and a lift limit per type to absorb them.

Controls, as assumed from the owner's direction:

- **Assisted (the default)** is hands and feet on the real controls. The stick asks for a
  disc tilt and the swashplate is solved to give it, the pedals ask for a rate of turn and the
  tail rotor is solved to hold the torque and give it, under power the lever is eased
  when the rotor droops, and near the hover with the stick centered a little tilt is held
  against drift over the ground. This is the automatic torque management the owner allowed for. A
  keyboard pilot flies as before, in a helicopter that leans, droops and autorotates.
- **Direct** (`cyclicMode`, and `pedalMode`, which follows it unless set) is the swashplate and
  the tail rotor's pitch. Each control rests at a trim that starts where the assist had it,
  so taking over moves nothing, and follows a held stick or pedal at a quarter of its travel
  a second. Nothing levels the helicopter, holds the torque or protects the rotor.

Flown as a player would against the committed kernel, the first version of the assist had
two faults, both fixed. Its hover crept at about 2 knots, because holding the disc upright
leaves small unbalanced forces and a rotor has almost no damping at a walk (v1 stayed put;
hence the hold above, which also keeps the hover in a wind, where v1 was blown away). And
any landing with forward speed nosed over, because the skids gripped like tires at 0.7;
at 0.4 a run-on landing slides to a stop from 50 knots.

Not built: the tandem CH-47 on rotors, pitch-roll cross-coupling beyond flapping, the tail
rotor and fin in the main rotor's wake, loss of tail rotor effectiveness, mast bumping, and
separate engines on the twins. `aircraftInertia` in collisions still uses the airplane
formulas for a helicopter.

## Where v1 stood

### Flight, measured

Measured on the production kernel on 2026-11-23, before any of the work above, headless, at each
type's authored mass (full tanks). The published column held handbook figures quoted from memory
to size the gaps; the sourced figures now in the ledger differ in places (the 172's clean stall
is 53 kt calibrated, 48 indicated; the F-16's roll limit is 308°/s), and the scorecards replace
this table.

| Aircraft | Quantity | v1 | Published (approx.) | |
|---|---|---:|---:|---|
| Cessna 172S, 1,020 kg | Stall, clean | 53 kt | 48 kt at 1,157 kg | high |
| | Top speed, sea level | 145 kt | 126 kt | 15% high |
| | Rate of climb, sea level | 1,810 ft/min | 730 ft/min | 2.5× |
| | Service ceiling | 21,300 ft | 14,000 ft | high |
| | Best glide ratio | 13.5 | about 9 | high |
| P-51D, 4,200 kg | Stall, clean | 93 kt | 87–91 kt | ok |
| | Top speed, sea level | 327 kt | about 325 kt | ok |
| | Rate of climb, sea level | 4,240 ft/min | 3,200–3,500 ft/min | 25% high |
| | Service ceiling | 36,900 ft | 41,900 ft | low |
| | Roll rate at 260 kt | 91°/s | 90–95°/s | ok |
| DC-3, 9,000 kg | Rate of climb, sea level | 2,840 ft/min | 1,130 ft/min | 2.5× |
| | Service ceiling | 31,200 ft | 23,200 ft | high |
| 737-800, 60 t | Rate of climb, sea level | 8,700 ft/min | 2,500–4,000 ft/min | 2–3× |
| | Best glide ratio | 12.5 | 17–18 | low |
| | Roll rate at 250 kt | 59°/s | 15–25°/s | 3× |
| | Service ceiling | 47,600 ft | 41,000 ft | high |
| F-16, 10,500 kg | Rate of climb, sea level | 53,500 ft/min | about 50,000 ft/min | ok |
| | Sustained turn, sea level | 19°/s | 18–21°/s | ok |
| | Roll rate at 390 kt | 173°/s | 240–324°/s | low |
| | Liftoff, full back stick from 140 kt | 186 kt | 150–160 kt | late |
| OH-6, 1,150 kg | Hover ceiling out of ground effect | 15,600 ft | about 7,300 ft | 2× |
| | Rate of climb at 60 kt | 1,800 ft/min | 1,800–2,000 ft/min | ok |
| | Autorotation descent at 58 kt | 2,110 ft/min | 1,700–1,900 ft/min | 15% high |

Four findings the table does not show:

- **One set of constants flies the whole fleet.** All 43 airplanes share the lift slope (4.8),
  stall angle (16°) and camber, so every one has a maximum lift coefficient of 1.34 and stall
  speed follows from wing loading alone. They also share pitch frequency and damping, weathercock
  stability, yaw damping, dihedral effect and side-force damping. Roll comes in four classes.
  A propeller has one efficiency at every airspeed (0.85 for all but one type), which is most of
  why the propeller types climb too well.
- **No airplane is speed-stable.** Released 10% faster than its trim speed, a real airplane noses
  up and trades speed for height in a slow oscillation (the phugoid, 25–90 s for these types).
  All six sampled hold the new flight path instead: the trim follows the angle of attack that
  holds one g. That is a good assist and the wrong physics, and it is why nothing needs trimming.
- **Rotation at takeoff lags.** With full back stick held from rotation speed, the Cessna lifts
  off 20 kt later and the F-16 45 kt later: a spring holds the nose to the runway until the wing
  has nearly unloaded the wheels.
- **A helicopter in flight turns about its skids,** not its center of mass
  (`pos = pos + velocity × h` at the transform origin, in assisted and direct cyclic alike).
  Airplanes already turn about the center of mass.

The roll the owner saw in a jet ("turning about a point below the airplane") was this last kind of
error on the camera side: the chase camera followed the transform origin (the landing contact, 2 m
below a fighter's center of mass) while the kernel correctly rolled about the center of mass.
Fixed 2026-11-23 in `aircraftCameraPose`.

### Driving and riding, from a code review

The road model is a planar "dynamic bicycle model": forward speed, side speed and yaw rate, with
one tire per axle. [VEHICLE-DYNAMICS.md](VEHICLE-DYNAMICS.md) reports that all 124 road vehicles
corner within 2% of their skidpad figure and 117 reach 100 km/h within 10% of their time. Those
are the two fitted figures. Not fitted, and not checked against anything: understeer balance,
transient response, roll and pitch angles, braking in a turn, low-grip behavior, and everything
about the 13 cycle types.

| Area | v1 | Consequence |
|---|---|---|
| Body | Planar, 3 degrees of freedom. Height is a separate ballistic drop that snaps to the ground; roll and pitch are springs driven toward "angle per g". | No rollover, no jump rotation, no landing compression; load transfer lags because it is read back from the body angle. |
| Tires | One per axle. Side force from a saturating curve, friction ellipse with drive and brake. No wheel rotation, no slip ratio. | Wheelspin and lock-up are force clips, not states; ABS and traction control are the clip. No split grip (one surface sample per step, at the center). |
| Steering | Lock capped by grip, front slip held to 75% of peak, automatic countersteer, with no way to turn it off. | The driver assist is inside the physics, so the bare car cannot be measured. |
| Powertrain | Analytic torque curve, automatic gearbox, engine speed slaved to wheel speed. Brake is on or off. | No clutch or launch behavior, no manual gears, all-wheel drive is a fixed 40/60. 26 of 123 fitted drivelines sit at a bound of the fit. |
| Obstacles | A step or slope over the limit zeroes the velocity. Other vehicles are static obstacles. | Curbs and kerbs stop a car dead; nothing is pushed. |
| Two-wheelers | The same model with two contacts. Lean is `atan(speed × yaw rate / g)`, clamped and filtered. | No balance, countersteer, falling, wheelie or stoppie. None of the 13 types has a powertrain: constant force to a hard speed clamp. |
| Skis, snowboard, skateboards | Cycle plus runners or wheels. | Speed on a slope is pinned by tests; carving is the bicycle model's turn. |
| Boats | Thrust against drag, yaw as a lag to a commanded turn rate, heave as a spring to a sine swell. | No buoyancy, no rudder moment. |
| Rail | One degree of freedom along the track with adhesion-limited traction. | Adequate; out of scope here except for trials. |

### What v1 does well

Keep these, and carry them into v2 unchanged where possible: real forces for an airplane's
translation (lift, drag polar with wave drag, thrust, weight); quaternion attitude with an
energy-preserving free-rotation step; per-engine thrust, failures and asymmetric moments;
substepping that gives the same flight at 30, 60 and 120 Hz; wind, gusts and turbulence shared by
aircraft and cars; damage and debris; autorotation; snow and surface grip tables; the calibration
ledgers and their staleness checks in the entities build.

## Should we model more?

More structure, not more effects. v1 already has many effects (P-factor, vortex ring, wave drag,
greyout, snow drag) stacked on a core whose rotations are prescribed. Adding further effects to
that core gets less true per line of code. The four things worth modelling are the ones from which
most of the missing behavior follows on its own:

1. **Aerodynamic surfaces at positions.** Two to four wing panels a side, a tailplane, a fin and a
   fuselage, each seeing its own airflow (including the body's rotation, the wing's downwash and
   the propeller's slipstream) and pushing at its own location. Roll damping, adverse yaw, the
   dihedral effect, weathercock stability, pitch stiffness, speed stability and the phugoid, trim
   changes with flaps and power, a wing dropping at the stall and spin entry then come from
   geometry the model generators already know, instead of from constants.
2. **Wheels on struts with tires.** A spring and damper, a tire with slip ratio and slip angle, a
   wheel that spins. For cars: real load transfer, roll and pitch, rollover, jumps, curbs, split
   grip, wheelspin and lock-up. For aircraft the same element is landing gear: crosswind landings,
   ground loops in a taildragger, bounces and braking stop being scripted.
3. **Thrust that depends on speed.** Propeller efficiency against advance ratio (fixed-pitch and
   constant-speed), turbofan thrust falling with Mach number by bypass ratio, a clutch or
   converter between engine and wheels.
4. **A roll degree of freedom for two-wheelers**, balanced by a rider controller that steers into
   the lean the way a rider does.

Not worth modelling for this engine: blade-element or panel-method aerodynamics, aeroelasticity,
engine thermodynamics and systems, icing, replicas of specific fly-by-wire control laws, tire
temperature and wear, suspension linkage geometry, driveline torsion, full bicycle steering
dynamics (weave and wobble). Each is expensive and would move no trial figure a player can feel.

## Design

### Trials

A trial is a procedure, a measurement and a reference:

- **Procedure**: a scripted virtual pilot or driver flying the production kernel. Primitives:
  hold speed, altitude, bank, heading, lane or radius; step, pulse and doublet inputs; release.
  Today each test file and bench script carries its own copy of these (`fly` and `hold` in the
  kernel tests, `flyLevel` in `flight-bench.mjs`, the solver loop in `vehicle-dynamics.mjs`).
- **Measurement**: steady values, distances and times, and period and damping taken from a
  recorded time series.
- **Reference**: a value, a tolerance, a source and what that source supports, in the style of
  `aircraft-performance.json`. Each reference is marked **fit** (calibration may use it) or
  **check** (calibration may not).

One library serves the kernel tests, the calibration scripts and the benches. It belongs in the
kernel's existing `/testing` subpath, since it only needs `stepAircraft`, `stepVehicle` and the
environment types. The ledgers stay in `content/entities/source/`, one per domain, and grow from
one anchor per vehicle to a set of cards.

The scorecard is a budget, not a gate: CI fails when the count of cards within tolerance drops,
or when a card that passed starts failing, not because some card is red. That keeps the truth
visible (the table above would be mostly red on day one) without blocking unrelated work.

The fit order matters, because it is what stops errors cancelling:

1. Stall speeds fix the lift curve (no thrust or drag involved).
2. Power-off glide fixes the drag polar (no thrust involved).
3. Climb and top speed then fix thrust against speed.
4. Everything else is a check.

For cars: coast-down fixes drag and rolling resistance, the skidpad fixes grip, acceleration fixes
the driveline, and braking, understeer and transient response are checks.

### Shared core

A new `dynamics/` area in the kernel, pure functions over plain data like the rest of it:

- **Rigid body**: mass, inertia, center-of-mass offset from the transform origin; position,
  quaternion, linear and angular velocity; a step that takes accumulated force and torque. The
  airplane branch of `stepAircraft` already contains this (quaternion integration,
  `freeRotationRates`, placing the origin around the center of mass); it moves out, and the
  origin-versus-center-of-mass bookkeeping lives in one place.
- **Force elements**, each a function from body state and environment to a force at a point:
  aerodynamic surface, fuselage or car body (drag, side force, lift), propeller, jet, rotor,
  wheel (strut and tire), hull sample (buoyancy), tow or coupler.
- **Environment**: one query for ground height, normal and surface type under a point, plus the
  atmosphere and wind field the aircraft use today. Cars get air density and vertical wind for
  free; aircraft get surface grip.
- **Substepping**: one rule, driven by the stiffest element (a tire on a strut), replacing the two
  copies in `aircraft.ts` and `vehicles.ts`.
- **Contacts and damage**: the two resolvers (`resolveAircraftContacts`,
  `resolveVehiclePartContacts`) become one that applies an impulse to a rigid body. A struck car
  can then be pushed.

Determinism rules are unchanged: `dmath` throughout, fixed substeps, no host timing.

### Assists

A layer between the player's input and the vehicle's controls. The physics below it has no
assists; the default setting reproduces today's feel.

| Vehicle | Direct | Default assist (today's feel) |
|---|---|---|
| Airplane | Stick moves elevator, ailerons, rudder; a trim control | Path hold (automatic trim to the held flight path), turn coordination, load and angle-of-attack limits |
| Fly-by-wire jet | Not offered: the real airplane has none | Rate command with g and angle-of-attack limiters, as its control law does |
| Helicopter | Cyclic, collective, pedals | Attitude hold with self-levelling, heading hold |
| Car | Steering angle, analog throttle and brake | Speed-sensitive lock, countersteer help, ABS, traction and stability control as real controllers acting on wheel states |
| Two-wheeler | Steering torque (expert only) | Rider controller: the player asks for a turn, the rider countersteers and balances |

Trials run in direct mode with the virtual pilot, so they measure the vehicle and not the assist.
Existing behavioral tests (hands-off path hold, automatic countersteer) move to the assist layer.

### Per domain

- **Airplanes.** Surfaces generated from the same geometry records the model generators use
  (span, areas, tail arms, dihedral, sweep), then solved against the fit cards. This is the
  approach of FlightGear's YASim (geometry plus a solver), chosen over a coefficient table per
  aircraft (JSBSim's approach) because tables for 43 types cannot be sourced.
- **Helicopters.** A rotor element in closed form: thrust and torque from collective and inflow by
  momentum theory with a blade-element thrust coefficient, disc tilt from cyclic and from airspeed
  (flapping), force at the hub above the center of mass, torque reacted by the tail rotor. Hover
  power, translational lift, the pendulum under the rotor, pedal trim changing with power and
  the left-skid-low hover follow from that. Autorotation keeps its energy balance.
- **Cars and trucks.** A six-degree-of-freedom body on four (or more) wheel elements; anti-roll
  as a coupling between a pair of struts; differentials acting on wheel speeds; a clutch or
  torque converter; an analog brake.
- **Two-wheelers.** The same body on two wheels with roll free, tires that make side force from
  camber, and the rider controller. Low-sides, high-sides, wheelies and stoppies become possible;
  whether a rider can actually fall is a design decision, listed below. Motorcycles get
  powertrains and gears.
- **Skis, snowboards, skateboards.** Runner or truck elements whose turn radius comes from edge or
  lean angle. Small, and last.
- **Boats.** Optional: hull sample points on the shared body give heave, pitch and roll from the
  water surface, with a rudder and propeller force. Not needed for the stated goals.

## Phases

Sizes are relative (S, M, L). Each phase ends with the scorecard better and everything else
passing; none depends on a later one.

| # | Phase | Size | What changes | Done when |
|---|---|---|---|---|
| 0 | Trials and ledgers (done) | M | Trial library, card ledgers with sources, `aircraft:trials` and `vehicles:trials`, scorecards, CI budget. No behavior change. | Reference set (below) scored; every reference has a source; today's benches run on the library. |
| 1 | Flight figures within v1's structure (done) | M | Per-type lift curve; propeller efficiency against advance ratio; turbofan thrust lapse; staged fit; per-type roll anchors; helicopter turns about its center of mass and gets a hover-ceiling anchor; takeoff rotation. | Stall, climb, ceiling, glide, top speed and roll-rate cards within tolerance for the reference aircraft, then the fleet. |
| 2 | Shared core (done in part) | M | Rigid body, environment query, substep rule and contact impulse extracted; airplanes and helicopters moved onto it with identical results. | Flight replays and hashes unchanged, or changed only by documented rounding. |
| 3 | Airplane handling (done) | L | Aerodynamic surfaces, control surfaces and trim, the assist layer for airplanes. Opt-in per type. | Short period, phugoid, Dutch roll, spiral, adverse yaw, stall and engine-out cards within tolerance in direct mode; today's behavioral tests pass with the default assist. |
| 4 | Wheels (done within the planar solver) | L | Strut and tire element; cars onto the shared body; driver assists as a layer; then aircraft landing gear on the same element. | Road cards for the reference vehicles; crosswind landing, taildragger and takeoff and landing distance cards. |
| 5 | Two-wheelers and boards (done, riders never fall) | M | Roll freedom, camber thrust, rider controller, motorcycle powertrains; edge model for skis and boards. | Riding cards; a ridden lap of a figure-eight without assist-layer tuning per type. |
| 6 | Rotors (figures only) | L | Rotor element, tail rotor, helicopter assists. | Rotor cards for the OH-6 and one heavier type; the existing helicopter tests pass with the default assist. |

Phases 3 and 4 both need only Phase 2 and can swap. With driving the next ask, running 4 before 3
puts cars first and gives aircraft real landing gear early; running 3 first finishes flight
before starting the road. Phase 1 is worth doing either way: it is the cheapest and moves the most
red cells in the table above.

Reference set for Phase 0, chosen for how well documented each is: Cessna 172S, P-51D, DC-3,
King Air 350, 737-800, F-16, OH-6, UH-60; a mid-size sedan, the 911, the F-150, the Hummer EV, the
city bus, a motorhome; the standard motorcycle, the scooter, the road bicycle, the skis.

## Trial catalogue

Performance cards are mostly fit; handling cards are mostly checks.

| Domain | Performance | Handling |
|---|---|---|
| Airplane | Stall speed clean and landing; top speed at sea level and altitude; best rate of climb and its speed; service ceiling; power-off glide ratio and speed; takeoff roll and distance over 50 ft; landing roll; sustained and instantaneous turn; cruise fuel flow | Roll rate at three speeds and time to 60° bank; short-period frequency and damping; phugoid period and damping; Dutch roll period and damping; spiral time to double; sideslip per rudder; trim change with power and flaps; stall break and wing drop; spin entry and recovery; engine-out minimum control speed; crosswind limit |
| Helicopter | Hover power in and out of ground effect, hover ceilings; top speed; best climb; autorotation descent against speed; rotor decay after engine cut | Attitude response to a cyclic step; pedal turn rate; trim attitude in hover and cruise; pedal position against power; vortex-ring boundary |
| Car, truck, bus | 0–100 km/h, quarter mile, 80–120 km/h; top speed; coast-down; 100–0 km/h dry, wet and snow; skidpad | Understeer gradient (ISO 4138); step steer rise time and overshoot (ISO 7401); double lane change entry speed (ISO 3888-2); roll and pitch per g; braking in a turn; rollover threshold; split-grip braking; curb and jump landing |
| Two-wheeler | 0–100 km/h, top speed, braking distance by brake; bicycle speed at 200 W; coast-down | Maximum lean and cornering g; time to lean and lane change; wheelie and stoppie thresholds; lowest stable speed |
| Skis and boards | Speed on a slope; coasting distance | Carved radius against edge or lean angle |

## Costs and constraints

- **Hashes and replays.** Phases 1 and 3 to 6 change simulation results on purpose. Each re-pins
  the affected `stateHash` values and re-records replays, per type as it migrates. Phase 2 must
  not.
- **Opt-in per type.** A `dynamics` version on the spec lets v1 and v2 types coexist while the
  fleet migrates, so a phase can ship with the reference set alone. The v1 paths are deleted when
  the last type moves, not kept as a mode.
- **Calibration staleness.** Any change to `stepAircraft` or `stepVehicle` makes the stored specs
  stale; the entities build checks that. Every phase ends with `aircraft:calibrate` or
  `vehicles:calibrate`.
- **Asset bundle key.** The calibration modules (`aircraft-performance.mjs`,
  `vehicle-dynamics.mjs`) are imported by model generators, so editing them is likely to rename
  the asset bundle and rerun those generators. Confirm with
  `node scripts/asset-packs.mjs key --explain` before the first edit, and batch edits per phase.
  Moving the fit out of the generators' import graph would remove this coupling.
- **Schema.** New spec fields (surfaces, wheels, struts) are additions. Removing the constants
  they replace waits for the v1 paths to go.
- **Speed.** A dozen surfaces or four wheels per substep is small beside what `stepAircraft`
  already does per substep. Tires on struts are stiff, so cars may need 240 Hz substeps where they
  use 120 today; measure in Phase 4.
- **Hosts.** `stepAircraft` and `stepVehicle` keep their signatures. The Earth view's own vehicle
  kinematics (re-seating standing cars every 200 ms, a fixed 0.33 m tire radius for ground
  support) need review in Phase 4, since a suspended car finds its own height. Ambient traffic and
  ambient aircraft have their own simple agents and are not affected.
- **Feel.** The default assist is tuned to match today's handling before a type switches over,
  with an A/B in one session as for earlier passes.

## What is left

Built differently from the plan, or not built, in rough order of what each would buy:

1. **A wing datum for the taildraggers** (the finding in the follow-up): five airplanes
   cruise nose-high by their ground angle.
2. **Keyboard handling of the direct helicopter.** Keys are full deflection and the swashplate
   is quick (the OH-6 pitches at about 180°/s on a held key). A host could ramp keys into the
   stick, or offer direct cyclic with assisted pedals (`pedalMode: 'assisted'`), which the
   kernel already takes. Neither is wired.
3. **Per-type landing gear dimensions** in the ledger (wheelbase, track, strut travel), and
   the same for helicopter skids.
4. **Vehicles acting on each other**: pushing, a trip over a curb, and sourced rollover
   cards (static stability factors and tilt-table angles).
5. **The CH-47 on rotors**, and the rotor effects listed above.
6. **One environment query** for aircraft and vehicles (the contact impulse is shared; the
   question each asks its host is not).
7. **Falling riders, wheelies and stoppies**, and a truck model for skateboards.
8. **Fly-by-wire control laws** of their own for the types that refuse direct control.
9. **Trim drag and thrust-line pitching** for airplanes; **a clutch and manual gears** for cars.
10. **Sourced handling figures for road vehicles** (understeer and roll gradients, lane-change
    speeds) and any figures at all for the cycles.

Housekeeping the work leaves: the asset bundle key has moved (aircraft, vehicle and cycle type
documents, the ledgers and the calibration scripts are generator inputs), so the next
`pnpm assets:build` reruns those generators. Hosts have a key for direct control of aircraft
(M) and none for cars. The Earth view and the explorer right an overturned car on R.

## Decisions for the owner

These were assumed in order to move through the phases; each is easy to change.

1. **Default feel.** Keep today's hands-off path hold, automatic countersteer and automatic
   balance as the default assist, with direct control as an option? Recommended: yes.
   *Assumed yes.*
2. **Where the option lives.** Per host (Earth view, explorer, Qualla) or per vehicle type.
   *Built as an input field (`controlMode`); the explorer and Earth view toggle it for
   airplanes on M, the helicopter's key. Cars have no key yet.*
3. **Order of Phases 3 and 4**, as above.
4. **Can a rider fall?** Falling needs a figure animation, a remount flow and a rule for
   traffic. The alternative is a rider controller that always saves it. *Assumed: the rider
   always saves it, and the lean is the rider's intended one.*
5. **Tolerances.** Proposed: 5% on performance cards, 20% on handling periods and damping, with
   the evidence class recorded as the aircraft ledger does today.
6. **Sourcing.** References come from flight manuals, type certificates, government reports and
   road tests, with URLs and the existing rights policy. The road ledger currently has no sources
   at all; Phase 0 adds them for the reference vehicles first.
7. **Helicopter controls.** *Decided 2026-11-24: the most realistic physics, with helpers added
   back as needed. Built as: the assist (attitude from the stick, heading from the pedals,
   torque held, rotor protected) is the default and direct control is the bare helicopter.*
   Open: whether M on a keyboard should keep assisted pedals, and whether keys should ramp.
8. **The taildraggers' datum.** Recommended: add it, as its own pass with captures of the five
   airplanes in cruise and on the ground. *Not done.*
9. **How much the takeoff asks of the pilot's feet.** *Assumed: as much as v1 did*, about 3° of
   swing in a Mustang in still air and 9° in a 12-knot crosswind with the pedals left alone.
   The gain is one constant (`GROUND_YAW_DAMPER` in `aircraft.ts`).

## References

Background reading, named from memory. The figures the ledgers cite carry their own sources.

- Nguyen et al., *Simulator Study of Stall/Post-Stall Characteristics of a Fighter Airplane With
  Relaxed Longitudinal Static Stability*, NASA TP-1538 (1979): a complete public F-16 aerodynamic
  model, usable as a check for the surface model.
- Toll, *Summary of Lateral-Control Research*, NACA Report 868 (1947): measured roll rates of
  wartime fighters.
- Stevens and Lewis, *Aircraft Control and Simulation*; Roskam, *Airplane Flight Dynamics*: mode
  approximations and example derivatives for light and transport aircraft.
- Leishman, *Principles of Helicopter Aerodynamics*; Howlett, *UH-60A Black Hawk Engineering
  Simulation Program* (NASA CR, 1981).
- Pacejka, *Tire and Vehicle Dynamics*; Milliken and Milliken, *Race Car Vehicle Dynamics*;
  ISO 4138, ISO 7401, ISO 3888-2.
- Meijaard, Papadopoulos, Ruina and Schwab, *Linearized dynamics equations for the balance and
  steer of a bicycle: a benchmark and review* (2007); Cossalter, *Motorcycle Dynamics*.
- FlightGear YASim and JSBSim, as design precedents only: no code or data is taken from either.
