# Aircraft flight performance

All 54 aircraft have explicit calibration records in [aircraft-performance.json](aircraft-performance.json):
one speed anchor each, with the engine ratings and wing area calibration starts from. The records
distinguish published anchors with estimated test conditions from wholly estimated anchors.
[aircraft-trials.json](aircraft-trials.json) adds the other published figures each type is flown
against (stall speeds, climb, ceiling, glide, roll rate, hover ceilings), each with its source, and
[AIRCRAFT-TRIALS.md](AIRCRAFT-TRIALS.md) is the scorecard of how the fleet does against them.
[DYNAMICS-V2.md](DYNAMICS-V2.md) is the plan this is a part of. The fictional Bendy Small Airliner has no real-world performance claim. Mass is the
existing authored operating mass with full tanks, not empty weight or MTOW. No stores are modeled.
Fuel burns from a per-class estimate of usable capacity (a share of that mass), so long flights
get lighter; the calibration anchors are solved at the full-tank mass.

## Reproduce

From the engine repository, after building the library packages:

```sh
pnpm aircraft:calibrate
pnpm aircraft:trials
pnpm aircraft:trials --ids=cessna_172s,oh6
pnpm aircraft:trials --write
pnpm aircraft:bench --flight --check --out=.artifacts/aircraft-performance.json
pnpm aircraft:bench --id=f-14d --json
pnpm --filter @bendyline/molen-entities exec vitest run test/flight-bench.test.mjs test/trials.test.mjs
pnpm --filter @bendyline/molen-kernel exec vitest run test/aircraft-envelope.test.ts test/trials.test.ts
```

`aircraft:trials` flies every card and prints the ones outside tolerance; `--write` records the
scorecard (`packages/entities/test/trials/aircraft.scorecard.json`, which the entities tests hold
later runs to, and [AIRCRAFT-TRIALS.md](AIRCRAFT-TRIALS.md)). Run it after `aircraft:calibrate`
whenever the flight solver, the calibration or a ledger changes.

Calibration updates only flight metadata in source type documents, then the aggregate catalog.
It never generates meshes or changes asset locks. The aircraft generator applies the same calibration
function so regenerating a model retains its dynamics. The entities build checks metadata for staleness.

## How calibration fits a type

Calibration works in stages, each using figures the earlier stages cannot disturb, so an error
in one quantity is not absorbed by another:

1. **Lift.** The lift-curve slope follows from the wing's aspect ratio. The stall angle and the
   flaps' lift are set so the airplane stalls at its published speeds, clean and landing, at the
   stated weight. No thrust or drag is involved. Without a stall figure the type takes a class
   estimate (greatest lift coefficient 1.5 light, 1.45 transport, 1.6 fighter).
2. **Drag.** A propeller airplane's profile drag comes from its cruise anchor, flown at the
   handbook's share of rated power (`powerFraction`: "75% power at 8,000 ft" is nearly full
   throttle for an unsupercharged engine) with the mixture leaned. A fan-engined airplane's comes
   from its best lift-to-drag ratio, with the drag rise starting just below the cruise Mach
   number. Fighters keep a class profile drag and fit the wave drag to their maximum Mach number.
3. **Thrust.** Propeller thrust follows momentum theory from the propeller's diameter. A
   published rate of climb then fixes what the blades lose when slow (`lowSpeedThrust`); the
   anchor is flown above the speed where all of it is back, so the drag stands. A fan engine
   loses thrust with Mach number by its bypass ratio, and its anchor fixes how much is left at
   altitude. A fighter's sea-level Mach number fixes its altitude lapse, as before.
4. **The idling propeller.** A published power-off glide is steeper than the airframe's own by
   the windmilling propellers' drag: that difference sets `windmillDrag`.
5. **Roll.** A published roll rate sets the ailerons where there is one (the P-51 and F-16);
   otherwise the type holds the helix angle of its class at full aileron (0.08 light, 0.05
   transport, 0.09 fighter), which makes a long wing roll slowly. Roll damping is the wing's own
   lift against the roll inertia.
6. **Helicopters.** Rotor power is the transmission's limit where that is below the engines',
   held as the air thins until the engines have no more. A helicopter whose trial-ledger row
   carries its rotor as built (`rotor`: blade count, chord and tip speed, the tail rotor, and
   where published the hinge offset, Lock number, shaft tilt and inertias, each with a
   `rotor-*` source) gets a `helicopter.rotor` block and flies on it. Ten of the eleven do.
   Four figures of the block are fitted, in turn, on steady flight solved for the rotor: the
   induced-power factor to the hover ceiling out of ground effect, the rotor's ground cushion
   to the ceiling in it, the fuselage's drag area to the cruise anchor, and the mean blade
   lift at which the blades stall (`maxLift`) to the service ceiling. The collective's range
   is then set so the hover sits near half lever. What the fits come to says how well a
   type's published figures agree with its rotor: induced factors of 1.02 (OH-6) to 1.25 are
   what rotors have; the UH-60M needs 1.39, and the Bell 412 and H145 stop at the ideal 1.0.
   The OH-6's drag area comes out at 0.54 m² against a published 0.46.

   The response model's own figures are still fitted first, for the CH-47 and for any spec
   flown without its rotor block: the hover ceiling out of ground effect fixes
   `rotorEfficiency`, the ceiling in it `groundEffect`, the cruise anchor the parasite drag,
   and the service ceiling `liftLimit`, the thrust the rotor can make at sea-level density as
   a multiple of the weight the ceiling is quoted at.

7. **Surfaces.** The tailplane, fin and ailerons an airplane handles by are sized by class from
   its wing and fuselage, not fitted to the type: a tail volume and static margin (which put the
   wing's lift a little ahead of the center of mass), a fin volume with the fuselage's opposing
   yaw, an effective dihedral, a side-force coefficient and a roll radius of gyration. The
   tailplane's setting trims the anchor's cruise with the elevator neutral, and the ailerons
   give the roll rate of stage 5. The class figures are set against published mass properties
   and modes (the C-5A, B-747, F-4C and F-104A of NASA CR-2144, Nelson's Navion). The F-14 and
   the powered-lift types have no surfaces and keep their response constants.

Everything else in the trial ledger is a check: calibration never reads it. At the last
recording 359 of 403 scored cards were within tolerance: 161 of 164 fitted figures, and 198 of
239 checks. Of the checks, 177 are handling cards flown in direct control, 170 of them passing.
(It was 363 before airplanes stood on landing gear and helicopters flew on rotors: the takeoff
and rotor cards below are the difference.)
The checks that fail, and why, are the work list:

- **Propeller ceilings high by 10–30%** (Cessna 172, Baron, DC-3, Beech 18, OV-10). Near the
  ceiling the airplane flies close to the stall, where a parabolic drag polar is too kind.
- **Takeoff rolls long by 15–50% on some types** (Mustang 15%, 182 19%, Baron 26%, Twin Otter
  31%, Bonanza 32%, Cherokee 43%, Porter 50%). Their lift curves need more angle of attack to
  lift off than the attitude limit on the wheels allows, so they leave the runway at 1.2 times
  the stall speed where the handbook technique manages 1.1. The takeoff is flown on the landing
  gear now: the tailplane has to lift the nose wheel, and rolling drag is the tires'. The
  Mustang's roll went from inside tolerance to 15% long (351 m against 305), and the PC-12
  clears its obstacle 17% short of the published distance.
- **Turboprops draggy** (the PC-12 glides 13.6 where the airframe does 16.4; the Q400 climbs 21%
  short). Their anchors fly maximum cruise at takeoff power, more than the real engines give in
  cruise, and the drag fit absorbs the difference.
- **Fighter ceilings high by 13–35%.** Published fighter ceilings are operating limits. Fitting
  the altitude lapse to them was tried and rejected: it needed thrust to fall so fast above
  36,000 ft that several types could no longer go supersonic there.
- **Jet climb rates high** (F/A-18C 20%, CJ4 39%). Published figures are at climb thrust or an
  unstated weight; the CJ4's bypass ratio and lift-to-drag ratio are estimates.
- **Helicopter climb rates.** Climb is the power left over at the best climb speed. Six of
  eleven miss: high where the published figure's weight or power rating is not known and the
  card is flown light at take-off power (H145 96%, Bell 412 64%, CH-47 135%, whose overlapping
  rotors also cost power its single-disc budget does not count), 24% and 25% high on the H125
  and UH-60M, and 13% low on the UH-1H. On the rotor model the OH-6's came inside tolerance
  (1,780 ft/min against 1,860) and the H125's error fell from 39%. Service ceilings are
  fitted, and autorotation descent rates are within tolerance (OH-6 1,530 ft/min against
  1,800, R44 1,450 against 1,350, UH-60M 2,700 against 2,325).
- **The Bell 412's hover ceilings out of ground effect.** Its two published figures (5,200 ft
  at gross weight and 10,400 ft at 4,763 kg) ask for different rotors. The fit ends at its
  bound and reads 2,030 ft and 12,730 ft.
- **Phugoid damping.** The 737, C-5M and MiG-29 damp their phugoid at 0.033 to 0.039, under the
  standard's 0.04. So do the real heavy jets (the B-747 of NASA CR-2144 has 0.032 at sea level
  and Mach 0.45): the standard is met there by the autopilot, not the airframe. The Cessna 182
  damps at 0.11 where the published analysis has 0.075; that analysis holds thrust constant,
  and a propeller at fixed power loses thrust as the airplane speeds up.
- **The C-5M rolls into its steady rate a third quicker than the C-5A** (0.48 s against 0.69 s)
  and its phugoid damps less at the published condition. Its short period (frequency 7% high,
  damping 1% low) and Dutch roll (14% and 19% high) are within tolerance.
- **The DC-3's phugoid is 30% longer than Lanchester's relation gives.** The relation reads
  short of a full analysis by 15% or so on every type; the DC-3's large tail takes it further.

## What the checks establish

The benchmark uses the production kernel without graphics. For fixed wings it computes steady
trim with thrust's vertical component, then finds stable thrust/drag intersections from 5 to 1100 m/s
at sea level, 3, 6, 11 and 15 km. Its optional integrated runs start at 85% of each reference speed
and use a test pilot to hold altitude for 180 seconds. Rotorcraft use a 12-degree disc tilt and
collective altitude hold, with additional 120-second runs at 0, 1.5, 3 and 5 km reporting
whether altitude could be held. This is a cruise experiment, not a maximum-speed measurement.
Without `--flight`, rotorcraft checks are explicitly untested rather than assumed to pass.

Handling is checked on the bare airframe (direct control), each mode by its own procedure:
released 10% fast for the phugoid, two degrees nose-high for the short period, three degrees
out of line with the flight path for the Dutch roll, in a 10° bank for the spiral, and full
aileron from level for the roll mode. Every airplane with surfaces that is not fly-by-wire is
held to MIL-F-8785C's Level 1 limits for cruise at 1.8 times its clean stall speed; the Cessna
182 and the C-5M are also held to published modes at the published condition.

The same anchor used to fit a polar is a calibration check, not independent validation.
Independent checks include the DA42 manufacturer's separate 175 KTAS / 75% / 16000 ft condition,
F-22 dry supercruise capability, standard-atmosphere checkpoints, energy/momentum conservation,
wind invariance and timestep convergence. Gear/flap, hot-air, engine-failure, afterburner spool,
rotor vortex-ring onset and both spin directions have behavioral regression tests.

## Physical model and estimated quantities

Jets use thrust, with separate dry/augmented ratings, a throttle detent, spool response,
density lapse and, for fighters, inlet ram recovery; a fan engine with a bypass ratio loses
thrust with Mach number instead (Torenbeek's lapse). A continuous upper-altitude density-lapse knee prevents
the fitted lower-altitude curve from implying excessive speed above the reference altitude;
its exponent is an estimate, not a measured engine deck. Props turn shaft power into thrust by
momentum theory over the propeller disc, with flat-rated or naturally aspirated density lapse
(an unsupercharged piston loses power a little faster than density, exponent 1.17). Profile/induced/wave drag set equilibrium speed; there are
no velocity caps. Fighter low-altitude Mach anchors constrain lapse independently of the
high-altitude speed anchor, but those low-altitude anchors remain estimates. Civil operating
limits trigger alerts and must not be confused with thrust-limited maximum speed.

Helicopters with a rotor block fly on a rotor solved as a whole disc: blade-element thrust
with a uniform induced flow that follows momentum theory with a lag (and a measured curve in
a descent into its own wake), a blade stall limit that falls with advance ratio, induced and
profile power, quasi-static flapping (the disc tilts back and toward its advancing side, and
follows a turning shaft late), hub moments from the hinge offset, the mast's torque on the
fuselage, a tail rotor of the same kind, a fin and stabilizer, fuselage drag and download,
skids on struts, and a governed rotor speed that droops when more is asked than the gearbox
passes. Not modeled: individual blades and lead-lag, the wake's distortion in forward flight
(the induced flow is uniform over the disc), the tail rotor and fin in the main rotor's wake,
pitch-roll cross-coupling beyond flapping, and separate engines and gearboxes on twins.
Fuselage drag split, download, fin and stabilizer areas and, for most types, inertias and
Lock numbers are class estimates.

The CH-47 keeps the response model: governed rotor RPM independent of collective, an
actuator-disc shaft-power limit, profile, parasitic and climb-power costs, ground and
translational lift, and qualitative vortex-ring and retreating-blade effects. Twin and tandem
helicopters have one aggregate engine bank; they do not simulate individual transmission
failures.

Tail, fin and aileron sizes, dihedral, static margin and inertias are class estimates: an
airplane handles like its class, with its own wing, weight and length, not like its type's
flight-test record. Tailplane and fin act as moments only; their lift and drag are not added to
the airplane's, so trim drag is not modeled. Thrust lines above or below the center of mass do
not pitch the airplane.

Every aerodynamic polar, lapse exponent, unsourced engine rating, surface speed limit and
high-alpha stability coefficient is an estimate. A single cruise point does not constrain climb,
ceiling, takeoff distance or handling throughout the envelope. Several profiles use related-family
references; see each source's `supports` field. Exact variant POHs, engine decks and multi-altitude
flight-test polars remain the next evidence needed for tighter validation.

## F-14 departure

NASA's *Modeling Flight*, printed pages 126–127, describes F-14 susceptibility to post-stall
flat spins and the distinction between incipient recovery and developed spin behavior.
The runtime uses high-alpha loss of directional stability, tail blanking, aileron reversal and
bounded yaw autorotation. A symmetric stall creates no arbitrary yaw. An implicit-midpoint Euler
top prevents the artificial rotational energy growth exposed by the sustained-spin test.

The regression scenario develops roughly 3 rad/s yaw in a nearly flat descending attitude.
That is qualitative behavior, not an F-14D aerodynamic validation or a recovery procedure.
The code does not graft the F-14A's TF30 compressor-stall behavior onto the F110-powered D,
nor model the later digital flight-control system or wing-sweep aerodynamics.

## Sources and rights

The ledger records a URL, rights category and precisely what each source supports. NASA, FAA,
USAF, US Army and US Navy publications are preferred US-government references. Manufacturer
and museum sources supply factual specifications; no source prose, photographs, tables or
third-party simulation code are redistributed. Government hosting of a manufacturer's manual
does not make that manual public domain. Source licenses are not transferred to our original code.

General references:

- [NASA Earth atmosphere](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/earth-atmosphere-equation-english/)
- [NASA thrust equations](https://www.grc.nasa.gov/WWW/K-12/BGP/thsum.html)
- [Aerodynamics for Naval Aviators, FAA-hosted NAVWEPS 00-80T-80](https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/00-80T-80.pdf)
- [NASA Modeling Flight](https://www.nasa.gov/pdf/601262main_ModelingFlight-ebook.pdf)
- [FAA Helicopter Flying Handbook](https://www.faa.gov/sites/faa.gov/files/helicopter_flying_handbook.pdf)

Unmodeled: a center of gravity that moves as fuel burns, full compressible airfoil tables,
aeroelasticity, wake vortices, icing accretion, engine thermal limits and separate climb and
cruise ratings, detailed inlet/compressor maps, blade-by-blade rotor dynamics, powered-lift
conversion corridors and real flight-control laws.
