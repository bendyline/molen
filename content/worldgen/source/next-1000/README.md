# Next 1,000 significant structure candidates

This is a **candidate inventory**, not a claim that 1,000 finished GLBs are ready for Earth
placement. [Browse the searchable gallery](gallery.html) or use the machine-readable
[catalog](candidates.json). Five original studies plus detailed Pont de Normandie, Gamla bron
and Severn Bridge models are imported; 992 entries still lack source models. None of these eight has completed the new
maximum-fidelity and geographic review gates. The first 100 site structure assets and 120
resizable procedural building styles are separate from this list.

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

## First five modeled studies

| ID | Target | Source master | Runtime GLB | Source triangles | State |
| --- | --- | --- | --- | ---: | --- |
| N0001 | Stari Most | [source](models/n0001_stari_most/models/source.glb) | `assets/molen/worldgen/structure/n0001_stari_most/model.glb` | 1,632 | Stylized arch study |
| N0136 | Willis Tower | [source](models/n0136_willis_tower/models/source.glb) | `assets/molen/worldgen/structure/n0136_willis_tower/model.glb` | 29,336 | Bundled-tube skyline study |
| N0561 | Galata Tower | [source](models/n0561_galata_tower/models/source.glb) | `assets/molen/worldgen/structure/n0561_galata_tower/model.glb` | 1,672 | Stone tower study |
| N0796 | Tokyo Station | [source](models/n0796_tokyo_station/models/source.glb) | `assets/molen/worldgen/structure/n0796_tokyo_station/model.glb` | 3,182 | Marunouchi facade study |
| N0946 | Stonehenge | [source](models/n0946_stonehenge/models/source.glb) | `assets/molen/worldgen/structure/n0946_stonehenge/model.glb` | 804 | Sarsen-ring study |

Each source folder has a brief, reference pages, `spec.json`, a self-contained source GLB,
source hash manifest, a lit Molen scene and preview, and two turntable views. Imported sidecars
and optimized canonical GLBs are in `content/worldgen/assets/`; asset IDs are registered in
`content/worldgen/project.json` and the default style pack. These models are still visual
studies: exact facade details, surveyed footprint/orientation, LOD, collision, and geographic
placement remain open. The Stari Most master needs sections and a driveable/walkable deck
aligned with the terrain before Earth use.

## Maximum-fidelity production

[Pont de Normandie](models/n0002_pont_de_normandie/README.md) adds researched pylons, the
856 m main span, 184 stays, cable anchor fittings, approach viaducts, deck edges, lane markings,
and railings. Its 178,388-triangle source preserves thin cables at the full 2,141.25 m crossing
scale. Texture weathering, precise approach geometry, terrain height datum, and geographic
fit remain open; detailed geometry alone does not certify a finished replica.

[Gamla bron](models/n0003_gamla_bron/README.md) adds ten bowstring steel spans, braced trestles,
masonry piers and utility details (165,156 triangles).
[Severn Bridge](models/n0005_severn_bridge/README.md) adds its original suspension geometry,
inclined hangers, steel towers, deck and fittings (308,648 triangles). Both have reviewed
lit, turntable and close-detail captures; reconstructed measurements and geographic datum
remain explicit limitations. [Skopje's Stone Bridge](models/n0004_stone_bridge_in_skopje/README.md)
has a researched brief with conflicting span evidence and no speculative GLB.

Two separate [reusable map models](../map-structures/) provide a traditional smock windmill
and modern wind turbine. The Earth pack contains explicit rules for supported map tags and
classes. These generic models are additional assets, not replacements for named candidates.

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

## Production path for the remaining candidates

1. **Review candidate identity and map coverage.** Confirm that the item is a present-day
   physical structure or a deliberately historical layer. Resolve complexes into actual
   buildings and replace unsuitable entries from the spare CC0 query pool. Match an OSM or
   terrain-package feature by stable source ID first; verify names, geometry and location
   before using an alias.
2. **Rank by viewer impact.** Promote structures visible in supported terrain packages and
   skyline/road viewpoints. Evaluate category, regional coverage, silhouette uniqueness,
   repetition frequency, and whether a procedural style already conveys the structure.
   Use sitelinks only as a secondary signal.
3. **Author in batches of 50 to 100.** Give each target a measured brief, original editable
   source, GLB, sidecar, preview, and near/far visual QA. Produce several levels of detail,
   tile-sized parts for long bridges, and collision where traversal requires it. Keep
   site-specific art distinct from the 120 resizable archstyles.
4. **Segment delivery.** Keep candidate metadata outside runtime packs. As modeled batches
   grow, split their GLBs into optional regional or thematic content packs with stable
   `pack:` references; load only visible models. Measure compressed download, decoded GPU
   memory, draw calls and generation time before adding a batch to the viewer.
5. **Connect geographic placement.** Implement the versioned Earth structure catalog and
   conservative matching contract described in the [first 100 plan](../../../../examples/world-explorer/STRUCTURE-EXPANSION-PLAN.md).
   Suppress a generic shell only after a verified match. A reference point alone never
   replaces a mapped footprint or bridge centerline.

## Rebuild and verification

From the repository root, after `pnpm -r build`:

```powershell
& packages/worldgen/scripts/fetch-next-1000-candidates.ps1
node packages/worldgen/scripts/refresh-next-1000-candidates.mjs
node packages/worldgen/scripts/generate-next-1000-models.mjs
node packages/worldgen/scripts/generate-gamla-bron.mjs
node packages/worldgen/scripts/generate-severn-bridge.mjs
node packages/worldgen/scripts/generate-map-structures.mjs
node packages/worldgen/scripts/import-next-1000-models.mjs
node packages/worldgen/scripts/capture-next-1000-models.mjs
node packages/worldgen-earth/scripts/build-structure-readiness.mjs
node packages/worldgen/scripts/build-next-1000-gallery.mjs
node packages/worldgen/scripts/generate-next-1000-models.mjs --check
node packages/worldgen/scripts/import-next-1000-models.mjs --check
node scripts/check-source-bundles.mjs
node packages/tooling/dist/cli.mjs pack verify content/worldgen
```

Imports and captures accept `--ids=N0002,map_smock_windmill,map_wind_turbine` for a bounded
batch. Imports verify hashes and reuse unchanged runtime files. Captures resume from their
hash-bound reports; `--force` repeats them. New captures include a lit scene, four neutral
turntable views, and each asset's authored near/far cameras. They run the normal Molen scene
validation, 30-tick simulation, and capture path. Image presence never grants visual approval.

Capturing scenes uses Chromium and may need `PLAYWRIGHT_BROWSERS_PATH` set to the locally
installed browser directory. Research snapshots and candidate metadata are excluded from
runtime packs. Hosts should serve packs with byte ranges so nearby models can be fetched
without downloading distant assets.
