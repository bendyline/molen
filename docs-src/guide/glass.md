# Glass surfaces and crash breakage

Glass is an authored surface with a material, metric dimensions and persistent damage. Fracture
and retention are separate: a windshield can be shattered and still fill its opening. Glass can
belong to a vehicle, a window frame or any other entity with a `transform`.

## Materials and outcomes

| Material | Fracture | What leaves the frame |
| --- | --- | --- |
| `laminated` | Local cracks grow into a dense crack network | Fragments stay together until the frame/interlayer retention fails; then a connected sheet falls |
| `tempered` | The pane fragments once its strength is exceeded | Small granular pieces |
| `annealed` | Brittle fracture | Larger pieces |

These behaviors follow the distinction between toughened and laminated
[automotive glazing](https://my.pilkington.com/en/automotive/automotive-overview/automotive-glazing-processes).
Specify the actual construction: side windows can also be laminated. The material name is not
a claim that a particular vehicle model uses that glass.

## Author a surface

Add a `glass` component beside the vehicle's existing components:

```json
{
  "glass": {
    "crashPulseSeconds": 0.06,
    "surfaces": [{
      "id": "windshield",
      "material": "laminated",
      "center": [0, 1.2, 0.8],
      "rotation": [0, 0, 0, 1],
      "size": [1.4, 0.7],
      "thickness": 0.005,
      "nodes": ["windshield"]
    }]
  }
}
```

The pane lies in its own XY plane; its normal is +Z. `center` and the unit quaternion `rotation`
place it in the owner's frame. Dimensions are meters. The example geometry is illustrative;
measure the model's pane and tilt its normal with the windshield rake.

`nodes` must identify dedicated glass meshes/groups. Never bind the whole car or a mesh combining
glass and body panels. Omit `nodes` to create a rectangular glass pane. A standalone entity with
`transform` and `glass` needs no `renderable`: the standard client creates the glass itself.
Existing fleet models opt in through these authored definitions; transparent materials are not
automatically classified as breakable glass. Curved panes use a rectangular physical/visual
approximation for cracks and granules; retained source geometry and released laminate sheets
keep their authored shape.

## Physics model

`installVehicles` feeds resolved collision changes in linear and angular velocity to each pane.
There is no forward-speed trigger: braking or driving quickly without hitting something does not
break glass. Normal acceleration at the pane includes the contact's yaw impulse. Pane mass is
`density × width × height × thickness`; the default density is 2500 kg/m³. The chassis crash
pulse lasts `crashPulseSeconds`, independently of the tick rate and internal solver substeps.

For a direct contact, normal force is normal impulse divided by contact duration. A reduced
simply supported strip model estimates bending stress:

```text
stress = coefficient × normalForce × shortSpan / (longSpan × thickness²)
coefficient = 1.5 for a centered point load, 0.75 for distributed inertia
```

Point loads approach zero bending at the supported edge. Only the normal portion of impact
energy grows cracks. Effective `strength` defaults to 45 MPa for laminated/annealed and 120 MPa
for tempered glass. Above strength, excess energy accumulates fracture damage against
`fractureEnergy` (default 80 J/m²). Gentle repeated contacts below strength do not accumulate
fracture damage.

Retention has its own `retentionForce` (default 4000 N per meter of pane perimeter) and
`retentionEnergy` (default 3000 J/m² of area). Only loads exceeding the force threshold consume
retention work. Weak mounts can release an intact pane; strong mounts keep shattered laminate
attached. Tempered and annealed fragments leave when the pane shatters.

These are tunable game approximations, not measured vehicle failure limits or a safety/crash
prediction model. They do not resolve laminate plies, edge flaws, temperature, detailed body
deformation or crack-tip propagation. Tune strength and retention against the behavior needed
for the experience.

## Other contacts and scripts

Scene worlds enable `glass-impact` automatically. A physics adapter or script supplies an
already-resolved load to a named pane:

```ts
molen.emit('glass-impact', {
  entity: 'car',
  surface: 'windshield',
  impulse: [0, 0, -80], // owner coordinates, newton seconds
  energy: 120,         // available contact energy, joules
  duration: 0.02,      // physical pulse duration, seconds
  point: [0.1, 0.05]   // contact in pane XY coordinates, meters
});
```

Contact impulse and energy must come from the same contact. Negative energy, non-finite values
and nonpositive durations are rejected; contacts outside the pane are ignored. `velocity` can
supply the owner's world velocity at the pane. Direct contacts add an energy-limited impulse
velocity when glass releases. `distributed: true` describes inertial loading instead and avoids
adding that velocity a second time.

For a manually constructed `World`, call `installGlass(world)` from
`@bendyline/molen-kernel/glass`; it is idempotent. The same module exports `damageGlass`, the pure
`applyGlassImpact`, and `applyGlassCrash` for other chassis solvers. `glass` defines no collider;
non-vehicle physics adapters are responsible for contact detection and for removing or changing
their pane collider when an opening forms. Road vehicles retain their chassis collider.

## State, events and rendering

The kernel writes `glassState.surfaces[id]`: `fracture`, `retained`, fracture `damage`,
`retentionDamage`, `peakStress` in Pa and the crack origin `point`. A released pane also carries
its initial world pose, velocity, energy-limited fragment dispersion and simulation time.
Missing state means intact. Remove `glassState` to repair all panes, or remove a surface's entry
to repair one. State and release timing survive checkpoints, replay and late model loading.

Transitions emit `glass-cracked`, `glass-shattered` and `glass-released` once, after the state is
written. A contact can emit all three. Payloads include `entity`, `surface`, `material`, `stress`
and `retained`; sound and gameplay can subscribe without changing the fracture solver.

The standard client and Earth vehicle host consume the components. Custom hosts can call
`createGlassVisual(model, glassData)` from `@bendyline/molen-client/glass`, then
`update(glassState, simulationSeconds)`. Call `dispose()` before releasing the model. Vehicle
hosts can instead pass `glassData` as the fourth argument to `createVehicleVisual`, and
`glassState` as the fifth argument to its `update` method.

Laminated cracks stay attached; released sheets and small fragments inherit motion and fall
under gravity. Debris is cosmetic, has no rigid-body collisions and expires after eight seconds.
The renderer caps a fragmented pane at 96 cells and uses simulation time, so seeking does not
spawn duplicate particles. Source GLB geometry and shared materials are never edited.
