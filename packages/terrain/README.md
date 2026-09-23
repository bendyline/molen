# @bendyline/molen-terrain

Streamed, LOD'd terrain for Molen: a 16-bit heightfield the simulation can stand on, and chunked
three.js meshes for it — from one island PNG up to a Web Mercator PMTiles package.

Part of [Molen](https://molen.dev), an AI-legible 3D experience engine: a deterministic headless
kernel, a three.js client, and a dev loop an agent can drive end to end.

## Install

```sh
npm i @bendyline/molen-terrain
```

Node >= 22.13, ESM only. There is deliberately **no `.` export**: import
`@bendyline/molen-terrain/kernel` or `@bendyline/molen-terrain/client`. The client half needs the
optional peers `three` (pinned to exactly `0.184.0`) and `@bendyline/molen-client`; the kernel half
needs neither and never touches three.js or the DOM.

## Use

The split is the thing to understand. The kernel half decodes and samples: deterministic, and
hash-affecting once it is the world's ground. The client half meshes and streams: render-only.

```ts
// Worker or Node: the kernel half
import { buildWorld } from '@bendyline/molen-kernel';
import { installTerrain, terrainScriptApi } from '@bendyline/molen-kernel/terrain';
import { generateHeightmapPng, heightfieldFromPng } from '@bendyline/molen-terrain/kernel';

const png = generateHeightmapPng({ size: 513, seed: 7, island: true });
const field = heightfieldFromPng(descriptor, png); // same bytes in Node, a Worker, the browser
field.sampleHeight(256, 256); // bilinear world Y in meters
field.slopeAt(256, 256); // 0 is flat, 1 is vertical

// A Heightfield IS the kernel's structural GroundField, so the character controller, kinematic
// bodies and `molen.terrain.*` scripts all land on it.
const world = buildWorld(scene, setup, {
  terrain: (w) => ({ terrain: terrainScriptApi(installTerrain(w, field)) }),
});
```

```ts
// Page: the client half
import { createViewer } from '@bendyline/molen-client';
import { createTerrainStream, createUrlTerrainTileSource } from '@bendyline/molen-terrain/client';

const viewer = await createViewer({ canvas, cameraFar: 100_000, reverseDepthBuffer: true });
const source = createUrlTerrainTileSource(descriptor, { baseUrl: document.baseURI });
const terrain = createTerrainStream(descriptor, source, { cameraPos: [0, 100, 0] });
viewer.renderer.worldRoot.add(terrain.object);

terrain.update(cameraPosition); // per frame: load, evict, keep border normals continuous
```

## What's in it

| Entry point | For |
| --- | --- |
| `./kernel` | `Heightfield` (`sampleHeight`, `normalAt`, `slopeAt`, `toRapierHeightfield`), PNG16 decode (`heightfieldFromPng`, `heightfieldTileFromPng`, `decodePng16`), seeded heightmap generation, Web Mercator helpers (`wgs84ToWebMercator`, `projectedToWorld`), the `molen/terrain@2` and `molen/terrain-package@1` types, and normalized MVT semantic decoders. |
| `./client` | Chunk meshing (`buildChunkGeometry`, `createTerrainObject`), fixed-grid streaming (`createTerrainStream`), screen-space pyramid streaming over PMTiles packages (`createTerrainPackagePyramidStream`), classification / hydrology / human-feature tile layers, and surface and water materials. |

Only the heightfield sampling and the heightmap generator are hash-affecting and `dmath`-guarded.
The projection, decode and streaming code is not simulation math.

## Status

0.x, on one fixed version line with every other `@bendyline/molen-*` package. Formats are
versioned and beta (`molen/terrain@2`, `molen/terrain-package@1`): a breaking change bumps the
envelope instead of shipping migrations. The projected-Earth runtime is explicitly constrained to
EPSG:3857 with a square root tile matrix, and three.js is pinned exactly.

No map data ships here. When you point this at third-party tiles — OpenStreetMap-derived
Protomaps basemaps included — the source's licence and attribution obligations travel with the
data; see [NOTICE](../../NOTICE.md) at the repository root for the sample data this repo ships.

## Docs

- [Terrain and world explorer](https://molen.dev/guide/terrain)
- [Surface styles and line features](https://molen.dev/guide/surface-rendering)
- [Worldgen and the Earth binding](https://molen.dev/guide/worldgen)
- [Authoring a capability package](https://molen.dev/guide/capability-authoring)

MIT © Bendyline LLC
