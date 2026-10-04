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

## 4 World Trade Center: independent office plans and flush glazing

N0218 now has an original deterministic recipe in
`packages/worldgen/scripts/four-world-trade-center-model.mjs`, registered with the signature-towers
generator. Its source bundle is `places/dr/dr5/n0218_4_world_trade_center`.

The lower notched parallelogram and upper trapezoid are independent of the mapped retail
envelope. Geometry includes the northwest triangular terrace, individually jointed glass,
folded vertical plant louvres, tall clear lobby, revolving doors and adjacent swing doors.
Published dimensions include 297.7 m architectural height, 279.9 m occupied height, a 46 ft
lobby, five-foot glass modules and the owner's 13 ft 5 in floor interval. Office-plan scale,
translation and several vertical datums remain explicit reconstructions.

The final model has 242,702 triangles, 483,174 unique position vertices, eight materials,
five shared material graphs and no embedded images. Source/runtime sizes are
20,311,168 / 20,310,508 bytes. Both GLBs pass Khronos validation with zero errors and warnings.
All 34 current portable/shared frames were inspected. Review found and repaired open glass
seal seams and facade mullions crossing entrance openings. Opt-in capture antialiasing and
bounds-fitted sun shadows improve review of fine joints and large structures while preserving
the existing default capture path. Distant fine details still need LOD treatment; the glass
uses conventional shadow maps rather than optical transmission.

Five canonical graphs load once each, and unloading leaves zero live model geometries.
The map envelope matches exact-QID OSM way 278033587, independently corroborated by NYC
BIN 1088795. The municipal 3D archive contained no usable tower geometry at this location.
Signed facade fit, drawing registration, actual pavement contact, dimensioned office plans,
entrance allocation and roof plant still need evidence. Geographic and maximum-fidelity
approval remain pending: this model is a preview, not a completed entry.

The ledger is **237 authored / 167 complete**, with 235 portable and 233 shared reviews.
The full source build produced **766 GLBs** in 227 seconds with all 384 runtime imports current.
The lock is **`assets-30584b8357a2d622`**. Research, diagnostic renders and build logs are in
`.artifacts/four-world-trade-center-research/`.

Fresh repository gates for this 237-model snapshot passed on 2026-10-03: `pnpm verify`
(including the owner-authorized npm production audit, with no known vulnerabilities),
`pnpm smoke:packed` (16 tarballs and seven templates), `pnpm docs:site:check`, and
`pnpm test:golden`. Source validation checked 569 logical bundles and shared-surface
validation checked 681 source/runtime GLBs. World Explorer passed all nine visual test
files: ten tests passed and two WebGPU tests were explicitly skipped under the established
software WebGL configuration. Earth View passed both visual tests. The read-only Git
check found zero unmerged index entries, and `asset-lock.json` parses successfully.
The lock comparison found only the two new N0218 GLBs, with no changes to earlier binary
hashes. Logs are `verify-final.log`, `smoke-packed-final.log`, `docs-site-check-final.log`,
and `test-golden-final.log` in the evidence directory above. These checks do not approve
the pending geographic or maximum-fidelity reviews. No release was published.

## Edifício Copan: curved brises and reusable open geometry

N0223 now has an original deterministic recipe in `packages/worldgen/scripts/copan-model.mjs`,
registered with the heritage-towers generator. The geographic source bundle is
`places/6g/6gy/n0223_edificio_copan`. Its references include the FAUUSP conservation study,
the architect's foundation, IBGE's site report and restoration-contractor photographs.

The mapped S-shaped slab has three projecting brise blades per typical floor, recessed
glazing, distinct rear glazed and perforated facades, three open helical stairs, a rounded
lift tower, end-wall slit windows and provisional gallery/roof geometry. Screen cells have
real openings and reveals; stair flights include treads, cores, landings and balustrades.
Eleven reusable meshes form 1,059 instances. The assembled model contains 2,715,884 triangles,
while the GLB stores 119,600 mesh triangles and 211,818 unique position vertices. Source and
runtime files are 9,111,604 and 9,108,584 bytes. Seven materials use five shared graphs with
no embedded images. Glass is separated from the matte recess material.

All 34 current portable and world-viewer frames were inspected. The initial placement
review caught roof enclosures extending outside the slab; these now sit fully inboard.
The roof-plan camera was widened. Shared graphs load once each, and unloading leaves zero
live model geometries. The nearby Edifício Itália falls within the query radius and is hidden
in the isolated capture fixture. Both GLBs pass Khronos validation with zero errors or warnings.
The validator does not validate EXT_mesh_gpu_instancing; additional transform/count checks
and the Molen captures exercise the assembled geometry. Fine brises/screens still need LOD
treatment at distance.

The 115 m height and 32 residential storeys follow IBGE. Mapped height/level counts and the
published plan's scale remain unresolved. The wider commercial/cinema podium, stair access
portals and measured flight details, floor datums, brise sections, screen module, roof layout,
signed facade registration and street slope remain pending. This architectural reconstruction
omits temporary restoration netting and does not claim restoration is complete. Geographic
and maximum-fidelity approval remain pending; Copan is a preview.

The full source rebuild produced 768 GLBs in 293 seconds, with 385 current runtime imports.
Lock `assets-ac614b1250565811` adds only Copan's source/runtime pair; all earlier binary hashes
are unchanged. Research, validation, contact sheets and build logs are in
`.artifacts/copan-research/`. GLBs remain ignored build outputs.

The ledger is **238 authored / 167 complete**, with 236 portable and 234 shared reviews.
Copan's source hash is `c4c9e68eea0b187848462527b490d915d0b5423f4923694f5af923fae3e643fa`;
its runtime hash is `11dd3f30906396e248a9503943d069d14f3e64c2dfcc4d9483d11a156541e1fa`.

Fresh repository gates for this 238-model snapshot passed on 2026-10-03: `pnpm verify`
(including the owner-authorized npm production audit, with no known vulnerabilities),
`pnpm smoke:packed` (16 tarballs and seven templates), `pnpm docs:site:check`, and
`pnpm test:golden`. Source validation checked 570 logical bundles, shared-surface validation
checked 683 source/runtime GLBs, and all 768 locked GLBs matched. World Explorer passed nine
visual test files with ten passing tests and two explicitly skipped WebGPU tests under the
software WebGL configuration. Earth View passed both visual tests. The read-only Git check
found zero unmerged index entries, and `asset-lock.json` parses successfully. Logs are
`verify-final.log`, `smoke-packed-final.log`, `docs-site-check-final.log`, and
`test-golden-final.log` in `.artifacts/copan-research/`. These checks do not approve Copan's
pending geographic or maximum-fidelity reviews. No release was published.

## First Canadian Place: shared frit and reusable facade floors

N0227 now has an original deterministic recipe in
`packages/worldgen/scripts/first-canadian-place-model.mjs`, registered with the signature-towers
generator. Its geographic source bundle is `places/dp/dpz/n0227_first_canadian_place`.
References include the recladding design architect, B+H's renewal study and finished colonnade
photograph, Brookfield's leasing plan and building specifications, Halsall's facade-engineering
presentation, the height registry and original 2022 rooftop photography. Construction and
design-option images are distinguished from completed-building evidence.

The post-2012 facade has four recessed bronze corners, individually jointed white glass
spandrels, paired vision lights, a recessed lobby colonnade, door hardware, BMO crown panels,
roof plant and three detailed masts. The owner's 12 ft 8 in average slab interval, 10 ft mullion
spacing and 23 ft lobby ceiling inform the working grid. These dimensions came from extracted
specification text; the separate leasing plan was inspected visually. The 298.1 m architectural
height, 355 m tip and 287.1 m highest occupied floor are distinct datums. The working 289.9 m
body parapet is photograph-based and remains unverified.

Four reusable meshes form 70 instances, including 67 copies of the typical office floor.
The complete assembly contains 1,246,424 triangles; the GLB stores 165,344 mesh triangles
and 314,868 unique position vertices. Source and runtime files are 13,332,416 and 13,330,824
bytes. Ten materials use six canonical graphs, without embedded images. Instancing avoids
duplicated stored facade geometry; it does not remove its rendered triangles.

The new `glass_frit_triangular` graph provides smooth backed glass with triangular ceramic
frit. Its 50 mm pitch is inferred from photography. It uses metric UVs, a reusable neutral
base-color pattern and constant response factors, with no relief normal or alpha cutouts.
It brings the central library to 68 graphs. The refreshed inventory covers 685 structure
source/runtime GLBs, with zero shared-binding issues. Eight tiny embedded fallback PNGs
remain generated from canonical graphs; no new texture artwork was extracted.

All 36 current portable and world-viewer frames were inspected. Initial render review caught
poorly aimed detail cameras and opaque backing behind lobby glazing. The corrected glazing
has perimeter seals, visible floor behind it and a closed lobby ceiling. Portable fallback
cladding is plain white; the world viewer resolves the shared triangular frit in closeup.
Thin mast members and guy wires still need distance LOD treatment. Shared graphs each load
once, and unloading leaves zero live model geometries. Both GLBs pass Khronos validation
with zero errors or warnings. The validator cannot validate EXT_mesh_gpu_instancing; separate
transform/count/bounds checks and actual Molen renders verify the assembly.

The cached exact-QID map frame supplies a preview at [-79.381691573, 43.648765146] with
heading 0.277301287909. The independently inferred notched rectangle is close to the map
outline, without a forced fit. The wider three-level retail podium is not authored. Measured
floor and crown allocation, panel counts, frit pitch, mast positions, secondary antenna heights,
exact lettering, doors and colonnade allocation remain reconstruction work. Signed site
registration, street slope and ground contact remain unapproved. Geographic and maximum-fidelity
reviews are pending; this model is a preview and does not increase the complete count.

The ledger is **239 authored / 167 complete**, with 237 portable and 235 shared reviews.
Source hash: `5dc99b60279e3f56bb1160090988d33712948200c508b9efa5028b4f8ff34b13`.
Runtime hash: `cb9de2e0e5116c0b49062e5ba2fe23361e9a8643c8248180739b3d67acbb3be9`.
Research, validation and contact sheets are in `.artifacts/first-canadian-place-research/`.

The full source rebuild produced 770 GLBs in 170 seconds, with 386 current runtime imports.
Lock `assets-d053e9485966f92e` adds only First Canadian Place's source/runtime pair; every
earlier binary hash is unchanged. GLBs remain ignored build outputs. The initial repository
gate detected the old material count in the generated style-pack description; regenerating
the structure resource index corrected it to 68.

Fresh repository gates for this 239-model snapshot passed on 2026-10-03: `pnpm verify`
(including the owner-authorized npm production audit, with no known vulnerabilities),
`pnpm smoke:packed` (16 tarballs and seven templates), `pnpm docs:site:check`, and
`pnpm test:golden`. The material-library test's previous 67-graph expectation was updated
to 68, and its five tests and the full suite passed. Source validation checked 571 logical
bundles, shared-surface validation checked 685 source/runtime GLBs, and all 770 locked GLBs
matched. World Explorer passed nine visual test files with ten passing tests and two explicitly
skipped WebGPU tests under software WebGL; Earth View passed both visual tests. Read-only Git
checks found zero unmerged index entries and no whitespace errors. Logs are `verify-final.log`,
`smoke-packed-final.log`, `docs-site-check-final.log`, and `test-golden-final.log` in
`.artifacts/first-canadian-place-research/`. These checks do not approve the outstanding
geographic or maximum-fidelity work. No release was published.

### Next candidate: Two Prudential Plaza research

N0228 primary research is saved in `.artifacts/two-prudential-research/`. The owner's
[leasing plans for floors 28–30](https://www.theprulife.com/wp-content/uploads/2021/06/OTP_Large-Block-Plans_All-28-30.pdf)
were retrieved; pages 3 and 5 were visually inspected. Their north arrow and street labels
establish the long north-south axis and projecting central north/south bays, with differing
corner treatment on the two floors. They do not provide a dimensioned scale. The marketed
22,000 ft² floor area must not be equated to the gross building footprint.

The [height registry](https://www.skyscrapercenter.com/chicago/two-prudential-plaza/489)
gives 303.3 m architectural/tip height, 250 m highest occupied level and 64 floors.
The [concrete contractor's page](https://mchughconcrete.com/projects/two-prudential-plaza/)
agrees on 995 ft height but contradicts itself with 60 and 68 storeys. These values are
recorded separately. Dimensioned plan, setback/crown levels, facade grid and material finish,
signed site placement and the shared lobby/plaza boundary remain research work. This candidate
had no authored model at the research checkpoint. The reconstruction below now supplies its
source and runtime preview; completion approval remains pending.

The owner's [April 2024 photo brochure](https://www.theprulife.com/wp-content/uploads/2024/04/Pru_FilmingScoutBrochure_April2024.pdf)
also supplies inspected views of Lake Street Plaza, entrance paving and planters, the tall
glazed lobby and the relationship with One Prudential. Its terrace pictures describe the shared
complex; they do not establish a terrace on Two Prudential's crown. The crown remains partly
occluded in these photographs; the reconstruction below adds original exterior photographs.

### Two Prudential Plaza source reconstruction — 2026-10-03

N0228 now has a deterministic recipe in
`packages/worldgen/scripts/two-prudential-plaza-model.mjs`, registered with the signature-tower
generator. Source evidence and reviews live in
`places/dp/dp3/n0228_two_prudential_plaza/`; the matching runtime sidecar uses the same geography.
Original 2012 photographs by Chicago Architecture Today and a 2016 photograph by MusikAnimal
were inspected alongside the owner plans. References are linked and attributed in the source
bundle; no photographs or downloaded meshes are used as model content.

The reconstruction includes individual granite joints and arrises, window reveals and sills,
glazed central strips, two lower chevron setback sequences, the upper diamond crown, segmented
80-foot spire, tall lobby glass, doors and handles. The first render revealed a detached short
pyramid. A second geometry pass made the crown intersect the upper facade, trimming floor
plates and facade modules to four roof planes. The smooth roof slope and level setback caps
still need to become the exact photographed terracing and angled cap profiles.

The current GLB stores **45,962 unique triangles** in **14 meshes**, with **3,789 instances**
producing **894,844 expanded triangles**. Source size is **5,546,212 bytes** and runtime size
is **5,542,624 bytes**. Eight material bindings reuse four canonical graphs (granite, concrete,
painted metal and stainless steel) plus local PBR glazing. There are **zero embedded images**.
The full instance count, transforms, triangle total and 303.3 m assembled height were checked
independently. Khronos validation reports zero errors and zero warnings for both GLBs; its
77 informational messages include unsupported GPU-instancing and unused fallback attributes.

All **17 portable and 17 shared-material captures** were inspected. The four shared graphs each
load once and viewer eviction leaves zero live model geometries. The map-outline fixture uses
the exact-QID Chicago anchor and the north/south axis established by the owner plan. It does
not prove real terrain contact, signed entrance placement or the neighboring shared site.
The wider plaza, stairs, sculpture, planting, lobby connection and podium remain unauthored.
Floor allocation, bay dimensions, chevron heights and crown details remain reconstructions.
Geographic and maximum-fidelity reviews are explicitly pending.

The ledger is **240 authored / 167 complete**, with 238 portable and 236 shared reviews.
Source hash: `bc16932d1b6a6598c4b62fa75e08291169989a8802d1b456a5fe2392c379d291`.
Runtime hash: `08d9791247edb1b42a025965caf104aeb76c75dd2b886d7f00f1e4693cb05108`.
Validation, contact sheets and local build logs are in `.artifacts/two-prudential-research/`.

The full rebuild produced **772 GLBs** in 162 seconds, with 387 current runtime imports.
Lock `assets-c5f319d74d9f0125` adds only this source/runtime pair; all 770 previous locked
hashes remain unchanged. The refreshed texture inventory covers 687 structure GLBs and
342 authored masters, with no invalid bindings and no additional embedded image bytes.

`pnpm verify` passed, including the already authorized production audit (no known
vulnerabilities), and `pnpm smoke:packed` passed for 16 tarballs and seven templates. The owner
then corrected the excessive per-model verification cadence. The remaining broad gate runner
was stopped during `docs:site:check`; `test:golden` was not run for this snapshot. These two
checks are not reported as passed. The targeted model validations and 34 inspected captures
above are current. `AGENTS.md` and `content/ASSET-PACKS.md` now preserve the owner's targeted
model workflow: no repeated whole-repository rebuilds or dependency audits for each model.

### Next candidate: Istanbul Sapphire research

N0229 research is saved in `.artifacts/istanbul-sapphire-research/research-notes.json`.
The [architect's project description](https://www.tabanlioglu.com/project/sapphire/) and its
Murat Germen exterior photograph were inspected. They establish a double facade, vertical
gardens, four residential zones and a glass skin curving outward into the retail canopy.
These require distinct geometry and a wider site frame than the cached rectangular tower part.

The [registry record](https://www.skyscrapercenter.com/building/torre-costanera/748) is explicitly
titled Sapphire Tower, Istanbul despite its misleading URL slug. It records 261 m tip and
architectural height, a 234.9 m observatory, 55 above-ground floors and ten basement floors.
Cached exact-QID OSM way 673790538 instead tags 235 m and 64 levels on a building part.
Keep these datums separate. Floor plans, the upper blade/crown, facade cavities, signed canopy
orientation and the retail podium remain to be researched. The following reconstruction now
provides N0229's source and runtime preview; it does not constitute completion approval.

### Istanbul Sapphire source reconstruction — 2026-10-03

N0229 is authored by `packages/worldgen/scripts/istanbul-sapphire-model.mjs`, with source
evidence in `places/sx/sxk/n0229_istanbul_sapphire/`. The architect-hosted March 2013
Architecture and Urbanism section and winter-garden photograph were inspected alongside the
exterior photograph. The recipe separates the outer weather skin from recessed apartment
glazing, projecting wood balcony fascias, rails, plants and support bands. It also includes
the end blade, curved asymmetric retail canopy, mall galleries, observation floors and mast.
Initial renders exposed missing lower end glazing and canopy columns stopping short of the
roof; both were corrected before the final capture set.

The source stores **947,096 triangles and 1,892,360 vertices** in 21 meshes. Reused garden
sections give 35 instances and **1,547,192 expanded triangles**. The source is 79,531,556 bytes;
the runtime is 79,525,836 bytes. Five existing canonical graphs supply metal, concrete, wood
and stone finishes. There are no embedded images. The initial 184 MB output was reduced with
shared garden meshes and planar quad preservation, without a mesh-decimation step.

The owner questioned the remaining size. Measured runtime storage is 22,708,320 bytes of
positions, 22,708,320 of normals, 15,138,880 of UVs, 5,677,080 of vertex colors and 11,365,152
of indices, plus approximately 1.93 MB of padding, transforms and metadata. Repeated facade
frames and seals are still stored separately. Further reusable geometry is a required
optimization target; a shared texture library alone does not solve this geometry duplication.

Khronos validation has zero errors/warnings on both files. Independent transform/count/bound
checks cover GPU instancing, which the validator does not support. All **18 portable and
18 shared-material frames** were inspected. All five shared graphs are read once each; viewer
unload leaves zero live model geometries. The exact-QID tower-part anchor is retained, but the
flat outline fixture does not prove the wider canopy boundary, its signed direction or real
ground contact. Roof datums, facade divisions, detailed planting and site fit remain pending.
This model is **not counted complete**.

The ledger is **241 authored / 167 complete**, with 239 portable and 237 shared reviews.
The targeted generator `--ids=N0229 --check` reproduced the current bytes after source formatting.
No repository-wide builds or dependency audits were run for this model. A local
`assets:build --no-generate --update-lock` checkpoint took 25 seconds and pins 774 GLBs in
`assets-4004fddbffb6150d`; only Sapphire's source/runtime pair was added, with all 772 prior
hashes unchanged. This is a local inventory checkpoint, not a fresh full-source rebuild.

Source hash: `506abc7a5d43de50edd7d0ef1d4612782a8051f90d4c66633c9cc6b57feffad9`.
Runtime hash: `6d9ff0dce95bf6b3cdf8225f85d664d6cd9dfe03a531048a39e9623153444a7f`.

### Next candidate: Nina Tower research

N0230 needs the full two-tower complex and curved skybridge over its shared podium.
The [height registry](https://www.skyscrapercenter.com/building/nina-tower/421) gives the tall
tower 320.4 m tip, 301.1 m highest occupied level and 80 floors. Its separate `/104` record
describes the earlier 518 m proposal and must not be substituted for the built structure.
The [hotel's 2024 factsheet](https://www.ninahotelgroup.com/media/iy4ffnai/240315-tww-fact-sheet-en.pdf)
identifies tall Tower 2 and shorter Tower 1, with the connection at labelled level 41. Marketing
floor numbers are distinct from counted floors. The
[2018 planning report](https://www.tpb.gov.hk/en/papers/MPC/TWK/A_TW_497/A_TW_497_Main_Paper_final.pdf)
records an eight-storey podium, 36- and 72-storey towers and two basement levels; its drawing
attachments should provide a stronger site and podium frame. An indexed
[review annex](https://www.tpb.gov.hk/en/papers/TPB/TWK/A_TW_497_RV/A_TW_497_RV_Annex%20b.pdf)
contains plan and section drawings, but their pixels have not yet been inspected. No Nina
model is authored at this checkpoint. Geometry reuse for Sapphire is the immediate follow-up.

### Nina Tower source reconstruction — 2026-10-04

N0230 now has an original deterministic recipe in `packages/worldgen/scripts/nina-tower-model.mjs`
and a source bundle at `places/we/wec/n0230_nina_tower/`. The hotel factsheet, planning annex
plans/sections and Sika's exterior reference were inspected. The model includes both rounded
towers, curved open crowns, refuge louvres, modular facade bays, enclosed curved skybridge,
triangular bridge trusses and a shared podium. Entrances and the podium are still schematic.
An entrance attachment error and an obstructed corner camera were corrected during review.

The 9,209,716-byte source stores 86,792 unique mesh triangles in 16 meshes. Its 11,956
instances expand to 1,313,564 triangles. The runtime master is 9,159,960 bytes. Four existing
canonical material graphs supply metal, concrete and stone; there are no embedded images.
All 14 portable and 13 shared-material captures were inspected. Shared graphs each load
once, and eviction leaves zero live model geometries. Source/runtime Khronos validation has
zero errors or warnings; independent checks cover the unsupported GPU-instancing extension.

The first automatically reduced skyline distorted the towers and crowns. A source-authored
skyline now preserves their openings and bridge in 64,612 bytes. The normal LOD/release
generator applies this override and fingerprints its recipe independently, preserving other
models' current hashes. District, street and closeup levels are approximately 5.32, 6.16 and
27.82 MB. The optional closeup is larger than the instanced master because reduction flattens
instances. Initial loading uses the skyline. Physical device performance remains unmeasured.

The geographic anchor is unresolved. The planning drawing gives a provisional local frame;
the catalog coordinate is not a verified tower center. OSM endpoints returned 406/429 during
research. The placement is an **inactive draft**, with footprint replacement disabled.
Maximum exterior fidelity and geographic fit are pending; this model is not counted complete.

The inventory is now **344 registered structures**: 242 from the next-1000 plan and 102 older
landmarks/reusable structures. The next-1000 ledger remains **167 complete**, with 758 models
still unauthored. Current source/runtime reproducibility, geometry, shared materials and the
four LODs passed targeted checks. Authored-LOD tests cover determinism, download/layout budgets,
cache reuse, missing-file repair and stale-master rejection. No repository-wide build or
dependency audit was run for this addition.

Source hash: `6c5ae84b36dc718b7eba3ae710b8a07c3f0542674f4ad442c0a7c0abe0d51cd8`.
Runtime hash: `5b9320f3f88c3e1f6298a1ef28f979e9a1ca563dd022dd0bea915db10368b178`.
Reference metadata and reviews live with the source; local logs and validation evidence are in
`.artifacts/nina-tower-research/`. Gran Torre Costanera and China World Tower have useful
primary reference leads and exact-QID cached footprints for the next authoring pass.

Inventory checkpoint `assets-19e39e204a72169c` pins 2,152 GLBs. It adds only Nina Tower's
source, master and four runtime levels; all 2,146 prior hashes are unchanged. This was a
local checkpoint with targeted source reproduction, not a fresh full-catalog source rebuild.

### Gran Torre Costanera source reconstruction — 2026-10-04

N0232 now has an original deterministic recipe in
`packages/worldgen/scripts/gran-torre-costanera-model.mjs` and a source bundle at
`places/66/66j/n0232_gran_torre_costanera/`. The architect's exterior, crown and observatory
photographs and the owner's floor-60 plan and brochure were inspected. They establish four
folded, tapering walls, recessed corner strips and projecting crown screens with visible steel
lattice. The model also includes the observatory floor, glass canopy, supporting rods and doors.
Intermediate facade dimensions and entrance details remain reconstructions. The owner's
249.6 m floor-60 datum is kept separate from the marketed 300 m observatory height.

The 14,961,060-byte source stores 177,840 unique mesh triangles in four meshes. Ten instances
expand to 702,432 triangles. The runtime master is 14,959,636 bytes. Five existing canonical
graphs supply metal, concrete, wood and stone; no bitmap images are embedded. A framing
member initially extended below ground and an observatory camera sat inside the core; both
were corrected before final captures. All **15 portable and 15 shared-material frames** were
inspected. Shared graphs each load once, and eviction leaves zero live model geometries.
Source/runtime Khronos validation has zero errors or warnings; independent bounds, transform
and triangle checks cover the unsupported GPU-instancing extension.

The original authored skyline retains the tapered outline and four open crown walls in
**40,160 bytes**. District, street and closeup levels are 2,330,604, 3,293,048 and 7,332,336 bytes.
All four levels were inspected beside the master and pass geometry/layout validation. District
and street exceed their advisory triangle targets to preserve major surfaces. Initial skyline
and district downloads each fit the 3 MB phone target; physical-device performance remains
unmeasured. The authored-LOD tests pass for both Nina Tower and Gran Torre.

OSM way 1179710949 exactly matches Q1542408 and supplies the preview anchor and undirected
axis. The flat-terrain map-outline render checks visualization at that assumed datum; it does
not prove the entrance direction, actual terrain contact or neighboring site boundaries.
The signed yaw, geographic fit and maximum exterior fidelity remain pending. Surrounding
mall buildings are separate identities and are not represented by this tower model.

The catalog now has **345 registered structures**: 243 from the next-1000 plan and 102 older
or reusable structures. The plan remains **167 complete**, with **757 still unauthored**.
There are 241 current portable reviews, 239 shared-material reviews and 229 active previews.
The targeted source generator and import checks reproduce the current bytes. No whole-engine
build, full-catalog generation or dependency audit was run for this addition.

Source hash: `67a735d20dda6726824a42acf8cc91acfe5333e00eca782b923384e3ddae3e74`.
Runtime hash: `d3346545708265e7f2b59f0faf5faa8f0d22dad489728f7bab22c527aefa72b2`.
Reference metadata and reviews live with the source; local validation, contact sheets and logs
are in `.artifacts/gran-torre-research/`.

Inventory checkpoint `assets-30ed00c45e864279` pins 2,158 GLBs. It adds only Gran Torre's
source, master and four runtime levels; all 2,152 prior hashes remain unchanged. Nina Tower's
LOD recipe fingerprint was refreshed because the shared authored-LOD registry gained this
second model; Nina's GLB bytes did not change. The checkpoint took 83 seconds, reusing every
current import. It is not a fresh full-catalog source rebuild.

### China World Tower A source reconstruction — 2026-10-04

N0233 now has an original deterministic recipe in
`packages/worldgen/scripts/china-world-tower-model.mjs` and a source bundle at
`places/wx/wx4/n0233_china_world_trade_center_tower_iii/`. SOM's Tim Griffith photographs
and pages 10–11 of Meinhardt's facade brochure were inspected. The brochure establishes
600 mm external glass fins and curtain-wall planes that alternate their slope between floors.
The recipe models those features, recessed corner glazing, service louvre belts, large diamond
fins at the base, a cross-braced crown, roof helipad, separate canopies and curved vestibules.
Published floor counts differ (74, 80 and 81), so intermediate model levels are explicitly
reconstructed. The separate mall, ballroom annex and pedestrian bridges remain outside the
individual tower asset.

The 40,771,324-byte source stores 485,508 unique mesh triangles in five meshes. Seven
instances expand to **938,584 triangles**. The runtime master is 40,769,720 bytes. Four existing
canonical metal/concrete/stone graphs are shared; glazing uses local PBR and no images are
embedded. Initial renders exposed inward-facing glass panels and open corner returns. Their
winding and joins were corrected before all **16 portable and 16 shared-material captures**
were regenerated and inspected. Shared graphs each load once, and eviction leaves zero live
model geometries. Source/master validation has zero errors or warnings; independent checks
cover the validator's unsupported instancing extension.

An authored skyline retains the taper, canopy and open crown framing in **39,800 bytes**.
District, street and closeup levels are 2,034,396, 2,736,544 and 9,656,612 bytes. All four were
inspected beside the master and passed Khronos and vertex-layout checks. Skyline plus district
downloads total under 3 MB. The detailed 40.77 MB master remains separate. Fine fins alias at
distance; physical-device frame times remain unmeasured. The four targeted authored-LOD tests
passed, and the source generator/import checks reproduce the current bytes.

Exact Q2006129 map identity supplies the anchor and tower rectangle. SOM identifies hotel
entry on the east and offices on the west. The cached heading maps native -Z east and +Z west,
and the flat-terrain outline fixture was inspected with that signed frame. Exact canopy extent,
real terrain contact and adjoining site fit remain unapproved. Crown details, roof plant,
vestibules and facade dimensions remain reconstructions; the glass frit pattern and night
lighting are also pending. This is not maximum-fidelity completion.

The inventory is **346 registered structures**: **244 next-1000 models** plus 102 older or
reusable structures. The plan remains **167 complete**, with **756 still unauthored**. There
are 242 portable reviews, 240 shared-material reviews and 230 active previews. No whole-engine
build, full-catalog generation or dependency audit was run for this addition.

Source hash: `692047904356122c40524acc84d8d1b53e10088e1f63b426816b4fa7e6703ee3`.
Runtime hash: `1dc90e14f0f484acd03bb011a925a131637f683ffdae8277da008bdfa0b37b71`.
Reference metadata and reviews live with the source; local validation, contact sheets and logs
are in `.artifacts/china-world-tower-research/`.

Inventory checkpoint `assets-7d701262738accba` pins 2,164 GLBs, adding only this model's
source, master and four runtime levels. All 2,158 previous model hashes remain unchanged.
The authored-LOD registry fingerprint was refreshed for Nina and Gran Torre; their GLB bytes
did not change. This 85-second local checkpoint reused current imports and is not a fresh
full-catalog source rebuild.

### Next candidate: Palacio Barolo research

N0234 has useful primary reference leads. The
[building's historical account](https://palaciobarolo.com.ar/palacio-barolo/resena-historica/)
specifies a 30.88 m frontage on a 1,365 m² parcel, 22 floors and two basements, a 90 m dome
and a 100 m tip including the lantern. Its through-passage links Avenida de Mayo to Hipólito
Yrigoyen; the rear entrance and elevation must be researched as well as the familiar street
front. The [building's architecture page](https://palaciobarolo.com.ar/palacio-barolo/arquitectura/)
and municipal [heritage volume 15](https://buenosaires.gob.ar/areas/cultura/cpphc/archivos/libros/temas_15.pdf)
are next references to inspect visually. A FADU search result promising historic plans returned
404; its unseen drawings must not be treated as geometry evidence. No Barolo model is authored
at this checkpoint.

### Palacio Barolo source reconstruction — 2026-10-04

N0234 now has an original deterministic recipe in
`packages/worldgen/scripts/barolo-palace-model.mjs` and source bundle at
`places/69/69y/n0234_barolo_palace/`. Owner photographs, the municipal heritage book,
national heritage entry, a rear photograph and an aerial view were inspected. The recipe
models the H-plan light courts, through passage, projecting bow windows, green mansards,
paired circular balconies, pointed arches, layered cornices, ribbed crown and glazed lantern.
The documented parcel is 30.88 by 44.21 m; intermediate elevations and ornamental profiles
remain reconstructions. Height references conflict (100 versus 103 m overall; 86 versus
90 m dome), and the chosen model height is explicitly 100 m.

The source master is **49,608,172 bytes**, storing 646,738 unique triangles across four meshes.
Its 116 instances expand to **870,924 triangles**. The runtime master is 49,606,948 bytes.
Three existing canonical graphs cover concrete, painted metal and marble; glazing uses
local PBR. No images are embedded. Initial renders prompted corrections to pointed-arch
curves and pilaster placement. All **16 portable and 15 shared-material views** were then
recaptured and inspected. Each graph loads once; eviction leaves zero live model geometries.
Both source and runtime master pass Khronos validation with zero errors and warnings;
independent instance counts and transformed bounds cover the unsupported instancing extension.

Automatic reduction initially produced excessively large intermediate levels. This model now
has authored skyline, district, street and closeup recipes that omit small relief and grille
bars at distance while retaining the building's composition. They preserve canonical material
references and metric UV repeats, and store separate vertex attributes to avoid duplicated
uploads. Runtime sizes are **36,532 / 2,667,888 / 8,457,044 / 10,862,720 bytes**. Skyline plus
district total **2,704,420 bytes**, under the 3 MB initial phone target. All levels were
inspected beside the master and pass geometry and layout validation. Detailed levels still
exceed the generic triangle targets; device measurements and streaming budgets remain
necessary. Six targeted authored-LOD tests pass, including deterministic bytes, budget,
shared-surface and vertex-layout checks. Source generation and import reproduce current bytes.

Placement is deliberately **draft/inactive**. Cached OSM way 1386044833 carries Q571763 but
has a 60.285 by 43.074 m outline, inconsistent with the documented parcel width. The municipal
2026 planning annex identifies parcel **012-039-004**, which must be resolved before using
an anchor and signed orientation. The draft does not suppress neighboring map buildings.
Full rear elevation, court proportions, fine figurative ornament, inscriptions, mansard tiling,
modern equipment and measured roof profiles remain pending. This is not maximum-fidelity
completion or geographic approval.

The catalog now has **347 registered structures**: **245 next-1000 models** plus 102 older
or reusable structures. The plan remains **167 complete**, with **755 still unauthored**;
243 portable and 241 shared-material reviews are current, and 230 geographic previews are
active. Only targeted authoring/LOD checks were run for this addition.

Source hash: `5c42c7f8fb940c395cbbe2cb43631798ebe12e94090792c8b941e980c87046d8`.
Runtime hash: `c486f38e0760052fb52fd79b5f82991378bbcfcf1449bd253dc8332eab9be093`.
References and hash-bound reviews live in the source bundle; local validation, render contact
sheets and logs are under `.artifacts/barolo-research/`.

Inventory checkpoint `assets-06ba9a902beab614` pins 2,170 GLBs, adding only Barolo's source,
master and four runtime levels. All 2,164 previous model hashes remain unchanged. The three
earlier authored skyline recipes received new fingerprints because their registry now supports
authored intermediate levels; their GLB bytes are unchanged. The 89-second local checkpoint
reused current imports and is not a fresh full-catalog source rebuild.

Next sequential candidate is N0235, **Millennium Tower in Vienna (Q80495)**. Resolve its
specific identity and primary architectural references before modeling; the next candidates
N0236 Château de Montsoreau and N0237 Neuschwanstein Castle require independent heritage
research rather than reuse of the tower recipe. Barolo's geographic conflict and fine-detail
work remain recorded in its source and readiness ledger.

### Millennium Tower, Vienna source reconstruction — 2026-10-04

N0235 now has an original deterministic recipe in
`packages/worldgen/scripts/millennium-tower-model.mjs` and source bundle at
`places/u2/u2e/n0235_millennium_tower/`. Owner architecture, office grid and floor plan,
Podrecca's exterior and facade photographs, ATP's project description and the structural
engineers' abstract establish this specific Vienna tower (Q80495). Two separately fitted
circles reproduce the mapped footprint, with radial RMS residuals of 0.189 and 0.129 m.
The recipe includes the concave seam, glass spandrels, silver mullions, projecting rear
spine, entry columns, stepped screened hood, sloping glazed crown and paired braced masts.

The source master is **2,518,992 bytes**, storing 30,296 unique triangles in four meshes;
84 instances expand to **268,856 rendered triangles**. Runtime master size is 2,517,792 bytes.
Repeated office floors share geometry. Painted metal and stainless steel use existing
canonical graphs, glazing uses local PBR, and there are no embedded images. All **14 portable
and 14 shared-material views** were inspected after correcting the hood arc intersections.
Both graphs load once; unloading leaves zero live model geometries. Source and runtime
pass Khronos validation with zero errors and warnings. Independent instance counts and
transformed bounds, and the viewer's rendered triangle count, cover the validator's
unsupported instancing extension.

Automatic closeup reduction expanded the master to 9.95 MB. The model now has four authored
runtime levels, preserving its stepped silhouette while omitting subpixel facade relief.
Final levels are **22,228 / 204,916 / 1,050,636 / 3,565,420 bytes**, with
**268 / 2,646 / 15,672 / 60,880 triangles**. All four meet their planned triangle budgets.
Initial skyline plus district is **227,144 bytes**, below the phone and laptop download
targets. The closeup intentionally trades instancing and 268,856 master triangles for four
draws and 60,880 triangles. District floor-band facets were corrected after inspecting the
comparison image. All levels pass geometry and separate-attribute layout checks; seven
focused authored-LOD tests pass. Physical device performance remains unmeasured.

The map-derived placement is an **active preview**, using way/105310525's signed anchor
and heading without stretching the tower to the 140.5 m map height tag. Its flat-terrain
outline fixture matches the lobes and rear spine. Actual terrain contact, mall connections
and signed crown orientation still need a contextual review. The 140.5 m tag is provisionally
interpreted as the main body, with reconstructed 153.4 m hood and 172 m spine beneath the
documented 202 m antenna tip. Measured tier elevations, exact lamella profiles, roof equipment
and renovated entrance are outstanding. Maximum-fidelity and geographic approvals remain
pending; render integrity does not complete this candidate.

Inventory is now **348 registered structures**: **246 next-1000 models** plus 102 older or
reusable structures. The plan has **167 complete**, **754 still unauthored**, 244 current
portable reviews, 242 shared-material reviews and 231 active geographic previews.
Only the changed model was generated/imported and visually captured. Source generation and
import checks reproduce its current hashes. No engine build or dependency audit was run.

Source hash: `9b5fe07fede15c7a47aee383c0e988589cfb4da45ba0a2d2cef9076b7ea63307`.
Runtime hash: `a75353cc880488718538c9b61d331bf66cb3801377ab22227765b8d3b8a185af`.
Reference metadata and hash-bound reviews are in the source bundle; local validation and
comparison sheets are in `.artifacts/millennium-tower-research/`.

Inventory checkpoint `assets-96bc5748240c8d3f` pins **2,176 GLBs**, adding only this model's
source, runtime master and four levels. All **2,170 previous hashes remain unchanged**.
Four earlier authored-LOD sidecars received updated recipe fingerprints, with no GLB byte
changes. The 89-second local checkpoint reused all current imports; it was not a full source
rebuild. No assets were committed or published.

### Next candidate: Château de Montsoreau

N0236 (Q1143049) has a substantial primary
[regional heritage dossier, IA49009670](https://gertrude.paysdelaloire.fr/dossier/IA49009670),
with 83 illustrations and a reference to Salleron's 1886–1888 north exterior drawing. Its text
describes a tuffeau main range, two quadrangular towers, asymmetric return wings and two
different polygonal stair towers. The eastern stair tower has Renaissance relief and slate
discs in its terrace guard. Historical tower roofs are no longer present: current and historic
states must be distinguished. Its northern riverside face and southern courtyard need separate
study. The [museum's owner page](https://www.chateau-montsoreau.com/wordpress/fr/100-chateau-100-contemporain/le-chateau/)
is another primary reference. These pages were read; the dossier's image plates and drawings
have not yet been visually inspected. No N0236 geometry is authored at this checkpoint.

## N0236 Château de Montsoreau checkpoint — 2026-10-04

Added an individually authored source master and runtime asset under
`places/u0/u02/n0236_chateau_de_montsoreau/`. The regional Inventaire Général dossier,
five inspected exterior/detail photographs and the museum owner's publication establish the
current castle's distinguishing features. The source separates the two flat square terraces,
four river dormers, three courtyard dormers, unequal return wings, western pointed stair and
Renaissance stair with two rows of slate discs. Recessed cross windows, machicolations,
Gothic gables/crockets, chimney stacks and the battered river base have individual geometry.
The captured revisions fix a stair hiding one courtyard dormer and roof planes crossing the
square terraces, and correct the river window ranks against the primary photograph.

The source is **3,397,240 bytes**; the runtime master is **3,396,600 bytes**, with
**40,797 triangles**, 80,655 vertices and seven materials. Five existing shared graphs provide
limestone, raw limestone, slate, wood and painted metal. No images are embedded. All
**13 portable and 13 shared-material frames** were inspected. Each shared graph loads once;
unloading leaves zero live model geometries. Source and runtime pass Khronos validation with
zero errors and warnings. Informational unused UV attributes serve the shared surfaces.

Four independently authored runtime levels preserve the empty courtyard and distinctive
silhouette. Skyline/district/street/closeup are **69,624 / 126,448 / 600,480 / 2,654,576 bytes**,
with **873 / 1,529 / 8,221 / 35,433 triangles**. Every triangle target passes; skyline plus
district is **196,072 bytes**, below both initial download targets. Eight focused authored-LOD
tests pass, and every derivative passes geometry and separate-attribute layout validation.
The comparison fixture now fits its camera depth interval to asset bounds: its previous
1 cm–100 km range caused false district-window z-fighting. All five levels were inspected
together after that correction. Physical laptop/phone measurements remain pending.

The **active map preview** uses exact-QID OSM way/175416989's signed anchor and heading.
That feature is a castle precinct, with no building or height tag, and includes the open court.
Occupied ranges are reconstructed separately; the model does not fill the entire boundary.
Preview registration now honors explicit `replaceFootprint: false` while retaining the prior
default for other previews. A flat-terrain overlay confirms registration only. Surveyed heights,
terrain/road datum, retained walls and exact occupied bounds remain outstanding. The owner's
35 m terrace statement has an unclear datum and is not adopted as a surveyed model height.
Renaissance figurative panels, medallions, deer and putti remain unsculpted. **Geographic and
maximum-fidelity approvals remain pending**, so render acceptance does not complete N0236.

Inventory is **349 registered structures**, including **247 next-1000 authored/imported models**
and 102 older or reusable structures. The plan has **167 fully complete**, **753 unauthored**,
245 portable reviews, 243 shared-material reviews and 232 active geographic previews.
Source generation/import/placement checks reproduce N0236's exact current hashes. Work stayed
within the targeted model loop, with no engine build, dependency audit or full source rebuild.

Source hash: `240687e26cd3d6e3a759349ef19141ddba00b69ab800da659c8723431dc23a5f`.
Runtime hash: `ca0ea042ded1f01dfa79b2207165d55ac48ab2ab738e614c9db5a63a46f2ccbe`.
References, limitations and hash-bound reviews live with the source bundle; local validation
and comparison sheets are in `.artifacts/montsoreau-research/`.

Inventory checkpoint **`assets-72ce6873e9e2360a`** pins **2,182 GLBs**. Only N0236's source,
runtime master and four detail levels were added; all **2,176 previous hashes are unchanged**.
The local checkpoint reused current imports in 86 seconds. Five earlier authored-LOD sidecars
received updated recipe fingerprints without changing their GLB bytes. No Git mutation or
asset publication was performed.

### Next candidate: Neuschwanstein Castle

N0237 (Q4152) has an [official building history and labeled complex plan](https://www.neuschwanstein.de/englisch/palace/history.htm)
from the Bavarian Palace Administration. The text distinguishes the Gateway Building, Palas,
Bower, Square Tower and connecting ranges; the later Bower and Square Tower were completed
in 1892 in simplified form. Current architecture must be distinguished from unrealized designs.
The cached exact-QID map record is way/221601969, anchor `[10.749533954, 47.557554931]`,
heading `0.381105898007`. The official text was read; its plan image and exterior photographs
have not yet been inspected for this recipe. No N0237 geometry is counted at this checkpoint.
