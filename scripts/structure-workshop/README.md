# Building and landmark workshop

This project-local Gezel craftbook accepts a set of building requests, collects references,
creates one child task per model, then builds, renders, reviews and repairs each one. Open
Molen as a Gezel project and run `/structure-workshop`, passing a unique `runId` (default `study`).
It follows [Molen's building style guide](../../docs-src/guide/3d-art-guidelines.md),
[asset workflow](../../docs-src/guide/3d-model-assets.md), and
[shared material library](../../packages/worldgen/packs/default/materials/README.md).

Use a Gezel build with the `wikimedia_image_search` tool and `imageEvidence` gate (implemented alongside this craftbook). The build step checks reference-image reads; the review step checks all eight current render reads, scoped to that child and step activation. This proves images were delivered to the model, not that its judgment is correct.

Build the existing repository packages first (`pnpm -r build`). Node 22+, the installed Molen
workspace dependencies and Playwright Chromium are required; this workflow installs nothing.
Enable managed workspace writes for this external Gezel project and allow the installed package command. Live Commons discovery also requires external research to be enabled in Gezel security settings. Use separate project workspaces for concurrent runs. Outputs live in
`.artifacts/structure-workshop/<runId>/`. This is a research prototype for static exteriors,
not a general organic modeller or an interior generator.

## Requests and reference images

Start with `wikimedia_image_search` (for example, `query: 'Space Needle exterior'`).
This uses Wikimedia Commons' public API, costs nothing and requires no search API key.
Select photographs of the actual building, preserve `sourceUrl`, `credit`, `license` and
`licenseUrl` as the reference's `rights`, then open the downloaded image. Search availability
does not make a photo public domain; each file has its own license. Refine skyline/interior
results to a specific exterior or facade query. This is tool instruction, not model fine-tuning.
The downloader accepts Commons (`upload.wikimedia.org`, `thumb.wikimedia.org`) and Library
of Congress (`cdn.loc.gov`, `tile.loc.gov`) raster images, with byte and decoded-pixel caps.
It preserves original bytes and the actual JPEG/PNG/WebP extension. Redirects are rejected.

Write `requests.json` inside that run folder:

```json
{"requests":[{"id":"brick-school","title":"American brick high school","brief":"Create a stylized two-storey American brick high school with a central entrance and regular classroom windows.","features":["Two-storey red brick classroom wings","Prominent central double entrance","Repeated tall classroom windows"],"references":[{"id":"school-front","sourceUrl":"https://www.loc.gov/pictures/item/2019689185/","imageUrl":"https://cdn.loc.gov/service/pnp/highsm/56700/56761v.jpg","credit":"Carol M. Highsmith / Library of Congress","rights":"No known restrictions on publication; see source item."}]}]}
```

`pnpm structure:workshop prepare study` validates requests, downloads images and writes one
brief and an exact fanout queue. The model must actually open these images, then write each
asset's `research.json`: `{"references":[{"id":"school-front","sha256":"from brief.json",
"observations":"Specific visible shape, proportions and material observations..."}]}`.
Offline evals use frozen, attributed photographs from `fixtures/references/`, selected in advance;
they measure reference interpretation, not live search quality. Reference photos are never textures.
The `fixture` field names a frozen JPG without extension and replaces `imageUrl` in offline requests.

## Compact geometry recipe

A model writes `<run>/<asset-id>/recipe.json`. The compiler handles buffers, normals, UVs,
PNG baking, glTF serialization and Molen import; the model controls the actual shape and palette.
The experimental recipe format belongs to this workshop and is validated by its compiler,
not `molen validate`. Final GLBs, scenes, sidecars and source bundles use shipped Molen formats.

```json
{
  "format":"molen/structure-recipe@1","id":"brick-school","title":"Brick school",
  "materials":[
    {"id":"brick","color":"#a86c58","graph":"brick","repeatMeters":[1.92,0.9]},
    {"id":"glass","color":"#365968","roughness":0.3}
  ],
  "parts":[
    {"name":"wing","shape":"box","material":"brick","position":[0,4,0],"size":[30,8,12]},
    {"name":"windows","shape":"box","material":"glass","position":[-12,5,6.05],"size":[1.4,2,0.1],"repeat":{"count":9,"step":[3,0,0]}}
  ]
}
```

Units are meters; +Y up, +Z front; box positions are centers. Rotation is XYZ radians.
IDs and names use lowercase letters, digits, `_` and `-`. Material colors are sRGB hex inputs,
converted to linear glTF factors. Canonical graphs use their filename stem, e.g. `brick`,
`concrete_plain`, `membrane`, `metal_standing_seam`, `stone_limestone`. At least one graph is
required; choose graph names from `brief.json.availableMaterialGraphs`. Untextured glass/metal colors may omit a graph. Its base color and packed metallic-roughness PNGs are embedded and also saved separately.
Roughness is G and metalness B. Normal vectors come from geometry; no fake normal map is supplied.
`repeatMeters` controls physical UV repetition, not number of tiles. Three to five materials is
usually enough; the ceiling is eight.

Three shape families:

- `box`: `size:[width,height,depth]`, `position:[x,y,z]`, optional `rotation:[x,y,z]`.
- `beam`: `from:[x,y,z]`, `to:[x,y,z]`, positive `radius`, optional `segments` (6–32).
- `lathe`: `profile:[[radius,y],...]` with nondecreasing Y and distinct consecutive points, optional `position`,
  `rotation`, `segments` (6–32). Profile defines a surface of revolution around Y; start/end
  at radius zero when a closed pole is needed. Equal-Y rings form horizontal rims. This is a full 360-degree solid/surface, not a front-facing arch; use boxes for rectangular door surrounds. Keep rings low enough for the 8,000-triangle cap.

Every part needs a unique `name` and an existing `material`. Any part can repeat with
`repeat:{count:8,step:[3,0,0]}`. Maximum 150 authored parts, 600 expanded parts, 8,000 triangles.
Part rotation affects the shape before translation. Both `position` and `repeat.step` use world axes; rotating a part does not rotate its repetition direction. Copy index `i` is translated by `position + i * repeat.step`, starting at `i=0`. Check the first and last copy bounds against the intended supporting surface. Swapping a box's width/depth and also rotating it can undo the intended orientation.
Do not use repeated boxes to approximate a smooth organic object. A recipe must stand at Y=0.

## Build and review

```sh
pnpm structure:workshop build study brick-school
pnpm structure:workshop review study brick-school
pnpm structure:workshop collect study
```

In Gezel use `run_package_script` with `script:"structure:workshop"` and
`args:["build","study","brick-school"]` (or prepare/review/collect). First-use command consent
is the ordinary Gezel project command flow. Output revision folders are immutable and numbered by compiler attempt. There are at most three
completed renders for visual review and nine total compiler attempts. Failed compilation retains
its partial folder but does not consume a visual review opportunity. Do not delete
revision folders to evade the cap; start a new explicitly named experiment instead.

A build emits editable recipe + material graphs, PBR PNGs, source GLB, imported runtime GLB,
asset sidecar, project, scene, simulation checks, source inventory, README and build receipt.
Eight images: four turntable angles, a lit scene with a 1.75 m scale marker, distance view,
rotated 75% scale view, and texture-disabled view. Every image must be opened and judged.
Pack KTX2 as a separate ship-time step after acceptance with `molen asset pack <id> --project
<revision>/project.json`; this prototype retains ordinary PNG GLBs for tool compatibility.

Write `review.json` beside `recipe.json`:

```json
{"buildId":"from build.json","views":[{"path":"revisions/1/shots/in-scene.png","sha256":"from build.json","observation":"Concrete view-specific findings of at least 40 characters."}],"features":[{"feature":"exact feature from brief","pass":true,"observation":"What the rendered geometry demonstrates."}],"scores":{"silhouette":4,"proportions":4,"materials":4,"style":4,"usefulness":4},"issues":[]}
```

Include ALL eight views and EVERY requested feature. Scores: 1 broken, 2 weak, 3 recognizable
but needs work, 4 useful stylized asset, 5 polished. All five must be >=4, all features true and
issues empty. Hashes prevent stale review after a recipe/model/screenshot change. `review`
exits 2 for a valid rejection; findings route the craftbook back to build. Three failed attempts
pause for help. No review means no accepted model. Programmatic validity cannot prove good art:
retain model identity, prompts, outputs, tool receipts and a separate human/vision judgment in evals.

## Evaluation

`pnpm structure:workshop:test` runs deterministic validation, real GLB and PBR checks, stale-review
and rejection tests. Gezel's `molen-structure-workshop` scenario tests the actual project craftbook,
fanout, tool-driven image inspection, compilation and review. It requires a sibling built Gezel
checkout and uses frozen references in a fresh trial workspace. See [EVALUATION.md](EVALUATION.md) for measured
results and limitations; fixture compiler tests are not model-capability evidence.

A useful complete exterior must remain plausible from every side. Empty rear classroom wings, blocked entrances and disconnected supports cap usefulness/proportions at 3/5 and require repair. Document conservative assumptions where reference views are missing. Passing image-delivery checks does not replace this judgment; independent spot review remains necessary.
