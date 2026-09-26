# Terrain flyover

Streamed, LOD'd, procedurally-shaded terrain from a JSON descriptor + PNG16 height tiles. No image
assets ship with the engine — examples generate their own heightmaps from a seed. A single whole-map
heightmap remains available for small scenes and deterministic captures.

## 1. Describe the terrain (`molen/terrain@2`)

```json
{
  "format": "molen/terrain@2",
  "name": "island",
  "chunkSize": 128,
  "tileResolution": 129,
  "gridSize": [4, 4],
  "height": { "min": 0, "max": 120 },
  "tiles": { "heightUrl": "tiles/h_{x}_{z}.png" },
  "layers": [
    { "name": "grass" },
    { "name": "rock", "auto": { "slopeMin": 0.45 } },
    { "name": "snow", "auto": { "heightMin": 85 } }
  ],
  "lod": { "levels": 4, "distanceBands": [200, 400, 800, 1600], "skirts": true },
  "streaming": {
    "loadRadius": 3,
    "unloadRadius": 4,
    "maxConcurrentLoads": 4,
    "maxResidentTiles": 96
  }
}
```

Validate it: `molen validate island.terrain.json`.

Version 1 descriptors still validate and auto-upgrade with a deprecation notice; rewrite the
file as `molen/terrain@2` to silence it.

- **Layers** paint the terrain by height/slope auto-banding: a layer with no `auto` is the base;
  layers with `auto` blend in where their height/slope window matches. Each layer has a
  representative `color` (or a sensible default by name: grass, rock, snow, dirt, sand, water).
- **LOD** picks a coarser mesh for far chunks (`distanceBands`), and **skirts** hide the seams
  between LODs.
- **Streaming** prioritizes nearby chunks, bounds concurrent requests and resident meshes, and uses
  separate load/unload radii so a camera near a boundary does not churn tiles.

## 2. Terrain as a game service (kernel side)

`@bendyline/molen-terrain/kernel` decodes 16-bit-grayscale heightmaps and exposes bilinear
`sampleHeight(x, z)`, `normalAt(x, z)`, and `slopeAt(x, z)`. The same PNG decodes identically in
Node, a Worker, and the browser. Use `heightfieldFromPng` for one whole-map PNG or
`heightfieldTileFromPng` for a descriptor tile.

A scene makes its terrain part of the simulation by referencing it:

```json
{
  "terrain": { "descriptor": "island.terrain.json", "heightmap": "height.png" },
  "physics": { "engine": "kinematics", "ground": "terrain", "character": true }
}
```

`molen sim run` / `shot` / `drive` decode the heightmap in Node and register it as the world's
ground field (`installTerrain` on `@bendyline/molen-kernel/terrain`), so:

- the **character controller** (`physics.character: true`; `character` + `moveIntent`
  components) lands on and walks over the surface;
- **kinematic bodies** (`physics.ground: "terrain"`) integrate `vel[1]` and rest on it;
- a **rapier** scene can collide with it: `collider3d: { shape: { type: "heightfield", ref: "scene" } }`;
- **scripts** query it: `molen.terrain.heightAt(x, z)`, `normalAt`, `slopeAt`, and
  `raycast(origin, dir, maxDist)` (a ray-march against the surface);
- captures render the same heightmap under the entities.

`raycast` is sampled: it marches in fixed steps (`installTerrain`'s `rayStep`, default half the
field's cell size), then bisects the first above-to-below crossing, including a final partial step
and rays shorter than one step. The hit lies on the ray at the reported distance, and an origin
already below the surface hits at distance 0. Invalid input, or a ray that needs more than
`maxRaySteps` (default 4096) steps, throws instead of reporting a false miss. Choose a step
suited to the terrain's feature size.

In your own host, `buildWorld(manifest, setup, { terrain: (world) => ({ terrain:
terrainScriptApi(installTerrain(world, heightfield)) }) })` does the same. The kernel's
`GroundField` contract is structural (`sampleHeight` + `normalAt`), so any height source can be
the ground. Scenes whose heightmap is generated at runtime (no `heightmap` file) get no ground
service — write the PNG once and reference it.

### Projected Earth is metric

Earth packages use Web Mercator, which inflates horizontal distance by 1/cos(latitude)
(≈1.48× at 47.6°N) while heights stay in meters. The package adapters pre-multiply the whole
projected frame by `metersPerUnit = cos(center latitude)` (recorded on the descriptor), so tiles,
meshes, semantic densities, character speeds, and entity XZ are all in ground meters. Convert
between world and projected space with `projectedToWorld` / `worldToProjected`; `webMercatorToWgs84`
takes projected coordinates (divide world XZ by `metersPerUnit` first). `wgs84ToWorld(metersPerUnit,
lon, lat)` and `worldToWgs84` do both steps for placing cameras, markers, and entities.

The scale is exact at one latitude, the **frame**. It defaults to the center of the package bounds,
which suits a regional package. A worldwide package centers on the equator, so pass the latitude you
are viewing: `createTerrainPackagePyramidStream(pkg, { frame: { latitude }, … })` (every package
open/descriptor helper accepts the same `frame`). `terrainPackageMetersPerUnit(pkg, frame)` returns the
matching scale for your own placement math and for worldgen's `metersPerUnit`. The error grows by
roughly 1–1.5% per degree of latitude away from the frame at mid-latitudes, so re-anchor — rebuild
the streams on a new frame — after moving more than about a degree north or south.

## 3. Render it (client side)

For a small, already-decoded map, `createTerrainObject(heightfield, descriptor, { cameraPos })`
builds one three.js group of vertex-colored chunk meshes.

For runtime streaming, pass a provider to `createTerrainStream`:

```ts
import { createViewer } from '@bendyline/molen-client';
import {
  createTerrainStream,
  createUrlTerrainTileSource,
} from '@bendyline/molen-terrain/client';

const viewer = await createViewer({
  canvas,
  cameraFar: 100_000,
  reverseDepthBuffer: true,
  autoWorldOrigin: { threshold: 2_000, gridSize: 500 },
});
const source = createUrlTerrainTileSource(descriptor, { baseUrl: document.baseURI });
const terrain = createTerrainStream(descriptor, source, { cameraPos: [0, 100, 0] });
viewer.renderer.worldRoot.add(terrain.object);

function frame(cameraPosition: [number, number, number]) {
  terrain.update(cameraPosition);
  viewer.setCamera({ position: cameraPosition, lookAt: [0, 0, 0] });
  viewer.renderFrame();
}
```

The source interface returns decoded height tiles, so archive readers, procedural worlds, and tests
do not change residency behavior. HTTP 404 is a stable missing tile; call `retryFailed()` only after
the backing data has changed. A *thrown* error is not: a dropped range request, a 503, or a CORS
failure is retried with bounded exponential backoff (`maxRetries`, `retryDelayMs`,
`maxRetryDelayMs`) before the tile is abandoned, and every request carries a `requestTimeoutMs`
deadline so a stalled connection cannot hold a concurrent load slot. `stats()` counts `missing` and
`retrying` separately from `failed`, and `tileFailures()` reports each tile's state, attempts, and
next attempt time, so a host can tell a user "still retrying" rather than "gave up".

The pyramid streamer applies the same retry policy to semantic layer generation and GPU
preparation, with a separate `layerTimeoutMs` deadline (120000 ms by default; 0 or Infinity disables
it). This allows CPU-heavy generation and software shader compilation more time than height
requests. A stalled layer releases its load slot, and late cancelled results are disposed.
`stats().retryingLayers` and `stats().failedLayers` report those failures independently from height
tiles; `retryFailed()` retries both. Disabling a layer or evicting its tile clears its failure state.

Adjacent tiles share their border heights, and the streamer keeps their border *normals* continuous
too: each side recomputes its edge from the neighbouring tile's heights once that neighbour is
resident, so there is no lighting seam along tile edges.

### Classification, hydrology, and human-feature layers

`TerrainTileLayer` creates an optional tile-local three.js object after a height tile becomes
resident. Categories are `classification`, `hydrology`, and `human-feature`; use
`setLayerVisible(id, visible)` to compose application modes while keeping always-on natural water
independent from optional roads and buildings. Layer objects are evicted with their height
tile, and a layer can provide `disposeTile` for owned GPU resources. Vector schema parsing and model
selection belong in layer adapters, not the streamer. The shipped styled-building adapter is
`@bendyline/molen-worldgen-earth` (see [worldgen.md](worldgen.md)).

### Large-world coordinates

Streamed mesh vertices are local to their tile. Engine-owned objects live under
`viewer.renderer.worldRoot`; `renderer.setWorldOrigin([x,y,z])` rebases that root and camera poses
without changing authored world coordinates. This is the generic precision mechanism used by large
invented worlds and projected Earth patches. Set `autoWorldOrigin` on the viewer to make camera
movement trigger coherent grid-snapped rebases for every engine-owned object automatically.

`terrainStreamBudgetForQuality('economy' | 'balanced' | 'high')` returns portable residency and
concurrency budgets. `stream.stats()` reports decoded samples, geometry bytes, triangles, draw
calls, instances, loading/failure counts, and evictions for live quality diagnostics.

## 4. Screenshot it headlessly

```sh
molen shot scene.json --out island.png --camera 256,160,580 --look 256,20,256 --size 1280x720
```

(The `screenshotScene` op / `screenshot_scene` MCP tool also accept a `terrain` payload so the
flyover renders without any live entities.) The terrain-flyover sample is the full slice:
[play it](https://molen.dev/play/terrain-flyover/), or copy it with
`npx @bendyline/molen-tooling new my-terrain --template terrain-flyover`.

### Walk through the world explorer

The explorer blends distant terrain and objects into pale daylight haze on both rendering
backends. At low altitude, the fade spans 2 to 20 kilometres, preserving nearby neighborhoods
while softening the horizon. Both distances extend at flight altitude and stay inside the streamed
range; it does not otherwise change with the terrain quality preset.

In [World Explorer](https://molen.dev/play/world-explorer/), select **Walk mode** to move from the aerial viewer to open ground
near your current position. The camera sits 1.7 meters above your feet, with a 5 cm near clipping
plane, so nearby buildings retain their real, human-scale dimensions. Human features turn on
when available; the terrain layer buttons remain independent of navigation.

Use **WASD** to walk (1.5 m/s), **Shift** to run (4 m/s), **Space** to jump, and click the world
to capture the mouse for looking around. **Esc** releases it; drag-look works in hosts without
pointer lock. Select **Fly** to rise back into aerial navigation. `?navigation=walk` starts on foot.

Walk mode uses gravity and a 1.8-meter capsule against a bounded neighborhood of visible terrain,
roads, buildings, and props, including instanced geometry. Collision follows tile residency and
layer visibility and remains stable across floating-origin changes. Missing terrain pauses movement
until coverage arrives. Ground placement waits for streaming and searches up to 16 meters for an
open spot; if none is available, use Fly to choose another location. Water is not a solid floor;
swimming and building interiors are not modeled.

## 5. Installable tiled-world packages

`molen/terrain-package@1` describes an extracted runtime directory containing an elevation
PMTiles archive, optional landcover/features sidecars, provenance, attribution, and checksums. A ZIP
may transport the directory, but browser deployments extract it so PMTiles remains range-readable.
Each PMTiles source is either package-relative (`{ "kind": "pmtiles", "path": "world.pmtiles" }`)
or an absolute HTTP(S) URL (`{ "kind": "pmtiles", "url": "https://tiles.example.com/world.pmtiles" }`).
This lets a small installed DEM package reuse one shared, Range-readable world feature archive.
Only bundled `path` sources appear in `files` and are checksum-verified; remote archives remain the
deployment's responsibility. `baseUrl` resolves package paths and never rewrites an absolute source
URL. An absolute source works immediately when it is same-origin; cross-origin hosts must allow the
consumer origin with CORS and expose the range/cache headers needed by the PMTiles reader.
Validate the manifest with `molen validate terrain-package.json`. A compiler/release job should
also run `molen validate terrain-package.json --verify-files`; that streams every declared file
and checks directory containment, byte size, and SHA-256 without loading an archive into memory.

A source may also be a **split archive family**: `{ "kind": "pmtiles-set", "url": ".../archive-set.json" }`
(or a package-relative `path`) names a `molen/archive-set@1` document instead of one archive. Planet
data outgrows what CDNs cache as a single object, so producers cut it into a coarse `base` archive
plus detail archives, each owning a disjoint set of cells at `partitionLevel` (as run-length indices
`y * 2^partitionLevel + x`). The package adapter opens the document lazily and routes every tile to
the archive owning its ancestor cell, opening members on demand in a small LRU. Hosts with their own
transport call `createTerrainArchiveSetArchive(urlOrDocument, { openArchive })` from
`@bendyline/molen-terrain/client` and pass the result as `archive`, `landcoverArchive`, or
`featuresArchive`; `createTerrainArchiveSetRouter` in the kernel half is the pure routing function,
and `encodeTerrainArchiveSetPartitions` writes the run-length lists. Validate a set document with
`molen validate archive-set.json`.

Compilers write package archives with the portable PMTiles v3 writer in
`@bendyline/molen-terrain/kernel` (Node, Workers and browsers). `writePmtilesArchive(tiles,
{ tileType: 'png', bounds })` builds a whole archive in memory; for archives too large for memory,
stream the tile payloads to disk in tile-id order (`pmtilesTileId(z, x, y)`) and write
`createPmtilesPrefix(records, dataLength, options)` in front of them. Official readers fetch only the
first 16 KiB to find the root directory, so the writer moves entries into gzip-compressed leaf
directories once one root would overflow that window; archives of any size stay readable.

The optional `surface` block declares `seaLevel` and portable height/slope material bands. If it is
omitted, the projected-Earth adapter supplies a conservative dirt/sand/grass/rock/snow palette.

The first executable package path is PNG16 elevation in a PMTiles v3 archive. For normal
perspective exploration, open its complete available pyramid and update it with camera projection
state:

```ts
import { createViewer } from '@bendyline/molen-client';
import {
  createTerrainPackagePyramidStream,
  terrainPyramidBudgetForQuality,
} from '@bendyline/molen-terrain/client';
import { wgs84ToWebMercator } from '@bendyline/molen-terrain/kernel';
import packageDoc from './terrain-package.json';

const [x, z] = wgs84ToWebMercator(-122.3321, 47.6062);
const earth = await createTerrainPackagePyramidStream(packageDoc, {
  baseUrl: import.meta.url,
  ...terrainPyramidBudgetForQuality('balanced'),
  initialView: {
    position: [x, 2_000, z],
    verticalFov: Math.PI / 3,
    viewportHeight: canvas.height,
  },
});

const viewer = await createViewer({
  canvas,
  cameraFar: 1_000_000,
  reverseDepthBuffer: true,
  autoWorldOrigin: { threshold: 2_000, gridSize: 500 },
});
viewer.renderer.worldRoot.add(earth.stream.object);

function frame(position: [number, number, number]) {
  earth.stream.update({
    position,
    verticalFov: Math.PI / 3,
    viewportHeight: canvas.height,
  });
  viewer.renderFrame();
}
```

The selector measures projected source-sample spacing, adapts its error/range to the selected-tile
budget, requests ancestors before descendants, and retains a displayed parent until all selected
descendant coverage is resident. `stream.stats()` adds selected/displayed counts, effective
screen-space error, displayed-level range, and leaf fallback count. Quality presets set explicit
error, view-distance, concurrency, selection, and residency budgets. Include `direction` and
`aspect` in each view update to reject tiles safely outside a guarded horizontal camera cone while
retaining direction-independent coarse coverage to the configured distance. In-flight surface
requests finish into a bounded warm cache instead of being restarted on every small camera turn;
hidden cached tiles are evicted only when capacity is needed. Sparse descendants also share a
bounded decoded-ancestor cache, avoiding repeated PNG decode/resample work while panning.

`TerrainPyramidTileLayer` provides the same classification/hydrology/human-feature lifecycle over
adaptive tiles. Its optional inclusive `minLevel`/`maxLevel` bounds keep expensive decoration off
coarse fallback and horizon tiles. Layer objects become visible only with their selected surface,
remain cached briefly across LOD transitions, and are disposed with their resident height tile.

Optional package sidecars cross a normalized boundary before reaching those layers. Call
`openTerrainPackageSemantics(packageDoc, { decoder, baseUrl })` to open and header-check declared
landcover/features PMTiles. The injected decoder receives only the requested source-layer names and
returns `molen/terrain-semantics@1`: tile-local `[u,v]` polygons/lines plus normalized landcover,
water, transportation, and building records. XYZ/TMS conversion and sidecar level clipping happen
in the package adapter. This keeps MVT tags and Earth projection out of generic render code, and
lets an invented format implement the same `TerrainSemanticTileSource` contract.

MVT packages can explicitly declare `"profile": "protomaps-basemap@1"` on each semantic section.
`createProtomapsTerrainMvtDecoder` maps the observed Protomaps `landcover`, `landuse`, `water`,
`roads`, and `buildings` layers into that normalized contract, including buffered coordinates,
polygon holes, waterways, bridge/tunnel flags, and building height/level fallbacks. Unknown profiles
are never guessed. `createTerrainMvtSemanticDecoder` exposes source-layer/property mappings and
per-tile feature/point limits for other MVT producers.

`createTerrainSemanticPyramidLayer` joins any normalized source and renderer to adaptive residency.
`createDefaultTerrainSemanticRenderer` is the initial scalable mesh policy: deterministic instanced
trees inside forest polygons, combined terrain-draped road ribbons, combined footprint extrusions,
flat polygonal water, and draped linear waterways. `createTerrainWaterMaterial` provides an opaque
physical material with optional world-space animation; call `setTerrainWaterTime` each frame to
advance its highlights without discontinuities across floating-origin shifts. Opaque coverage
avoids dark overlap seams while adjacent or parent/child water tiles refine. Expensive semantics
can be level-bounded, toggled without re-decoding resident objects, and disposed with the elevation
tile. Applications may replace the decoder, renderer, materials, or model geometry independently.

For the standard path, `createTerrainPackageSemanticLayers` opens every optional sidecar and returns
classification, hydrology, and human-feature layers ready for
`createTerrainPackagePyramidStream`. Classification and built features are detail-bounded by
default; hydrology spans every available sidecar level so distant lakes retain mapped shorelines.
Successfully empty layer tiles remain cached with their resident terrain tile, allowing farther
water requests to finish instead of repeatedly querying empty nearby tiles.
Water is separated from transportation/buildings even when
they share one `features` PMTiles sidecar. When both sections reference one MVT archive, the
renderer layers share one in-flight range read and full decode; decoded semantic documents are not
retained as a second long-lived cache.

The opposite split works too: when the terrain refines past a sidecar's last level (a zoom-13 vector
archive under zoom-14 elevation), the finer tiles overzoom the sidecar's finest tiles by default.
`overzoomTerrainSemanticTile` rescales an ancestor's normalized geometry onto the descendant, clips
roads, waterways and areas to it (plus a 1/64 buffer, like decoded tiles), and keeps each building
and point in exactly the one descendant that holds its center, so nothing is cut or drawn twice.
`createOverzoomTerrainSemanticSource` wraps any semantic source this way and keeps recently decoded
ancestors, since one ancestor serves up to four children at a time. Layers created by
`createTerrainPackageSemanticLayers` then reach the package's `maxLevel`; pass `overzoom: false`
to stop them at the sidecar's levels.

The package elevation pyramid may be sparse. `createTerrainPackagePyramidHeightSource` walks to the
nearest declared ancestor when an exact tile is absent, then crops and resamples that ancestor into
the requested tile bounds. This supports broad coarse coverage plus a small regional detail window
without a hard distance cutoff. Set `parentFallback: false` when exact-level coverage is required.

Adaptive quality budgets include `maxSurfaceTileResolution` (33 economy, 65 balanced, 129 high).
This limits render geometry without reducing the decoded heightfield used for sampling, feature
draping, or collision.

`openTerrainPackagePyramid` exposes the descriptor/source separately for custom lifecycles;
`terrainPyramidDescriptorFromPackage` is the pure coordinate adapter. `TerrainTileArchive` remains
the seam for native or test range readers. The official `pmtiles` browser reader is used by default,
and its header clips the usable level range and verifies PNG content before streaming.

`createTerrainPackageStream({ level })` remains the fixed-level path for orthographic views,
semantic tile-layer development, and diagnostics. Missing fixed-level tiles use the nearest
available parent by default; the adapter crops and resamples the ancestor while keeping neighbor
borders identical. Set `parentFallback: false` for strict package diagnostics.

Current projected-Earth runtime constraints are explicit: EPSG:3857, a square `[1,1]` root tile
matrix, guarded horizontal-cone selection ahead of exact six-plane/horizon culling, and an injected
decoder for unknown MVT/PNG8 profiles alongside the explicit built-in Protomaps MVT profile. TMS Y
addresses,
sidecar-header validation, normalized semantic meshes, and parent-safe adaptive refinement are
handled automatically. See the binding roadmap in the design plan,
[`docs/10-earth-terrain.md`](https://github.com/bendyline/molen/blob/main/docs/10-earth-terrain.md).

With parent fallback enabled, a package pyramid may extend above the elevation archive's
maximum zoom. For example, a zoom-15 vector archive can use cropped/resampled zoom-14 elevation
without downloading another DEM level. Set `parentFallback: false` to clamp the pyramid to exact
elevation archive levels. The World Explorer data builder defaults to this 15/14 split and exposes
`--elevation-max-level` separately from `--max-level`.

## Surface rendering styles

Human mode includes a Surfaces selector for Modern traffic, Circa 1910, and Simple surfaces.
The Surface details controls customize markings, sidewalks, crossings, streetlights, signals,
parked cars, and inferred parking. Changes preserve the camera and buildings and update the URL.
Circa 1910 changes the surface treatment of the present-day map; it does not reconstruct history.

See [Surface styles and parameterized line features](surface-rendering.md) for the shared rendering API, parking inference rules, budgets, and rail/utility profile examples.

The explorer plans adaptive streaming at 10 Hz, independently of rendering and movement. Covered
ancestors that were evicted under memory pressure are not reloaded while finer resident tiles
supply their coverage; coarse coverage remains warm for camera turns. The HUD reports actual
renderer draws/triangles and frame mean/max alongside resident allocation estimates.

Land-cover draping can run off-thread with `createTerrainLandcoverWorkerBridge(worker)` and
`installTerrainLandcoverWorker(scope)` from the terrain client. The worldgen renderer accepts the
bridge through `landcoverGenerator`; the caller disposes it after its tiles are disposed. It
preserves source height samples, terrain triangle alignment, colors, holes, and material settings.


Runtime quality controllers can call `stream.setBudget(partialBudget)` with measured screen-space
error, view distance, selected/resident tile ceilings, concurrency, and optional `maxResidentBytes`.
Use `maxResidentBytes: undefined` to remove an automatic byte cap. The patch is validated
atomically, retains the existing stream and cache, and replans its latest
view. `stream.getBudget()` returns a detached snapshot. Reducing concurrency allows current work
to finish; new work waits for the lower limit. Reducing residency evicts hidden cache first and
retains displayed descendants until a replacement parent is ready. Already displayed coverage may
temporarily exceed a reduced tile limit; at most one replacement parent is admitted at a time
while the stream converges, rather than exposing a hole.

`stream.pressure()` provides constant-time retained height/geometry byte estimates, tile and byte
ratios, and `overBudget` for the controller without traversing the scene. `displayedBytes` and
`displayedByteRatio` isolate the currently displayed tile allocations from the reclaimable hidden
cache. Use that working-set ratio for quality recovery decisions: normal LRU residency fills its
cache near the cap, which alone should not prevent recovery. The byte ceiling is soft:
visible coverage and its coarse fallback are protected, so sustained pressure should make the host
increase screen-space error or reduce its selected-tile budget. These estimates exclude textures,
source caches, and driver allocations; geometry shared across tiles is counted conservatively.
Adapters that replace a resident layer's geometry in place should call
`stream.refreshMemoryUsage()` once after that asynchronous update settles. It refreshes allocation
estimates and evicts hidden cache under pressure; ordinary `pressure()` calls remain constant-time.
A runtime `maxSurfaceTileResolution` change affects new tile admissions only. Resident surface
meshes and the matching resolution passed to draped layers stay intact, avoiding mass geometry
rebuilds and terrain/overlay disagreement during adaptive changes.
