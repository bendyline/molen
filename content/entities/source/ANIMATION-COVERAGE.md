# Vehicle mechanism coverage

The animation pass covers **53 aircraft and 123 road vehicles**. The checked inventory is
[animation-coverage.json](animation-coverage.json); regenerate it with
`node packages/entities/scripts/check-animation-coverage.mjs --write`.
After importing, add `--runtime` to check runtime hashes and preservation of animated nodes.
The audit reads the exported GLBs and rejects missing/empty mechanism geometry, competing
transform bindings, stale source pins, absent aircraft controls and missing road mechanisms.
It runs in the entity unit suite. Geometry coverage is not certification of real aircraft kinematics.

## State and operation

Mechanisms are simulation state, not animation clips. `spec.actuators` declares full travel
times; `aircraftInput.actuators` / `vehicleInput.actuators` selects a target from zero to one;
the matching state component records the current position. Reversing a selection travels
from that position. Snapshots include targets, positions and wiper cycle phase. Gear and
flaps retain their existing graduated `gearPosition` / `flapPosition` state.

- Aircraft: proportional pitch/roll/yaw surfaces, flaps or flaperons, propellers/rotors/jet
  turbine stages, retractable gear where fitted, and speed-brake panels or coordinated
  control-surface braking where fitted. The Bendy airliner now has folding gear, a nose
  well door, ailerons, elevators, rudder and wing spoilers.
- Fighters: opening canopies, F-14D and F/A-18C hooks, and graduated brakes. F-14 uses
  one upper and two lower brake leaves. F-35 uses its forward canopy hinge and separate
  canopy fragments for emergency escape. P-51D's bubble and its frame slide aft together
  in the aircraft datum; the windscreen stays attached.
- Helicopters: proportional rotor-disc cyclic tilt, AW139 retractable wheels, and emergency
  blade release. **Blade release is a requested gameplay facility**, not a claim that these
  helicopters have real ejection seats. Released blades stop producing lift. Legacy batched
  two-blade meshes are split outside the hub; individually authored blades retain their shape.
- Road vehicles: individual doors, hood, trunk/hatch/tailgate, paired wipers, and switchable
  emissive headlamp lenses. Sliding minivan doors translate aft; pickup tailgates drop;
  the box truck's rear door follows an overhead segmented path. Motorhomes use cab/entry
  doors, engine/service access and storage hatches. Headlamp state currently changes the
  visible lens, without a new projected light beam.
- Wipers finish their current out-and-back cycle before parking. Emergency release latches;
  ordinary mechanisms can reverse. Entering/leaving a parked car preserves its selections.

Navigation keys in drive/pilot mode: **B** speed brakes, **H** hook, **O** canopy,
**K** wipers, **L** lights, **1–4** individual doors, **5** hood, **6** trunk/rear access.
Only supported controls are applied. Aircraft cockpit control panels expose fractional targets.
Gear/flaps remain **G/F**. World Explorer's in-flight **E** escape starts the release sequence.

## Equipment exceptions

The owner selected real equipment over invented mechanisms. A fixed undercarriage is complete
without a retraction animation; absent speed-brake panels are not added to a real aircraft.

- Fixed gear: Cessna 172S/182T/208B, Cirrus SR22T, PA-28-180, DHC-2/DHC-6, PC-6;
  helicopter skids/wheels except AW139. DC-3 and Beech 18 have retractable mains despite
  being taildraggers; their former fixed-gear metadata has been corrected.
- No dedicated speed-brake channel in this pass: the piston/utility/turboprop fleet
  (including P-51, Baron, Bonanza, DA42, PC-12, King Air, Beech 18, DC-3, C-130J,
  ATR 72 and Q400), MV-22B, and helicopters. Existing lift/roll spoilers on an aircraft
  are not automatically treated as a pilot-operated in-flight speed brake. A400M has
  a speed-brake channel, supported by EASA's published certification material.
- F-22A, F-35A and Rafale use coordinated existing surfaces instead of an invented dorsal
  panel. Their control mixing is simplified and bounded, not a real flight-control law.
- Cabin doors on aircraft, aircraft windscreen wipers, and aircraft landing-light beams
  are outside this pass. Canopy support is recorded per model in the inventory.

## Public reference checks and limits

All meshes remain original procedural geometry. No source pictures, scans, logos or manual
illustrations are embedded. Publicly accessible does not by itself mean public domain.

| Source | What it supports | Application and limits |
| --- | --- | --- |
| [FAA Airplane Flying Handbook, chapter 12](https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/airplane_handbook/13_afh_ch12.pdf) | Retractable-gear operation and ground interlocks | Gear position, transit and conservative weight-on-wheels lock; individual hydraulic linkages remain simplified. US government publication. |
| [NASA SUGAR Phase II report, section 4.4.2.7](https://ntrs.nasa.gov/citations/20140005559) | 737-derived main gear retracts inward | Bendy/737 main-wheel folding direction. This is a NASA-hosted contractor study, not a 737 maintenance manual; no blanket public-domain claim. |
| [NASA TM-104253, table 1](https://ntrs.nasa.gov/api/citations/19920024160/downloads/19920024160.pdf) | F-18 surface travel; speed brake 60 degrees at 20–30 degrees/second | F/A-18C brake uses 60 degrees and 2.4 seconds. Source is the HARV developmental airframe, not a complete C-model kinematic specification. Publication expressly disclaims US copyright. |
| [EASA A400M speed-brake certification deviation](https://www.easa.europa.eu/sites/default/files/dfu/Temp%20Deviation%20D-28%20A400M%20Unnoticd%20Speed%20Brake%20Autoretrctn.pdf) | A400M is fitted with speed brakes | Adds wing spoilers despite its turboprop propulsion. Regulator publication, research reference only. |
| [USAF AC-47 fact sheet](https://www.jbcharleston.jb.mil/About-Us/Fact-Sheets/Article/204592/ac-47-spooky/) | Retractable main wheels and fixed tailwheel in the DC-3 family | Corrects the taildragger/fixed-gear conflation; no new tailwheel retraction. US government publication. |
| [AAF P-51 pilot manual, 15 August 1945](https://aafcollection.com/items/list.php?item=000470) | Historical gear, canopy and control arrangement | P-51 retains its authored main-gear/door rig and receives a sliding bubble. Original government manual; the mirror labels its scan CC BY-NC-SA. Research reference only, no copied assets. |
| [Leonardo AWFamily brochure](https://helicopters.leonardo.com/documents/16114711/32212934/body_BROCHURE_AWFamily_Mk217.pdf?t=1548263523032) | AW139 retractable wheeled undercarriage | Enables its authored gear animation in the helicopter simulation. Manufacturer copyright; reference only. |
| [DLA / USAF F-35 canopy article](https://www.dla.mil/About-DLA/News/News-Article-View/Article/2032569/maintainers-ensure-f-35a-stays-safe-stealthy/) | Canopy fractures during ejection rather than leaving as one intact hood | Separate glass fragments; motion and fragment count are visual approximations. US government article. |

Existing aircraft-specific rigs and each bundle's `reference-review.json` were preserved.
The new gear fallback uses a single hinge and staged well doors; it is not a multi-link
hydraulic reconstruction. Brake panel outlines, canopy sill cuts, turbine blade profiles,
door clearances, and most transit times are medium-fi approximations. F-14/F-16/MiG/Gripen
brake panel geometry and the unreferenced fallback gear paths still need aircraft-specific
maintenance-diagram validation before being described as accurate reproductions.

## Local review and reproduction

`model-sheet.mjs --signals=gear:0.4,gearPosition:0.4,canopy:1,speedBrake:1` applies
the real runtime signal evaluator to the source GLB. `--signals=eject:0.4` inspects release;
car mechanisms use their names directly, e.g. `doorFrontLeft:1,hood:1,trunk:1,wipers:0.5`.
Review fractional and both end states. Source materials/UVs are retained by panel extraction.

Bulk sheets live in ignored `shots/animation-*`; they are local evidence, not build inputs.
Panel cutting leaves triangles outside the actual cut volume intact. The road-model checks
allow a bounded 4,000 additional triangles above the former static-shell budgets for moving
panels and lamp lenses. Extracted skins retain their original livery subtree associations,
so paint and decals continue across doors, hatches and released rotor pieces.
Runtime imports must be refreshed through `pnpm assets:build`. The current build tool stamps
the source-input key automatically; it no longer accepts the historical `--update-lock` flag.

## Validation on 2026-10-29

- All 53 aircraft and 123 road vehicles pass the source/runtime animation audit, including
  hashes, nonempty moving surfaces, supported actuator bindings and imported node preservation.
- The focused kernel suite passes 40 tests, the aircraft/navigation/signal client suite passes
  40, the livery suite passes 8, and schema/component checks pass 24. Reversal tests cover an
  actual airplane and AW139 at 30% gear travel, parked-car operation and snapshot replay.
- The final nine-suite model regression run passes 268 of 270 tests. The two remaining failures
  are the Cherokee forward sightline and obsolete DA42 propeller livery slots. Geometry-budget,
  cockpit-interaction, rotor-structure and brake/control-mixing regressions pass.
- Workspace typechecking, source-bundle checks, shipped schema docs and packed-install smoke
  checks pass. The latter installs 17 tarballs and builds/tests all seven shipped templates.
- The complete repository gate is **not green**: the asset stamp trails ongoing source edits;
  lint reports formatting changes in other model files; docs-site checking requires a refreshed
  P-51 livery preview; golden tests stopped during catalog prebuild. The broader unit run also
  reports parked-car snapshot and plant-topology failures. The aircraft catalog was refreshed
  after regeneration; no claim is made that the golden suite ran.

Detailed local logs are in `.artifacts/animation-*`. Final poses were inspected in
`shots/animation-final-review/`, alongside the earlier full aircraft sheet and ejection views.

## Landing-gear regression review, 2026-10-29

The P-51 regression was a double transform: `visual.gearNodes` selects its leg meshes for
visibility, while their parents already rotate about canted trunnions. The shared fallback
mistook those leaves for hinges and added a second, identical Z rotation to both sides.
The fallback now checks gear-driven ancestors, removes its old duplicate curves on repeat
generation, and upgrades generic hinges only when the builder explicitly marks them.
Authored secondary linkages and aircraft-specific door sequences are preserved.

Two additional defects were corrected during the fleet review:

- **Dash 8-400:** main gear now folds aft instead of inward. The axle stations and track stay
  unchanged; a raked strut/forward trunnion keeps the retracted wheels in the broad nacelle bay
  rather than penetrating its tapered tail. Main-aft/nose-forward folding and enclosing doors
  are documented in De Havilland's publicly accessible
  [DHC-8 Series 400 Aircraft Recovery Manual, section 01-00-00 page 4](https://dehavillandportal.com/assets/public-documents/D8400-ARM.pdf#page=40).
  This manufacturer publication is copyrighted, not public domain; no text or artwork is copied.
  Pivot coordinates and the simplified door geometry remain model-fit approximations.
- **F-16B:** the previous Z hinges swung its splayed main wheels together below the belly.
  Mirrored canted hinges now lift them aft into the fuselage, with clearance between the tyres.
  The extended axle positions are unchanged. The hinge angles are fitted to this model's shell;
  this is a geometric correction, not a claim to reproduce the real multi-link mechanism.

All 53 aircraft were inspected from front/side at gear positions 0, 0.5 and 1. The three
corrected aircraft were also inspected through their imported runtime GLBs at 0, 0.35 and 1.
The remaining fleet review checks visible regressions, not maintenance-level fidelity;
single-link rigs still simplify brace folding and door clearances (including F-14/F-15).
Fixed gear and the intentionally exposed wheels on the DC-3/Beech 18 remain exceptions.

Validation: 130 tests pass across landing gear, animation coverage, aircraft expansion and
transport fit. The landing-gear suite checks actual source/imported wheel geometry, 21 P-51
positions, symmetry, fixed hinge locations, door endpoints, F-16 belly clearance, Dash 8 bay
clearance, and repeated mid-stroke reversals across the fleet. All 176 source/runtime models
pass the animation/hash audit. Repeating the P-51, F-16 and Dash 8 generators reproduced their
GLB hashes; the other six generic-gear models also reproduced after regeneration.

Local evidence: `shots/gear-fleet-{up,half,down}/`, `shots/gear-runtime-{0,0.35,1}/`,
`.artifacts/gear-validation.log` and `.artifacts/gear-reproducibility.json`. For example:

```sh
node packages/entities/scripts/model-sheet.mjs --ids=p-51,dash-8-q400,f-16b --runtime --signals=gear:0.35,gearPosition:0.35 --views=front,side,q3f --out=shots/gear-review --gpu
```

The review tool labels signal values on each sheet and rejects invalid numeric poses, so an
unexpanded shell variable cannot silently produce a misleading bind-pose capture.
