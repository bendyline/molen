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
them. Unit conversions and instrument calibration belong in the asset's bindings, or in a
simulation script for nonlinear/computed readings. Render bindings never write back to physics.

Bindings receive the latest values even if the GLB finishes loading later. Replacing/removing
bindings restores their authored transforms. Signal-driven models stay out of static mesh
batching. Signals take precedence over animation clips on the channels they own; avoid assigning
the same channel to multiple systems. Other clip channels keep animating normally.

Custom hosts can use `createModelSignalVisual(model, spec)` and `readModelSignals(sources,
readComponent)` from `@bendyline/molen-client`. `update(signals)` accepts arbitrary named numeric
telemetry, `reset()` restores the authored pose, and `missingNodes` diagnoses unresolved names.
This is a transform-binding foundation for analog gauges, tapes, levers and moving parts;
text readouts, emissive annunciators and render-to-texture avionics screens are not implemented.

## Source ownership

Vehicle bundles contain `models/source.glb`, `entity.types.json` and `scripts/interactions.ts`.
Aircraft also have `models/interior.json` (gauge positions, labels, sizes, panel, seats, switches
and horizon placement) and `models/interior.mjs` (their local cockpit builder).
`models/generate.mjs` includes that cockpit in the main GLB. Each aircraft can change its
layout and builder independently. All of these files are inventoried by `source.json`.

The five road vehicles have editable GLB interiors. Their current basic dashboard/chassis
geometry is merged into `body`, with a separate steering wheel. Edit these meshes in a DCC
to add cabin detail. There is no universal dashboard fabricated by the runtime.

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
Repeated updates do not accumulate movement. Missing/nonfinite signals leave channels unchanged.
Duplicate names animate together, but GLTFLoader can suffix duplicate GLB names with `_1`;
bind the loaded names explicitly. Two bindings cannot write the same node/property/axis.
`nodes` identifies cabin geometry and never changes its visibility.

Aircraft signals are `airspeed` (m/s), `altitude`/`altitudeAGL` (m), `verticalSpeed` (m/s),
`heading`/`pitch`/`roll` (radians), `rpm`/`power` (0–1), `pitchInput`/`rollInput`/`yawInput`
and `elevator` (-1–1), `gear`/`flaps` (the positions 0–1 as they travel, 0 up), and
`engine`/`brake`/`grounded` (0 or 1). Calibration belongs to each model.
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

## Exterior animation

Landing gear, doors, flaps and control surfaces are bound the same way, in an `animation` block
beside `interior`: `aircraft.spec.visual.animation` or `vehicle.visual.animation`, with the same
`sources` and `bindings` and the same signals. The interior and the animation may not bind the
same node channel.

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
