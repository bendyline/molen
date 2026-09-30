# Narrow-body airliner

Portable source bundle for `molen.entities.aircraft.airliner`, a 38 m twin-jet for ambient air
traffic: aircraft crossing overhead on straight corridors and approaching or leaving mapped
runways. It is seen from the ground and is not flyable, so it has no `aircraft` component; its
`ambientRole` names the fans that turn and the gear shown on approach.

- Model generator: `models/generate.mjs` (deterministic, no textures; preserves hand edits of
  `models/source.glb`; `--out <path>` writes a review candidate).
- Editable model: `models/source.glb`
- Entity definition: `entity.types.json`
- Imported output: `assets/molen/entities/aircraft/airliner/asset.json`

## Brief

- Silhouette: cylindrical fuselage with nose and tail cones, low swept wings with two
  under-wing engines, swept tailplanes and a tall fin in the livery colour.
- Dimensions: 38 m long, 35.8 m span, about 11.8 m tall with gear down. The origin is the
  fuselage centre and the nose faces +Z.
- Animated nodes: `fan-left`, `fan-right` (spin about Z); `gear-nose`, `gear-left`, `gear-right`
  (visible only on approach).
- Paint: `airliner-livery` (fin and cheatline) takes the agent colour.
- Budget: about 1,300 rendered triangles, 7 materials, no textures. Detail is sized for viewing
  at several hundred metres.

## Evidence

In the engine repository, from `content/entities`:

```sh
node source/aircraft/airliner/models/generate.mjs
npx molen asset import source/aircraft/airliner/models/source.glb --id molen.entities.aircraft.airliner --asset-dir assets/molen/entities/aircraft/airliner --project project.json --force
npx molen asset inspect molen.entities.aircraft.airliner --verify --project project.json
```
