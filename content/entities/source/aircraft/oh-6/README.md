# OH-6

![Molen preview](preview.png)

Portable source bundle for `molen.entities.aircraft.oh6`. The entity definition owns all
concrete flight tuning, seats, collision probes, visual bindings, and behavior-script attachment.
Molen supplies the generic `airplane` or `helicopter` solver.

- Editable model: `models/source.glb`
- Model-owned cockpit layout and builder: `models/interior.json`, `models/interior.mjs`
- Instrument/control node names and calibration: `aircraft.spec.visual.interior` in the entity definition
- Model generator: `models/generate.mjs`. It keeps `source.json`'s pin current and will not overwrite a hand-edited `models/source.glb`
- Entity definition: `entity.types.json`
- Behavior: `scripts/interactions.ts`
- Imported output: `assets/molen/entities/aircraft/oh6/asset.json`

The cockpit is part of the main GLB and appears in exterior and seated views. Its layout and
builder can change independently of any other aircraft. Generate an edited preview with
`node models/generate.mjs --out /tmp/oh-6-candidate.glb`; review it before adopting a new master.

In the engine repository, re-import from the repository root with:

```sh
node packages/tooling/dist/cli.mjs asset import content/entities/source/aircraft/oh-6/models/source.glb --id molen.entities.aircraft.oh6 --project content/entities/project.json --force
```

The reference-informed cockpit and exterior pass is documented in [REFERENCES.md](REFERENCES.md).
Instrument parts live in `models/instruments.mjs`. Dial numerals, captions and placards use
Overpass Semibold baked into an antialiased texture atlas, shared by all lettering in the model.
The GLB embeds the atlas; it needs no installed fonts at runtime. The repository helper and
licensed font sources are documented in [cockpit lettering](../../../fonts/README.md).
Cockpit enamel, upholstery and harnesses also use procedural finish textures.

The airframe is built from station tables traced from the Army's station diagram and principal
dimensions figure, and sits about 5 degrees nose-up on its skids as the real aircraft does. The egg
carries one continuous windshield with a slim centre frame, a lower transverse frame at WL 38.64
and the centre ventilating panel. The engine and transmission fairing lands on the boom fairing,
which grows out of the egg with the exhaust low in its aft face. The tail is the original single
right-hand stabilizer raised 25 degrees with one strut to the fin. The main rotor is 26 ft 4 in
across; `spec.helicopter.rotorRadius` stays at its tuned 4.025 m. The cockpit has a small panel on
a centre post, J-shaped cyclics, collectives beside each seat and an aft bench. The pilot's seat
is on the right. See [reference-review.json](reference-review.json) for the measurements.
