# Aircraft flight performance

All 53 aircraft have explicit calibration records in [aircraft-performance.json](aircraft-performance.json).
The records distinguish published anchors with estimated test conditions from wholly estimated
anchors. The fictional Bendy Small Airliner has no real-world performance claim. Mass is the
existing authored operating mass, not empty weight or MTOW. No stores or fuel consumption are modeled.

## Reproduce

From the engine repository, after building the library packages:

```sh
pnpm aircraft:calibrate
pnpm aircraft:bench --flight --check --out=.artifacts/aircraft-performance.json
pnpm aircraft:bench --id=f-14d --json
pnpm --filter @bendyline/molen-entities exec vitest run test/flight-bench.test.mjs
pnpm --filter @bendyline/molen-kernel exec vitest run test/aircraft-envelope.test.ts
```

Calibration updates only flight metadata in source type documents, then the aggregate catalog.
It never generates meshes or changes asset locks. The aircraft generator applies the same calibration
function so regenerating a model retains its dynamics. The entities build checks metadata for staleness.

## What the checks establish

The benchmark uses the production kernel without graphics. For fixed wings it computes steady
trim with thrust's vertical component, then finds stable thrust/drag intersections from 5 to 1100 m/s
at sea level, 3, 6, 11 and 15 km. Its optional integrated runs start at 85% of each reference speed
and use a test pilot to hold altitude for 180 seconds. Rotorcraft use a 12-degree disc tilt and
collective altitude hold, with additional 120-second runs at 0, 1.5, 3 and 5 km reporting
whether altitude could be held. This is a cruise experiment, not a maximum-speed measurement.
Without `--flight`, rotorcraft checks are explicitly untested rather than assumed to pass.

The same anchor used to fit a polar is a calibration check, not independent validation.
Independent checks include the DA42 manufacturer's separate 175 KTAS / 75% / 16000 ft condition,
F-22 dry supercruise capability, standard-atmosphere checkpoints, energy/momentum conservation,
wind invariance and timestep convergence. Gear/flap, hot-air, engine-failure, afterburner spool,
rotor vortex-ring onset and both spin directions have behavioral regression tests.

## Physical model and estimated quantities

Jets use thrust, with separate dry/augmented ratings, a throttle detent, spool response,
density lapse and inlet ram recovery. A continuous upper-altitude density-lapse knee prevents
the fitted lower-altitude curve from implying excessive speed above the reference altitude;
its exponent is an estimate, not a measured engine deck. Props use shaft power and efficiency with flat-rated or
naturally aspirated density lapse. Profile/induced/wave drag set equilibrium speed; there are
no velocity caps. Fighter low-altitude Mach anchors constrain lapse independently of the
high-altitude speed anchor, but those low-altitude anchors remain estimates. Civil operating
limits trigger alerts and must not be confused with thrust-limited maximum speed.

Helicopters have governed rotor RPM independent of collective, an actuator-disc shaft-power limit,
profile, parasitic and climb-power costs,
ground/translational lift, density-dependent airframe drag and qualitative vortex-ring and
retreating-blade effects. The estimated retreating-blade speed margin decreases with density
and rotor RPM; the report flags flights beyond that margin even when altitude is held. Twin and
tandem helicopters still have one aggregate engine bank; they do not simulate individual
transmission failures. Rotor efficiency, power ratings, density lapse and blade effects are
estimates. Assisted controls and fixed operating mass are retained.

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

Unmodeled: fuel burn and moving CG, full compressible airfoil tables, aeroelasticity, wake vortices,
icing accretion, structural damage, engine thermal limits, detailed inlet/compressor maps,
blade-element rotor dynamics, autorotation, powered-lift conversion corridors and real flight-control laws.
