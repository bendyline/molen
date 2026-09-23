# P-51D Mustang

Portable source bundle for `molen.entities.aircraft.p51d`. The entity definition owns all concrete flight tuning, seats, collision probes, visual bindings, and behavior-script attachment. Molen supplies the generic `airplane` or `helicopter` solver.

- Editable model: `models/source.glb`
- Model-owned cockpit layout and builder: `models/interior.json`, `models/interior.mjs`
- Instrument/control node names and calibration: `aircraft.spec.visual.interior` in the entity definition
- Model generator and reviewed edit-protection baseline: `models/generate.mjs`, `models/baseline.json`
- Entity definition: `entity.types.json`
- Behavior: `scripts/interactions.ts`
- Imported output: `assets/molen/entities/aircraft/p51d/asset.json`

The cockpit is part of the main GLB and appears in exterior and seated views. Its layout and
builder can change independently of any other aircraft. Generate an edited preview with
`node models/generate.mjs --out /tmp/p-51-candidate.glb`; review it before adopting a new master.

Flight tuning uses 1,264 kW maximum shaft power, 0.83 propeller efficiency, a 14,500 N static
thrust cap, and a clean drag polar of `0.019 + 0.055 * CL²`. The power is approximately
1,695 hp, the rating listed by the [National Museum of the US Air Force](https://www.nationalmuseum.af.mil/Visit/Museum-Exhibits/Fact-Sheets/Display/Article/196263/north-american-p-51d-mustang/).
The drag/control coefficients are game-model tuning, not a reconstruction of flight-test data.
The full-power, clean, altitude-held regression at 1,000 m reaches about 311 knots after
120 seconds from 60 m/s. Gear/flaps still impose substantial drag, and climbing reduces acceleration.

The shared solver progressively separates wing flow past critical incidence and couples assisted
yaw to actual lift plus sideslip stability. Stall recovery is lower nose, add power, level wings,
then gently pull out after speed returns. See `packages/kernel/test/aircraft-performance.test.ts`
in the repository for the reproducible performance and banked-stall scenarios.

Re-import from the package root with:

```sh
node ../tooling/dist/cli.mjs asset import source/aircraft/p-51/models/source.glb --id molen.entities.aircraft.p51d --project project.json --force
```
