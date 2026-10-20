# Qualla-driven structure backlog

Start with [BACKLOG.md](BACKLOG.md): a complete set of linked category lists, a reviewed
starting batch, and counts for new models, existing planned work, existing models needing
review, and existing coverage. This inventory is **authoring metadata**, excluded from the
runtime pack by `source/**`. The scanner does not add models or placements; model work is
tracked in the completed [first 100](batches/QUALLA-001.md) and the active
[next 300](batches/QUALLA-002.md).

The core100 are complete, including the owner-accepted limitations recorded beside
Hangar37, Humayun’s Tomb and the Taj Mahal Palace Hotel. Continue the next300;
do not reopen unchanged completed models for a separate finalization pass.

For the next batch, use `progress.mjs --batch=qualla-002` and
`sync-completed.mjs --batch=qualla-002 --ids=<model> --write`. Each model is built,
visually inspected, integrated, and story-linked in one authoring cycle. The
separate readiness ledger preserves the completed core100 and makes later batches
resumable. A broad quality/research campaign is not a prerequisite to continuing.

## Imagery policy

Use public-domain imagery, starting with images already cleared and published in
Qualla. Exclude a source when its provenance, attribution, public-domain status or
local identity is uncertain. Resolve source choices without asking the owner.
CC0 public-domain dedications qualify; attribution and share-alike licenses do not.

The batch records this rule as `qualla-public-domain-imagery@1`. Preparation,
completion checks and bounded story synchronization enforce it. The check compares
the exact local path in published Qualla article media with its original metadata,
public-domain basis, attribution and fingerprint. A downloaded gallery file or an
AI relevance score alone does not qualify. Candidate eligibility still requires
visual inspection of the correct structure and era.

After replacing references, record `qa.imageryReview` with the current policy,
model input and reference input hashes, all accepted reference paths, excluded
historical imagery and the actual fidelity review. Its scope is
`all-model-reference-imagery`, including auxiliary photographs and aerial or plan
images previously used outside the main selection. A legacy visual approval or
an eligible main photograph does not complete this review.

Fresh medium-fi captures must use version 2 and identify the actual current asset,
runtime and detail-level bytes. Keep the complete per-model imagery inventory and
rights proof in `imagery-evidence.json`, including any auxiliary plan. Inspect new
renders after geometry changes before rebinding approval. Watergate and Brandenburg
Gate include worked examples in their `PUBLIC-DOMAIN-REVIEW.md` documents.

The complete imagery inventory is checked separately from the main Qualla
selection. Every selected and auxiliary image must be accounted for, inspected
and bound to its original bytes. Missing inventory, unaccounted plans or a changed
rights record prevent completion.

When Qualla's eligible images leave a necessary gap, the supporting-source check
accepts NPGallery originals only with a saved primary record crediting NPS and
explicitly granting full public-domain rights. It also accepts Commons originals
with the photographer's explicit PD-self or CC0 release, matching author and exact
native-file digest. A migrated Wikipedia creator grant also requires the exact
named granting account, matching linked author, original upload link and explicit
PD-user-w dedication in the pinned primary revision. A generic PD-user label is
insufficient. Highsmith photographs require both the specific Library of
Congress catalog record and the library's explicit record of her public-domain
dedication; a bare "no known restrictions" advisory is insufficient. The inventory
also accepts Nationaal Archief CC0 photographs mirrored on Commons when the exact
primary archive record identifies the owner, object, photographer and date and
explicitly says CC0. The pinned Commons revision must identify that same archive
object, retain CC0 and match the native image digest. Original HABS measured
surveys and Jack E. Boucher government photographs require the explicit primary
collection grant, exact native TIFF/catalog identity and inspection of the
original title block or photographic source credit. Older drawing catalogs may
list an inspected, named delineator as a field-team member or project manager;
record an explicit name/role match for every drawing credit in that case.
Unrelated architects, transmitters or generic contributor credits do not qualify.
Photographs also require
the matching primary government photographer record. Privately sourced copies,
unverified historical plans and a bare collection label do not qualify.
The inventory must record
the prior Qualla search. Store the original photo in the model's
ignored `.artifacts/reference-photos/` cache and the hash-bound primary HTML record
under `reference-rights/`. A missing cache must be restored from its recorded
original URL and verified against its hash before approval can pass again. A
generic public-domain label or an NPS-hosted third-party photograph is insufficient.
Ford's Theatre, Lorraine Motel and Anne Frank House demonstrate these checks.
No reference image is embedded in these models.

Run `node content/worldgen/source/qualla-structures/audit-imagery.mjs` to refresh
[the imagery audit and replacement queue](batches/PUBLIC-DOMAIN-IMAGERY.json).
Existing technical validation and public-domain reference validation are counted
separately in [progress](batches/PROGRESS.md). Previous reference and rendering
reviews remain historical evidence; they do not waive the current imagery rule.

## What qualifies

A specific physical building or fixed structure qualifies when it is the subject of a Qualla
story, or an essential, explicitly identified setting in that story. Architectural fame is
not required: hotels, houses, factories, shops and prisons matter alongside palaces and towers.
Target recognizable, accurately proportioned exteriors within Molen's
[medium-fi standard](../../../../docs-src/guide/medium-fi.md), with research before modeling.

An event coordinate does not justify a nearby arbitrary building. The attack on Pearl Harbor
and murder of Ennis Cosby are explicitly recorded as non-structure stories. Separately,
Qualla's Pearl Harbor Aviation Museum story identifies Hangar 37 and the Ford Island control
tower; those are real, individually scoped targets. The Robben Island story similarly yields
a prison and a lighthouse, each needing its own researched anchor.

The default target is the surviving exterior. Ruins, demolished buildings, unbuilt projects,
multi-site institutions, campuses and broad historic districts require a scope/era decision.
Do not reconstruct a vanished building in the modern Earth view by accident. A place name,
an institution name, a mention in a flight-context paragraph, and a physical building are
different things. Gardens, landscapes, event sites and whole cities can still contain useful
targets, but those must be identified separately.

## Files and scan meaning

| File | Purpose |
| --- | --- |
| [BACKLOG.md](BACKLOG.md), `lists/*.md` | Human-readable structure lists with Qualla links |
| [structures.jsonl](structures.jsonl) | One record per target: stable ID, scope, category, reference point, stories and current Molen matches |
| [review.jsonl](review.jsonl) | Unresolved story scope/identity, with summary, link, reason and possible existing matches |
| `scan/<geohash2>.jsonl` | Persistent per-source-record `building3dScan` marker, semantic content hash and result, including exclusions |
| [decisions.json](decisions.json) | Hand-edited editorial decisions; never overwritten by the scanner |
| [scan-summary.json](scan-summary.json) | Corpus, algorithm, decisions and catalog fingerprints; counts and duplicate-ID conflicts |
| [OTHER-DEVICE.md](OTHER-DEVICE.md), `workAssignment` in each target | Next-1,000 ownership, kept separate from readiness and excluded from local production |
| [classify.mjs](classify.mjs), [scan.mjs](scan.mjs) | Offline triage and reproducible aggregation |
| [sync-qualla.mjs](sync-qualla.mjs) | Refresh durable `molen3d` model links in Qualla's per-story curation catalog |

**Scanned is not editorially reviewed.** Every source record receives a marker; its review
state is `automated-only`, `editorial`, `stale-editorial-decision`, or `not-scanned`.
The initial pass reads every story's title, summary, narrative sections, flight context,
categories and location. Its deterministic rules discover candidates and preserve uncertain
subjects for further review. Neither the automatic inclusions nor automatic exclusions are a
claim of exhaustive semantic coverage. The review queue is real remaining work, not completed
triage hidden behind a boolean.

The corpus is the locally merged `_c/art/**/*.json`, not every raw import or unapproved catalog
entry. Its record count can differ from Qualla's last build manifest and unique story-ID count.
Duplicate IDs at different paths are retained and routed to review, not silently overwritten.
`scan-summary.json` lists those conflicts. Removed source records become inactive tombstones
in the ledger and leave the current queues.

Qualla public links use its `schemas/CanonicalUrl.ts` ID/suffix policy and
`_c/idx/slug-exceptions.json`, rather than the sometimes different `article.slug`. The scanner
also verifies the article ID and tile embedded in local `r/<slug>/index.html` pages. If a slug
belongs to a different story, it uses Qualla's exact `#list/<tile>/<article-id>` route instead.
This matters for collisions such as the two different Fort Meade locations. Source paths are
relative to the Qualla checkout. Links have not all been requested from the live website.

## Existing Molen work

The scanner reconciles these registries on **every run**, even when story triage is cached:

1. `content/worldgen/source/structure-index.json`: named source bundles, stable asset IDs and
   actual source paths. Reusable recipes are kept separate.
2. `content/worldgen/source/next-1000/candidates.json` and `collections.json`: planned targets
   and individually named collection members, including those without a model.
3. `content/worldgen/project.json` and `stylepack.json`: imported runtime registrations.
4. `content/earth/structures/placements.json`: geographic placement IDs, statuses and notes.
5. `content/earth/structures/readiness.json`: current reported readiness, fidelity and blockers.

The source index retains `hasModel` for a hash-pinned source-model declaration even when the
ignored GLB is not cached on this machine. Refreshing a local index must not forget existing
model coverage. This flag reports authored model presence, not verified local bytes or readiness.

This covers the World Explorer's original named models and the ongoing next-1,000 work.
**Every next-1,000 candidate and collection member is owned by a separate device**, per the
owner's instruction. Keep its Qualla coverage visible and sync model links as that work arrives,
but do not generate, refine or duplicate it in this local workstream, regardless of its current
planned/imported/ready status. Possible matches are held out of local production until identity
is resolved. `workAssignment.owner` records this independently from the readiness status below.
The 120 procedural styles, generic signs and reusable buildings are **not** accurate replicas
of Qualla places and never satisfy a named target. A reusable lock placed at Ballard Locks,
for example, does not establish an accurate Ballard Locks model.

| Work status | Meaning |
| --- | --- |
| `new` | No nearby name match in the inspected catalog; research before reserving a new asset ID |
| `existing-planned` | Existing candidate identity; continue that work instead of adding a duplicate |
| `identity-review` | Possible/ambiguous existing match or missing coordinates; reconcile first |
| `existing-model-review` | Registered model exists, but this scan cannot establish ready geometry and an active placement |
| `existing-ready` | Current readiness ledger says ready and has an active placement; retained as coverage |

Matching is deliberately conservative: exact normalized names plus nearby reference points,
or an explicit editorial Molen identity. A partial name match is only a suggestion. Catalog
presence alone is not approval. This scanner does not rerender, remeasure or independently
recertify the model's fidelity. Original preview models may still need substantial improvement.

`QS-…` IDs derive from Qualla source identities, not build status. A target keeps its ID when
an existing candidate becomes imported or ready. WP/WK stories with the same source stem and
nearby points share a target. Stories with the same exact existing Molen identity share a work
item, retaining other source IDs in `aliasIds`. Other identical names within 250 m are marked
`identity-review` with `possibleDuplicateIds`. More unusual aliases require an explicit shared
`identity` in editorial decisions; proximity alone never merges different buildings. Additional
aliases may change the displayed representative ID, but the other source IDs remain in
`aliasIds`. Cross-story alias deduplication remains part of review, so automatic candidate counts
are not a final count of unique physical buildings.

## Reproduce, resume, review

Run from the Molen repository. These scan commands read Qualla; they do not modify its catalog or
generated content. No model generation, asset downloads, engine build or network is required.

```sh
node content/worldgen/source/qualla-structures/scan.mjs --qualla ../qualla-internal
node content/worldgen/source/qualla-structures/scan.mjs --qualla ../qualla-internal --check
node --test content/worldgen/source/qualla-structures/scan.test.mjs
```

`--check` requires byte-identical outputs and writes nothing. `--limit 500` caps new/changed
classifications for a bounded pass; subsequent runs reuse completed checkpoints and process
the remainder. `--out /tmp/qualla-structures` produces an isolated pass (put a copy of the
editorial `decisions.json` there if those decisions should apply). Each geographic ledger file
is replaced atomically. Unchanged files are not rewritten. There are no volatile run timestamps
in generated data.

The content fingerprint covers relevant text, categories, coordinates, source references,
duplicate declarations and the original catalog title. Media, directional-neighbor updates
and unrelated curation notes do not invalidate an assessment. Algorithm changes invalidate
cached triage. Catalog changes refresh matches and work statuses without requiring story text
changes. Source-hash changes invalidate editorial decisions: their text is preserved, and the
story returns to review until someone reconsiders the decision and updates its hash.

To review a story, find its ledger record, read the source article, and add a decision keyed by
article ID. Copy its current `contentHash`; record who reviewed it, the date, the disposition
(`structure`, `no-structure` or `review`) and an explanation. A structure decision needs named
`targets`. Existing examples in [decisions.json](decisions.json) cover all three outcomes,
multiple buildings from one story, and existing catalog identities.

Each target has `name`, `category`, `scope` and optional `priority` (`P1` is the reviewed starting
batch, `P2` is ordinary automatic discovery). Use `molenId` for an existing asset/candidate ID.
Use a distinct explicit `identity` for **each** target in a multi-structure story; reuse that
identity in other stories about the same building. `rejectMolenIds` records reviewed false
matches (13 Kensington Palace Gardens is not Kensington Palace). If coordinates have not been independently
researched, retain the story reference and describe the missing anchor in `scope`. These
reference points are never copied into runtime placements by the scanner.

Before building, resolve identity/aliases, confirm survival and intended era, research the
footprint and distinguishing features, then use the existing
[structure authoring workflow](../AUTHORING.md). Track model implementation in the established
Molen source/candidate/readiness catalogs; refresh this backlog to pick up progress. Completion
belongs to the model's evidence and readiness review, not to an article's scanned flag.

## Remembering model coverage in Qualla

Qualla's durable `catalog/<geohash4>.json` entries carry a typed `molen3d` annotation.
This lives with the story's curation state, survives article regeneration, and does not edit
generated `_c/art` files. A story can link to several models, and several stories can link to
one model. This records coverage of the **named linked structures**, not a promise that every
structure mentioned in a story has been modeled.

Each link records the stable asset and candidate IDs, backlog target ID, source-bundle path
relative to Molen, story content hash, match basis, placement IDs and reported readiness:

- `needs-review`: an unambiguous registered model with a reported source model exists, but
  Molen does not report ready coverage with an active placement.
- `ready`: Molen's readiness ledger reports ready and names an active placement. The annotation
  also retains fidelity, blockers and placement status; a `preview` remains a preview.
- `unlinked`: a previously remembered link no longer qualifies in the current complete scan.
  Its last-known state and IDs remain for reconciliation, but it is **not current coverage**.

The annotation is a catalog snapshot, not a new visual certification or a claim that models
are published to a live site. Missing annotations mean **not currently linked**, not proof
that no model exists. Planned candidates and ambiguous identities never count as models.
The automatic matching basis stays visible; editorial identity review is separate.

After each meaningful model batch, refresh the backlog and synchronize the annotations:

```sh
node content/worldgen/source/qualla-structures/scan.mjs --qualla ../qualla-internal
node content/worldgen/source/qualla-structures/sync-qualla.mjs --qualla ../qualla-internal
node content/worldgen/source/qualla-structures/sync-qualla.mjs --qualla ../qualla-internal --write
node content/worldgen/source/qualla-structures/sync-qualla.mjs --qualla ../qualla-internal --check
node --test content/worldgen/source/qualla-structures/*.test.mjs
```

The default sync is a read-only dry run; `--check` fails if annotations need updates. Both
require the full backlog to pass its freshness check against current stories and registries.
`--write` uses Qualla's installed `tsx` loader and `CatalogManager.mutateEntry` for locked,
atomic updates. It changes only `molen3d` and the catalog's normal `updatedAt`; current
approval, review, tags and notes survive. Missing/moved/duplicate catalog entries and
unrecognized annotation owners fail closed. Interrupted runs resume by comparing each
annotation; identical reruns do not rewrite files or timestamps. Concurrent edits to the
same model annotation cause a retry rather than an overwrite.

To annotate a completed model immediately, add `--ids=story-id,another-story-id` to both
`--write` and `--check`. These are Qualla article IDs, not structure IDs. The entire backlog
must still be fresh; only the named articles are reconciled, so unrelated links are never
retired by a scoped run. Missing, moved or duplicate selected entries still fail closed.
An article-scoped check does not certify synchronization of the rest of the catalog.

Do not edit managed model links by hand. Resolve identities in `decisions.json`, update the
Molen catalogs, and rerun scan/sync. Qualla's annotation does not enter the story semantic
hash, so syncing coverage never causes a rescan loop.

## First 100 and reference evidence

[Batch 001](batches/QUALLA-001.md) is a fixed selection of 100 physical targets, with story
links, reviewed exterior scopes and reserved identities. Its editable manifest is
[batches/qualla-001.json](batches/qualla-001.json). Keep completed targets in this manifest;
do not silently refill it whenever a new model is imported. Record any intentional replacement
and its reason. All next-1,000 work belongs to the other device. Kensington Palace (`N0904`)
was removed from local slot 19 and replaced by Liebermann Villa; its original entry and
accepted reference evidence remain in `deferredEntries` and `references/`. The manifest's
`replacementHistory` records the change. The distinct 13 Kensington Palace Gardens remains local.

Before resolving any images, preparation checks the complete local batch against the current
next-1,000 candidate/member IDs, asset IDs, existing matches and exact names at nearby
coordinates. It rejects overlaps even if the full story scan predates a new reservation.
Refresh the scan before authoring to reconcile aliases and possible matches too.

`prepare-batch.mjs` reads the local Qualla image corpus and records one evidence file per
structure in `references/`. It resolves original paths through media metadata, retains the
source page, photographer, license and date where available, and deduplicates copies of the
same photograph. Filename ranking produces suggestions only. A reviewer must inspect the
actual pixels to establish that the image depicts the correct building and useful exterior.
Usually one or two useful views plus the standard viewer map controls are sufficient to start;
request more evidence for a specific unresolved feature, not a blanket photography campaign.
An accepted set is permission to start authoring, not certification of every unseen elevation.

```sh
node content/worldgen/source/qualla-structures/prepare-batch.mjs --qualla ../qualla-internal
node content/worldgen/source/qualla-structures/prepare-batch.mjs --qualla ../qualla-internal --check
```

During migration, add `--ids=watergate_complex,brandenburg_gate` to prepare only
selected local models. This preserves other models' reference records while still
checking the whole fixed batch against other-device reservations.

Set `references` to selected Qualla-relative originals and `referenceSelection` to `manual`.
Use `needs-replacement` with an empty list to prevent rejected suggestions from returning.
`referenceFolders` can point to explicitly inspected canonical media folders when merged
article links are stale. After viewing the images, record the evidence file's `inputHash`,
reviewer, date, decision and observations in `batches/reference-reviews.json`. An `accepted`
review requires at least one selected image; insufficient evidence remains `needs-reference`.
Changed selected bytes, attribution, story text, scope, era or reference notes invalidate
acceptance. Changed model-registration status refreshes the report without invalidating the
photographic review. Unchanged runs write no files.

The first five pilot source bundles contain individual recipes, an attributed `map-frame.json`,
a selected-reference snapshot, model specifications and a reproducible GLB. The source map
controls were extracted from the standard Protomaps 20261008 archive at zoom 15, merging
pieces split across tile boundaries before selection. These are generalized controls rather
than a survey. Coordinates, headings and known scope discrepancies remain explicit. The
original photographs stay in Qualla and are not redistributed in model packs.

The [pilot review](batches/PILOT-REVIEW.md) records the remaining work. The first five are complete. For a targeted example, build, import and check
these models by their ordinary structure IDs:

```sh
node packages/worldgen/scripts/generate-authored-places.mjs --ids=lorraine_motel,fords_theatre,anne_frank_house,brandenburg_gate,watergate_complex
node packages/worldgen/scripts/generate-authored-places.mjs --ids=lorraine_motel,fords_theatre,anne_frank_house,brandenburg_gate,watergate_complex --check
node packages/worldgen/scripts/import-next-1000-models.mjs --ids=lorraine_motel,fords_theatre,anne_frank_house,brandenburg_gate,watergate_complex
node packages/tooling/scripts/generate-landmark-lods.mjs --ids=lorraine_motel,fords_theatre,anne_frank_house,brandenburg_gate,watergate_complex --concurrency=2
node packages/tooling/scripts/check-medium-fi.mjs --ids=lorraine_motel,fords_theatre,anne_frank_house,brandenburg_gate,watergate_complex --strict
node packages/worldgen/scripts/capture-next-1000-models.mjs --ids=lorraine_motel,fords_theatre,anne_frank_house,brandenburg_gate,watergate_complex --reflections --antialias --fit-shadows
node examples/world-explorer/test/visual/capture-landmark-library.mjs --ids=lorraine_motel,fords_theatre,anne_frank_house,brandenburg_gate,watergate_complex --reflections --adaptive-clipping
```

Inspect current images and bind observations in each bundle's `qa.json` to its input and capture
hashes. A model remains a draft until photographic fidelity, shared materials, detail levels,
footprint, heading and real terrain contact pass. Geographic proposals do not activate models
or suppress existing map buildings. After a meaningful batch, refresh the structure and
authoring indexes, scan the stories again, and synchronize Qualla as documented above.

The reference workflow, scan/resume behavior and catalog synchronization have isolated tests:
`node --test content/worldgen/source/qualla-structures/*.test.mjs`.

## Completing the fixed local 100

The active production goal is the fixed `batches/qualla-001.json` inventory, with the five
pilots completed before starting the remaining 95. [Completion progress](batches/PROGRESS.md)
is generated by `progress.mjs` from current source, runtime, reference, capture and placement
evidence. A draft or imported GLB never counts as complete. Every next-1,000 candidate and
collection member remains assigned to the other device, including already imported entries.

Each recipe is independent so later model edits do not invalidate earlier completions.
Finish each model through story synchronization in the same authoring cycle. For subsequent
batches, select eligible targets beyond the next-1,000 reservations with usable public-domain
references before authoring: start with cleared Qualla images, reuse saved source decisions,
and park uncertain sources after a bounded search without repeatedly reopening the same gap.
Work in groups of 10–20 fully completed models rather than accumulating unfinished imports.
Keep the fixed first-100 inventory intact while resolving its remaining blockers.

For the next batch, maintain a queue of 10–20 targets whose usable public-domain references,
building identity, scope and viable map/ground placement have been checked before construction.
An article's inclusion in the backlog alone is not enough to start its model. Keep one model
under construction at a time; preparing references for another target may proceed separately.
If a target needs unresolved source research or ground data, record the exact gap and move it
out of the production queue. Resume that research only when new evidence or a new approach
is available. This does not remove any target from the fixed first 100.

Set the acceptance brief before construction: correct scale, footprint, heading and ground
contact; recognizable massing, roof and defining facade details; coherent shared materials;
and working runtime detail levels. Apply the medium-fi standard at the intended viewing
distances. Record reasonable approximations for unseen, non-defining details rather than
requiring a photographic survey of every surface. A missing defining feature or an observed
geometry, material or placement defect still requires a fix. Reuse stable geometry helpers
and existing evidence infrastructure; avoid a new bespoke review system for each structure.

Close construction, focused visual review, catalog readiness and story synchronization before
starting the next model. Count completed, synchronized models as production throughput. Batch
closure performs aggregate consistency and reproducibility checks only; it must not create a
second queue of per-model artistic approvals. Additional renders or tests need a specific
uncovered risk, changed rendered input or observed failure.

Shared geometry helpers are fingerprinted in generated specs. Keep source-local Qualla
references, map controls and declared limitations beside each model. For a selected existing
source bundle, `node examples/world-explorer/scripts/build-qualla-terrain-evidence.mjs
--ids=QS-...` preserves unmodified public host-terrain samples; `--offline` reuses its ignored
cache. The saved numeric grid and PNG16 heightfield are source inputs. This is a terrain
compatibility review, not surveyed building elevations.

After fixing geometry, regenerate/import only that model and its four runtime detail levels.
Inspect portable, shared-material/placement and medium-fi context/transition images. Record
manual findings in source-local `qa.json`; run `progress.mjs` to validate the evidence before
marking the batch entry `completed`. Update its story annotations through the bounded
`sync-completed.mjs` path below, and check idempotence. Reserve the full `scan.mjs` and
`sync-qualla.mjs` reconciliation for corpus updates. Rejected or stale evidence leaves explicit
blockers in the completion ledger.

Closed models retain their inspected evidence until a relevant rendered input changes, a
supporting reference becomes invalid, or a concrete failure is found. Naming and metadata
corrections do not by themselves justify another visual review. Batch closure checks catalog
consistency and source reproducibility; it is not a second artistic review of every model.

For an individual completed local model, use
`node content/worldgen/source/qualla-structures/sync-completed.mjs --ids=stowe_house --write`,
then repeat with `--check`. This explicitly selected completion path revalidates current
source/runtime/capture/placement evidence and the selected original image bytes. It verifies
story identity, semantic hash and catalog location, then adds or updates only the selected
ready associations through Qualla's locked transaction. Other associations, curation and
inactive history are preserved. No association is retired through this path. Changed stories,
relocations, duplicates, conflicting annotation ownership and incomplete models fail closed.
It can proceed when an unrelated catalog bundle is malformed, because only bundles containing
a selected story identity are parsed; corruption in a relevant bundle still blocks that story.
The full scanner and `sync-qualla.mjs` retain their corpus-wide freshness requirement and remain
responsible for withdrawals and global reconciliation. A successful bounded completion sync
does not certify that the complete corpus scan is current.

`batches/readiness.json` is the local batch's readiness export; the scanner also reads the
separate next-1,000 ledger. Neither process transfers model ownership. Capture archives remain
local/ignored, and story annotations record catalog readiness rather than claiming a new
independent editorial certification.

## Ordinary structure identities

The work batch is **Qualla compat**. Structures use ordinary names in the shared geographic
catalog: `places/gc/gcq/chatsworth_house`, `molen.worldgen.structure.chatsworth_house`,
`chatsworth_house` for targeted model commands, and `structure-chatsworth-house.mjs` for its
recipe. The same convention applies to all 100 reserved `sourceKey` / `modelIdentity` values.
No batch prefix belongs in a source/runtime folder, asset ID, placement ID, recipe or scene
name. `QS-…` remains an article-backlog target ID only, separate from model identity.
Qualla story links, image provenance and batch bookkeeping remain explicit metadata.

The [identity migration](batches/naming-migration.json) records the old/new mapping and
byte-identical source/runtime/detail-level verification. Prior inspected capture pixels were
retained after verifying unchanged render inputs; reports explicitly identify this as a
metadata rename, not new visual inspection. The naming change does not approve Majapahit’s
unresolved terrain fit. Use `migrate-model-names.mjs --write` once (or resume it) to update
existing Qualla annotations through locked, idempotent catalog transactions, followed by the
normal scan/sync workflow.
