# OH-6

Portable source bundle for `molen.entities.aircraft.h500md`. The `h500md` registry ID and source
directory remain stable; the displayed aircraft name is OH-6. The entity definition owns all
concrete flight tuning, seats, collision probes, visual bindings, and behavior-script attachment.
Molen supplies the generic `airplane` or `helicopter` solver.

- Editable model: `models/source.glb`
- Model-owned cockpit layout and builder: `models/interior.json`, `models/interior.mjs`
- Instrument/control node names and calibration: `aircraft.spec.visual.interior` in the entity definition
- Model generator and reviewed edit-protection baseline: `models/generate.mjs`, `models/baseline.json`
- Entity definition: `entity.types.json`
- Behavior: `scripts/interactions.ts`
- Imported output: `assets/molen/entities/aircraft/h500md/asset.json`

The cockpit is part of the main GLB and appears in exterior and seated views. Its layout and
builder can change independently of any other aircraft. Generate an edited preview with
`node models/generate.mjs --out /tmp/oh-6-candidate.glb`; review it before adopting a new master.

Re-import from the package root with:

```sh
node ../tooling/dist/cli.mjs asset import source/aircraft/hughes-500md/models/source.glb --id molen.entities.aircraft.h500md --project project.json --force
```
