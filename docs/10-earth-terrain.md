# Earth terrain mode

Status: binding design plan for the work after the shipped Phase-1 terrain flyover. The shipped truth
remains `docs-src/` plus `packages/`; this document calls out the first implemented slice as it
lands.

## Goal

Add an optional Earth-backed mode without turning molen into a GIS-specific engine. The same renderer
and runtime must support a fictional continent, a hand-authored game map, and real Earth data. Earth
is a coordinate/data adapter over generic terrain primitives.

The user-visible rendering modes are cumulative:

1. **Surface** — elevation, water, and terrain materials.
2. **Land classification** — surface polygons/rasters plus deterministic decoration placement (trees,
   scrub, rocks, crops, and similar authored model families).
3. **Human features** — roads, paths, rails, buildings, bridges, and other structures.

Each layer has an independent visibility and quality budget. Bare terrain must not load or parse
feature data.

## Non-goals for the first usable release

- Seamless street-to-orbit travel in one camera move.
- Photorealistic satellite imagery or proprietary basemaps.
- Editing source GIS data in the browser.
- Making gameplay simulation depend on client camera residency.
- Loading a multi-gigabyte ZIP into browser memory.

## Architecture

```text
Earth/public data                         invented-world content
        |                                          |
        +------------ compiler adapters -----------+
                               |
                     molen/terrain-package@1
                  manifest + independently tiled layers
                               |
        +----------------------+-----------------------+
        |                      |                       |
  elevation source      classification source     feature source
        |                      |                       |
        +----------- generic tile residency -----------+
                               |
                    terrain mesh + layer objects
                               |
             renderer (LOD, culling, origin rebasing, quality)
```

### Ownership boundaries

- `@bendyline/molen-terrain/kernel` owns schemas, height decoding, sampleable height tiles,
  coordinate-independent tile addresses, and collision residency when enabled. It has no DOM or
  three.js dependency.
- `@bendyline/molen-terrain/client` owns async tile sources, prioritized loading, LRU eviction, mesh
  LOD, decoration/feature tile lifecycles, and three.js resources.
- `@bendyline/molen-client` owns renderer-wide facilities: camera clip policy, depth-buffer mode,
  world-origin rebasing, quality/capability selection, and render stats.
- `qualla-internal` owns reproducible source downloads, reprojection, simplification, tiling,
  package-size presets, license manifests, checksums, and compilation into the molen contract.
- The world-explorer example consumes compiled output. It must not contain a second GIS pipeline.

### Source/provider interfaces

Runtime code depends on small interfaces rather than URLs or PMTiles directly:

- a height tile source returns a decoded, sampleable height tile;
- a classification/feature layer creates one render object for a resident terrain tile;
- an archive reader returns bytes for a tile address;
- a coordinate adapter maps source coordinates into the active local world frame.

URL templates, PMTiles range reads, an in-memory test source, and procedural worlds are adapters to
those interfaces. This is also the seam for IndexedDB caching and native-file range readers.

## Coordinate model

### Stage A — large planar worlds

Retain the engine convention `+X east/right, +Y up, +Z south/forward`, measured in meters. Store tile
placement as double-precision JavaScript numbers, keep mesh vertices local to their tile, and rebase
a renderer world root near the camera. This prevents a terrain vertex buffer from containing large
absolute coordinates and benefits every large game world.

### Stage B — constrained Earth exploration

Use a tiled projected coordinate adapter (initially EPSG:3857/Web Mercator) and a local render
origin. A camera may move across the world, but the visible scene is always a nearby planar patch.
Reproject feature geometry into that patch and rebase at safe tile boundaries. This is sufficient for
regional flyover and city exploration and aligns with the existing PMTiles vector archive.

Mercator scale distortion and the latitude limit must be explicit in the package metadata and UI.
Simulation coordinates remain local meters; longitude/latitude are metadata and navigation inputs,
not ECS transform values.

### Stage C — ellipsoid only when required

Add WGS84/ECEF plus a local east-north-up frame, horizon culling, and either a cube/ellipsoid tile
layout or quantized-mesh reader only when orbit views or long uninterrupted flights are a product
requirement. Do not pay this complexity merely to label the mode “Earth.” Cesium's [quantized-mesh
specification](https://github.com/CesiumGS/quantized-mesh) is the interoperability reference, not a
requirement that molen adopt its whole runtime.

## Terrain package contract

`molen/terrain-package@1` is a small JSON manifest. Runtime delivery is an extracted directory:

```text
world.molen-terrain/
  terrain-package.json
  elevation.pmtiles
  landcover.pmtiles             # optional
  features.pmtiles              # optional
  models/                       # optional authored glTF library/index
  LICENSES/
```

A `.molen-terrain.zip` is allowed as a transport artifact, but it is not the browser streaming
format. Deployments extract it or install it once. PMTiles remains range-readable and each optional
layer can be omitted. A source may use a package-relative `path`, in which case it is bundled and
covered by the manifest's file hash table, or an absolute `url`, in which case the browser streams
the independently hosted archive directly. This supports small DEM sidecars that reuse Qualla's
single world vector archive instead of copying it into every preset. PMTiles v3 is a single-file
tiled archive designed for HTTP Range Requests; see the [official
specification](https://github.com/protomaps/PMTiles/blob/master/spec/v3/spec.md).

The manifest records:

- a planar or geospatial coordinate space and bounds;
- an XYZ/TMS tile matrix with minimum/maximum levels;
- elevation archive/template, tile resolution, encoding, and height scale;
- optional normalized land-class and human-feature sources;
- required attribution/license records and source release identifiers;
- content hashes and compiler version;
- an informational size/quality preset (`1gb`, `5gb`, or `20gb`).

The first elevation encoding is lossless 16-bit grayscale PNG with one global height range, matching
the current deterministic decoder. A later per-tile scale/offset or quantized mesh encoding can be
added without changing the source interface.

Normalized vector tile layers keep the renderer independent of a vendor schema:

| Layer | Geometry | Required/typical properties |
| --- | --- | --- |
| `landcover` | polygon | `class`, optional `subclass`, `density` |
| `water` | polygon/line | `class`, optional `name` |
| `transportation` | line | `class`, optional `subclass`, `level`, `surface` |
| `building` | polygon | optional `height`, `min_height`, `levels`, `class` |

An adapter may also read the existing Protomaps schema directly, but compiled distributable packages
use the normalized contract so renderer behavior is reproducible.

## Data sources and licensing

The compiler must create a machine-readable attribution manifest and fail if an enabled source lacks
license metadata. “Open source” is not the same as public domain:

| Purpose | Initial candidate | Important constraint |
| --- | --- | --- |
| Elevation | Copernicus DEM GLO-90/GLO-30 | Worldwide and free, but carries source-notice obligations; see the [official Copernicus description](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM). |
| Lower-cost elevation variant | NASA/USGS SRTM | Public-domain US government data, but near-global rather than pole-to-pole and requires void/polar fallback. |
| Land classes | ESA WorldCover 2021 | 10 m, CC BY 4.0, attribution required; see [official access and license terms](https://esa-worldcover.org/en/data-access). |
| Roads/buildings/water | Existing Qualla Protomaps/OSM PMTiles | ODbL data attribution/share-alike obligations; reuse the archive and range-reader work already present in `qualla-internal`. |
| Alternate normalized features | Overture Maps | Mixed upstream attribution; its base theme includes OSM and is ODbL. Inspect the release's attribution data rather than assuming one license. See [Overture licensing guidance](https://docs.overturemaps.org/attribution/). |

A strictly public-domain-only package will have weaker worldwide land classification and human
features. The default plan is an openly redistributable package with complete notices, plus the
ability to build source-restricted variants.

### Size presets

`1gb`, `5gb`, and `20gb` are compiler byte budgets, not promises tied to one zoom level. The compiler
independently allocates bytes to elevation, land classes, and features, then reports actual maximum
detail by region. It must produce a size report before publication.

The existing Qualla feature archive provides measured starting points: worldwide vector data capped
at zoom 7 is estimated around 175 MB, zoom 8 around 538 MB, and zoom 9 around 1.5 GB. Elevation and
land-cover estimates must be measured from compiler output rather than guessed from source raster
sizes. Presets should support layer sidecars so a user can install terrain first and human features
later.

## Rendering system

### Surface

- prioritized async residency around the camera;
- separate load/unload radii (hysteresis), bounded concurrency, byte/mesh budgets, and LRU eviction;
- tile-local vertex buffers, skirts, dynamic LOD, frustum culling, and parent fallback during
  refinement;
- normal/detail textures and biome-aware procedural materials after correctness;
- water as a separate pass so oceans do not consume dense land geometry.

### Land classification and models

Classification polygons or categorical rasters select surface materials and feed deterministic
decoration placement. Placement uses a stable hash of package version, tile address, class, and
sample index. It must be density-budgeted and collision-free enough for the chosen scale.

The model library is authored content, not source GIS data. Start with instanced low/medium/high
variants for a small taxonomy (conifer, deciduous, scrub, rock, crop) and make model selection a
style policy. Use instancing and impostors/billboards at distance; never create one draw call per
tree.

### Human features

- roads/rails: line tessellation with width/style rules and terrain draping;
- buildings: footprint extrusion using height/levels with deterministic fallback heights;
- bridges/tunnels: respect level/layer metadata and avoid blindly draping;
- detailed landmark glTFs: a later explicit overlay, not inferred from every footprint.

Feature mesh generation should be worker-capable and cacheable by package hash + tile address + style
version.

### Browser quality and diagnostics

Expose quality presets as budgets (resident bytes, triangles, instances, feature level, shadow
distance), not device-name checks. Prefer reverse depth when supported; logarithmic depth is a
fallback because it can disable early fragment testing. Three.js documents both on
[WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html).

Add live stats for requested/loading/resident/failed tiles, decoded bytes, GPU geometry/textures,
triangles, draw calls, instances, evictions, and worst frame/upload time. Headless captures include
the same stats.

## Delivery milestones

### M0 — shipped baseline audit

Complete. The shipped package has whole-heightmap decode, fixed chunk meshing, static distance LOD,
skirts, vertex colors, and headless goldens. It does not yet stream the descriptor's tile URLs.

### M1 — generic fixed-grid streaming foundation

Complete in the current implementation.

- Evolve the terrain descriptor with declarative streaming budgets and legacy upgrade.
- Add a tile-source interface, URL-template source, prioritized loading, hysteresis, concurrency,
  eviction, dynamic per-tile LOD, height sampling of resident tiles, and layer-object lifecycle.
- Add renderer camera/depth options and world-origin rebasing.
- Unit-test load order, concurrency, eviction, failure/retry, LOD changes, and layer visibility.

This completes the important missing part of the original Phase-1 terrain design and is useful to
invented worlds immediately.

### M2 — package and projected-Earth reader

- **Implemented foundation:** validate `molen/terrain-package@1`; open its PNG16 elevation archive
  with the official PMTiles v3 range reader; provide Web Mercator/WGS84 navigation helpers,
  automatic/manual renderer origin rebasing, and seam-preserving fixed-level parent fallback.
- **Implemented generic refinement:** projected sample-error selection, portable error/range/tile
  budgets, ancestor-first requests, atomic parent-to-child coverage replacement, stable missing-child
  fallback, guarded camera-cone rejection, direction-independent coarse safety coverage, bounded warm
  residency, level-bounded semantic tile lifecycles, and package archive-level/header adaptation.
  Sparse descendant requests coalesce decoded ancestor work. The explorer uses this path by default
  at every altitude; an explicit `?level=` keeps the fixed-grid diagnostic path.
- **Implemented semantic boundary:** independent landcover/feature PMTiles readers with TMS/XYZ,
  archive type/level validation, decoder injection, and format-neutral `molen/terrain-semantics@1`
  tiles. Generic adaptive layers consume the same contract for Earth packages and invented worlds.
- **Implemented Protomaps binding:** an explicitly declared `protomaps-basemap@1` profile maps the
  same `world.pmtiles` vocabulary already used by Qualla into normalized terrain semantics. Shared
  landcover/features archives use one in-flight read/decode while preserving independent layer
  toggles and detail windows.
- **Implemented range integration fixture:** an in-memory, standards-valid PMTiles archive is served
  through an actual HTTP byte-range endpoint in tests, exercising the official URL reader through
  header discovery, directory lookup, PNG16 tile loading, and height sampling.
- **Implemented real regional fixture:** the World Explorer ships an 18.2 MiB Sammamish package
  compiled from Mapzen/USGS Terrarium elevation and a pinned Protomaps/OpenStreetMap extract. A broad
  level 8-10 overview surrounds a level 11-14 detail window; missing detail is cropped from the
  nearest archive ancestor without exposing package edges.
- Render and visually validate a production regional package produced by Qualla.
- Add browser-level range-request coverage for a real regional package.

### M3 — Qualla compiler and presets

- **Implemented production compiler:** Qualla now owns the reproducible sparse-address planner,
  resumable/cached Terrarium fetch and PNG16 conversion, streaming PMTiles assembly, source/license
  records, SHA-256 file table, ZIP transport, and dry-run size report. Hybrid presets can reference
  Qualla's absolute world PMTiles URL without copying that archive into the ZIP; local/offline
  presets can extract and bundle it instead.
- **Implemented consumer gate:** `molen validate terrain-package.json --verify-files` streams and
  verifies package-relative containment, declared byte sizes, and SHA-256 hashes.
- **Implemented presets:** checked-in Sammamish hybrid plus `1gb`, `5gb`, and `20gb` plans; the
  Sammamish hybrid artifact has been compiled end-to-end from live elevation tiles.
- **Implemented Qualla reuse:** remote or local world feature PMTiles are compiler inputs; no Qualla
  UI renderer is copied into molen.
- **Implemented fixture precursor in molen:** the reproducible Sammamish example builder pins its
  vector release, downloads only declared tile ranges, converts Terrarium RGB to seam-preserving
  PNG16, writes source/license manifests and SHA-256 hashes, and exercises the package contract. Move
  this logic into Qualla rather than growing a second production pipeline here.

### M4 — classification and vegetation

- **Implemented foundation:** normalized polygon landcover records, deterministic polygon-contained
  placement, configurable draped biome-color polygons, reusable instanced tree geometry/material
  hooks, level bounds, and density caps. The world explorer's adaptive synthetic classification now
  exercises this public path.
- **Implemented first authored library:** `@bendyline/molen-entities` ships six deterministic,
  meter-scaled GLBs (pine, fir, oak, birch, shrub, and boulder) with `molen/asset@1` sidecars,
  `molen/types@1` definitions, a project registry, and a rendered gallery. It uses the existing GLTF
  provider/cache/instancing path and introduces no parallel entity runtime.
- **Implemented placement contract:** `@bendyline/molen-worldgen` ships `molen/scatter@1` (label-keyed
  density, clustering, clearances, species weights, keep fractions per detail tier, surface colors)
  and the Earth adapter builds the scatter request (labeled polygons, road/water/building
  exclusions, world-anchored frame) from every semantic tile.
- **Implemented sampler and instancing:** the world-anchored jittered-grid sampler (label and
  exclusion rasters, clustering noise, slope and altitude limits, nested keep fractions, uniform
  per-rule and per-batch caps, cell-ordered output) runs cooperatively inside the batch generator;
  `ModelLibrary` merges authored GLBs (the entities library through the app's asset cache) into
  one vertex-colored geometry per model and the classification renderer draws every placement set
  as one `InstancedMesh` per tile. Tile budgets shrink scatter with the detail level so the
  resident set, not one tile, bounds instance and triangle counts.
- Add biome material mapping, distance impostors, and broader density policies; bind semantic class
  selection to the authored library.
- Golden scenes for forest, desert, mountain, coast, and agricultural regions.

### M5 — roads and buildings

- **Implemented foundation:** normalized transportation/building/water records, combined draped road
  ribbons, combined footprint extrusion with holes and height/level fallbacks, bridge clearance,
  tunnel omission, draped water meshes, and owned-geometry disposal. The source decoder remains
  injected so Qualla can map its exact vector schema without coupling the engine to it.
- **Implemented styled buildings:** `@bendyline/molen-worldgen` analyzes any footprint (box, L, T,
  U, Z, stair, H, plus, courtyard, irregular), decomposes it into roof wings, and builds gable, hip,
  pyramid, shed, mansard, gambrel, flat, and skillion roofs with walls, foundations, seeded
  palettes, and detail tiers from `molen/archstyle@1` documents in a `molen/stylepack@1`.
  `@bendyline/molen-worldgen-earth` binds looks to places with `molen/region-atlas@1`, adapts
  semantic tiles (tile-edge ownership, OSM class labels, land-use context), and renders through the
  terrain layer seam; the world explorer uses it by default (`?style=none` restores extrusions).
- **Implemented facades and props:** procedural `molen/matgraph@1` wall, roof, and window
  materials generated into the default pack (metric UVs pre-divided by each style's `uvScale`,
  palette tints multiplying light textures through vertex colors), punched/ribbon/grid windows
  and storefronts per bay and floor, base bands, floor lines, and cornices, roof props (chimneys
  on ridges, rooftop units on flat roofs, canales on parapets) as generated pack GLBs instanced
  per tile, detail tiers by level and quality, and a per-batch mesh-group cap that folds later
  buildings back to vertex colors. The client resolves pack materials once through
  `MaterialResolver` and shares them across tiles.
- **Implemented tooling:** `molen worldgen preview` (generate in Node, render headlessly from
  turntable angles; MCP returns images), `molen worldgen bake` (glTF + `molen/asset@1` sidecar
  through the asset importer, from a batch document or one outline), and `molen worldgen stats`
  (a real terrain-package tile off disk through a Node PMTiles source: counts, histograms, sizes,
  timings, determinism, `--dump` of the adapted batch). Goldens cover the preview page (flat and
  sloped ground) and the explorer's synthetic lineup; a dumped Sammamish tile is a checked-in
  Earth fixture.
- **Implemented worker, cache, and queries:** a three-free worker entry with a transferable
  height grid and cancel-on-abort, a client bridge the renderer treats like the in-thread
  generator (byte-identical output, tested), an LRU tile cache keyed by pack, atlas, quality,
  and address, a spatial index with `installWorldgen`/`worldgenScriptApi` as a hash-neutral
  kernel side channel, and the `worldgenBuilding` component rendered by a client entity layer.
  The explorer takes `?worker=1`.
- Feeding real tiles to a kernel scene needs a scene-level terrain-package reference (a separate
  follow-up); distance impostors for props remain open.
- Add worker mesh generation, richer bridge/tunnel geometry, and a package-hash/style-version feature
  cache. The first concrete source-schema decoder now covers Protomaps MVT.
- Urban, rural, and mixed-terrain performance/golden suites.

### M6 — world explorer

- **Implemented foundation:** browser sample with projected navigation, automatic origin rebasing,
  layer toggles, quality budgets, attribution, detailed streaming/render-work stats, atmosphere,
  water, a clearly labeled procedural source, optional terrain-package URL, and adaptive-level HUD.
- **Implemented profiled sidecars:** real packages that explicitly declare `protomaps-basemap@1`
  automatically enable the classification/human modes; unsupported or failed optional sidecars
  degrade to bare terrain with an explanatory disabled control.
- **Implemented actual-data default:** the bundled Sammamish regional fixture is the default source;
  `?synthetic=1` retains the deterministic regression fixture. Quality presets also cap per-tile
  surface mesh density independently of source-sample resolution.
- Add location search, interactive package selection, and graceful semantic-sidecar support.
- Headless camera routes that cross tile boundaries and assert residency, bounded memory, no cracks,
  stable failures, and reproducible captures.

### M7 — globe decision gate

Only after measuring M6, decide whether product requirements justify ellipsoid rendering. The gate
requires a concrete orbit/long-flight use case that the projected local-patch renderer cannot meet.

## Acceptance invariants

- Rendering mode changes never affect deterministic kernel state unless terrain collision is
  explicitly enabled.
- A package can omit classification and feature archives and still render bare terrain.
- Camera motion cannot create unbounded fetches, decoded arrays, geometries, or GPU resources.
- A missing/corrupt tile produces a stable diagnostic and parent/empty fallback, not a retry loop.
- Neighboring tile borders decode to the same height within one quantization step.
- Every distributed package has content hashes, source release IDs, and complete attribution.
- Earth-specific code depends on generic terrain interfaces; generic engine packages do not import
  Qualla, OSM, Overture, Copernicus, or ESA schemas.
