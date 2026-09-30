# City bus

Portable source bundle for `molen.entities.transit.bus`, a 12 m low-floor city bus that drives
with ambient traffic. It has no `vehicle` component (it is not drivable and never parks); its
`ambientRole` makes it a bus in the car pool and names the nodes that animate near the camera.

- Model generator: `models/generate.mjs` (deterministic three.js boxes and cylinders, no
  textures). It keeps `source.json`'s pin current and will not overwrite a hand-edited
  `models/source.glb`; `node models/generate.mjs --out /tmp/bus-candidate.glb` writes a review
  candidate instead.
- Editable model: `models/source.glb`
- Entity definition: `entity.types.json`
- Imported output: `assets/molen/entities/transit/bus/asset.json`

## Brief

- Silhouette: long box body, full-height window band with pillars, roof pod over the rear
  engine, flat windscreen with a lit destination sign, two kerb-side glazed doors.
- Dimensions: 12.0 m long, 2.55 m wide, 3.2 m tall; wheels of radius 0.5 m on y = 0; axles
  5.9 m apart. The origin is centred at road level and the front faces +Z.
- Orientation: left is +X; the doors are on the right (-X), the kerb side for right-hand
  traffic. Left-hand-traffic regions still use this model.
- Animated nodes: `wheel-front-left`, `wheel-front-right`, `wheel-rear-left`, `wheel-rear-right`
  (their first child `…-spin` turns); the front pair steers.
- Paint: `vehicle-paint-and-trim` is white and takes the agent colour; glass, trim, tyres and
  lamps keep their own materials.
- Budget: about 1,000 rendered triangles, 9 materials, no textures.

## Evidence

In the engine repository, from `content/entities`:

```sh
node source/transit/bus/models/generate.mjs
npx molen asset import source/transit/bus/models/source.glb --id molen.entities.transit.bus --asset-dir assets/molen/entities/transit/bus --project project.json --force
npx molen asset inspect molen.entities.transit.bus --verify --project project.json
npx molen shot scenes/transit.scene.json --ticks 2 --project project.json --out shots/transit.png
```
