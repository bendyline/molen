# @bendyline/molen-worldgen

Data-driven buildings for Molen: any outline in meters plus a few opaque labels becomes a styled
building, and any labeled polygon becomes deterministic prop placements.

Part of [Molen](https://molen.dev), an AI-legible 3D experience engine: a deterministic headless
kernel, a three.js client, and a dev loop an agent can drive end to end.

## Install

```sh
npm i @bendyline/molen-worldgen
```

Node >= 22.13, ESM only, and no `.` export: import `@bendyline/molen-worldgen/kernel`,
`@bendyline/molen-worldgen/client`, or a pack document from `@bendyline/molen-worldgen/packs/*`.
The client half needs the optional peers `three` (pinned to exactly `0.184.0`) and
`@bendyline/molen-client`; the kernel half needs neither. This package knows nothing about maps —
`@bendyline/molen-worldgen-earth` is the binding that feeds it real map data.

## Use

The kernel half turns requests into typed-array mesh buffers: deterministic, hashable, no
three.js. The client half uploads those buffers.

```ts
// Node or a Worker: the kernel half
import { readFile } from 'node:fs/promises';
import { generateWorldgenBatch, resolveStylePackDocuments } from '@bendyline/molen-worldgen/kernel';

const packUrl = import.meta.resolve('@bendyline/molen-worldgen/packs/default/stylepack.json');
const readDoc = async (rel: string): Promise<unknown> =>
  JSON.parse(await readFile(new URL(rel, packUrl), 'utf8'));
const pack = await resolveStylePackDocuments(await readDoc('stylepack.json'), readDoc);

const out = generateWorldgenBatch({
  pack,
  buildings: [
    // `identity` is caller-owned and opaque; it seeds every look choice for this building
    { identity: 'f:1', labels: ['house'], outline: [[0, 0], [12, 0], [12, 9], [0, 9]], levels: 2 },
  ],
});
out.records[0]?.styleId; // 'molen.worldgen.generic.house', roof 'hip', 810 triangles
out.hash; // sha256 over every output array: equal hashes mean byte-identical geometry
```

```ts
// Page: the client half
import {
  createBuildingObject,
  createVertexColorMaterialSet,
  loadStylePack,
} from '@bendyline/molen-worldgen/client';

const { pack } = await loadStylePack('/worldgen/default/');
const hall = createBuildingObject(
  { identity: 'room:hall-1', labels: ['hall'], outline: [[0, 0], [24, 0], [24, 10], [0, 10]] },
  pack.archstyles['molen.worldgen.fantasy.hall'],
  { name: pack.root.name, version: pack.root.version },
  { materials: createVertexColorMaterialSet() },
);
if (hall) viewer.renderer.worldRoot.add(hall);
```

## What's in it

| Entry point | For |
| --- | --- |
| `./kernel` | The formats (`archstyle`, `scatter`, `stylepack`, `worldgen-batch`, `landmark`), footprint analysis, wings, roofs, walls, facades, the batch generator, interiors, the landmark and sign library, `encodeGlb`, the seed scheme, and the gameplay index (`installWorldgen`, `molen.worldgen.*`). |
| `./client` | Buffers to three.js (`buffersToObject3D`, `createBuildingObject`), instanced placements and their LOD, `ModelLibrary`, interior streaming, material sets, the `worldgenBuilding` entity layer, and `loadStylePack`. |
| `./packs/*` | The default pack: 120 resizable structures in 13 taxonomies, 45 shared materials, scatter rules, landmarks and signs. |

## Authoring the shipped things

The default pack is compiled from copyable logical source bundles under `source/`:

- `source/structures/<style>/` owns one building's catalog definition and recipe or complete
  archstyle;
- `source/landmarks/<landmark>/` owns one landmark definition;
- `source/props/<prop>/` owns one procedural model recipe.

Each directory has a validated `molen/source-bundle@1` `source.json`. Generated runtime documents
and models remain under `packs/default/`. The generic footprint, building, landmark, and mesh
solvers are shared engine capabilities rather than copied into each content bundle.

## Status

0.x, on one fixed version line with every other `@bendyline/molen-*` package. Formats are
versioned and beta, and a pack or style version bump is the only way to re-roll a world (both
participate in every seed). Known limits: windows are surface quads rather than openings, dormers
and setbacks are declared but not built, and pieces clipped at a tile edge get flat roofs.

The default pack ships real chain names, sign designs and storefront treatments so that mapped
real-world places read as themselves; those names and marks belong to their owners, and
[NOTICE](../../NOTICE.md) at the repository root records what is used.

## Docs

- [Worldgen: styled buildings and scatter](https://molen.dev/guide/worldgen)
- [Default structure library](https://molen.dev/guide/structure-library)
- [Recognizable places](https://molen.dev/guide/recognizable-places)
- [Building interiors](https://molen.dev/guide/building-interiors)

MIT © Bendyline LLC
