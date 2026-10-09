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
| Target look, palette bands and polygon budgets | [medium-fi style guide](../../../docs-src/guide/medium-fi.md) |
| Corpus audit against that look, and its backlog | [MEDIUM-FI-REVIEW.md](MEDIUM-FI-REVIEW.md) |

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
   QA bound to the model's `inputHash` (the readiness ledger lists it per model). Correct
   location, compass orientation and elevation datum require their own
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

## N0237 Neuschwanstein Castle checkpoint — 2026-10-04

Added an individually arranged source master under
`places/u0/u0r/n0237_neuschwanstein_castle/`, registered through the standard importer and
catalog. The Bavarian Palace Administration's labeled plan and five detailed photographic
views establish the cranked Palas, unequal stair towers, western open galleries, Bower,
Knights' House, Square Tower, connecting ranges and two open courts. The gatehouse has
distinct red-brick outer and sandstone inner faces. Recessed paired/triple arches, dormers,
corbels, battlements, stairs and clock have geometry. Captured revisions close an eave gap,
join the main stair to the northern Palas projection, extend the base under the gatehouse,
and correct its outer fenestration and stepped-gable connections.

The source is **20,017,068 bytes**; the runtime master is **20,016,148 bytes**, with
**234,177 triangles**, 477,805 vertices and eleven materials. Nine existing canonical graphs
provide limestone, raw/weathered limestone, sandstone, slate, copper, brick, painted metal
and wood; glass and recess use local PBR materials. There are no embedded images or copied
photographic textures. All **14 portable and 13 shared-material frames** were inspected.
Each shared graph loads once, and unload leaves zero live model geometries. Source and runtime
pass Khronos validation with zero errors and warnings. Eleven informational unused-UV reports
refer to attributes consumed by Molen's shared surfaces. The shared capture succeeded despite
Vite's unrelated dependency scan warning about the traffic-signals fixture; no engine rebuild
was needed.

Four authored runtime levels preserve the castle's arrangement and open courts. Skyline,
district, street and closeup are **46,028 / 152,228 / 1,186,140 / 3,967,496 bytes**, with
**562 / 1,948 / 15,891 / 58,753 triangles**. Every triangle target passes. Skyline plus
district totals **198,256 bytes**, below both initial download targets. Nine focused
authored-LOD tests pass, and all four derivatives pass geometry and separate-attribute
layout validation. Master and all four levels were inspected together. Physical laptop
and phone performance measurements remain pending.

The map registration remains **draft**, with exact-QID OSM way/221601969's anchor
`[10.749533954, 47.557554931]` and heading `0.381105898007`. This is a whole precinct with
no building or height tag. Individual ranges are approximately transcribed from the official
plan. The cached 65 m height is unreferenced, and the two retained court levels, cliff contact,
occupied boundaries and vertical datum are not surveyed. `replaceFootprint` remains false;
the draft is discoverable in the catalog but inactive in world placement. Painted murals,
heraldic relief, statues, capitals and exact tracery still need dedicated work. **Geographic
fit and maximum exterior fidelity remain pending**; render review does not complete N0237.

Inventory is now **350 registered structures**: **248 authored/imported next-1000 models**
and 102 older or reusable models. The plan has **167 fully complete**, **752 unauthored**,
246 portable reviews, 244 shared-material reviews and 232 active geographic previews.
Source-generation, import and placement checks reproduce the current model hashes.

Source hash: `c78849de7780d2383656cb12873fabfc55a14e03a6ec92bc96be18d2d7ed3c8f`.
Runtime hash: `5e1ea57c9cd3c93d60cd5274e0e244a48903d52869e034a78932bfe3c2f5589e`.
References and hash-bound reviews are in the source bundle; local validation and comparison
sheets are in `.artifacts/neuschwanstein-research/`.

Lock **`assets-4e5f7660b5e46200`** pins **2,188 GLBs**. The lock conflict was resolved by
concurrent owner work before this checkpoint, yielding `assets-b6322d023cc8cb8d`; its four
updated aircraft files were verified locally. A broad update-lock command was rejected by
automatic approval. The completed narrower checkpoint adds only N0237's six verified files,
preserves all **2,182 prior entries exactly**, recomputes the snapshot through `createLock`,
and refuses concurrent edits. Six earlier authored-LOD sidecars receive current shared-recipe
fingerprints; all thirty of their master/LOD runtime files still match the preserved lock.
No full source rebuild, engine suite, dependency audit, Git mutation or publication was run.

### Windsor Castle research handoff (superseded by the checkpoint below)

N0239 (Q42646) is still unauthored. The Royal Collection Trust's
[building history](https://www.rct.uk/visit/windsor-castle/who-built-windsor-castle) was read:
its current exterior includes the nineteenth-century raising of the Round Tower and
Wyatville's remodelling, so earlier drawings cannot be treated as the current building.
The [owner's visitor page](https://www.rct.uk/visit/windsor-castle) and
[official family trail](https://media.rct.uk/sites/default/files/RCT%20-%20WC%20-%20CASTLES%20FAMILY%20TRAIL%20-%20A4%204PP%20-%20OUT%20with%20crops%20and%20bleed%2009%202022.pdf)
provide starting references. Their plan/photo pixels have not been inspected for this recipe.
Cached OSM way/23580556 supplies precinct anchor `[-0.604139816, 51.483842171]`, heading
`0.052063510228` and a 582.008 by 198.339 m envelope. It has no building or height tag.
The Upper, Middle and Lower Wards, chapel, cloister and separate occupied ranges require
individual reconstruction; the precinct must not be extruded as one building.

## Windsor Castle source checkpoint — 2026-10-04

N0239 now has a reproducible individual exterior recipe at
`packages/worldgen/scripts/windsor-castle-model.mjs` and a source bundle at
`places/gc/gcp/n0239_windsor_castle/`. The bundle records individual OSM ways,
courtyard holes, references, model, scene, import, placement and hash-bound render reviews.
Horizontal geometry uses the signed cached map frame; mapped palace ranges remain separate
from the gardens and open wards. The Round Tower, chapel, cloister, towers, roofs and
gateways are independently arranged. Photographs were inspected and linked; no reference
pixels or third-party mesh were copied. Seven canonical shared material graphs are reused.

The detailed source is **32,829,044 bytes**, **385,417 triangles**, **783,315 vertices**,
eight materials and zero images. The imported master is **32,828,336 bytes**.
Separate authored runtime levels preserve the master:

| Level | Bytes | Triangles |
| --- | ---: | ---: |
| Skyline | 43,248 | 521 |
| District | 78,100 | 1,101 |
| Street | 1,075,244 | 14,812 |
| Close-up | 4,639,360 | 62,481 |

Initial skyline plus district totals **121,348 bytes**. All four geometry targets pass;
separate vertex attributes avoid mixed-type GPU uploads. Physical-device measurements
remain pending. The recipe fingerprint includes Windsor's map data so geographic edits
invalidate its derivatives.

Inspected **14 portable and 13 shared-material frames**, plus the common-camera LOD
comparison. Corrected disconnected chimney bases, supported raised palace ranges and
distinguished the two-storey rectangular cloister fenestration from palace windows.
Khronos validation passed all six GLBs with **zero errors and warnings**; unused-UV
informational messages reflect Molen's external shared-surface bindings. Shared graphs
load once each, and unloading leaves zero live model geometries. Source generation
`--check` reproduces the current bytes. **11 focused authored-LOD tests pass**.

**Geographic fit and maximum exterior fidelity are pending.** The draft keeps
`replaceFootprint=false`. Cross-site elevations, motte/terrain contact, window bay spacing,
roof profiles, tracery, heraldic beasts, statues and relief require further work. Studio
render approval does not count N0239 as a completed maximum-fidelity landmark.

Current inventory: **351 registered structures**, including **249 authored/imported
next-1000 models**, **167 fully complete**, and **751 unauthored**. Portable reviews are
247; shared-material reviews are 245; active geographic previews remain 232.

Source hash: `e9e70f934d7a05e8f2c5b4d091c1759e1dfacf58f82306cc6c85dc8e93c90396`.
Runtime hash: `6032a6df55310e3b3b0bba716c2ae47cf0c1947a225f5854984a09b89d01d573`.
Lock **`assets-bf11c2155d6cd5e9`** pins **2,194 GLBs**: only Windsor's six entries were
added, with all 2,188 previous entries preserved exactly. The seven earlier authored-LOD
sidecars have current shared-recipe fingerprints; their 35 master/LOD files still match
the prior lock. No full rebuild, engine suite, dependency audit, Git mutation or
publication was run. **N0240 Prague Castle is the next unauthored candidate.**

## Prague Castle source checkpoint — 2026-10-04

N0240 now has an individual recipe at `packages/worldgen/scripts/prague-castle-model.mjs`
and source bundle at `places/u2/u2f/n0240_prague_castle/`. Individual attributed OSM
polygons retain the palace court holes, cathedral chapel and tower positions, churches,
palaces and Golden Lane houses. The owner's illustrated plan and three exterior
photographs were inspected; references and their use are recorded in the bundle.
Nine existing shared material graphs are reused, including lime plaster and ceramic tile.

The source master is **47,961,476 bytes**, **567,918 triangles**, **1,142,800 vertices**,
ten materials and zero embedded images. The imported master is **47,960,628 bytes**.
Separate authored viewer levels preserve this detailed source:

| Level | Bytes | Triangles |
| --- | ---: | ---: |
| Skyline | 62,276 | 761 |
| District | 282,988 | 3,777 |
| Street | 978,708 | 13,490 |
| Close-up | 5,072,848 | 63,278 |

Initial skyline plus district totals **345,264 bytes**. All four triangle targets pass.
Inspected 14 portable and 13 shared-material frames and the common-camera LOD comparison.
Corrected reversed palace facade direction, unsupported roof wedges over narrow lanes,
and the Golden Lane camera. Subordinate roof slopes are clipped to occupied map polygons
with filled raking end walls. The western, cathedral and eastern courts remain open.
All six GLBs pass Khronos validation with **zero errors and warnings**; unused-UV
informational messages are expected for externally resolved shared materials.
Shared graphs load once each, and unloading leaves zero live model geometries.
Source generation `--check` reproduces the master; **13 focused authored-LOD tests pass**.

**Geographic fit and maximum exterior fidelity remain pending.** The signed map anchor
is `[14.401732746, 50.090863652]`, heading `0.33583241035`. Cross-site ground elevations,
roof valleys, exact facade bays, sculptured tracery, saints, the summit lion, Golden Gate
mosaic and Daliborka require further work. Golden Lane colors are approximate. Placement
stays draft with `replaceFootprint=false`. Physical-device performance measurements are
also pending. Studio render integrity does not certify architectural or geographic accuracy.

Inventory now has **352 registered structures**, including **250 authored/imported
next-1000 models**, **167 fully complete**, and **750 unauthored**. Portable reviews are
248; shared-material reviews are 246; active geographic previews remain 232.

Source hash: `80beee517c6a4c2b3e50ceea71e4e24d6270c97381b6f2b3d11533180f662ff0`.
Runtime hash: `0715c75083351a20d4bc7ad4e62c046a9800399711a6771a38d44132db04171d`.
Lock **`assets-c821a6356fc84326`** pins **2,200 GLBs**: added Prague's six validated files
and preserved all 2,194 preceding entries exactly. The eight earlier authored-LOD sidecars
have refreshed common-registry fingerprints; their 40 master/LOD files still match the
previous lock. No repository-wide rebuild, engine suite, dependency audit, Git mutation
or publication was run. **N0241 Wartburg is the next unauthored candidate.**

## Wartburg source checkpoint — 2026-10-04

N0241 now has an individual recipe at `packages/worldgen/scripts/wartburg-castle-model.mjs`
and source bundle at `places/u1/u1p/n0241_wartburg/`. The exact Q151545 map point anchors
a signed meter frame from the South Tower toward the northern gatehouse. Twenty-one
attributed component ways describe buildings and walls; their envelope is not an occupied
precinct footprint. Two courtyards remain open. The owner plan and four linked exterior
photographs informed the Palas arcades, copper roof, keep and cross, white South Tower,
timber halls, projecting Vogtei oriel and covered galleries.

The source master is **18,803,828 bytes**, **227,673 triangles**, **446,281 vertices**,
ten materials and zero embedded images. The imported master is **18,802,968 bytes**.
Nine canonical shared material graphs are reused. Separate authored viewer models:

| Level | Bytes | Triangles |
| --- | ---: | ---: |
| Skyline | 80,196 | 976 |
| District | 167,236 | 2,144 |
| Street | 775,684 | 10,204 |
| Close-up | 1,629,032 | 22,843 |

Initial skyline plus district totals **247,432 bytes**. Inspected 14 portable and 13
shared-material frames plus the common-camera LOD comparison. Corrected floating chimneys,
gable materials, South Tower stair direction and roof winding, outward gate arch surfaces,
and obstructed review cameras. All six GLBs pass Khronos validation with zero errors or
warnings; unused UV information reflects externally resolved materials. Shared graphs load
once each, and unloading leaves zero live model geometries. Source generation `--check`
reproduces the master. **15 focused authored-LOD tests pass.** Physical-device performance
measurements remain pending.

**Geographic fit and maximum fidelity remain pending.** The source anchor is
`[10.3063142, 50.965902]`, heading `1.3697714204430447`. Model placement remains draft,
with `replaceFootprint=false`. The keep height is provisional: the owner's nearly 34 m
description conflicts with OSM's 40–46 m tags. The reconstructed top is 34 m, including
the documented 3.8 m cross. Court elevations, exact roof profiles, facade spacing,
Palas lions/capitals, Gothic oriel tracery and terrain contact need further work.

Inventory: **353 registered structures**, including **251 authored/imported next-1000
models**, **167 fully complete**, and **749 unauthored**. Portable reviews are 249;
shared-material reviews are 247; active geographic previews remain 232.

Source hash: `573bd5f665c287318d5bc4323cdfdba84ca83ffc8cb37f4139dd2bfe4e2e6372`.
Runtime hash: `9e41999a6648e196df41877c925edb153f83c68f87320821285478154a1cd52f`.
Lock **`assets-692ef1d30a6da0e6`** pins **2,206 GLBs**: only Wartburg's six validated files
were added; all 2,200 existing entries are preserved. Nine earlier authored-LOD sidecars
have current common-registry fingerprints and their 45 master/LOD files retain the locked
bytes. **N0242 Edinburgh Castle is the next unauthored candidate.**

## Edinburgh Castle source checkpoint — 2026-10-04

N0242 now has an individual recipe at `packages/worldgen/scripts/edinburgh-castle-model.mjs`
and a source bundle at `places/gc/gcv/n0242_edinburgh_castle/`. Attributed OSM component
polygons preserve the palace, Great Hall, Queen Anne range, memorial, chapel, barracks,
Hospital Square, gateways and defensive walls. The official plan labels and inspected
exterior photographs inform the reconstruction. Crown Square and Hospital Square remain
open. The enclosing precinct is not treated as one occupied building footprint.

The source master is **21,794,276 bytes**, **259,930 triangles**, **518,622 vertices**,
eight materials and zero embedded images. The imported master is **21,793,564 bytes**.
Seven canonical shared material graphs are reused. Separate authored viewer models:

| Level | Bytes | Triangles |
| --- | ---: | ---: |
| Skyline | 65,672 | 788 |
| District | 265,952 | 3,636 |
| Street | 964,872 | 12,770 |
| Close-up | 3,491,812 | 45,598 |

Initial skyline plus district totals **331,624 bytes**. Inspected all 14 portable and
13 shared-material frames and the common-camera LOD comparison. Corrected gate rotations,
overlapping gate-part walls, memorial doorway/window overlap and reversed stair treads.
All six GLBs pass Khronos validation with zero errors or warnings. Source generation
`--check` reproduces the master; **17 focused authored-LOD tests pass**. Seven material
graphs load once each, and unloading leaves zero live model geometries. Physical laptop
and phone measurements remain pending.

**Geographic fit and maximum fidelity remain pending.** The source anchor is
`[-3.200425671, 55.948548674]`, cached heading `-0.238261013131`. Relative ward elevations,
Castle Rock, exact gate and roof details, facade openings, heraldry, memorial sculpture and
Foogs Gate need further work. The current retaining plinths do not establish real terrain
fit. Placement remains draft with `replaceFootprint=false`.

Inventory: **354 registered structures**, including **252 authored/imported next-1000
models**, **167 fully complete**, and **748 unauthored**. Portable reviews are 250;
shared-material reviews are 248; active geographic previews remain 232.

Source hash: `4cd274cfb172ebeddbbb803c2f7f3cd6aa3140f3c27f8823e8bda61562641388`.
Runtime hash: `237f5465a63525801cde32c93ddba3c8b2b5d39102ef9c8a0ad1f09ed1868f7c`.
Lock **`assets-188597fa0ccb3703`** pins **2,212 GLBs**: only Edinburgh's six validated files
were added; all 2,206 previous entries were preserved exactly. Ten earlier authored-LOD
sidecars have refreshed registry fingerprints and their 50 master/LOD files retain their
locked bytes. **N0243 Malbork Castle is the next unauthored candidate.**

## Malbork Castle source checkpoint — 2026-10-04

N0243 now has an individual recipe at `packages/worldgen/scripts/malbork-castle-model.mjs`
and source bundle at `places/u3/u3t/n0243_malbork_castle/`. The source records 103 attributed
OSM features. The exact Q71279 relation covers the High and Middle Castle precinct; named
Lower Castle buildings and towers extend the component frame northward. High Castle retains
its courtyard hole, raised Dansker gallery and keep. Middle Castle retains its U-shaped court,
Grand Masters Palace and open entry. Lower Castle includes Karwan, St Lawrence, service
ranges and defensive towers. The envelope is not an occupied replacement footprint.

The detailed source master is **44,329,516 bytes**, **516,537 triangles**, **1,059,079 vertices**,
seven materials and zero embedded images. The imported master is **44,328,876 bytes**.
Six existing material graphs supply brick, ceramic tile, limestone, granite, wood and painted
metal; glazing remains local PBR. Separate authored viewer models:

| Level | Bytes | Triangles |
| --- | ---: | ---: |
| Skyline | 78,648 | 964 |
| District | 233,176 | 3,170 |
| Street | 1,035,396 | 15,350 |
| Close-up | 3,672,768 | 51,343 |

Initial skyline plus district totals **311,824 bytes**. Skyline omits curtain walls and minor
outbuildings while retaining principal wards, open courts and major towers. Inspected all
14 portable and 13 shared-material views plus the common-camera LOD comparison. Corrected
cloister arches below ground, windows crossing courtyard offsets, inward-facing passage
spandrels, solid gate obstructions and bridge-end railings. All six GLBs pass Khronos validation
with zero errors or warnings. The source `--check` rebuild reproduces the master and **19
focused authored-LOD tests pass**. Six graphs load once each; unloading leaves zero live model
geometries. Physical phone and laptop measurements remain pending.

**Geographic fit and maximum fidelity remain pending.** Anchor `[19.027655287, 54.03991349]`,
heading `0.857051662697`, draft placement and `replaceFootprint=false`. The museum ticket
site describes a nearly 70 m tower without a datum; the current ground-relative 46 m crown
is explicitly provisional. Terrain, moat depths, exact roof joins, windows, dormers, church
Madonna mosaic, fine tracery and complete outer earthworks need further work. Current render
integrity approval does not certify those architectural or geographic details.

Inventory: **355 registered structures**, including **253 authored/imported next-1000
models**, **167 fully complete**, and **747 unauthored**. Portable reviews are 251;
shared-material reviews are 249; active geographic previews remain 232.

Source hash: `7edaf912ea66d093c514a74df624f5802008ee0b261c05a1f1b0217653515193`.
Runtime hash: `8be58eccd2d4389249c7e883f42f32b17b89e10de01cab001e599a1bd945f6b8`.
Lock **`assets-6182ee003d4146e8`** pins **2,218 GLBs**: Malbork's six validated files were
added while all 2,212 prior entries were preserved. Eleven earlier authored-LOD sidecars
have refreshed registry fingerprints; all 55 earlier master/LOD files still match their
locked bytes. The shared capture emitted an unrelated stale terrain-export dependency-scan
warning, but completed every landmark frame and unload check. **N0244 Kronborg Castle is
the next unauthored candidate.**

## Kronborg Castle source checkpoint — 2026-10-04

N0244 now has its own recipe at `packages/worldgen/scripts/kronborg-castle-model.mjs`
and source bundle at `places/u3/u3b/n0244_kronborg_castle/`. Thirteen attributed OSM
features, the north-east lighthouse node, museum plan, aerial views and courtyard views
establish the horizontal reconstruction. Separate wings keep the courtyard and north
passage open. The model distinguishes the flat Cannon/Telegraph Tower, tall Trumpeter,
three other corner spires, four domed stair turrets, copper roofs and Renaissance gables.
Selected mapped moat/embankment edges define the bastion extent.

The preserved source master is **28,246,264 bytes**, **337,000 triangles**, **672,132 vertices**,
ten materials and zero embedded images. Eight canonical material graphs provide sandstone,
limestone, copper, granite, brick, timber, painted metal and gilded-metal surfaces. Glazing
and turf remain local PBR. The imported master is **28,245,400 bytes**.

| Level | Bytes | Triangles |
| --- | ---: | ---: |
| Skyline | 77,208 | 958 |
| District | 260,268 | 3,316 |
| Street | 868,416 | 11,238 |
| Close-up | 1,659,508 | 21,684 |

Initial skyline plus district totals **337,476 bytes**. Skyline omits small stair turrets
and gable ornament while preserving the main silhouette, courtyard and entrance opening.
Inspected all 14 portable and 13 shared-material views plus the common-camera LOD comparison.
Corrected shutters hidden behind dormer faces and an inspection camera intersecting a tower.
All six GLBs pass Khronos validation with zero errors or warnings; the source is reproducible.
**21 focused authored-LOD tests pass**. Each of eight material graphs loads once; unloading
leaves zero live model geometries. Physical phone and laptop measurements remain pending.

**Geographic fit and maximum fidelity remain pending.** Anchor `[12.621716106,56.039011686]`,
heading `1.482790729732`, draft placement and `replaceFootprint=false`. The CBS study p.57
reports Trumpeter height as 59 m above the courtyard / 62 m above water. The reconstructed
five-meter courtyard elevation above fortress wall foot is provisional. Other tower heights,
exact openings, roof joins, copper patches, clock faces, heraldic sculpture and complete
outer crownwork/ravelins require refinement. Render-integrity approval does not certify them.

Inventory: **356 registered structures**, including **254 authored/imported next-1000 models**,
**167 fully complete**, and **746 unauthored**. Portable reviews are 252; shared-material
reviews are 250; active geographic previews remain 232.

Source hash: `19d963e651b26285ce37f136aac82dd41fe21fb689ca37b4cd863a8501e18e9a`.
Runtime hash: `60873fb83873e7f54c078f5cf574734c5863ff19b83ae8b54e26941b00d1414d`.
Lock **`assets-2df7416071d762b4`** pins **2,224 GLBs**: only Kronborg's six validated files
were added, preserving all 2,218 previous entries. Twelve earlier authored-LOD sidecars have
refreshed registry fingerprints; all 60 earlier master/LOD files retain their locked bytes.
The shared-capture fixture again emitted the unrelated stale terrain-export dependency-scan
warning but completed every landmark frame and unload check. **N0245 Hofburg Palace is next.**

## 2026-10-04 — Hofburg Palace source and runtime checkpoint

Added **N0245 Hofburg Palace** as an individual source recipe with attributed map parts,
reference observations, import, draft placement and four browser LODs. The model follows
separate palace wings and open courts, the Michaeler domes and mapped columns, Amalien clock,
Neue Burg curve and colonnade, library dome, Augustinian spire, Stallburg, Albertina terrace
and Palmenhaus. Source: `places/u2/u2e/n0245_hofburg_palace/`.

The source master contains **606,293 triangles**, **1,258,179 vertices**, eleven material
slots and **zero embedded images**. Ten canonical material graphs cover limestone, carved
stone, lime plaster, ceramic tile, slate, copper, granite, timber, painted metal and gilding.
Glazing remains local PBR. Source bytes: **52,576,076**; imported master: **52,575,140**.

| Level | Bytes | Triangles |
| --- | ---: | ---: |
| Skyline | 66,800 | 819 |
| District | 340,008 | 3,946 |
| Street | 1,228,492 | 15,612 |
| Close-up | 4,891,288 | 63,398 |

Initial skyline plus district totals **406,808 bytes**. All 14 portable and 13 shared-material
views and the common-camera LOD comparison were inspected. Iteration repaired artificial roof
folds, concealed clock/drum windows, facade and rustication crossing the main passage, and
unsupported chimney repetitions. Roof fields remain faceted approximations, especially at
complex joins. Skyline simplifies roof masses and omits minor court holes and terrace details.
All six GLBs pass Khronos validation with zero errors or warnings. Source regeneration is
byte-identical. **23 targeted authored-LOD tests pass**; formatting checks pass. Ten graphs
load once each and unload leaves zero live model geometries. Physical-device tests remain pending.

**Geographic fit and maximum exterior fidelity remain pending.** Exact Q46242 relation/3898175
and named component outlines establish anchor `[16.365909858,48.20633]`, heading
`1.524057778872`. Placement stays draft with `replaceFootprint=false`. The common ground datum,
Albertina terrain contact and main passage alignment are unverified. Exact roof junctions,
opening positions, imperial sculpture, fountains, capitals, court arcades, Swiss portal,
Palmenhaus central pavilion and Albertina lower levels need further authoring. Render-integrity
reviews do not certify architectural fidelity or real-world fit.

Inventory: **357 registered structures**, **255 authored/imported next-1000 models**,
**167 fully complete**, **745 unauthored**, 253 portable reviews, 251 shared-material reviews,
and 232 active geographic previews.

Source hash: `79084a947c6c83616f25e862fab35a882027b1012e91d045614889f344256de9`.
Runtime hash: `a5eb2965947f604d0c3b1dc73ee159d70556ac247667bd87e83e8ee812e2997e`.
Lock **`assets-665e209524dc0bb9`** pins **2,230 GLBs**: six Hofburg files added, all 2,224
previous entries preserved. Thirteen earlier authored-LOD fingerprints were refreshed once;
all 65 earlier master/LOD files remain byte-identical to their pins. The capture fixture emitted
the existing unrelated `updateTerrainSurfaceSignals` dependency-scan warning; all landmark
frames and unload checks completed. No repository-wide build or npm audit was run.

**Next: N0246 Takht-e Soleyman.** The cached identity has no resolved physical footprint.
UNESCO provides an official nomination dossier and site description at
<https://whc.unesco.org/en/list/1077> and <https://whc.unesco.org/uploads/nominations/1077.pdf>.
Current ruins, site layout and terrain must be distinguished from historical reconstructions.

## 2026-10-04 — Takht-e Soleyman source and runtime checkpoint

Added **N0246 Takht-e Soleyman** as a reproducible source recipe, imported model, draft
geographic placement and four authored browser LODs. The mapped oval enclosure and spring
lake surround roofless temple rooms, western column halls, the broken west iwan, two octagonal
foundations and an oblique red-stone four-column hall. Source:
`places/tn/tn9/n0246_takht_e_soleyman/`.

The source master has **817,410 triangles**, **1,641,262 vertices**, eight material groups,
six reusable graphs and **zero embedded images**. Graphs cover coursed limestone, raw limestone,
weathered limestone, travertine, brick and sandstone; the lake and dark recesses use local PBR
colors. Source bytes: **68,898,992**; imported master: **68,898,276**.

| Level | Bytes | Triangles |
| --- | ---: | ---: |
| Skyline | 85,524 | 992 |
| District | 306,824 | 3,830 |
| Street | 681,692 | 8,872 |
| Close-up | 4,833,048 | 62,330 |

Initial skyline plus district totals **392,348 bytes**. All 14 final portable views, 13 shared
views and the common-camera LOD comparison were inspected. Corrections removed Float32 profile
slivers, repaired normals on uneven tower tops, filled gate spandrels, roughened the broken iwan
edge and turned the old gate's seven blind niches outward. Six GLBs pass Khronos validation with
zero errors or warnings; source regeneration is byte-identical. **25 targeted authored-LOD tests
pass** and formatting checks pass. Each shared graph loads once and model unload leaves zero
live geometries. Physical phone/laptop measurements remain pending.

**Maximum archaeological fidelity and geographic fit remain pending.** OSM way/203537193
matches the English Wikipedia identity and UNESCO reference 1077, but carries no Wikidata tag.
The lake is way/314769016. The anchor is `[47.23476205,36.60460215]`, heading `pi/2`;
placement stays draft with `replaceFootprint=false`. The enclosing footprint includes empty
land and water. Interior rooms are proportional interpretations of Dietrich Huff's published
phase plans, not surveyed coordinates. Individual bastion stations, erosion profiles, restored
arches and the 22 m iwan peak need measured refinement. Stone courses remain overly regular.
The 1.2 m contact slab is provisional; it does not recreate the geological mound above the valley.

Inventory: **358 registered structures**, **256 authored/imported next-1000 models**,
**167 fully complete**, **744 unauthored**, 254 portable reviews, 252 shared-material reviews,
and 232 active geographic previews. This addition is not counted as maximum-fidelity complete.

Source hash: `41b6f6084c0178b38b404cefe961b44af4931cfea734ba1b0ac5c6ea266f5901`.
Runtime hash: `cd4bb85a8565839e03ec95ad660d0dea840c750dba2cc7520a1935a247a8cef8`.
Lock **`assets-79bcff6c8a4f0dd4`** pins **2,236 GLBs**: six new files added, all 2,230 prior
entries preserved. Fourteen prior authored-LOD fingerprints were refreshed once; all 70
previous master/LOD files remain byte-identical to their pins. The first shared capture emitted
the existing unrelated `updateTerrainSurfaceSignals` dependency-scan warning; all final frames
and unload checks completed. No repository-wide rebuild or dependency audit was run.

**Next: N0247 Karlstejn Castle** (catalog title Karlštejn Castle), exact mapped identity
Q266698 / relation 6706848. Its cached 150 by 143 m enclosure has only an undirected axis;
separate palace/tower outlines, signed orientation and the stepped hill datum need research.

## 2026-10-04 — Karlštejn Castle source and runtime checkpoint

Added **N0247 Karlštejn Castle** with separately mapped Great Tower, Marian Tower,
Imperial Palace and round eastern turret, Burgrave House, well tower, gatehouses,
curtain walls and two raised covered passages. Source:
`places/u2/u2f/n0247_karlstejn_castle/`. The deterministic recipe includes window
apertures, timber galleries, half-timber framing, dormers and slate shingle relief.

The source master has **556,934 triangles**, **1,115,998 vertices**, nine material groups,
seven reusable material graphs and **zero embedded images**. Source master:
**46,864,188 bytes**; imported master: **46,863,404 bytes**.

| Level | Bytes | Triangles |
| --- | ---: | ---: |
| Skyline | 66,904 | 830 |
| District | 247,428 | 3,824 |
| Street | 1,004,492 | 13,788 |
| Close-up | 4,690,592 | 61,044 |

Initial skyline plus district totals **314,332 bytes**. All 14 final portable views,
13 shared-material views and the common-camera LOD comparison were inspected. Fixed a
zero-width timber panel, loggia apertures initially blocked by a second wall, and curtain-wall
face directions. All six GLBs pass Khronos validation with zero errors or warnings.
Source regeneration is byte-identical; **27 targeted authored-LOD tests pass** and formatting
checks pass. Seven shared graphs load once each; unload leaves zero live model geometries.
Physical phone/laptop performance remains unmeasured.

**Geographic fit and maximum exterior fidelity remain pending.** Exact Q266698 identity
matches OSM relation/6706848. Anchor `[14.187600418,49.939448506]`, heading
`0.340165327482`; placement remains draft with `replaceFootprint=false`. The enclosing
boundary includes empty courts. The Great Tower's official 60 m height and OSM 53 m height
use an unresolved datum; the seven-meter exposed-base interpretation is provisional.
Stepped terrace elevations, terrain contact, Burgrave roof junctions, obscured facade windows,
chimneys and bridge support details need measured refinement. Regular stone courses and
LOD-dependent slate contrast also need fidelity work. No maximum-fidelity approval is asserted.

Inventory: **359 registered structures**, **257 authored/imported next-1000 models**,
**167 fully complete**, **743 unauthored**, 255 portable reviews, 253 shared-material reviews,
and 232 active geographic previews.

Source hash: `2094e82b6eb86b1ab78993df6cc09a84d5a65e8fd2f108cb34bf698c82150b85`.
Runtime hash: `cb8384afda77ff8eabe62fb097b1d76e5b155e85d63d352f60b288e54cb866f6`.
Lock **`assets-949a40efa6e8e96f`** pins **2,242 GLBs**: six new files added and all 2,236
prior entries preserved. Fifteen previous authored-LOD fingerprints were refreshed once;
all 75 earlier master/LOD files remain byte-identical to their lock entries. The shared
capture fixture emitted the existing unrelated `updateTerrainSurfaceSignals` dependency-scan
warning; final landmark frames and unload checks completed. No repository-wide rebuild or
dependency audit was run.

**Next: N0248 Bran Castle**, Q390275, reference coordinate `[25.3671,45.515]`.
Research its individually shaped towers, compact courtyard, roof levels and rocky terrain
before authoring; do not substitute a generic castle.

## 2026-10-04 — N0248 Bran Castle source and runtime checkpoint

Added `places/u8/u84/n0248_bran_castle/` from a deterministic authored recipe,
OSM outer/inner rings and five mapped tower parts. The castle includes an open courtyard,
round western tower, southern stair turret, steep single-slope keep roof, scalloped rear
parapet, timber belfry, projecting eastern tower chamber, galleries, well and entrance stairs.
Official chronology, visitor map and exterior/courtyard photographs are recorded as references.

The source master has **145,600 triangles**, **333,850 vertices**, eight material groups,
six shared material graphs and **zero embedded images**. Source: **13,770,396 bytes**;
imported master: **13,769,692 bytes**.

| Level | Bytes | Triangles |
| --- | ---: | ---: |
| Skyline | 66,612 | 719 |
| District | 172,892 | 2,469 |
| Street | 311,860 | 4,389 |
| Close-up | 2,545,052 | 33,031 |

Initial skyline plus district totals **239,504 bytes**. All 14 final portable renders,
13 shared-material renders and the common-camera LOD comparison were inspected. Corrected
inward-facing tower walls and keep gables, roof junction gaps, a doorway/window overlap,
masonry crossing the entrance, a capped well and gallery walls extending above their roof.
All six GLBs pass Khronos validation with zero errors or warnings. Source rebuild is byte-identical.
Shared graphs load once each and unloading leaves zero live model geometries. Physical phone
and laptop measurements remain pending.

**Maximum exterior fidelity and geographic fit remain pending.** Exact Q390275 identity
matches OSM relation/3300200. Anchor `[25.367082771,45.515080804]`, heading
`-0.689652279939`; placement remains draft with `replaceFootprint=false`. OSM height tags
from 50 to 73 m have no verified common datum. Authored local heights, roof valleys, window
rhythms, chimney placement and four-meter rock contact are estimates. This is not a surveyed
castle or complete terrain hill. Rounded tile detail, plaster weathering and stone texture
need further refinement; material contrast still differs across levels.

Inventory: **360 registered structures**, **258 authored/imported next-1000 models**,
**167 fully complete**, **742 unauthored**, 256 portable reviews, 254 shared-material reviews,
and 232 active geographic previews.

Source hash: `1d40b097ab6f1765fa729f7b06db09811704bac68fee1c3ed384422ff4987bff`.
Runtime hash: `d3a721671c12168d6a445dead537ff0e346bbd87432ad888bc716f121b182d0a`.
Lock **`assets-5f658db5bfd3dd4b`** pins **2,248 GLBs**: six additions with all 2,242 prior
entries preserved. Sixteen previous authored-LOD fingerprints were refreshed once; their
80 earlier master/LOD files remain byte-identical to the lock. Targeted LOD checks passed.
The capture fixture still logs the unrelated `updateTerrainSurfaceSignals` dependency-scan
warning; landmark frames and unload checks succeeded. No repository-wide build or audit ran.

**Next: N0249 Alamut Castle**, Q4706020. Cached exact OSM way/590499418 has a 176.148 ×
53.917 m envelope and a draft map axis. UNESCO nomination 1770 identifies surviving ruins,
rock-cut structures and water systems. Research the present remains and levels; do not invent
an intact medieval reconstruction. The public nomination document was too large for the web
reader and direct download hit a JavaScript challenge; the UNESCO listing and evaluation
remain available for research.

## 2026-10-04 — N0249 Alamut Castle source and runtime checkpoint

Added `places/tn/tn7/n0249_alamut_castle/` from a deterministic authored recipe,
OSM upper-castle outline and ten mapped ruin groups. Roofless chambers, northwest ridge
cells, five interpreted rock-cut reservoirs, brick arches, broken masonry, patches of
plaster, local cliff contact and approach stairs are included. The 2024 UNESCO photographs
and published plan/field references are documented; older temporary excavation shelters
are not treated as permanent historic architecture.

The source master has **271,061 triangles**, **652,777 vertices**, seven material groups,
six shared material graphs and **zero embedded images**. Source: **26,756,940 bytes**;
imported master: **26,756,304 bytes**.

| Level | Bytes | Triangles |
| --- | ---: | ---: |
| Skyline | 68,396 | 801 |
| District | 123,368 | 1,467 |
| Street | 288,548 | 3,621 |
| Close-up | 2,915,412 | 39,879 |

Initial skyline plus district totals **191,764 bytes**. Inspected all 14 final portable
renders, 13 shared-material renders and the common-camera LOD comparison. Corrected a
floating stair approach with a local cut-rock ledge, kept cliff ribs at consistent physical
positions across detail levels, and added chipped stone faces. All six GLBs pass Khronos
validation with zero errors or warnings. Source regeneration is byte-identical. The
31 targeted LOD checks passed before the visual repair; the two Alamut checks passed again
afterward. Shared graphs load once each and unloading leaves zero live model geometries.
Physical phone and laptop measurements remain pending.

**Maximum exterior fidelity and geographic fit remain pending.** Exact Q4706020 identity
matches OSM way/590499418. Anchor `[50.586098381,36.44473323]`, heading
`-0.796374558514`; placement remains draft with `replaceFootprint=false`. Wall heights,
cistern locations/depths, chamber divisions, arch positions, excavated floor levels and
stair elevations require measured archaeological plans. The local cliff is not the full
mountain. The lower/onion castle and passing zone need separate source coverage. Flat
plateau geometry, regular mortar patterns, rock strata and the lighter skyline material
need refinement; no maximum-fidelity approval is asserted.

Inventory: **361 registered structures**, **259 authored/imported next-1000 models**,
**167 fully complete**, **741 unauthored**, 257 portable reviews, 255 shared-material reviews,
and 232 active geographic previews.

Source hash: `9b4f6d2f2a9967113c0bd7b502235807b944b8a44fe682a1a7fd30d4bf9bd588`.
Runtime hash: `5f278d74d54e58c21b07e64350042d4e795386f0c5de1bfa0a75abe822defea9`.
Lock **`assets-6be3f59c6e387fcb`** pins **2,254 GLBs**: six additions with all 2,248 prior
entries preserved. Seventeen previous authored-LOD fingerprints were refreshed once; all
85 earlier master/LOD files remain byte-identical to the lock. The capture fixture emitted
the existing unrelated `updateTerrainSurfaceSignals` dependency-scan warning; landmark
captures and unload checks succeeded. No repository-wide build or dependency audit ran.

**Next: N0250 Mir Castle Complex**, Q209643. Exact OSM relation/1579104 has an outer
ring and courtyard hole, draft anchor `[26.472922093,53.451203802]`, heading
`-0.224560956675` and mapped envelope 78.855 × 75.802 m. The public OSM area response is
cached in `.artifacts/mir-research/map-raw.json`. The ICOMOS evaluation available at
https://whc.unesco.org/document/169793 describes five towers, square lower and octagonal
upper stages, recessed plaster ornament, brick facades and tiled roofs. Its 2000 dimensions
are historical evidence; current restoration state and all five tower facades still need
visual inspection. The 17 MB nomination exceeded the web reader's size limit, while the
small evaluation text was readable (PDF screenshot requests returned cache misses).

## 2026-10-04 — N0250 Mir Castle source and runtime checkpoint

Added `places/u9/u9d/n0250_mir_castle_complex/` with a deterministic geometry recipe,
mapped building-part polygons and reference notes from the official museum photographs.
The five towers have separate brick/plaster ornament; the L-shaped palace surrounds an
open courtyard. Covered wall walks, west gate passage, north arched bridge, timber gallery,
roof tiles, dormers, chimneys and balcony are included.

The source master has **255,892 triangles**, **593,826 vertices**, ten material groups,
eight shared graphs and **zero embedded images**. Source: **24,453,976 bytes**;
imported master: **24,453,128 bytes**.

| Level | Bytes | Triangles |
| --- | ---: | ---: |
| Skyline | 63,532 | 712 |
| District | 237,812 | 3,245 |
| Street | 767,700 | 12,761 |
| Close-up | 3,047,424 | 41,155 |

Initial skyline plus district totals **301,344 bytes**. All six GLBs pass Khronos validation
with zero errors or warnings. All **33 authored-LOD regression checks** pass; the master
regenerates byte for byte. Inspected 14 portable and 13 shared-material renders plus the
common-camera LOD comparison. Removed hidden palace trim and drains that protruded through
the south wall, split gate ornament around the open arch, and corrected dormer side normals.
The eight shared graphs load once each; unloading leaves zero live model geometries.
Physical phone and laptop measurements remain pending.

**Maximum exterior fidelity and geographic fit remain pending.** Exact Q209643 matches
OSM relation/1579104; draft anchor `[26.472922093,53.451203802]`, heading
`-0.224560956675`, `replaceFootprint=false`. Map tower roof heights of 30/31 m differ from
the ICOMOS evaluation's 22–26 m figures; height datum needs resolution. Window rhythms,
plaster patterns, roof details and bridge elevation remain photographic interpretations.
The separate chapel-crypt, guardhouse, moat, park, ramparts and later palace remains are
outside this castle-and-bridge geometry. Fieldstone texture and cross-LOD color need further
refinement. No full-complex or maximum-fidelity approval is asserted.

Inventory: **362 registered structures**, **260 authored/imported next-1000 models**,
**167 fully complete**, **740 unauthored**, 258 portable reviews, 256 shared-material reviews,
and 232 active geographic previews. The source index contains 363 bundles.

Source hash: `f309ea5ba68616121c06e1529e32274ebbabb6ae386a14da3e273f40bb32ecee`.
Runtime hash: `a01a84fbf58e2f7d3444958759b04683e5702a56433f7bbe5863a346f8915a9d`.
Lock **`assets-9d1f474fb25019ec`** pins **2,260 GLBs**: six additions with all 2,254 prior
entries preserved. Eighteen prior authored-LOD fingerprints were refreshed; all 90 earlier
master/LOD files remain byte-identical to the lock. The capture fixture still emits its
unrelated `updateTerrainSurfaceSignals` dependency-scan warning; model captures and unload
checks succeeded. No repository-wide build or dependency audit ran.

**Next: N0251 Kernavė**, Q215315. The candidate currently identifies a town and has no exact
mapped castle footprint. The [UNESCO property](https://whc.unesco.org/en/list/1137/) describes
an archaeological landscape with five surviving hillforts; the
[reserve's official site](https://www.kernave.org/) also identifies an outdoor exhibition of
reconstructed medieval homesteads. Research and map these separately. Do not place an invented
intact castle at the town coordinate or silently substitute the reconstruction exhibit for
the five hillforts. N0252 Hohenzollern Castle has exact OSM way/93612350 with a 175.611 ×
88.98 m enclosure outline, but its palace/tower parts still need research and mapping.

## 2026-10-04 — N0251 Kernavė source and runtime checkpoint

Added `places/u9/u9c/n0251_kernave/` and the source recipe
`packages/worldgen/scripts/kernave-landscape-model.mjs`. The candidate Q215315 is a town,
so the model explicitly covers five independently identified hillforts and the separate
modern museum reconstruction. OSM fixes component positions, twelve wooden building
footprints, three yards' fence lines, paths and stairs. Published archaeological dimensions
and official aerial photographs inform the interpreted earthworks and timber construction.
No intact medieval castle is invented at the town point.

The source master has **140,410 triangles**, **379,638 vertices**, three material groups,
two reusable graphs (timber and gravel) and zero embedded images. Grass remains vertex color.
Source: **15,354,172 bytes**; imported master: **15,353,816 bytes**.

| Level | Bytes | Triangles |
| --- | ---: | ---: |
| Skyline | 93,196 | 918 |
| District | 281,216 | 2,770 |
| Street | 1,321,856 | 15,170 |
| Close-up | 4,008,352 | 48,534 |

Initial skyline plus district is **374,412 bytes**. All six GLBs pass Khronos validation
with zero errors or warnings. All **35 authored-LOD regression checks** pass. Source
regeneration reproduces the exact bytes. Inspected 14 portable and 13 shared-material frames
plus the common-camera LOD comparison. Closed timber-course gaps and retained the flat
courtyard terrace at low LODs. Both material graphs load once; unloading leaves zero live
model geometries. Physical phone/laptop performance remains unmeasured.

**Maximum fidelity and geographic fit remain pending.** Draft anchor `[24.8517,54.8824]`,
heading zero (+X east, +Z south), `replaceFootprint=false`. The height field uses interpreted
contours and relative hill-slope heights, not a surveyed elevation raster. Terrain patch edges,
steep-slope shading, ground material, vegetation, exact timber details and the wider reserve
need further work. Do not treat the standalone patch surfaces as verified world terrain.
The archaeological landscape is not a single building footprint and is not activated.

Inventory: **363 registered structures**, **261 authored/imported next-1000 models**,
**167 fully complete**, **739 unauthored**, 259 portable reviews, 257 shared-material reviews,
232 active geographic previews and 192 maximum-fidelity approvals. Source index: 364 bundles.

Source hash: `b9709daddae6b379c702d47d39c6bb990a5616df8f27fa3fd5dd0c2d197d59fa`.
Runtime hash: `a0389cf7d6c40ee3ecb5e7908c5a14e3c036d728afca2ff4eee94e81325f10d2`.
Lock **`assets-43aea3e69bf9a2d7`** pins **2,266 GLBs**, adding six and preserving all 2,260
previous entries. Nineteen prior authored-LOD fingerprints were refreshed once; all 95
previous master/LOD files still match their lock hashes. The visual fixture's unrelated
`updateTerrainSurfaceSignals` dependency-scan warning remains; landmark captures succeeded.
No repository-wide build or dependency audit ran.

**Next: N0252 Hohenzollern Castle**, Q156457. Exact OSM way/93612350 is the enclosure,
not the palace roof footprint. Cached georeferencing gives anchor `[8.967537148,48.323560831]`,
heading `-0.254203978258`, and envelope 175.611 × 88.98 m. Research palace/tower parts and
current official photographs before authoring; do not extrude the enclosure into a building.

## 2026-10-04 — N0252 Hohenzollern Castle source and runtime checkpoint

Added `places/u0/u0w/n0252_hohenzollern_castle/` and the editable recipe
`packages/worldgen/scripts/hohenzollern-castle-model.mjs`. The mapped enclosure is kept
separate from three palace wings, named towers, two chapels, gatehouses and spiral entry
ramps. Original architectural reconstruction uses the operator's visitor plan, Stüler's
1854 design elevations and a 2005 courtyard photograph; these are references, not embedded
textures or a claim of current surveyed conditions.

The source master has **349,299 triangles**, **718,009 vertices**, nine material groups,
seven shared material graphs and zero embedded images. Source: **30,044,980 bytes**;
imported master: **30,044,200 bytes**. Reused sandstone, limestone, raw limestone, granite,
slate, wood and painted metal; grass and glass remain local PBR colors.

| Level | Bytes | Triangles |
| --- | ---: | ---: |
| Skyline | 90,496 | 983 |
| District | 241,336 | 2,999 |
| Street | 827,344 | 11,891 |
| Close-up | 4,239,436 | 56,562 |

Initial skyline plus district totals **331,832 bytes**. All six GLBs pass Khronos validation
with zero errors or warnings; UV-use notices reflect external procedural surfaces. All
**37 authored-LOD regression checks** pass and the source regenerates byte for byte.
Inspected 14 portable and 13 shared-material renders plus the common-camera LOD comparison.
Repaired floating support walls, connected the carriage court/gate platform and cut the hall
roof around the Watch Tower. All seven graphs load once; unloading leaves zero live model
geometries. Physical phone and laptop measurements remain pending.

**Maximum exterior fidelity and geographic fit remain pending.** Exact Q156457 matches
OSM way/93612350. Draft anchor `[8.967537148,48.323560831]`, heading `-0.254203978258`,
`replaceFootprint=false`; +X points 14.565 degrees south of east. The +30 m entry-to-court
datum is inferred from separate map elevation tags, not surveyed connected floors. Tall
provisional support skirts, local rock/terrain contact, ramp gradients and vaults, facade
rhythms, crown details and roof joins need further work. Forest, ivy, statuary, water tower,
parking buildings and interiors are outside the asset. It is registered for asset review
but is not an approved geographic replacement.

Inventory: **364 registered structures**, **262 authored/imported next-1000 models**,
**167 fully complete**, **738 unauthored**, 260 portable reviews, 258 shared-material reviews,
232 active geographic previews and 192 maximum-fidelity approvals. Source index: 365 bundles.

Source hash: `5cb6e4124350dee11d4dd9368b9ae214494f141b73d15c7d050fcf08c45838e7`.
Runtime hash: `6e608b386f84f7036ec3a3d9699f3c7a6b12524fbbc19d29c8de6c8371a32720`.
Lock **`assets-28410671462d0ba7`** pins **2,272 GLBs**, six additions with all 2,266 prior
entries preserved. Twenty earlier authored-LOD fingerprints were refreshed once; all 100
previous master/LOD files remain byte-identical to the lock. Capture fixtures still emit
the unrelated `updateTerrainSurfaceSignals` dependency-scan warning; landmark captures and
unload checks succeed. No repository-wide build or dependency audit ran.

**Next: N0253 Bratislava Castle**, Q593311. Cached exact OSM way/1128350263 has an approximately
334.485 × 310.572 m site envelope, anchor `[17.100792149,48.142390437]`, heading
`1.019493535917`. This is the castle grounds, not the four-towered palace roof. Research and
map the palace, open courtyard, terraces, gardens, surviving gates and surrounding buildings
individually before authoring. N0254 Nesvizh Castle and N0255 Buda Castle follow in the list.

## 2026-10-04 — N0253 Bratislava Castle source and runtime checkpoint

Added `places/u2/u2s/n0253_bratislava_castle/` and the editable recipe
`packages/worldgen/scripts/bratislava-castle-model.mjs`. The independent palace wings,
four unequal corner towers, open courtyard, Court of Honour pavilions, surrounding barracks,
riding hall, four gates, hedge parterres and archaeological foundations use saved map parts.
Official museum/tourist-board references and the NR SR 2018 illustration guide the original
reconstruction. No third-party photographs or meshes are bundled.

The detailed source master has **684,637 triangles**, **1,388,547 vertices**, ten material groups,
eight shared graphs and zero embedded images. Source: **58,208,900 bytes**; imported master:
**58,208,048 bytes**. Lime plaster, tile, granite, raw limestone, wood, painted metal, cast bronze
and gravel reuse the common surface library. Grass and glazing use local PBR colors.

| Level | Bytes | Triangles |
| --- | ---: | ---: |
| Skyline | 90,884 | 963 |
| District | 296,024 | 3,810 |
| Street | 1,018,160 | 15,773 |
| Close-up | 4,645,552 | 62,481 |

Initial skyline plus district totals **386,908 bytes**. All six GLBs pass Khronos validation
with zero errors or warnings; unused-UV notices reflect procedural shared materials. All
**39 authored-LOD regression checks** pass, and source regeneration reproduces the exact bytes.
Inspected 14 portable and 13 shared-material frames plus the common-camera LOD comparison.
Corrected inward entrance details, clock winding, pavilion roof coverage, buried forecourt
buttresses and garden support. Eight surface graphs load once; unloading leaves zero live
model geometries. Physical laptop/phone measurements remain pending.

**Maximum fidelity and geographic fit remain pending.** Draft anchor `[17.100792149,48.142390437]`,
heading `1.019493535917`, native +X 58.412 degrees north of east; the south entrance faces
native -X/+Z. `replaceFootprint=false`. The exact grounds match is way/1128350263 (Q593311);
the palace is separately way/8160490 and relation/14610630 (Q13425656). The museum's 47 m
Crown Tower height conflicts with mapped 31 m parts. The model uses the museum figure above
a provisional 10 m terrace. Heights, four garden terrace levels, broad support skirts,
terrain fit, gate profiles, facade rhythm, dormers, roof junctions and stair connections need
further refinement. The equestrian figure is an interpretive silhouette; detailed sculpture,
garden figures, mature trees and interiors are unfinished. This is an authored exterior asset,
not a maximum-fidelity or geographic approval.

Inventory: **365 registered structures**, **263 authored/imported next-1000 assets**,
**167 fully complete**, **737 unauthored**, 261 portable reviews, 259 shared-material reviews,
232 active geographic previews and 192 maximum-fidelity approvals. Source index: 366 bundles.

Source hash: `1e9b67723d4932c70c47afbe1a86850894ed9bc183b75aefafbb26deabd32802`.
Runtime hash: `72b0a45ef15cbba6f9c7f406e1ce6bf0e75ed146f250ba4dbdda333fadfc9e2e`.
Lock **`assets-2adc124064fa3b04`** pins **2,278 GLBs**, adding six and preserving all 2,272
previous entries. Twenty-one prior authored-LOD metadata fingerprints were refreshed once;
all 105 previous master/LOD files still match their pinned bytes. The existing unrelated
`updateTerrainSurfaceSignals` dependency-scan warning occurred; model capture succeeded.
No repository-wide build or dependency audit ran.

**Next: N0254 Nesvizh Castle**, Q719422. Cached map evidence matches relation/14560856,
anchor `[26.691942596,53.222787871]`, heading `-0.47453422597`, envelope 230.213 × 188.624 m.
Research the palace, gate, courtyard and bastion parts before authoring; the grounds envelope
must not be extruded as one building. N0255 Buda Castle and N0256 Durham Castle follow.

## 2026-10-04 — N0254 Nesvizh Castle source and runtime checkpoint

Added `places/u9/u96/n0254_nesvizh_castle/` with the editable recipe
`packages/worldgen/scripts/nesvizh-castle-model.mjs`. The six-sided court remains open;
individual mapped palace/roof parts, two unequal towers, curved western galleries,
ceremonial gate, three-arch bridge, service buildings and grass bastions form the exterior.
Saved 148 attributed map features and reference metadata. The museum courtyard photograph
and UNDP's 2021 exterior photograph guide the original reconstruction; no third-party
photographs or meshes are bundled.

The source master has **186,936 triangles**, **384,070 vertices**, nine material groups,
seven shared surface graphs and zero embedded images. Source: **16,074,828 bytes**;
imported master: **16,074,052 bytes**. Lime plaster, ceramic tile, raw limestone, granite,
wood, painted metal and cast bronze reuse the common library. Grass and glazing use
local PBR colors.

| Level | Bytes | Triangles |
| --- | ---: | ---: |
| Skyline | 94,508 | 997 |
| District | 201,180 | 2,499 |
| Street | 625,124 | 9,801 |
| Close-up | 2,462,336 | 33,422 |

Initial skyline plus district totals **295,688 bytes**. All six GLBs pass Khronos
validation with zero errors or warnings; unused-UV notices reflect external procedural
surfaces. All 41 authored-LOD checks passed; the two affected Nesvizh cases passed again
after the final model-local facade/passage correction. Source regeneration reproduces
identical bytes. Inspected 14 portable and 13 shared-material frames and the common-camera
LOD comparison. Corrected roof winding, bridge vaults below ground, hollow bastion interiors,
tower windows, a buried balcony and partial facade occlusion. Each of seven shared graphs
loads once; unloading leaves zero live model geometries. Physical-device measurements
remain pending.

**Maximum exterior fidelity and geographic fit remain pending.** Draft anchor
`[26.691942596,53.222787871]`, heading `-0.47453422597`, +X 27.188 degrees south of east;
the west approach faces -X. `replaceFootprint=false`. Exact grounds identity is
relation/14560856, with palace relation/1732915 and court way/128279266. Provisional
court Y=4, earth crests Y=8, mapped tower tip Y=37 and finial Y=37.9 require surveyed datum
and in-world terrain fitting. Rampart profiles are angular and provisional. Roof junctions,
window rhythms, tower crowns/clocks, exact portal elevations, dormers and sculpture need
further reference refinement. Heraldic shapes are geometric interpretations. Interiors,
park trees, water and the separate Corpus Christi Church are outside this exterior asset.
This technical render review is not a maximum-fidelity or geographic approval.

Inventory: **366 registered structures**, **264 authored/imported next-1000 assets**,
**167 fully complete**, **736 unauthored**, 262 portable reviews, 260 shared-material reviews,
232 active geographic previews and 192 maximum-fidelity approvals. Source index: 367 bundles.

Source hash: `265d4166b08bc10b7bb06532d44d4ff7aba160f03cbc98ea4aa454d389e61f70`.
Runtime hash: `89797757b1e9fb4586e78c3a8ea315d7d8858a99f4dcb743a355a95b5857f55d`.
Lock **`assets-6bac3775f26737c4`** pins **2,284 GLBs**, adding six while preserving all
2,278 prior entries. Twenty-two earlier authored-LOD metadata fingerprints were refreshed
once; all 110 previous master/LOD files remain byte-identical to the lock. Capture fixtures
still emit the unrelated `updateTerrainSurfaceSignals` dependency-scan warning; landmark
captures and eviction checks succeed. No repository-wide build or npm audit ran.

**Next: N0255 Buda Castle**, Q46313. Cached exact map relation/6486918 has anchor
`[19.039308745,47.495824657]`, heading `-0.853630134323`, envelope 339.728 × 149.092 m.
Research the present palace state, separate wings, dome, courtyards and terraced retaining
walls before authoring. Historic restorations must be distinguished from current buildings.
N0256 Durham Castle follows.

## 2026-10-04 — N0255 Buda Castle source and runtime checkpoint

Added `places/u2/u2m/n0255_buda_castle/` and editable recipe
`packages/worldgen/scripts/buda-castle-model.mjs`. The A–F palace wings, long Danube
frontage, ribbed postwar dome, open Lions Court, library pavilion, South Range and
immediate terraces form the exterior. Attributed map geometry and reference metadata
are preserved beside the recipe outputs. No third-party photographs or meshes are bundled.

**Temporal reference: 2021.** The National Hauszmann Program's official publication
separates existing palace photographs from historical images and future designs. This
asset follows the completed 2021 exterior, including the restored South Range. A/B
reconstruction began in 2022; neither the current construction site nor the proposed
completed restoration is claimed here. Exact future/current-state architecture needs
its own review.

The detailed source has **394,698 triangles**, **803,772 vertices**, nine material groups,
seven shared surface graphs and zero embedded images. Source: **33,677,224 bytes**;
imported master: **33,676,452 bytes**. Limestone, raw limestone, granite, copper, wood,
painted metal and bronze use the central library. Glass and dark recesses use local PBR.

| Level | Bytes | Triangles |
| --- | ---: | ---: |
| Skyline | 77,348 | 919 |
| District | 298,944 | 3,875 |
| Street | 1,226,572 | 15,982 |
| Close-up | 4,648,844 | 62,888 |

Initial skyline plus district is **376,292 bytes**. All six GLBs pass Khronos validation
with zero errors or warnings; unused-UV notices correspond to shared procedural materials.
Source regeneration is byte-identical. All 43 authored-LOD regression checks passed, and
the two Buda cases passed again after the local roof/chimney correction. Inspected all
14 final portable and 13 final shared-material frames plus the common-camera LOD comparison.
Repaired a floating roof edge and a chimney starting above its roof. Seven graphs each
load once; unloading leaves zero live model geometry. Physical laptop/phone approval
remains pending. The new recipe passes its focused Biome check.

**Maximum fidelity and geographic fit remain pending.** Draft exact-QID palace anchor
`[19.039308745,47.495824657]`, heading `-0.853630134323`; +X is 48.909 degrees south of east,
Danube frontage faces -Z. `replaceFootprint=false`. Palace/court Y=4 and dome tip Y=62 are
inferred, not surveyed. Individual window rhythms, library/A-wing roofs, roof intersections,
ornamental sculpture and heraldry require further reference refinement. No generic statue
stands in for the missing sculptural works. Interiors, separate Guardhouse/Riding Hall,
Mace/Karakash towers, Castle Garden Bazaar and entire Castle Hill terrain are outside this
palace exterior asset. The technical render approval does not approve architectural fidelity.

Inventory: **367 registered structures**, **265 authored/imported next-1000 assets**,
**167 fully complete**, **735 unauthored**, 263 portable reviews, 261 shared-material reviews,
232 active geographic previews and 192 maximum-fidelity approvals. Source index: 368 bundles.

Source hash: `96d12a760a6a61c59e37040aad4a25a1b9188ed8719d89b445c1b211ed56fffa`.
Runtime hash: `248cc36d85ad3442abf70e100a2ec194703d7b2e6928f109f06d63dd8a567558`.
Lock **`assets-ecf236b68efa0d77`** pins **2,290 GLBs**, adding six while preserving all
2,284 prior entries. Refreshed 23 earlier authored-LOD recipe fingerprints once; all
115 previous runtime-master/LOD files stayed byte-identical to their pins. The existing
unrelated `updateTerrainSurfaceSignals` dependency-scan warning persists; landmark captures
and disposal checks succeed. No repository-wide build, security audit or Git operation ran.

**Next: N0256 Durham Castle**, Q752266. Cached way/81522967, anchor
`[-1.576564741,54.775561357]`, heading `0.524419899749`, envelope 98.284 × 67.703 m.
This mapped wing outline is not the whole castle: research the separate keep, motte,
Great Hall, chapel, gateway and courtyard before authoring. Do not omit the keep just
because the exact-QID building outline excludes it.

## N0256 Durham Castle checkpoint — 2026-10-04

Added `places/gc/gcw/n0256_durham_castle/` with a deterministic source recipe,
attributed map components, reference metadata, imported master, four authored runtime
levels, draft geographic record and hash-bound render evidence. The main range's
exact-QID OSM outline excludes the keep; the model explicitly includes the separately
mapped octagonal keep, motte retaining arcs, gatehouse and open bailey. Great Hall domed
turrets, Cosin porch and oriel, Black Stairs, lower Tunstall Gallery, upper hall, clock
stair and chapel have distinct geometry. Historic England's four listed descriptions
and Durham University's exterior photographs informed the reconstruction.

The detailed source has **193,007 triangles**, **391,289 vertices**, eight material groups,
six shared graphs and zero embedded images. Source: **16,407,064 bytes**; imported master:
**16,406,356 bytes**. Sandstone, raw limestone, slate, wood, painted metal and gravel
reuse the central material library. Glass, recesses and lawn use local PBR.

| Level | Bytes | Triangles |
| --- | ---: | ---: |
| Skyline | 79,892 | 953 |
| District | 241,612 | 3,169 |
| Street | 1,181,760 | 15,467 |
| Close-up | 2,162,176 | 29,825 |

Initial skyline plus district: **321,504 bytes**. All six GLBs pass Khronos validation
with zero errors or warnings; unused-UV notices correspond to external shared surfaces.
Final source regeneration is byte-identical. All 45 authored-LOD regression checks
passed; both Durham checks passed again after the local geometry corrections. Inspected
all 14 final portable and 13 final shared-material frames, plus the same-camera LOD
comparison. Repaired an inverted hall/garden-stair partition, occluded oriel and stair
windows, exposed upper-hall ends and inward porch risers. Six graphs load once each;
unloading leaves zero live model geometry. Focused Biome check passes. Physical laptop
and phone measurements remain pending.

**Maximum fidelity and geographic fit remain pending.** Draft main-range anchor
`[-1.576564741,54.775561357]`, heading `0.524419899749`; native +X is 30.047 degrees north
of east. `replaceFootprint=false`. Courtyard Y=0.12 and keep platform Y=10 are inferred,
not surveyed. Rear elevations, hidden roofs, exact window tracery and heraldic/figurative
carvings require further architectural refinement. Plain reserved shield panels are not
complete carvings. Interiors, Cathedral, Palace Green Library and surrounding city are
outside this castle exterior asset. Technical rendering approval does not certify those
architectural details or terrain placement.

Inventory: **368 registered structures**, **266 authored/imported next-1000 assets**,
**167 fully complete**, **734 unauthored**, 264 portable reviews, 262 shared-material
reviews, 232 active geographic previews and 192 maximum-fidelity approvals. Source index:
369 bundles.

Source hash: `7fee2a5d8b31bbce3e59a071d8eeb7a8db12714ef718b19592cb1b84aaf4f6a8`.
Runtime hash: `2cd837b33a37e0983efe7a42c62c10e18fc3bac02f3368dce76e34d8350421c6`.
Lock **`assets-f667137d64ce9938`** pins **2,296 GLBs**, adding six while preserving all
2,290 prior entries. Refreshed 24 earlier authored-LOD recipe fingerprints once and
verified their 120 runtime-master/LOD files remained byte-identical to existing pins.
The unrelated `updateTerrainSurfaceSignals` dependency-scan warning appeared during the
first shared capture; all landmark capture and disposal checks succeeded. No repository-wide
build, security audit or Git mutation ran.

**Next: N0257 Citadel of Salah Ed-Din**, Q277531, reference coordinate
`[36.057222,35.595833]`. Research the actual Syrian citadel and surviving fabric before
modeling; do not conflate it with the Cairo citadel of a similar name. N0258 is Sforza Castle.

## N0257 Citadel of Salah Ed-Din checkpoint — 2026-10-04

Added `places/sy/sy3/n0257_citadel_of_salah_ed_din/`, Q277531, the Syrian citadel near
Al-Haffah. The source bundle contains the exact-identity OSM ridge and mapped tower
footprints, interpreted components from AKTC's phased site and palace plans, primary
reference metadata, a deterministic recipe, imported master and four authored runtime
levels. Nearby modern village buildings are excluded. This is an interpreted conserved
and ruined exterior; it is not an intact medieval reconstruction or a 2026 condition survey.

The model separates the long lower ward, chapel and gates, raised Byzantine fortress,
Ayyubid courtyard and baths, mosque and square minaret, northern cistern, master tower,
pillared hall, southern cistern, projecting round towers and the isolated moat needle.
Open spaces stay open. Corrected stretched terrain fans by clipping the outline to a
regular sampling grid, joined cliff edges, excluded level floors from the terrain and
extended their foundations. Replaced regular block-like wall heads with continuous,
uneven rubble profiles. Bedrock relief and unrecorded elevations remain interpretations.

Master: **320,144 triangles**, **649,070 vertices**, seven material groups, six shared
graphs, **zero embedded images**. Source **27,212,528 bytes**, imported master
**27,211,880 bytes**. Limestone, raw limestone, weathered limestone, lime plaster,
painted metal and gravel reuse the central procedural material library; no new bitmap
texture was generated.

| Level | Bytes | Triangles |
| --- | ---: | ---: |
| Skyline | 79,204 | 919 |
| District | 314,008 | 3,848 |
| Street | 906,248 | 12,930 |
| Close-up | 1,551,516 | 24,128 |

Initial skyline plus district: **393,212 bytes**. All six GLBs pass Khronos validation
with zero errors or warnings. Unused-UV notices correspond to external shared surfaces.
Final source regeneration is byte-identical. All 47 authored-LOD cases passed; the two
Citadel cases passed again after the final terrain changes. Final focused Biome check
passes. Inspected all 14 portable and 13 shared-material frames and the same-camera LOD
comparison. Each of six material graphs loads once; eviction leaves zero live model
geometry. Physical laptop and phone performance measurements remain pending.

**Maximum fidelity and geographic fit remain pending.** Ruin profiles, recent entrance
roof collapse/propping, exact chamber openings, masonry scars and natural cliff relief
need further current photographic and topographic refinement. Draft anchor
`[36.055056392,35.595076267]`, heading `0.427014283192`; native +X points toward the eastern
moat. `replaceFootprint=false`. The model base is Y=0, eastern court Y=42 and inner-fortress
platform Y=53; these are relative, inferred levels. The bedrock must be fitted to world
terrain before approval. Asset-review rendering does not certify that fit. Complete,
navigable interiors and the modern village are outside the modeled exterior scope.

Inventory: **369 registered structures**, **267 authored/imported next-1000 assets**,
**167 fully complete**, **733 unauthored**, 265 portable reviews, 263 shared-material
reviews, 232 active geographic previews and 192 maximum-fidelity approvals. Source
index: 370 bundles.

Source hash: `eb61f0965485bbac558b40961c24e71d0cf5b17691dbbe1d7f23a08cc50c593e`.
Runtime hash: `cbbe77e7019e3e289e1ca469c1ac33786b35bfef3224c0819d4e469f9b67ff75`.
Lock **`assets-074236a4c986f5c0`** pins **2,302 GLBs**; six added, all 2,296 prior entries
preserved. Refreshed 25 earlier authored-LOD registry fingerprints once and verified all
125 existing runtime-master/LOD files remain byte-identical to their pins. The unrelated
`updateTerrainSurfaceSignals` dependency-scan warning appeared; all requested capture
and disposal checks completed. No repository-wide build, dependency audit or Git mutation
ran.

**Next: N0258 Sforza Castle**, Q23354, Milan. Cached exact-QID relation/1918, anchor
`[9.179624311,45.470327662]`, heading `0.746042938648`, envelope 219.957 × 200.243 m.
Research the different courtyards, Filarete tower, round corner towers, Rocchetta and
Ducal Court, roofs, moat and park-facing elevations before authoring. Preserve the
courtyards instead of extruding the entire compound as one filled block.


## N0258 Sforza Castle checkpoint — 2026-10-04

Added `places/u0/u0n/n0258_sforza_castle/`, exact Q23354 / OSM relation 1918 in Milan.
The deterministic source recipe uses mapped building-part footprints, three open courts,
Filarete clock tower and octagonal crown, two round stone city towers, square rear towers,
Torre di Bona, roofed wall walks, museum ranges, courtyard porticoes, moat bridges and the
projecting Ponticella. Primary photographic references are the Regione Lombardia heritage
inventory and the municipality's restoration contractor. Source data and attribution are
checked in; reference photographs are research-only. Relative elevations are inferred.

Corrected a reversed tower gallery, inward-facing facade detail, stray masonry inside
open gateways and the filled park entrance. Arcades have recessed backs, columns and
continuous spandrels; street and close-up geometry retain their depth. Nine existing shared
material graphs supply brick, granite, limestone, raw limestone, plaster, tile, copper,
painted metal and gravel. No new bitmap textures and zero embedded images.

Master: **509,200 triangles**, **1,032,360 vertices**, 11 material groups. Source
**43,281,340 bytes**; imported master **43,280,424 bytes**. Four independent runtime levels:

| Level | Bytes | Triangles |
| --- | ---: | ---: |
| Skyline | 63,360 | 780 |
| District | 227,852 | 2,954 |
| Street | 671,460 | 9,600 |
| Close-up | 3,976,920 | 56,716 |

Initial skyline plus district is **291,212 bytes**. All six GLBs pass Khronos validation
with zero errors/warnings; unused-UV notices reflect external procedural surfaces. Source
regeneration is byte-identical. All 49 authored-LOD cases passed; both Sforza cases passed
again after final gateway/arcade corrections. Focused Biome checks pass. Inspected all
14 portable frames, 13 shared-material frames and the same-camera master/LOD comparison.
Each of nine material graphs loads once; unload leaves zero live model geometry.
Physical laptop/phone measurements remain pending.

**Maximum fidelity and geographic fit remain pending.** Exact fenestration, frescoes,
carved heraldry, figurative reliefs, sculpture, inscriptions and conservation scars need
further work. Inferred tower heights, roof pitches and moat levels are not surveyed.
Draft anchor `[9.179624311,45.470327662]`, heading `0.746042938648`; native +X northeast,
+Z toward the southeast Filarete gate. Model moat Y=0, courts Y=3. `replaceFootprint=false`.
Asset-review rendering does not approve terrain fit. Enclosed museum interiors, collections,
the public fountain and nearby civic sculpture are outside this exterior's current scope.

Inventory: **370 registered structures**, **268 authored/imported next-1000 assets**,
**167 fully complete**, **732 unauthored**; 266 portable reviews, 264 shared-material
reviews, 232 active geographic previews, 192 maximum-fidelity approvals, 371 source bundles.

Source hash: `f5494818b50041d91b1434f110032249bec0d6a312d4eb08e5c36fbcd119faa1`.
Runtime hash: `eefe4cdaba6a04ce3d7839ea3265c044d6e6f1c948afe38a82bc8ee2408b3455`.
Lock **`assets-e5f5d554f9a8d3b3`** pins **2,308 GLBs**; six added and all 2,302 prior pins
preserved. Refreshed 26 earlier authored-LOD registry fingerprints once and verified their
130 existing master/LOD GLBs remain byte-identical. The existing traffic-signals
`updateTerrainSurfaceSignals` dependency-scan warning did not prevent landmark captures.
No repository-wide build, dependency audit, upload or Git mutation ran.

**Next: N0259 Shanhai Pass**, Q1048381, reference `[119.75357,40.00916]`. Research the
specific pass gate and associated wall extent before authoring; distinguish the gate,
fortified town, Great Wall and coastal Laolongtou rather than merging separate sites.
N0260 is Khotyn Fortress, Q141012.

### Owner-requested wind-down — 2026-10-04

Stopped after N0258 Sforza Castle. No N0259 model source or geometry was started.
Sforza's source master, imported master, four runtime levels, shared materials,
27 inspected captures, source registry, geographic draft, galleries, readiness ledger and
six lock entries are saved. The final close-out check confirms all six files match their
lock pins and the source/runtime hashes match the QA record. No generators or captures
remain running. Building is paused at the owner's request.

This is a completed authoring/packaging checkpoint, **not maximum-fidelity approval**.
Sforza's architectural-detail and in-world geographic-fit reviews remain pending as
listed in its README/spec/QA. On resumption, resolve those before describing this model
as fully complete; then continue the candidate queue. Overall completion remains 167/1000.

## Review binding moves to model inputs — 2026-10-07

QA records, capture reports, placement reports and bridge terrain evidence now bind to each
model's `inputHash` instead of its source and runtime GLB SHA-256s. `modelInputHash` in
`packages/worldgen/scripts/structure-model-files.mjs` hashes the bundle's evidence files, its
`spec.json` without the generator-measured `mesh` and `actualBounds`, and the model-specific
recipe files the authoring index lists. Rebuilding a model, on any machine, keeps its reviews;
editing its inputs invalidates them. Edits to shared mesh modules or the engine do not, so
re-capture deliberately with `--force` after such a change.

The ledger was migrated in place. Each record the previous rules found current (source GLB,
including the RGB repair, runtime GLB and spec bytes) received its model's `inputHash`; stale
records lost their GLB hashes and stay unbound. The migration left readiness unchanged: 198
portable, 196 shared-material and 133 maximum-fidelity reviews, 232 previews and 108 complete.
`reviewed-glb-encoding.mjs` is retired.

### Resumed under medium-fi — 2026-10-07 — N0259 Shanhai Pass

The owner's revised `docs-src/guide/medium-fi.md` supersedes the earlier maximum-detail
request for new work. Preserve recognizable forms, linear glTF colors, shared 256² graphs,
2–5 material groups and the 1k/4k/16k/64k triangle targets. Do not build enormous masters
whose details disappear in every runtime level.

Authored the **Zhendong Gate** at Shanhai Pass, Q1048381, from official scenic-area
dimensions and photographs plus named OSM way/414001373. The local scope is the gate,
platform and short wall attachments; it excludes the wider fortified town, barbican and
coastal Laolongtou. The mapped feature has no Wikidata tag. Anchor
`[119.753742,40.009332]`, heading `2.5025517303973333` radians, remains a **draft** with
`replaceFootprint=false` until actual terrain and orientation are reviewed.

Source bundle: `places/wx/wxj/n0259_shanhai_pass/`.
Recipe: `packages/worldgen/scripts/shanhai-pass-model.mjs`.
The source itself is **5,338 triangles / 460,532 bytes**, with four merged material groups
and three existing graphs (brick, slate, wood). No bitmap textures are embedded.

| Runtime level | Triangles | GLB bytes | Draw calls |
| --- | ---: | ---: | ---: |
| Skyline | 342 | 31,932 | 1 |
| District | 1,394 | 114,052 | 4 |
| Street | 4,522 | 354,404 | 4 |
| Closeup | 5,338 | 415,752 | 4 |

Initial skyline plus district: **145,984 bytes**. Source, imported master and four LODs
pass Khronos validation without errors or warnings. The two targeted LOD tests pass;
source regeneration is byte-identical. Material-library unloading leaves zero live model
geometries, with each of the three material graphs loaded once.

Inspected **44 captures**: 11 portable, 10 shared-material loader views, and 23 new medium-fi
views. The new fixture uses canonical Earth colors and Neutral tone mapping, actual procedural
siheyuan neighbors, three distances, noon/late afternoon, Economy without cast shadows and
High, a texture-free silhouette, detail cameras and same-camera LOD comparisons. The QA record
binds these images and LOD hashes. Geographic fit, continuous-motion shimmer and physical
phone/laptop performance remain unmeasured. The older loader fixture's lighting is not used
as the medium-fi lighting approval.

Repeat the context capture with:
`node examples/world-explorer/test/visual/capture-medium-fi.mjs --ids=n0259_shanhai_pass`.
Inspect every frame before recording approval. The readiness ledger now accepts the declared
medium-fi standard only with the required hash-bound evidence; four targeted rejection tests
cover stale LODs/images, missing views, wrong lighting, excessive triangles and unsafe paths.
Legacy maximum-fidelity approvals retain their old scope.

Lock **`assets-0e47610f806493b9`** pins **2,314 GLBs**: six new entries; all 2,308 prior
pins unchanged. Only the new model's outputs were generated. No Git mutations or uploads ran.
Schema/client builds were refreshed because the existing schema rejected Neutral tone mapping.
Worldgen compiled successfully; its package-level check then stopped on the existing stale
Space Needle source GLB. That unrelated model was not regenerated.

The refreshed local ledger reports **269 authored/imported candidates**, 193 declared-fidelity
reviews and 108 fully ready candidates. The drop from the previous ready count reflects existing
local output/metadata differences and changed shared graphs, not deletion of models: 68 older
candidates fail source/runtime hash checks, and only 199 shared-material reviews are current.
Example local GLBs for N0138, N0139, N0142 and N0143 also differ from their existing lock pins.
Their files and pins were preserved. Reconcile those outputs separately; do not label an old
review current after a material or geometry change. There are **371 registered structures**
across the full library and **372 source bundles**.

**Next authoring candidate: N0260 Khotyn Fortress, Q141012.** Use the medium-fi standard and
the new context review. The desktop's long-running goal still reports `paused`; this turn
resumed model work under the owner's message, without changing the goal's stale maximum-detail
objective or claiming that its automatic continuation was resumed.

## 2026-10-07 — Khotyn Fortress, medium-fi

N0260 now has a reproducible inner-citadel source recipe, imported asset and four authored
runtime levels. The state reserve's plan, photographs and component dimensions inform the
five towers, curved walls, brick bands, palace, chapel, well pavilion and entrance bridge.
The wider outer fortress is excluded. See
[source bundle](places/u8/u8d/n0260_khotyn_fortress/README.md) and
[recorded limitations](places/u8/u8d/n0260_khotyn_fortress/spec.json).

The source itself has 8,615 triangles and five material groups. Limestone, brick, cedar
shingles and wood come from four central material graphs; no private images are embedded.
Colors are decoded from sRGB to linear vertex values.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| Skyline | 891 | 72,904 | 1 |
| District | 3,703 | 293,496 | 5 |
| Street | 7,959 | 621,824 | 5 |
| Closeup | 8,615 | 669,616 | 5 |

Initial skyline plus district is **366,400 bytes**, excluding the shared texture library.
All six GLBs pass Khronos validation with zero errors and warnings. Two targeted tests
pass for deterministic LOD generation, download budgets, shared bindings and homogeneous
attribute uploads. Source regeneration is byte-identical; the strict medium-fi audit passes.

All **44 captures** were inspected: 11 portable, 10 shared-loader, 23 canonical Earth
context views. Review corrections included the stone well pavilion, covered veranda,
arched windows and courtyard/wall contact. The context fixture now accepts per-model camera
scale and procedural neighbor style; Khotyn uses Ukrainian cottage shells. Previous default
fixture behavior is preserved, and existing captures retain their recorded fixture hashes.

Geographic approval remains **pending**. Exact-QID OSM relation/8520372 describes the
larger fortress, not the inner citadel's footprint. The native plan, candidate anchor,
signed heading and foundation datum remain reconstructed. The elevated bridge approach
needs terrain integration. Its catalog entry stays inactive (`draft`, `replaceFootprint=false`).
Synthetic ground contact and static LOD comparisons do not constitute real-site fit or
physical-device performance approval.

Lock **`assets-ebd027e1515832ad`** contains **2,320 GLBs**: six added, all 2,314 previous
pins preserved. Catalogs report **270 authored/imported candidates**, 202 current source/runtime
hash pairs, 268 portable reviews, 200 shared-material reviews, 194 declared-fidelity reviews,
and **108 fully ready** candidates. The 68 pre-existing stale local outputs remain unreconciled.
The full library contains **372 registered structures** and **373 source bundles**.

The long-running goal now reports **active**. The owner's medium-fi direction supersedes
the older maximum-fidelity wording in its objective. **Next candidate: N0261 Royal Castle
in Warsaw (Q756098)**, followed by Stirling Castle and Toompea Castle. Continue the targeted
authoring loop; no repository-wide audit, unrelated regeneration, Git mutation or upload is
needed for each model.

## 2026-10-07 — Royal Castle in Warsaw, medium-fi

N0261 is authored, imported and visually reviewed. Its
[source bundle](places/u3/u3q/n0261_royal_castle_in_warsaw/README.md) contains an attributed
OSM palace/courtyard frame and linked museum references. The original recipe constructs the
five-wing exterior, Clock Gate and tower, paired corner crowns, Wladyslaw courtyard tower,
Gothic brick wall, three pale river pavilions and low library wing. The lower gardens,
Kubicki Arcades, neighboring Copper-Roof Palace and room interiors are outside this model.

The medium-fi source master has **27,495 triangles**, six merged material groups, and no
embedded images. Five shared graphs cover plaster, limestone, brick, ceramic tile and copper;
glazing is local PBR. The sixth group preserves the distinct exposed courtyard brickwork.
Vertex colors are linear values decoded from the sRGB palette.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| Skyline | 717 | 60,848 | 1 |
| District | 3,859 | 307,320 | 6 |
| Street | 14,183 | 1,109,164 | 6 |
| Closeup | 27,495 | 2,147,804 | 6 |

Initial skyline plus district: **368,168 bytes**, excluding the shared material library.
All six source/runtime GLBs pass Khronos validation with zero errors or warnings. Targeted
LOD tests pass for determinism, shared bindings, budgets and homogeneous attribute buffers.
The strict medium-fi audit passes. Geometry changes were limited to this candidate.

Inspected **44 final captures**: 11 portable, 10 shared-loader and 23 canonical Earth
context frames. Review caught and corrected inward-facing facade details, duplicated
courtyard windows, trim crossing the entrance, partly buried dormers and an uncovered
roof junction. Clock Gate remains open in all LODs. The context uses procedural Bohemian
townhouses, noon/late-afternoon light, Economy/High, three distances, a texture-free
silhouette and same-camera LOD comparisons. Shared graphs load once each; unloading
leaves zero live model geometries. Near-only finials add 1.2m to the far silhouette,
within the 1.5m authored error allowance.

**Geographic fit remains pending.** Relation/64436 gives the exact mapped identity and
courtyard. Native +Z faces west into Castle Square, with heading -1.6320593581624288 at
[21.014829838, 52.247715277]. Heights and the vertical datum are photographic estimates;
the museum's historical 40m tower description is not presented as a current surveyed
finial height. River escarpment and terrain contact need review before activating the
placement. Its status stays `draft`, with `replaceFootprint=false`. Physical-device
timing and continuous-motion shimmer remain unmeasured.

Lock **`assets-a78ecf6703d99d17`** pins **2,326 GLBs**: six added and all 2,320 prior pins
preserved. No Git operations or uploads were performed. **Next candidate: N0262 Stirling
Castle (Q756268)**, then N0263 Toompea Castle. Continue with the medium-fi standard and the
targeted authoring loop.

The refreshed ledger reports **271 authored/imported candidates**, 203 verified source/runtime
hash pairs, 269 portable reviews, 201 shared-material reviews, 195 declared-fidelity reviews
and **108 fully ready** candidates. The existing 68 stale local output pairs remain untouched.
Across the whole library there are **373 registered structures** and **374 source bundles**.

For the next model, Stirling's cached exact-QID way/100542995 is a 316.942 × 129.675m site
boundary with no courtyard holes; it must not be extruded as one building. Start with Historic
Environment Scotland's [site description](https://portal.historicenvironment.scot/designation/SM90291),
[statement of significance](https://www.historicenvironment.scot/publications/all/publication/?publicationId=ccc58e47-48f3-4697-8b73-a8b800ebf353)
and [overview route plan](https://www.historicenvironment.scot/publications/all/publication/?publicationId=420047e5-b241-4318-9127-a5f400f193f9).

## 2026-10-07 — Stirling Castle, medium-fi

N0262 is authored, imported and visually reviewed. Its
[source bundle](places/gc/gcv/n0262_stirling_castle/README.md) contains attributed OSM
component footprints and linked Historic Environment Scotland references. The castle boundary
is treated as a compound: the ochre Great Hall, palace and open Lion's Den, Chapel Royal,
King's Old Building, truncated Forework, magazines and defensive enclosure are separate forms.
The model depicts the restored present-day exterior. Interiors, volcanic cliff terrain,
esplanade and off-site gardens are excluded.

The source master itself has **8,327 triangles**, five merged material groups and no embedded
images. Sandstone, plaster and slate use three shared 256² graphs; glazing and lawn use local
PBR colors. Palettes are converted from sRGB into linear vertex values. Small window bars
were removed; only the Hall's large windows retain bars at the compound's roughly 0.45m
detail cutoff.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| Skyline | 1,000 | 88,764 | 1 |
| District | 3,424 | 261,144 | 5 |
| Street | 6,527 | 464,836 | 5 |
| Closeup | 8,327 | 556,856 | 5 |

Initial skyline plus district is **349,908 bytes**, excluding the shared material library.
All six source/runtime GLBs pass Khronos validation with zero errors or warnings. Source
regeneration is byte-identical. Two targeted tests pass for deterministic levels, download
and triangle budgets, shared bindings and homogeneous GPU attribute buffers. The strict
medium-fi audit passes.

Inspected **44 final captures**: 11 portable, 10 shared-loader and 23 canonical Earth context
views. Corrections addressed the entrance ramp, outer gate alignment and wall connection,
subsurface ancillary windows, roof chimneys and overly yellow stone tint. The context includes
procedural English terrace shells, three distances, noon/late light, Economy/High, an untextured
silhouette and same-camera LOD comparisons. Shared graphs load once each; unloading leaves zero
live model geometries. This is static visual QA, not physical-device timing or motion testing.

**Geographic fit remains pending.** Exact-QID way/100542995 identifies the compound, and
relation/1083531 supplies the palace courtyard. Native +Z faces southeast at heading
0.7346639643808965 from anchor [-3.948153826, 56.124036337]. Relative court levels and heights
are reconstructed. The steep volcanic outcrop needs terrain-aware placement review; the
placement stays `draft`, with `replaceFootprint=false`.

Lock **`assets-eb7a2bf27f67243d`** pins **2,332 GLBs**: six added and all 2,326 prior pins
preserved. The ledger now reports **272 authored/imported candidates**, 204 current hash pairs,
270 portable reviews, 202 shared-material reviews, 196 declared-fidelity reviews and
**108 fully ready** candidates. The existing 68 stale local output pairs remain untouched.
The whole library has **374 registered structures** and **375 source bundles**.

**Next candidate: N0263 Toompea Castle (Q859010).** Continue using the medium-fi standard,
individual source recipes, shared materials and targeted review. The active goal's older
maximum-fidelity wording is superseded by the owner's medium-fi instruction.

## 2026-10-07 — Toompea Castle, medium-fi

N0263 is authored, imported and visually reviewed. Its
[source bundle](places/ud/ud9/n0263_toompea_castle/README.md) contains attributed OSM component
footprints and linked Riigikogu references. The pink palace, curved central gable, grey courtyard
parliament, western limestone curtain, Tall Hermann, Pilsticker and Landskrone are individually
represented. The demolished fourth tower, neighboring cathedral, gardens and cliff terrain are
excluded. Courtyards stay open; the model does not promise navigable interiors.

The source master itself has **9,769 triangles**, five merged material groups and no embedded
images. Plaster, limestone and ceramic tile use three shared 256² graphs. Glazing and geometric
tricolors use local PBR colors. sRGB palettes are decoded to linear vertex values; skyline colors
compensate for the shared surface mean. Northern roofs use mapped corners rather than bounding
rectangles that would extend beyond the walls.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| Skyline | 982 | 87,880 | 1 |
| District | 3,475 | 267,960 | 5 |
| Street | 6,709 | 508,988 | 5 |
| Closeup | 9,769 | 747,672 | 5 |

Initial skyline plus district is **355,840 bytes**, excluding the shared material library.
All six source/runtime GLBs pass Khronos validation with zero errors or warnings. The source
regenerates byte-identically. Two targeted tests pass for LOD determinism, budgets, reusable
material bindings and homogeneous GPU attribute buffers. Strict medium-fi audit passes.

Inspected **44 final captures**: 11 portable, 10 shared-loader and 23 canonical Earth context
views. Corrections addressed hidden windows, facade orientation, mapped roof extents and the
three recessed palace entrances. Synthetic Bohemian townhouses provide scale/palette context.
Three distances, noon/late light, Economy/High, untextured silhouette and same-camera LOD
comparisons are recorded. Each shared graph loads once; unloading leaves zero live model
geometries. Physical-device timing and continuous-motion shimmer remain unmeasured.

**Geographic fit remains pending.** Exact-QID relation/3502552 supplies the compound; its three
towers and separate building parts are attributed in `map-frame.json`. Native +X is north and
+Z east, with heading 1.685266971193793 at [24.737375127, 59.435763956]. Castle Square is the
declared Y=0 attachment plane; the western foundation extends to -12m. The 45.6m Tall Hermann
height tag is retained between that base and its stone crown; a reconstructed 12m mast rises
above it. Published sea-level elevations are not treated as model heights. Relative ground
offsets require real terrain review. Flat context ground clips lower western/northern geometry
and must not be taken as contact approval. Placement stays `draft`, `replaceFootprint=false`.

Lock **`assets-5ac0279ec1158f7c`** pins **2,338 GLBs**: six added and all 2,332 prior pins
preserved. The ledger reports **273 authored/imported candidates**, 205 current hash pairs,
271 portable reviews, 203 shared-material reviews, 197 declared-fidelity reviews and
**108 fully ready** candidates. The 68 existing stale local output pairs remain untouched.
The whole library has **375 registered structures** and **376 source bundles**.

**Next candidate: N0264 Riga Castle (Q322183)**, followed by N0265 Château de Vincennes.
Continue using the medium-fi standard, individual source recipes, shared materials and targeted
review. No Git operations or uploads were performed.

## 2026-10-07 — Riga Castle, medium-fi

N0264 is authored, imported and visually reviewed. Its
[source bundle](places/ud/ud1/n0264_riga_castle/README.md) records the attributed OSM compound
outline, two courtyard holes, official presidency/museum references and Sudraba Arhitektura's
restoration drawings. White medieval ranges, Holy Spirit and Lead towers, square stair towers,
yellow presidential forecourt, Erker and the Three Stars steeple are individually represented.
Neighboring church spires, gardens, river walls and interiors are excluded. Courtyards stay open;
the modern gallery is a simplified opaque PBR volume.

The source master itself has **6,891 triangles**, six merged material groups and no embedded
images. Plaster, limestone, ceramic tile and copper use four shared graphs. Glass and flag/finial
colors are local PBR values. The six-group rationale is recorded in the spec. Patinated copper
reuses the common graph with high roughness and low metallic weight. Palettes decode from sRGB
to linear vertex colors; skyline compensates for the shared surface mean.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| Skyline | 659 | 55,464 | 1 |
| District | 2,762 | 205,232 | 6 |
| Street | 4,979 | 364,116 | 6 |
| Closeup | 6,891 | 513,260 | 6 |

Initial skyline plus district is **260,696 bytes**, excluding the shared material library.
All six source/runtime GLBs pass Khronos validation with zero errors or warnings. Riga source
regeneration is byte-identical; the preceding Toompea model also retains its exact source bytes
after the new shared patina alias. Two targeted tests pass for LOD determinism, budgets, shared
bindings and homogeneous GPU attribute buffers. Strict medium-fi audit passes.

Inspected **44 final captures**: 11 portable, 10 shared-loader and 23 canonical Earth context
views. Corrections addressed dark copper, square stair-tower roof alignment, noisy cornice blocks
and detail-camera framing. Synthetic Bohemian townhouses provide scale/palette context. Three
distances, noon/late light, Economy/High, untextured silhouette and same-camera LOD comparisons
are recorded. Each graph loads once; unloading leaves zero live model geometries. Physical-device
timing and continuous-motion shimmer remain unmeasured.

**Geographic fit remains pending.** Exact-QID relation/1393926 supplies the compound and two court
holes. Component subdivisions are reconstructed from plans/photos rather than claimed as surveyed
map parts. Native +X runs southeast along the river, +Z southwest toward Daugava, at heading
-1.090082784479 from anchor [24.10056334, 56.950966917]. Published medieval elevation labels are
shifted +1.8m to a conservative external Y=0 plane. Northern ranges and the 56.75m steeple maximum
retain estimated heights. Actual entrance and river-side terrain contact require review; flat
context ground is not site approval. Placement stays `draft`, `replaceFootprint=false`.

Lock **`assets-d882a9b02ac98523`** pins **2,344 GLBs**: six added and all 2,338 prior pins
preserved. The ledger reports **274 authored/imported candidates**, 206 current hash pairs,
272 portable reviews, 204 shared-material reviews, 198 declared-fidelity reviews and
**108 fully ready** candidates. The 68 existing stale local output pairs remain untouched.
The whole library has **376 registered structures** and **377 source bundles**.

**Next candidate: N0265 Château de Vincennes (Q663673).** Continue the medium-fi standard,
individual source recipes, shared materials and targeted review. No Git operations or uploads
were performed.

## 2026-10-07 — Château de Vincennes, medium-fi

N0265 is authored, imported and visually reviewed. The
[source bundle](places/u0/u09/n0265_chateau_de_vincennes/README.md) retains the exact-QID OSM
compound frame and fourteen attributed IGN BD TOPO component features, including stable CLEABS
identifiers and reported precision. CMN's official visitor plan and current photographs guide
the reconstruction. The keep, covered chemise and châtelet, Sainte-Chapelle, Tour du Village,
paired royal pavilions, porticoes and ancillary ranges are individually represented. The model
uses the present reduced perimeter towers and keep parapets; it does not restore vanished towers.

The source master itself has **12,218 triangles**, five merged material groups and no embedded
images. Limestone, slate and ceramic tile use three shared material graphs. Glass, doors and
the flag use local PBR colors. Palettes decode from sRGB to linear vertex colors; the skyline
compensates for the shared texture mean. Architectural photographs and plans are linked research
references and are not redistributed or used as textures.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| Skyline | 729 | 60,372 | 1 |
| District | 3,474 | 257,816 | 5 |
| Street | 11,602 | 840,920 | 5 |
| Closeup | 12,218 | 884,364 | 5 |

Initial skyline plus district is **318,188 bytes**, excluding shared graphs. All six GLBs pass
Khronos validation with zero errors or warnings. Source regeneration is byte-identical. Two
targeted tests pass for deterministic LODs, geometry/download budgets, shared surfaces and
homogeneous GPU attribute buffers. Strict medium-fi audit and recipe Biome checks pass.

Inspected **44 final captures**: 11 portable, 10 shared-loader and 23 canonical Earth context
views. Corrections addressed unsupported northern roof volumes, hidden end-pavilion windows,
covered-walk openings, district facade rhythms and review framing. Paris mansard procedural
buildings provide synthetic context. Three distances, noon/late light, Economy/High, untextured
silhouette and same-camera LOD comparisons are recorded. Each shared graph loads once; unloading
leaves zero live model geometries. Physical-device timing and continuous-motion shimmer remain
unmeasured. Skyline omits minor openings and entrance bridge detail.

**Geographic fit remains pending.** Anchor [2.435779375, 48.842783541] and heading 1.438616485431
come from exact-QID way/23032971. Native +X points north toward Tour du Village, +Z east. The
OSM outline includes the grounds and moat and is not extruded as a building. IGN plans place
the major components independently; merged castle features need reconstructed subdivisions and
roofs. The keep's stated IGN plan/height precisions are 3m/2.5m. Its main 50m height follows CMN;
watchturret, 59m flagmast maximum and smaller details are reconstructed. Court Y=0 and moat base
Y=-6m are declared assumptions. Flat context ground conceals the lower moat walls and is not
real-site approval. Placement stays `draft`, `replaceFootprint=false`.

Lock **`assets-1e1d81de3de11a52`** pins **2,350 GLBs**: six added and all 2,344 prior pins
preserved. The ledger reports **275 authored/imported candidates**, 207 current hash pairs,
273 portable reviews, 205 shared-material reviews, 199 declared-fidelity reviews and
**108 fully ready** candidates. The 68 existing stale local output pairs remain untouched.
The whole library has **377 registered structures** and **378 source bundles**.

**Next candidate: N0266 Eltz Castle (Q153426)**, followed by N0267 Heidelberg Castle.
Continue using the owner's medium-fi standard, source recipes, shared materials and targeted
review. No Git operations or uploads were performed.

## 2026-10-07 — Eltz Castle, medium-fi

N0266 is authored, imported and visually reviewed. Its
[source bundle](places/u0/u0v/n0266_eltz_castle/README.md) records the exact-QID OSM main-building
frame and links the owner's numbered plan, scaled section and exterior/courtyard photographs.
The eight adjoining family houses, open court, steep slate roofs, polygonal timber bays,
Rübenach white upper band, Platt-Eltz and projecting Kempenich gable are individually represented.
The immediate northern outer bailey includes the gate, short approach bridge and three
outbuildings. The distant ruined outer ward, terrain and interiors are excluded.

The source master has **5,356 triangles**, five merged material groups and **no embedded images**.
Sandstone, lime plaster, slate and wood reuse four shared material graphs; glass is local PBR.
Palette colors decode from sRGB to linear vertex colors. The skyline compensates for the
shared texture mean. Reference photographs and plans are linked research, not shipped textures.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| Skyline | 986 | 88,592 | 1 |
| District | 3,316 | 264,292 | 5 |
| Street | 5,308 | 419,536 | 5 |
| Closeup | 5,356 | 424,144 | 5 |

Initial skyline plus district totals **352,884 bytes**, excluding shared graphs. All six GLBs
pass Khronos validation with zero errors or warnings. Source regeneration is byte-identical.
Two targeted LOD tests, strict medium-fi audit and recipe Biome checks pass. Runtime attribute
buffers have homogeneous component types, avoiding the duplicated GPU upload layout.

Inspected **44 final captures**: 11 portable, 10 shared-loader and 23 canonical Earth context
views. Corrections removed coplanar faces that hid the Rübenach band, differentiated facade
rhythms, located the Kempenich gable on the east and exposed the lower floors in review views.
German Fachwerk procedural houses supply synthetic context at three distances, noon/late light
and Economy/High. Silhouette and same-camera LOD comparisons are recorded. Skyline omits minor
bays/openings and fills the small approach span. Each shared graph loads once, and unloading
leaves zero live model geometries. Continuous-motion shimmer and physical-device performance
remain unmeasured.

**Geographic fit remains pending.** Exact-QID way/238981197 supplies anchor
[7.336610781, 50.205058905], heading 1.510444051141 and the 65.003×35.497m main-building footprint.
The owner's plan compass and north entrance resolve native +X north and +Z east. House
partitions, roof profiles, outbuilding positions and terrace levels are reconstructed. The
published 35m towers include lower slope floors; the 60m rock spur is terrain, not building
height. Exported foundations sit at Y=0, the court at Y=8m and the highest chimney at 36.5m;
the source proposal records `groundModelY=8` for court attachment. The inactive draft does not
apply that offset yet; terrain approval must resolve the final runtime transform. Flat review
ground at the lowest base is not real-site
approval. Placement remains `draft` with `replaceFootprint=false` until slopes and entrances
are checked.

Lock **`assets-d13b05eb99cac498`** pins **2,356 GLBs**, adding six while preserving all 2,350
existing pins. The ledger reports **276 authored/imported candidates**, 208 current hash pairs,
274 portable reviews, 206 shared-material reviews, 200 declared-fidelity reviews and
**108 fully ready** candidates. The 68 existing stale local output pairs remain untouched.
The whole library has **378 registered structures** and **379 source bundles**.

**Next candidate: N0267 Heidelberg Castle (Q327265).** Continue individual medium-fi recipes,
shared materials and targeted review. No Git operations or uploads were performed.

## 2026-10-07 — Heidelberg Castle, medium-fi

N0267 is authored, imported and visually reviewed. Its
[source bundle](places/u0/u0y/n0267_heidelberg_castle/README.md) links the owner's current-site
isometric plan, wing photographs and architectural history. The model preserves restored
Friedrich twin gables, roofless Ottheinrich and English wings, open bell-tower crown, gate tower,
broken Dicker/Krautturm masonry, detached fallen wall, north viewing terrace and west moat walls.
The source represents the current ruin, not an invented historical roof reconstruction.

The source master has **6,948 triangles**, five merged groups, **752,596 bytes** and no embedded
images. Sandstone, lime plaster, slate and ceramic tile use four shared graphs; opaque glass
is local PBR. sRGB palette tints decode to linear and skyline uses the shared-texture mean.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| Skyline | 904 | 79,644 | 1 |
| District | 2,896 | 218,108 | 5 |
| Street | 5,182 | 384,524 | 5 |
| Closeup | 6,948 | 524,328 | 5 |

Initial skyline plus district totals **297,752 bytes**, excluding shared graphs. All six GLBs
pass Khronos validation with zero errors/warnings. Source regeneration is byte-identical.
Two targeted LOD tests, the strict medium-fi audit and recipe Biome check pass. Attribute buffer
component types remain homogeneous. No unrelated generators or dependency audits were run.

Inspected **44 final captures**: 11 portable, 10 shared-loader and 23 canonical Earth-rig frames.
Corrected missing wing basements, broken-tower normals, oversized tower openings, English-wing
alignment, north terrace seating and adjoining gate ranges. Reviews cover three distances,
noon/late light, Economy/High, untextured silhouette and four same-camera LODs. Synthetic German
Fachwerk neighbors provide scale/palette context. Skyline drops window perforations and uses
fewer tower facets while retaining open roof volumes and identity masses. Shared graphs load
once per view and unloading leaves zero model geometries. Physical-device performance and
continuous-motion shimmer remain unmeasured.

**Geographic fit remains pending.** OSM way/254154168 gives anchor [8.715271675,49.41059654] and
heading -1.430862687712; north terrace and south gate resolve +X south, +Z west. The mapped
273.118×214.468m envelope contains gardens, not individual building footprints. Wings and
height datums are manually reconstructed from the owner plan/photos; building-part requests
returned429. The gate follows its published52m height from the moat base; courtY=12m is inferred.
The proposed groundModelY=12 is not applied to the inactive draft transform. Actual hillside,
court, moat and bridge contact must be checked before activation. The flat review scene is not
terrain approval. Placement remains draft with replaceFootprint=false. Distant gardens,
terrain and palace interiors are outside this asset's scope.

Lock **assets-c657de436586763f** pins **2,362 GLBs**, adding six while preserving all 2,356 prior
entries. Readiness reports **277 authored/imported**, 209 current hash pairs, 275 portable
reviews, 207 shared-material reviews, 201 declared-fidelity reviews and **108 fully ready**.
The 68 pre-existing stale local output pairs are untouched. The whole library has **379
registered structures** and **380 source bundles**.

Continue with the next unauthored candidate after N0267, using medium-fi and individual source
recipes. No Git operations or uploads were performed.

## 2026-10-07 — Hohensalzburg Fortress, medium-fi

N0268 is authored, imported and visually reviewed. Its
[source bundle](places/u2/u23/n0268_hohensalzburg_fortress/README.md) links current owner
photographs, Salzburg's municipal architecture history and the Salzburg Museum Hettwer plan.
The broad white high palace, eight shallow parallel roofs, corner fire walls, green Krautturm
lantern, chapel spire, open courts and stepped artillery terraces survive all four levels.
The original 1220 core (22×33m) is distinguished from the later enlarged palace; current roof
form follows the 1643 replacement.

The source master has **5,419 triangles**, five merged groups, **529,524 bytes** and no embedded
images. Lime plaster, limestone, slate and patinated copper use four shared 256² graphs;
opaque glass is local PBR. sRGB palette tints decode to linear; skyline uses the shared-texture mean.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| Skyline | 957 | 76,548 | 1 |
| District | 3,327 | 257,124 | 5 |
| Street | 4,743 | 362,244 | 5 |
| Closeup | 5,419 | 409,216 | 5 |

Initial skyline plus district totals **333,672 bytes**, excluding shared graphs. All six GLBs
pass Khronos validation with zero errors/warnings. Source regeneration is byte-identical.
Two targeted LOD tests, strict medium-fi audit and recipe Biome check pass. GPU attribute
component types remain homogeneous. No unrelated model rebuild or dependency audit was run.

Inspected **44 final captures**: 11 portable, 10 shared-loader and 23 canonical Earth-rig frames.
Checks cover three distances, noon/late light, Economy/High, untextured silhouette, six
architecture cameras and four same-camera LODs. Corrected the palace foundation gap,
gate arch normals and northwestern entry position. Foundation skirts reach the declared base
so terrain can cover their lower portions. Those skirts are not a modeled mountain or a survey
of the visible cliff. The shared graphs each load once, and unloading leaves zero model
geometries. Physical-device performance and continuous-motion shimmer remain unmeasured.

**Geographic fit remains pending.** Full OSM fortress way/58379993 supplies anchor
[13.04787405,47.7952134] and heading0.255395266735. The cached global match way/58379483 is the
17×9m Georgskirche, not the whole fortress. The source-local frame corrects the new asset's
draft and retains the chapel as an orientation control; +X points east-northeast, -Z toward
the old town. The full precinct does not provide surveyed footprints for every wing.
CourtY=30m, upper terrace33m and maximum60m are reconstructed relative elevations informed
by the published 30m Kuenburg bastion. Proposed groundModelY=30 is not applied to the inactive
draft transform. Actual hillside, court and approach contact must be checked before activation.
Synthetic flat-ground review is not geographic approval. replaceFootprint=false. Distant
fortifications and palace interiors are outside the asset scope.

Lock **assets-c83af7d9f4bcb8ae** pins **2,368 GLBs**, adding six
while preserving all 2,362 previous entries. Readiness reports **278 authored/imported**,
210 current hash pairs, 276 portable reviews, 208 shared-material reviews, 202 declared-fidelity
reviews and **108 fully ready**. The 68 pre-existing stale local pairs remain untouched.
The complete library contains **380 registered structures** and **381 source bundles**.

Continue with the next unauthored candidate after N0268, using the medium-fi standard.
No Git operations or uploads were performed.

## 2026-10-07 — Vaduz Castle, medium-fi

N0269 is authored, imported and visually reviewed. Its
[source bundle](places/u0/u0q/n0269_vaduz_castle/README.md) links municipal heritage information,
current official tourism imagery, architectural history and the published Amt für Kultur
research model. The square keep, roofed southern roundel with timber hoarding, open northern
roundel, cream residence, crossed gables and valley curtain establish the silhouette. Red/white
shutters, dormers and crenellations appear at nearer levels. Wing dimensions and most elevations
are reconstructed approximations, not surveyed measurements.

The source master has **6,623 triangles**, five merged groups, **707,688 bytes** and no embedded
images. Lime plaster, limestone, ceramic tile and plain wood use four shared 256² graphs;
opaque glass is local PBR. sRGB palette tints decode to linear; skyline uses the shared-texture mean.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| Skyline | 820 | 64,184 | 1 |
| District | 2,625 | 207,476 | 5 |
| Street | 5,501 | 454,256 | 5 |
| Closeup | 6,623 | 540,680 | 5 |

Initial skyline plus district totals **271,660 bytes**, excluding shared graphs. All six GLBs
pass Khronos validation with zero errors/warnings. Source regeneration is byte-identical.
Two targeted LOD tests, strict medium-fi audit and recipe Biome check pass. GPU attribute
component types remain homogeneous. Checks were scoped to this model.

Inspected **44 final captures**: 11 portable, 10 shared-loader and 23 canonical Earth-rig frames.
Checks cover three distances, noon/late light, Economy/High, untextured silhouette, six
architecture cameras and four same-camera LODs. Darkened the tile palette and lowered the
inner-court camera after the first captures. Shared graphs load once per view; unloading leaves
zero live model geometries. Physical-device performance and continuous-motion shimmer remain
unmeasured.

**Geographic fit remains pending.** Complete compound OSM relation/1252853 supplies anchor
[9.52434566,47.139574837] and heading 1.549323723192. +X points north, about 1.23 degrees east of
true north; -Z faces west toward Vaduz and the Rhine valley. The mapped main building is about
75.448×52.756m with three internal holes and a tagged height of 30m. The western curtain and
internal wings use photographic/research-model reconstruction. Proposed court and
groundModelY=4.5m are not applied to the inactive draft. Actual hillside, courtyard and approach
contact require in-world review before activation. Synthetic flat-ground renders do not
establish terrain fit. replaceFootprint=false. Interiors and distant estate grounds are omitted.

Lock **assets-90a3afe91141aa38** pins **2,374 GLBs**, adding six
while preserving all 2,368 previous entries. Readiness reports **279 authored/imported**,
211 current hash pairs, 277 portable reviews, 209 shared-material reviews, 203 declared-fidelity
reviews and **108 fully ready**. The 68 pre-existing stale local pairs remain untouched.
The complete library contains **381 registered structures** and **382 source bundles**.

Continue with N0270 Conwy Castle, using the medium-fi standard. No Git operations or uploads
were performed.

## 2026-10-07 — Conwy Castle, medium-fi

N0270 is authored, imported and visually reviewed. Its
[source bundle](places/gc/gcm/n0270_conwy_castle/README.md) links Cadw's ground plan, current
operator photographs and architectural records. Eight open round towers, four taller eastern
stair turrets, the bent southern hall range, two wards and low end barbicans carry recognition.
The current ruin stays roofless except for the documented recessed slate chapel roof.
Internal walls and most relative elevations are approximate reconstructions.

The source master has **11,944 triangles**, five merged groups, **1,305,620 bytes** and no embedded
images. Limestone, sandstone, slate and wood use four shared 256² graphs; courtyard grass uses
a local tint. sRGB palettes decode to linear, and skyline uses the shared-texture mean.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| Skyline | 927 | 74,248 | 1 |
| District | 3,816 | 289,256 | 4 |
| Street | 9,520 | 683,896 | 5 |
| Closeup | 11,944 | 843,304 | 5 |

Initial skyline plus district totals **363,504 bytes**, excluding shared graphs. All six GLBs
pass Khronos validation with zero errors/warnings. Source regeneration is byte-identical.
Two targeted LOD tests, strict medium-fi audit and recipe Biome check pass. GPU attribute
component types remain homogeneous. Checks were scoped to this model.

Inspected **44 final captures**: 11 portable, 10 shared-loader and 23 canonical Earth-rig frames.
Review includes three distances, noon/late light, Economy/High, silhouette, six architectural
views and four same-camera LODs. Corrected the pointed arch profiles, extended the royal-hall
arch into both walls, cooled the stone tint and reframed the great-hall camera. The skyline
retains towers and wards while dropping windows, low turrets, footings and hall arches.
Each shared graph loads once per view, and unloading releases all model geometries.
Physical-device performance and continuous-motion shimmer remain unmeasured.

**Geographic fit remains pending.** OSM way/52467063 supplies anchor [-3.82555084,53.280022417]
and heading 0.07442147105 for the 122.293×58.695m footprint. River-facing east barbican and
western town entry resolve +X about 4.26 degrees north of east. Tower lobes provide controls;
the northwest tower and internal rooms also use the Cadw plan and aerial. The cached 30m
height has no reference and is provisional. Cadw's 27m curtain and 41m tower heights are
above the river; those are not substituted for model-ground heights. Proposed court and
groundModelY=2m are not applied to the inactive draft. Actual bedrock, courtyard, entrance and
neighboring bridge contact require in-world review before activation. Synthetic flat-ground
renders do not establish terrain fit. replaceFootprint=false. Town walls and bridges are
outside this asset's scope.

Lock **assets-8cfe363dcaa350c2** pins **2,380 GLBs**, adding six
while preserving all 2,374 previous entries. Readiness reports **280 authored/imported**,
212 current hash pairs, 278 portable reviews, 210 shared-material reviews, 204 declared-fidelity
reviews and **108 fully ready**. The 68 pre-existing stale local pairs remain untouched.
The complete library contains **382 registered structures** and **383 source bundles**.

Continue with N0271 Swallow's Nest, using the medium-fi standard. No Git operations or uploads
were performed.

## 2026-10-07 — Swallow's Nest, medium-fi

N0271 is authored, imported and visually reviewed. Its
[source bundle](places/sz/szb/n0271_swallow_s_nest/README.md) records the exact mapped building,
museum gallery references and photographs after the November 2020 restoration. The small
limestone folly has three stepped masses, a round eastern tower with four crown spires,
four lower hall pinnacles, a projecting balcony and a narrow wraparound terrace.
Intermediate dimensions and relief are reconstructed, not surveyed.

The source master has **9,123 triangles**, five merged groups, **969,276 bytes** and no embedded
images. Limestone, concrete, painted metal and wood use four shared 256² material graphs;
blue-grey glass uses an untextured tint. Palettes decode sRGB to linear vertex colors, and
skyline uses the shared-texture mean.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| Skyline | 688 | 57,432 | 1 |
| District | 2,663 | 216,776 | 5 |
| Street | 8,555 | 672,296 | 5 |
| Closeup | 9,123 | 714,804 | 5 |

Initial skyline plus district geometry totals **274,208 bytes**, excluding shared graphs.
All six GLBs pass Khronos validation with zero errors/warnings. Source regeneration is
byte-identical. Two targeted LOD tests, strict medium-fi audit and recipe Biome check pass.
GPU attribute component types remain homogeneous. Checks were scoped to this model.

Inspected **44 final captures**: 11 portable, 10 shared-loader and 23 canonical Earth-rig frames.
Review includes three distances, noon/late light, Economy/High, silhouette, six architectural
views and four same-camera LODs. Corrected tower panes hidden by the cylindrical wall and
changed hall openings to glazing with a wooden mullion. Each shared graph loads once per view;
unloading releases all model geometries. Physical-device performance and continuous-motion
shimmer remain unmeasured.

**Geographic fit remains pending.** OSM way/103635688 supplies the exact Q1353643 identity,
anchor [34.128585443,44.430632946], heading 0.347692146382 and 20.238×7.245m building footprint.
The eastern circular tower resolves +X about 19.92 degrees north of east. The published 12m
building height is separate from the roughly 40m natural cliff. The terrace is approximate;
proposed groundModelY=.4m is not applied to the inactive draft. Actual cliff contact, western
approach and balcony clearances require geographic review. replaceFootprint=false. Synthetic
flat-ground renders establish appearance only. Natural rock, remote paths and other buildings
are outside the model's scope.

Lock **assets-8be453f32c407af2** pins **2,386 GLBs**, adding six
while preserving all 2,380 previous entries. Readiness reports **281 authored/imported**,
213 current hash pairs, 279 portable reviews, 211 shared-material reviews, 205 declared-fidelity
reviews and **108 fully ready**. The 68 pre-existing stale local pairs remain untouched.
The full library contains **383 registered structures** and **384 source bundles**.

Continue with N0272 Kuressaare Castle under the medium-fi standard. No Git operations or uploads
were performed.

## 2026-10-07 — Kuressaare Castle, medium-fi

N0272 is authored, imported and visually reviewed. Its
[source bundle](places/u6/u6r/n0272_kuressaare_castle/README.md) records museum dimensions,
the exact mapped building/courtyard, LUMIA's floor plans and cross-section, and operator tour
photographs. The square dolomite convent building retains northern Sturvolt, slender eastern
Tall Hermann, red pyramidal roofs, inward-sloping main roof fields, an open L-shaped court,
crenellated defence gallery and timber gate oriel. Tour overhead scene 216 resolved the roof
direction; the courtyard windows use scene 75. Intermediate heights remain reconstructed.

The source master has **8,215 triangles**, five merged groups, **714,300 bytes** and no embedded
images. Limestone, ceramic tile, timber and painted metal use four shared 256² graphs;
blue-grey glass is an untextured tint. Colors decode sRGB to linear vertex tints; skyline uses
the shared-texture mean. Research drawings and photographs are linked, not redistributed.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| Skyline | 711 | 57,168 | 1 |
| District | 1,703 | 145,148 | 5 |
| Street | 8,155 | 652,632 | 5 |
| Closeup | 8,215 | 657,024 | 5 |

Initial skyline plus district geometry totals **202,316 bytes**, excluding shared graphs.
All six GLBs pass Khronos validation with zero errors/warnings. Source regeneration is
byte-identical. Two targeted LOD tests, strict medium-fi audit and recipe Biome check pass.
GPU attribute component types remain homogeneous. Checks were scoped to this model.

Inspected **44 final captures**: 11 portable, 10 shared-loader and 23 canonical Earth-rig frames.
The review covers three distances, noon/late light, Economy/High, silhouette, six architecture
views and four same-camera LODs. Corrected buried courtyard panes and moved the cloister camera.
Reserved the small court bowl for close-up, resolving initially identical street/closeup levels.
Each shared graph loads once per view; unloading releases all model geometries. Physical-device
performance and continuous-motion shimmer remain unmeasured.

**Geographic fit remains pending.** Exact Q1768091 OSM relation/414356 supplies anchor
[22.479324007,58.246897902], heading -0.563076620916, 42.607×41.783m outline and courtyard hole.
The northern defence tower and eastern watchtower resolve +X 32.26 degrees south of east and
-Z northeast gate. The museum publishes a 43m square plan and 37m defence tower. Map height
25m has an explicit approximation note and is not used for the tallest tower. The 37m source
does not state its roof/finial datum; the model includes the finial within that height.
Watchtower 38.2m, eaves and intermediate levels are inferred from drawings and photos.
GroundModelY=0 is declared, but actual terrain contact and gate approach await in-world review.
The draft remains inactive, with replaceFootprint=false. Synthetic flat-ground renders establish
appearance only. Bastions, moat, Cannon Tower and neighboring buildings are outside this asset.

Lock **assets-d11650b8295965d0** pins **2,392 GLBs**, adding six
while preserving all 2,386 prior entries. Readiness reports **282 authored/imported**, 214 current
hash pairs, 280 portable reviews, 212 shared-material reviews, 206 declared-fidelity reviews and
**108 fully ready**. The 68 pre-existing stale local pairs remain untouched. The full library
contains **384 registered structures** and **385 source bundles**.

Continue with N0273 Caernarfon Castle under the medium-fi standard. No Git operations or uploads
were performed.

## 2026-10-07 — Caernarfon Castle, medium-fi

N0273 is authored, imported and visually reviewed. Its
[source bundle](places/gc/gck/n0273_caernarfon_castle/README.md) records the mapped perimeter,
Cadw ground plan and listed-building inventory, plus current operator and Buttress architect
photographs/drawings. Recognition comes from the polygonal towers, Eagle Tower's three turrets,
banded river curtain, two open wards and contrasting gatehouses. The near levels include
selected restored timber decks, glazed lift lobby and surviving range foundations.

The source master has **16,236 triangles**, five merged groups, **1,788,164 bytes** and no images.
Limestone, timber and painted metal use three shared 256² graphs; glazing and grass are
untextured tints. Broad masonry bands share the limestone group through linear vertex colors.
The recipe decodes sRGB colors and compensates skyline tint by the shared graph mean.
Photographs and drawings are linked references, not redistributed textures.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| Skyline | 722 | 60,452 | 1 |
| District | 3,836 | 307,816 | 3 |
| Street | 15,366 | 1,182,216 | 5 |
| Closeup | 16,236 | 1,250,296 | 5 |

Initial skyline plus district geometry totals **368,268 bytes**, excluding shared graphs.
All six GLBs pass Khronos validation with zero errors/warnings. Source regeneration is
byte-identical. Two targeted LOD tests, strict medium-fi audit and recipe Biome check pass;
GPU attribute component types are homogeneous. Checks were scoped to the model.

Inspected **44 final captures**: 11 portable, 10 shared-loader and 23 canonical Earth-rig frames.
They cover three distances, noon/late light, Economy/High, silhouette, six architecture views
and four same-camera LODs. Reduced an over-detailed district level by abbreviating interior
banding and crenellations; restored selective turret crowns to retain the 35m silhouette.
Removed duplicate straight-wall battlements and aligned Queen's Gate tunnel to the tower pair.
Close-up adds selected seating, window divisions and coarse eroded figures; fine joints,
narrow arrow loops, micro-bevels, full stair systems and interiors are omitted. Each graph loads
once per view and unloading releases model geometries. Continuous-motion shimmer and physical
device performance remain unmeasured.

**Geographic fit remains pending.** Exact Q275128 way/70264991 supplies anchor
[-4.277013785,53.139327542], heading 0.189928481827 and 174.55×65.474m perimeter. The western
Eagle Tower, northern King's Gate and eastern Queen's Gate resolve +X 10.88 degrees north
of east, with -Z facing the town. Foundations Y=0, court/groundModelY=2m, tower/curtain heights,
35m maximum and gate deck levels are inferred from plan/photographic ratios, not surveyed.
Actual rock, river-facing contact and both gate approaches require in-world review. The draft
remains inactive, replaceFootprint=false. Synthetic flat-ground captures establish appearance.
Town walls, approach bridge, quay and natural terrain are outside the model.

Lock **assets-42f21e65bc015c84** pins **2,398 GLBs**, adding six
and preserving all 2,392 previous entries. Readiness reports **283 authored/imported**, 215
current hash pairs, 281 portable reviews, 213 shared-material reviews, 207 declared-fidelity
reviews and **108 fully ready**. The 68 pre-existing stale local pairs remain untouched. Full
library: **385 registered structures**, **386 source bundles**.

Continue with N0274 under the medium-fi standard. No Git operations or uploads were performed.

## 2026-10-07 — Hermann Castle, medium-fi

N0274 is authored, imported and visually reviewed. Its
[source bundle](places/ud/uds/n0274_hermann_castle/README.md) records the exact mapped site,
Narva Museum's Western Yard site plan, architectural history and current restored photographs.
The off-white Tall Hermann, red gable and projecting dark timber gallery/oriel, inward roof ring,
open inner court and southwest octagonal turret establish identity. Stone Hall, northern/western
forecourts, perimeter walls and representative craft shelters complete the present site arrangement.
The demolished arsenal is marked with paving strips, not reconstructed as a building.

The source master has **5,406 triangles**, five merged groups, **493,300 bytes**, and zero images.
Limestone, tile and timber use three shared 256² graphs; glazing and lawn are untextured tints.
Off-white tower and warm masonry share the limestone graph through vertex colors. A separately
tinted tile graph supplies simplified seams on the grey small turret roof. Colors decode from
sRGB to linear; skyline uses the shared graph mean. Research images and drawings are linked,
not redistributed or used as model textures.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| Skyline | 814 | 64,464 | 1 |
| District | 1,520 | 123,864 | 5 |
| Street | 2,958 | 234,168 | 5 |
| Closeup | 5,406 | 411,884 | 5 |

Initial skyline plus district geometry totals **188,328 bytes**, excluding shared graphs.
All six GLBs pass Khronos validation with zero errors/warnings. Two targeted LOD tests,
strict medium-fi audit, recipe Biome and byte-identical source regeneration pass. GPU attribute
component types are homogeneous. Checks were scoped to Hermann; no dependency audit or broad
model rebuild was run.

Inspected **44 final captures**: 11 portable, 10 shared-loader and 23 canonical Earth-rig frames.
The set covers three distances, noon/late light, Economy/High, silhouette, six architecture
views and four same-camera LODs. Corrected an overly regular first-pass facade grid to sparse
local openings and broad bare masonry. Skyline retains the tower/gable/hoarding, small turret,
roof ring and forecourt masses. Near levels add gallery supports, windows, selected strips,
craft shelters and benches. Each graph loads once per view; unloading releases model geometry.
Continuous-motion shimmer and physical-device performance remain unmeasured.

**Geographic fit remains pending.** Exact Q660001 relation/5434279 supplies anchor
[28.200695255,59.375639522], heading0.198046850682 and210.085×177.077m entire-site perimeter.
Museum LH-AS-1 plan aligned by corresponding perimeter controls resolves the western forecourt,
eastern convent, northwest Tall Hermann and North Yard. Component positions are interpreted
approximations, not cadastral or conservation measurements. The modern convent envelope is about
45×43m; the city booklet's40m dimension concerns the historical castell. Museum publishes Tall
Hermann51m with unspecified datum; other heights and groundY0 are inferred. Current restored
gable and hoarding are modeled as observed, with the museum's authenticity caveat recorded.
Actual cliff-side seating and north/west approaches require in-world review. Draft remains
inactive, replaceFootprint=false. No fabricated cliff, moat, river or Ivangorod Fortress.
Synthetic flat-ground captures establish appearance only.

Lock **assets-4b2fb3ba972af0c1** pins **2,404 GLBs**, adding six
and preserving all 2,398 previous entries. Readiness: **284 authored/imported**, 216 current hash
pairs, 282 portable reviews, 214 shared-material reviews, 208 declared-fidelity reviews and
**108 fully ready**. The 68 pre-existing stale local pairs remain untouched. Full library:
**386 registered structures**, **387 source bundles**.

Continue with N0275 under docs-src/guide/medium-fi.md. No Git operations or uploads were performed.

## 2026-10-07 — Dublin Castle, medium-fi

N0275 is authored, imported and visually reviewed. Its
[source bundle](places/gc/gc7/n0275_dublin_castle/README.md) records the exact mapped campus,
OPW site plans, architectural descriptions and current exterior/aerial photographs. Recognition
comes from the round Record Tower beside the pinnacled Gothic Chapel Royal, the Bedford octagonal
clock tower and green ogee dome above an open Upper Court, and the circular Dubh Linn garden
south of painted State Apartments. Blue Bermingham Tower, Chester Beatty's U-shaped brick range
and clock cupola, the castellated Coach House and abbreviated existing peripheral ranges complete
the interpreted exterior campus. Strategic-plan future proposals are excluded.

The source master has **10,334 triangles**, **1,060,080 bytes**, seven merged groups and zero images.
Stone, brick, render, slate and copper use five shared 256² graphs; glazing/lawn are untextured
tints. The mixed campus needs seven groups to retain masonry/render and slate/copper differences.
Colors decode sRGB to linear, and skyline applies the shared graph mean. Research photographs
are linked as evidence, never shipped or used as textures.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| Skyline | 946 | 71,556 | 1 |
| District | 3,921 | 300,672 | 7 |
| Street | 7,706 | 585,996 | 7 |
| Closeup | 10,334 | 775,936 | 7 |

Initial skyline plus district geometry totals **372,228 bytes**, excluding shared graph downloads.
All six GLBs pass Khronos validation with zero errors/warnings. Two Dublin-specific LOD tests,
strict medium-fi audit, recipe Biome and byte-identical source regeneration pass. GPU attribute
component types are homogeneous. Checks were scoped to Dublin, with no dependency audit,
engine-wide suite or unrelated source rebuild.

Inspected **44 final captures**: 11 portable, 10 shared-loader and 23 canonical Earth-rig frames.
The set covers three distances, noon/late light, Economy/High, silhouette, six architectural
views and four same-camera LODs. Corrected a below-ground doorway sill and southwest courtyard
connection, and reduced the first 52,986-triangle master by replacing hidden frame sides with
planar strips and restricting trim to selected bays. A dedicated skyline stays below 1,000
triangles while retaining the round towers, Gothic roof/pinnacle profile, green clock pavilions,
open courtyard massing and circular garden. All levels retain the same mapped ground boundary,
avoiding an initial ground-plane change at the skyline switch. Each graph loads once per view;
eviction disposes model geometry. Continuous-motion shimmer and physical-device performance
remain unmeasured. Demonstrative procedural neighbors in the review rig are not actual map data.

**Geographic fit remains pending.** Exact Q742767 way/350242806 supplies anchor
[-6.266610512,53.342658821], heading0.217908808734 and262.431×245.981m entire-campus perimeter,
not building footprints. Three interpreted corresponding perimeter points align OPW's north-up
base plan with the mapped site; the illustrated current-campus map and aerial photos cross-check
the layout. All component dimensions and elevations are inferred, including Bedford's34m finial
and Record Tower's24.8m crown. No surveyed or published overall height is claimed. Painted rear
bands and serpent garden paths are stylized interpretations. Actual terrain, entry approaches
and interactions with mapped building footprints need in-world review. Draft remains inactive,
replaceFootprint=false. Synthetic flat-ground images establish appearance only.

Lock **assets-084fe10c9bf6f301** pins **2,410 GLBs**, adding six and preserving all 2,404 previous entries.
Readiness: **285 authored/imported**, 217 current hash pairs, 283 portable reviews, 215 shared-material
reviews, 209 declared-fidelity reviews and **108 fully ready**. The 68 pre-existing stale local pairs
remain untouched. Full library: **387 registered structures**, **388 source bundles**.

Continue with N0276 under docs-src/guide/medium-fi.md. No Git operations or uploads were performed.

## 2026-10-07 — Miramare Castle, medium-fi

N0276 is authored, imported and visually reviewed. Its
[source bundle](places/u2/u21/n0276_miramare_castle/README.md) preserves the exact mapped
building outline, primary museum architecture/tower references and links to current government
museum photographs. Recognition comes from ivory angled crenellated wings, the square southwest
clock tower and four corner turrets, and selected rounded window groups, recessed tall stair
glazing and projecting sea-side bay. A landward paired-window pavilion interrupts the facade;
low pitched roof fields stay behind the parapets. The park, Castelletto, cliff, terrace retaining
walls and interior are outside this building asset.

The source master has **9,918 triangles**, **1,042,572 bytes**, three merged groups and no images.
Limestone and slate use two shared 256² graphs; blue-grey glass is an untextured tint. Colors
decode sRGB to linear. The hand-authored skyline applies the shared graph mean. Research photos
remain linked evidence, never textures or redistributed source files.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| skyline | 862 | 69,792 | 1 |
| district | 3,424 | 254,072 | 3 |
| street | 7,418 | 539,192 | 3 |
| closeup | 9,918 | 698,192 | 3 |

Initial skyline plus district geometry is **323,864 bytes**, excluding shared graph downloads.
All six GLBs pass Khronos validation with zero errors/warnings. Two targeted Miramare LOD tests,
strict medium-fi audit, recipe Biome and byte-identical source regeneration pass. GPU attribute
component types are homogeneous. Checks were scoped to Miramare, with no dependency audit,
engine-wide suite or unrelated generator rebuild.

Inspected **44 final frames**: 11 portable, 10 shared-loader and 23 canonical Earth-rig views.
They cover three distances, noon/late light, Economy/High, silhouette, six architectural views
and four same-camera LODs. Fixed inward-facing stair glazing, overlapping generic windows and
wing parapets crossing the clock face. The skyline keeps the angled footprint, tower and corner
turret/crenellation profile under 1,000 triangles, dropping subpixel parapet underside/end faces.
Near details use sparse planar surrounds, not closed frames on every bay. Every level retains
the mapped ground outline and Y0 attachment. Both shared graphs load once per view; unloading
disposes model geometries. Physical-device performance and continuous-motion shimmer remain
unmeasured. Demonstrative procedural neighbors in the flat review scene are not actual Trieste
map data.

**Geographic fit remains pending.** Exact Q165069 way/361092895 supplies the 60.48×33.574m
building outline, anchor [13.712453245,45.702528846] and heading0.008338727695. Primary views
resolve the southwest clock tower and axis sign. The museum's published **35m is above sea**;
the model's **29m is above a provisional terraceY0**, inferred with an approximate6m offset
from exterior photographs. This is not a surveyed datum conversion. Other elevations, windows
and pavilions are interpreted. Real terrain, approaches and mapped-footprint replacement need
in-world review. Draft remains inactive, replaceFootprint=false. Synthetic captures establish
appearance only.

Lock **assets-cd70c1168a7ef183** pins **2,416 GLBs**, adding six and preserving all 2,410 previous pins.
Readiness: **286 authored/imported**, 218 current hash pairs, 284 portable reviews, 216 shared-material
reviews, 210 declared-fidelity reviews and **108 fully ready**. The 68 pre-existing stale local
pairs remain untouched. Full library: **388 registered structures**, **389 source bundles**.

Continue with N0277 under docs-src/guide/medium-fi.md. No Git operations or uploads were performed.

## 2026-10-07 — Lubart's Castle, medium-fi

N0277 is authored, imported and visually reviewed. Its
[source bundle](places/u9/u94/n0277_lubart_s_castle/README.md) preserves the corrected whole-castle
compound outline and linked primary museum aerial/exterior photographs, city tower description
and regional architecture references. Recognition comes from three differently capped brick
towers in an irregular triangular enclosure, the buttressed west entry with a real open portal,
and the covered timber wall walk. The open court contains the cream noble-house range, an ochre
columned book museum and the contemporary blue-grey church excavation cover. No destroyed full
palace, restored medieval church, lower castle, neighbors or temporary event structures are recreated.

The source master has **4,497 triangles**, **506,992 bytes**, eight merged groups and no images.
Six shared 256² graphs supply brick, limestone, lime plaster, cedar shingle, painted metal and
plain wood. Glass and lawn stay untextured. The mixed-campus material count is declared; vertex
colors decode sRGB to linear. Photographs remain linked research, never private textures.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| skyline | 882 | 66,348 | 1 |
| district | 2,551 | 187,880 | 8 |
| street | 4,197 | 288,472 | 8 |
| closeup | 4,497 | 310,004 | 8 |

Initial skyline plus district geometry is **254,228 bytes**, excluding shared graph downloads.
All six GLBs pass Khronos validation with zero errors/warnings. Two targeted LOD tests, strict
medium-fi audit, recipe Biome and byte-identical source regeneration pass. GPU attribute
component types are homogeneous. Checks were scoped to Lubart, with no dependency audit,
engine-wide suite or unrelated model regeneration.

Inspected **44 final frames**: 11 portable, 10 shared-loader and 23 canonical Earth-rig captures,
covering three distances, noon/late, Economy/High, silhouette, six architectural cameras and
four same-camera LODs. Fixed missing entry-side curtain segments and disconnected gallery roof
fields. The hand-authored skyline keeps the three-tower/open-court hierarchy, portal, buttresses
and covered roof under 1,000 triangles. District adds sparse openings, street adds gallery posts,
loopholes and cornices, closeup adds selected planar surrounds. Repeated details merge by material;
fine rails, wires and carving are omitted. All levels retain the same base footprint, Y0 and 28m
maximum. Each shared graph loads once per view and unloading disposes geometry. Physical-device
performance and continuous-motion shimmer/pop remain unmeasured. Demonstration procedural
neighbors and flat review ground are not actual Lutsk map data.

**Geographic fit remains pending.** The existing automated Q1866166 match at way/564453419 is
the **church ruins**, not the castle perimeter. Correct castle compound way/633707797 supplies
115.949×100.204m plan, anchor [25.323548196,50.738747737] and heading0.776523631346. Both identities
and the church outline are documented in source-local map-frame.json; broad cached evidence is
preserved. Current operator aerial resolves west entry, north Bishop and southeast Styr tower.
Entry28m/Styr27m are chosen within conflicting27–28m primary descriptions. Bishop's published
13.5m has uncertain roof/datum extent; the13.5m body plus inferred7m roof is an explicit
interpretation, not a verified20.5m total. Individual component plans/elevations and flat courtyard
Y0 remain approximate, and roof overhangs broaden the compound envelope. Real hill terrain,
approaches and footprint replacement need in-world review. Draft is inactive,replaceFootprint=false.

Lock **assets-585c566f921335be** pins **2,422 GLBs**, adding six and preserving all 2,416 previous pins.
Readiness: **287 authored/imported**, 219 current hash pairs, 285 portable reviews, 217 shared-material
reviews, 211 declared-fidelity reviews and **108 fully ready**. The 68 pre-existing stale local
pairs remain untouched. Full library: **389 registered structures**, **390 source bundles**.

Continue with N0278 under docs-src/guide/medium-fi.md. No Git operations or uploads were performed.

## 2026-10-07 — Kamianets-Podilskyi Castle, medium-fi

N0278 is authored, imported and visually reviewed. Its
[source bundle](places/u8/u8d/n0278_kamianets_podilskyi_castle/README.md) contains an interpretive
trace of the original Sitsinsky ground plan, qualified by the city architectural walk and current
municipal photograph. Recognition comes from the irregular open limestone court, tall pointed
northern roofs with warm arched crown bands, broad-capped square/octagonal/round Papal tower,
pentagonal New East corner and paired open western bastion. Lower outer courts and casemate
ranges remain subordinate. The separate New Castle hornwork, river-level Water tower, canyon,
city bridge and removed Stanislaw/Black gates are excluded.

The source master has **4,182 triangles**, **494,304 bytes**, six merged groups and no images.
Five shared 256² graphs supply limestone, brick, lime plaster, cedar shingle and plain wood.
Blue-grey glass stays untextured. Hard architectural normals, 8/12/16-sided towers and linear
vertex tints follow the medium-fi guide. Photographs and plans remain linked research.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| skyline | 850 | 70,724 | 1 |
| district | 1,646 | 138,828 | 5 |
| street | 2,814 | 228,712 | 6 |
| closeup | 4,182 | 335,420 | 6 |

Initial skyline plus district geometry is **209,552 bytes**, excluding shared graph downloads.
All six GLBs pass Khronos validation with zero errors/warnings. Two targeted LOD tests, strict
medium-fi audit, recipe Biome and byte-identical source regeneration pass. GPU attribute
component types are homogeneous. Checks were scoped to this model; no dependency audit,
engine-wide suite or unrelated model regeneration was run.

Inspected **44 final frames**: 11 portable, 10 shared-loader and 23 canonical Earth-rig views,
including distances, noon/late lighting, Economy/High, untextured silhouette, architectural
cameras and four same-camera LODs. Corrected hidden crown apertures and aligned Papal windows
with its staged body. Skyline preserves the open court, tower/roof hierarchy, real entry void
and lower ranges. District adds sparse apertures; street adds gunhole/crown rhythm and limited
stone bands; closeup adds selected planar surrounds. All levels retain Y0 and 35m maximum.
Facet reductions vary the maximum X extent by 0.68m; static transitions show expected detail
changes. Shared graphs load once per view and all geometry disposes on unloading. Physical
device performance and continuous-motion shimmer remain unmeasured. Synthetic flat ground and
procedural neighbors do not establish actual Kamianets placement.

**Geographic fit remains pending.** Exact way/274749273 is a broad site boundary with defenses
and approach, not an inner building footprint. It is retained as evidence and never extruded
as a solid body. The modeled inner plan uses an interpretive diagram trace, X0.6/Z0.52m per pixel,
within the approximate published old-castle dimensions. Individual tower positions, radii,
heights, roof slopes and facade details are inferred, not a current survey. Reference anchor
[26.5625,48.67333333] is not surveyed courtyard center; northwest/southeast sign is interpreted,
and exact map registration remains pending. The 35m tallest roof is a visual target, not a
verified height. Flat Y0 does not represent the sloped court or canyon. Activation, terrain
seating and footprint replacement require in-world review; replaceFootprint=false.

Lock **assets-7d94ad2bc8df2698** pins **2,428 GLBs**, adding six and preserving all 2,422 previous pins.
Readiness: **288 authored/imported**, 220 current hash pairs, 286 portable reviews, 218 shared
reviews, 212 declared-fidelity reviews and **108 fully ready**. The 68 pre-existing stale local
pairs remain untouched. Full library: **390 registered structures**, **391 source bundles**.

Continue with N0279 Gripsholm Castle under docs-src/guide/medium-fi.md. No Git operations or
uploads were performed. The active project still has 712 candidates without authored models.

## 2026-10-07 — Gripsholm and Trakai, medium-fi

N0279 [Gripsholm Castle](places/u6/u6s/n0279_gripsholm_castle/README.md) and N0280
[Trakai Island Castle](places/u9/u99/n0280_trakai_island_castle/README.md) are authored,
imported and visually reviewed under [medium-fi](../../../docs-src/guide/medium-fi.md).
Editable recipes, qualified map controls, primary references, source/runtime metadata,
four runtime levels and hash-bound reviews are registered with the source build.

Gripsholm retains two mapped courtyard holes, four distinct faceted copper tower caps,
the tall open lantern, stepped brick dormers, lower tiled wings and a northwest entrance
passage. Its master has **5,247 triangles**, **626,436 bytes**, six merged groups and no
images. Five shared 256² graphs supply brick, granite, limestone, oxidized copper and tile;
glass remains untextured. Its exact mapped compound is 137.835×63.929m. Tower heights and
roof profiles are photo-based estimates, with the highest cap interpreted at 42m.

Trakai retains the separate ducal palace and trapezoidal forecourt, three cone-roof corner
towers, square entry, tall gabled donjon, open courts and short connecting bridge. Its
master has **3,386 triangles**, **409,548 bytes**, five merged groups and no images. Four
shared 256² graphs supply brick, granite, tile and plain wood; glass is untextured. Corrected
the palace wing steps to honor the mapped courtyard edges, aligned the wood galleries with
those walls and adjusted the review cameras to show the gallery and whole compound.

| Model | Level | Triangles | GLB bytes | Material groups |
| --- | --- | ---: | ---: | ---: |
| Gripsholm Castle | skyline | 943 | 79,804 | 1 |
| Gripsholm Castle | district | 2,497 | 209,564 | 6 |
| Gripsholm Castle | street | 4,061 | 317,096 | 6 |
| Gripsholm Castle | closeup | 5,247 | 395,488 | 6 |
| Trakai Island Castle | skyline | 612 | 53,228 | 1 |
| Trakai Island Castle | district | 1,358 | 112,760 | 5 |
| Trakai Island Castle | street | 2,926 | 213,940 | 5 |
| Trakai Island Castle | closeup | 3,386 | 249,256 | 5 |

Initial skyline plus district geometry is **289,368 bytes** for Gripsholm and **165,988 bytes**
for Trakai, excluding shared graph downloads. All per-level budgets pass. Each model has
**44 inspected final frames**: 11 portable, 10 shared-loader and 23 canonical Earth-rig
captures, covering noon/late lighting, Economy/High, street/block/skyline, untextured
silhouette, six architectural views and four same-camera LODs. Architectural normals are
hard; tower facets reduce at distance. All LODs keep Y0 and their maximum roof height.
Shared graphs load once per view, and eviction disposes all geometry. Physical-device
timings and continuous-motion shimmer/pop remain unmeasured.

All 12 new GLBs pass Khronos validation with zero errors/warnings and zero embedded images.
Four targeted LOD tests, strict medium-fi audits, recipe lint checks and byte-identical
targeted source regeneration pass. GPU attribute component types are homogeneous. A test
expectation was corrected to Trakai's actual shared brick binding. Validation was scoped
to the changed models; no dependency audit, full engine CI or unrelated model generation
was performed.

**Geographic fit remains pending for both.** Gripsholm's building relation includes the
compound and both courts, but no measured heights or terrain datum. Trakai's relation
covers only the 38.019×35.269m palace. Its whole forecourt is a sparse interpretive trace of
the primary 2023 archaeological Figure1/page124, approximately scaled at 50/135m per pixel
and visually aligned to the palace frame. The museum's historical planned donjon dimensions
9.2×9.6m/33m are not a current restored-tower survey. Other dimensions are photo estimates.
Flat review ground and procedural neighbors are synthetic. Real-site direction, full
component registration, moat/bridge levels, terrain seating and replacement require
in-world review; both drafts remain inactive with replaceFootprint=false. Lake/island
terrain, long shore bridge, remote buildings, trees, boats and interiors are excluded.
Research photographs and plans remain linked evidence, never embedded model textures.

Lock **assets-19990bd81a0bdc1d** pins **2,440 GLBs**, adding 12 and preserving all **2,428** previous
pins. This targeted checkpoint preserves unrelated locked bytes; it is not a new clean
cross-platform source-build proof. Readiness: **290 authored/imported**, 222 current hash
pairs, 288 portable reviews, 220 shared reviews, 214 fidelity reviews and **108 fully ready**.
The 68 existing stale local pairs remain untouched. Full library: **392 registered
structures**, **393 source bundles**. Catalogs, readiness and both galleries are current.

Continue with **N0281 Acrocorinth** using the medium-fi guide. The active project has
710 candidates without authored models. No Git operations or uploads were performed.

## 2026-10-07 — Acrocorinth, medium-fi

N0281 [Acrocorinth](places/sw/sw8/n0281_acrocorinth/README.md) is authored, imported and
visually reviewed under [medium-fi](../../../docs-src/guide/medium-fi.md). The deterministic
[recipe](../../../packages/worldgen/scripts/acrocorinth-model.mjs) and its source controls,
licensed archaeological lines, terrain grid and references reconstruct the surviving
fortified ridge, three successive western gates, inner towers, rectangular Ottoman keep,
small citadel, low cistern boundary and selected roofless remains.

The Ministry's six official photographs were inspected. ASCSA's primary Acrocorinth layer
supplies 192 records, 209 parts and 2,321 points. Selected wall courses are transformed from
their ellipsoidal orthographic CRS, rounded and simplified; their height and completeness
are not surveyed. The cached exact-QID OSM way is an archaeological site boundary, not a
building or a curtain footprint. It differs visibly from the archaeological wall plan and
is used for identity and the provisional frame, without extruding that polygon into walls.

The 960×640m relative terrain patch uses 425 bilinear Mapzen/Terrarium samples at 40m
spacing, from approximately 30m EU-DEM source data. Subtracting 258.37m gives a Y0 minimum
and 312.85m relative summit. Native origin is [22.873283683, 37.891346465], with provisional
heading -0.026117351143 rad. This datum is not the ground height at that origin. Individual
gate thresholds, openings, wall heights, cliff/outcrop coverage and terraces are estimates.

The generated master has **6,430 triangles**, **774,372 bytes**, four merged groups and no
embedded images. Three existing shared 256² graphs supply limestone, weathered limestone
and gravel. Terrain and recess colors are untextured. Physical-repeat UVs and linear
vertex tints preserve the common material library. Fine joints, slits, railings, carving,
microbevels and lost roofs are excluded; selected broad battlements and gate panels carry
recognition. Small unidentified remains stay roofless; the living Agios Dimitrios church
is not guessed onto an uncertain line in the plan.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| skyline | 714 | 65,188 | 1 |
| district | 2,222 | 190,436 | 3 |
| street | 4,212 | 376,196 | 4 |
| closeup | 6,430 | 558,928 | 4 |

Initial skyline plus district geometry is **255,624 bytes**, excluding shared graph
downloads. All levels meet the medium-fi caps, preserve the same horizontal bounds and
relative summit, and use homogeneous GPU attribute types. Wall footings follow each
level's actual triangular terrain. Gate thresholds, keep footing and summit nodes are
shared across levels. Coarse terrain tessellation and outcrop masks still change across
distant levels; continuous-motion pop and shimmer need further assessment.

**44 final frames were inspected**: 11 portable, 10 shared-loader and 23 canonical Earth-rig
views covering noon/late, Economy/High, street/block/skyline, untextured silhouette, six
architectural cameras and four same-camera LODs. The first review caught an oversized
cistern slab/block; it was replaced by low terrain-following edges. Rocky outcrops were
broadened and the keep camera tightened. A large-context review-camera clipping issue
was fixed in the fixture; distant views were recaptured and inspected. No runtime viewer
behavior was changed by that fixture adjustment. Synthetic sparse Italian-palazzo neighbors
and a flat plane do not establish a real Greek hill context or terrain fit.

All six GLBs pass Khronos validation with zero errors/warnings and no images. Two targeted
LOD tests, the strict medium-fi audit, recipe/fixture lint and byte-identical source
regeneration pass. Shared graphs load once per view; eviction leaves no live model
geometry. LOD recipe hashes include map controls, archaeological lines and terrain grid.
Generated READMEs can now state model-specific provenance. Physical laptop/phone timing
and continuous-motion behavior remain unmeasured. No dependency audit, full engine CI
or unrelated model generation was run for this model iteration.

**Geographic activation remains pending.** Historic plan registration, current surviving
state, signed direction, vertical datum, gate-footing corrections and patch-edge blending
with host terrain need in-world review. Patch edges are visibly unblended over the flat
review plane. The draft remains inactive with replaceFootprint=false. Modern approach
roads, vegetation, visitor fixtures, interiors and buried archaeology are outside scope.

The adapted archaeological data and this asset's model geometry are **CC-BY-SA-4.0**,
credited to James A. Herbst, Corinth Excavations, American School of Classical Studies
at Athens. Generator code keeps the repository license. The source bundle retains
[license and attribution](places/sw/sw8/n0281_acrocorinth/LICENSE.md), OSM identity/frame
attribution and Copernicus/EU-DEM terrain credits. Research photographs remain external
evidence and do not ship as textures or images.

Lock **assets-9825da683e562e3a** now pins **2,446 GLBs**, adding six and preserving all **2,440**
previous pins. This is a scoped checkpoint, not a clean cross-platform full-source rebuild.
Readiness: **291 authored/imported**, 223 current hash pairs, 289 portable reviews,
221 shared reviews, 215 fidelity reviews and **108 fully ready**. The 68 old stale local
pairs remain untouched. Full library: **393 registered structures / 394 source bundles**.
Catalogs, readiness and both galleries are current.

Continue with **N0282 Akershus Fortress**, following medium-fi. **709** candidates lack
authored models. The project remains active; no Git operations or uploads were performed.

## 2026-10-07 — Akershus Fortress, medium-fi

N0282 [Akershus Fortress](places/u4/u4x/n0282_akershus_fortress/README.md) is authored,
imported and visually reviewed under [medium-fi](../../../docs-src/guide/medium-fi.md).
The deterministic [recipe](../../../packages/worldgen/scripts/akershus-fortress-model.mjs)
and source controls reconstruct an open-court castle, two broad-capped clock spires,
stepped brick gables, stone lower towers, terraced ramparts and selected inner-fortress
supporting buildings. This is an approximate exterior study, not a surveyed whole-site model.

Agency and museum photographs and the primary Forsvarsbygg Fortress Trail isometric
diagram were inspected. The cached exact-QID OSM relation maps the castle ring and one
courtyard only. Its 117.171×53.677m plan is rotated into native +X east/+Z south, heading 0,
at [10.736251164, 59.906686713]. Wider walls, bastions, building centers and ponds are
estimated from the unscaled isometric plan; current wider-site mapping was unavailable.
All elevations are estimates: castle court Y12 and highest spire Y54 over a provisional
lower-ground Y0 are authoring values, not measured elevations or actual tower heights.
OSM ele27 is not used as a surveyed vertical datum.

The master has **3,883 triangles**, **470,460 bytes**, eight merged groups and no embedded
images. Six existing shared 256² graphs supply granite, brick, slate, ceramic tile, copper
and lime plaster. Glazing and terraced ground remain untextured. Metric repeat UVs, linear
vertex tints and hard face normals follow the common style. Individual bricks, thin rails,
microbevels, interiors and demolished historic defenses are excluded.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| skyline | 997 | 88,136 | 1 |
| district | 2,119 | 188,236 | 8 |
| street | 3,779 | 327,120 | 8 |
| closeup | 3,883 | 334,084 | 8 |

Initial skyline plus district geometry is **276,372 bytes**, excluding shared graph
downloads. All levels meet the medium-fi caps. Ground Y0 and the provisional highest
spire remain stable; small horizontal bound differences follow wall-thickness and bend
simplification. Distant stepped outlines change between levels; continuous-motion pop
and shimmer still need assessment. The detail master is preserved separately.

**44 final frames were inspected**: 11 portable, 10 shared-loader and 23 canonical
Earth-rig views covering noon/late, Economy/High, three distances, untextured silhouette,
six architectural cameras and four same-camera LODs. Review caught an entrance blocked
by two intersecting wall segments, supporting buildings outside the estimated enclosure,
buried clock faces and pond surfaces, floating chimneys and roof daylight seams. These
were repaired, including thick stepped gables and roof underside caps; every final
capture was regenerated and inspected after the last geometry change.

All six GLBs pass Khronos validation with zero errors/warnings and no images. Two
targeted LOD tests, strict medium-fi budget audit, recipe lint and byte-identical source
regeneration pass. Shared graphs load once per view and unload leaves no live model
geometry. GPU attribute buffer views use homogeneous types. Physical laptop/phone
timing and continuous-motion LOD behavior remain unmeasured. No full engine suite,
dependency audit or unrelated generator was run for this model iteration.

**Geographic activation remains pending.** Whole-site registration, temporal state,
clock-tower attachments, signed orientation, vertical datum, terrain blending and
footprint replacement need in-world review. The inactive draft uses replaceFootprint=false.
Synthetic sparse Swedish-cottage neighbors and flat review ground are not an Oslo shore
or a terrain-fit test. Modern southern/eastern offices and the Armed Forces Museum
complex, harbor, trees, artillery, sculptures and fine fixtures are outside this study.

Original geometry follows the repository license. Castle data retains OpenStreetMap
ODbL attribution; research photographs and the brochure remain external references and
do not ship as textures. Source geometry, controls, references, captures and QA are
indexed in the geographic source folder.

Lock **assets-d81313320b3b2f56** pins **2,452 GLBs**, adding six and preserving all **2,446**
previous entries. This is a scoped checkpoint, not a clean cross-platform full-source
rebuild. Readiness: **292 authored/imported**, 224 current hash pairs, 290 portable
reviews, 222 shared reviews, 216 fidelity reviews and **108 fully ready**. The 68 old
stale local pairs remain untouched. Full library: **394 registered structures / 395
source bundles**. Catalogs, readiness and both galleries are current.

Continue with **N0283 Beaumaris Castle**, following medium-fi. **708** candidates lack
authored models. The project remains active; no Git mutations or uploads were performed.

## 2026-10-08 — Beaumaris Castle, medium-fi

N0283 [Beaumaris Castle](places/gc/gcm/n0283_beaumaris_castle/README.md) is authored,
imported and visually reviewed under [medium-fi](../../../docs-src/guide/medium-fi.md).
The deterministic [recipe](../../../packages/worldgen/scripts/beaumaris-castle-model.mjs)
reconstructs the present-day squat, roofless concentric defenses: six inner towers,
twin-D north/south gatehouses, five shallow north-hall openings, lower outer tower
circuit, offset sea gate, barbican, surviving dock wall and low unfinished foundations.

Cadw's primary ground plan with its 30m scale bar and three official exterior photographs
were inspected. Solid/visible walls are distinguished from dashed lost structures and
unfinished accommodation. Selected factual plan controls are approximate; no diagram
image or copied vector geometry ships in the bundle. The exact-QID cached OSM way maps
the outer castle/dock silhouette, 144.312×106.348m, rather than the inner footprints or
current waterline. The native frame swaps its axes: +X across the ward and +Z toward the
sea dock, provisional heading 0.26314714676 rad at [-4.089706701, 53.26470434]. All vertical
dimensions are estimates: flat Y0 datum, ward Y0.6 and highest northern turret Y17.6.

The source master has **6,071 triangles**, **635,876 bytes**, four merged material groups
and no embedded images. Three existing shared 256² graphs provide limestone, weathered
limestone and wood. Ground, paving and water use vertex colors. Metric repeat UVs,
linear tints and flat normals follow the common style. Sparse broad coping remnants and
true hall/gate openings carry detail. Lost roofs and unbuilt upper stories remain absent;
individual joints, arrow-loop arrays, thin rails, microbevels and complete interiors are
outside this exterior study. The full detailed source is preserved separately.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| skyline | 993 | 81,560 | 1 |
| district | 2,843 | 225,784 | 4 |
| street | 5,255 | 409,244 | 4 |
| closeup | 6,071 | 472,608 | 4 |

Initial skyline plus district geometry is **307,344 bytes**, excluding shared graph
downloads. Skyline retains concentric hierarchy, six inner towers, twin gatehouses and
the dock/moat identity. Four minor outer towers and low unfinished footings disappear
at that level; district restores the full 16-tower outer circuit. Distant round forms
use six sides. Ground Y0 and the highest turret stay stable, with at most 0.027m change
in maximum X across levels. Static detail changes are visible; continuous-motion pop,
shimmer and the actual adaptive streaming path still require separate assessment.

**44 final frames were inspected**: 11 portable, 10 shared-loader and 23 canonical
Earth-rig captures covering three distances, noon/late, Economy/High, untextured
silhouette, six architectural views and four same-camera LODs. Review caught a pool-like
rectangular moat, unstable LOD turret height and incorrect pointed hall-window profiles.
Water now follows narrow northern/western defenses and a dock study surface; the former
eastern moat remains dry. Island sides reach ground Y0. Turret coping no longer increases
the highest extent at detailed levels. Gate-body/hall tops align, and the five hall
arches are shallow and segmental as in the official photograph. Overview cameras were
tightened; all final captures were regenerated after the last change.

Synthetic English terraces over flat ground supply a style comparison, not a real
Beaumaris shoreline. Two architectural context views are partly occluded by neighbors;
the clean shared-loader views show these details. Moat strips and the dock surface are
opaque study colors, not current mapped water polygons or engine water simulation.

All six GLBs pass Khronos validation with zero errors/warnings and no images. Two
targeted LOD tests, strict medium-fi budget audit, recipe lint and byte-identical source
regeneration pass. Shared graphs load once per view, and unloading leaves no live model
geometry. GPU attribute buffer views use homogeneous types. Physical laptop/phone
measurements and continuous-motion LOD behavior remain unmeasured. No repository-wide
suite, dependency audit or unrelated model generator was run for this model iteration.

**Geographic activation remains pending.** Exact inner-plan registration, signed
orientation, current completeness, vertical datum, shore/terrain fit, moat overlap and
footprint replacement need in-world review. The inactive draft uses replaceFootprint=false.
Town/coastline walls, demolished mill, visitor center, trees, modern fixtures and buried
structures are excluded. Original model geometry follows the repository license, with
OSM ODbL attribution retained; Cadw photographs/plan stay external research references.

Lock **assets-6b5217b4beb24ffa** pins **2,458 GLBs**, adding six and preserving all **2,452**
previous entries. This is a scoped checkpoint, not a clean cross-platform full-source
rebuild. Readiness: **293 authored/imported**, 225 current hash pairs, 291 portable
reviews, 223 shared reviews, 217 fidelity reviews and **108 fully ready**. The 68 old
stale local pairs remain untouched. Full library: **395 registered structures / 396
source bundles**. Catalogs, readiness and both galleries are current.

Continue with **N0284 Dover Castle**, following medium-fi. **707** candidates lack
authored models. The project remains active; no Git mutations or uploads were performed.

## 2026-10-08 — Dover Castle, medium-fi

N0284 [Dover Castle](places/u1/u10/n0284_dover_castle/README.md) is authored, imported
and visually reviewed against [medium-fi](../../../docs-src/guide/medium-fi.md).
The deterministic [recipe](../../../packages/worldgen/scripts/dover-castle-model.mjs)
keeps the square Great Tower and stepped forebuilding, layered hill defenses, northern
spur and gate, selected later barracks, cruciform church and octagonal Roman pharos.
It is a current exterior study, with no underground tunnels or lost-building completion.

English Heritage's current aerial and primary architectural descriptions were inspected.
The privately inspected phased diagram stays external: no image or traced vectors ship.
Cached exact-QID OSM way 26658038 maps the whole compound. Its building=yes tag is
treated as terrain extent, rather than a single occupied building. Native axes are +X
east/+Z south at [1.322679734, 51.129258466], heading 0. Original internal controls are
estimates; live OSM and alternate Overpass requests returned 429. Mixed-source DEM
samples at 40m spacing supply a relative authoring hill, with explicitly estimated
flattened keep/ward and church terraces. The boundary datum is 24.6150421994m absolute;
the model reaches 112.5049578006m relative to it. The documented 25.3m keep and surviving
19m pharos heights are above their estimated pads, not surveyed absolute elevations.

The preserved master has **4,590 triangles**, **554,036 bytes**, five merged groups,
four existing shared 256² graphs (limestone, granite, slate, brick) and no images.
Grass, chalk, paving and recesses use vertex colors. Metric-repeat UVs, linear tints,
flat architectural normals and faceted round forms follow the common style. Broad
courses, selected real openings and coping carry close detail; individual joints,
thin railings, microbevels, vehicles, trees, full interiors and buried elements are absent.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| skyline | 954 | 80,508 | 1 |
| district | 2,724 | 212,900 | 6 |
| street | 4,350 | 352,776 | 6 |
| closeup | 4,590 | 371,496 | 6 |

Initial skyline plus district geometry is **293,408 bytes**, excluding shared graph
transfers. Skyline retains the keep/forebuilding, layered defenses and church/pharos.
Eight main inner mural towers survive far; district adds six secondary towers, smaller
outer towers and barracks. Common terrain topology and attachment datums keep Y0 and
the maximum height stable across all four levels. The pharos remains octagonal.

**80 final frames were inspected**: 11 portable, 10 shared-loader, 23 canonical Earth-rig
views and 36 ordered forward/reverse camera samples across resident LOD switches.
The static review covers three distances, noon/late, Economy/High, untextured silhouette,
architectural views and matched-camera LODs. It caught radial terrain ridges, floating
barracks, boundary seams and an overly brick-red lighthouse. A common clipped triangular
grid now supplies the ground and foundations; edge caps share grid intersections. The
pharos is flint with broad brick tile bands. The motion sweep caught far walls sinking
through the hill then reappearing at district. Recursive terrain-profile samples retain
the wall outline; subpixel far wall tops are omitted to keep the skyline budget.

Selected minor details add visibly during upgrades. No whole-model disappearance or
gross base movement appears in the sampled sweep. This preloaded fixture does not test
automatic LOD selection, asynchronous/network upgrades, subframe shimmer or physical
device timing. Synthetic English terraces are a style comparison, not real Dover
surroundings. The hill is an authoring patch with artificial boundary sides, not a chalk
cliff reconstructed around the entire castle.

All six current GLBs pass Khronos validation with zero errors/warnings and no images.
Two targeted LOD tests, strict medium-fi audit, recipe lint and byte-identical source
regeneration pass. Shared graphs load once per view; unloading leaves zero live model
geometries. Attribute buffer views use homogeneous component types. No repository-wide
suite, dependency audit or unrelated generator was run for this model iteration.

**Geographic activation remains pending.** Exact internal plan, signed orientation,
current completeness, vertical datum, host terrain blending and footprint replacement
need in-world review. The inactive draft uses replaceFootprint=false. Original geometry
follows the repository license; OSM ODbL attribution and mixed-source terrain attribution
are retained. Research photographs and copyrighted diagrams remain external references.

Lock **assets-6e03553d1645aa40** pins **2,464 GLBs**, adding six and preserving all **2,458**
previous entries. This is a scoped checkpoint, not a clean cross-platform source rebuild.
Readiness: **294 authored/imported**, 226 current hash pairs, 292 portable reviews,
224 shared reviews, 218 fidelity reviews and **108 fully ready**. The 68 older stale local
pairs remain untouched. Full library: **396 registered structures / 397 source bundles**.
Catalogs, readiness and both galleries are current.

Continue with **N0285 Corvin Castle** under medium-fi. **706** candidates lack authored
models. The project remains active; no Git mutations or uploads were performed.

## 2026-10-08 — Corvin Castle, medium-fi

N0285 [Corvin Castle](places/u8/u80/n0285_corvin_castle/README.md) is authored, imported
and visually reviewed under [medium-fi](../../../docs-src/guide/medium-fi.md).
The deterministic [recipe](../../../packages/worldgen/scripts/corvin-castle-model.mjs)
keeps the steep flared square gate roof, conical patterned tower, four projecting palace
oriels, varied Gothic roofline, open two-level court loggia, timber entrance bridge and
detached Neboisa tower joined by a narrow open arcade.

Five operator photographs and the primary operator tour were inspected. Cached exact-QID
OSM way 1327914056 supplies the 125.819×61.936m exterior envelope and detached gallery,
at [22.888262641, 45.749130243], undirected heading 0.984834753738 rad. Internal controls,
roof heights, rock plinth, bridge direction and 71m bridge length are original estimates.
The exterior outline is evidence, not a filled building. Main court Y9 and valley Y0 are
estimated attachment planes. The operator reports the gate at 22m without a clear height
definition: this study interprets it as body height and adds an estimated 14m roof. The
painted tower's reported 30m is interpreted as body plus roof; Neboisa gallery dimensions
35.5×2.4×15m are documented. Other vertical dimensions and small-tower positions remain
estimated. No photograph, copyrighted diagram image or third-party vector geometry ships.

The preserved source master has **5,936 triangles**, **715,876 bytes**, six merged groups
and no embedded images. Four existing shared 256² graphs provide limestone, terracotta
tile, slate and wood. Rock, paving and recesses also use vertex palettes. Broad cone
patterning uses vertex-colored facets. Metric UVs, linear tints and flat architecture
follow the shared style; rounds use six far and 16 near sides. Selected broad Gothic
openings carry the close detail. No individual joints, microbevels, thin rails, complete
tracery, finials, flags, statues, full interiors or modern fixtures were authored.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| skyline | 862 | 70,712 | 1 |
| district | 1,152 | 99,312 | 6 |
| street | 2,868 | 215,284 | 6 |
| closeup | 5,936 | 486,204 | 6 |

Initial skyline plus district geometry is **170,024 bytes**, excluding shared graph
transfers. The bridge, gallery arches, courtyard and all four oriels remain at skyline.
Common bounds stay [-62.6, 0, -94] to [65.205, 45, 35.19] at every level. Selected court
loggia, window and coping detail arrives near; base and primary roof massing stay fixed.

**80 final frames were inspected**: 11 portable, 10 shared-loader, 23 canonical Earth-rig
views and 36 forward/reverse camera samples through forced resident LODs. Review replaced
overly triangular court/gate arches with faceted two-center profiles and restored the
four oriels far. Context scale changed from 4 to 1.75 so the model and procedural Balkan
konak neighbors can be compared at street, block and skyline distances. Noon/late and
Economy/High, untextured silhouette and matched-camera LOD views were reviewed. Selected
detail adds visibly, without whole-model disappearance or gross base movement in the
sampled sweep. Some close architectural views intentionally crop roof edges. Synthetic
neighbors and flat review ground are a style comparison, not real Hunedoara surroundings.

All six GLBs pass Khronos validation with zero errors/warnings and no images. Two targeted
LOD tests, strict medium-fi budget audit, recipe lint and byte-identical source regeneration
pass. Each graph loads once per view; unloading leaves zero live model geometries. Runtime
attribute buffer views use homogeneous component types. The sweep preloads models and
does not certify automatic LOD selection, asynchronous/network upgrades, subframe shimmer
or physical laptop/phone timing. No full engine CI, dependency audit or unrelated generator
was run for this model iteration.

**Geographic activation remains pending.** Signed facing, exact internal footprints, tower
identification, bridge gradient, valley/court datum, host terrain, current completeness and
footprint replacement need in-world review. The inactive draft uses replaceFootprint=false.
Original geometry follows the repository license; OSM ODbL attribution is retained and
operator research photos remain external references.

Lock **assets-10f261c91242e273** pins **2,470 GLBs**, adding six and preserving all **2,464**
previous entries. This is a scoped checkpoint, not a clean cross-platform source rebuild.
Readiness: **295 authored/imported**, 227 current hash pairs, 293 portable reviews,
225 shared reviews, 219 fidelity reviews and **108 fully ready**. The 68 older stale local
pairs remain untouched. Full library: **397 registered structures / 398 source bundles**.
Catalogs, readiness and both galleries are current.

Continue with **N0286 Kroměříž Castle**, following medium-fi. **705** candidates lack authored
models. The project remains active; no Git mutations or uploads were performed.

## 2026-10-08 — Kroměříž Castle, medium-fi

N0286 [Kroměříž Castle](places/u2/u2u/n0286_kromeriz_castle/README.md) is authored,
imported and visually reviewed under [medium-fi](../../../docs-src/guide/medium-fi.md).
The deterministic [recipe](../../../packages/worldgen/scripts/kromeriz-castle-model.mjs)
retains the mapped open courtyard, quadrangular Baroque palace, cream facade rhythm,
red lower roof pitches and broad green upper panels, garden arcade, and stacked copper
tower with an open lantern. Review fixed omitted windows on short mapped facade edges.

Six operator photographs and primary tower/architectural pages were inspected. Cached
exact-QID OSM relation 33992 supplies the 103.556×93.322 m outer envelope and courtyard
hole at [17.393266452, 49.300303249], undirected heading -0.813010109964 rad. Both wall
rings are retained rather than filling the palace as a solid mass. The operator documents
84 m tower height and 40 m viewing gallery. Palace 32 m eave/40 m upper roof, tower footprint,
roof pitches/plateau, portico and window controls are original estimates. No operator
photograph or third-party diagram/vector geometry ships. OSM attribution is retained.

The preserved master has **12,897 triangles**, **1,551,244 bytes**, six merged groups
and zero embedded images. Four existing shared 256² graphs provide lime plaster,
limestone, ceramic tile and copper. Metric UVs and linear tints carry the real cream/red/
green identity. Flat architecture and faceted roofs follow medium-fi. Tower roof profiles
use 8 sides far and 16 near. Thin rails, joints, microbevels, complete ornament/statues,
clock hands/numerals, full interiors and the neighboring cathedral/Mill Gate are omitted;
the finial is a broad symbolic cap. No unique textures, baked light or AO are used.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| skyline | 879 | 71,584 | 1 |
| district | 1,711 | 146,044 | 6 |
| street | 3,865 | 329,180 | 6 |
| closeup | 12,897 | 1,139,688 | 6 |

Initial skyline plus district geometry is **217,628 bytes**, excluding shared graph
transfers. Ground Y0, gallery Y40 and tower Y84 datums stay fixed. Minor trim expands the
skyline envelope by less than 0.3 m at higher levels. The court, red/green roof planes,
tower bulbs, lantern openings and garden arcade persist far. Sparse window rows arrive
at district, full rhythm/pilasters at street, selected lintels and sills close up.

**80 final frames were inspected**: 11 portable, 10 shared-loader, 23 canonical Earth-rig
views and 36 ordered forward/reverse camera samples through resident forced LODs.
Noon/late, Economy/High, three distances beside synthetic Bohemian-townhouse neighbors,
untextured silhouette and four matched-camera levels were reviewed. The large cream/red/
green palette reads without shadows. Copper’s metal shader has a stronger lighting response
than the flat far surface; roof faceting and detail arrival remain visible level changes.
There was no whole-model disappearance or gross base shift in sampled sweeps. Closest
samples intentionally crop the tower top. Flat ground/synthetic neighbors are a style
comparison, not actual Kroměříž surroundings. Resident forced levels do not certify real
adaptive selection, network loading/upgrades, subframe shimmer or physical-device timing.

All six GLBs pass Khronos validation with zero errors/warnings. Expected unused UV
informational notices reflect external shared graphs. Two targeted deterministic LOD,
triangle/download-budget and GPU-layout tests, strict medium-fi audit, recipe lint and
byte-identical source regeneration passed. Each graph loads once per view; unloading leaves
zero live model geometries. Attribute buffer views use homogeneous component types.
No dependency audit, full engine CI or unrelated generator was run for this model iteration.

**Geographic activation remains pending.** Signed garden/town-facing direction, tower/roof
fit, host terrain/base plane, current completeness and footprint replacement need in-world
review. The draft is inactive and uses replaceFootprint=false. Visual approval does not
claim exact geographic fit.

Lock **assets-c2d6ecfb7fa02088** pins **2,476 GLBs**, adding six and preserving all **2,470**
previous entries. This scoped checkpoint does not prove a clean cross-platform rebuild.
Readiness: **296 authored/imported**, 228 current hash pairs, 294 portable reviews,
226 shared reviews, 220 fidelity reviews and **108 fully ready**. The 68 older stale local
pairs remain untouched. Full library: **398 registered structures / 399 source bundles**.
Catalogs, readiness and both galleries are current.

Continue with **N0287 Elmina Castle** under medium-fi. **704** candidates lack authored
models. The project remains active; no Git mutations or uploads were performed.

## 2026-10-08 — Elmina Castle, medium-fi

N0287 [Elmina Castle](places/eb/ebz/n0287_elmina_castle/README.md) is authored,
imported and visually reviewed under [medium-fi](../../../docs-src/guide/medium-fi.md).
Its deterministic [recipe](../../../packages/worldgen/scripts/elmina-castle-model.mjs)
represents battered white fort walls and projecting bastions, stepped governor blocks
with a red roof and open upper gallery, an open main court with the brick-pilastered
former church, a genuinely open smaller court, and a timber approach bridge.

Four operator, tourism and primary-photographer images were inspected. The operator
documents four storeys and an open court. No exact footprint was resolved; both attempted
map read endpoints returned rate limits. All metric controls, the 134×113 m envelope,
31 m maximum, bastion outline, building arrangement, gallery, bridge and height datums
are original estimates. No mapped geometry, third-party diagram, research photograph
or bitmap texture ships. The reference coordinate is [-1.348211, 5.08274]; heading 0
is an unresolved placeholder. **Geographic activation remains pending**: signed direction,
scale, terrain/base plane and site completeness need verification. The draft stays inactive
with replaceFootprint=false. Appearance acceptance does not certify geographic fit.

The preserved master has **17,627 triangles**, **2,119,224 bytes**, seven merged material
groups and zero embedded images. Five existing shared 256² graphs provide lime plaster,
limestone, ceramic tile, brick and timber. Metric UVs, linear vertex tints, flat architectural
faces and faceted curves carry the identity. Thin balusters, joints, microbevels, weathering
gradients, complete statuary/lettering, interiors and dungeon routes are omitted. Six merged
static cannon forms appear close up. Nearby Fort St. Jago, harbour and cathedral are excluded.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| skyline | 995 | 79,924 | 1 |
| district | 1,435 | 120,596 | 6 |
| street | 4,229 | 299,248 | 6 |
| closeup | 17,627 | 1,201,360 | 7 |

Initial skyline plus district geometry is **200,520 bytes**, excluding shared graph transfers.
All four levels retain Y0 footing, Y4 court, Y10 battery and Y31 roof maximum. Windows arrive
at district, full facade rhythm and selected battery openings at street, and sills, parapet
openings and cannon details near. Review corrected courtyard-camera framing and replaced
the skyline's generic texture mean with measured linear averages of its actual shared graphs.
This reduced color mismatch; texture/shadow response and added details still make switches visible.

**80 final frames were inspected**: 11 portable, 10 shared-loader, 23 canonical Earth-rig
views and 36 ordered approach/retreat samples through resident forced levels. Three distances,
noon/late light, Economy/High, silhouette and matched-camera LODs were reviewed beside synthetic
West African compound neighbors. There was no whole-model disappearance or base shift in the
samples. The closest samples intentionally crop bastion edges. Synthetic neighbors and flat
ground are style context, not actual Elmina geography. Preloaded forced levels do not certify
automatic selection, network loading/upgrades, subframe shimmer or physical-device timing.

All six GLBs pass Khronos validation with zero errors/warnings. Two targeted deterministic LOD,
budget and GPU-layout tests, strict medium-fi audit, recipe lint and byte-identical source
regeneration pass. Shared graphs load once per view; unload leaves zero live model geometries.
Attribute bufferViews use homogeneous component types. No full engine CI, dependency audit or
unrelated generator was run for this model iteration.

Lock **assets-b111ebc8b1294b68** pins **2,482 GLBs**, adding six and preserving all **2,476**
previous entries. This scoped checkpoint does not prove a clean cross-platform rebuild.
Readiness: **297 authored/imported**, 229 current hash pairs, 295 portable reviews,
227 shared reviews, 221 fidelity reviews and **108 fully ready**. The 68 older stale local
pairs remain untouched. Full library: **399 registered structures / 400 source bundles**.
Catalogs, readiness and both galleries are current.

Continue with **N0288 Konopiště Castle** under medium-fi. **703** candidates lack authored
models. The project remains active; no Git mutations or uploads were performed.

## 2026-10-08 — Konopiště Castle, medium-fi

N0288 [Konopiště Castle](places/u2/u2f/n0288_konopiste_castle/README.md) is authored,
imported and visually reviewed under [medium-fi](../../../docs-src/guide/medium-fi.md).
Its deterministic [recipe](../../../packages/worldgen/scripts/konopiste-castle-model.mjs)
represents two genuinely open mapped courtyards, cream quadrangular wings and red roofs,
a dominant round keep with overhanging gallery and cone, smaller square-topped corner rooms
with broad timber crosses, stepped dormers, a glazed-arch stone terrace and open pointed
court loggia. This depicts an original approximation of the current exterior, rather than
the castle's original seven-tower fortress form.

Eight architectural photographs were inspected: four from the National Heritage Institute's
official exterior gallery and four from primary photographers Lukáš Kalista and Sergey
Ashmarin. They remain external research; no photograph, copied mesh or unique texture ships.
Cached exact-Q744016 OSM relation 282741 supplies the full outer wall ring and two courtyard
holes, separately attributed under ODbL-1.0. The mapped envelope is **83.567×50.131 m**.
All heights, roof ridges, tower upper rooms, dormers, terrace/loggia attachments and height
datums are estimates. The contradictory mapped one-level tag is explicitly rejected as
storey/height evidence. North upper-room and courtyard-bay details are less certain than
the photographed southern facade and keep. Estimated attachments extend the model beyond
the mapped wall envelope. The modeled maximum is **49.5 m**, not a documented measurement.

The preserved master has **17,454 triangles**, **2,098,088 bytes**, six merged material
groups and zero embedded images. Four existing shared 256² graphs provide lime plaster,
limestone, ceramic tile and timber. Palette colors are decoded to linear vertex tints;
UV repeats use central metric scales. Flat architectural faces, 12–16-sided near towers
and selective broad details follow the medium-fi standard. Thin balusters, flags/spires,
shutter slats, individual joints, statuary, lettering, weathering gradients, microbevels
and full interiors are omitted. Railings use chunky panels; the courtyard arches are real
voids, while the terrace arches contain opaque blue-grey glass.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| skyline | 677 | 57,420 | 1 |
| district | 1,396 | 120,384 | 6 |
| street | 10,536 | 920,324 | 6 |
| closeup | 17,454 | 1,547,996 | 6 |

Initial skyline plus district geometry is **177,804 bytes**, excluding shared graph transfers.
All levels retain Y0 footing, Y4.8 court, Y22 main eave, Y28 main ridge and Y49.5 keep maximum.
District adds window/dormer rhythm; street adds shutters, terrace glazing, court arches and
corbels; closeup adds broad frames. Skyline tinting uses measured linear averages of the
actual shared graphs. Added details, facets and material/shadow response make switches visible.

Visual review caught roof triangulation that filled the courts; convex enclosing ridge rings
corrected it. A targeted regression check now requires both courtyard centers to remain open
through all four levels. Review also corrected the front-facing terrace glazing. **80 final
frames were inspected**: 11 portable, 10 shared-loader, 23 canonical Earth-rig views and 36
ordered approach/retreat samples through resident forced levels. Three distances, noon/late
light, Economy/High, silhouette and matched-camera LODs were reviewed beside synthetic Bohemian
townhouse neighbors. The castle does not wholly disappear or shift in these samples. Closest
views intentionally crop the keep tip and outer wings. Synthetic neighbors and flat ground
are style context, not real-site evidence. The preloaded fixture does not certify automatic
LOD selection, network upgrades, subframe shimmer or physical-device timing.

All six GLBs pass Khronos validation with zero errors/warnings. Three targeted deterministic
LOD, cap, GPU-layout and courtyard-opening tests, strict medium-fi audit, recipe lint and
byte-identical source regeneration pass. Shared graphs read once per view; unload leaves zero
live model geometries. Attribute bufferViews use homogeneous component types. No full engine
CI, dependency audit or unrelated model generator was run for this iteration.

**Geographic activation remains pending.** Anchor [14.656541475,49.779576024] and undirected
axis -0.117875714253 come from the cached map frame. Signed southern-facade direction,
estimated roof/tower/terrace fit, terrain/base datum and complete site fit need review.
The draft stays inactive with replaceFootprint=false. Appearance acceptance does not certify
geographic fit.

Lock **assets-e6a29a1f01779ff3** pins **2,488 GLBs**, adding six and preserving all **2,482**
previous entries. This scoped checkpoint does not prove a clean cross-platform rebuild.
Readiness: **298 authored/imported**, 230 current hash pairs, 296 portable reviews,
228 shared reviews, 222 fidelity reviews and **108 fully ready**. The 68 older stale local
pairs remain untouched. Full library: **400 registered structures / 401 source bundles**.
Catalogs, readiness and both galleries are current.

Continue with **N0289 Castel Nuovo** under medium-fi. **702** candidates lack authored models.
The project remains active; no Git mutations or uploads were performed. Use a full source
rebuild once at the upcoming 300-authored milestone to check batch reproducibility.

## 2026-10-08 — Castel Nuovo medium-fi checkpoint

**N0289 Castel Nuovo** is source-authored, imported and appearance-reviewed under
[medium-fi](../../../../docs-src/guide/medium-fi.md). Source bundle:
`places/sr/sr6/n0289_castel_nuovo`; deterministic recipe:
`packages/worldgen/scripts/castel-nuovo-model.mjs`.

Seven primary architectural photos were inspected: three operator/ministry images and four
photographer views of the aerial plan, entrance, marine elevation and courtyard. Municipality,
Campania, Ministry of Culture and Italian Institute of Castles references support the architecture.
The cached exact-Q781219 relation15009683 supplies the **120.337×112.652m** footing envelope and
one courtyard. Upper curtains, tower shafts, gate, chapel, hall and approach are original estimates.
**All exterior heights are estimates; maximum40m is not measured.** Mapped ele40 is elevation;
the documented Barons Hall interior26m square/28m high is not an exterior dimensional survey.

Three identity groups survive skyline: five round crenellated towers and battered footings,
pale stacked marble gate with actual openings, and the open court inside tufo curtain wings.
Street adds nine court arcades,31 southern gallery arches,rose-window chapel,raised hall,stair
and rounded glazed marine loggia. Selected corbels,niches and relief bands are broad geometry.
Fine fluting/scales,flags,joints,lettering,microbevels,full sculpture and interiors are omitted.
Four existing256²graphs—basalt,sandstone,marble and timber—are reused; six merged groups near,
one skyline. No photographs,unique textures,baked shadows or AO are embedded.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| skyline | 821 | 67,444 | 1 |
| district | 1,374 | 115,844 | 6 |
| street | 5,946 | 451,092 | 6 |
| closeup | 7,590 | 595,048 | 6 |

Source master **914,372 bytes /7,590 triangles**; initial skyline plus district **183,288 bytes**,
excluding shared graph transfers. Linear palette tints and measured per-graph means keep far
colors consistent. Ground/base and maximum are stable across levels. Far crowns are simpler;
street adds gallery/corbel/window rhythm;closeup adds broad relief and frame detail.

Review found the court backdrop in front of its arcade,then moved it behind. Gate rear-wall
openings and rounded marine glazing were corrected. **80 final frames inspected**:11 portable,
10 shared-loader,23 canonical Earth-rig and36 ordered resident approach/retreat samples.
Economy/High,noon/late light,silhouette,architectural views and matched-camera levels were checked.
Synthetic Italian-palazzo neighbors and flat ground compare style,not real Naples geography.
Details/facets/shadow response make switches visible;closest samples intentionally crop outer
parts. Forced resident samples do not certify adaptive streaming,network upgrades,subframe
shimmer or physical-device timing.

All six GLBs pass Khronos validation with zero errors/warnings. Three targeted deterministic,
budget,GPU-layout and courtyard/gate/arcade-opening tests pass,as do strict medium-fi audit,
recipe lint and byte-identical source regeneration. Each shared graph reads once per view;
unload leaves zero live model geometries. No full engine CI,dependency audit or unrelated model
generator was run in this model-only iteration.

**Geographic activation remains pending.** Cached anchor[14.253249701,40.838300344] and undirected
axis-0.308685078188 do not certify signed western-gate direction,upper attachment fit or terrain
datum. Draft inactive,replaceFootprint=false. Appearance approval does not certify geographic fit.

Lock **assets-d7622424766063c1** pins **2,494 GLBs**,adding six while preserving all **2,488** prior
entries. Readiness: **299 authored/imported**,231 current hash pairs,297 portable reviews,
229 shared reviews,223 fidelity reviews and **108 fully ready**. The68 older stale local pairs
remain untouched. Full library: **401 registered structures /402 source bundles**. Catalogs,
readiness and both galleries are current. This scoped checkpoint does not prove a clean
cross-platform source rebuild.

Continue with **N0290 Warwick Castle** under medium-fi;**701** candidates lack authored models.
The full1000 project remains active. Perform one full source rebuild at the upcoming
300-authored milestone to check batch reproducibility. No Git mutations or uploads performed.

## 2026-10-08 — Warwick Castle medium-fi / 300-authored milestone

**N0290 Warwick Castle** is source-authored, imported and appearance-reviewed under
[medium-fi](../../../../docs-src/guide/medium-fi.md). Source bundle:
`places/gc/gcq/n0290_warwick_castle`; deterministic recipe:
`packages/worldgen/scripts/warwick-castle-model.mjs`.

Seven operator/photographer images were inspected, covering the courtyard, river face,
Caesar's lobes, gatehouse and motte. Three operator/Historic England pages and cached exact
Q941276 relation553839 support the architecture and **158.229×102.573m** mapped envelope.
The operator publishes **Guy29m and Caesar40m local tower heights with different bases**.
Court/GuyY11, lower CaesarY0 and the common maximumY40 are inferred, not a surveyed datum.
Historic England describes Caesar as trilobed; the operator says quatrefoil. Three prominent
lobes are an interpretation of the inspected photographs. Upper form, window/roof rhythm,
motte, approach, retaining bank and attachment dimensions remain estimates.

Three identity groups survive skyline: polygonal Guy and lobed two-stage Caesar towers,
clocked twin-turret gatehouse/barbican, and the open court with castellated river ranges and
stepped motte. Street adds Gothic bays, broad mullions/corbels, clock hands, low slate roofs,
chimneys, western towers and the arched approach. The actual gate/barbican passage remains open.
Fine lattice, flags, joints, full lettering, microbevels and interiors are omitted. River-facing
proxy terrain was changed to sandstone during review; basement terraces/openings remain coarse
and some are obscured by the proxy bank. Mill, weir, river, outer parks and visitor infrastructure
are outside this castle exterior bundle.

Three existing256² graphs—sandstone, slate and timber—are reused. Five merged material groups
near, one skyline. No photographs, unique textures, baked shadows or AO are embedded. Linear
palette tints, metric UVs and measured graph means keep distant colors consistent.

| Level | Triangles | GLB bytes | Material groups |
| --- | ---: | ---: | ---: |
| skyline | 938 | 78,620 | 1 |
| district | 3,884 | 331,768 | 5 |
| street | 7,301 | 622,952 | 5 |
| closeup | 8,649 | 742,064 | 5 |

Source master **1,040,976 bytes /8,649 triangles**; initial skyline plus district **410,388 bytes**,
excluding shared graph transfers. All levels meet1,000/4,000/16,000/64,000 triangle caps and keep
Y0/Y40 bounds. Homogeneous attribute bufferView types avoid mixed-type GPU upload duplication.

**80 final frames inspected**:11 portable,10 shared-loader,23 canonical Earth-rig and36 ordered
resident approach/retreat samples. Economy/High, noon/late light, silhouette, six architectural
views and four matched-camera levels were reviewed. Synthetic English-terrace neighbors at
scale2 and flat ground compare style, not actual Warwick geography. Crowns, facets, windows,
bridge arches and trim make switches visible; closest samples intentionally crop outer parts.
Forced resident samples do not certify adaptive selection, network upgrades, subframe shimmer
or physical-device timing. Each shared graph reads once per view; unload leaves zero live model
geometries. All six GLBs have zero Khronos errors/warnings, no images, and current hashes.
Three targeted deterministic/budget/layout and courtyard/gate/barbican-opening tests, strict
medium-fi audit, recipe lint and byte-identical source regeneration pass.

**Geographic activation remains pending.** Cached anchor[-1.585265184,52.279577946] and
undirected axis0.789464883642 do not certify signed entrance direction, relative tower/base
datum, motte/approach fit or real terrain. Draft inactive, replaceFootprint=false. Appearance
approval does not certify geographic fit.

### Full source rebuild at the batch milestone

`node scripts/build-assets.mjs --jobs=2` passed on this Windows/Node24.18.0 host in **755 seconds**.
All **22 generators**, **77 refreshed imports /370 current imports** and **402 runtime LOD builds**
completed. Every one of **2,500 GLBs exactly matches** lock **assets-ff23588263c306fd**: zero changed,
missing or unexpected files. This proves local reconstruction from source; CI still establishes
the same result on other platforms. The scoped lock added Warwick's six outputs while preserving
all2,494 previous entries. GLBs remain ignored build outputs; no Git mutations or uploads.

The verifying build preserved existing metadata and reported69 differences. Inspection found
**58 stale LOD recipe cache hashes**; these were refreshed from the successful build, with all
other sidecar fields, model bytes and level hashes preserved. **11 existing specifications retain
earlier map-frame hashes**:N0164,N0175,N0183,N0189,N0191,N0193,N0194,N0199,N0205,N0206,N0207.
Their direct recipe facts match; geographic proposal comparisons differ only in mapGeometryHash.
Those evidence discrepancies remain explicit for reviewed reconciliation.

The rebuild repaired the68 older local source/runtime mismatches. **All300 authored pairs now
verify**, while68 older portable approvals reference prior runtime bytes and need renewed review.
Current counts: **300 authored/imported**, 230 portable reviews,
228 shared reviews, 165 fidelity reviews,
232 active geographic previews and **108 fully ready**. Previous higher review counts described
the former local files. No approval was transferred to rebuilt bytes without evidence. Full
library: **402 registered structures /403 source bundles**. Catalogs, readiness and both galleries
are current. No repository-wide engine CI, dependency audit or unrelated documentation build.

Continue with **N0291 Książ Castle and park complex** under medium-fi, retaining the named complex
scope. **700 candidates lack authored models**. The full1,000 project remains active; older
capture/evidence renewal and geographic fit remain required before claiming completion.

## 2026-10-08 — Książ castle core / shared-texture preview

Authored/imported **N0291 Książ Castle and park complex — castle/terrace core only** under
`docs-src/guide/medium-fi.md`. Source: `places/u3/u35/n0291_ksiaz_castle_and_park_complex`;
recipe: `packages/worldgen/scripts/ksiaz-castle-model.mjs`. Exact-Q738109 relation9821066
provides the98.17×61.243m castle ring and two courtyards. Operator47m central tower and the
academic10.5×11.5m original tower plan inform the model. Common datum,courtY13 to towerY60,
other heights,roof/terrace controls and signed placement remain estimates. The original
rock/retaining proxy seats the core atY0;it is not a surveyed landscape.

**The entire named site remains incomplete.** The official2025 designation defines associated
entrance buildings,mausoleum,three park gates,two Swiss houses,Old Książ ruin,five stables,
covered riding hall,carriage house,forge,forester house and the separate Palm House with
greenhouses,boiler/administration/utility/residential buildings and gardens. All required
groups are retained in `site-parts.json`;core appearance approval does not approve full scope.
Continue these components as independently anchored source-specific models,then review their
coverage and actual terrain/placement. Do not silently reduce the candidate to the castle.

The core uses **five existing shared256²graphs**:sandstone,lime plaster,ceramic tile,bronze
and plain timber. Glass/turf are intentionally flat;seven merged near groups and one far draw.
Metric repeat UVs,linear palette tint and actual graph means preserve distant color. No embedded
or unique textures,research photograph pixels,baked shadows or AO. Shared material references
resolve through the world viewer's shared cache;each graph read once across the captured views.
The source README now chooses the shared textured capture via an optional study preview path;
the next-1000 gallery also uses the hash-reviewed shared image. **Use textured runtime views
as primary catalog/appearance evidence for subsequent models**;portable flat captures remain
separate geometry fallback evidence. Reuse the canonical graph even when its pattern is an
approximation;do not fork a texture simply for a model's color.

Final source6535triangles/788236bytes;runtime787588bytes. Source hash
`7d330b7fab85ddfe0acdcb47ec6057f32d51d5784a3365b1833f216c3e3288a3`;
runtime hash`6a9274d7caa424acbdc84d85a3e53fb8d76b6c1b1a94a9f4e2b1994dda50923f`.
Skyline/district/street/closeup: **747/1818/5815/6535 triangles**,
**62828/155980/500300/525212 bytes**;initial skyline+district **218808bytes** excluding shared
graph transfers. Buffers use homogeneous component types to avoid duplicated GPU uploads.
**80 current frames inspected**:11portable,10shared,23Earth and36ordered resident LOD samples.
Review corrected unsupported gallery/walls,western spire prominence,main dome/lantern collar
and outward hall glazing normals. Real devices,automatic LOD selection,network upgrades and
subframe shimmer remain pending. Six Khronos validations:0errors/warnings,no images. Three
targeted LOD/determinism/buffer/court checks,strict medium-fi audit,recipe lint and exact source
regeneration pass. Source/core appearance passed;whole-site fidelity and geographic activation
pending,with inactive draft and replaceFootprint=false.

Lock **assets-9960504e56112263** pins **2506 outputs**,adding only six new validated files while
preserving2500prior entries. GLBs remain ignored outputs. Catalogs/source recipe index refreshed:
**301 authored/imported next-1000 candidates**,231portable reviews,229shared reviews,
165fidelity reviews,232active geographic previews and **108fully ready**. Full library:
403registered structures/404source bundles.699candidates still lack models,and N0291has only
its core. The older68portable review renewals and11map-frame evidence reconciliations recorded
at the300-model milestone remain outstanding. No repository-wide rebuild,audit,engine CI,
Git mutation or upload was performed for this model iteration.

## 2026-10-08 — Książ missing west gable and roof joins

The user reported a missing portion of the displayed castle. The prior west gable was a
single inward-facing triangle placed inside the roof,so it disappeared from the west view.
Replaced it with a supported projecting bay,stepped outward-facing gable and floor/gable
openings. Its mass survives all four runtime levels. The bay and profile are photographic
interpretations,not measured facade dimensions.

The previous independent roof patches also left broad unroofed strips over the body.
Joined the main pitched ranges using convex planar clipping:remove hidden overlaps,clip
to the mapped castle footprint and both court holes,and close clipped eaves to the walls.
Small footprint deviations use a low tiled junction. The first distance-field infill was
visually rejected for overlapping facets. Final shared overhead and elevation images were
inspected after the joined-roof replacement. Preserve the full mapped outline near;skyline
uses fewer ranges,omits tiny eave closures and removes plan deviations below3.5m. Roof
pitches/ridges remain approximate. Float32 rounding before face construction discards
clipping slivers that would collapse in the exported GLB.

Current master **7839 triangles / 944716 bytes**;runtime **944068 bytes**.
Current source hash: `sha256:450e52235e1bb5e3b91f8576aa0afaefc32aa99c67f9257fc439df355244ca0e`;runtime: `sha256:20f1ea4531fa1d3ef91e04cb8bd46ad779544ca13d8b7eefaf7c04130d3e53f4`.
Skyline/district/street/closeup: **993/2914/7119/7839 triangles**,
**92312/278728/649772/674684 bytes**. Initial skyline+district **371040 bytes**,
excluding shared texture/graph transfers. The same five canonical shared materials remain
in use;no unique/embedded images. Six Khronos validations have zero errors/warnings.
Four targeted tests pass,including a new west-facing gable/covered roof-junction regression
and the existing open-court checks across every level. Strict medium-fi audit has no
findings;source regeneration is byte-identical. Recipe/tests formatted. **80 refreshed
frames inspected** and current source/runtime/report hashes bound in `qa.json`.

Only the castle's six lock entries changed;the other2500are preserved. Current pin:
**assets-6985f3487528e5e9**,2506outputs. Source indexes and galleries refreshed. The previous
castle-core entry's byte/triangle counts and pin are historical and superseded by this entry.
**The entire named heritage ensemble remains incomplete:**entrance/forecourt buildings,
park components and separate Palm House still pending in `site-parts.json`. Core appearance
approval does not certify full site scope,real geographic placement or device performance.
This correction adds no new completed candidate. No full rebuild,audit,Git mutation or upload.

## 2026-10-08 — Książ entrance components / partial site

Following the missing-section repair, authored four independently addressable components beside
N0291: KSI_A01 gatehouse, KSI_A02 northern side wing, KSI_A03 southern side wing and KSI_A04
Hotel Zamkowy. Source and runtime folders are under `places/u3/u35/ksiaz_*`; stable asset IDs
are `molen.worldgen.structure.ksiaz_*`. Each has its own attributed OSM way, outline, origin
and signed forecourt axis. No independent Wikidata IDs were invented. The whole castle/park
candidate remains incomplete; Hotel Zamkowy membership in the designated entrance group is
unconfirmed. Parent `site-parts.json` links the three entrance exteriors and the nearby hotel.

Recipes: `packages/worldgen/scripts/ksiaz-entrance-models.mjs` and
`generate-ksiaz-entrances.mjs`, registered as `worldgen-ksiaz-entrances` in asset-build.json.
The normal full source-build import plan discovers all four source manifests, with optimization
disabled. Explicit auxiliary IDs can use the existing targeted import/capture tools; default
next-1000 discovery continues its existing scope. Four dedicated runtime recipes generate
skyline, district, street and closeup levels. Masters remain source outputs; GLBs remain ignored.

Reviewed recognizable gatehouse twin octagonal upper towers/domes and arched library facade,
lower side-wing ranges with dormers/raised end pavilions, and the detached hotel's pitched roof
and front pediment. Corrected duplicate facade panes, panes buried inside the round gatehouse
base, octagonal pane planes, end-pavilion doors, and cropped whole-facade review cameras.
Roofs are joined over each mapped outline. Heights, roof profiles and facade openings remain
photographic interpretations, without interiors or unique detailing of statues/signs.

Existing shared 256² plaster, ceramic tile and sandstone graphs serve all four; the gatehouse
also uses bronze and the other buildings use timber doors. Four shared graphs per model,
five merged near material groups, one skyline group, flat blue-grey glass, metric UVs and linear
palette colors. No embedded/unique images or redistributed research photos. Shared-loader
reports show one read per graph and zero live model geometries after eviction. Catalog source
READMEs use textured shared-loader previews as their main illustration.

| Component | Master triangles / bytes | Skyline / district / street / closeup triangles | Initial bytes |
| --- | --- | --- | --- |
| Gatehouse | 1700 / 207212 | 468 / 576 / 1380 / 1700 | 100888 |
| North side wing | 2317 / 281256 | 239 / 405 / 1807 / 2317 | 68380 |
| South side wing | 2480 / 300816 | 156 / 326 / 1890 / 2480 | 50308 |
| Hotel Zamkowy | 1327 / 162456 | 51 / 113 / 977 / 1327 | 21472 |

Initial bytes are skyline plus district GLBs, excluding shared graph transfers. All runtime
levels meet medium-fi polygon, material and initial-download targets, and use homogeneous
attribute buffers to avoid mixed-type GPU duplication. Twenty-four Khronos validations:
zero errors/warnings and zero images; expected unused-UV informational notices only.
Eight dedicated LOD/geometry/determinism/layout/window-facing tests and three source-discovery
tests passed. Strict targeted medium-fi audit and authoring lint passed. Source generators
--check and import --check match current bytes. Import-plan discovery proves four normal
source-to-runtime registrations. This is targeted reconstruction evidence, not a full-library
source rebuild or physical-device benchmark.

Inspected **152 current frames**: nine portable, eight shared-loader and 21 Earth-rig views per
component. Earth reviews include three distances, two light conditions, Economy/High, silhouette,
four architectural views and four forced levels. Captures and QA are bound to current source,
runtime, graphs and frame hashes. A transient browser buffer-space failure was retried serially;
only successful final captures were accepted. Resident still views do not prove adaptive
streaming, motion, network upgrades or hardware frame rates.

Four **inactive drafts** record own OSM anchors, heading 0.617948990682 and estimated Y0 terrain
contact, with replaceFootprint=false. Coordinate round-trip errors are below 1.1mm; that verifies
the reconstruction, not surveyed source accuracy or real terrain fit. No broad map name matcher
or parent QID is reused for these components. Facade/vertical fit and final whole-site coverage
remain pending. Other N0291 park, stable and Palm House groups still need independent models.

Lock **assets-7ef0f380be67a3b0** pins **2530 outputs**, adding only 24 validated files and preserving
2506 earlier entries. Source/recipe indexes and galleries refreshed: **407 registered structure
models / 408 source bundles**. Next-1000 remains **301 authored/imported candidates**, 231 portable
reviews, 229 shared reviews, 165 fidelity reviews, 232 active previews and **108 fully ready**;
these auxiliary components do not advance complete-candidate counts. 699 candidates still lack
models. The earlier portable-review and map-frame reconciliation debt remains outstanding.
No full engine suite, npm audit, full-library source rebuild, Git mutation or upload was run.

## 2026-10-08 — Książ mausoleum and forge exteriors

Added independently addressable KSI_P01 Hochberg mausoleum and KSI_P02 forge under
places/u3/u35/ksiaz_hochberg_mausoleum and places/u3/u35/ksiaz_forge. Each preserves its own
OSM outline, origin and longest-edge native axis. The mausoleum uses mapped Q30083059;
the forge has no independent QID and does not borrow the parent's identity or a broad name match.
Both remain inactive geographic drafts with replaceFootprint=false. Coordinate reconstruction
errors below 0.7mm verify arithmetic, not surveyed accuracy, facade bearing or terrain fit.

The mausoleum exterior follows the primary 2013 restoration report and a 2019 southeast
photograph: stepped octagonal walls, cream/apricot panels, four oculi, red mansard roof, sandstone
surrounds and roof cross. Entry on the opposite northwest bay is provisional. Crypt, vault,
interior and surveyed heights are not authored. The forge follows its OSM-linked 2014 photograph:
L-shaped rubble walls, brick upper band, two recessed arched timber doors, shallow roof and
chimney. Portal returns seal the wall-to-door recesses. Unseen elevations and current appearance
remain unconfirmed. Parent site-parts.json records these exterior models without approving
the full castle/park ensemble; park gates, stables, Palm House and landscape groups remain pending.

Source-only generator generate-ksiaz-park-structures.mjs and recipe ksiaz-park-models.mjs
are registered in asset-build.json and the authored LOD registry. The normal source-build
import plan discovers both source manifests with optimization disabled. Generators --check
and imports --check reproduce current outputs. No GLBs were committed or uploaded.
Each model uses six existing shared 256² graphs, seven merged near material groups, flat muted
glazing, metric UVs and linear palette tints. Skyline has one group and uses actual baked graph
means. No unique images or redistributed reference photographs/PDFs are included.

| Exterior | Master triangles / bytes | Skyline / district / street / closeup triangles | Initial bytes |
| --- | --- | --- | --- |
| Mausoleum | 1343 / 165288 | 139 / 221 / 1023 / 1343 | 40444 |
| Forge | 554 / 70568 | 92 / 176 / 454 / 554 | 29236 |

Initial bytes are skyline plus district, excluding shared graph transfers. All levels meet
medium-fi caps and retain homogeneous attribute buffers. Twelve Khronos validations have zero
errors/warnings and no embedded images. Four targeted tests passed: deterministic detail/budget
and vertex layout for both models, the concave forge roof and real portal openings. Strict
targeted medium-fi audit and recipe/test lint passed; canonical runtime paths validated.
Inspected 76 current frames: nine portable, eight shared-loader and 21 Earth-rig views per model.
QA binds current source/runtime, spec, material graphs, LODs and inspected image hashes. Each
graph is read once by the shared loader; eviction leaves zero model geometry. Resident still
views do not prove adaptive streaming, network upgrades, motion or physical-device frame rates.

Lock assets-9f50c1331e769e1e adds only twelve validated outputs and preserves all 2530 earlier entries,
for 2542 total. Indexes/galleries now contain 409 registered models / 410 source bundles.
Next-1000 remains 301 authored/imported candidates and 108 fully ready; these separate site
components do not count as newly completed plan candidates. The full N0291 complex is still
incomplete. Prior portable-review and map-frame reconciliation debt remains outstanding.
No full-library rebuild, engine CI, dependency audit, Git mutation or upload was run this batch.

## 2026-10-08 — Książ park gates and remaining site gaps

Added KSI_G01 Jeździecka park gate and KSI_G02 Hochberg avenue gate as separate source bundles
under places/u3/u35. Each uses its own mapped gate node and adjoining path controls, rather
than an invented building footprint or the castle identity. Their original medium-fi geometry
includes a clear passage, open iron leaves, urns and curved wings. The northern gate has tall
railings and a connected crest; the southern gate has low walls and simplified sphinx figures.
Appearance follows source-linked 2014 photographs. Current restoration state, dimensions,
signed facing and terrain fit remain pending; placements are inactive with replaceFootprint=false.

| Gate | Master triangles / bytes | Skyline / district / street / closeup triangles | Initial bytes |
| --- | --- | --- | --- |
| Jeździecka | 4820 / 580380 | 796 / 1516 / 4148 / 4820 | 223132 |
| Hochberg avenue | 4308 / 518944 | 792 / 1404 / 3636 / 4308 | 210316 |

Initial bytes are skyline plus district, excluding shared graph transfers. Both use two existing
shared 256² material graphs, two merged near groups and one skyline group, with metric UVs and
linear palette colors. No unique images or copied research photographs ship in the models.
Twelve Khronos validations have zero errors/warnings; four targeted gate geometry, clear-passage,
determinism, budget and vertex-layout checks passed. Inspected 76 hash-bound frames across the
portable, shared-loader and Earth-rig captures. Shared graphs load once and unload leaves zero
model geometries. The targeted strict medium-fi audit has no findings. Source generator --check
and import --check reproduce both current assets. These still captures do not establish adaptive
streaming performance, physical-device timing or real geographic fit.

Lock assets-30b25a83b4979c5e adds twelve outputs while preserving all 2542 earlier entries,
for 2554 total. Catalogs contain 411 registered models / 412 source bundles; the geographic
gallery has 411 imported entries. Next-1000 remains 301 authored/imported candidates and 108
fully ready. Auxiliary site models do not count as newly completed plan candidates.

The full N0291 ensemble remains incomplete. The third Lion Gate has independent map/photo
research but no model yet. A separately mapped Powder Tower is approximately 119 m from the
castle recipe's approximate tower control. site-parts.json records this unresolved placement;
direct identification and terrace attachment are required before replacing existing geometry.
The castle's current west gable and roof joins are present in saved captures. Four focused N0291
regression checks passed when investigating the user's further missing-section report; no
additional castle geometry was changed without identifying the affected section.

No engine-wide suite, dependency audit, full-library rebuild, Git mutation or upload ran.

## 2026-10-08 — Książ Lion Gate exterior

Added KSI_G03 ksiaz_lion_gate under places/u3/u35 as an independently addressable component
of N0291. Its own Brama Lwów node/2618881852 and three adjoining path controls establish anchor
[16.3176525,50.8512115] and native heading -0.3083258982962207. Dimensions, signed sculpture/
facade facing, current restoration and terrain datum remain provisional. The placement is an
inactive draft with replaceFootprint=false, without a parent QID or broad map-name matcher.

Original medium-fi geometry follows Irena Goderska's 2012 primary photograph: square chamfered
sandstone piers, broad cornices, seated lions with shields, rising curved wing walls and folded
iron leaves. The opening remains clear to the sky at every level. Corrected tangent-block gaps
by sharing mitered wall/coping vertices, seated the sculptures on their plinths, and replaced
masonry joints on the lions with the existing raw-sandstone graph. Corrected an unsupported
carving material slot to supported trim; a focused regression check now covers supported shared
bindings. Heraldic relief, facial likeness, hair strands and current restoration are not claimed.

The master is 3040 triangles / 367248 bytes; runtime master is 366892 bytes. Runtime levels are
448 / 1464 / 3040 / 3040 triangles and 43704 / 151236 / 316376 / 316376 bytes. Initial skyline
plus district download is 194940 bytes, excluding shared graph transfers. Three existing shared
256² graphs serve coursed sandstone, continuous raw sandstone carvings and painted metal,
with three merged near groups and one far group, metric UVs, linear palette tints and actual
baked graph means. No unique images, copied photographs or mixed-type GPU buffer views.

Six Khronos GLB validations have zero errors/warnings. Seven gate tests passed deterministic
levels, budgets, supported shared bindings, clear passages, open sky and two sculpture silhouettes.
Source scene validates and simulates for 30 ticks. Source generator --check reproduces all three
gate masters; import --check verifies the Lion Gate. Strict targeted medium-fi audit and authoring
lint pass. The registered Assets generator and normal import plan include this source bundle.
This is targeted reconstruction evidence, not a full-library source rebuild.

Inspected 38 current hash-bound frames: nine portable, eight shared-loader and 21 Earth-rig
views covering three distances, two light conditions, Economy/High, silhouette, four detail
cameras and four forced levels. Three graphs each load once, and eviction leaves zero live
model geometries. Resident captures do not prove network upgrades, adaptive streaming, motion
or physical-device timing. Geographic and whole-site fidelity remain pending.

Lock assets-fedf2ab30094c2bc adds exactly six outputs while preserving 2554 earlier entries,
for 2560 total. Source/authoring indexes and galleries contain 413 source bundles / 412
registered imported models. All three park-gate exteriors are recorded in site-parts.json;
N0291 remains incomplete, including stable/Palm House/landscape groups and the Powder Tower
placement discrepancy. Next-1000 stays at 301 authored/imported candidates and 108 fully ready.
These site components do not count as separately completed plan candidates. No engine-wide
CI, npm audit, full-library rebuild, Git mutation or upload ran in this batch.

## 2026-10-08 — Książ forester’s house exterior

Added KSI_S01 ksiaz_forester_house under places/u3/u35 as an independently addressable
component of N0291. Own way/262236292 at Jeździecka 9 supplies 17 distinct footprint vertices,
anchor [16.30370172124799,50.84432313943821] and native heading -0.8912217878661122.
All outline vertices reconstruct within 0.6 mm; that proves coordinate arithmetic only.
Facade facing, heights, current appearance and terrain fit remain pending. The placement is
an inactive draft with replaceFootprint=false; no parent QID or broad name matcher is reused.

Original medium-fi geometry follows Gliwi’s 2016 primary photograph and the map-linked 2014
side photograph: steep tiled roof, cream timber-framed main gable, dormer, small entrance
gable, shutters and two chimneys. The first render exposed a dormer window above its roof
and unsupported tall roof notches caused by lower-wall recesses. Corrected both and seated
the dormer into the slope. Ground walls retain the map outline; roof subdivision and unseen
elevations remain photographic interpretations. Research photographs are not redistributed.

Master: 1468 triangles / 179376 bytes. Runtime master: 178892 bytes. Skyline, district, street
and closeup: 204 / 286 / 1148 / 1468 triangles and 17968 / 29076 / 102716 / 129992 bytes.
Initial skyline plus district is 47044 bytes, excluding shared graph transfers. Four existing
256² graphs serve plaster, tile, rubble and timber; flat glazing adds a fifth near group.
One far group uses the baked graph means, with metric UVs and linear palette tints nearby.
No unique images or mixed-type runtime GPU buffer views.

Inspected 38 final hash-bound frames: nine portable, eight shared-loader and 21 Earth-rig
views across three distances, noon/late lighting, Economy/High, silhouette, four architectural
cameras and four forced levels. Each graph loads once; eviction leaves zero live geometry.
This resident review does not measure downloads, adaptive upgrades, motion or actual devices.

Six Khronos validations have zero errors/warnings. Three focused tests pass deterministic
levels, budgets, supported bindings, continuous roof coverage and dormer containment.
Source generator --check reproduces the source bytes; import --check verifies the runtime.
The source scene validates and simulates for 30 ticks; targeted strict medium-fi audit and
authoring lint pass. The registered Assets generator and normal import plan include it.

Lock assets-2307be1e8a345f4b adds exactly six outputs, preserving all 2560 previous entries,
for 2566 total. Catalogs now contain 414 source bundles / 413 registered imported models.
The forester exterior is recorded in site-parts.json; N0291 remains incomplete, including
Swiss houses, stable/Palm House/landscape groups and the Powder Tower placement discrepancy.
Next-1000 remains 301 authored/imported candidates and 108 fully ready; auxiliary site
components do not count as separately completed plan candidates. No repository-wide CI,
npm audit, full-library rebuild, Git mutation or upload ran for this model.

## 2026-10-08 — Książ Swiss Houses I and II

Added KSI_S02 ksiaz_swiss_house_i and KSI_S03 ksiaz_swiss_house_ii under places/u3/u35.
Each retains its own mapped footprint (ways 255269521 and 255269530), address and official
NID identity. Five/four distinct vertices reconstruct within 0.6 mm. This verifies coordinate
arithmetic only: facade direction, estimated dimensions, present condition and terrain fit
remain pending. Both placements are inactive drafts without footprint replacement, parent
QIDs or broad name matching. Separate neighboring annexes/fences are outside these models.

Original medium-fi geometry follows Irena Goderska’s primary 2012 photographs: plaster walls,
blind panels, red mansard hips, curved dormers with real oval openings, cream cornices and
brick chimneys. House II also has its photographed eyebrow rooflight. Corrected entry cornices
that initially poked through straight roof slopes: the actual lower eaves now curve upward
with connected soffits. Research photos are evidence only and are not redistributed.

Masters are 933/977 triangles and 115612/120896 bytes. Runtime masters are 115064/120348 bytes.
House I skyline/district/street/closeup: 189/249/813/933 triangles, 17772/27332/73288/83512 bytes.
House II: 184/261/857/977 triangles, 17348/28344/76508/86732 bytes. Initial downloads are
45104/45692 bytes, excluding shared graphs. Five existing 256² graphs provide plaster, tile,
rubble, brick and timber; flat glazing adds a sixth near group. One far group uses their baked
means. Metric UVs, linear colors, zero embedded images and homogeneous GPU attribute buffers.

Inspected all 76 final hash-bound frames: nine portable, eight shared-loader and 21 Earth-rig
views per house. These cover three distances, noon/late afternoon, Economy/High, silhouette,
architectural views and four forced LODs. Each graph is read once and eviction leaves zero
live geometry. This resident review does not measure adaptive streaming or physical devices.

All 12 Khronos validations report zero errors/warnings. Three focused tests pass deterministic
LODs, budgets, supported material bindings, roof continuity and unobstructed oval windows.
Source --check and import --check verify both current hashes. Both scenes validate and simulate
30 ticks; strict medium-fi audits and scoped authoring lint pass. The normal import plan and
registered Assets generator include both models.

Lock assets-47e3f12d16574f23 adds exactly 12 outputs, preserving all 2566 prior entries, for
2578 total. Catalogs contain 416 source bundles / 415 registered imported models. Both exteriors
are recorded in site-parts.json; N0291 remains incomplete, including stable/Palm House/landscape
groups and the Powder Tower placement discrepancy. Next-1000 remains 301 authored/imported
candidates and 108 fully ready; auxiliary components are not extra completed plan candidates.

## 2026-10-08 — Old Książ surviving-wall exterior

Added KSI_R01 old_ksiaz_ruins under places/u3/u35 as a separate N0291 component. Own ruin
way/239074431 carries Q9386558 and NID A/5214/621. Its envelope is a site boundary, not a solid
building footprint. Geometry follows four individually mapped wall traces: 805533435,
805533436, 805533437 and 898350440. All 36 source coordinate samples reconstruct within
0.6 mm. This proves coordinate arithmetic only; heights, photographic wall associations,
terrace/cliff contact, current condition and unmapped remains still need review.

Original medium-fi masonry follows Pnapora’s 2014 exterior photographs, Piotrus’s 2014 side
photographs and Izabela Marek’s 2012 interior panorama. Broken high walls, three upper pointed
openings, a long pierced wall, an arched limestone portal and open low wall traces remain
roofless. No site-envelope fill, restored roof, historical rooms or research images ship.
Corrected slab-cap/reveal winding, a missing third upper opening and a cropped overhead camera.
The declared review scope is the mapped-wall interpretation, not an exhaustive surveyed ruin.

Master: 2264 triangles / 274080 bytes. Runtime master: 273744 bytes. Skyline/district/street/
closeup: 656/1384/2264/2264 triangles, 45388/89052/140968/140968 bytes. Initial skyline plus
district is 134440 bytes, excluding shared graphs. Three existing 256² graphs provide rubble,
brick and dressed limestone; three near draws and one far draw. Metric UVs, linear palette,
baked far means, zero embedded images and homogeneous GPU attribute buffers.

Inspected all 38 final hash-bound portable, shared-loader and Earth-rig frames. Three distances,
noon/late afternoon, Economy/High, silhouette, architectural views and all four forced levels
preserve the broken-wall/opening identity. Each graph reads once; eviction leaves zero live
geometry. Resident captures do not establish actual terraced terrain fit or adaptive streaming.

Six Khronos validations report zero errors/warnings. Two focused tests pass deterministic
levels, budgets, bindings, homogeneous attributes, true portal/upper-window holes and outward
base caps. Source --check and import --check verify exact current bytes. The scene validates
and simulates 30 ticks; strict medium-fi audit and scoped lint pass. The normal import plan
and registered Assets generator include the source-built model.

Lock assets-7270414e4073035b adds six outputs while preserving all 2578 prior entries, for
2584 total. Catalogs contain 417 source bundles / 416 registered imported models. Placement
ksiaz.old-ruins remains an inactive draft without footprint replacement. N0291 stays incomplete:
stable/Palm House/landscape groups, ruin terrain and unmapped remains, geographic reviews and
the Powder Tower discrepancy remain outstanding. This auxiliary model does not increment
the next-1000 completion count. No full-library rebuild, repository CI, audit or upload ran.

## 2026-10-08 — Książ stable ensemble exterior

KSI_E01, `places/u3/u35/ksiaz_stable_ensemble`, is one source-built exterior asset containing
the five named stable ranges, current carriage house, gate and residence towers, administration,
former canteen and covered riding hall with connecting ranges. The 2005 primary monograph's
numbered plan identifies the ranges; the operator aerial supports the overall roof arrangement.
The old carriage-house range (stable IV) and current carriage house are distinct parts.

The attributed 69-coordinate stable outline and 28-coordinate proposed hall-complex outline
retain the open courtyard and secondary entrance. The main tower has an actual arched passage.
All 97 map coordinates reconstruct within 0.664 mm; this proves arithmetic, not geographic fit.
Part boundaries, upper-storey footprint, heights, roof profiles, facade bays and the common Y0
are interpretations. Hall association, current details and real terrain require review.

Reviewed renders exposed unroofed porch/corner projections, a turret roof that missed its own
ring, omitted residence upper wall planes and facade details partly hidden behind sloping
mapped walls. These were repaired in the durable recipe. Every mapped stable perimeter segment
now has roof coverage at every level; facade detail planes follow the mapped wall slopes.

Master: 9592 triangles / 1155164 bytes; imported master: 1154540 bytes. Skyline/district/street/
closeup: 972/3604/8632/9592 triangles and 81828/300156/742056/830116 bytes. Initial skyline plus
district is 381984 bytes, excluding shared graphs. Six existing 256² plaster, tile, slate,
rubble, timber and limestone graphs are shared; muted glazing adds the seventh near group.
One far group bakes matching means. Metric UVs, linear palette, zero embedded images and
homogeneous GPU attribute buffers are preserved.

Inspected 38 final hash-bound portable, shared-loader and Earth-rig frames, including a closer
gate/carriage view. Each shared graph reads once; eviction leaves zero live geometry. Six
Khronos validations have zero errors/warnings. Three focused tests pass deterministic levels,
budgets, bindings, homogeneous attributes, open quadrangle and entrances, hall roof, and
coverage of all 68 stable perimeter segments. Source/import checks, scoped lint, strict
medium-fi audit, scene validation and a 30-tick simulation pass. Actual terrain, walking/
collision, adaptive streaming and physical device performance remain unreviewed.

Lock `assets-7f3651e893f2df17` adds six outputs, preserves all 2584 prior entries and pins 2590
files. `ksiaz.stable-ensemble` remains an inactive draft with footprint replacement disabled.
The Assets generator and normal import plan reproduce the model from source. N0291 remains
incomplete: Palm House/landscape, geographic reviews, ruin terrain/unmapped remains and the
Powder Tower discrepancy still need work. This connected auxiliary asset does not increment
the next-1000 candidate completion count. No full-library rebuild, repository CI, audit,
upload or Git mutation ran.

### 2026-10-08 — KSI_L01 Lubiechów Palm House connected exterior

Added an independently identified N0291 auxiliary source bundle at
`places/u3/u35/ksiaz_palm_house` and source generator
`packages/worldgen/scripts/generate-ksiaz-palm-house.mjs`. Own OSM relation 3532583
retains the outer ring, both courtyard holes and main entrance; 54 map coordinate
samples round-trip within 0.615 mm. Operator page/gallery and official scope plan
support the 15 m central hall, brick piers, cream cornice, green barrel roof/lantern
and polygonal glazed porch. Connected low glasshouse roof partitions, pane counts,
unseen elevations, other heights and current alteration state are interpretations.

Master: 5,919 triangles / 713,020 bytes; runtime: 712,604 bytes. Skyline/district/street/closeup
use 995/3983/5739/5919 triangles and 76568/342912/495980/512900 bytes. Initial levels
total 419,480 bytes, excluding shared graph transfers. Three existing 256² brick,
lime plaster and painted metal graphs use metric UVs and linear palette tints;
opaque muted glazing adds a fourth material. One far group uses baked surface
means. No embedded/new images or copied photo textures. Attribute buffers are
homogeneous and graphs read once; unload leaves zero live model geometries.

Inspected 38 bound final frames: 9 portable, 8 shared and 21 Earth-rig frames. Closed
greenhouse gable gaps, reduced excessive glazing specular facets and retained
five low roof sheds per side from district onward to remove roof-count popping.
Skyline intentionally simplifies low roofs. Three focused tests pass deterministic
LOD/layout/budgets, two open courts, central hall/porch, closed gables, roof coverage
within 2 mm and inward courtyard walls. Six Khronos validations report zero errors/
warnings. Strict medium-fi audit, source scene validation and a 30-tick simulation pass.

Lock `assets-bb5516502f9eaa6f` adds six outputs and preserves all 2590 prior records,
pinning 2596 files. Normal import plan and Assets source generator are registered.
`ksiaz.palm-house` remains an inactive draft with footprint replacement disabled.
Arithmetic and synthetic-ground appearance do not approve real terrain, measured
dimensions, collision, adaptive streaming or physical-device performance. The
independent greenhouse group, boiler, administration, utility building, residence
and garden/landscape remain pending; N0291 whole-site completion stays incomplete.
This auxiliary asset does not increment next-1000 candidate completion. No full
library rebuild, engine CI, npm audit, upload or Git mutation ran for this batch.

### 2026-10-08 — KSI_L02–L05 Palm House service exteriors

Added administration, utility, residence and boiler/north service range source bundles
under `places/u3/u35/ksiaz_palm_*`, generated by
`packages/worldgen/scripts/generate-ksiaz-palm-services.mjs`. Individual NID records
and the 1994 survey cards identify all four exteriors. The official ensemble plan
places the boiler in the main complex’s north range, distinct from the long utility
building south of administration. Own OSM rings preserve both utility outlines and
the residence’s attached west annex as separate components. Associations, present
restoration, heights and actual terrain contact remain proposed. No parent QID reuse.

| Component | Master triangles | Initial skyline + district bytes |
| --- | ---: | ---: |
| ksiaz_palm_administration | 2587 | 63152 |
| ksiaz_palm_utility | 3693 | 69916 |
| ksiaz_palm_residence | 2245 | 53544 |
| ksiaz_palm_boiler_range | 4137 | 60012 |

All four use five existing 256² plaster, tile, rubble, timber and brick material
graphs, metric UVs, linear palette tints and baked far means. Near models merge
into six materials including muted opaque glazing; far models use one. No new or
embedded images and no redistributed survey scans or photo textures. Corrected a
west porch roof recess, inward utility cross-gable and unsupported chimney slot.

Inspected 152 final hash-bound frames (38 per model), plus two combined Palm House
flat-ground views using the five assets’ relative map anchors and headings. Nine
focused tests pass reproducibility, browser budgets, GPU layout, supported shared
slots, complete mapped roof coverage/ground walls and primary facade visibility.
Twenty-four Khronos validations report zero errors/warnings; strict medium-fi audit
and all four source-scene validations/30-tick simulations pass. Refreshed only the
stale worldgen bundle required by current styles. No full engine CI or npm audit.

Lock `assets-2c05610301313e42` adds 24 outputs and preserves all 2596 prior records,
pinning 2620 files. Normal source import and the Assets generator are registered.
Placements remain inactive drafts, with footprint replacement disabled. Synthetic
composition does not approve actual slopes, vertical datums, current-state fidelity,
collision, adaptive streaming or physical-device performance. Separate greenhouse
groups and landscape remain unmodeled; N0291 whole-site completion remains incomplete.
These auxiliaries do not increment next-1000 candidate completion.

### 2026-10-08 — N0292 Devín Castle draft

Added the reproducible Devín source bundle under
`places/u2/u2s/n0292_devin_castle`, generated by
`packages/worldgen/scripts/devin-castle-model.mjs` through the existing signature
generator and normal source-import workflow. Own east/south map frame preserves
41 surviving masonry features separately from the site envelope. Model includes
roofless upper/middle ruins, lower curtains, Garay/Bathory palace remnants, named
archaeological foundations, exposed faceted cliff and the independent hollow
octagonal Maiden Tower with published2.8m diameter and4.88m height. Primary museum
photos/navigation diagram were researched but are not redistributed as textures
or used as licensed metric traces. Coarse attributed DEM and original cliff
controls are checked-in source; no downloaded mesh or embedded/new image.

Master:4802triangles/579452bytes. Skyline/district/street/closeup:
546/2372/4802/4802triangles, respectively. Initial skyline+district:
286884bytes before shared materials. Four existing256-square material graphs
(dry stone, weathered limestone, brick and gravel), metric UVs, linear palette
tints and baked far means; five near material groups/one far.

Inspected41 hash-bound portable/shared/Earth frames. Corrected cliff overhang,
floating approach walls and steps, and Maiden merlon diameter. Four focused tests
pass deterministic geometry/budgets/GPU layout, roofless court, published tower
shape and actual cliff contact. Six Khronos validations have zero errors/warnings;
strict medium-fi audit and source scene validation/30-tick simulation pass.
676 map samples reconstruct within2mm; this is coordinate arithmetic only.

Lock `assets-4e727d38f027ccf6` adds six outputs and preserves all2620 earlier
records, pinning2626 files. Draft placement uses heading0, explicit geographic
extent and a35.04m native anchor terrain reference. Host terrain blending, actual
cliff/terrace levels, absolute datum, complete surviving gate passages and wall
openings, current-state fidelity, collision and physical-device/streaming review
remain pending. Placement is inactive and footprint replacement disabled. This
is an authored medium-fi draft, not a completed unique landmark/site.

### 2026-10-08 — N0292 Devín missing-section correction

Connected every mapped upper-cliff boundary vertex to the rock cap. The previous
sparse side perimeter made the upper entrance sample coarse DEM about43m below
the courtyard. Eight focused regressions now cover that contact as well as
deterministic LODs/budgets/GPU layout, hollow Maiden dimensions, roofless court,
approach-wall contact, actual aperture clearance, site crop and reveal normals.

New checked-in openings.json controls five exact mapped entrance nodes, six
photo-informed wall apertures and five mapped approach routes. Openings remove
wall geometry and include masonry reveals; dimensions/current door states remain
estimates. Fixed five reversed reveal triangles and replaced duplicated attic
face rows with one full-thickness profile on each mapped wall. Grass terrain is
clipped to the attributed site outline. Primary museum research stays private;
reference URLs/hashes and attributed own map controls are source documents.

Master8494triangles/1022556bytes; runtime1022064bytes. Four LODs:
811/3435/8494/8494triangles. Initial skyline+district422972bytes before the four
shared256-square dry stone, weathered limestone, brick and gravel graphs.
Five near groups/one far; no embedded/new images. Inspected47 hash-bound final
portable/shared/Earth frames. Six Khronos validations report zero errors/warnings;
strict medium-fi audit and source scene validation/30-tick simulation pass.

Lock assets-8757c03c829e4807 replaces exactly six Devín outputs and preserves all2620
other records. Draft extent covers the union of every LOD plus2cm. Heading0 and
the35.04m terrain reference are retained. Real terrain/datum, wall/aperture
dimensions and associations, current-state fidelity, collision, continuous LOD
transition and physical-device review remain pending. Placement stays inactive
with footprint replacement disabled; this revision is not a newly completed site.

### 2026-10-08 — N0293 Rumeli Hisarı draft

Added the reproducible source bundle under
`places/sx/sxk/n0293_rumeli_hisar`, with checked-in map frame, coarse attributed
DEM, shared-material means, references and independent authored LOD recipes in
`packages/worldgen/scripts/rumeli-fortress-model.mjs`. Existing signature
generator and normal source-import workflow recreate every output. Preserved
raw reversed-looking relation roles separately from the interpreted open court.
Three stepped roofless hollow towers retain published heights22/21/28m and
Halil’s twelve-sided lower body. Ten mapped circular bastions, three estimated
square defenses, original forecourt, five actual cut gates, selected slits,
mapped mosque envelope and terrain-following walls/paths are authored.

Master15946triangles/1916772bytes; runtime1916276bytes. Authored levels
987/3841/12231/15946triangles; initial two-level download413004bytes before
shared materials. Four existing256-square dry stone, brick, gravel and ceramic
tile graphs; metric UVs, linear palette and baked far means. No embedded/new
images or third-party mesh; private reference photographs are not distributed.

Inspected47 final portable/shared/Earth frames. Fixed wall footing interpolation,
sea-gate camera height and overlapping forecourt masonry at that passage.
Five model regressions and four source-discovery regressions pass. Six Khronos
validations report zero errors/warnings; strict medium-fi audit, scene validation
and30-tick simulation pass.420 map samples round-trip within0.7mm.
Capture-input hashing now excludes the generated Earth review report; a regression
proves capture-only edits preserve the hash while geometry edits invalidate it.

All six outputs are validated and registered through the existing source generator
and import/LOD workflow. The current asset-bundle pipeline names releases by
source inputs; this targeted authoring pass does not stamp or publish a full bundle.
No output lock is created. Heading0, union-of-all-level extent and23.63m native anchor
terrain reference are recorded. Real host terrain/datum, terrace layout, gate
associations and dimensions, present mosque/restoration state, circulation,
visitor infrastructure, fidelity and physical-device/streaming measurements
remain pending. Placement is an inactive draft with footprint replacement off.
This is an authored draft and does not increment fully completed landmarks.

### 2026-10-08 — N0294 Aljafería draft

Added the original reproducible source bundle under
`places/ez/ezr/n0294_aljaferia`, with own attributed map-frame/courtyard/entrance
and bridge controls, private-reference URLs/hashes, shared-material means, and
`packages/worldgen/scripts/aljaferia-palace-model.mjs`. The existing signature
generator, normal source import and four authored LOD recipes rebuild all outputs.
Six round east towers,26m rectangular Trovador, three open roof courts, selected
lobed Taifa arcades and backing doors, formal beds/pools, gallery/chapel facade,
tiled historic wings and flat stepped parliament hall remain distinct.

Master18094triangles/2175792bytes; runtime2175092bytes. Browser levels
993/3730/14636/18094triangles, initial skyline+district436988bytes before
shared material transfers, near closeup1709660bytes. Six existing256-square
limestone, lime plaster, brick, ceramic tile, wood and gravel graphs; metric UVs,
linear palette and measured far means. Eight merged material groups near and
one far. No embedded/new textures, research-photo textures or downloaded mesh.

Inspected47 final portable/shared/Earth frames. Corrected court-wall obstruction
of parliament/chapel facades, added actual portico backing apertures/recesses,
and filled/aligned the missing upper wall below the south reception wing.
Seven focused model regressions pass; six Khronos validations have zero errors
and warnings. Strict medium-fi audit, targeted source generator --check, scene
validation and30-tick simulation pass.108 map samples reconstruct within0.63mm.
Shared loader reads each graph once and unloading leaves no live geometries.

Published16.5×12m Trovador plan differs from the current mapped18.317m north
edge; the recipe retains map span,12m published depth and26m published height,
and records the unresolved difference. Other component heights, aperture/door
positions, roof partitions and moat are photographic estimates. Heading0 and
all-level bounds are recorded. Moat drops4.5m below palace attachmentY0; actual
host terrain cutout/datum, ground/bridge fit, current restoration state, detailed
ornament/interiors/circulation and fidelity remain pending. Physical-device
performance and continuous streaming/upgrades also remain unmeasured.
Placement stays an inactive draft, footprint replacement off. This increases
authored drafts, not fully completed landmarks. Current source-input-based
asset workflow owns full-bundle stamping/publishing; no output lock or release
is created during this targeted model pass.

### 2026-10-08 — N0295 Pembroke Castle draft

Original source bundle: `places/gc/gch/n0295_pembroke_castle`, with separately
attributed map point/components and oblique entrance route, published keep and
Wogan dimensions, original editable geometry controls, raw Terrarium reference
grid and existing shared-material means.
`packages/worldgen/scripts/pembroke-castle-model.mjs` joins the existing
signature generator, source import and four authored browser recipes.

Circular25m keep with recessed dome, offset gatehouse and physical oblique
passage, low curved barbican, hollow towers and irregular open ward, roofless
Great/Norman/western halls, low ruined inner-gate footings, StAnne projection,
original schematic visitor map and simplified cliff/Wogan masonry render.
Removed the duplicate western-hall solid and aligned the cave front to close
unsupported gaps. Local aperture-plane rejection avoids splitting unrelated
triangles.

Master14971triangles/1800592bytes; imported runtime1799956bytes. Four
levels770/3947/13485/14971triangles,429856bytes for initial skyline+district
before shared materials,closeup1306280bytes. Five existing256-square rubble,
raw limestone,gravel,wood andslate graphs; central metric repeats,linear vertex
tints and measured far means. Seven merged groups near,one far,no embedded
images,new textures,photo textures,downloaded model or copied map artwork.

Inspected47 final portable/shared/Earth frames. Six targeted model regressions
pass; six Khronos validations have zero errors/warnings; strict medium-fi,
scoped LOD/source checks,scene validation and30tick simulation pass.429 map
samples reconstruct within0.67mm. Shared materials read once and unload leaves
zero live model geometries. Rebuilds come from registered source. No full bundle
stamp,lock,release upload or repository-wide verification in this model pass.

Exact identity is a map node. Nearby named wall/tower traces are separately
associated; some east/StAnne traces explicitly warn about accuracy. Published
keep25×16m and cave23×18×5m/floor9–10mOD guide the source. Coarse DEM peaks
near13.77m and does not resolve that cave section; original datum2.5m/plateau
Y15 are provisional. Preserve this discrepancy. Other heights,wall thickness,
room/aperture partitions,restored turrets,barbican and cliff form are estimates.
Real vertical datum,host terrain blend/cutout,approaches,current restoration
state,full interior/circulation/collision and site fidelity need review. Physical
laptop/phone timing and continuous streaming/upgrades remain pending. Placement
stays inactive with footprint replacement off; this adds an authored draft,not
a fully completed landmark.

### 2026-10-08 — N0296 Kalmar Castle draft

Source bundle: `places/u6/u65/n0296_kalmar_castle`. Exact-QID relation,
separately attributed map components, original editable controls, owner/operator
references and shared-material means drive `kalmar-castle-model.mjs`, registered
through the signature generator, source import and four authored browser levels.

Four dark gabled wings surround an open irregular courtyard. Three round and one
dodecagonal corner tower carry distinct copper helmets. Western Kuretornet has
an open lantern and physical old entrance. Selected white Renaissance gables,
original well canopy, outer defenses, four cannon towers, curved fort passage
and timber bridge are represented. Corrected inward roof-cap undersides that
vanished through backface culling; complete western-wall gate envelope, union
of curved passage apertures and bounded cannon-tower windows are verified.

Master 9673 triangles / 1165336 bytes; imported runtime 1164636 bytes. Skyline,
district, street and closeup: 1000/3237/7140/9673 triangles. Initial skyline plus
district 388464 bytes before shared materials; closeup 877640 bytes. Six existing
256-square rubble, raw limestone, lime plaster, copper, standing-seam metal and
gravel graphs use linear tints and central metric UV repeats. Source and runtime
roof bindings agree via per-study overrides. Bridge timber uses brown-tinted
gravel as a material approximation. Eight merged groups near, one far; flat
glass/grass, no embedded or new images, photo textures or downloaded model.

Inspected 47 final portable/shared/Earth images. Seven focused regressions pass,
including the roof-underside check that failed before the winding fix. Six Khronos
validations have zero errors/warnings. Strict medium-fi, scoped LOD and source
checks pass; scene validation and 30-tick simulation passed. 341 map samples
reconstruct within 0.695mm. Shared graphs read once; eviction leaves zero live
model geometry. Reproducible source is registered; no whole-bundle release stamp
or upload in this model pass.

No primary numeric vertical dimensions verified. Heights, platform Y4.2, roof
profiles, Renaissance gables, well, apertures and bank/defense section are original
photographic estimates. Coast defenses descend to Y0.3. Current 2013–14 kitchen
extension is acknowledged but its verified footprint remains unresolved. Real
terrain/moat/coast/vertical registration, bridge access and current site fidelity
need review. Full interiors, sculpture, inscriptions, exhibits and walkable
circulation/collision are incomplete. Physical laptop/phone timing and continuous
streaming/upgrades remain pending. Placement stays inactive with footprint
replacement off; this is an authored exterior draft, not a completed landmark.

### 2026-10-08 — N0296 mapped palace roof coverage repair

The owner reported a missing building section. Inspection found the four-corner
roof envelope stopped inside the mapped eastern and northern palace walls,
exposing broad flat wall caps. Editable outer/inner eave polylines now follow
those physical walls and the courtyard. Roof panels span the full wing width;
the concealed flat wall caps are omitted. The regression failed on the old
model and passes at all four levels.

Only Kalmar was rebuilt/imported. Master 9633 triangles / 1160536 bytes;
runtime 1159836 bytes; levels 990/3197/7100/9633 triangles.
Initial skyline plus district 389208 bytes. Inspected all 47
regenerated portable/shared/Earth frames. Eight targeted tests and six Khronos
validations pass; six existing shared graphs, no embedded or new textures.
Current-site fidelity and geographic/terrain review remain pending; placement
remains an inactive draft.

### 2026-10-08 — N0297 Nuremberg Castle draft

Source bundle: `places/u0/u0z/n0297_nuremberg_castle`. Exact-QID node,
separately attributed building/tower/fortification traces, primary operator
plans/photos and city guide drive `nuremberg-castle-model.mjs`. Registered
source import and four authored browser levels reproduce the GLBs.

Three historic precincts preserve Sinwell's projecting observation floor and
Renaissance helm, open imperial court/Palas/Kemenate/double chapel/Heidenturm,
half-timbered bailey and well house, three physical gates, Pentagonal Tower,
steep five-row stables dormers and Luginsland corner oriels. Mapped bastions
and original schematic gardens remain distinct. Closed missing hip-edge wall
sections, omitted dormers crossing clipped roof edges, seated Sinwell on the
bailey and added provisional support beneath the eastern plinths.

Master 8152 triangles / 982804 bytes; runtime 982104 bytes.
Levels 985/3279/5293/8152 triangles; initial skyline plus district 403936 bytes;
closeup 767580 bytes. Six existing 256-square sandstone/raw sandstone,
lime plaster, wood, tile and gravel graphs; linear tints, metric UV repeats,
flat glass/grass, eight near material groups and one far. No embedded/new
textures, photo textures or downloaded model. Graphs read once; eviction
leaves no live model geometry.

Inspected 47 final portable/shared/Earth images. Eight focused checks, six
Khronos validations with no errors/warnings, strict medium-fi/scoped LOD/source
checks and scene validation/30-tick simulation pass. 416 mapped samples
reconstruct within 0.691mm. Documented Sinwell height remains 41m from plinth
to weather vane. All other heights/roof partitions and current terrain section
remain estimated; raw OSM heights are not surveyed primary dimensions. Native
datum 320.29m, attachment Y17.2, rock terraces and eastern foundations are
provisional. Real terrain/approach/vertical registration and current-site
fidelity need review. Placement remains inactive with footprint replacement
off. This is an authored exterior draft, not a completed landmark.

### 2026-10-08 — N0298 Egeskov Castle draft

Source: `places/u1/u1z/n0298_egeskov_castle`, deterministic
`egeskov-castle-model.mjs`, attributed exact-QID main footprint and
separate current gate/annex/passages/east footbridge traces. Primary operator
architecture and heritage-research photos guide original exterior geometry.
Twin longhouses, four stepped gables, two copper spires, square clock/stair
tower and current low gate wing with dormers survive through four levels.
The historic gatehouse tower removed in the1920s is excluded.

Master 15218 triangles / 1830356 bytes;
levels 987/3458/14778/15218 triangles; initial 442276 bytes,
closeup 1535032 bytes. Six existing256-square shared graphs,linear
tints,metric UVs,seven near groups,one far. Graphs read once; eviction
leaves no live geometry. No embedded/new texture or downloaded model.

Inspected47 final portable/shared/Earth images. Eight focused checks and
six Khronos validations with no errors/warnings pass; source/strict medium-fi/
LOD checks and scene validation/30-tick simulation pass. Corrected missing
stair-roof corner,inward facade panes/reflected gate-roof winding,flat dormer
feet and inward clipped rear gate-wall triangles. The winding regression
failed before repair. 186 map samples reconstruct within0.692mm.

All vertical sections/apertures/bridge details are original estimates; no
primary surveyed height found. Water attachmentY0.3 and lake/shore/terrain
fit remain provisional. Current exterior fidelity/geographic review pending;
placement inactive and footprint replacement off. This is an authored draft,
not a completed landmark.

### 2026-10-08 — N0299 Wawel Castle draft

Source: `places/u2/u2y/n0299_wawel_castle`, deterministic
`wawel-castle-model.mjs`, exact-QID palace relation2270819, courtyard
way117749419 and separately attributed roofs,towers and two entry routes.
Current museum/city references guide three residential wings,southern
curtain,open Renaissance courtyard,two lower arcade tiers,tall upper
columns,steep red roofs,two northern copper helms,eastern projections
and adjacent brick Senator tower. Cathedral/detached hill towers are
separate objects,not absorbed into this palace asset.

Master 23061 triangles / 2771512 bytes;
levels 984/3935/14551/23061 triangles; initial 462372 bytes,
closeup 1906700 bytes. Six existing256-square shared graphs,linear
tints,metric repeats,seven near groups,one far. Graphs read once; unload
leaves no live geometry. No embedded/new image or downloaded model.

Inspected44 final portable/shared/Earth images. Seven focused checks
and six Khronos validations without errors/warnings pass; source/strict
medium-fi/LOD checks and scene validation/30-tick simulation pass.
Fixed incomplete roof control,duplicate exterior walls,inward helm/dormer
normals,generic Senator cone,floating lower masonry,passage base-height
API and a gallery column blocking the Berrecci route. Passage regression
failed before repair. 424 map samples reconstruct within0.651mm.

All authored vertical sections,roof partitions,bay counts,apertures and
helm profiles are original photographic estimates; Senator39m is only
an OSMtag,no primary surveyed palace height verified. Court attachment
Y8.2 and actual hill/floor/terrace/entry slope remain provisional. Fine
frescoes/heraldry/sculpture,interior rooms and walkable collision excluded.
Full exterior fidelity/geographic review pending; placement inactive and
footprint replacement off. This is an authored draft,not a completed
landmark.

### 2026-10-08 — N0298 Egeskov entrance correction

Passed each passage's source-defined floor height separately from detail
level to the aperture helper; the old call incorrectly used detail1/2/3
as metres. Near wall openings now remain clear at floor+0.1m,including
closeup. The separate estimated0.28m castle threshold is preserved.
Rejected complete gate windows/trim intersecting the arch after an
inspected close-up exposed glazing crossing the opening. Both regression
checks fail before repair and pass afterward. Rebuilt source/runtime/four
levels and inspected all47 refreshed portable/shared/Earth frames.

Master 15116 triangles / 1818116 bytes;
levels 991/3038/14644/15116 triangles; initial 397188 bytes,
closeup 1523944 bytes before shared graphs. Nine focused checks
and six Khronos validations without errors/warnings pass. Current hashes
and source inventory refreshed. Geographic/current-site fidelity remain
pending; existing inactive placement preserved.

### 2026-10-08 — N0300 Saint Michael's Castle draft

Source: `places/ud/udt/n0300_saint_michael_s_castle`, original deterministic
`saint-michaels-castle-model.mjs`. Exact-QID castle relation238571,
three separately attributed courtyard rings and mapped south passage.
Museum descriptions/photos and original courtyard,west and aerial
photographers guide the rounded salmon exterior,green roofs,church
dome/gold spire,river dome/lantern,south pediment/obelisks and north
colonnade/balcony/stair. All three courts remain open to the sky;
south passage is physically open in district/street/closeup.

Master 17128 triangles / 2059596 bytes;
levels 605/1825/12653/17128 triangles. Initial skyline+district
243720 bytes before shared surfaces;closeup 1555704 bytes.
Six existing256-square shared graphs,linear tints,metric repeats,
seven near groups and one far. Graphs read once;unload leaves
zero live geometry. No embedded/new image or downloaded model.

Inspected44 final portable/shared/Earth views. Refined roof tessellation,
curved apse windows,upper pavilion court windows and pediment moldings/
inset. Darker green roofs follow medium-fi;skyline retains obelisks and
coarse north stair. Six focused checks and six Khronos validations
without errors/warnings pass;scoped source/import/LOD/strict-medium-fi
checks and scene validation/30-tick simulation pass.139 map samples
reconstruct within0.640mm;union bounds cover all levels.

All vertical sections,domes/lantern/spire,roof profiles,window/column
counts,obelisks,stairs and floor contacts are original estimates. No
primary surveyed vertical dimensions verified. Older primary photos
supplement current museum views;current-site alterations need review.
Fine sculpture/heraldry/inscriptions/niches,interiors,detached pavilions,
monuments,bridges,water/embankments/gardens and walkable collision
are excluded or separate objects. Real-site fit/full fidelity pending;
placement inactive and footprint replacement off. Authored draft,
not a completed landmark.

### 2026-10-08 — N0301 Hochosterwitz Castle draft

Source: `places/u2/u26/n0301_hochosterwitz_castle`, original deterministic
`hochosterwitz-castle-model.mjs`. Exact-QID summit castle122050909,
14 separately named mapped gates/passages,church/chapel,45defensive
wall polygons,18secondary footprints and attributed approach routes.
Operator photos/descriptions guide the U-shaped summit/open court,
slate roofs/turret cones,square tower/gallery and ascending gates.

Master 16490 triangles / 1982548 bytes;
levels 986/3757/14954/16490 triangles. Initial skyline+district
464788 bytes before shared textures;closeup 1618888 bytes.
Five existing256-square graphs,linear tints,metric repeats,six near
groups and one far. Graphs read once;unload leaves zero live geometry.
No embedded/new texture image,operator photo or downloaded mesh.

Inspected44 final portable/shared/Earth frames. Repaired bent-passage
reveal unions,Float32 degenerate faces/winding and principal windows
buried behind the mapped facade. Six focused tests and six Khronos
validations without errors/warnings pass;scoped source/import checks
and scene validation/30-tick simulation pass.1079 source map samples
reconstruct within0.672mm;all-level padded bounds cover the draft.

A separate source49x49 numerical hill fixture retains2401 coarse
Terrarium samples within1.222mm after PNG decode. The runtime model
contains architecture only. Earth-rig review now loads this separate
hill,centers cameras vertically and keeps synthetic neighbors outside
the tile. Capture caches also bind source/runtime hashes directly.

The hill is coarse research data,not a surveyed/certified terrain fit.
Some wall/gate contacts still float or embed;terraces/stairs/routes need
site fitting. Architectural heights,roof/turret/spire sections,apertures
and bay counts remain original estimates. Fine heraldry/reliefs,inscriptions,
frescos,interiors,railway mechanics,gardens/vegetation and walkable collision
are excluded or separate. Full medium-fi,geographic and exterior-fidelity
reviews pending;draft placement inactive,footprint replacement off.
This is an authored draft,not a completed landmark.

### 2026-10-09 — N0302 Liechtenstein Castle draft

Source: `places/u2/u2e/n0302_liechtenstein_castle`,original deterministic
`liechtenstein-castle-model.mjs`,exact-QID Austrian castle and separately
mapped east tower/gatehouse/curtain wall/services/access traces. Primary operator
photos/Oliver Bolch guide the west keep/corbel gallery/round oriel,continuous
red palas roof/south cross-gable/five open upper arches,grey east-tower roof,
south turret and arched lower gate. Nearby Schloss Q1726817 and vanished
historic forecourt buildings are excluded. Natural exposed ridge is terrain.

Master 5371 triangles/648248 bytes;
four levels 667/2124/5357/5371 triangles;initial 278024 bytes,
closeup 553316 bytes. Five existing shared256-square graphs,linear
tints,metric repeats,six near groups,one far. No embedded/new image or downloaded mesh.

Inspected44 final portable/shared/Earth images. Nine focused checks and six
Khronos validations with zero errors/warnings pass;targeted source/import/LOD/
strict medium-fi checks and scene validation/30-tick simulation pass.117 map
points reconstruct within0.642mm. Corrected tower-roof footprint and main-roof
continuity. Explicit isolated preview groundY-8.3 exposes lower gate/walls
that the defaultY0 stage plane hid;default/geographic review paths unchanged.

All vertical sections and terrace contacts are estimates;no primary surveyed
height verified. Rocky ridge,terrace/stair grades and facade/geographic fit
require actual-site review. Medium-fi/geographic/fidelity status pending;
placement inactive,replacement off. Authored draft,not a completed landmark.

### 2026-10-09 — N0303 Arundel Castle draft

Source: `places/gc/gcp/n0303_arundel_castle`, original deterministic
`arundel-castle-model.mjs`. Exact-QID relation1118816, both mapped voids,
separate keep and service route retain attributed original controls. Operator
exteriors and VisitEngland aerial guide the hollow shell keep/motte, northern
defenses, open residential quadrangle, Gothic windows, corbelled towers, slate
roofs and original estimated courtyard lawn/gravel/fountain.

Master 15379 triangles/1850024 bytes;
four levels 973/3603/14869/15379 triangles. Initial
skyline+district 407240 bytes; closeup 1378452 bytes before shared
textures. Six existing256-square graphs, linear tints, metric repeats, eight
near groups and one far group. No embedded/new image or downloaded mesh.

Inspected44 final portable/shared/Earth images. Seven focused tests and all
six Khronos validations pass with zero errors/warnings. Scoped source/import/
LOD/strict medium-fi and scene validation/30-tick simulation pass.322 original
map samples reconstruct within0.679mm. Fixed the bent tunnel cut and overlapping
reveals, tiny Float32 slivers and duplicated invisible roof/parapet geometry.
Shared graphs read once and unload leaves zero live model geometry.

Published approximate motte/keep dimensions are preserved alongside the larger
current mapped keep/annex footprint. Other vertical/roof/facade controls remain
estimates. Detached chapel, cathedral, lodge, natural escarpment, gardens,
interiors, fine carving and collision certification are excluded or separate.
The synthetic neighbor fixture is not actual estate geography. Natural terrain,
bailey datum, facade fit and exterior fidelity require actual-site review.
Medium-fi/geographic/fidelity pending; placement inactive, replacement off.
Authored draft, not a completed landmark.

### 2026-10-09 — N0304 Leeds Castle draft

Source: `places/u1/u10/n0304_leeds_castle`, original deterministic
`leeds-castle-model.mjs`. Exact-QID relation6941053, current component footprints,
Gloriette courtyard, island, curtain and entrance routes preserve attributed
original controls. Operator exterior/aerial photographs and Historic England
facts guide New Castle/octagonal towers, hollow Gloriette/bell tower, covered
bridge/two water arches, Maidens Tower/bath arches, southwest gatehouse,
low curtain and entrance bridge. No primary numeric architectural heights verified.

Master 11749 triangles/1413956 bytes;
four levels 850/2899/11719/11749 triangles. Initial
skyline+district 338888 bytes; closeup 1061532 bytes before shared
textures. Five existing256-square graphs, linear tints, metric repeats, seven
near groups and one far group. No embedded/new image or downloaded mesh.

Inspected44 final portable/shared/Earth images. Nine focused tests and all six
Khronos validations pass with zero errors/warnings. Scoped source/import/LOD/
strict medium-fi checks and30-tick scene capture pass.292 map samples reconstruct
within0.682mm. Removed the water-level slab under the arches and a diagonal
foundation wall across the channel, moved an unsupported Gloriette chimney
onto its roof and fixed its vertical contact, and joined the oval drive surface.
Expanded roof coverage checks to all four main building footprints. Shared graphs
read once and unload leaves zero live model geometry.

Vertical sections, openings and water/bailey attachment remain original estimates.
Detached Fairfax Courtyard/service buildings, parkland, moat/natural terrain,
vegetation, interiors and full outer barbican archaeology excluded or separate.
Synthetic regional houses and flat review ground are a style fixture. Actual
lake/shore datum, terrain, facade fit, exterior fidelity and physical device
performance remain pending. Medium-fi/geographic/fidelity pending; placement
inactive, replacement off. Authored draft, not a completed landmark.

### 2026-10-09 — N0305 Turku Castle draft

Source: `places/u6/u6x/n0305_turku_castle`, original deterministic
`turku-castle-model.mjs`. Exact-QID castle way466736288, two separately mapped
sections,17 building parts, three courtyard surfaces and mapped passage routes
preserve attributed original controls. Museum tower totals38/32m agree with OSM.
Museum courtyard photographs, VisitTurku aerial and2023 city aerial guide copper
main wings, exposed stone/plaster, elevated timber/gallery glass, white bailey,
grey roofs, southeast round tower, annexes and three actual arched passages.

Master 6844 triangles/825888 bytes;
four levels 875/1656/6844/6844 triangles. Initial
skyline+district 246316 bytes; closeup 733104 bytes before shared
textures. Seven existing256-square graphs, linear tints, metric repeats,
eight near groups and one far group. No embedded/new image or downloaded mesh.

Inspected44 portable/shared/Earth images. Seven focused geometry tests and six
Khronos validations pass with zero errors/warnings. Scoped source/import/LOD/
strict medium-fi checks and30-tick scene capture pass.514 mapped samples round
trip within0.666mm. Corrected skipped gallery glazing, two inverted plaster
patches beneath low annexes, accumulated skyline simplification and round tower
centering. Roof checks cover all17 parts; three routes, three courts and gallery
clearance survive. Shared graphs read once; unload leaves zero live geometry.

Other mapped heights include photographic estimates; original pitches, window/
aperture sections, plaster patches, common courtyard datum and rocky west
approach remain unverified. Nearby cottages/warehouses, park, natural rock,
port development, vegetation, interiors, ramps and fine heraldry are excluded
or separate. Synthetic northern houses are a style fixture. Actual site fit,
continuous LOD switches and physical device performance pending. Medium-fi/
geographic/fidelity pending; placement inactive, replacement off. Authored draft,
not a completed landmark.

### 2026-10-09 — N0306 Gediminas' Tower exterior

Source: `places/u9/u99/n0306_gediminas_tower`; original deterministic
`gediminas-tower-model.mjs`. Exact tower way24569542 and two actual upper
parts90844046/90844047 preserve octagons and6/12m floor setbacks. Broader
same-QID Upper Castle node325130082 excluded. Current three-storey tower,
stone cladding, arched windows, courtyard door, open parapet terrace, glazed
roof access and tricolor use official museum/tourism references. Historic
fourth floor/telegraph house, palace/curtain ruins and hill remain separate.

Master2492 triangles/303052bytes. Four levels510/1520/2468/2492;
initial199064bytes; closeup256304bytes before five existing256-square
shared graphs. Seven near groups/one skyline group; no embedded/new image.

Inspected45 final portable/shared/Earth images. Seven focused tests and six
Khronos validations pass, all0errors/warnings; scoped source/import/LOD/strict
medium-fi audit passes. Fixed ground-penetrating door trim and cleared two
detail cameras of synthetic neighbors. Open terrace,24 recessed apertures,
eight parapet gaps and three original octagons survive the runtime levels.

North-up footprint and actual semantic placement/terrain-reference path
reviewed;27 WGS84 controls round trip within0.573mm. Only local asset loads,
all five graphs read once and eviction leaves zero live model geometry.
Horizontal placement/orientation, exterior and medium-fi approved with explicit
mapper/photo estimates. Flat geographic fixture does not certify the rocky
hill micrograde; local grading, interior access and physical-device timings
remain unverified. This is an exterior visualization, not a measured survey.

### 2026-10-09 — N0307 Ljubljana Castle exterior draft

Source: `places/u2/u24/n0307_ljubljana_castle`, original deterministic
`ljubljana-castle-model.mjs`. Exact-QID castle way5821190, relation2326426,
courtyard hole174281987, fifteen mapped building parts and east passage/bridge
retain attributed original controls. Current operator photographs and component
descriptions guide the white clock/viewing tower, open terrace/two flags,
round/pentagonal towers, brown roofed wings, chapel, four projecting bays,
modern glazed halls, upper funicular shell and ticket-office shell.

Master 5691 triangles/687424 bytes;
four levels 932/2206/5691/5691 triangles. Initial
skyline+district 287268 bytes; closeup 539272 bytes before shared
textures. Six existing256-square graphs, linear tints, metric repeats,
eight near groups and one flat far group. No embedded/new image or copied mesh.
Street/closeup share bytes because the exterior already meets the street budget.

Inspected44 final portable/shared/Earth images. Corrected long roof ridges
rotated by uneven map vertex spacing; ridges now align to the longest mapped
wall. Removed Float32 clip slivers and bounded distant outline simplification.
Seven focused tests pass: all-part roof coverage, open court, real mapped
passage through both walls, open clock terrace, identity/datum distinction,
deterministic budgets/materials/GPU layouts and finite geometry. Six Khronos
validations have zero errors/warnings. Scoped LOD/strict medium-fi budget checks
and30-tick capture pass.297 map samples roundtrip within0.688mm. Shared graphs
read once; unload leaves zero live model geometry.

Operator viewing-platform400m altitude and1982 raise1.2m are not a surveyed
relative tower height. Mapper component heights, original roof/opening/bay
sections, provisional courtY6 and exterior-baseY0 require actual-site review.
The raised entrance bridge floats over the flat review stage; real hill and
bridge grades are unresolved. Synthetic continental houses are a style
fixture. Interiors/exhibits, heraldry, furniture, vegetation, natural hill,
surrounding city, funicular rails/vehicle and surveyed bridge piers are separate.
Physical laptop/phone and continuous LOD measurements remain pending.
Visual/shared rendering accepted; medium-fi/geographic/fidelity pending.
Placement inactive/draft; footprint replacement off. Authored exterior draft,
not a completed landmark.

### 2026-10-09 — N0308 São Jorge exterior draft

Source: `places/ey/eyc/n0308_castle_of_saint_george`, original deterministic
`sao-jorge-castle-model.mjs`. Exact castle1382432568/Q636780, southern/eastern
barbican27022973, current museum168984058, actual hillside tower591833135 and
149-step link83388706 retain223 attributed coordinate samples. Operator current
photos/diagram guide ten outer towers plus one central tower, two open courts,
divider, two roofed north towers, periscope/flags, actual gates/bridges, museum
envelope/current ruin arches and long hillside stair. Raw interior tower246379169
has a conflicting São Lourenço label; its footprint guides the central tower,
while the real hillside tower is kept independently identified.

Master 6923 triangles/834820 bytes;
four levels 996/3932/6923/6923 triangles. Initial skyline+district
444324 bytes; closeup 651404 bytes before shared material cache.
Five existing256-square graphs, metric repeats, linear tints, seven near groups
and one flat far group. No embedded/new image, copied mesh or photo texture.
Street/closeup share bytes because the complete current draft meets street caps.

Inspected47 portable/shared/Earth frames. Fixed museum roof cells/gable edges,
duplicate terrace caps, concave bridge-side fans and sloping hill-wall rails.
Gate ray tests caught the lower parapet crossing its entrance; apertures now
clip those rails as well. Filtered aperture operations to intersecting faces;
district crenellations simplify and skyline omits tiny inner stairs/ruins.
Nine focused tests, six zero-error/warning Khronos validations, targeted LOD/
strict medium-fi budget checks and30-tick portable scene capture pass.
223 map controls reconstruct within0.665mm. Shared graphs read once; unload
leaves zero live model geometry and restores the ground.

The operator's Observatory111.229m is absolute altitude; Palace Tower7.6by10m
is approximate. Heights, outer-tower returns, roofs, gates, museum section and
main courtY25 versus hillside towerY0 are original estimates. The main castle
and museum float over flat test ground; actual hill/museum/bridge/stair common
datum is unresolved. Synthetic Mediterranean houses are a style fixture.
Museum interiors/exhibits, fine archaeology, statues/heraldry, furniture,
vegetation, natural hill, adjacent neighborhood/church and whole city wall
are separate or pending. Physical device/continuous LOD review remains pending.
Visual/shared rendering accepted; medium-fi/geographic/fidelity pending.
Placement inactive/draft; footprint replacement off. Authored exterior draft,
not a completed landmark.

### 2026-10-09 — N0308 terrain contact investigation

Added separate17x17 research hill from289 attributed coarse Mapzen Terrarium
samples, numeric PNG16 and source/height comparison records. DGT public
viewer heights111–112m conflict with coarse values89.70m at the main
anchor and64.24m at São Lourenço. The current research zero64.70m seats
only the original court anchorY25; no flattening or retaining-wall invention.
Museum samples descend14.33m under its flat model floor. Fine DGT MDT
collections are described as private-access; authenticated download was
not attempted. Source provenance and limits are retained in the bundle.

All six model hashes unchanged, initial landmark download444324bytes.
Ten focused checks pass, including289 decoded heights within1mm, and
scoped runtime integrity check passes. Inspected47 refreshed renders and
full-size gateway/court/hill/museum views. Source and Earth-rig hill
captures expose buried entrances/court floor/lower barbican and floating
northern/museum foundations. Raised entrance camera above the terrain;
isolated shared-material geometry still contains the doorway/roof sections.
Shared surfaces pass, portable visual acceptance returns to pending.
Medium-fi/geographic/fidelity remain pending and placement stays inactive.
The user’s unnamed missing-building section remains unidentified.
