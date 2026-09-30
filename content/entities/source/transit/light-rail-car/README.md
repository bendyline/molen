# Light-rail car

Portable source bundle for `molen.entities.transit.lightrail`, a 27 m two-section light-rail
vehicle. Ambient trains run consists of it on mapped rail and tram lines, stopping at stations.
Both cabs are identical, so a consist reverses at a terminus without turning.

- Model generator: `models/generate.mjs` (deterministic, no textures; preserves hand edits of
  `models/source.glb`; `--out <path>` writes a review candidate).
- Editable model: `models/source.glb`
- Entity definition: `entity.types.json`
- Imported output: `assets/molen/entities/transit/lightrail/asset.json`

## Brief

- Silhouette: two body sections joined by a dark articulation, continuous window band, livery
  stripe, a pantograph on the front section and three bogies.
- Dimensions: 27.0 m long, 2.65 m wide, 3.6 m body height over a 0.95 m floor; y = 0 is the rail
  head. The origin is centred and the front faces +Z.
- Nodes: `body`, `pantograph`, `bogie-front`, `bogie-middle`, `bogie-rear`.
- Paint: `rail-livery-body` takes the agent colour; `rail-livery-stripe` stays teal.
- Budget: about 1,500 rendered triangles, 11 materials, no textures.

## Evidence

In the engine repository, from `content/entities`:

```sh
node source/transit/light-rail-car/models/generate.mjs
npx molen asset import source/transit/light-rail-car/models/source.glb --id molen.entities.transit.lightrail --asset-dir assets/molen/entities/transit/lightrail --project project.json --force
npx molen asset inspect molen.entities.transit.lightrail --verify --project project.json
```
