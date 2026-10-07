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
