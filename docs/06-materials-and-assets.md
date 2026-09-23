# 06 — Materials & Asset Pipeline

Resolves brief §4 questions 6 (material graph node vocabulary) and 7 (UV template/sidecar,
texel density, atlas conventions). Schemas in [03-data-formats.md §7–9, 11](03-data-formats.md).

## 1. The capability stack & resolution convention

Six rungs, all targeting standard glTF/three material slots (`MeshStandardMaterial`:
baseColor, roughness, metalness, normal, emissive, ao). Parent projects choose their rungs;
agents use the highest rung they can execute well. The engine ships **no embedded image
assets**.

**`materialRef` rung selection is by extension convention:**

| Ref | Rung |
|---|---|
| `palette:#aabbcc` / `vertex` (inline) | 1 — flat / palette / vertex color (zero-asset baseline, always available) |
| `*.pixelgrid.json` | 2 — text pixel grids |
| `*.svg` (+ optional `*.svg.meta.json`) | 3 — SVG → raster |
| `*.matgraph.json` | 4 — procedural material graphs |
| `*.paint.json` | 5 — UV paint-by-numbers |
| `*.png` / `*.jpg` / `*.ktx2` | 6 — raw bitmap (the escape hatch, never a dependency) |

**Execution placement:** rungs 2–4 resolvers live in renderer-agnostic **`@bendyline/molen-materials`**
(no three.js import), each producing `RGBAImage { width, height, data: Uint8ClampedArray }`
plus PBR slot assignments. The client wraps results in `DataTexture`; tooling writes PNG.
**One code path browser/Node ⇒ identical pixels everywhere ⇒ stable goldens.** Rung 5 is
import-time tooling ([§6](#6-rung-5--uv-paint-by-numbers)), not a runtime feature.

## 2. Rung 2 — text pixel grids (`molen/pixelgrid@1`)

Schema in [03 §7](03-data-formats.md): indexed palette (single code-point keys, ≤64 entries,
`transparent` or `#rgba`) + exactly-sized row strings, max 256².

Normative rasterization: 1 char = 1 texel; nearest mag/min; **mipmaps off** (pixel-art
shimmer beats mud at these sizes); sRGB for baseColor, linear for masks; `transparent` ⇒
`alphaTest: 0.5` cutout. For pixel-art styles, sprites, tiles, decals — textually
authorable, diffable, and correctable by an agent. Validation errors quote row/column and
the palette ([03 §7](03-data-formats.md)).

## 3. Rung 3 — SVG → raster

**Rasterizer: `@resvg/resvg-wasm`, the single implementation in both browser and Node.**
Identical bytes everywhere beats native speed: browser `<canvas>`+`Image` rasterization
differs across platforms/browsers (golden flakiness + a Node gap), and resvg's SVG coverage
is strong with no native deps. (`@resvg/resvg-js` native bindings are a noted optional
Node-only speedup later, behind the same `bakeSvg` API; browser canvas remains a debug-only
fallback.)

- **Sizing priority:** `*.svg.meta.json` sidecar → SVG width/height attrs rounded up to
  power-of-two → **512² default**. POT enforced.
- **Fonts:** the engine ships none. v1 rule: **text must be outlined to paths**; the
  validator rejects `<text>` with the fix in the message. Avoids font licensing and
  cross-machine nondeterminism. (Claude emits path-text well; if signage-with-text turns out
  high-frequency, revisit by bundling one OFL font into tooling —
  [09](09-questions-and-risks.md) Q-list.)
- Rasterization happens at **import time** in tooling, output PNG cached next to source,
  content-hashed; the client can also rasterize lazily at runtime for the inner dev loop.

This is a high-leverage rung: Claude is strong at SVG — signage, UI, decals,
graphic-design-shaped surfaces.

## 4. Rung 4 — procedural material graphs (`molen/matgraph@1`)

### 4.1 Compilation target: CPU-rasterize-to-texture in v1 (firm)

One TS evaluator ⇒ deterministic across WebGL/WebGPU/Node, one set of goldens; outputs are
plain textures feeding standard glTF slots, composing with every other rung and with export;
node semantics stay simple (pure per-texel functions, no shader-stage thinking); and it
neatly sidesteps the GLSL-vs-TSL fork while WebGL is the default renderer
([05 §1.2](05-client-design.md)).

**Cost, accepted:** static textures only — no animated water/lava in v1 (a flyover's water
is a scrolling-UV trick on a static texture). A TSL/GLSL compile backend is a clean later
addition precisely because nodes are already pure per-UV functions. If animated materials
are required in Phase 1, that forces the shader backend early — significant scope
([09](09-questions-and-risks.md) Q8).

Defaults: output 512², cap 2048².

### 4.2 Node vocabulary — 14 nodes, closed set, conservative

| Node | Params (sketch) | Output |
|---|---|---|
| `const` | `value: number \| [r,g,b,a]` | scalar/color |
| `uv` | — (the input coordinate) | vec2 |
| `uv-transform` | `scale, offset, rotateDeg`; input vec2 | vec2 |
| `noise` | `kind: "simplex"\|"value", octaves, lacunarity, gain, scale, seedOffset` | scalar |
| `worley` | `scale, jitter, output: "f1"\|"f2"\|"f2-f1"` | scalar |
| `gradient` | `kind: "linear"\|"radial", angleDeg` | scalar |
| `checker` | `scale` | scalar |
| `bricks` | `rows, cols, mortarWidth, offset` | scalar (mortar mask) |
| `ramp` | `stops: [{t, color}]`; input scalar | color |
| `blend` | `mode: "mix"\|"multiply"\|"add"\|"screen"\|"overlay"`; inputs a, b, factor | color |
| `threshold` | `edge, smoothness` (smoothstep); input scalar | scalar |
| `invert` | — | same as input |
| `levels` | `inMin, inMax, gamma, outMin, outMax` | same as input |
| `height-to-normal` | `strength`; input scalar field | normal-map color |

Every addition to this set is a documentation and AI-legibility cost; grow it reluctantly.
Terrain height/slope splat banding is **not** here — it lives in the terrain layer config
([05 §5.3](05-client-design.md)); graphs remain pure functions of UV.

### 4.3 Determinism rules

Fixed-permutation-table simplex (no `Math.random` ever); graph `seed` → splitmix → per-node
sub-seeds keyed by node id; evaluation order topological by declaration; cycles are a
validation error naming the path ("node 'a' → 'b' → 'a' forms a cycle").

## 5. Rung 1 & 6 (bookends)

- **Rung 1** is built into `@bendyline/molen-client`'s resolver registry: `palette:#rrggbb` flat
  color, `vertex` vertex-color material. Zero assets, always available, the Phase 0 default.
- **Rung 6** raw bitmaps: user-supplied or image-gen-via-MCP. Standard loaders, sRGB/linear
  by slot. The escape hatch — never a dependency.
- **Later-phase (explicitly not planned for early slices):** baked AO/lighting as a
  build-time bake tool.

## 6. Rung 5 — UV paint-by-numbers (Phase 5, import-time tooling)

The flow: auto-unwrap → generate annotated template → an image model paints it → masked,
dilated re-import as baseColor.

### 6.1 Unwrap (`molen uv unwrap`, part of `import_model`)

glTF in → **xatlas (WASM, Node-only inside tooling)** → glTF out with generated UVs.

- **Mandatory mesh-validation pre-pass** (AI-generated geometry *will* trip xatlas): weld
  vertices, drop degenerate triangles, report non-manifold edges — surfaced as actionable
  errors *before* unwrap, never as xatlas crashes.
- UV policy: replace UV0 if missing or *degenerate* (zero-area/overlapping islands detected
  by a pre-check); otherwise keep originals unless `--force`.
- xatlas options pinned: `padding: 4` (gutter texels at reference 1024), `resolution: 1024`,
  `bruteForce: false`. Pin and vendor the WASM build (community-maintained bindings —
  [09](09-questions-and-risks.md) R4).
- Island-count budget warning: >40 islands ⇒ "simplify or merge before painting" (200
  confetti islands are unpaintable).

### 6.2 Template generation (`generate_uv_template`)

Outputs two files:

1. **`model.uvtemplate.png`** — atlas-sized: island interiors filled with distinct flat
   colors from a fixed 32-color legible palette, 1 px dark triangle wireframes, island id
   number at each centroid, thin border ring per island.
2. **`model.paint.json`** — the sidecar ([03 §9](03-data-formats.md)): per island `id`,
   `label` (from mesh/primitive/material names, agent-editable), `color`, `uvBBox`,
   `pixelBBox`, `areaPx`, `meshPrimitive`, and free-text `notes` where the agent writes
   painting instructions for the image model.

### 6.3 Painted-image import (`apply_uv_paint`)

1. **Island masking** — rasterize an island-id map from the UV triangles; zero any painted
   pixel whose id doesn't match (generators slop across boundaries).
2. **Edge dilation** — push each island's border colors outward **8 px at 1024** (scaling
   proportionally) via nearest-valid-texel flood fill, preventing seam bleed under
   mip/bilinear sampling.
3. Write final baseColor PNG + register the `materialRef`; emit a preview render.

### 6.4 Conventions

| Convention | Default |
|---|---|
| Atlas size | **1024²** props/characters; 2048² hero assets; POT only |
| Texel density target | **128 px/m** (stylized engine; photoreal 512+ px/m is overkill) |
| Padding | 4 px @ 1024, scales with resolution |
| Density deviation | warning (not error) when an island deviates >2× from target |

## 7. Models & import generally

- **glTF 2.0 only** (locked). `import_model` is the single front door: parse → mesh
  validation report (triangles, UV islands, warnings) → optional xatlas unwrap → optional
  Draco/KTX2 at a later phase.
- Asset refs in manifests are paths relative to the manifest; the client `AssetRegistry`
  caches by ref; tooling content-hashes derived artifacts (rasterized SVGs, baked graphs)
  next to sources.
