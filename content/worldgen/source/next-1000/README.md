# Next 1,000 significant structure candidates

This is a **candidate inventory**, not a claim that 1,000 finished GLBs are ready for Earth
placement. [Browse the searchable gallery](gallery.html) or use the machine-readable
[catalog](candidates.json). **Authoring is paused for the user-requested results review and cleanup.**
The all-1,000 scope remains recorded; see [round review](ROUND-REVIEW.md) for the current summary.
No unfinished candidate is counted as complete. The generated
[production progress](PROGRESS.md) lists current imports, visual and shared-material reviews,
geographic approvals and completed models. It updates from the current model/report hashes;
an imported model is not automatically a completed replica.
The first 100 site structure assets and 120
resizable procedural building styles are separate from this list.

Model sources now live under `../places/<geohash2>/<geohash3>/<model-key>/`.
Use the [canonical source gallery](../places/gallery.html), [layout guide](../places/README.md)
or [source index](../structure-index.json) to find them. This folder retains the candidate
inventory, research snapshots and production history. After authoring a new bundle, run
`node packages/worldgen/scripts/index-structure-sources.mjs` before import or capture.

## Collections of separately located buildings

[collections.json](collections.json) records required independent members for candidates such as
N0208, the Seven Sisters. Its seven exact building identities each need their own source GLB,
map frame, runtime asset, geographic placement and current visual/fidelity reviews. **The seven
members are declared but their source models have not been authored.** There is no composite
model or placement at the collection's reference coordinate.

The production commands accept a member ID such as `--ids=N0208_MSU`; `--ids=N0208` selects
the currently authored members of that collection and fails when none exist. Importing one
member never completes the collection. The readiness ledger requires all seven and retains
each member's exact blockers. Existing named identities must be reused rather than duplicated.
Ordinary spatial queries select nearby member assets independently, so selecting one location
does not load the other six buildings. The gallery displays individual member previews when
they become available.

## Selection method

The pinned [Wikidata snapshot](wikidata-snapshot.json) contains only CC0 structured facts:
entity ID, English label, direct instance class, reference coordinate, and sitelink count.
[Wikidata's reuse policy](https://www.wikidata.org/wiki/Wikidata:Reuse) permits CC0 reuse.
`fetch-next-1000-candidates.ps1` collects up to each class quota plus 100 spare records from
the public SPARQL service. `refresh-next-1000-candidates.mjs` chooses the highest-sitelink
records with coordinates, de-duplicates Wikidata identities, and excludes normalized titles
from the existing 100-model plan. A small explicit exclusion list removes known routes,
demolished landmarks, umbrella institutions, and sensitive memorial sites from automatic
promotion. Sitelinks are a rough visibility proxy, **not** an
architectural-quality score. Stable `N` IDs and existing model status survive a refresh.

| Class | Candidates | Class | Candidates |
| --- | ---: | --- | ---: |
| Bridges | 135 | Skyscrapers | 100 |
| Castles | 90 | Cathedrals | 85 |
| Mosques | 75 | Temples | 75 |
| Towers | 75 | Lighthouses | 45 |
| Stadiums | 55 | Museums | 55 |
| Railway stations | 50 | Dams | 50 |
| Palaces | 55 | Monuments | 55 |

These 14 quotas sum to 1,000. Each record has a Wikidata URL, identity, category, reference
coordinate, visibility score, implementation status, and optional model reference. Source
coordinates are **not surveyed anchors**. Wikidata classes contain broad sites, institutions,
historical structures, and occasional misclassifications; each target needs an editorial and
map-feature review before it receives production modeling time. Names can also be shared by
different structures; the Wikidata ID is the identity key. The catalog intentionally carries
no third-party images, mesh files, or copied descriptions.

## Source masters and current status

Editable place bundles live under `source/places/<geohash2>/<geohash3>/<key>/`.
The [geographic gallery](../places/gallery.html) groups all registered bundles by region and
keeps reusable assets separate. [The source index](../structure-index.json) resolves stable
asset keys to their pinned folders; the next-1,000 catalog and this gallery retain their URLs.
After authoring a new bundle, run `node packages/worldgen/scripts/index-structure-sources.mjs`
before import or capture. Folder anchors organize sources; runtime placements and approvals
still come from the Earth structure catalog.

The generated [production progress](PROGRESS.md) and
[readiness ledger](../../../earth/structures/readiness.json) are the current status sources.
They count imports, current hashes, reviewed captures, placements and exterior fidelity
separately. Triangle counts and exact limitations live in each current source/import/QA report;
this README does not maintain a second set of counts.

The original studies and their subsequent rebuilds remain individually inspectable:

| ID | Target | Editable source and reports |
| --- | --- | --- |
| N0001 | Stari Most | [source bundle](../places/sr/srs/n0001_stari_most/README.md) |
| N0136 | Willis Tower | [source bundle](../places/dp/dp3/n0136_willis_tower/README.md) |
| N0561 | Galata Tower | [source bundle](../places/sx/sxk/n0561_galata_tower/README.md) |
| N0796 | Tokyo Station | [source bundle](../places/xn/xn7/n0796_tokyo_station/README.md) |
| N0946 | Stonehenge | [source bundle](../places/gc/gcn/n0946_stonehenge/README.md) |

Each detailed source folder carries its brief, primary references, `spec.json`, source GLB,
hash manifest and lit Molen scene. Capture reports list the actual lit preview, four neutral
turntable views and authored near/far detail cameras; additional shared-material and terrain
reports apply where recorded. Older studies may have fewer views. Imported sidecars and
canonical GLBs are in `content/worldgen/assets/`, registered in `project.json` and the style
pack. Import optimization is controlled per asset to preserve thin or detailed geometry.

## Detailed exterior authoring

Bridge examples include [Pont de Normandie](../places/u0/u0b/n0002_pont_de_normandie/README.md),
[Gamla bron](../places/u7/u7q/n0003_gamla_bron/README.md),
[Severn Bridge](../places/gc/gcn/n0005_severn_bridge/README.md), and
[Skopje's Stone Bridge](../places/sr/srr/n0004_stone_bridge_in_skopje/README.md).
Their individual bundles retain structural dimensions, deck/support/cable geometry,
reconstructed details and current geographic limitations. A detailed mesh alone does not
certify road continuity, terrain contact or completed visual review.

Two separate [reusable map models](../map-structures/) provide a traditional smock windmill
and modern wind turbine. The Earth pack contains explicit rules for supported map tags and
classes. These generic models are additional assets, not replacements for named candidates.

## Examples of distinctive landmark geometry

| ID | Model | Distinctive authored geometry |
| --- | --- | --- |
| N0140 | [Shanghai World Financial Center](../places/wt/wtw/n0140_shanghai_world_financial_center/README.md) | Curved taper, trapezoidal opening and curtain-wall bays |
| N0141 | [The Shard](../places/gc/gcp/n0141_the_shard/README.md) | Independent glass planes, facade panels and exposed crown |
| N0144 | [Oriental Pearl Tower](../places/wt/wtw/n0144_oriental_pearl_tower/README.md) | Spheres, three columns, inclined supports and observation bands |
| N0562 | [Maiden Tower](../places/tp/tp5/n0562_maiden_tower/README.md) | Asymmetric buttress, recessed slits and stone bands |
| N0564 | [Gonbad-e Qabus](../places/tn/tnx/n0564_gonbad_e_qabus/README.md) | Ten brick flanges, tapered shaft, cone and cornices |
| N0575 | [Ka'ba-ye Zartosht](../places/tj/tjm/n0575_ka_ba_ye_zartosht/README.md) | Measured stone tower, false windows, dentils and access flight |
| N0637 | [Tower of Hercules](../places/ez/ezd/n0637_tower_of_hercules/README.md) | Helical band, recessed openings and octagonal stages |
| N0641 | [Kõpu Lighthouse](../places/u6/u6r/n0641_kopu_lighthouse/README.md) | Massive buttresses, upper shaft, lantern and gallery |
| N0643 | [Kiipsaare Lighthouse](../places/u6/u6r/n0643_kiipsaare_lighthouse/README.md) | Leaning shaft, worn paint and open lantern framing |

Each uses the canonical shared surface library with metric UVs, plus portable GLB fallback
materials. Sources retain measured facts separately from reconstructed details. The normal
Molen capture report and the additional shared-material report bind their images to current
model hashes. The latter also checks geographic transforms, local-only asset loading, one
read per material graph, and geometry release after eviction. Its north-up view overlays
cached OSM outlines on flat test terrain; it does not certify the host's DEM or site slope.

Each `qa.json` records acceptance or pending work against exact model/report hashes. Historical
identities, including Dharahara, remain explicit rather than silently adopting a replacement
building. Date-limited historical placements require an explicit viewer date; they are excluded
from the default current world.

Generate the new batches with `generate-signature-towers.mjs`, `generate-heritage-towers.mjs`
and `generate-lighthouse-models.mjs` in `packages/worldgen/scripts/`; each supports `--check`.
The serialized `import-and-register-next-1000.mjs --ids=...` wrapper verifies imports and
records explicit geographic proposals without treating them as completed site reviews. The [shared rendering runner](../../../../examples/world-explorer/test/visual/landmark-library.md)
captures selected batches without preloading distant models.

The [readiness ledger](../../../earth/structures/readiness.json) covers all 1,000 candidates,
with source facts, OSM geometry evidence, source/runtime hashes, current-world identity
concerns, captures and remaining blockers. Its [evidence guide](../../../earth/structures/EVIDENCE.md)
defines the review contract. A reference coordinate or undirected footprint axis does not
establish a model's front, origin or elevation. Historical, underground and unsuitable
identities remain visible with recommendations; they have not silently been replaced.

The viewer retains original glTF UVs, textures, material groups and PBR properties. Assets
load on demand for resident tiles and shared resources are released after the last consumer.
Extended static models retain material groups and interpolated UVs when clipped across tiles.
Map-driven matching preserves the procedural fallback when an asset fails to load. Map
providers must actually supply a supported classification or tag for category selection;
the runtime cannot recover omitted OSM fields from a stripped vector tile.

## Production path when authoring resumes

1. **Review candidate identity and map coverage.** Confirm that the item is a present-day
   physical structure or a deliberately historical layer. Resolve complexes into actual
   buildings with their own identities; retain historical or unsuitable entries explicitly. Match an OSM or
   terrain-package feature by stable source ID first; verify names, geometry and location
   before using an alias.
2. **Rank by viewer impact.** Promote structures visible in supported terrain packages and
   skyline/road viewpoints. Evaluate category, regional coverage, silhouette uniqueness,
   repetition frequency, and whether a procedural style already conveys the structure.
   Use sitelinks only as a secondary signal.
3. **Author bounded, individually reviewed batches.** Give each target a measured brief,
   original editable source, GLB, sidecar, preview and near/far visual QA. Finish concrete
   defects before expanding the queue. Measure frame cost and add levels of detail where
   needed; long structures also need tile clipping and terrain/road continuity checks.
   Keep site-specific art distinct from resizable procedural styles.
4. **Segment delivery.** Keep candidate metadata outside runtime packs. The sample and docs
   staging path uses a small shared-style core and bounded geographic model archives with
   lazy member routing. Serve HTTP byte ranges and verify host fetch routing. Measure actual
   download, decoded GPU memory, draw calls and generation time before publishing a snapshot.
5. **Connect geographic placement.** Use the shipped Earth structure catalog and conservative
   matching described in the [world-viewer guide](../../../../docs-src/guide/earth-view.md).
   Suppress a generic shell only after a verified match. A reference point alone never
   replaces a mapped footprint or bridge centerline.

## Rebuild and verification

From the repository root, after `pnpm -r build`:

```powershell
# Example bounded reproduction; choose the intended family generator and ID.
node packages/worldgen/scripts/generate-signature-towers.mjs --ids=N0207 --check
node packages/worldgen/scripts/import-and-register-next-1000.mjs --ids=N0207 --check
node packages/worldgen/scripts/capture-next-1000-models.mjs --ids=N0207
node examples/world-explorer/test/visual/capture-landmark-library.mjs --ids=N0207 --reflections --adaptive-clipping
node packages/worldgen-earth/scripts/build-structure-readiness.mjs
node packages/worldgen/scripts/build-next-1000-gallery.mjs
node packages/worldgen/scripts/build-place-gallery.mjs
node scripts/check-source-bundles.mjs
node packages/tooling/dist/cli.mjs pack verify content/worldgen
```

Imports and captures accept `--ids=N0002,map_smock_windmill,map_wind_turbine` for a bounded
batch. The import/register wrapper serializes shared-index mutations across authoring lanes.
Imports verify hashes and reuse unchanged runtime files. Captures resume from their
hash-bound reports; `--force` repeats them. New captures include a lit scene, four neutral
turntable views, and each asset's authored near/far cameras. They run the normal Molen scene
validation, 30-tick simulation, and capture path. Image presence never grants visual approval.

Capturing scenes uses Chromium and may need `PLAYWRIGHT_BROWSERS_PATH` set to the locally
installed browser directory. Research snapshots and candidate metadata are excluded from
runtime packs. Hosts should serve packs with byte ranges so nearby models can be fetched
without downloading distant assets.
