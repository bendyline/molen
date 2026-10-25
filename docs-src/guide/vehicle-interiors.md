# Vehicle interiors and instruments

Each vehicle owns its cabin in its main GLB. Windows, seats, panels, instruments and controls
are model geometry, visible from outside and from the seated camera. Boarding moves the camera
to the model's authored `pilotEye` or `driverEye`; it does not substitute a cockpit mesh.
Authors can build a warbird, helicopter or airliner flight deck without changing the renderer.

## Platform: simulation data to model geometry

The shared primitive is **model signals**, not a built-in cockpit. Add `model.signals` beside
`renderable` on any entity: a vehicle, a machine with a pressure gauge, or a building with a lift.
The normal client automatically reads the entity's components after snapshots/deltas and poses
the named GLB nodes. No vehicle-specific renderer or per-frame browser script is required.

```json
{
  "renderable": { "kind": "gltf", "ref": "my.airliner" },
  "model.signals": {
    "sources": {
      "engine2rpm": { "component": "avionics", "path": ["engines", 1, "rpm"] },
      "airspeed": { "component": "aircraftState", "path": ["airspeed"] }
    },
    "bindings": [
      { "node": "engine-two-pointer", "source": "engine2rpm", "property": "rotation", "axis": "z", "scale": 0.0015, "offset": -2.3 },
      { "node": "speed-tape", "source": "airspeed", "property": "position", "axis": "y", "scale": 0.001, "max": 0.4 }
    ]
  }
}
```

Sources use explicit path segments, not JavaScript expressions or dot-split strings. Reads stay
on the same entity; numbers are passed through, booleans become 0/1, and missing/nonfinite values
are ignored. Declare custom components such as `avionics` in the scene or type registry;
deterministic entity scripts can publish calculated RPM, sensor values, or switch positions to
them. Unit conversions and instrument calibration belong in the asset's derived signals and
bindings; simulated systems belong in deterministic scripts or kernel code. Render bindings
never write back to physics.

Bindings receive the latest values even if the GLB finishes loading later. Replacing/removing
bindings restores their authored transforms. Signal-driven models stay out of static mesh
batching. Signals take precedence over animation clips on the channels they own; avoid assigning
the same channel to multiple systems. Other clip channels keep animating normally.

Custom hosts can use `createModelSignalVisual(model, spec)` and `readModelSignals(sources,
readComponent)` from `@bendyline/molen-client`. `update(signals)` accepts arbitrary named numeric
telemetry, `reset()` restores the authored pose, and `missingNodes` diagnoses unresolved names.
This supports analog gauges, tapes, levers, moving parts, visibility flags and model-owned
seven-segment readouts. General text layout, changing emissive intensity and render-to-texture
avionics screens are separate capabilities.

## Source ownership

Vehicle bundles contain `models/source.glb`, `entity.types.json` and `scripts/interactions.ts`.
Aircraft also have `models/interior.json` (gauge positions, labels, sizes, panel, seats, switches
and horizon placement) and `models/interior.mjs` (their local cockpit builder).
`models/generate.mjs` includes that cockpit in the main GLB. Each aircraft can change its
layout and builder independently. All of these files are inventoried by `source.json`.

The controllable fleet has model-owned interiors for road vehicles, RVs, cycles, boats, transit
and aircraft. Road dashboard profiles live in `content/entities/source/interiors.json`; the
authoring helpers in `packages/entities/scripts/vehicle-interiors.mjs` build them into the main
GLB. Profiles specify the dashboard generation, instrument arrangement, vents, selector,
steering wheel and trim. MINI's central speedometer, Audi TT's driver-only display, Tesla's
single center screen and commercial-vehicle controls are separate layouts. The five original
editable road masters stay intact; `detailed.glb` removes their solid cabin infill and adds
new seats, enclosed footwells and the authored dashboard while preserving the exterior skin.
There is no dashboard fabricated by the runtime and no reference-photo download in the client.

Photo citations, authors, exact licenses, generation/trim caveats and unfilled reference gaps
are recorded in `content/entities/source/interior-references.json` and its adjacent
`INTERIORS.md`. Prefer a correctly matched CC0/public-domain photo; CC BY and CC BY-SA are
acceptable research references with recorded attribution. Never infer a photo's license from
the Commons site's metadata license, and never treat open source as a blanket license grant.
These models use original polygon geometry rather than photo textures. Embedding a photo or
an adaptation later requires handling that image's attribution and, where applicable,
ShareAlike terms separately from the software license.

Check both the exact seated camera and a wider, downward-looking cabin view. The former proves
sightlines; the latter exposes center-stack, console, door-card and control placement. Leave
daylight through real glazing, preserve animated pivots, and keep abstract display graphics
distinct from live telemetry. A named model is a generation-informed approximation, not a
certified trim-level reproduction; steering side remains the existing fleet convention.

Apply the [vehicle reference overlay goal](medium-fi.md#vehicle-reference-overlays) to the
interior independently of the exterior. Overlay panel drawings and cabin sections with matching
orthographic renders where available; match camera pose and field of view for cockpit photos.
Verify the panel outline, tilt and depth, windshield pillars, console, seats and control reach
before adding labels and small switches. Record calibration and differences, including unknown
depths or variant mismatches. If suitable interior references cannot be found, document the
search and mark the affected geometry as approximate; do not infer approval from exterior QA.

Aircraft generators accept `--out /path/to/candidate.glb` for reviewing changes without
overwriting the master or baseline. Import an approved master with `molen asset import`, update
the source manifest hash, and run the entity package's `generate` command for aggregate types.

## Model-specific bindings

`aircraft.spec.visual.interior` and `vehicle.visual.interior` share this shape:

```json
{
  "nodes": ["flight-deck"],
  "bindings": [
    {
      "node": "left-speed-pointer",
      "source": "airspeed",
      "property": "rotation",
      "axis": "z",
      "scale": 0.023,
      "offset": -2.3,
      "min": -2.3,
      "max": 2.3
    }
  ]
}
```

Bindings add `clamp(signal * scale + offset, min, max)` to a node's authored local transform.
`rotation` uses radians; `position` uses meters (useful for tapes and levers). Limits are optional.
Repeated updates do not accumulate movement. Missing/nonfinite signals hold the last reading by
default; `missing: "rest"` restores the authored pose. A `visible` binding omits `axis`, displays
its node when the calibrated value is positive, and can use `missing: "hide"` to blank it.
Duplicate names animate together, but GLTFLoader can suffix duplicate GLB names with `_1`;
bind the loaded names explicitly. Two bindings cannot write the same node/property/axis.
`nodes` identifies cabin geometry and never changes its visibility.

Aircraft signals are `airspeed`/`trueAirspeed` (true air-relative speed, m/s),
`altitude`/`altitudeAGL` (m), `verticalSpeed` (m/s),
`heading`/`pitch`/`roll` (radians), `rpm`/`power` (0–1), `pitchInput`/`rollInput`/`yawInput`
and `elevator` (-1–1), `gear`/`flaps` (the positions 0–1 as they travel, 0 up), and
`engine`/`brake`/`grounded` (0 or 1). Calibration belongs to each model.
Additional signals are `groundSpeed` (horizontal m/s), `angleOfAttack`/`sideslip` (radians),
`pitchRate`/`rollRate`/`yawRate` (rad/s), `loadFactor` (g), and `stalled`/`crashed` (0 or 1).
Unavailable optional simulation fields stay unavailable. `rpmNormalized` aliases `rpm`.
A single-engine spec also supplies `rotorRpm` in revolutions per minute, calculated from its
configured shaft/rotor angular speed. Engine banks supply `engines.<id>.rpmNormalized`,
`engines.<id>.rotorRpm`, `engines.<id>.failed` and `engines.<id>.thrustN` separately; a missing
engine reading never falls back to another engine.

The Earth host additionally provides `trueHeading` (clockwise from north, radians), `airDensity`
(kg/m³, from the atmosphere used by flight physics) and `staticPressure` (Pa, when weather is
available). The legacy `heading` signal is raw simulation yaw, not a magnetic compass reading.

Cars supply `steering` and `wheelAngle` (radians); their optional third `update` argument accepts
additional signals. World explorer passes `speed` (signed m/s), `heading`/`pitch`/`roll` (radians),
`throttle` (-1–1), `brake` (0 or 1) and the sprung body's `bodyRoll`/`bodyPitch` (radians), which
the car visual also uses to keep its wheels on the road.

An interior can also include `sources`, using the same component/path mappings as `model.signals`.
World explorer resolves these for each vehicle and merges them over the convenience signals,
so an asset can bind a gauge to script-owned state or to an individual engine. Other custom
hosts pass resolved readings as the aircraft visual's optional fourth `update` argument or the
car visual's third argument. Choose the interior adapter or the automatic `model.signals`
component for a given model; do not let two adapters own the same transform channel.
An explicitly declared source that is unavailable overrides a host convenience reading with
missing data. It never silently substitutes the host reading for a missing sensor.

The `createVehicleInteriorVisual(model, spec)` wrapper around model signals is exported from
`@bendyline/molen-client/vehicles`. Its `update(signals)` also accepts custom telemetry names,
such as individual engine readings. Its `missingNodes` reports unresolved bindings; aircraft
and vehicle visuals expose it as `visual.interior`. There is no prescribed instrument count,
node naming scheme or panel layout. This animates model transforms; full avionics/display
rendering is a separate system. Entity scripts can manage simulation state and interactions.

Legacy explicit `controlStick`, `collective` and `steeringWheelNode` bindings work without
`interior`. New models should use `interior.bindings`. The implicit `needle-*`/`attitude-ball`
convention is removed: assets must list instruments explicitly. `airspeedGaugeMax` remains
legacy metadata and no longer drives a gauge.

## Named variables and expressions

Every `interior`, `animation`, or `model.signals` block can declare `derived` variables. Numeric
operands are constants; string operands are signal names. Give intermediate results names to
build a dependency graph. Declaration order does not matter. Formulas are data, with no JavaScript,
property traversal, assignment, clocks, random numbers or simulation side effects:

```json
{
  "derived": {
    "airspeedKnots": { "op": "multiply", "args": ["trueAirspeed", 1.9438444924406048] },
    "altitudeFeet": { "op": "divide", "args": ["altitude", 0.3048] },
    "climbFeetPerMinute": { "op": "multiply", "args": ["verticalSpeed", 196.8503937007874] },
    "gearUnlocked": { "op": "less", "args": ["gear", 0.99] },
    "lowHeight": { "op": "less", "args": ["altitudeAGL", 100] },
    "gearWarning": { "op": "and", "args": ["gearUnlocked", "lowHeight"] }
  },
  "bindings": [
    {
      "node": "speed-pointer", "source": "airspeedKnots",
      "property": "rotation", "axis": "z",
      "keys": [[0, -2.2], [40, -1.5], [80, 0], [160, 2.2]],
      "responseSeconds": 0.2, "missing": "rest"
    },
    {
      "node": "gear-warning-lamp", "source": "gearWarning",
      "property": "visible", "scale": 1, "missing": "hide"
    }
  ]
}
```

This is illustrative calibration and a simple warning rule, not an aircraft-specific operating
limit. Measure the real face's angles and scale markings before supplying its calibration.
The automatic `model.signals` component also requires `sources` mappings for every external
variable; aircraft/vehicle adapters can obtain them from host telemetry instead.

| Operators | Operands and result |
| --- | --- |
| `add`, `multiply`, `min`, `max` | 2–16 numbers |
| `subtract`, `divide` | Exactly 2, in order |
| `clamp` | Value, minimum, maximum |
| `abs`, `sqrt`, `floor` | Exactly 1 |
| `modulo` | Value, positive period; result in [0, period) even for negative values |
| `sin`, `cos`, `atan2` | Angles in radians; `atan2` takes y, x |
| `less`, `greater`, `equal` | Compare 2 values; result 0 or 1 |
| `and`, `or`, `not` | Nonzero means true; `and`/`or` take 2–16 operands, `not` takes 1 |
| `if` | Condition, true value, false value; only the selected value must be available |
| `coalesce` | First available value among 2–16 operands; explicit fallback |

Up to 256 derived variables are allowed per block. Validation rejects cycles, wrong operand
counts, duplicate source/derived names, and undeclared references in the automatic ECS bridge.
Direct adapters report unresolved binding inputs in `visual.missingSignals`; unknown model
nodes are separate in `visual.missingNodes`. Divide by zero, negative square roots, invalid
clamp ranges and nonfinite results produce missing data. Formulas do not silently replace them
with zero. Derived names are local to their block and take precedence over same-named host values;
use distinct names to keep the raw reading available.

`responseSeconds` is the time constant of a first-order response: after one time constant a
step has moved about 63% of the way to its target. Pass **absolute simulation seconds** as the
second argument to `createModelSignalVisual(...).update`, the fifth argument to an aircraft
visual, or the fourth argument to a vehicle visual. The built-in ECS and Earth hosts do this.
First readings, rewinds and recovery from missing data snap to the current reading; a paused
timestamp does not advance a response. Omitting time applies readings immediately. This is
visual response, not instrument failure/lag state stored in the simulation or replay history.

For continuously rotating needles/cards, `period: 6.283185307179586` wraps angular displacement
and filters across the shortest arc. It is only available on rotation channels without min/max
limits. All axes remain in the node's local parent frame: rotate or tilt the gauge assembly in
the model without changing its calibration.

## Reusable instrument wiring

`@bendyline/molen-client/instruments` exports data helpers for model-owned geometry:

- `dialInstrument`: measured, potentially nonlinear reading-to-angle calibration.
- `altimeterInstrument`: separate needles making one turn per 1,000, 10,000 and optionally
  100,000 feet, with continuous wraparound.
- `attitudeInstrument`: a rotating bank frame containing a translating pitch card, behind an
  authored mask and fixed aircraft symbol. Axis, sign, travel and response are configurable.
- `annunciatorInstrument`: a positive reading shows a lamp/flag; missing data hides it.
- `numericInstrument`: a fixed-width unsigned integer on authored seven-segment digit nodes.
  Values are floored; leading zeros are shown. Missing, negative and overflowing values blank
  the display. Each display needs a unique variable prefix when combining its bindings.

These helpers return bindings/spec data; they do not fabricate a dashboard, create textures,
or choose the instrument arrangement. Export their data with the model. Use
`modelSignalDisplacement(binding, reading)` when authoring face markings so tick positions and
needle calibration share the same curve. The module also exports `compileModelSignalExpressions`
for inspecting derived readings without a renderer.

Gauge motion is only as accurate as its measurement. True airspeed is not indicated airspeed;
world Y is not a pressure altimeter with a pilot-set reference; normalized engine RPM is not
turbine N1/N2; sideslip is not a slip/skid ball's lateral specific force. Use correctly modeled
system readings where available, and identify approximations. Never drive fuel, oil pressure,
navigation receivers or clocks from unrelated values just to make a needle move. A future
system can publish those readings through the same component sources without changing the
gauge renderer. See the FAA's [Flight Instruments chapter](https://www.faa.gov/regulationspolicies/handbooksmanuals/aviation/phak/chapter-8-flight-instruments)
for instrument principles and distinctions.

## Exterior animation

Landing gear, doors, flaps and control surfaces are bound the same way, in an `animation` block
beside `interior`: `aircraft.spec.visual.animation` or `vehicle.visual.animation`, with the same
`sources` and `bindings` and the same signals. The interior and the animation may not bind the
same node channel.

Verify motion in physical space, not just a numeric angle. Molen aircraft use +Z forward,
+Y up and +X toward the pilot's left. Positive pitch input means nose up, positive roll
means right wing down, and positive yaw input means right rudder. A pulled yoke moves aft
(negative Z); a vertical stick tilts aft for nose up and toward negative X for right bank.
Right rudder pushes the right pedal forward. For a trailing edge extending along negative Z,
negative X rotation lowers a flap, while positive X rotation raises an elevator. Right bank
lowers the left aileron and raises the right one. These signs assume unrotated model parents;
transform a representative grip or trailing-edge point through the actual hierarchy to verify
both positive and negative commands. Use the referenced full-travel angle, not a generic radian.
Inspect deployed surfaces and moved cockpit controls in current renders as well as checking
their transforms. A neutral-pose overlay cannot validate an animation direction.

A binding can replace `scale` and `offset` with a keyframed curve: `keys` are `[signal,
displacement]` pairs with strictly ascending signals, and the displacement holds the first or
last value outside them. `"ease": "smooth"` eases out of and into every key, the way a hydraulic
actuator starts and stops; the default is `linear`. Keys let one signal sequence several parts.
The P-51's gear position runs from 0 (up) to 1 (down); its inner wheel doors open over the first
and last eighth of that travel and stay open in between, while the legs swing:

```json
{
  "animation": {
    "bindings": [
      { "node": "wheel-door-1", "source": "gear", "property": "rotation", "axis": "x",
        "keys": [[0, 0], [0.12, 1.5], [0.88, 1.5], [1, 0]], "ease": "smooth" },
      { "node": "gear-1", "source": "gear", "property": "rotation", "axis": "x",
        "keys": [[0.12, 1.5708], [0.88, 0]], "ease": "smooth" },
      { "node": "rudder", "source": "yawInput", "property": "rotation", "axis": "y", "scale": 0.44 }
    ]
  }
}
```

Each moving part rotates about one local axis, so the model gives it a parent frame aligned with
its hinge: a canted trunnion, a door's edge. Author the GLB in the at-rest pose (gear down,
doors as they stand on the ground); keys are displacements from it. A model whose retracted parts
would show through the skin can also list them in `visual.gearNodes`, hidden while the gear is
fully up. Simulated gear and flap positions come from `airplane.gearTransitTime` and
`flapTransitTime` (see [Aircraft](aircraft.md)); a script can drive any other part by publishing
a component and naming it in `sources`.

## Exterior views and detail levels

Cockpit and chase views share the GLB. An interior can be a high-detail portion of that model,
but is not inherently a separate LOD: an exterior camera looking through a window needs it too.
World explorer promotes up to eight nearby dormant cars to their GLBs within 14 meters,
retaining detail to 20 meters to avoid repeated swaps. Distant parking proxies remain instanced.
Boarding retains that same GLB for the session. Aircraft already keep their full GLBs resident.
