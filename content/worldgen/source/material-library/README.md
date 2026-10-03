# Shared architectural material library

The library contains **67 canonical procedural surface graphs**. Forty-five existing patterns
remain intact. Added surfaces cover painted wood, continuous coated and uncoated metals,
timber, canvas, marble, travertine, raw and weathered limestone, fired clay, ETFE film,
raw basalt, raw sandstone, cast bronze, polished and bead-blasted stainless steel, and four perforated metal patterns. Every graph is a small editable
`molen/matgraph@1` document in `content/worldgen/materials`, authored through
`packages/worldgen/scripts/generate-pack.mjs`.

The [catalog](catalog.json) groups the graphs by family and records physical repeat sizes,
orientation, intended use, texture channels and named color variants. It is authoring metadata;
it is excluded from runtime packs. Material graph references are stable runtime IDs.

![Painted wood, timber, canvas, painted metal and granite, near and repeated](new-surfaces.png)

## Reuse and color

| Appearance | Shared graph suffix | Vertex tint | Repeat, U × V |
| --- | --- | --- | --- |
| Red brick | brick | `#b5785c` | 1.92 × 0.90 m |
| White painted wood | wood_painted_lap | `#eeeae0` | 2 × 1.60 m |
| Green shingled wood | wood_painted_shingle | `#486a56` | 1.60 × 1.60 m |
| Gray green painted steel | metal_painted | `#899b96` | 2 × 2 m |
| Gray dressed granite | stone_granite | `#aaa9a1` | 2 × 2 m |
| Honed white marble | stone_marble | `#e5e2d8` | 2 × 2 m |
| Porous travertine | stone_travertine | `#d4ccb4` | 1.2 × 1.2 m |
| Raw basalt stones | stone_basalt_raw | `#6e736d` | 1.2 × 1.2 m |
| Raw sandstone blocks | stone_sandstone_raw | `#b19886` | 1.2 × 1.2 m |
| Weathered ancient limestone | stone_limestone_weathered | `#c8bfaa` | 1.2 × 1.2 m |
| Smooth ETFE cushions | etfe_film | `#f5f5f3` | 2 × 2 m |
| Natural limestone boulders | stone_limestone_raw | `#c8bfaa` | 1.2 × 1.2 m |
| Individually modeled fired bricks | clay_fired | `#b47554` | 0.8 × 0.8 m |
| Natural timber beams | wood_plain | `#b7a17b` | 2 × 0.25 m |
| Cream sail canvas | fabric_canvas | `#e5ddc6` | 0.25 × 0.25 m |
| Polished stainless steel | metal_stainless_polished | `#d8d9d7` | 1 × 1 m |
| Bead-blasted stainless steel | metal_stainless_beadblasted | `#d8d9d7` | 1 × 1 m |

Every reference uses the prefix `matgraph:molen.worldgen.material.`. The white, cream and blue
wood variants share one painted-lap texture set. Green, white and gray shingles share one
painted-shingle texture set. The tint belongs in vertex colors, so changing a building's color
does not require a duplicated graph, image, GPU texture or per-building material instance.

The base colors contain restrained construction variation and no baked directional lighting.
Normal maps add small surface relief; they do not replace silhouette geometry. Intact painted
steel is dielectric even though its underlying structure is metal. Existing glazing surfaces
retain their own colors and do not take an opaque wall tint.

The two stainless finishes share neutral metallic color and differ in roughness and grain.
They were inspected together on the Spire of Dublin with environment reflections enabled;
its source bundle records the current captures. Use true geometry for large perforations
and distinctive engraved or polished patterns. These material graphs provide surface finish.

## UV and GLB contract

- `repeatMeters` is the real width and height covered by one 0–1 UV repeat.
- Worldgen material parts use `uv: "meters"` and `uvScale: repeatMeters`.
- Static GLBs divide metric surface coordinates by the corresponding repeat exactly once.
- Bind a GLB material through `extras.molenSurface = { ref, slot, uv: "repeats" }`; the encoder's
  material metadata exposes the equivalent `sharedSurface` field.
- Keep core glTF PBR factors and vertex colors as a portable fallback. Shared binding is opt-in;
  unique murals, signage, glass islands and artwork retain their original material treatment.
- U runs along timber grain for `wood_plain`; V crosses it. For lap siding U follows the boards
  and V crosses the courses. For shingles U crosses the shingles and V crosses the exposures;
  on roofs V follows the slope. Canvas U/V follow its yarn directions.
- Do not apply plank seams to individually modeled timbers. Use the seam-free `wood_plain`
  surface. Use the corresponding continuous raw stone surface on individually modeled masonry.
  Coursed surfaces supply the pattern on simpler walls. Raw sandstone keeps subtle horizontal
  sediment grain, and raw basalt supplies isotropic volcanic grain without false seams.
- Use `stone_marble` for marble columns, sculpture and cladding. Its restrained mineral veins
  have no mortar joints; white, rose and green variants reuse the same maps. The [marble swatch](marble.png)
  shows the actual near and repeated base-color pattern.
- Use `stone_limestone_raw` on individually modeled natural limestone boulders and irregular
  blocks. Its continuous fine pores and mottling have no courses; `stone_limestone` supplies
  ashlar joints for plain wall surfaces. The [raw limestone swatch](limestone-raw.png) shows its
  actual neutral graph with a warm vertex tint, at one repeat and repeated over a larger area.

The current viewer prepares registered style-pack surfaces after the first frame and retains
their shared materials/textures until viewer disposal. Evicting a landmark unloads its model
geometry and private fallback materials, while shared library surfaces remain available to
other models. Per-surface demand loading and LRU eviction are future work. The catalog's
RGBA8 memory values are upper-bound estimates with separate maps and mipmaps; they are not
measurements of a graphics driver's allocation.

## Shared texture allocation

The [canonical bake audit](material-texture-audit.json) checks all 65 graphs at their authored
256² resolution. They are distinct surfaces: no complete baked material is duplicated.
Their 21 named tint variants already reuse the underlying maps.

| Allocation estimate for all 65 surfaces | Before constant-channel folding | After |
| --- | ---: | ---: |
| Texture images uploaded | 183 | 125 |
| Base-level RGBA8 texels | 45.75 MiB | 31.25 MiB |
| Full mip-chain RGBA8 texels, upper bound | 61.00 MiB | 41.67 MiB |

49 roughness maps and nine metalness maps are constant in the channel the shader actually
samples. The client replaces them with exact `byte / 255` factors, multiplied by the existing
material factors. This preserves their response without allocating a texture or sampling it.
Base color, normals, transparency and every nonconstant response map remain textures. These
are texel-storage estimates; drivers add their own overhead, and the baker still produces
temporary channel buffers. Cutout surfaces keep linear sampling without mip averaging.

Shared materials/textures are reused across model assets and instances. In the Earth viewer's
fresh GLTF loader, scenes with exclusively embedded bufferView images transfer bitmap
ownership. Replaced portable fallback ImageBitmaps close when no retained scene or borrowed
shared material uses them. URI/data-URI and mixed scenes retain host ownership. Other hosts
can transfer ownership through the constructor's `ownsImageBitmaps` boolean or per-scene
predicate when their loader can prove exclusive ownership.

## Existing texture audit

The latest [GLB inventory](texture-audit.json) records the current source and runtime GLB counts,
image inventory, vertex-color coverage and canonical shared-surface bindings.
The refreshed inventory covers **647 GLBs**, counting editable masters and imported runtime
copies separately. All 647 contain vertex colors; 436 bind canonical shared surfaces. Eight GLBs
contain eight embedded images, representing four distinct image byte sequences and 16,514 bytes
across all copies. Every image is bound as a base-color fallback for a shared surface.

These portable fallback PNGs are generated from the canonical graphs by
`embed-graph-fallbacks.mjs`. They preserve perforated facades in standalone glTF viewers.
The world viewer replaces those private fallback materials with shared graph materials;
the embedded copies are not additional canonical surfaces. The reusable sources remain the
65 procedural graphs, so this audit requires no extraction of new texture artwork.

`packages/worldgen/scripts/audit-structure-textures.mjs` reproduces this inventory, including
per-file hashes, embedded image hashes if any are found, duplicate image groups and shared
surface bindings. Re-running after more models or bindings are authored updates the inventory;
hash equality alone does not authorize replacing unique artwork with a generic material.

The inventory now counts **322 authored masters** separately from their runtime copies:

| Collection | Masters | Masters with shared surfaces | Shared / local material definitions |
| --- | ---: | ---: | ---: |
| Original catalog | 100 | 0 | 0 / 314 |
| Next catalog | 220 | 216 | 769 / 412 |
| Generic map structures | 2 | 2 | 10 / 1 |

These models use 34 canonical graphs; procedural buildings also use the wider library. All
existing shared references, slots and UV0 bindings pass validation. The report exposes
`authoredCoverage.unboundModels`, per-material bindings and repeated local names. A name is
only a review lead: it does not establish the material's substance or authorize replacement.

The 104 wholly unbound masters comprise the original 100 studies plus Normandie, Severn
Bridge, Tokyo Station and Stonehenge. The old studies mix substances in broad slots and use
unit UVs on individual faces. Conversion needs component-level substance assignments and
metric UVs first. Repeated stadium seats/pitches and bridge roads/markings are candidates for
future shared finishes. Preserve the 65 transparent local definitions and unique art while
reviewing those assignments.

## Common authoring adapter

`packages/worldgen/scripts/architectural-surface-authoring.mjs` centralizes explicit graph
selection, physical repeats, metric UV conversion, local exceptions and GLB binding metadata.
The lighthouse and stadium generators use it for 71 existing models, preserving their current
geometry, tint, fallback PBR and generated bytes. Other specialized cylindrical and long-edge
UV mappings remain in their generators until explicitly supported. Unknown graphs, slots and
invalid repeat dimensions fail early. New local materials require an explicit `localRef`.

For example, a repository generator can declare its surfaces once:

```js
import { createArchitecturalSurfaceAuthoring } from './architectural-surface-authoring.mjs';

const surfaces = createArchitecturalSurfaceAuthoring({
  masonry: { graph: 'brick', slot: 'wall', roughness: 0.85, metallic: 0 },
  siding: { graph: 'wood_painted_lap', slot: 'wall', roughness: 0.8, metallic: 0 },
  shingles: { graph: 'wood_painted_shingle', slot: 'roof', roughness: 0.8, metallic: 0 },
});
const builder = surfaces.wrap(meshBuilder);
// Geometry is in meters; color is a per-vertex RGB tint in the builder's color space.
builder.addQuad('siding', '', points, normal, [], color);
const mesh = meshBuilder.finalize();
const glbMaterials = surfaces.materials(mesh.groups);
```

Pass `glbMaterials` to `encodeGlb` with the finalized mesh. The example uses planar metric
projection; use explicit `metric:uv` coordinates when grain or courses must follow a specific
surface direction, and enable `metricTriangleUv` when supplying them to triangles. Fallback
roughness/metallic factors apply to the portable GLB; the shared graph controls the viewer's
surface response. Check a near and repeated view before approving the binding.

The fast `validate-structure-materials.mjs` build gate reads only GLB JSON chunks and checks
all source/runtime bindings against the canonical library. It does not treat UV presence as
proof of correct texture scale or orientation; near/far visual review remains necessary.

## Review and regeneration

- `node packages/worldgen/scripts/generate-pack.mjs` generates graphs and catalog; `--check`
  verifies reproducible output.
- `node packages/worldgen/scripts/preview-materials.mjs --out content/worldgen/source/material-library/all-surfaces.png`
  schema-validates and bakes the current 65 graphs into a near/repeated swatch sheet.
- Add `--ids=wood_painted_lap,wood_painted_shingle,wood_plain,fabric_canvas,metal_painted,stone_granite`
  and use `--out content/worldgen/source/material-library/new-surfaces.png` for that subset.
- `node packages/worldgen/scripts/audit-structure-textures.mjs` refreshes the texture inventory.
- Add `--check` to verify the existing GLB inventory without rewriting it.
- `node packages/worldgen/scripts/audit-material-textures.mjs --out=content/worldgen/source/material-library/material-texture-audit.json`
  validates and bakes the canonical graphs, recording channel hashes, constant factors,
  duplicate channel groups and separate storage estimates. Without `--out`, it prints JSON.

The saved overview sheet covers the earlier 60 surfaces. It and the focused [raw stone sheet](basalt-sandstone-raw.png),
[square perforation / bronze sheet](cutout-bronze.png), [round perforation](round-cutout.png),
[open round perforation](round-open-cutout.png) and [expanded diamond](expanded-diamond.png)
swatches have been visually inspected, as recorded in [qa.json](qa.json).
Swatches check base-color pattern and repetition; they do not prove the normal response,
material scale or orientation on every structure. Review
the model's lit near/far captures after binding. The defaults are stylized deterministic surfaces,
not scanned materials or a claim that maximum fidelity is complete. Painted shingles use regular
widths; grain, granite flecks and weave are limited by 256² resolution. Near-camera texture
fidelity, weathering, irregular substrate detail and geometry-aligned mapping still need review.

## Square perforations and cast bronze

`metal_perforated_square` uses 65.5 mm square alpha apertures on 85 mm centers,
with `alphaCoverage: true`. Metric authored UVs repeat every 0.085 m; cassette folded returns
and structural supports remain geometry. Hole texels are fully transparent. Mipmapped blending
preserves average open area at distance. The neutral map accepts vertex tint. Mordovia Arena
embeds a portable copy baked through the public material CLI with glTF `BLEND`, matching the
shared viewer surface. Inspect overlapping transparent layers from both sides.

`metal_bronze_cast` repeats every 0.25 m and has continuous fine patination and casting pits,
with no sheet seams. Representative roughness and metalness are approximately 0.65.
The earlier hard-cutout revision and bronze were reviewed in [cutout-bronze.png](cutout-bronze.png).
Current coverage filtering is reviewed in the Mordovia Arena source bundle.

## Round perforations

`metal_perforated_round` provides 4 mm round holes on 12 mm centers, with mipmapped fractional
coverage like the square pattern. Current filtering is reviewed in Rostec Arena's source bundle.
`metal_perforated_round_open` provides 9 mm holes on 12 mm centers, approximately 44% open
area for a more transparent shade screen and retains hard alpha cutoff 0.3. Both use neutral
tint and a 0.012 m repeat. The high-open dimensions are a reusable
reconstruction within a published 30–60% facade range, rather than a measured fabrication
schedule. See [round-cutout.png](round-cutout.png) and [round-open-cutout.png](round-open-cutout.png).

## Expanded diamond aluminium

`metal_expanded_diamond` uses staggered elongated diamond alpha apertures with 56% open
area, supported by the [SBP Warsaw roof/facade manual](https://www.pgenarodowy.pl/upload/editor/file/20190911_Zalacznik_2_OPZ_Podrecznik_uzytkownika_konstrukcja_dachu_i_fasady.pdf),
printed page 39. Metric U/V repeats are 0.12 × 0.04 m, a reconstructed 3:1 proportion;
the exact fabrication pitch is not given. Use U along the long diamond axis. Woven facade
strips, edge thickness and frames remain model geometry. The square UV swatch in
[expanded-diamond.png](expanded-diamond.png) displays the unstretched source pattern.
Neutral tint accepts the red and white Warsaw strips without duplicate shared maps.
