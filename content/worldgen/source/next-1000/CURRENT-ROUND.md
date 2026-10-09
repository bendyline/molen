# Current structure round — paused

Updated 2026-10-09. The 1,000-candidate project remains paused. This checkpoint prepares the
next round; it does not authorize resuming generation or advancing to another building.

## One selected building

| Field | Value |
| --- | --- |
| Candidate | **N0309 — Haapsalu Castle**, Estonia |
| Identity | Q866154; mapped castle node 687056785, with separately attributed church, museum and wall controls |
| Asset | `molen.worldgen.structure.n0309_haapsalu_castle` |
| Source | [Haapsalu source bundle](../places/ud/ud2/n0309_haapsalu_castle/source.json) |
| Recipe | [haapsalu-castle-model.mjs](../../../../packages/worldgen/scripts/haapsalu-castle-model.mjs) |
| Target | [Medium-fi](../../../../docs-src/guide/medium-fi.md), shared architectural surfaces, four browser LODs |
| Current disposition | **Unfinished draft. No visual, geographic or fidelity approval.** |
| First action after explicit resume | Rebuild only N0309 from the current recipe, import it, and generate its four runtime LODs |

The scope is the present exterior: cathedral and its side roofs/baptismal chapel, clock tower,
roofless upper main-castle walls and rooms, modern entrance pavilion and folded walkways,
outer curtain walls and defensive tower remains. Historical roofs, museum exhibits, surrounding
city buildings and vegetation are outside this model's declared scope.

## Exact checkpoint

- Editable source includes the separate entrance-side wall added immediately before the pause.
  That change **has not been generated or imported**.
- Existing master: 4,905 triangles, 592,800 bytes,
  `sha256:9b2a71df21b1d1dc6034808c35f4ec8c5ef91b00833b40daba5c5dfc2b5c4036`.
- Existing imported master: 592,168 bytes,
  `sha256:d88b88eae83a09a620488823e08b028a9165ad55de265638f9b7ea6c51936f88`.
  It matches that existing source master, rather than proving that today's recipe has been built.
- **No four runtime LOD files or `runtimeLods` registration currently exist** in the asset folder.
  Earlier tests built four levels in memory. That did not establish shipped LOD outputs.
- Twelve portable PNGs exist and match the older master. Their input fingerprint differs from
  today's authoring inputs. They are stale for the next review.
- Shared-material and medium-fi capture reports, `qa.json` and a geographic placement entry
  have not been finalized. Actual terrain contacts, ruin profiles, pavilion proportions,
  stair attachments and facade fit remain unresolved.
- Seven focused tests passed before the pause. This is historical evidence of those checks,
  not a completion claim and not an answer to an unidentified visual report.

## Completion checklist for this round

Every unchecked item requires evidence. Record the relevant hashes, commands, inspected views
and remaining limitations in the bundle. Keep the model incomplete when a requirement fails.

- [x] Identify exactly N0309 and preserve original editable source and attributed references.
- [ ] Review current-source geometry against the references: all declared buildings/walls,
  continuous cathedral/chapel/side roofs, open upper ruins and courts, clear entrances, and
  supported stairs. Confirm pavilion and ruin proportions. Distinguish present-day ruin gaps
  from missing faces; do not use a passing test count as visual approval.
- [ ] Generate/import only N0309. Verify source/spec/manifest/runtime hashes and catalog
  registration. Register every owned source document and final render in `source.json`.
- [ ] Generate and register skyline, district, street and closeup files. Verify actual file
  hashes, current recipe fingerprint, separate vertex streams, material bindings and budgets
  of 1,000 / 4,000 / 16,000 / 64,000 triangles. Initial landmark download must fit 3 MB on
  phones and 6 MB on ordinary laptops. Record draw calls and memory estimates.
- [ ] Validate the changed geometry and meaningful roof/opening/contact checks. Run targeted
  source reproduction and import checks. Validate all six GLBs. Reuse current package builds.
- [ ] Capture and inspect all current portable, shared-material and medium-fi views. For the
  present seven QA cameras, the expected sets are 12 / 11 / 24 frames. Review close details,
  all four LODs, distance/light/quality views and transitions. Confirm five shared surface
  graphs use metric UVs, stable tints and shared cache reads; inspect unload/disposal telemetry.
- [ ] Verify location, signed orientation, mapped component fit, declared vertical datum and
  actual terrain contacts in the viewer. Show roofs, entries, courts, walls and stair landings
  without floating or burial. Record reviewed placement hashes before activating placement
  or enabling footprint replacement.
- [ ] Record hash-bound visual/shared/medium-fi/geographic/fidelity decisions in `qa.json`;
  refresh the readiness ledger and galleries. Preserve any unresolved limitation explicitly.
  Report physical-device performance as pending until measured; software captures alone do
  not prove laptop/phone frame rates.

## Round boundaries

1. Start a round by naming its one candidate, title, source path, precise remaining work and
   required evidence. Read this checkpoint before selecting from `NEXT-300.json`.
2. Work on that building until the declared checks pass or a concrete unresolved blocker is
   recorded. A draft is progress, not a completed landmark. End the round with its exact state;
   do not silently switch to another candidate to bypass unfinished work.
3. Change checkboxes only after inspecting their evidence. Preserve masters and user edits.
   Do not rebuild unchanged models or run npm audits/full engine CI for model-only iteration.
4. Treat automatic goal continuations as continuations of this selected round. They are not
   answers to questions or approval to resume a paused goal.
5. Ask about missing visual details once, linked to an identified candidate/view. Keep an
   unanswered report in the separate issue below. Do not carry its question into every model
   update or guess a different castle.
6. End with: exact ID/title, files changed, current source/runtime/LOD state, inspected evidence,
   completion decision, blockers and next action. Select the next building in a new explicit
   round record only after this round's state has been reconciled.

## Separate unresolved visual report

The user's earlier “part of that building is missing” report has **no confirmed building or
section**. It is not assigned to Haapsalu, Leeds, Turku or São Jorge. One clarification is
pending; do not repeat it automatically. Individual geometry fixes and terrain diagnostics
must not be reported as resolving that unnamed issue. Investigation resumes when the human
identifies the building/view or supplies a screenshot.

## Corpus reconciliation

See [STATUS-RECONCILIATION.json](STATUS-RECONCILIATION.json) for the 2026-10-09 audit and
[PROGRESS.md](PROGRESS.md) for the regenerated candidate ledger. These counts cover the
next-1000 plan, excluding the earlier site-structures pack, reusable category models and
procedural styles.

| Status | Count | Interpretation |
| --- | ---: | --- |
| Candidates | 1,000 | Full scope retained |
| Existing source and imported models | 319 | All source-manifest/import hashes match the existing files |
| Without source models | 681 | Still to author |
| Existing ledger approvals marked ready | 106 | Includes legacy fidelity approvals; not a new medium-fi certification |
| Current registered runtime LOD sets | 241 | Other sets have 77 stale recipe fingerprints and one missing set |
| Source-spec hash discrepancies | 134 | Spec metadata differs from existing masters; investigate before finalization |
| Portable captures with stale authoring inputs | 108 | Cannot serve as current input-bound review evidence |
| Capture/model built-byte discrepancies | 276 | Investigate separately; byte differences alone do not revoke input-bound approvals |

Fourteen existing ready records also pass this audit's spec/integrity and current-LOD checks.
That intersection is **not a new complete-model count**. The audit did not generate models,
prove a clean source rebuild, inspect all images, certify geographic fit, or measure devices.
The current authoring-input policy deliberately survives byte differences from rebuilding
unchanged inputs. Do not erase prior approvals or label geometry corrupt solely from that
byte discrepancy; preserve the report and resolve the source of the differences.

Broader corpus cleanup is a separate planned batch after the pause: reconcile stale spec
metadata and LOD fingerprints, then investigate capture-byte differences. Haapsalu remains
the only selected production round.
