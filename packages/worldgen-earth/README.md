# @bendyline/molen-worldgen-earth

The Earth binding for Molen worldgen: it adapts `molen/terrain-semantics@1` tiles (Protomaps /
OpenStreetMap footprints and land use) into building and scatter requests, resolves the regional
look from a lon/lat atlas, and plugs the result into the terrain streamer as tile layers.

Part of [Molen](https://molen.dev), an AI-legible 3D experience engine: a deterministic headless
kernel, a three.js client, and a dev loop an agent can drive end to end.

## Install

```sh
npm i @bendyline/molen-worldgen-earth
```

Node >= 22.13, ESM only, and no `.` export: import `/kernel`, `/client` or `/worker`. The region
atlas and business catalog are content, not code: they ship as the `molen.earth` content pack
(see `@bendyline/molen-pack`), published at [molen.dev/packs](https://molen.dev/packs/index.json);
`npx molen pack fetch https://molen.dev/packs/index.json` downloads it into a project.
`@bendyline/molen-terrain` and `@bendyline/molen-worldgen` come with it. The client half also needs
`three` (`>=0.184.0 <0.187.0`, an optional peer) and `@bendyline/molen-client`, which worldgen's
client half uses; the kernel half needs neither.

## Use

The kernel half is a pure adapter: map vocabulary in, generic worldgen requests and mesh buffers
out, no three.js. The client half wires the result into a terrain package's sidecar layers.

```ts
// Worker or Node: the kernel half
import {
  generateWorldgenTile,
  worldgenTileBudgetForQuality,
} from '@bendyline/molen-worldgen-earth/kernel';

// `tile` is a decoded molen/terrain-semantics@1 tile; `geom` is its address and world frame.
// `pack` is a resolved style pack, `atlas` the molen.earth pack's world.atlas.json, and `places`
// createPlacesContent({ landmarks, businesses }) over the packs' documents; without `places`,
// mapped businesses are not recognized.
const out = generateWorldgenTile({
  tile,
  geom,
  ground: heightfield, // the terrain Heightfield, sampled tile-locally
  pack,
  atlas,
  places,
  budgets: worldgenTileBudgetForQuality('balanced', geom.levelBelowMax),
});
out.hash; // the worker and the in-thread path produce byte-identical output
```

```ts
// Page: the client half
import { createProfiledTerrainPackageSemanticLayers } from '@bendyline/molen-terrain/client';
import {
  createRegionResolver,
  createWorldgenSemanticRenderers,
} from '@bendyline/molen-worldgen-earth/client';

// `pack`, `atlas` and `places` as above, read from the style and molen.earth content packs.
const worldgen = createWorldgenSemanticRenderers(pack, {
  atlas,
  places,
  regions: createRegionResolver(atlas, { metersPerUnit }),
  metersPerUnit, // cos(centre latitude): the package's projected frame is metric
});
const { layers } = await createProfiledTerrainPackageSemanticLayers(pkg, {
  baseUrl,
  landcoverLayer: { renderer: worldgen.classification },
  featuresLayer: { renderer: worldgen.humanFeatures },
});
// `layers` goes straight into createTerrainPackagePyramidStream(pkg, { layers, ... }).
```

## What's in it

| Entry point | For |
| --- | --- |
| `./kernel` | The terrain-semantics adapter (`semanticTileToBatch`, `generateWorldgenTile`, one `BuildingRecord` per rendered footprint), OSM label and business mapping (`landcoverLabel`, `buildingLabels`, `createBusinessCatalog`, `createPlacesContent`), the `molen/region-atlas@1` and `molen/business-catalog@1` formats, tile-edge ownership (`analyzeTileEdge`), and per-quality tile budgets. |
| `./client` | `TerrainSemanticTileRenderer` implementations for the classification and human-feature layers (`createWorldgenSemanticRenderers`), the atlas loader, the worker bridge, and the CPU tile cache. |
| `./worker` | `installWorldgenWorker(self)`: bind tile generation to a worker scope. |

## Status

0.x, on one fixed version line with every other `@bendyline/molen-*` package; formats are
versioned and beta. Heights, floor counts and uses recovered from a basemap are estimates, not
records: stock Protomaps merges footprints below zoom 15 and publishes no roof shape or
parent-part relations, so containment is a spatial inference.

This package exists to render third-party map data, and that data's licence and attribution
obligations travel with it — OpenStreetMap-derived tiles included. The `molen.earth` business
catalog also names
businesses whose trademarks remain their owners'; see [NOTICE](https://github.com/bendyline/molen/blob/main/NOTICE.md) at the repo root.

## Docs

- [Worldgen and the Earth binding](https://molen.dev/guide/worldgen)
- [Terrain and world explorer](https://molen.dev/guide/terrain)
- [Recognizable places](https://molen.dev/guide/recognizable-places)

MIT © Bendyline LLC
