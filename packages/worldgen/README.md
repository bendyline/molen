# @bendyline/molen-worldgen

Data-driven buildings for Molen: any outline in meters plus a few opaque labels becomes a styled
building, and any labeled polygon becomes deterministic prop placements.

Part of [Molen](https://molen.dev), an AI-legible 3D experience engine: a deterministic headless
kernel, a three.js client, and a dev loop an agent can drive end to end.

## Install

```sh
npm i @bendyline/molen-worldgen
```

Node >= 22.13, ESM only, and no `.` export: import `@bendyline/molen-worldgen/kernel` or
`@bendyline/molen-worldgen/client`. The default style pack is content, not code: it ships as the
`molen.worldgen.default` content pack (see `@bendyline/molen-pack`), built from `content/worldgen`
in the repository.
The client half needs the optional peers `three` (`>=0.184.0 <0.187.0`) and
`@bendyline/molen-client`; the kernel half needs neither. This package knows nothing about maps —
`@bendyline/molen-worldgen-earth` is the binding that feeds it real map data.

## Use

The kernel half turns requests into typed-array mesh buffers: deterministic, hashable, no
three.js. The client half uploads those buffers.

```ts
// Node or a Worker: the kernel half
import { openPack } from '@bendyline/molen-pack';
import { generateWorldgenBatch, resolveStylePackDocuments } from '@bendyline/molen-worldgen/kernel';

// Wherever your app keeps the pack: a URL, a file, bytes, or a Blob.
const styles = await openPack('https://example.com/packs/molen.worldgen.default.zip');
const readDoc = (path: string): Promise<unknown> => styles.readJson(path);
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

// A style pack extracted to static files (`molen pack extract`); or resolve one from a content
// pack with `resolveStylePackDocuments`, as above.
const { pack } = await loadStylePack('/styles/default/');
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

## The default content

The default style pack is not in this npm package. It ships as the `molen.worldgen.default`
content pack: 120 resizable structures in 13 taxonomies, 45 shared materials, scatter rules,
landmarks and signs, and the interior catalog. Its source is `content/worldgen/` in the repository, compiled from copyable
logical source bundles under `content/worldgen/source/`:

- `source/structures/<style>/` owns one building's catalog definition and recipe or complete
  archstyle;
- `source/landmarks/<landmark>/` owns one landmark definition;
- `source/props/<prop>/` owns one procedural model recipe.

Each directory has a validated `molen/source-bundle@1` `source.json`. The generated runtime
documents and models sit beside them in `content/worldgen/`, and `molen pack build` turns the
directory into the pack. The generic footprint, building, landmark, and mesh solvers are shared
engine capabilities rather than copied into each content bundle.

## Status

0.x, on one fixed version line with every other `@bendyline/molen-*` package. Formats are
versioned and beta, and a pack or style version bump is the only way to re-roll a world (both
participate in every seed). Known limits: windows are surface quads rather than openings, dormers
and setbacks are declared but not built, and pieces clipped at a tile edge get flat roofs.

The default pack's storefronts are generic: landmark IDs, titles and wordmarks are descriptors
such as `mart_store` and `taco_place`, and emblems are formed from the descriptor's initials, not
from any company's logo. Some color palettes are inspired by real businesses. Real company names
appear only in the `@bendyline/molen-worldgen-earth` business catalog, which uses them to recognize
mapped places and route them to these generic models. [NOTICE](https://github.com/bendyline/molen/blob/main/NOTICE.md) at the repository
root has the full trademark statement.

## Docs

- [Worldgen: styled buildings and scatter](https://molen.dev/guide/worldgen)
- [Default structure library](https://molen.dev/guide/structure-library)
- [Recognizable places](https://molen.dev/guide/recognizable-places)
- [Building interiors](https://molen.dev/guide/building-interiors)

MIT © Bendyline LLC
