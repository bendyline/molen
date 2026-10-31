# Repository GLBs

Every GLB in this repository is a build output of checked-in source, except five small authored
masters. Git holds the generators, their specs, shared materials and textures, sidecars and
review reports. Full-size review captures stay local (see below). Asset inputs name the reproducible model bundle. The
Assets workflow builds them from a clean checkout, requires those bytes, and publishes them as a
GitHub release that `pnpm assets:fetch` downloads as a cache. Building and fetching produce
identical files.

## How the pieces fit

`pnpm dev` reuses previously prepared browser packs and never invokes this GLB pipeline.
Run `pnpm dev:prepare` explicitly for initial setup; its `assets:fetch` step may fall back to a
local source build when the bundle for the current input hash is unpublished. After targeted
model generation/import, `pnpm dev:content` repackages the current runtime assets for the browser.
CI and production builds retain their normal restoration, packaging and verification checks.

| Stage | Input in Git | Output (ignored by Git) |
| --- | --- | --- |
| Generate | The programs in [`asset-build.json`](../asset-build.json), plus the specs, material graphs and textures they read | `models/source.glb` in each source bundle, and a few direct runtime models |
| Import | Each bundle's `source.json` model entry (`pipeline`, sidecar `output`) and optional `spec.json` `importOptions`, then the `afterImport` scripts in `asset-build.json` that derive reports from the imported models | The runtime `model.glb` beside each `asset.json` sidecar |
| Verify | `asset-lock.json` | Nothing; any byte difference fails the build |
| Derive landmark detail levels (after import, before verification) | The imported structure master and `packages/tooling/scripts/landmark-lods.mjs` | Separate `model.skyline.glb`, `model.district.glb`, `model.street.glb`, `model.closeup.glb`, plus hash/cost metadata in the sidecar |

The generators are the source of truth. Dedicated place generators (including Willis Tower,
Galata Tower, Gamla bron, Severn Bridge and Książ site components) live in the geographic
`content/worldgen/source/places/<gh2>/<gh3>/<bundle>/models/` directories and are listed in
their source manifests. Shared helpers and multi-place batch generators still live in
`packages/worldgen/scripts/` (landmarks, bridges, stadiums, towers, lighthouses, props).
The other generators include the aircraft recipes in
`content/entities/source/aircraft/*/models/generate.mjs`,
`packages/entities/scripts/generate-json-models.mjs` (trees and the boulder, from each bundle's
`models/model.json`), the red barn's `scripts/generate-barn.mjs`, and Lantern Dungeon's
`tools/generate-assets.py`. Each source bundle's README names the command that regenerates it.

The five vehicle `source.glb` files are listed as `masters` in `asset-build.json`. No generator
for them survives, so the committed binary is their source (about 125 KB each). Their runtime
models are still imported by the build. Prefer a generator for anything new.

`asset-lock.json` (`molen/asset-lock@2`) lists the path, size and SHA-256 of every built GLB.
Its release name, `assets-<16 hex>`, is derived from those entries alone, so a lock can be
committed before its release exists.

## Get the GLBs

### Model review images

Render and inspect the changed model in Molen before recording visual acceptance. Keep the
turntables, detail shots, lighting variants and medium-fi contact sheets in ignored `shots/`,
`medium-fi/` or `.artifacts/` directories. These are disposable local review outputs: a clean
checkout, model build and ordinary CI must work without them or a review-image download.

Keep these durable artifacts in Git:

- Model recipes, specs, source textures, heightmaps and other required authored inputs.
- Concise review reports with the source/model hashes, render commands and camera settings,
  what was actually inspected, the decision and remaining limitations.
- One or two curated small summary previews per model, normally `preview.png` beside its
  source bundle. Prefer a web-sized image, roughly 1024 pixels on the long edge; do not promote
  an entire capture set. Source textures are separate assets, not review screenshots.
  To judge a generator change before importing it, `node packages/entities/scripts/model-sheet.mjs`
  renders source GLBs (and figure or wildlife bodies) from calibrated views, side by side or as
  before/after pairs; see [entity model quality](entities/MODEL-QUALITY.md).
  For the entity fleet, `node packages/entities/scripts/preview-fleet.mjs` composes each
  bundle's `preview.png` (exterior and operator view, listed in `source.json` and linked from the
  README) and the per-collection contact sheets in `content/entities/` from the local
  `capture-fleet.mjs` output; rerun it after every capture pass so the tracked images match the
  models.

Reports and older `source.json` inventories may retain local capture paths and hashes. Their
absence does not invalidate the source bundle or trigger a download. Required source files,
reports and summary previews are still checked. Missing images also do not establish a new
visual approval: re-render and inspect the affected model when performing a new visual review.

Vehicle reviews aim for calibrated drawing/photo overlays of both exterior and interior,
following the [vehicle reference overlay goal](../docs-src/guide/medium-fi.md#vehicle-reference-overlays).
Keep bulk overlays and research images local with the other captures. The concise report retains
reference provenance, calibration controls, camera settings, source/runtime hashes, independent
landmark discrepancies and explicit gaps where useful reference material was unavailable.
Required authored source inputs remain durable; a disposable overlay is not a replacement for
them. Inspect the actual comparisons before accepting a model; merely producing overlays or
listing reference URLs does not establish fidelity.

`.gitignore` excludes bulk captures and `pnpm source:check` fails if capture images have been
staged or tracked in Git, even when force-added. It runs in both CI and `pnpm verify`. Model
tests should validate geometry, source/runtime hashes, materials and budgets; render tests
should generate the views they exercise. A small explicit golden fixture is a deliberate test
asset, not an archive of every model review.

The previously published archive and `review-lock.json` remain an **optional historical
recovery** facility. `pnpm reviews:fetch --prefix content/worldgen/source/places/gc/` retrieves
only the relevant archived captures. Neither `assets:fetch` nor `assets:build` fetches reviews.
Normal model work does not update this lock, pack captures or publish a review release. New
captures remain local; any separate archive publication requires the owner's explicit request.

### Restore model assets

In the engine repository, with Node 22.13 or newer:

```sh
pnpm install --frozen-lockfile
pnpm assets:fetch     # download the bundle named by asset inputs, or build from source
pnpm build
```

`pnpm assets:fetch` checks archives, restored files and existing GLBs against the bundle's
SHA-256 hashes. A cached installation record and matching file size do not prove that a
checkout holds the expected bytes. Matching files are reused; missing or changed bundle files
are restored. `--force` restores even matching files. `--offline` uses only the local cache in
`.artifacts/asset-packs/`, and `--prefix content/worldgen/assets/places/c2/` restores part of the
tree. `pnpm all` and `pnpm dev` fetch automatically.

When the release is not published yet, the local source-build fallback verifies every pinned
GLB and warns about additional, unpinned outputs from models still in progress. Those outputs
stay as local work. `pnpm assets:check` also warns about unpinned GLBs instead of blocking
`pnpm all`; missing or changed pinned GLBs still fail. `pnpm source:check` skips model bundles
whose source and runtime GLBs are not yet pinned or declared authored masters, with a warning.
Bundles containing a pinned GLB or authored master, and bundles without GLB models, still
receive all source checks. The structure authoring index is checked in either mode.

When finalizing a model batch, use `pnpm assets:check --strict` and
`pnpm source:check --strict` to include unfinished work. `pnpm assets:build` and
`pnpm assets:pack` always require the complete GLB inventory to match the lock.

To build everything from source instead, with no network access for models (Node 24, the major
`asset-build.json` pins):

```sh
pnpm assets:build
```

This compiles packages if needed and builds only jobs whose recorded inputs or outputs changed.
Successful local generators, imports and after-import jobs keep dependency records under
`.artifacts/asset-build/jobs/`; an unpublished release does not invalidate those records.
Node generators record the files and directories they read, including dynamically imported
recipes. A shared recipe edit invalidates its dependents. Missing or changed output bytes also
invalidate their job. Successful jobs survive a failed sibling, so retrying resumes the work.
Existing batch generators remain one cache unit; imports are cached per model.

Local builds use file size, modification/change timestamps and file identity as a fast hint,
reusing saved content hashes when those are unchanged. A changed hint triggers hashing; merely
touching a file without changing its contents does not rebuild its model. These hash hints live
in `.artifacts/asset-build/file-hashes.json`. Missing or invalid hints are rebuilt automatically.
Release integrity checks still read and hash the actual bytes.

The first build after installing this cache records the dependencies. Later unchanged builds
report zero generators and zero imports. `pnpm assets:build --force` explicitly rebuilds all
generators and imports, including derived GLBs. Keep `.artifacts/asset-build/jobs/` to retain
local build records; removing it requests a fresh baseline. Fresh CI checkouts build from source.
Non-Node generators declare their output trees in `asset-build.json`; those authored trees and
the generator's scripts and pinned requirements form their cache inputs.

The Lantern Dungeon
generator needs Python 3.10+. The build discovers a compatible installed interpreter, including
versioned commands such as `python3.12`, so an older system `python3` does not block it. When
the pinned packages are missing, it creates `.artifacts/asset-build/python/` and installs them
there from `examples/lantern-dungeon/tools/requirements.txt` (the first install needs network
access). Later builds reuse that environment without installing again. System Python packages
are left alone. Set `PYTHON` to choose an interpreter explicitly; that override must already
have the required version and pinned packages. All Python checks finish before generators start.
A full build takes a few minutes on a workstation and writes about 18 GB. The report and one log
per generator are in `.artifacts/asset-build/`.

## Change a model

### Fast authoring loop

Use the existing package builds until a generator dependency or runtime package changes.
For an individual structure, generate and import only its ID. For example:

```sh
node packages/worldgen/scripts/generate-signature-towers.mjs --ids=two_prudential_plaza
# Only when a new source bundle was added:
node packages/worldgen/scripts/index-structure-sources.mjs
# When a source bundle or model recipe was added, before import and review captures:
node packages/worldgen/scripts/index-structure-authoring.mjs
node packages/worldgen/scripts/import-structure-models.mjs --ids=two_prudential_plaza
node packages/tooling/scripts/generate-landmark-lods.mjs --ids=two_prudential_plaza
```

Validate the changed GLB's attributes, winding, bounds, material bindings and source/runtime
hashes. During geometry iteration, inspect the silhouette and affected detail views. Once that
model's geometry is stable, capture and inspect its complete required portable/shared-material
review set. Re-render when geometry, materials, placement or capture behavior changes; do not
re-render unchanged models. Placement changes additionally require a geographic fit review.
Register new recipes before the final captures: review input hashes include the recipe files
listed in the authoring index, so adding that registration later invalidates those reviews.

**Complete each model in one continuous authoring pass.** The owner clarified this on
2026-10-19: reference selection, geometry, shared materials, map fit, LODs and visual checks
belong to the same round. Carry the working brief and inspected evidence through that round;
do not hand a finished draft into a separate queue that restarts research and reconstructs its
status. Inspect while building, fix concrete defects, run the selected integrity checks and
record one concise completion decision before moving to the next model. Completion still
requires the visual and placement checks; they are part of making the model, not a later
re-evaluation project.

Use the smallest capture set that covers the required views, modes and distances. One frame
can cover several checks. Add views or probes to answer a specific unresolved issue, rather
than creating new review obligations after each successful check. Reuse unchanged inputs and
results. Reopen an accepted model only for a reported defect, relevant source/runtime change
or a failing batch check. Catalog refreshes, lock updates and broad reproducibility checks stay
at batch milestones.

After accepting a changed model, refresh its readiness record with
`node packages/worldgen-earth/scripts/build-structure-readiness.mjs --ids=temple_of_hercules_victor` (comma-separated
IDs are supported). This runs the ordinary evidence checks for those candidates and retains
the other records from the last full ledger; it does not re-approve or rehash unchanged models.
The selected mode requires an existing ledger with matching catalog identities and collection
membership. It is an incremental authoring update, not a full integrity assertion. The default
command and `--check` still verify every candidate; `--check` rejects `--ids`. Run that full check
at the batch milestone and in CI.

For the current structure backlog, use reference pictures for appearance and standard viewer
PMTiles for location, orientation, footprint and terrain fit. The owner explicitly requested
this scope on 2026-10-11. Do not research separate surveys, cadastral records, local LiDAR or
signed doorway sources for each artifact. Record approximate exterior fit honestly and inspect
the affected renders. Exact thresholds and navigable interiors are outside this review scope.
The owner reiterated this on2026-10-12: normally inspect one or two useful pictures, reuse
existing source facts, and decide fit from the standard PMTiles. Additional bespoke evidence
is not a completion gate for this backlog. Record unresolved precision as a limitation and
continue with a reasonable visualization fit; do not start a new research campaign per model.

An independent site building can be absent from the map. A collection with
`identityKind: "site-members"` lists all required `membershipEvidence.memberIds` and retains
`featureIds` for the members that actually have OSM features. An unmapped member needs an
attributed `positionReference` with a source URL and an explicit approximation basis. Never
invent an OSM ID or take ownership of a neighboring building to register it. Its ordinary
source frame, position, material, terrain-contact and visual checks still apply. Shared site
QIDs retain independent, disjoint position ranges.

Structure bundles can keep per-model review scope in `review-scope.json` and attributed
signed map controls in `map-frame.json`; the source generator preserves these documents.
Declare the frame's signed axes in its `axis` text before capture, including positive `+X`
and `+Z`. Numeric reconstruction axes and `nativeAxes` alone do not satisfy that declaration.
Use `qaCameraOverrides`, keyed by existing camera name with `position` and `lookAt`, to move
review cameras when a derivative changes the working floor. This preserves the original
architectural recipe and avoids adding duplicate cameras through `qaCameras`.
When a mapped point fixes location but pictures and PMTiles cannot establish exact facing,
record the chosen facing as approximate. Set `geographic.orientationPolicy` to
`"approximate-visualization"` and the source frame's `orientationControl.status` to
`"reviewed-approximation"`, with the chosen heading, review date, picture references and
honest angular uncertainty (up to 180 degrees). Current placement QA must still pass.
Retain the mapped point; do not fabricate a footprint or describe the choice as a measured bearing.
The source builder accepts point and centerline frames as well as outlines. For an ensemble
located by a named constituent, preserve both the site and component identities and explain
their reviewed association; do not claim that distinct Wikidata IDs are an exact match.
Dense ensembles may use an `osm-members` collection: each member keeps its own attributed
`featureId`; a member with a known independent Wikidata ID also records its exact `identitySource`.
Other members retain the site ID plus their distinct map identity. A geographic proposal may
set `mapIdentity.maxDistance` to a positive radius of at most 80 metres (default 80). Shared-site
members still require disjoint matching radii and anchors within 2 metres of their recorded
member controls; a small radius does not permit duplicate features or moved identities.
A skyline that automatic reduction cannot represent can declare `runtimeLodOverlay` in
that review scope: `level: "skyline"`, a `packages/worldgen/scripts/*.mjs` module, its exported
builder and a conservative `errorMeters`. The registered runtime-LOD generator rebuilds
that silhouette from source and retains the three ordinary derivatives. The authoring
index includes the declared module. Its fingerprint changes only the affected model's
overlay; unrelated recipe fingerprints stay unchanged. See Jeddah Light's source bundle
and `jeddah-skyline-model.mjs` for an example. Master bytes remain separate.

When near automatic reductions fail, `authoredLevels` can declare district, street or
closeup exports from the same source module, an explicit semantic `surfaces` mapping
and conservative `errorMeters`. The builder preserves shared metric surfaces and
separate GPU streams and rejects triangle overages. Tahkuna provides district/street
examples. An optional `sourceGeometry` module/export keeps a current
source reconstruction separate from a retained original recipe; its declared facts
and dimensions are preserved in the review scope and authoring index.

For signature-tower and castle recipes, a scope can also select `surfaceOverrides`,
`geographic`, `previewGround`, `previewTerrain`, `previewEntities` and `sourceDocuments`. Preserve the original
recipe and measured controls; use a separate current leaf for architectural or ground repairs.
Turku Castle demonstrates an attributed height grid, reconstructed court levels and a source
terrain fixture. Declare measured and reconstructed elevations separately, including the datum
the host must supply. A review fixture does not establish the host's terrain accuracy.
Heritage-tower and lighthouse scopes also accept `previewGround`, `previewTerrain`,
`camera` and `sourceDocuments` for retaining standard PMTiles review fixtures.
Leeds Castle pairs its attributed terrain with a source-local palette box for lake water;
the medium-fi fixture accepts these explicit boxes without running scene scripts. Set
`mediumFiContext.groundY` to the absolute base datum for geographic placement captures.

An optional `caps` object can request a small additional district, street or closeup
reduction with `triangles`, absolute `errorMeters` and optional `prune`. Every material
group is retained, accumulated error includes pruning allowance, and failure to meet
the strict 4000/16000/64000 ceilings stops generation. Inspect affected details again;
do not accept nominal triangle overages. Keri Lighthouse provides a street-cap example.

Tall or asymmetric models should add explicit whole-model cameras to their scope.
If the library's four automatic whole views crop an elongated group, use
`capture-landmark-library.mjs --turntable-padding=1.2`; the report records explicit native-frame
camera poses. The default camera path and rendering fixture are unchanged.
An optional `reviewLod` on a QA camera chooses the derivative in the medium-fi fixture;
portable and shared source captures still show the detailed master. `qaLodCameras` adds
browser-only detail cameras for changed derivatives without altering source review views.

Complete each model in one authoring cycle: resolve usable references, build its defining
geometry, import and check its runtime levels, inspect the affected views and ground contact,
then record readiness and story links. Do not defer those steps to a second batch-wide artistic
review. Reuse current evidence when the rendered inputs are unchanged; metadata or naming
corrections alone do not require new captures. Reopen a completed model only for a relevant
geometry, material, terrain or placement change, invalid supporting evidence, or an observed
failure. Concentrate review cameras on the silhouette, defining details, shared materials,
ground contact and actual runtime levels; avoid duplicate views that add no coverage.

Refresh the catalog, galleries and aggregate texture inventory once per meaningful batch.
For Qualla-linked structures, also refresh the [story backlog and Qualla model annotations](worldgen/source/qualla-structures/README.md#remembering-model-coverage-in-qualla)
after the source, registration, placement and readiness catalogs are current. The explicit
scan/sync step remembers model IDs in the sibling Qualla curation catalog, including models
that still need review; an asset build alone does not update story coverage.
For the Qualla workstream, every structure catalog candidate and collection member is reserved for
production on a separate device. Retain coverage links, but exclude these models from local
authoring and refinement; the Qualla batch preparation check enforces this ownership rule.
After the selected generators and imports have run, a local lock checkpoint can use
`pnpm assets:build --no-generate --update-lock`: this reuses current source GLBs, imports only
stale runtime models, and hashes the inventory without running every generator. Review that
only the intended paths changed and none disappeared. This checkpoint does **not** prove a
clean source rebuild; use the full build below once at a batch milestone and in Assets CI.

Model-only iterations do not require `pnpm verify`, `pnpm audit:prod`, `pnpm smoke:packed`,
documentation builds or the full engine golden suite. Those checks cover engine packaging,
dependencies and unrelated applications. Run relevant engine tests when changing the loader,
renderer, shared authoring infrastructure or build workflow; leave the complete release gate
to its CI/batch boundary. A dependency audit is not a model-quality check.

### Runtime landmark detail levels

The `worldgen-runtime-lods` after-import job applies to every registered
`molen.worldgen.structure.*` asset. It reads the canonical import without changing it or its
source master. The four runtime files are independent downloads and use separate vertex
attribute streams to avoid duplicate Float32/Uint8 GPU uploads. Detailed levels retain the
master's shared-material references; their portable embedded fallback images are omitted.
The distant skyline uses vertex colors and shader-derived flat normals, requiring no textures.

The skyline recipe partitions source geometry into local convex pieces and simplifies their
exterior. Small openings and thin details can disappear. The other levels weld coincident
vertices, remove narrow trim within a 2% surface-area allowance per material, and simplify with
a bounded error setting. When a level stays more than 15% over its triangle target, the
generator doubles the error budget and lets meshoptimizer prune isolated parts until the level
fits, up to 2% of the model's extent for district, 0.6% for street and 0.15% for closeup, and
finally drops components thinner than that error (smallest first, at most a quarter of each
material's area). The recorded error grows with the reduction, so the streamer uses the level
from farther away. A closeup that still does not fit stays over target rather than blur; its
master needs re-authoring. `node packages/tooling/scripts/check-medium-fi.mjs` audits every
structure against the [medium-fi style guide](../docs-src/guide/medium-fi.md). The viewer admits an upgrade only
within its geometry and render budgets; additional authored LODs may be needed to
make those structures detailed on phones. Estimated geometric error is not a certified bound.

`asset.json.runtimeLods` records each level's hash, raw/gzip sizes, geometry bytes, triangle/draw
costs and estimated error, bound to both the master hash and generator recipe hash. The existing
Assets workflow rebuilds and verifies these files through `asset-build.json`; release packs and
`asset-lock.json` include them automatically. No GLBs are committed.

For a targeted visual comparison and integrity check:

```sh
node examples/world-explorer/test/performance/review-lods.mjs --ids=istanbul_sapphire
node packages/tooling/scripts/check-landmark-lods.mjs
```

For one model, pass `--ids=nina_tower` to the LOD checker. Source-authored skyline overrides
live beside the detailed model recipes and are registered in
`packages/tooling/scripts/authored-landmark-lods.mjs`. Use these when automatic reduction
loses characteristic openings or crowns. The normal LOD generator and release source build
apply them automatically. Their recipe hash includes the model recipe and shared geometry
helpers; other models retain their existing derivative hashes. Review every override beside
its master. Nina Tower is the first example: its two towers, open crowns and skybridge are
preserved in a 65 KB silhouette, with no embedded textures.

The integrity check covers all registered structures, source hashes, runtime hashes, material
bindings and vertex layouts. Comparison renders cover selected models, not a visual approval
of every generated level. See `examples/world-explorer/test/performance/README.md` for the
repeatable loading benchmark and device-testing limitations.

### Finalize a model batch

This is an aggregate consistency and source-reproducibility checkpoint. Per-model visual
reviews and integration should already be complete; do not restart them here unless the
checkpoint exposes a relevant change or failure.

1. Edit the generator, spec, material graph or texture. Iterate with the bundle's own command,
   for example `node packages/worldgen/scripts/generate-stadium-models.mjs --ids=munich_olympic_stadium`.
2. Once the batch is stable, run `pnpm assets:build --update-lock`. It regenerates, re-imports and rewrites
   `asset-lock.json` for whatever the source now produces.
3. Review the diff: generator code, regenerated metadata (`source.json`, `spec.json`, sidecars,
   README), and the lock entries that changed. Commit them together. Never commit a built GLB,
   and there is nothing to upload.
4. On the pull request, the Assets workflow rebuilds from source and fails unless every byte
   matches the committed lock. The other workflows build from source too, because the new
   snapshot is not published yet. After the merge, Assets on `main` publishes it.

Instead of step 2, the Update asset lock workflow can run the build on GitHub's runner and commit
the lock and metadata to the branch (Actions, or `gh workflow run update-asset-lock.yml --ref
<branch>`). A push made with the workflow's token starts no workflows, so the pull request's
checks run on your next push.

To add a generator, append it to `generators` in `asset-build.json`. Every GLB the build produces
must be in the lock, and every locked GLB must be produced. A GLB that is neither locked nor a
listed master fails `pnpm assets:check`.

Generators also rewrite their JSON and Markdown metadata. A successful `pnpm assets:build`
keeps generated runtime `assets/**/asset.json` sidecars with the GLBs they describe, including
their hashes, bounds, statistics and detail-level metadata. Restoring older sidecars would leave
the built models unusable for verified packaging. Authored source and review documents retain
their original bytes; the build lists proposed changes to those files and CI annotates them.
A failed build restores all original text. A file whose content is unchanged keeps its original
bytes even if a generator lays it out differently, because review evidence pins some of these
files byte for byte.

## Determinism

The lock only works if every machine builds the same bytes, so generators must be
deterministic:

- No clocks, unseeded randomness or locale-dependent formatting.
- Iterate in a stable order.
- Don't hash files whose bytes vary by checkout. A Windows `core.autocrlf` working tree reads
  text files with CRLF.
- Hash only what a model depends on. Hashing an entire shared evidence file makes every model
  that cites it stale whenever any entry changes.
- Node's transcendental `Math` functions are C++: fdlibm, and the C library's `pow`. They round
  differently on arm64, where the compiler fuses multiply-adds (about 0.1-0.6% of results differ
  from x64 in the last bit), and `pow` differs between C libraries. That changed dozens of
  models, mostly through near-zero coordinates and UV projection ties. Every Node process an
  asset build starts therefore runs with
  `packages/worldgen/scripts/install-deterministic-math.mjs`, which replaces those functions with
  pure-JS ports in `deterministic-math.mjs`: V8's fdlibm expression for expression and glibc's
  `pow`, which return x64's results on any CPU. Worldgen generators also import it first, so a
  direct run matches the build. Test a change to the ports on arm64 and x64 before relying on it.
- The `**` operator calls the C library directly, and nothing can replace it. In generators,
  write `Math.pow` for any exponent other than 2 or 0.5, which V8 computes exactly. Biome's
  `useExponentiationOperator` is off for generator code, and a worldgen test rejects other `**`
  exponents there.
- Asset builds are also pinned to the Node major in `asset-build.json` (`"node": "24"`) and
  refuse to run on another one, so a V8 or three.js change arrives as a deliberate upgrade.
- Python's `math` is the C library's, whose results can differ in the last bit. Derive stored
  data (normals, UVs) from the float32 values the GLB will hold, as Lantern Dungeon's generator
  does.
- Don't re-encode images during a build: PNG compression depends on the platform's zlib. Commit
  derived textures and embed or reference their bytes. Lantern Dungeon re-derives its maps only
  with `--derive-textures`.

The Assets and Update asset lock workflows pin Node 24 (`.node-version`) and Python 3.12. When another workflow has to build from
source, it switches to Node 24 for the build only. Pillow is pinned by
`examples/lantern-dungeon/tools/requirements.txt`. If a runner-image update ever changes a byte,
the weekly scheduled run reports it before a model change is blamed for it.

## Shared materials and textures

Structures reference shared, procedural material graphs
(`content/worldgen/materials/*.matgraph.json`) through `extras.molenSurface` on their glTF
materials. The client bakes each graph once and shares it across every model that uses it, so
the landmark GLBs embed no textures beyond a few kilobyte-sized portable fallbacks. Model size
is geometry. Canonical imports can contain millions of triangles; the viewer now streams the
separate source-derived levels described above. Further source instancing and compression can
reduce the cost of detailed levels that still exceed practical device budgets.

Two sets still embed image textures. Each textured Lantern Dungeon model carries its own copy of
the shared limestone set from `asset-src/shared/textures/`. The red barn embeds its three
weathered-wood maps.

## Releases

The Assets workflow runs on every pull request, on `main`, weekly and on demand. On `main` it
runs `pnpm assets:publish --target <commit>`. That packs the built GLBs into `.tar.gz` archives
grouped by content role and geohash2 cell, about 256 MiB each. It uploads them with
`asset-manifest.json` and `ASSET-NOTICES.txt` to a draft release, checks every attachment's
digest, then publishes the release without marking it latest. A release that is already
published is left untouched, and older releases stay for older commits. The owner can run the
same command with GitHub CLI credentials that have release write access.

| Archive example | Contents |
| --- | --- |
| `worldgen-models-c2-part-001.tar.gz` | Imported landmarks in geohash2 cell `c2` |
| `worldgen-sources-c2-part-001.tar.gz` | Their generated source GLBs |
| `worldgen-reusable-models-part-001.tar.gz` | Reusable structures without a location |
| `entities-models-part-001.tar.gz` | Imported entity models |
| `lantern-dungeon-sources-part-001.tar.gz` | The example's generated source GLBs |

These archives restore repository build inputs. Applications use the `molen/pack@1` content
packs and geographic model archives published with the site; a browser never downloads a
repository snapshot.

## Git tracking

`.gitignore` ignores `*.glb` except the listed masters. GLBs committed before this layout stay in
the index until the owner removes them once, keeping the local files:

```sh
git ls-files -- '*.glb' | grep -v '^content/entities/source/vehicles/' | xargs git rm --cached --
```

Removing them from the index does not remove old blobs from history.
