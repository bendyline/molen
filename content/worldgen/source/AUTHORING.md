# Structure source and authoring

Each authored structure has a source bundle, an editable geometry recipe, shared material
references and an imported runtime sidecar. GLBs are generated outputs. The recipe code,
specifications, material graphs, sidecars and review records belong in Git.

## Find a model

| What you need | Where to look |
| --- | --- |
| Geographic source bundle | `places/<geohash2>/<geohash3>/<model-key>/source.json` |
| Reusable category source | `reusable/<category>/<model-key>/source.json` or `map-structures/` |
| Source paths, identities and anchors | [structure-index.json](structure-index.json) |
| Editable recipes and registered generator commands | [authoring-index.json](authoring-index.json) |
| Runtime sidecars | `../assets/places/<geohash2>/<geohash3>/<model-key>/asset.json` |
| Shared material graphs | `../materials/*.matgraph.json` |
| All 1,000 candidates and current readiness | [production progress](next-1000/PROGRESS.md) |
| Next production selection | [NEXT-300.json](next-1000/NEXT-300.json) |

The authoring index is a static dependency and identity cross-reference. A recipe may be
reachable from several generator jobs because they import common helpers. Its
`generatorCandidates` field lists those jobs; the bundle README names the targeted command.
The index helps locate source; the full asset build proves that it reconstructs the locked GLBs.

Source folders follow location, while the candidate inventory remains in `next-1000/`.
Those candidate IDs are stable identifiers, not file counters. Collection candidates still
require every independently located member, and reusable models never count as named replicas.

## Edit, rebuild and review

1. Find the model's recipe in the index or bundle README. Edit the recipe and its evidence
   together. For generated fields, edit the recipe rather than only its emitted `spec.json`.
2. Run the bundle's targeted generator. For example:
   `node packages/worldgen/scripts/generate-lighthouse-models.mjs --ids=N1007`.
3. For a new bundle, regenerate `index-structure-sources.mjs`, then import with
   `node packages/worldgen/scripts/import-and-register-next-1000.mjs --ids=N1007`.
4. Capture portable and viewer/shared-material views, inspect the actual images, and record
   hash-bound QA. Correct location, compass orientation and elevation datum require their own
   evidence. A flat test terrain capture verifies transforms, not real terrain or tides.
5. Regenerate the source and authoring indexes, readiness ledger and galleries. The commands are
   listed below. `pnpm source:check` checks the source bundles and authoring index.
6. Run `pnpm assets:build --update-lock`, review the changed metadata, and run the repository
   checks. The owner commits source and the lock. The Assets workflow publishes the pack.

```sh
node packages/worldgen/scripts/index-structure-sources.mjs
node packages/worldgen/scripts/index-structure-authoring.mjs
node packages/worldgen-earth/scripts/build-structure-readiness.mjs
node packages/worldgen/scripts/build-next-1000-gallery.mjs
node packages/worldgen/scripts/build-place-gallery.mjs
```

See [Repository GLBs](../../ASSET-PACKS.md) for the complete build and release workflow.
Shared procedural materials are baked once by the viewer and reused. Portable fallback
materials remain in the GLB; photographs from research are not embedded as textures.

## Rebuild audit — 2026-10-01, before this round

The full registered generator build recreated all **726 locked generated GLBs**, byte for
byte, before adding Roter Sand. The 364 existing imports matched their source/runtime hashes
and were reused; this run did not independently repeat every runtime import. All 549 logical
source bundles passed the source check. The local detailed report is
`.artifacts/asset-build/report.json`; build logs are generated evidence.

Five small vehicle source masters remain committed binary inputs, explicitly listed in
`asset-build.json`. They are the documented exception to reconstruction from text recipes.
There are no such exceptions among the authored structures indexed here.

The audit also found 101 JSON/Markdown files whose generator output differed from curated
metadata. Plain builds preserve that metadata and report the differences. Review a lock
update's metadata diff carefully, especially geographic evidence and existing reviews.

This audit proves reproducibility, not maximum fidelity. The readiness ledger continues to
separate authored models, imported models, reviewed previews and completed landmarks. The
next-300 queue is a selection for future authoring, not 300 completed models.

Review hashes for UTF-8 reports, specs, maps and material graphs tolerate Git's LF/CRLF
checkout conversion. Other text changes invalidate the review. GLB and image hashes always
compare exact bytes; checkout must never rewrite those binary files.

## Round result — 2026-10-01

The updated source build reconstructs **728 generated GLBs** byte for byte against
`asset-lock.json` (365 existing imports reused). The authoring index links **323 authored
structure assets** to their registered generator candidates and editable recipes. All **550
logical source bundles** pass the source check.

Roter Sand (N1007) adds an original, survey-informed offshore lighthouse with shared painted
metal and wood surfaces. Its 18 portable/viewer images were inspected. It remains a preview:
porthole apertures, junction details and the offshore elevation datum need further review.
The next-300 selection also records initial Montelbaanstoren research and an unresolved height
discrepancy, so an uncertain dimension cannot silently become a model specification.

The next-1,000 ledger now contains **221 authored/imported models and 159 completed candidates**.
Fresh captures preserve Telekom Tower's approval. Mordovia Arena and Rostec Arena return to
pending visual/fidelity review because their perforated facades show visible aliasing. Their
geographic reviews remain current; these two candidates are not counted complete.

Validation passed: lint, typecheck, source and generated-doc checks, unit tests, production
dependency audit, packed-release smoke, docs-site check and the full golden suite. The audit
needed a separate run with registry access after the sandbox blocked its network request.
Goldens used WebGL/SwiftShader; WebGPU cases were explicitly skipped. No Git mutations or
release publication were performed.

## Facade sampling follow-up — 2026-10-01

Mordovia Arena and Rostec Arena now use shared material graphs with opt-in fractional alpha
coverage. Both the viewer and portable GLB fallbacks use mipmapped alpha blending, preserving
average open area when perforations become smaller than a pixel. A stochastic alpha test was
also rendered and rejected because its grain was visible. Conventional translucent-surface
sorting remains a limitation of the chosen blending path.

All **66** new portable and viewer frames were inspected, including facade close-ups, distant
views and placement fixtures. Both stadiums pass their existing scoped exterior reviews again;
their documented geometric reconstruction limitations remain. The current next-1,000 ledger
therefore contains **221 authored/imported models and 161 completed candidates**. Roter Sand
remains pending. The next-300 queue records the two resolved sampling follow-ups.

The complete source build reproduces all **728 GLBs** against lock release
`assets-d73ea1678735cc54`. Follow-up validation is recorded in the post-merge audit below.

## Post-merge integrity audit — 2026-10-01

The lock conflict affected its derived snapshot fields. Recomputing them from the merged file
inventory preserves both the aircraft/transit updates and the landmark updates, without losing
either branch's entries. The resulting release is **`assets-499cc12e9fef2eaf`**.

The merged source was compiled and all 22 generator jobs were run. All **368 runtime imports
were forced**, with none reused. All **734 generated GLBs** match the merged lock byte for
byte; there are no missing, extra or changed outputs. The five documented vehicle masters
remain binary inputs. This is a local Windows/Node 24 rebuild, not a new cross-platform proof.

The source and organization checks passed:

- **553** logical source bundles validate, with declared files and source hashes intact.
- **323** authored structure assets have generator/recipe links and canonical runtime folders.
- All **1,491** checked structure recipe dependencies, source definitions, bundle manifests and
  runtime sidecars are present in the Git index; none depends on an untracked source file in
  this checked set. This does not mean the owner's pending changes have been committed.
- All **368** imported assets pass sidecar schema, runtime/collision hash, project registration,
  runtime mesh-statistics and source/runtime shared-surface equivalence checks.
- Shared surface references, slot names and UV0 bindings pass across **649** structure/prop
  source and runtime GLBs. The candidate readiness ledger is current at **161 complete**.

The independent Khronos glTF Validator scan is **not clean**. Version `2.0.0-dev.3.10` inspected
all **739** local GLBs (734 generated plus five masters), without truncated reports:

- **323 generated structure source GLBs** and **three direct runtime prop GLBs** have
  `MESH_PRIMITIVE_ACCESSOR_UNALIGNED` errors (1,512 reported primitive attributes in total).
- The common encoder in `packages/worldgen/src/kernel/glb.ts` writes normalized RGB bytes as
  tightly packed `VEC3` vertex attributes. glTF requires four-byte vertex alignment. The buffer
  itself starts aligned, but each subsequent three-byte color does not.
- All **368 imported runtime models** pass the validator's error checks: the importer repacks
  this data. The three affected direct props are `canale`, `chimney.brick` and `rooftop.hvac`.
- **26 files** have tangent-generation warnings. Unused-UV informational messages also occur;
  Molen's shared surfaces consume UVs through their explicit extras bindings.

The corrective source change is to pad each RGB color to a four-byte stride, then rebuild and
refresh affected source hashes, metadata and the lock. That migration has not been applied in
this audit. Geometry reconstruction and repository organization pass; full glTF conformance
must not be claimed until the encoder defect is corrected.
An isolated Roter Sand experiment pads RGB to a four-byte stride without changing color values.
Its validator errors become zero, and a fresh import produces the **exact same runtime GLB**
(`sha256:a3ecef4d778caed8a49744af14c9dd8a1476f3b63d1dd32ed5bb25645c6cbe3d`).
The source grows from 18,204,184 to 18,652,708 bytes. This proves the repair for that sample;
the canonical encoder, source files and lock were not changed by the experiment. Results are
in `.artifacts/merge-model-audit/alignment-probe/result.json`.

There is also metadata drift: the generators would rewrite **97 specs, two READMEs, two source
manifests and the barn project manifest**. The build preserved those documents. No runtime
sidecar differed. Curated metadata and generator output should be reconciled separately; the
byte-for-byte GLB result does not certify that all metadata round-trips unchanged.
One identified cause is `generate-signature-towers.mjs` hashing the entire shared geography
catalog into specs without a local map frame. Unrelated catalog edits then change those specs.
Hashing each model's actual evidence record would make that dependency explicit and narrower.

Runtime organization has a separate efficiency limit. All 323 structure exports contain one
glTF mesh; **22 runtime models exceed 100 MiB**, with Munich Olympic Stadium the largest at
329.65 MiB. **219** structure models explicitly bind shared material graphs, while **104**
retain local material factors. Four use embedded portable texture fallbacks. Reproducible source
and geographic folders are in place, but reusable component exports, measured LODs and broader
shared-surface adoption remain work; the current assets are not uniformly compact assemblies.

Detailed local evidence is in `.artifacts/merge-model-audit/` (`lock-resolution.json`,
`source-rebuild.log`, `asset-integrity.json`, `gltf-validation.json` and per-model reports).
All four repository gates passed: **`pnpm verify`**, **`pnpm smoke:packed`**,
**`pnpm docs:site:check`** and **`pnpm test:golden`**. The packed smoke installed 16 package
tarballs and exercised seven templates. Rendering goldens used WebGL/software rendering;
two WebGPU cases were explicitly skipped. The separate Khronos scan still reports the
alignment errors described above.

The merge restored CRLF in 853 Biome-checked files and eight generated schema documents.
Only their line endings were normalized. Two material tests were corrected: landmark-only
porous surfaces must be explicitly prepared, and their assertions must reflect the new
fractional-coverage mode. No source geometry, placement or runtime GLB bytes were changed by
those corrections. No Git staging, commits, history changes or publication were performed by
this audit.

## RGB alignment repair — 2026-10-02

The encoder defect found above is repaired. RGB colors remain normalized unsigned-byte
`VEC3` values, now at a four-byte vertex stride. The padding adds no alpha channel and changes
no position, normal, UV, index, material or texture data.

All 22 source generators and all 368 imports were forced. Every imported runtime GLB remains
byte-for-byte identical to the preceding lock. Exactly 326 generated GLBs changed: the 323
structure source masters and the three direct prop outputs. Removing only the new color padding
reconstructs each of their exact historical SHA-256 hashes and byte lengths. Source manifests,
mesh size/hash fields, import sidecars/reports and README size/hash descriptions were refreshed;
curated geographic evidence and original capture/QA reports were retained. The repaired lock is
**`assets-5aca35d6c553560b`** (734 generated files).

`reviewed-glb-encoding.mjs` recognizes this narrow encoding transition by reconstructing the
historical GLB bytes. It does not grant approval to changed geometry or materials. Readiness
still requires the recorded runtime hash, capture reports, inspected image hashes and material
graph hashes. For captured specifications, only the proven source byte count/hash can be
reversed. The ledger exposes the historical reviewed source hash under `reviewedEncoding`.
No historical render was relabeled as a newly captured frame.

The Khronos validator was rerun on **all 739 GLBs** with unlimited issue reporting: **zero
errors**, 26 files with the existing tangent-generation warnings, and no truncated reports.
All **368** source/runtime integrity inspections pass. Readiness remains **221 authored,
219 portable reviews, 216 shared-material reviews, 192 maximum-exterior reviews and 161
complete**, with 779 sources still to author. This encoding repair does not resolve the
separate large single-mesh assets, metadata drift or outstanding fidelity/placement reviews.

Local reproduction evidence is in `.artifacts/rgb-alignment-repair/`: `rebuild-report.json`,
`migration.json`, `asset-integrity.json`, `gltf-validation.json` and the per-file validator
reports. The regression tests cover RGB value preservation, unchanged inputs, deterministic
encoding, historical hash reconstruction, embedded-texture payload padding and rejection of
changed colors, scene metadata and captured specification values.

## Amsterdam and Berlin tower studies — 2026-10-02

Two additional editable recipes now have geographic source bundles and normal runtime imports:

- **N0622 Montelbaanstoren**: `montelbaanstoren-model.mjs`, with its bundle at
  `places/u1/u17/n0622_montelbaanstoren/`. The Amsterdam BMA measured section supplies the
  working 42.05 m height; the conflicting historical 48 m statement remains explicit. PDOK AHN4
  surface/nearby-ground samples support the smaller envelope without being treated as a survey.
  The model contains 123,692 triangles, four shared material graphs and 19 inspected current
  portable/shared renders. Irregular masonry, facade details and signed site placement still
  require review; this model is not counted complete.
- **N0616 Grunewald Tower**: `grunewald-tower-model.mjs`, with its bundle at
  `places/u3/u33/n0616_grunewald_tower/`. The 1899 published section/elevation, Berlin's 55 m
  tower and 36 m viewing-floor records, and mapped 26 m terrace supply the reconstruction
  frame. The model contains 296,070 triangles, five shared graphs and 21 inspected current
  portable/shared renders. Open arches, pierced rails, roof courses, closed gable backs and
  recessed windows are authored geometry. The memorial sculpture, heraldic relief, mosaic,
  finer facade/terrace details and signed terrain placement remain unfinished. This model is
  also not counted complete.

Both source/runtime pairs pass the independent Khronos validator without errors or warnings,
and their registered generator reproduces the source bytes with `--check`. No downloaded mesh
or private per-model texture was added. The shared-material fixtures loaded the full meshes
and passed unload checks; these isolated renders do not certify real-site placement.

The lock is now **`assets-dfb378404ec57a7e`**, covering **738 generated GLBs** and **370 imports**.
Together with the five documented binary masters, the library contains 743 GLBs. The earlier
739-file validator scan and the four new source/runtime validations cover that total. Next-1000
readiness is **223 authored, 221 portable reviews, 218 shared-material reviews, 192 maximum
exterior reviews and 161 complete**; **777 sources remain to author**. The queue records the
new sources and the next Bitexco research references without promoting unfinished geometry.

The four repository gates passed after the alignment repair and Montelbaanstoren addition.
Grunewald additionally passed finite-coordinate/area/winding validation, exact generation,
normal import verification, independent glTF validation and the inspected render/unload checks.
Local research, validator reports and current contact sheets are retained under
`.artifacts/montelbaanstoren-research/` and `.artifacts/grunewald-research/`; these are local
evidence, not release content.

## Bitexco and Garni studies — 2026-10-02

Two more candidates now have editable recipes, geographic source bundles and normal imports:

- **N0209 Bitexco Financial Tower**: `signature-tower-bitexco-model.mjs`, with its source at
  `places/w3/w3g/n0209_bitexco_financial_tower/`. The curved shaft, inclined crown, projecting
  helipad and retail podium contain **315,402 triangles** in a **27,557,128-byte** source.
  Four shared surface graphs supply stone and metal; glass/recesses use local PBR factors.
  The engineer photographs, published form study and mapped building parts are recorded in
  the spec. Curvature, soffit panels, equipment, storefront details and geographic fit need
  further work. The model is not counted complete.
- **N0498 Garni Temple**: `garni-temple-model.mjs`, with its source at
  `places/sz/szp/n0498_garni_temple/`. Sahinyan's published restoration measurements constrain
  the podium, 24 smooth drum columns, order and cella doorway. Capitals, carved bands,
  pediments, roof tiles, portico coffers and stair relief motifs are original geometry.
  The **1,209,054-triangle**, **99,368,824-byte** source uses the shared raw-basalt graph.
  Distinct surviving carvings, roof/coffer details, stone tones and real-site placement still
  need comparison. The model is not counted complete.

Each model has **27 inspected current renders**: 14 portable and 13 shared-surface views.
The four source/runtime GLBs pass independent Khronos validation with **zero errors and zero
warnings**. Both registered generators pass exact `--check` reproduction. The shared fixtures
load the full triangle counts and pass unloading; they do not certify geographic placement.

Garni opts into `compact-authored-mesh.mjs`, which shares only vertices whose position, normal,
UV and RGB bits match exactly. It preserves index order, material groups and triangle count.
The regression test covers UV seams, hard normals, color differences, signed zero and repeat
application. This removes little data on heavily carved geometry with distinct face attributes;
the model still needs reusable component exports and measured LODs. Curve tessellation was also
adjusted during authoring, before the final captures. That separate change is not called lossless.

The lock is **`assets-8aa31909c22e04f4`**, covering **742 generated GLBs** and **372 imports**.
Including the five documented masters, there are 747 GLBs. The source index covers 557 logical
bundles, with recipes indexed for 327 structure assets. Next-1000 readiness is **225 authored,
223 portable reviews, 220 shared-material reviews, 192 maximum-exterior reviews and 161
complete**. **775 candidates still need sources**; the remaining authored candidates need
their outstanding reviews or detail work. The queue now includes the primary Arup and Network
Rail references for the King's Cross station candidate.

Local research, validation and contact sheets are under `.artifacts/bitexco-research/` and
`.artifacts/garni-research/`. GLBs remain generated outputs; no Git staging or publication was
performed.

All four repository gates passed for this snapshot: `verify`, `smoke:packed`,
`docs:site:check` and `test:golden`. Their local logs are in `.artifacts/garni-research/`.

## King's Cross component assembly — 2026-10-02

**N0791 London King's Cross railway station** now has an editable recipe in
`packages/worldgen/scripts/kings-cross-station-model.mjs` and a geographic source bundle at
`places/gc/gcp/n0791_london_king_s_cross_railway_station/`. The registered heritage generator
builds the twin train sheds, southern clock facade, office ranges, tapered suburban shed and
western concourse. Arup's published sections, plan, photographs and three-circle roof diagram
were inspected; the specification distinguishes measured dimensions from reconstructed ones.

The GLB uses **six unique meshes and 192 mesh nodes**, with **132,146 stored triangles** and
**540,926 instantiated triangles**. Its source is **10,838,624 bytes** and runtime output is
**10,835,044 bytes**. Repeated roof ribs and facade bays refer to the same mesh buffers. Six
canonical material graphs supply brick, stone, concrete, wood, slate and painted metal; no
per-model bitmap images are embedded.

`authored-glb-assembly.mjs` joins the static generator's parts, remaps buffer views/accessors,
shares identical material definitions and writes explicit node transforms. It rejects inputs
outside the supported static subset. New recipes can supply `encodeAssembly` alongside their
aggregate geometry builder; both paths are checked. Parts must use an explicit common ground
datum. The assembly tests verify attribute bytes, material bindings, instance transforms and
buffer reuse. `landmark-capture-geometry.mjs` independently counts default-scene instances for
the viewer check, because sidecar triangle statistics describe unique stored meshes.

The source and runtime both pass independent Khronos validation with zero errors and warnings.
The registered generator passes exact `--check` reproduction. **27 current renders** were
inspected, including front, roof, facade, shed interior and concourse details. Shared-material
loading reaches all instantiated geometry and passes unloading. Render iteration corrected
inward-facing window bays, missing rear arch faces, southern facade gaps, an overly dense
funnel and the rectangular draft of the tapered suburban extension.

This is still **an authored study, not a completed maximum-fidelity landmark**. Distinct
Western Range elevations, booking hall and parcels atrium, the bomb gap, Roman clock numerals,
lettering, roof/glazing details, accurate diagrid topology, mezzanine and escalators remain.
The footprint overlay also distinguishes the mapped wall envelope from the published roof
diameter. Signed site placement and terrain datum are pending; no automatic placement was
activated. These limitations are recorded in the current-hash QA and production queue.

The lock is **`assets-133897195cb75525`**, covering **744 generated GLBs and 373 imports**;
with five documented binary masters, there are 749 GLBs. The new pair was regenerated and
validated independently; updating this lock reused already-current imports and was not a new
full-library source generation run. Local research, the footprint overlay, validation and
contact sheets are in `.artifacts/kings-cross-research/`.

All four gates passed for this snapshot: `verify`, `smoke:packed`, `docs:site:check`
and `test:golden`, with logs in that research directory. Readiness at this point is
226 authored and 161 complete; 774 candidates still need sources.

## Gateway Arch, Spire and Emley Moor — 2026-10-02

Three individual sources now have registered recipes and normal geographic imports:

- **N0963 Gateway Arch**: the published weighted catenary, triangular sections, 32 true
  observation apertures, ground-clipped feet and plate joints. Its source stores 50,314
  triangles in 5,032,464 bytes, with shared stainless steel and no embedded bitmap images.
- **N0975 Spire of Dublin**: a 120 m tapered shaft, original geological base pattern,
  concentric grating and 11,884 physical tip perforations. GPU instancing shares repeated
  hole-rim geometry: 193,294 stored triangles expand to 1,313,806 rendered triangles in a
  14,914,312-byte source. New polished and bead-blasted stainless graphs bring the common
  architectural material library to 67 surfaces.
- **N1006 Emley Moor transmitting station**: the original engineering dimensions constrain
  the concrete shaft and 20-bay turret; dated photographs inform the shortened modern mast,
  antenna mounts and lower platforms. The source contains 271,888 triangles in 21,855,100
  bytes and binds three shared graphs. Flush concrete construction bands avoid the tiny
  groove shadow artifacts found during capture iteration.

All three registered generators pass exact reproduction checks. Independent Khronos validation
reports zero errors and warnings for their source/runtime pairs. The Spire's instancing extension
also has independent assembly tests and actual viewer draw-count verification. **78 current
portable/shared frames** were inspected (26 Arch, 24 Spire, 28 Emley), and unloading passes.
Reflection-enabled captures now use a daylight sky environment, preserving the appearance of
metallic finishes. The capture option remains opt-in for existing callers and goldens.

These are **authored studies, not completed maximum-fidelity landmarks**. Their current-hash QA
records the missing fabrication details and site review: Arch leg/apron measurements and axis;
Spire stencil orientation, joints and site furniture; Emley modern antenna dimensions, equipment
inventory, entrance azimuth and terrain. None gains automatic placement approval from an
isolated rendering fixture. Reference pixels are not redistributed in the source bundles.

The lock is **`assets-19d93099bcc31b93`**, covering **750 generated GLBs and 376 imports**;
with five documented binary masters, there are 755 GLBs. The new sources were regenerated
individually; the lock update reused current imports and was not a fresh full-library generation.
Readiness is **229 authored, 227 portable reviews, 224 shared reviews, 192 maximum-exterior
reviews and 161 complete**. The remaining 771 candidates still need sources.

All local `verify` stages passed on the rerun. Its final network audit was blocked by the sandbox;
after explicit owner approval, the separate `audit:prod` passed with no known vulnerabilities.
`docs:site:check`, `smoke:packed` and `test:golden` passed. Earlier failed attempts are retained:
one existing cache-test timeout passed in isolation and in the full rerun, and a docs build that
overlapped an import passed after source mutations stopped. Logs, reference inspections and
contact sheets are under `.artifacts/gateway-arch-research/` and `.artifacts/emley-moor-research/`.

## Monnow bank approaches and geographic review — 2026-10-02

N0015 now includes its mapped retaining walls and sloped bank approaches. Independent Welsh
Government 1 m DTM/DSM samples constrain the crown, roof envelope and road slopes. Raw terrain
is unchanged; a dry-bank reference transfers model height through the host sampler. The source
preserves the mapped bridge/gate outlines and adds a separately documented approach input.
Editable recipes regenerate the 432,223-triangle source (34,496,632 bytes) and its runtime
(34,496,188 bytes), with three canonical material graphs and no embedded bitmap textures.

All **37 current frames** were inspected: 13 portable, 12 shared, six terrain and six terrain
with mapped roads. Iteration corrected the crown, retaining walls, approach joins and parapet
blocks that incorrectly followed skewed end faces across the entrances. Khronos validation
reports zero errors and warnings for both GLBs; exact generator reproduction and unloading
pass. End probes near the road joins differ from the triangulated DTM by approximately
0.05 and 0.16 m. Those numbers describe the fixture, not survey accuracy.

The viewer now transfers authored height to connected ground approaches using the same
profile for paint and traffic. An optional `includeConnectedApproaches` clips authored
approach pavement only through shared bridge endpoints and outward-aligned paths. Unrelated
paths and tunnels remain. Asymmetric outlines use their actual centerline intersections
for the deck-height connection stations. The terrain evidence and limitations are documented
in `content/earth/structures/evidence/bridge-terrain/wales/README.md`.

This review raises the ledger to **229 authored and 162 complete**. The lock is
**`assets-a408c8af67fb6bbf`**, with 750 generated GLBs and 376 imports (755 physical GLBs when
the five documented binary masters are included). This update regenerated Monnow and reused
the other current imports; it is not a new full-library source regeneration run.

## Current review bindings and repository gates — 2026-10-02

Torre del Mangia's current spec now has ten freshly inspected shared-surface frames.
Hermannsdenkmal also has ten current shared frames and an explicit source map frame:
the mapped foundation supplies its center, while LWL's regional heritage description
independently establishes the west-facing statue and sword. Neither update changes
geometry. These completed reviews bring the ledger to **229 authored and 164 complete**.

The Monnow engine/source changes and these review bindings passed `verify`, including
the explicitly approved npm production audit (no known vulnerabilities), `smoke:packed`,
`docs:site:check` and `test:golden`. The packed smoke installed 16 package tarballs and
validated seven templates. Golden tests included World Explorer and Earth View; the
WebGPU-only cases were skipped on this software-rendered WebGL run. Logs are in
`.artifacts/bridge-terrain/wales/verify.log`, `smoke-packed-network.log`,
`docs-site-check.log` and `golden.log`. The initial sandboxed packed-smoke attempt was
stopped after public npm downloads failed; its network-enabled rerun passed. The lock
remains `assets-a408c8af67fb6bbf`.

## Three explicit placement-source bindings — 2026-10-02

St. Agatha's Tower, Vijaya Stambha and Watts Towers now bind explicit identity and
signed-axis evidence from their source map frames. St. Agatha's identity follows
Malta national inventory 00033; its mapped way has no Wikidata tag. Vijaya's mapped
upper roof supplies center and axis, while the ASI north-arrow plan establishes the
southern entrance. Watts uses the official State Parks parcel and street boundary;
its raw parcel record is now registered in the source manifest. Text evidence hashes
are canonical across LF/CRLF checkouts. Existing geometry, materials and placements
are unchanged, with all proportional reconstruction limitations retained.

All **41 newly captured shared frames** were inspected: 12 St. Agatha, 13 Vijaya and
16 Watts, including north-up placement and close details. Load/unload checks passed.
All three generators reproduced their source bytes exactly and their runtime imports
verified. Independent Khronos validation reported zero errors and warnings for all
six source/runtime files. The updated ledger is **229 authored and 167 complete**;
771 candidates still need source models. These evidence-only changes followed the
full repository gate run above; their current source, asset and readiness checks are
recorded separately under `.artifacts/bridge-terrain/wales/three-*.log`. The asset lock
remains `assets-a408c8af67fb6bbf`; no GLBs need committing or republishing for this update.

## ATTO main-tower source and inspected preview — 2026-10-02

N0621 now has an original editable main-tower recipe with a 3 × 3 m square lattice,
325 m structural height, 331 m lightning tip, open angle-section braces, bolted joints,
1,500 grated treads, service rails, top instruments and a stationary RoLi carriage.
Published dimensions and the independently documented lift-corner azimuth are recorded
in its geographic source bundle. Guy-anchor radii and several secondary details remain
explicit provisional reconstruction. The separate smaller towers and laboratory compound
are still missing, so this is not a completed observatory model.

Four reusable meshes store 184,412 triangles and render 737,916 through 215 instances.
The source is 13,746,540 bytes; its runtime is 13,745,332 bytes. Three existing material
graphs supply paint, stainless steel and concrete, with no embedded bitmap images.
All 28 current portable/shared frames were inspected, including corrected full-height
and lightning-tip framing. Load/unload checks passed. Source regeneration is byte-exact;
both GLBs passed independent Khronos validation with zero errors and warnings.

The ledger is **230 authored and 167 complete**. Geographic and maximum-fidelity QA
remain pending for ATTO. Source checks verified 562 logical bundles and 332 structure
recipes. The lock is **`assets-e4fad66609974378`**, covering 752 generated GLBs and
377 current imports, plus five separately documented binary masters. This lock update
used the individually generated ATTO source and reused other current outputs; it is
not a fresh full-library regeneration. Current asset/source/readiness checks passed;
logs and validator results are under `.artifacts/atto-research/`. The full repository
gates recorded above precede this addition. No release was published.

## Kärnan source and inspected exterior preview — 2026-10-02

N0620 now has an editable, individually authored recipe under
`packages/worldgen/scripts/karnan-model.mjs` and a geographic source bundle at
`places/u3/u3c/n0620_karnan`. The signed OSM footprint and published historical plan
establish the southwest stair facade and northwest privy shaft. City references,
the 2002 preservation plan, operator photographs and the pre-restoration section
are recorded separately from proportional reconstruction assumptions.

The model includes the octagonal stair turret, main battlements, raised timber stair,
physical window/putlog reveals, sandstone belt, roof terrace, privy projection and
provisional low collar-wall remains. It stores 76,762 triangles, seven materials and
six canonical shared graphs, with no embedded images. Source and runtime GLBs are
4,215,664 and 4,215,004 bytes. Exact vertex sharing preserves the authored geometry.

All **32 current portable/shared frames** were inspected. Corrections included the
turret join, window sills, inward oculus normals, whole-elevation camera framing and
weathering. The mapped placement and resource-unload checks passed; the fixture uses
flat terrain. Both GLBs passed Khronos validation with zero errors and warnings, and
the generator reproduced its source bytes exactly. Source/import/readiness checks
are current. Logs and validator results are under `.artifacts/karnan-research/`.

The ledger is **231 authored and 167 complete**. Kärnan remains pending maximum-fidelity
and geographic approval: restored turret/terrace heights, exact opening/stair levels,
collar-wall extent, irregular medieval masonry and real terrain contacts need further
evidence. The lock is **`assets-17b7b06a554db0e3`**, covering 754 generated GLBs and
378 current imports, plus five separately documented binary masters. Other current
outputs were reused during the lock update; this was not a fresh full-library build.
The full repository gates recorded above predate this addition. No release was published.

## Circle Bridge source and inspected exterior preview — 2026-10-02

N0033 now has an original editable recipe at
`packages/worldgen/scripts/circle-bridge-model.mjs` and a geographic source bundle at
`places/u3/u3b/n0033_circle_bridge`. The five offset platforms use an independently
interpreted engineering plan and the exact-QID mapped outline. The 2012 design-stage
drawings and 2015 completion facts are distinguished in the source evidence.

The closed bridge includes open connecting walkways, inward-leaning diamond railings,
timber handrails, white edge flanges, trumpet supports, tapered masts, spreader rings,
118 stays with anchors, mast lights, a submerged pontoon and shore interface stubs.
It stores 166,522 triangles in four material groups. Four existing canonical graphs
supply painted metal, stainless steel, wood and a fine-grained deck approximation;
there are no embedded images. Source and runtime files are 12,745,196 and 12,744,732 bytes.

All **28 current portable/shared frames** were inspected, including full-resolution
shore-interface and north-up placement checks. Curved-to-straight rail joins were
corrected before final capture. Both GLBs passed Khronos validation with zero errors
and warnings. The generator reproduces exact source bytes; import/placement checks
are current. Shared materials are read once each, and unloading frees all geometry.

The ledger is **232 authored and 167 complete**. Circle Bridge remains pending final
geographic and maximum-fidelity approval: as-built mast heights, stay allocation,
edge offsets, water/quay datum, approach ramps and finish calibration need further
confirmation. The static model does not simulate opening or concealed hydraulics.
The lock is **`assets-796c131ed2384e23`**, covering 756 generated GLBs and 379 current
imports, plus five separately documented binary masters. The lock update reused
other current outputs; it was not a fresh full-library regeneration. Model checks
and evidence are under `.artifacts/circle-bridge-research/`. No release was published.

Fresh repository gates for this 232-model snapshot passed: `pnpm verify` (including
the owner-authorized npm production audit, with no known vulnerabilities),
`pnpm smoke:packed` (16 tarballs and seven templates), `pnpm docs:site:check`, and
`pnpm test:golden`. Logs are in the same Circle Bridge evidence directory. The golden
run used the established software WebGL configuration with WebGPU explicitly skipped.

## Pont del Diable: connected crossing and sampled elevation profile

N0031 now has a deterministic source recipe in
`packages/worldgen/scripts/pont-del-diable-model.mjs`, registered with the researched-bridges
generator. Its bundle is `places/sp/sp3/n0031_pont_del_diable`.
Three connected exact-QID OSM ways cover the full route and the summit passage; the former
single western stair segment did not cover the entire bridge. The eastern Roman gateway is
independently identified by the heritage inventory.

The original mesh includes unequal Gothic arches, double voussoir rings, mixed sandstone
ashlar, north/south cutwaters, steps, iron guards, the open summit passage, and the Roman
gateway with the copper protection documented in the February 2026 restoration. It uses
369,096 triangles, four shared material graphs and no embedded images. Source/runtime GLBs
are 30,955,476 and 30,955,036 bytes.

`terrain-profile.json` preserves 255 individual ICGC responses at 85 stations/offsets, with
returned pixel coordinates and attribution. The 25 cm LiDAR surface constrains the stair
profile; the 50 cm terrain data fixes the dry western bank reference. The occluded summit
walkway is interpolated. Roof envelopes and a roughly 1 m northward offset are inferred from
samples, not asserted as an as-built survey. Source generation uses only the retained data.

All 32 current portable/shared frames were inspected. Inward cutwater faces were corrected
before final capture. Both files pass Khronos validation without errors or warnings; the
generator reproduces exact source bytes. Four graphs load once each; unloading frees all
model geometry. The shared capture fixture now explicitly supplies and records a synthetic
bank datum for placements with a separate terrain reference. Its regression test includes
this bridge. The fixture tests the real placement code but does not establish actual terrain fit.

The ledger is **233 authored / 167 complete**. Geographic and maximum-fidelity approval
remain pending for N0031: actual bank/water integration, intrados dimensions, individual
stonework, shelter/gateway depth, and fine restoration details need further review. The
new bridge is a usable preview, not an additional completed model.

The full source build ran all 22 generators and reproduced **758 generated GLBs** in
236 seconds, with all 380 existing runtime imports verified and reused. The five documented
binary masters remain separate. The lock is **`assets-aaaab1638d797f40`**. A second build
retained exactly the same model bytes. This proves source generation; it does not claim a
fresh import of every unchanged runtime file.

The rebuild also exposed stale non-render metadata in existing specs. Map-evidence hashes
now normalize LF/CRLF, the stadium generator emits the correct copyright character, and the
heritage generator retains `map-parts.json`. For 116 existing capture records, reconciliation
first recovered the exact previously reviewed spec hash, restricted differences to these
metadata fields and reversible RGB alignment statistics, and verified unchanged runtime
bytes, placements, images and material graphs. Each affected capture report retains its
previous hashes and the precise metadata edits. No image, fidelity approval or geographic
approval was replaced by this reconciliation. The resulting ledger remains **233 authored /
167 complete**, with 231 portable and 229 shared-surface reviews.

The separate-bank placement regression passed for five landmarks including N0031. Its
current source/import/placement and shared-capture checks pass. Detailed build, reconciliation
and regression logs are under `.artifacts/pont-del-diable-research/`. No release was published.

Fresh repository gates for this 233-model snapshot passed on 2026-10-02: `pnpm verify`
(including the owner-authorized npm production audit, with no known vulnerabilities),
`pnpm smoke:packed` (16 tarballs and seven templates), `pnpm docs:site:check`, and
`pnpm test:golden`. World Explorer passed all nine visual test files, with ten tests passed
and two WebGPU tests explicitly skipped under the established software WebGL configuration.
Earth View passed both visual tests. Logs are `verify-final.log`, `smoke-packed-final.log`,
`docs-site-check-final.log`, and `test-golden-final.log` in the same evidence directory.
The final read-only Git check found zero unmerged index entries, and `asset-lock.json`
parses with release `assets-aaaab1638d797f40`. These checks do not change model fidelity or
geographic approval statuses.

## Rembrandt Tower: retained Dutch roof and footprint evidence

N0623 now has an original deterministic recipe in
`packages/worldgen/scripts/rembrandt-tower-model.mjs`, registered with the signature-towers
generator. Its source bundle is `places/u1/u17/n0623_rembrandt_tower`.

The exterior includes the stepped podium, fourteen-bay granite facades, recessed corner
glazing, open crown galleries, four glazed corner towers, cross-shaped mechanical cap,
ringed beacon, parked maintenance crane and three revolving entrance doors. It has 641,134
triangles, eight materials, four shared material graphs and no embedded images. Source and
runtime GLBs are 53,779,084 and 53,778,420 bytes.

The bundle retains the public 2023 3DBAG CityJSON response and derived ground/roof evidence
under CC BY 4.0, with attribution in the source records and `content/worldgen/NOTICE.md`.
The downloaded mesh is reference evidence; the rendered geometry is independently authored.
The retained RD-to-WGS84 coordinate operation yields anchor
`[4.917060476756789, 52.34506411408192]` and heading `0.3589785079857852`. Its center is
approximately 6.7 m south of the older simplified OSM rectangle. The building's BAG identity
matches OSM way 44451577 and Q2361620. Source builds need no external data request.

All 32 current portable/shared frames were inspected. Crown undersides, louver returns,
corner glazing directions and preview framing were corrected before final capture. Both
GLBs pass Khronos validation with zero errors and warnings. Four material graphs load once
each, and unloading leaves no live model geometry. The shared placement fixture now accepts
a source-specific outline caption; N0623 credits 3DBAG instead of mislabeling it as OSM.
Existing OSM captions remain valid. Its four footprint-helper tests pass.

Maximum-fidelity and geographic approval remain pending: exact floor elevations, the
35/36-storey source discrepancy, podium returns, canopy and equipment dimensions, real
sidewalk contact and scene-level data credit display need further work. The ledger is
**234 authored / 167 complete**, including 232 portable and 230 shared-surface reviews.

The full build ran all 22 generators and produced **760 GLBs** in 239 seconds; all 381
runtime imports were already current. The five documented binary masters remain separate.
The new lock is **`assets-2d170c0629304e98`**. Current import and shared-capture checks pass
after rebuilding. Build and validation evidence is in `.artifacts/rembrandt-research/`.

Fresh repository gates for this 234-model snapshot passed on 2026-10-02: `pnpm verify`
(including the owner-authorized npm production audit, with no known vulnerabilities),
`pnpm smoke:packed` (16 tarballs and seven templates), `pnpm docs:site:check`, and
`pnpm test:golden`. World Explorer passed all nine visual test files, with ten tests passed
and two WebGPU tests explicitly skipped under the established software WebGL configuration.
Earth View passed both visual tests. Logs are `verify-final.log`, `smoke-packed-final.log`,
`docs-site-check-final.log`, and `test-golden-final.log` in the same evidence directory.
The gallery generators now emit template literals consistently, removing eight Biome
diagnostics without changing gallery behavior. A final read-only Git check found zero
unmerged index entries, and `asset-lock.json` parses with release `assets-2d170c0629304e98`.
These checks do not change model fidelity or geographic approval statuses.

## Montevideo: quay footprint and articulated exterior

N0619 now has an original deterministic recipe in
`packages/worldgen/scripts/montevideo-tower-model.mjs`, registered with the signature-towers
generator. Its source bundle is `places/u1/u15/n0619_montevideo`.

The exterior includes the offset upper tower, deep glazed loggias, circular windows,
separate facade panels and frames, stepped lower wing, open quay cantilever and braces,
rooftop water-tank sculpture, maintenance crane and lattice M weather vane. It has 493,066
triangles, seven materials, four shared material graphs and no embedded images. Source and
runtime GLBs are 41,285,012 and 41,284,428 bytes. The weather vane uses a fixed reproducible
pose. Glazing is declared per material, including transparent loggias and entrance glazing.

The bundle retains the public 2022 3DBAG CityJSON response and derived roof and footprint
evidence under CC BY 4.0, with attribution in source records and `content/worldgen/NOTICE.md`.
The original geometry uses this data as reference. BAG 0599100000750601 matches OSM way
26545811 and Q176278. The retained RD-to-WGS84 operation supplies anchor
`[4.485968451200256, 51.90414663724574]` and heading `0.6504653523699316` radians.
The old catalog coordinate was off the building; preview placement uses the retained frame.
Architect photographs and sections, and the engineers' published floor plans, inform the
reconstruction. Source builds need no external data request.

All 32 current portable/shared frames were inspected. Brace feet, roof returns, facade
joints, M material and camera framing were corrected before final capture. Both GLBs pass
Khronos validation with zero errors and warnings. Four material graphs load once each;
unloading leaves zero live model geometries. The placement fixture credits 3DBAG, but its
flat terrain does not prove contact with the real quay.

Maximum-fidelity and geographic approval remain pending: exact facade/floor schedules,
the 43/44-level convention, pale cladding substrate, upper overhang dimensions, roof
equipment/sculpture proportions, real quay elevations and scene-level data attribution
still need verification. The ledger is **235 authored / 167 complete**, including 233
portable and 231 shared-surface reviews. This model remains a preview.

The full build ran all 22 generators and produced **762 GLBs** in 245 seconds; all 382
runtime imports were already current. The five documented binary masters remain separate.
The new lock is **`assets-9001895c83d07920`**. Import and shared-capture checks pass after
rebuilding. Build, capture and validation evidence is in `.artifacts/montevideo-research/`.

Fresh repository gates for this 235-model snapshot passed on 2026-10-02: `pnpm verify`
(including the owner-authorized npm production audit, with no known vulnerabilities),
`pnpm smoke:packed` (16 tarballs and seven templates), `pnpm docs:site:check`, and
`pnpm test:golden`. Source validation checked 567 logical bundles across the repository.
World Explorer passed all nine visual test files, with ten tests passed and two WebGPU
tests explicitly skipped under the established software WebGL configuration. Earth View
passed both visual tests. Logs are `verify-final.log`, `smoke-packed-final.log`,
`docs-site-check-final.log`, and `test-golden-final.log` in the same evidence directory.
The final read-only Git check found zero unmerged index entries, and `asset-lock.json`
parses with release `assets-9001895c83d07920`. These gates do not change model fidelity or
geographic approval statuses. No release was published.

## One Canada Square: published facade modules and separate lower envelope

N0222 now has an original deterministic recipe in
`packages/worldgen/scripts/one-canada-square-model.mjs`, registered with the signature-towers
generator. Its source bundle is `places/gc/gcp/n0222_one_canada_square`.

The model includes the stepped corners, individual metal panels and recessed paired windows,
four narrower upper storeys, western terrace, folded pyramid louvres and nine four-wing
revolving entrances. Published window dimensions are 1.8 by 2.75 m; typical floor intervals
are 4.11 m and level 50 is 4.71 m. Internal plan dimensions remain distinct from reconstructed
outer dimensions. The asymmetric lobby follows the retained exact-QID OSM footprint.

There are 964,326 triangles, 1,916,364 unique position vertices, seven materials, four shared
graphs and no embedded images. Removing hidden overlapping window-frame faces reduced the
initial export without removing visible details. Current source/runtime sizes are
80,565,028 / 80,564,432 bytes. GLBs remain generated outputs.

All 34 portable/shared frames were inspected, with full-resolution door, facade and placement
review. The projecting lobby roof and its returns were closed before final capture. Metallic
surfaces use the existing sky-reflection capture option; shared captures also use adaptive
clipping. Fine roof slats still alias at distant viewpoints and need future LOD treatment.
Khronos validation reports zero errors and warnings for both GLBs. Four shared graphs load
once each; unloading leaves zero live model geometries.

Maximum-fidelity and geographic approval remain pending. Door allocation, lower office datum,
roof dimensions/louvre profile, actual pavement contact and signed facade fit need further
evidence. The architect's 235 m and the council's 236 m heights use unresolved datum conventions.
The ledger is **236 authored / 167 complete**, with 234 portable and 232 shared reviews.
This model remains a preview. Build and check logs are in `.artifacts/one-canada-square-research/`.

The full source build ran all 22 generators and produced **764 GLBs** in 251 seconds;
all 383 runtime imports were current. The five documented binary masters remain separate.
No previously locked GLB bytes changed. The source and runtime One Canada Square outputs
were added to lock **`assets-cef7579934514b34`**. Current captures still match those bytes.

Fresh repository gates for this 236-model snapshot passed on 2026-10-02: `pnpm verify`
(including the owner-authorized npm production audit, with no known vulnerabilities),
`pnpm smoke:packed` (16 tarballs and seven templates), `pnpm docs:site:check`, and
`pnpm test:golden`. Source validation checked 568 logical bundles and shared-surface
validation checked 679 source/runtime GLBs. World Explorer passed all nine visual test
files, with ten tests passed and two WebGPU tests explicitly skipped under the established
software WebGL configuration. Earth View passed both visual tests. The final read-only
Git check found zero unmerged index entries, and `asset-lock.json` parses successfully.
Logs are `verify-final.log`, `smoke-packed-final.log`, `docs-site-check-final.log`, and
`test-golden-final.log` in the evidence directory above. These checks do not change the
pending geographic and maximum-fidelity review statuses. No release was published.
