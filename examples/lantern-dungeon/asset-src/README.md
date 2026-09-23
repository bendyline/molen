# Lantern Vault art source

The vault ships **28 self-contained glTF 2.0 models**: six creatures, eight architectural
modules, and fourteen props/items. [Browse the illustrated catalog](CATALOG.md).
Every model is placed in the playable scene and registered through Molen's normal
`molen/asset@1` sidecars and project index.

## Editing masters and published models

Both sets of GLBs are kept intentionally. Each
`<category>/<thing>/models/source.glb` is an unoptimized file ready to open in an editor, and its
sibling `source.json` inventories the complete per-thing source bundle. `../public/assets/`
contains the optimized game copies. The browser serves only the latter. See the
[shared example contract](../../ASSETS.md) for the full layout and startup rules.

For a direct model edit, save/export back to the thing's `models/source.glb`, run `assets:import`,
then `assets:verify`.
The import report uses the file's actual hash and records whether it differs from the last
generator output. It does not overwrite the master or require Python. Keep additional native
editor files alongside these masters if you create them.

## Brief and method

Original stylized dungeon art: carved limestone, cold slate and lichen, aged brass and iron,
indigo cloth, ivory bones, warm flame and teal soul glass. Creature silhouettes should read
from the front at combat distance; dungeon surfaces should hold up at first-person eye height.
The geometry uses meters, +Y up, and creatures face -Z. Modules fit a three-meter XZ grid.
Standing creatures are about 1-2 meters tall; props use plausible dimensions. Model budgets
are under 6,500 triangles each and under 6 MiB for the entire imported collection.

`tools/generate-assets.py` authors actual beveled meshes, tapered solids, lathed profiles,
curved bones, thick wing membranes, named material groups, UVs and normals. It writes GLBs
without Blender, a private package import, an API key, or an external modeling service.
Python and the declared Pillow version are needed only to regenerate source models/textures;
the checked-in GLBs run directly in the game. No third-party model packs were used.

Creature motion uses small rigid-node clips (breathing, hovering and wing flaps), rather than
skinned locomotion or attack rigs. The sword has an `attack` clip that returns to its rest pose.
Its `startTick` comes from an accepted simulation command. Restart freezes the rest pose;
the next accepted attack starts a fresh clip. The knight, wraith and mossback are the three
active combatants. The bat, gargoyle and imp are animated ambient set dressing in side rooms.

The suspended portcullis deliberately retains its center pivot for the existing gate tween.
Floor origins lie at the walkable surface, with their thickness below zero. The ceiling's
origin is its mounting plane. The sword origin is the bottom of its grip. Other standing
models are grounded near Y=0. Wall instances stretch vertically by 1.16 to meet the ceiling.
The separate [gallery scene](../asset-gallery.json) normalizes display sizes on plinths;
it is a presentation scene, not a meter-scale comparison.

## Material provenance

`textures/limestone-source.png` is unmodified generator output — a text-to-image model's result
for the prompt below, generated for this task on 2026-09-05 and kept at the resolution it returned,
with no hand painting or retouching.

| | |
| --- | --- |
| File | `shared/textures/limestone-source.png` |
| Size | 1254 × 1254 PNG, 3,137,449 bytes |
| SHA-256 | `63a4b092e5d459d97452e7243246493546bd4012cac698eb26e35459ef54296d` |
| State | Unmodified generator output |
| Generated | 2026-09-05 |
| Prompt | Verbatim below |

Generated with OpenAI's ChatGPT image generation, requested by Bendyline for this repository; the
exact model version was not logged at generation time. OpenAI's terms of use assign ownership of
output to the user who generated it, so no third-party license or attribution obligation attaches:
this file is covered by the repository's MIT [LICENSE](../../../LICENSE) like the rest, and so are the
maps derived from it and the GLBs that embed them. Recorded in the root [NOTICE](../../../NOTICE.md) §5.

Everything downstream of the source image is recorded and reproducible. The runtime maps
(`shared/textures/limestone-basecolor.png`, `shared/textures/limestone-normal.png`,
`shared/textures/limestone-metallic-roughness.png`) are derived
deterministically by `tools/generate-assets.py` and their hashes are pinned in
[catalog.json](catalog.json); they are not separate generator results. The geometry is authored by
that script — no third-party model packs, no scanned or photographic textures.

### Prompt

The prompt the generator was given:

> Create one seamless tileable square PBR BASE COLOR texture for a stylized dark fantasy dungeon: weathered grey limestone, subtly warm ivory mineral flecks, cool grey pores, fine pitting, hairline cracks and restrained pale lichen. It is the SURFACE OF A SINGLE CONTINUOUS SLAB OF STONE, no brick pattern, no mortar lines, no large borders. Hand-painted but materially believable, elegant stylized game art, subdued mid-value grey with subtle color variation. Orthographic flat scan filling the entire square edge to edge, completely neutral diffuse albedo only. NO lighting direction, NO cast shadows, NO highlights, NO ambient occlusion, NO perspective, NO objects, NO text, NO vignette. The left/right and top/bottom edges must tile seamlessly. Output 1024x1024.

The returned image is retained at its original resolution. Pillow creates a 256-square runtime
albedo and derives a subtle tangent-space normal map from periodic luminance differences.
The metallic-roughness image stores roughness in G and zero metalness in B. These are surface
approximations derived from the albedo, not measured scans. All three maps are embedded in each
stone-using GLB. Material tints create the slate and moss variants. Other materials use glTF
PBR factors and emissive colors. Texture repetition and bevels were checked in close dungeon
views. Runtime maps are intentionally compact; increase their size in the generator for a
higher texel budget.

## Regenerate and import

From the repository root, build Molen first (`pnpm -r build`), then:

```sh
python -m pip install -r examples/lantern-dungeon/tools/requirements.txt
pnpm --filter @bendyline/molen-examples-lantern-dungeon assets:generate
pnpm --filter @bendyline/molen-examples-lantern-dungeon assets:check
pnpm --filter @bendyline/molen-examples-lantern-dungeon assets:import
```

`assets:generate` preflights all existing outputs before writing. Hand-edited models and maps
are preserved; use `assets:generate --out-dir .tmp/generated-art` to create a separate review
export if you need to compare new procedural output with an edited master.

`assets:check` compares every generated texture, source GLB and the source catalog byte for
byte without writing them. This optional authoring check can intentionally fail for an
externally edited model. Use `assets:verify` for normal source/runtime freshness instead. `assets:import` reserves the `lantern` namespace, imports each model
with optimization, verifies its hash, updates `project.json`, and writes `import-report.json`
and the staging gallery. It deliberately replaces **this collection's** existing imports.
Each editing master now lives with its metadata and `source.json` under
`asset-src/<category>/<thing>/models/source.glb`. The generated catalog retains its baseline
hashes; the import report records current source hashes, sizes, clips and `sourceEdited`.
`assets:verify --built dist` additionally verifies the models copied into the built game.

For a single asset, the equivalent public CLI operation is:

```sh
node packages/tooling/dist/cli.mjs asset import examples/lantern-dungeon/asset-src/mob/ossuary-knight/models/source.glb --id lantern.mob.ossuary_knight --project examples/lantern-dungeon/project.json --out-dir examples/lantern-dungeon/public/assets --force
node packages/tooling/dist/cli.mjs asset inspect lantern.mob.ossuary_knight --project examples/lantern-dungeon/project.json --verify
```

Molen requires dotted **lower_snake** asset IDs. Runtime files live under `public/assets/`,
which Vite serves in development and copies into production builds. The browser enables
`assets: { baseUrl: new URL('./', location.href).href }` on `mountExperience`; the CLI resolves
the same model IDs through the project index. Nothing depends on an external asset host.

## Inspect and verify

```sh
pnpm --filter @bendyline/molen-examples-lantern-dungeon assets:verify
pnpm --filter @bendyline/molen-examples-lantern-dungeon assets:shot
python examples/lantern-dungeon/tools/catalog-assets.py
node packages/tooling/dist/cli.mjs validate examples/lantern-dungeon/asset-gallery.json
node packages/tooling/dist/cli.mjs shot examples/lantern-dungeon/asset-gallery.json --ticks 8 --size 1440x1080 --out examples/lantern-dungeon/.artifacts/asset-gallery.png
node packages/tooling/dist/cli.mjs shot examples/lantern-dungeon/scene.json --ticks 3 --size 1280x800 --out examples/lantern-dungeon/.artifacts/dungeon-render.png
pnpm --filter @bendyline/molen-examples-lantern-dungeon test:unit
pnpm --filter @bendyline/molen-examples-lantern-dungeon test:golden
```

The capture operation renders four neutral angles per model, including creature clip poses.
The gallery exercises all models together with a shadow-casting sun and receiving ground.
The browser test waits for `client.ready()` after the first world snapshot, verifies 28 successful
GLB responses, plays the real Worker game, strikes, restarts, and resizes the HUD. Headless
checks verify hash integrity, self-contained buffers/images, budgets, all scene references,
command-driven victory, replay continuation, combat and weapon-animation reset.

`import-report.json` records source/import hashes, bounds, sizes and full importer statistics.
Raw turntable frames and `capture-report.json` are reproducible under `.artifacts/assets/`;
`catalog.png` retains their front views for convenient browsing.

The importer intentionally leaves repeating UV coordinates unquantized and logs that decision.
No Draco or KTX decoder is required. Extracted sidecar hulls are inspection metadata; gameplay
retains its authored lightweight XZ colliders. Loose props and ambient creatures are decorative,
so their mesh hulls do not introduce new obstacles or combat rules. The collection has no LODs,
skinned rigs, or bespoke per-creature attack behavior yet.
