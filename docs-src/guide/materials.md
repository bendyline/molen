# Materials

A stack of authoring modalities, all producing standard textures. Use the highest rung you can
execute well.

## Rung 1 — palette / flat color (always available)

`"materialRef": "palette:#4363d8"` on a renderable component. Zero assets. This is the only rung
the renderer resolves at runtime today; rungs 2–4 are **baked to PNG** with `molen material bake`
and consumed as texture assets (see "From bake to render" below).

## Rung 2 — pixel grid (`molen/pixelgrid@1`)

Pixel-art textures as a palette + rows of characters (one char = one texel, nearest filter,
`transparent` becomes an alpha cutout).

```json
{
  "format": "molen/pixelgrid@1",
  "size": [4, 4],
  "palette": { ".": "transparent", "X": "#222222", "o": "#e6b84a" },
  "rows": [".XX.", "XooX", "XooX", ".XX."]
}
```

An optional `slots` block says which PBR slots the grid fills (default base color only):

```json
"slots": { "baseColor": true, "emissive": true }
```

The bake emits the grid into every enabled slot. A document with every slot disabled is a
validation error, since it would bake to nothing.

`molen validate` checks row count vs height, row length vs width, palette color formats, and that
every char is in the palette — with row/column pinpointed. Bake: `molen material bake icon.pixelgrid.json -o icon.png`.

## Rung 3 — SVG (`.svg`)

Author vector art and rasterize it deterministically (resvg, identical bytes in Node/browser/CI):

```sh
molen material bake badge.svg -o badge.png
```

In Node nothing else is needed: the resvg WASM loads on first use. Everywhere else — a browser
page, a Worker, a bundled app — hand it the WASM yourself before the first bake, because no
runtime file read is available:

```js
import { initSvg, bakeSvg } from '@bendyline/molen-materials';

await initSvg(await (await fetch(wasmUrl)).arrayBuffer());
// or: await initSvg(new URL('@resvg/resvg-wasm/index_bg.wasm', import.meta.url));
```

`initSvg()` with no argument outside Node throws and says exactly this.

## Rung 4 — procedural material graphs (`molen/matgraph@1`)

A small node graph (14 nodes: noise, worley, gradient, checker, bricks, ramp, blend, threshold,
levels, invert, uv, uv-transform, const, height-to-normal) CPU-rasterized to textures. Nodes are
pure per-UV functions, so the same document bakes to the same bytes in Node, the browser, and CI —
held by a cross-environment golden test that compares Node and headless Chromium byte for byte.
Both of those run V8, and the noise and rotation nodes use `Math.sin`/`Math.cos`, so that is
evidence across environments rather than a proof across JS engines; see
[determinism.md](determinism.md#the-levels). Nothing this package produces enters the state hash.

```json
{
  "format": "molen/matgraph@1",
  "size": [256, 256],
  "seed": 1337,
  "nodes": [
    { "id": "n1", "type": "noise", "params": { "kind": "simplex", "octaves": 5, "scale": 6 } },
    { "id": "n2", "type": "ramp", "input": "n1", "params": { "stops": [
      { "t": 0, "color": "#3a3f2e" }, { "t": 0.5, "color": "#6e6a4a" }, { "t": 1, "color": "#a8a282" } ] } }
  ],
  "outputs": { "baseColor": "n2", "roughness": "n1" }
}
```

- Each node has an optional `input` (single upstream node) or `inputs` (named, e.g. blend's `b`).
- `outputs` maps PBR slots (baseColor, roughness, metalness, normal, emissive, ao) to node ids.
- Cycles are a validation error naming the path.

Bake and inspect:

```sh
molen material bake rock.matgraph.json -o rock.png
```

(or the `rasterize_material` MCP tool). Validate first with `molen validate rock.matgraph.json` —
this is required, not advice: baking applies no schema defaults, so an unvalidated graph is
rejected rather than quietly baked into a flat texture.

Full node vocabulary and per-field schema: [schemas/matgraph.md](../schemas/matgraph.md).

## Rung 5 — UV paint-by-numbers (`molen/uvpaint@1`)

For textured models: a sidecar pairs a model with island annotations and a painted template, so a
flat color/paint pass re-imports into the right UV islands (masked + gutter-dilated).

```sh
molen validate scout.uvpaint.json
molen uvpaint apply scout-painted.png --islands scout-islands.png -o scout-tex.png
# (same op over MCP: apply_uv_paint)
```

Schema: [schemas/uvpaint.md](../schemas/uvpaint.md).

## From bake to render

The client resolves materialRefs at load time:

- `palette:#rrggbb` — flat color (sync).
- `matgraph:<path-or-asset-id>` / `pixelgrid:<ref>` — the DOC is the asset: the client loads it
  (through the same provider gltf assets use), CPU-bakes it, and uploads the slots onto a
  `MeshStandardMaterial`. Works in the live client and in `molen shot` (the capture server
  serves the doc). A bad ref falls back to grey with a warning — it never blanks the scene.

`molen material bake` (or `rasterize_material`) still bakes to PNG when you want a static
texture asset or a golden comparison. SVG (rung 3) runs anywhere once `initSvg` has its WASM;
Node is simply the environment that finds it automatically.

