# Next 1,000 significant structure candidates

This is a **candidate inventory**, not a claim that 1,000 finished GLBs are ready for Earth
placement. [Browse the searchable gallery](gallery.html) or use the machine-readable
[catalog](candidates.json). Five original, stylized model studies have been generated, imported,
and rendered; 995 entries remain candidates. The first 100 site structure assets and 120
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

## Production path for the remaining 995

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
node packages/worldgen/scripts/import-next-1000-models.mjs
node packages/worldgen/scripts/capture-next-1000-models.mjs
node packages/worldgen/scripts/build-next-1000-gallery.mjs
node packages/worldgen/scripts/generate-next-1000-models.mjs --check
node packages/worldgen/scripts/import-next-1000-models.mjs --check
node scripts/check-source-bundles.mjs
node packages/tooling/dist/cli.mjs pack verify content/worldgen
```

Capturing scenes uses Chromium and may need `PLAYWRIGHT_BROWSERS_PATH` set to the locally
installed browser directory. All five scenes also pass `molen validate`, 30-tick headless
simulation, and a two-angle turntable. The verified default content pack now contains 448
files and packages to about 2.1 MB. Geographic matching remains the key viewer dependency.
