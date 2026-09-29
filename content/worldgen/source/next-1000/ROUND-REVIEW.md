# Structure creation round review

Snapshot: 28 September 2026. Authoring is paused at the owner's request so this round can be
reviewed and stabilized. The remaining candidates and unfinished studies are preserved.

After this snapshot, the [geographic source migration](../places/README.md) corrected three
stale asset aliases, recovering already-existing models N0654, N0681 and N0682. The live
[progress ledger](PROGRESS.md) now reports 220 authored models and 161 complete; the figures
below retain the original round-closeout snapshot. No additional models were created.

## Results

| Stage | Count |
| --- | ---: |
| Candidates in the next-1,000 inventory | 1,000 |
| Authored and imported models, with current hashes verified | 217 |
| Passed portable visual review | 215 |
| Passed shared-material review | 212 |
| Active geographic previews | 209 |
| Passed recorded geographic review | 186 |
| Passed maximum exterior fidelity review | 189 |
| Passed every current completion check | 158 |
| Authored models with remaining checks or corrections | 59 |
| Candidates without an authored model | 783 |

These are counts for the next-1,000 project. The earlier 100 site structures, 120 procedural
building styles, and reusable windmill/turbine assets are separate. Collections can require
several models: the Seven Sisters candidate declares seven independent buildings, with none
yet authored. A collection is complete only when every required member is complete.

The [gallery](gallery.html) shows the results; [PROGRESS.md](PROGRESS.md) and the
[readiness ledger](../../../earth/structures/readiness.json) remain the authoritative current
status. This review is a dated snapshot. A passing fidelity review means the current exterior
met the recorded brief and inspected views. It does not imply a survey, a scanned replica,
finished interiors, or that every geographic review used real elevation data.

### Representative results

| Model | What was built | Current qualification |
| --- | --- | --- |
| [Pont de Tolbiac](../places/u0/u09/n0028_pont_de_tolbiac/README.md) | Five unequal masonry vaults, cutwaters, coursed soffits, dentil cornices and open stone balustrades | All checks passed, with an IGN terrain-supported placement review |
| [The Shard](../places/gc/gcp/n0141_the_shard/README.md) | Independent glass planes, facade subdivisions and exposed crown | All current checks passed |
| [Bank of America Plaza, Atlanta](../places/dn/dn5/n0207_bank_of_america_plaza/README.md) | Stepped red-granite body, recessed portals, west gallery and open crown | All current checks passed; small dimensions remain reconstructed |
| [Parken Stadium](../places/u3/u3b/n0707_parken_stadium/README.md) | Asymmetric stands, corner offices, canopies and thirteen parked roof girders | All current checks passed; a static exterior with reconstructed local details |
| [Poniatowski Bridge](../places/u3/u3q/n0029_poniatowski_bridge/README.md) | Detailed spans, pylons, towers, stairs, ornamental railings and tram infrastructure | Visual, shared-material and fidelity checks passed; geographic completion remains blocked |

## How these models are built

1. **Resolve the identity.** Match the candidate's Wikidata identity to the actual building or
   bridge. Record historical state, collections, map features, and ambiguous identities before
   modeling. A reference coordinate alone is insufficient.
2. **Write an evidence-backed specification.** Primary descriptions and photographs supply
   overall dimensions and distinctive architecture. Mapped footprints and deck/pitch axes
   supply plan geometry. Published measurements and reconstructed details are recorded
   separately in `spec.json`, research notes, and source attribution.
3. **Author editable geometry.** JavaScript component recipes generate original glTF geometry:
   structural members, arches, facade bays, openings, stairs, roofs and local detail. Family
   generators reuse geometric operations while individual recipes establish each silhouette.
   Metric UVs and named surface references connect models to the central material library.
4. **Import and register.** The import pipeline creates the canonical runtime GLB and sidecar,
   checks bounds and hashes, and registers the asset. Optimization is chosen per model to
   protect thin structural elements. Placement records specify anchor, signed axes, heading,
   elevation policy and relevant map replacement geometry.
5. **Render and inspect.** Portable GLB views, shared-material views, authored detail cameras
   and geographic fixtures have separate reports. Source/runtime hash changes invalidate model
   approvals; shared review also checks specification/material hashes and geographic review
   checks the placement hash. Metadata-only specification edits do not invalidate every section.
   Flat map overlays and terrain-backed evidence are distinguished in the individual reports.
   Terrain report hashes preserve evidence but are not independently revalidated by the readiness
   gate. Terrain passes apply to the recorded provider, vertical datum and host sampling contract,
   not arbitrary DEMs: Tolbiac requires NGF-IGN69 heights or conversion, and Sanjō requires the
   cross-tile sampling contract.

This is reproducible procedural authoring guided by research and visual inspection. Geometry
detail, triangle count and number of screenshots are useful diagnostics; none alone establishes
architectural accuracy. The source recipes, references and explicit limitations are part of the
deliverable, alongside the GLBs.

The strongest parts of this approach are editable original geometry, reusable materials, and
separate visual/site checks: the Poniatowski approach mismatch was caught after its standalone
model already looked complete. The expensive parts are per-building research, bespoke component
recipes, repeated close-up inspection, and very large meshes. Scaling the remaining inventory
should improve those tools and introduce runtime budgets before simply increasing production.

## Shared surfaces and runtime cost

The [shared material library](../material-library/README.md) supplies **65 reusable surfaces**
with consistent metric scale. Portable GLBs retain fallback PBR materials; selected cutout surfaces
also need portable alpha images. The runtime resolves named surfaces through shared material
graphs. The refreshed [texture audit](../material-library/texture-audit.json) covers 647 GLBs
across all worldgen content, counting source/runtime copies separately: all have vertex colors,
436 reference shared surfaces, and eight embedded image records represent four unique cutout
fallback images totaling only 16,514 embedded bytes. There is no large duplicated photograph
library to extract from these models. Unique artwork can remain model-specific when needed.

The viewer currently prepares registered style-pack surfaces after its first frame and keeps
their textures until viewer disposal. Evicting a model releases its geometry and private
fallback materials; it does not evict shared library textures. Surface demand loading and a
bounded texture cache remain future work.

The 217 runtime GLBs total **8,786,541,436 bytes (8.18 GiB)** and **100,514,628 triangles**.
These are aggregate file/mesh counts, not measured live GPU memory. Spatial selection and
regional packs prevent loading the whole collection for one view, but one nearby large model
can still be expensive:

| Model | Runtime triangles | Runtime GLB, decimal MB |
| --- | ---: | ---: |
| Munich Olympic Stadium | 4,116,886 | 345.7 |
| Haghtanak Bridge | 3,448,236 | 324.4 |
| Poniatowski Bridge | 3,326,408 | 282.2 |
| Great Bridge of Hrazdan | 3,082,666 | 272.0 |

Keep these detailed masters. Before broad deployment, derive distance-appropriate models,
reduce repeated geometry with instancing where practical, and measure decode/upload/frame time
and memory during camera movement. Shared textures alone cannot solve the geometry cost.

## Cleanup completed in this closeout

- Froze new authoring. N0030 Pivnichnyi Bridge remains a documented draft, excluded from the
  active generation list and completion counts. N0708 MetLife Stadium remains research only;
  the separately listed MetLife skyscrapers have been authored.
- Reconciled catalog documentation with hash-bound progress and corrected stale model
  descriptions and generator instructions.
- Stabilized collection identity handling so independently located buildings cannot become
  one composite placement or be marked complete after importing only one member.
- Corrected a signed map-axis evidence parser to accept the documented `basis` form without
  weakening orientation requirements.
- Replaced stale hard-coded catalog counts and pack hashes in tests with catalog consistency
  and serialized-versus-concurrent loading checks.
- Reworked tooling pack fixtures to retain all shipped catalog documents in a bounded real
  directory/ZIP pair, so metadata and procedural-bake tests do not load unused landmark binaries.
  The six focused tests pass without increasing the failing helper tests' timeouts.
- Completed missing source-manifest document lists for Avicenna Mausoleum and Watts Towers;
  the source gate now verifies all 549 logical bundles.
- Regenerated stale entity script copies, fixed formatting issues, and corrected landmark
  generation to format its own JSON even when generated outputs are excluded from bulk formatting.
- Preserved source masters, runtime assets, references and review evidence. No Git history was
  changed and no unfinished model was promoted merely to raise the completion count.

## Remaining work and recommended next round

1. **Close the 59 authored models' recorded blockers first.** Poniatowski's real-terrain check
   exposes adjoining roads roughly eight meters below the bridge ends. A future fix must raise
   topologically connected approaches while leaving roads crossing beneath the bridge alone.
   Other models have unresolved orientation, terrain/datum, extent or fidelity reviews; the
   ledger lists each blocker.
2. **Establish a runtime budget and level-of-detail pipeline.** Validate cold load, small camera
   rotations, traversal, cancellation, cache reuse and eviction with representative heavy sites.
   Avoid interpreting detailed masters as automatically suitable for interactive city views.
   Also consolidate hosted pack delivery: the current site staging copies sample-local archives
   as well as the central pack directory, so deployment size exceeds the unique archive total.
3. **Consolidate the authoring and review tools.** Promote useful one-off capture/evidence
   helpers into maintained commands, share geometric utilities, and keep source specifications
   as the place for facts and reconstruction assumptions. Generated documentation should link
   to the ledger rather than maintain competing status claims.
4. **Resume candidate expansion after that review.** Keep unresolved historical identities and
   collections explicit, then choose a bounded next batch with agreed reference quality and
   acceptance criteria. The remaining 783 candidates have not been modeled.

## Verification and local delivery

The frozen local viewer snapshot passed archive and real-loader validation:

- 84 indexed packs: 80 model archives plus worldgen core, entities, earth and sky.
- All-worldgen model archives total 2,203,139,002 compressed bytes (2.05 GiB); the core is
  194,950 bytes. These include older worldgen assets as well as the next-1,000 work.
- All 325 model routes/sidecars and 65 material graphs resolve to the current content. All
  1,042 decoded archive members passed CRC and SHA-256 checks, with archive filename hashes
  and content hashes verified. Research/source bundles are excluded.
- Real loader startup made five requests totaling 640,178 bytes and fetched no model archive.
  Requesting Space Needle and Atlanta's Bank of America Plaza fetched only their Seattle and
  Atlanta archives, with HTTP 206 responses. No Chicago model archive was fetched.
- The local Vite server still mishandles suffix ranges; the shipped reader's numeric-tail retry
  succeeded, and explicit byte ranges matched disk. This checks data routing, not interactive
  frame time or GPU memory under sustained traversal.
- Older unreferenced archives remain for already-open viewers: 31 files totaling 868,464,332
  bytes. A clean deployment should contain only files referenced by its frozen index. No
  deployment or remote publication was performed.

The packaged smoke check passed for 15 tarballs, 43 exports and seven scaffolded templates.
Windows required a local launch adapter that invokes the installed npm, pnpm and Molen JavaScript
entry points through Node instead of attempting to execute their `.cmd` shims directly. The
repository release scripts are unchanged.

Current gate results:

- Repository lint, full build, all package typechecks, source-bundle checks and schema-doc checks
  passed during `pnpm verify`.
- That command then reported 24 passing packages and two tooling helper-test timeouts. After
  the bounded fixture correction, the complete tooling unit suite passed (175 tests/27 files),
  as did its typecheck and Biome check. The full root command has not been rerun after that
  test-only correction.
- `pnpm audit:prod` passed separately with no known vulnerabilities.
- `pnpm docs:site:check` passed; the site and local examples also built successfully.
- The current readiness ledger passed `build-structure-readiness.mjs --check`; texture audit
  regeneration was byte-identical and preserved all model and reviewed material-graph hashes.
- `pnpm test:golden` passed with the CI setting `MOLEN_SKIP_WEBGPU=1`. This includes all nine
  world-explorer visual test files (ten passing tests, two WebGPU cases skipped) and the final
  Earth-view smoke tests. No image baselines were changed.
