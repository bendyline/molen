# Significant structure candidates

Catalog, model and placement identities use persistent building names. See the
[identity conventions](../IDENTITIES.md) for naming, disambiguation and refresh rules.

This is a **candidate inventory**, not a claim that 1,000 finished GLBs are ready for Earth
placement. [Browse the searchable gallery](gallery.html) or use the machine-readable
[catalog](candidates.json). **Authoring resumed on 2026-10-01.** The [next 300](NEXT-300.json)
are a production queue, with Roter Sand started as an individually researched exterior.
The all-1,000 scope remains recorded; [round review](ROUND-REVIEW.md) preserves the earlier cleanup snapshot.
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
The [authoring guide](../AUTHORING.md) and [recipe index](../authoring-index.json) connect each
authored structure to editable generator code and the source-only asset build.

## Collections of separately located buildings

[collections.json](collections.json) records required independent members for candidates such as
seven_sisters, the Seven Sisters. Its seven exact building identities each need their own source GLB,
map frame, runtime asset, geographic placement and current visual/fidelity reviews. **The seven
members are declared but their source models have not been authored.** There is no composite
model or placement at the collection's reference coordinate.

The production commands accept a member ID such as `--ids=msu_main_building`; `--ids=seven_sisters` selects
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
`fetch-structure-candidates.ps1` collects up to each class quota plus 100 spare records from
the public SPARQL service. `refresh-structure-candidates.mjs` chooses the highest-sitelink
records with coordinates, de-duplicates Wikidata identities, and excludes normalized titles
from the existing 100-model plan. A small explicit exclusion list removes known routes,
demolished landmarks, umbrella institutions, and sensitive memorial sites from automatic
promotion. Sitelinks are a rough visibility proxy, **not** an
architectural-quality score. Assigned building IDs and existing authoring metadata survive a refresh.

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
asset keys to their pinned folders; the structure catalog catalog and this gallery retain their URLs.
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
| stari_most | Stari Most | [source bundle](../places/sr/srs/stari_most/README.md) |
| willis_tower | Willis Tower | [source bundle](../places/dp/dp3/willis_tower/README.md) |
| galata_tower | Galata Tower | [source bundle](../places/sx/sxk/galata_tower/README.md) |
| tokyo_station | Tokyo Station | [source bundle](../places/xn/xn7/tokyo_station/README.md) |
| stonehenge | Stonehenge | [source bundle](../places/gc/gcn/stonehenge/README.md) |

Each detailed source folder carries its brief, primary references, `spec.json`, source GLB,
hash manifest and lit Molen scene. Capture reports list the actual lit preview, four neutral
turntable views and authored near/far detail cameras; additional shared-material and terrain
reports apply where recorded. Older studies may have fewer views. Imported sidecars and
canonical GLBs are in `content/worldgen/assets/`, registered in `project.json` and the style
pack. Import optimization is controlled per asset to preserve thin or detailed geometry.

## Detailed exterior authoring

Bridge examples include [Pont de Normandie](../places/u0/u0b/pont_de_normandie/README.md),
[Gamla bron](../places/u7/u7q/gamla_bron/README.md),
[Severn Bridge](../places/gc/gcn/severn_bridge/README.md), and
[Skopje's Stone Bridge](../places/sr/srr/stone_bridge_in_skopje/README.md).
Their individual bundles retain structural dimensions, deck/support/cable geometry,
reconstructed details and current geographic limitations. A detailed mesh alone does not
certify road continuity, terrain contact or completed visual review.

Two separate [reusable map models](../map-structures/) provide a traditional smock windmill
and modern wind turbine. The Earth pack contains explicit rules for supported map tags and
classes. These generic models are additional assets, not replacements for named candidates.

## Examples of distinctive landmark geometry

| ID | Model | Distinctive authored geometry |
| --- | --- | --- |
| shanghai_world_financial_center | [Shanghai World Financial Center](../places/wt/wtw/shanghai_world_financial_center/README.md) | Curved taper, trapezoidal opening and curtain-wall bays |
| the_shard | [The Shard](../places/gc/gcp/the_shard/README.md) | Independent glass planes, facade panels and exposed crown |
| oriental_pearl_tower | [Oriental Pearl Tower](../places/wt/wtw/oriental_pearl_tower/README.md) | Spheres, three columns, inclined supports and observation bands |
| maiden_tower | [Maiden Tower](../places/tp/tp5/maiden_tower/README.md) | Asymmetric buttress, recessed slits and stone bands |
| gonbad_e_qabus | [Gonbad-e Qabus](../places/tn/tnx/gonbad_e_qabus/README.md) | Ten brick flanges, tapered shaft, cone and cornices |
| ka_ba_ye_zartosht | [Ka'ba-ye Zartosht](../places/tj/tjm/ka_ba_ye_zartosht/README.md) | Measured stone tower, false windows, dentils and access flight |
| tower_of_hercules | [Tower of Hercules](../places/ez/ezd/tower_of_hercules/README.md) | Helical band, recessed openings and octagonal stages |
| kopu_lighthouse | [Kõpu Lighthouse](../places/u6/u6r/kopu_lighthouse/README.md) | Massive buttresses, upper shaft, lantern and gallery |
| kiipsaare_lighthouse | [Kiipsaare Lighthouse](../places/u6/u6r/kiipsaare_lighthouse/README.md) | Leaning shaft, worn paint and open lantern framing |

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
The serialized `import-and-register-structures.mjs --ids=...` wrapper verifies imports and
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
node packages/worldgen/scripts/generate-signature-towers.mjs --ids=bank_of_america_plaza --check
node packages/worldgen/scripts/import-and-register-structures.mjs --ids=bank_of_america_plaza --check
node packages/worldgen/scripts/capture-structure-models.mjs --ids=bank_of_america_plaza
node examples/world-explorer/test/visual/capture-landmark-library.mjs --ids=bank_of_america_plaza --reflections --adaptive-clipping
node packages/worldgen-earth/scripts/build-structure-readiness.mjs
node packages/worldgen/scripts/build-structure-gallery.mjs
node packages/worldgen/scripts/build-place-gallery.mjs
node scripts/check-source-bundles.mjs
node packages/tooling/dist/cli.mjs pack verify content/worldgen
```

Imports and captures accept `--ids=pont_de_normandie,map_smock_windmill,map_wind_turbine` for a bounded
batch. The import/register wrapper serializes shared-index mutations across authoring lanes.
Imports verify hashes and reuse unchanged runtime files. Captures resume from their
hash-bound reports; `--force` repeats them. New captures include a lit scene, four neutral
turntable views, and each asset's authored near/far cameras. They run the normal Molen scene
validation, 30-tick simulation, and capture path. Image presence never grants visual approval.

Capturing scenes uses Chromium and may need `PLAYWRIGHT_BROWSERS_PATH` set to the locally
installed browser directory. Research snapshots and candidate metadata are excluded from
runtime packs. Hosts should serve packs with byte ranges so nearby models can be fetched
without downloading distant assets.
