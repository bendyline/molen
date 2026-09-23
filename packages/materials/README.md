# @bendyline/molen-materials

Textures without a texture pipeline: pixel grids, SVG rasterizing, and procedural material
graphs, all CPU-baked to plain RGBA images. Pure computation — no three.js, no GPU, no canvas —
and the same document produces the same bytes in Node, a browser and CI.

Part of [Molen](https://molen.dev), an AI-legible 3D experience engine: a deterministic headless
kernel, a three.js client, and a dev loop an agent can drive end to end.

## Install

```sh
npm i @bendyline/molen-materials
```

ESM only, Node >= 22.13. One entry point, usable from a page, a Worker or Node. The SVG rung is
resvg compiled to WASM: in Node the module loads itself, and everywhere else you hand `initSvg`
the bytes or a URL, because no runtime file read is available.

## Use

A material graph is a small node DAG evaluated per UV. Validate it first — that is what applies
the schema's parameter defaults — then bake:

```ts
import { bakeMatGraph, type MatGraphDoc } from '@bendyline/molen-materials';
import { validateByKind } from '@bendyline/molen-schema';

const parsed = validateByKind('matgraph', {
  format: 'molen/matgraph@1',
  size: [256, 256],
  seed: 1337,
  nodes: [
    { id: 'n', type: 'noise', params: { kind: 'simplex', octaves: 5, scale: 6 } },
    {
      id: 'rock',
      type: 'ramp',
      input: 'n',
      params: { stops: [{ t: 0, color: '#3a3f2e' }, { t: 1, color: '#a8a282' }] },
    },
  ],
  outputs: { baseColor: 'rock', roughness: 'n' },
});
if (!parsed.ok) throw new Error(parsed.formatted);

const { slots, meta } = bakeMatGraph(parsed.value as MatGraphDoc);
console.log(Object.keys(slots), meta.filter); // [ 'baseColor', 'roughness' ] linear
```

`slots` holds one `{ width, height, data }` RGBA image per PBR slot, ready to upload as a texture
or write to PNG. Both `bakeMatGraph` and `bakePixelGrid` refuse a document that has not been
through the schema rather than baking a plausible-looking flat texture from missing defaults.

## What's in it

| Export | For |
|---|---|
| `bakePalette(ref)` | rung 1: `palette:#rrggbb` → a solid baseColor image |
| `bakePixelGrid(doc)` | rung 2: `molen/pixelgrid@1` — a palette plus rows of characters, one char per texel, nearest filter, `transparent` becoming an alpha cutout |
| `initSvg(wasm?)` + `bakeSvg(svg, meta?)` | rung 3: deterministic SVG rasterizing |
| `bakeMatGraph(doc)` | rung 4: `molen/matgraph@1` — 14 pure per-UV node types (noise, worley, gradient, checker, bricks, ramp, blend, threshold, levels, invert, height-to-normal, …) to per-slot textures |
| `applyUvPaint` / `maskToIslands` / `dilate` / `rectIslandMap` | rung 5: re-importing a painted UV template, masked to the island map and gutter-dilated |
| `installMaterialBakeWorker` / `createMaterialBakeWorkerPool` | moving bakes off the main thread — exactly the synchronous baker's pixels out |
| `registerMaterialSchemas()` | `molen/matgraph@1` and `molen/pixelgrid@1` register themselves into the shared schema registry on import; this re-runs it explicitly (idempotent) |
| `valueNoise` / `gradientNoise` / `fbm` / `worley` / `createImage` | the primitives the graph nodes are built from |

`@bendyline/molen-client` bakes doc-backed `materialRef`s at load time, and the `molen material
bake` CLI writes them to PNG, so most projects reach this package through one of those rather
than directly.

## Status

0.x, and both document formats are beta (`molen/matgraph@1`, `molen/pixelgrid@1`) — expect node
types and slots to be added, versioned in the envelope rather than migrated. This package is
render-only: nothing it produces enters the simulation state hash. Its real contract is
byte-identical output across Node and the browser, held by a cross-environment golden test.

## Docs

- [Materials](https://molen.dev/guide/materials) — the five authoring rungs and how a bake reaches the renderer
- [Material graph schema](https://molen.dev/schemas/matgraph) — every node type and parameter
- [Pixel grid schema](https://molen.dev/schemas/pixelgrid)
- [API reference](https://molen.dev/api/materials/index)

MIT © Bendyline LLC
