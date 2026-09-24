# 3D model assets

This is the shipped, agent-facing workflow for turning a prompt or supplied model into a textured
Molen asset. It covers the current engine and runs entirely from the published CLI
(`npx molen …` in a project that installs `@bendyline/molen-tooling`). Proposed pipeline
improvements live in the design plan,
[`docs/11-3d-model-assets.md`](https://github.com/bendyline/molen/blob/main/docs/11-3d-model-assets.md), which is historical and
may lag the code.

## What “done” means

A finished model asset has all of the following:

- a valid glTF 2.0 `.glb` or `.gltf` source;
- an imported `molen/asset@1` sidecar and canonical `model.glb`;
- a stable asset id registered in `project.json`;
- meter-scale bounds, useful node/material names, and collision data appropriate to its use;
- textures stored in the project or embedded in the GLB with correct PBR semantics;
- successful asset hash verification, scene validation, and headless simulation;
- inspected turntable images and at least one screenshot of the asset inside a lit Molen scene.

The model-generation tool is deliberately not prescribed. Molen consumes glTF; the only shipped organic generator is
the figures capability ([figures.md](figures.md): stylized humans and animals from a descriptor). A deterministic script is often best for simple props,
buildings, and other parametric hard-surface assets. Use an available DCC or model-generation
capability for shapes that genuinely need sculpting, retopology, rigging, or complex UV work.

For shared polygonal style, fidelity targets and canonical materials, follow [3D art guidelines](3d-art-guidelines.md).

## 1. Convert the prompt into an asset brief

Before making geometry, decide the points that affect the runtime result:

- identity and silhouette: what must make the asset recognizable;
- dimensions in meters and where the origin should sit (usually centered at ground level);
- camera-facing details and which views must hold up;
- realistic, stylized, or low-poly treatment;
- static versus animated, and required animation clip names;
- collision: convex hulls for most moving props, optional trimesh for static concave geometry;
- triangle, material, texture, and download-size budgets;
- stable asset id and owning project. Reserve its namespace first if the id is dotted.

Do not invent requirements that materially change the prompt. Record reasonable assumptions in
the asset README or build report.

## 2. Keep source and runtime artifacts separate

A practical project-local layout follows the [logical source bundle](source-bundles.md) contract:

```text
source/<category>/<asset-name>/
  source.json              # molen/source-bundle@1; inventories every owned source file
  README.md
  models/
    source.glb              # or editable source + export script
  scripts/                  # deterministic generation/conversion, when useful
  textures/
    material-basecolor.png
    material-normal.png
    material-roughness.png
assets/
  <asset-id path>/
    asset.json              # written by molen asset import (+ updated by asset pack)
    model.glb               # canonical design-time model (PNG/JPEG textures, no decoders)
    model.ktx2.glb          # packed runtime variant: KTX2 textures + mipmaps (molen asset pack)
shots/
  <asset-name>/             # turntable and in-scene QA images
```

`assets/` is the runtime contract. `source/` is provenance and reproducibility; Molen does not
serve it. Do not hand-edit an imported sidecar to disguise a stale hash—re-import instead.

For repo examples that should be ready to edit and play, keep both the unoptimized editing master
and imported runtime GLB. Keep any native authoring files and original textures too. In Vite
examples, `public/assets/` is the runtime directory: it is served in development and copied into
`dist/` during normal app builds. Asset generation/import should be an explicit authoring step,
never a requirement for launching a checked-out example. JS bundles in `dist/` remain disposable.

Generators should preserve hand edits before writing any outputs. Record generator baseline
hashes separately from the current imported source hash so an artist can edit and re-import a
master without rewriting its provenance. Verify the current source/runtime relationship with
Node checks; keep Python/DCC reproducibility checks in the optional authoring workflow. The
[Lantern Vault example contract](https://github.com/bendyline/molen/blob/main/examples/ASSETS.md) implements both paths.

## 3. Author geometry for glTF

Use glTF 2.0 conventions and these Molen authoring expectations:

- +Y is up and dimensions are in meters;
- keep the transform scale close to `[1,1,1]` at the intended world size;
- place a ground-standing asset's lowest point near Y=0;
- supply normals and non-degenerate triangle geometry;
- supply UV0 for every material that uses textures;
- give important nodes, meshes, materials, and animation clips stable names;
- prefer a self-contained GLB for reliable serving and capture;
- avoid extensions unless the client has the required decoder configuration.

The importer decodes supported input, then deduplicates, prunes, welds, and quantizes by default.
Use `--no-optimize` only to diagnose a transformation issue. Repeating UVs outside `[0,1]` are
valid, but the optimizer currently leaves those UV accessors unquantized and reports that choice.

## 4. Author textures as material data

For a bitmap generated from a text prompt, ask for an orthographic, seamless surface with flat,
neutral illumination. Explicitly exclude cast shadows, directional highlights, perspective,
vignettes, frames, text, and scenery. Scene lighting should create the shadows; the base-color
texture should not contain them.

Use the standard glTF material meanings:

| Slot | Meaning | Color space / channels |
| --- | --- | --- |
| base color | surface color and opacity | sRGB RGBA |
| normal | tangent-space surface direction | linear RGB; neutral is approximately `[128,128,255]` |
| metallic-roughness | material response | linear; roughness in G, metalness in B |
| occlusion | indirect-light attenuation | linear; occlusion in R |
| emissive | self-lit color | sRGB RGB |

Image generation is well suited to base color or a reference pass. Generate or derive data maps
deterministically when possible; image models do not reliably preserve tangent-space normal or
channel-packing semantics. Prefer power-of-two runtime dimensions such as 1024² for ordinary props
and 2048² for hero assets, subject to the project's texel-density and download budgets. Inspect
seams and mipmapped distance views, not only the source PNG.

For procedural Molen materials and UV paint-by-numbers, see [materials.md](materials.md). Those
tools complement GLB-embedded PBR textures; they do not generate model geometry.

## 5. Import through the project

From inside the asset's Molen project, run:

```sh
npx molen asset import asset-src/red-barn/model-source.glb --id barn.weathered
npx molen asset inspect barn.weathered --verify
npx molen asset list
```

The importer writes
`assets/<id with dots as path>/model.glb`, creates `asset.json`, extracts per-node convex hulls,
and registers the sidecar in the surrounding `project.json`. Add `--trimesh` only when static,
concave collision justifies its extra size. Use `--project <project.json>` when project discovery
from the current directory would be ambiguous.

`asset inspect --verify` must pass before the asset is placed in a scene. Review its bounds,
triangle/vertex counts, material slots, textures, animation clips, extensions, and collision hulls;
“readable GLB” is not enough.

## 6. Pack a runtime variant (KTX2 + mipmaps)

The imported `model.glb` is the **design-time** contract: PNG/JPEG textures that every tool can
open and that render with no decoder hosting. It is not what a shipped game should serve. A PNG
is decoded to uncompressed RGBA8 before upload, so one 2048² texture with mips costs ~21 MB of
GPU memory; the same texture as ASTC/BC7 costs ~5.6 MB. On an iOS or Android webview, where the
page's memory budget is a fraction of a native app's, that 4–8x is what decides whether a scene
fits. `molen asset pack` derives the **runtime** variant:

```sh
molen asset pack barn.weathered          # -> assets/barn/weathered/model.ktx2.glb
molen asset pack --all                   # every registered asset
molen asset inspect barn.weathered       # files.variants.ktx2 now listed
```

Per texture it resizes to a power of two (longest side ≤ `--max-size`, default 2048), encodes
KTX2 (Basis Universal) **with a full mip chain** (the GPU cannot generate mips for compressed
textures), and picks the codec from the material slot: sRGB color maps (baseColor, emissive) use
ETC1S for the smallest download; normal, roughness/metalness, and occlusion maps use UASTC so
data stays near-lossless. `--mode etc1s|uastc` forces one codec; `--no-pot` keeps sizes as
multiples of four instead. The KTX2 file transcodes on the device to ASTC (iOS/Android), BC7/BC1
(desktop), or ETC2, so one file serves every platform.

The variant is recorded in the sidecar (`files.variants.ktx2`); `model.glb` and its hash are
untouched, so `asset inspect --verify` still passes and design-time tools keep working. Packing
is a ship-time step: re-run it after re-importing. Encoding is slow (seconds per 2K texture), so
keep it out of the inner loop.

Verify the packed variant with the same headless captures, which serve the Basis transcoder
automatically:

```sh
molen asset shot barn.weathered --out-dir shots/barn-ktx2 --variant ktx2
molen shot scenes/main.scene.json --out shot.png --variant ktx2
```

Procedural materials (`matgraph:` / `pixelgrid:` refs) are baked at runtime into RGBA8 data
textures and never pass through a file, so packing does not reach them; keep them small.

## 7. Render the asset twice

First capture neutral turntable views:

```sh
molen asset shot barn.weathered --out-dir shots/red-barn --angles 4
```

Then test actual scene integration. Add an entity with a GLTF renderable:

```json
{
  "id": "barn",
  "components": {
    "transform": { "pos": [0, 0, 0], "rot": [0, 0, 0, 1] },
    "renderable": {
      "kind": "gltf",
      "ref": "barn.weathered",
      "shadows": { "cast": true, "receive": true }
    }
  }
}
```

Include an `environment` entity with a shadow-casting sun and non-off shadow tier, plus a ground
primitive with `shadows.receive: true`. Set an explicit camera, then run:

```sh
molen validate scene.json
molen sim run scene.json --ticks 30 --assert checks.json --hash
molen shot scene.json --ticks 30 --size 1280x720 --out shots/red-barn-in-molen.png
```

Look at every PNG. Check silhouette, scale, origin, camera clipping, UV seams, material response,
normal direction, texture repetition, transparent edges, light balance, and cast/contact shadows.
Iterate until the screenshot—not merely the command exit code—matches the brief.

## 8. Host in a browser experience

The default URL provider maps an id like `barn.weathered` to
`assets/barn/weathered/model.glb` beneath the configured base URL. Serve or copy the imported
`assets/` directory without renaming its contents, then enable assets on the client:

```ts
const client = await createClient(link, {
  assets: { baseUrl: new URL('./', location.href).href },
});
```

For custom hosting paths, pass an explicit id-to-model URL index:

```ts
const client = await createClient(link, {
  assets: {
    baseUrl: new URL('./', location.href).href,
    index: { 'barn.weathered': 'static/models/barn/model.glb' },
  },
});
```

Await `client.ready()` before deterministic captures or tests. `molen shot` builds its asset
index from `project.json` automatically.

To serve the packed runtime variants, host three's Basis transcoder (two files from
`three/examples/jsm/libs/basis/`) and tell the client which variant to prefer:

```ts
const client = await createClient(link, {
  assets: { baseUrl: new URL('./', location.href).href, variant: 'ktx2' },
  decoders: { ktx2TranscoderPath: new URL('./decoders/basis/', location.href).href },
});
```

With `variant`, a convention-resolved id fetches `model.ktx2.glb` first and falls back to
`model.glb` when an asset was never packed. Configure `dracoDecoderPath` only when a served asset
uses Draco; canonical imported assets never do.

`molen asset stage` produces the runtime bundle in one step — every registered asset's runtime
files copied under an output directory (same relative layout, so the convention still resolves)
plus `assets.index.json` for the client's `index` option:

```sh
molen asset stage --out-dir public --variant ktx2 --require-variant
```

Staging verifies every sidecar hash first (a stale asset fails the build), ships the packed GLB
in place of the design-time one, and rewrites the staged `asset.json` to describe it, so
`asset inspect --verify` passes on the bundle. Validate, pack, stage is the asset half of a
release build; the app half is the normal Vite build.

## 9. Record evidence

Keep a concise README or machine-readable build report next to the source. Record:

- the original asset prompt and all material-generation prompts;
- geometry and texture generation methods;
- source and imported model hashes;
- triangle, vertex, primitive, material, texture, and animation counts;
- exact import/inspect/validate/sim/shot commands and their outcomes;
- visible QA notes, known compromises, and the final screenshot path.

The runnable library asset
[`assets/structures/red-barn/`](https://github.com/bendyline/molen/tree/main/assets/structures/red-barn) in the engine
repository demonstrates this complete path with three embedded PBR textures and real-time Molen
shadows.
