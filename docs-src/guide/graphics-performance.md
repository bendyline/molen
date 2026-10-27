# Graphics performance controls

The client and terrain packages reduce work on both Three.js backends. Backend selection is
covered in [WebGPU and WebGL](rendering-backends.md). These controls affect presentation;
headless simulation, entity IDs and authored geometry remain authoritative.

## Static scenes and sparse motion

Client delta ingestion stores only changed transforms in a short interpolation history. The
frame loop samples active interpolations, applies the final pose once, and then retires them.
Static entities retain their last pose. Keyframes, binding replacement, teleports and resync
still restore presentation state; full keyframes necessarily visit the full scene.

Opaque primitive and static GLB meshes sharing geometry, material identities, shadow flags and
render layers are instanced within spatial cells. Animated, skinned, morph-target, transparent,
custom shader/node-material and custom render-callback meshes remain ordinary meshes. An
entity that subsequently moves leaves its static batch. The original entity objects retain
identity; `client.entityForIntersection(hit)` (also available on `ThreeSceneBackend`) maps ray hits to entity IDs.
`getObject(id)` opts that entity out and restores mutable Three transforms for the escape hatch.

```ts
const client = await createClient(worker, {
  canvas,
  sceneOptimization: {
    staticInstancing: { cellSize: 32, minInstances: 2 }, // defaults; false disables
    shaderWarmup: true,
    animation: { distantDistance: 80, distantHz: 15, hiddenHz: 5 },
    // maxLocalLights: 16, // optional quality tradeoff; no count cap by default
  },
});
await client.ready();
```

Smaller instance cells improve culling and larger cells reduce draws. A batch can submit
triangles belonging to individually offscreen members, so fewer draws do not guarantee less
GPU work. Static local matrices are frozen; floating-origin motion still updates world matrices.

Live animations use the simulation tick at every sampled pose, without clock accumulation.
Visible nearby meshes and visible shadow casters retain full-rate sampling. Distant meshes
sample at 15 Hz and hidden meshes at 5 Hz by default; returning nearby updates immediately.
Use `animation: false` for full-rate sampling everywhere. Snapshot/capture poses remain exact.
Finite local lights whose entire influence sphere lies outside the camera frustum are omitted.
An explicit light-count cap ranks remaining lights by intensity/distance and can change images.
On WebGPU, capped point lights without shadows use persistent shader slots: moving or turning
changes each slot's position, color and intensity instead of compiling a new lighting shader
for every selected combination. Unused slots have zero intensity. Shadow-casting lights and
spotlights retain their own objects.

Resuming a paused simulation re-anchors the interpolation clock while keeping its pose history.
Loading screens and paused manual turns therefore do not leave live motion snapping between
simulation ticks while the clock slowly catches up.

## Staged preparation and admission

Each `Renderer` owns a `FrameAdmissionQueue`, configurable with the `admission` option:

Renderer defaults are 2 ms on WebGL and 8 ms on WebGPU, with 2 MiB and 32 jobs per frame.
WebGPU's individual Three node-builder steps commonly exceed 2 ms; the larger budget avoids
admitting only one mesh per frame in large worlds. Explicit budgets override these defaults.

```ts
const viewer = await createViewer({
  canvas,
  admission: {
    maxMilliseconds: 2, // explicit low-latency budget; WebGPU default is 8
    maxBytes: 2 * 1024 * 1024,
    maxJobs: 32,
    onSample(sample) { /* label, workMs, queueMs, bytes, overBudget, background */ },
  },
});
```

The queue limits synchronous work started per animation frame. One oversized indivisible job
runs alone and is reported as over budget. `setLimits` changes the budget from the next frame on.
A job's `priority` is `'normal'`, `'background'` (only in budget normal jobs leave) or `'urgent'`
(ahead of normal jobs, in its own order): the terrain stream admits ground that way, and marks a
tile group `userData.admissionPriority = 'urgent'` so `prepareObject` queues its upload the same
way, because a tile's residency otherwise waited behind every building cell's upload. A root
marked `'background'` prepares only in budget normal jobs leave: World Explorer's practice
aircraft load with the world that way, as in the normal lane their ~200 jobs held terrain and
buildings back by most of a minute on a software renderer.

Main-thread work that runs as a tile's sources resolve is admitted too, because several tiles
arriving together stacked it into one late frame: decoding vector tiles (the package semantic
layers' `admission` option), a worldgen request's own preparation, prop batches, surface results
from a worker (their meshes and parked cars), and ambient aircraft models (`admission` on
`createAmbientRenderer` and `EarthAmbient`). A worldgen request is three jobs: the tile's content
hash, the generator's optional `prepare` step (its ground grid, sampled once for both of a tile's
passes) and the message to a worker; in one piece a dense town tile's took 8-16 ms. A job runs
first in a frame however long it takes, but after other work the queue starts a job only when the
recent time of its `label` fits the budget left, so two long jobs never share a frame.
Street surfaces (roads, markings, parked cars) are generated by `createTerrainSurfaceWorkerPool`
over several workers; one surface worker for a whole view held a jet's buildings back by seconds,
since a built-up tile waits for its roads. Earth hosts size each generation pool (world
generation, land cover, surfaces) with `generationWorkers()`: a quarter of the logical cores, at
most two. Four per kind took the cores the frame needs, and a jet's frames drew the same scene up
to twice as slowly while a town streamed in. New kinds of ambient proxy batch stay hidden until
their shaders are built, as figures and aircraft do.

Three updates every object's world matrix each frame, hidden ones included. Hidden terrain tiles,
pooled ambient figures (each with its skeleton) and the explorer's parked-aircraft cockpits skip
that walk until they show again. Far detail stops drawing: a surface tile's signs, fixtures,
signal lenses, markings and parked cars past their draw distance (`updateDetail`, see
[surface rendering](surface-rendering.md)) and street props below 1.5 px (`vanishPixels`, see
[worldgen](worldgen.md)); at High over a town that cut a fifth of the draws. A visibility pass makes
its first ground cut whatever it costs, but only 4 ms more (`TerrainGroundCutoutController.update`'s
budget); the rest keep their current cut until the next stream update, so tiles arriving together
no longer hold one frame for every cut they need.

Earth hosts admit more while frames have time to spare: `createEarthAdmissionGovernor(backend)`
smooths each frame's main-thread work and, through `earthAdmission`, switches the queue to 8 MiB
of uploads a frame (and 4 ms of work on WebGL) below 10 ms of work, back to the renderer's
defaults above 13 ms. Each terrain tile and layer passes several admission jobs; at 2 MiB a frame
everything behind a building cell's upload waited 30 ms a job, and ground and buildings beneath a
jet appeared a second late. A render-bound frame (High detail over a town) loses a sixth of its
rate to the larger budget, so it keeps the defaults. This is not a hard GPU/driver time bound. Texture
initialization, geometry preparation and async shader compilation use public Three facilities;
shared resources share pending preparation promises. A cancelled tile cannot cancel another
tile waiting on the same resource; queued work is dropped once every tile waiting for it has
cancelled. Prepared static batches replace ordinary meshes only when ready; stale batch results
are discarded.
When `prepareObject` receives the parent the object will join, it evaluates LODs for the current
camera and waits only for the selected levels. The other levels prepare in the queue's background
lane (`priority: 'background'`), which runs only in budget that normal jobs leave, and are dropped
if their mesh or geometry is disposed first. This includes geometry-switch LODs whose current
level is empty: invisible ground cover does not delay an aerial tile, and a later approach waits
for its preparation before revealing it. WebGPU preparation shares the visible-light list between
rendered frames instead of walking the whole scene for each mesh. A mesh that swaps its own material (an instanced
detail switch's opaque and shadow-free twins) lists every material in `userData.materialVariants`,
and the renderer sets `userData.materialReady(material)`, which the mesh's owner asks before
switching. Until it returns true the owner keeps what it shows; the first question queues that
material's build ahead of other work, so variants a mesh never switches to are never built. Shadow
flags are part of what a mesh's shaders are built for, so set `castShadow` and `receiveShadow`
before preparing (the terrain stream marks layers and surfaces first). Resident world-generation
quality replacements use the same preparation/publication path when supplied with
`WorldgenRendererOptions.prepareObject` (enabled in World Explorer).

Preparation remembers each material's builds under what a program is built for besides the
material: the mesh's instancing, instance colors, skinning, attributes and morph targets, and the
scene's lights (which cast shadows), shadow map, fog, environment and output. A material built
before the sky's sun or its shadows existed is built again for the next mesh that draws it,
instead of counting as prepared and building mid-frame. A material changed in place needs its new
program first: `await renderer.prepareMaterialChange(current, next)` builds `next` for every kind
of prepared mesh that draws `current`, in the background lane, after which `current.copy(next)`
reuses the shared program. Progressive building materials do this through
`ResolvedMaterialSetOptions.prepareChange` (Earth hosts pass `prepareMaterialChange` to
`createEarthWorldgen`); upgrading a placeholder as its texture bake landed rebuilt every visible
building's shaders in one frame, seconds into a session.

On WebGL a warm-up waits for the programs its own compile built. three.js's `compileAsync` checks
each material's current program, which the next frame resets for whatever it drew last: a material
shared with drawn meshes (every building's wall) reported its ready program while the instanced
variant was still linking, and that variant's first draw waited for the link, 130 ms in flight.
Content that appears beside the viewer is prepared before it shows as well: building interiors
(`InteriorStreamingOptions.prepare`, which the Earth renderers pass their `prepareObject`; the
entrance covers stay until it settles), ambient pedestrians and ambient aircraft stay hidden until
their shaders are built.

Main-thread work that runs as tiles stream in beneath a fast aircraft is kept small. Ambient
aircraft parse and merge each type once into a template, in 3 ms slices, without the cabin (its
animated instruments stayed hundreds of moving nodes on every copy). Storefront lettering shares
its glyph vertices (`MeshBufferBuilder.addFlatMesh`). The worldgen tile cache keys a semantic tile
by a fast hash of its JSON (the cache never leaves the session) rather than SHA-256, which spent up
to 20 ms on a dense town tile. Ground cutouts read positions straight from their arrays and pass
over triangles whose corners share a side outside every opening, or that one of a convex opening's
edges separates from it. Parked cars bake from their template arrays, and
`EarthAudioTerrain.sample` skips map features whose bounds cannot come nearer than the nearest
found.

For custom streamed geometry, call `await renderer.prepareObject(object, signal, parent)` before
publication. Connect the same queue to terrain, which passes each layer's tile group as `parent`:

```ts
const terrain = await createTerrainPackagePyramidStream(packageDescriptor, {
  admission: viewer.renderer.admission,
  prepareObject: (object, signal, parent) =>
    viewer.renderer.prepareObject(object, signal, parent),
  elevationWorker: new Worker(new URL('./elevation-worker.ts', import.meta.url), { type: 'module' }),
  onElevationTiming: sample => { /* decode, resample, mesh; milliseconds */ },
});
```

The worker entry calls `installTerrainElevationWorker(self)`, exported from
`@bendyline/molen-terrain/client` (use the worker-scope type cast shown by World Explorer when
compiling with DOM rather than WebWorker types). The host reads archive bytes; the worker
owns PNG decoding, its decoded tile cache, ancestor resampling and surface meshing. Worker
buffers transfer without detaching archive caches or reusable topology. Omitting the worker
retains the in-thread path. Worker errors are surfaced; they do not silently trigger duplicate work.

Procedural texture baking can use `createMaterialBakeWorkerPool(workers)` from
`@bendyline/molen-materials`. Each worker entry calls `installMaterialBakeWorker(self)`. Pass
this caller-owned pool as `ClientOptions.materialBaker` or the second `MaterialResolver`
constructor argument, and dispose the pool when finished. Pixel grids and material graphs
return the synchronous baker's exact pixels through transferables. World Explorer uses two
startup workers and releases them when its style pack is baked; `materialWorker=0` retains
synchronous baking for comparisons. Its `material-bake` timing reports worker CPU time.

`withBakedMaterialStore(baker, store)` serves bakes from a persistent `BakedMaterialStore`, such as
`createIndexedDbMaterialStore()` from `@bendyline/molen-client`, so a later visit reads textures
instead of rasterizing them. Keys combine the document's content with a fingerprint of the
rasterizers (a tiny bake that exercises every node type), so a changed baker never serves stale
pixels and its old entries are pruned. Store failures fall back to baking. `createEarthWorldgen`
and `mountEarthView` accept the store as `materialStore`; World Explorer passes the IndexedDB store
unless `materialCache=0`.

Terrain and content bytes persist the same way through a `BlockCache` from
`@bendyline/molen-pack/cache`, passed to `mountEarthView` as `byteCache` (see
[the Earth view](earth-view.md)). It saves network and decompression time, not frame time: decoding
and meshing still run for every tile the stream loads. Long-horizon byte prefetch reads bytes only.
The Earth view also prepares nearby future tiles through the normal construction and GPU queues,
so aircraft can arrive over already prepared terrain and layers even without persistent caching.

A generation worker runs one tile at a time, in the order requested (the stream asks for what the
view needs most first); interleaved, every tile in flight finished late, the nearest with the
rest. It yields to its event loop every 8 ms of work, through a message channel, so a
`cancel` message gets through. It used to yield after every step with a zero `setTimeout`, which a
browser holds for at least 4 ms once timers nest: a dense tile took a second of wall time for a
fifth of a second of work. Streaming generators also pass `hashOutput: false`: the SHA-256 over
every output array (`WorldgenBatchOutput.hash`, for tooling and determinism checks) was a fifth
of a dense tile's generation, and nothing reads it there; compare outputs with
`hashWorldgenOutput`.

World-generation workers also prepare building spatial cells and full/structural LOD indices.
The renderer requests `renderCellsOnly` when using cell LODs so it does not retain a redundant
canonical building mesh. Per-cell Three object assembly is a separate queue job. Generation
and cell-preparation timings are reported separately. Compatible opaque groups are merged
by the resolved Three material, including groups with different authored references that resolve
to the same material. Transparent group order is preserved.

World props (trees, ground cover, rocks, rooftop and street props) keep one batch per model per
coarse terrain tile, and four per finest tile, so near detail stays around the camera's own quarter.
On WebGPU, three.js keys an `InstancedMesh`'s node state by the mesh (about 11 ms of main thread
for a plant batch, per draw target and material) and declared its matrices as a uniform array sized
to the batch and named after its node, so every batch also compiled a GPU pipeline of its own; when a
frame created one, it stalled the browser's GPU process, for seconds in fast flight. The WebGPU
driver reads instance matrices from one named, runtime-sized storage buffer instead, so a material's
batches share one shader and one pipeline. `createInstancedPlacementLod` accepts any `cellSize`.

Lights are compiled into every lit shader: a light that joins or leaves the scene rebuilds every
object in view at once. Keep a streamed world's light set fixed. Earth hosts mount dioramas with
`localLights: false`, which keeps a diorama's own point and spot lights out of the world scene; a
football field's scoreboard glow, loading and unloading as an aircraft passed, froze its takeoff.

Terrain palettes compile once per mesh. Terrain index topology is immutable and shared in a
bounded CPU cache; use a copy before editing or transferring it. Grids and building cells use
16-bit indices when eligible. Terrain index arrays can be shared in CPU memory; separate Three
attributes can still allocate separate GPU index buffers. Building LODs share their attribute
objects and full-detail index where material grouping permits. Three r184 currently promotes
unnormalized 16-bit attributes (including indices) to 32-bit storage on its WebGPU path, so the
compact-index GPU saving applies to WebGL; worker/cache buffers remain compact on both paths.

## Terrain selection and transitions

Terrain selection refines the highest projected-error candidate within the leaf budget, instead
of retrying complete traversals with progressively relaxed thresholds. A 15% coarsening
hysteresis band retains detail near boundaries. Pass `previousTiles` when using the standalone
selector; the stream supplies its previous selection automatically. Pitched views use a
conservative field of view to retain ground beneath the camera.

Terrain requests establish coarse coverage first, then prioritize nearby visible ground before
distant refinement and the 12-degree turn margin. Ancestors precede equally distant descendants.
Distance is measured to tile bounds rather than tile centers, so large tiles do not push nearby
ground behind more distant requests. Semantic layers
use the same view priority and prepare resident selected leaves before the terrain handoff,
even while a slow sibling still holds the parent surface on screen. A replacement family shares
its displayed parent's view and distance priority: finishing its siblings releases prepared
nearby detail instead of leaving it hidden behind the old parent. Within that priority, the
replacement family finishes before finer leaves that it would keep hidden. The existing layer concurrency and residency limits
also bound this preparation. Layers that release the existing parent take priority over newly
eligible layers, so slow building work cannot occupy all slots ahead of a sibling's ground cover.
Multi-level refinements advance the whole replacement family together; one already prepared fine
leaf does not skip that intermediate handoff while its siblings still need it.
The previous terrain surface and its layers remain visible until
the layers they already display have finished construction and GPU preparation on their
replacements. Surfaces and inherited detail then switch together; new terrain cannot
occlude the previous detail while its own detail is still loading. This applies to refinement and
coarsening, including intermediate fallback tiles. Newly eligible detail, such as buildings
absent from a coarse parent, arrives when prepared without holding other tiles' completed detail
behind that parent. Cached LODs reuse their prepared geometry.

Previously unvisited ground can show its base surface immediately; its enabled layers appear
together once settled. Empty layer results count as ready. Failed replacement layers preserve
the old tiles until `retryFailed()` succeeds or the layer is disabled; on cold ground, successful
layers can still appear after another layer fails. Hidden layers do not delay a handoff. This
stages scene geometry rather than rendering a second full-screen image, and retains old visual
coverage under residency pressure until its replacement can safely take over.

`stream.update(view, futureViews)` additionally prepares the nearest refinement family at each
future position at the same selection quality, including semantic layers and GPU resources.
Future views are ordered by time; speculative preparation is capped at the larger of 16 tiles
or a quarter of `maxSelectedTiles`, and by spare residency. The 16-tile allowance keeps all four
approaching families possible even at the lowest render tier.
Earth predicts 2, 4, 8 and 12 seconds ahead, following a smoothed ground-track turn rate through
banks. Extrapolated turns stop at 90 degrees and travel at 4 km; teleports and entry animations
reset the predictor.
With at least three concurrent slots, up to half of each queue's existing capacity keeps future
preparation progressing while visible work remains queued. Upcoming tiles already in the normal
selection also receive this forward capacity; they need not be new speculative requests.
The remaining slots prioritize current coverage, and unused capacity can prepare more of the route.
Obsolete surface requests are cancelled on route changes. Redundant hidden ancestors become
reclaimable cache once finer terrain is resident; intermediates still needed for the current
replacement stay protected. Speculative tiles yield to displayed
coverage under memory pressure; oversized speculative tiles back off instead of rebuilding on
every update. `preloading` and `preloaded` in stream stats distinguish requested and ready leaves.

Earth's automatic render tiers retain at least four height and eight layer jobs, including at
Minimum: serializing landcover, water and buildings behind one job could never keep up with a
jet. Eight layer slots let a four-tile approach family prepare while current coverage advances.
Main-thread publication still uses the shared frame admission budget. Both Earth hosts use
`earthTerrainCacheBudget` to retain the device-sized terrain cache across quality changes.
`AdaptiveQualityController` can recover during continuous streaming when sustained frame cadence
and measured CPU **and** GPU work show headroom; loading without those measurements still blocks
upgrades. A moving world need not become completely idle before recovering from a costly startup.

Publications share one visibility pass: the tiles and layers admitted in a frame request it, and
it runs once after the admission flush, together with eviction. Reads that depend on what is
displayed (`displayedTiles`, `sampleHeight`, `isAreaReady`, `stats`, `pressure`) run a pending
pass first. A fast flight publishes dozens of tiles and layers per frame, and each had run the
whole handoff, layer, cutout and byte pass. The warm cache keeps most resident tiles hidden; a
hidden tile's subtree is left out of the scene's per-frame world-matrix walk (three walks hidden
objects too), and a rebase above it is applied when it shows again. `stats()` walks every resident
tile's objects for exact byte totals; a live panel passes `{ geometry: 'tracked' }` for the
retained estimate and visible-only counts. Ground cutouts stay on hidden tiles while their
openings remain, keep the source grid's indices for triangles away from every opening, and
re-count only the tiles whose ground they changed.

Height queries prefer displayed terrain and fall back to resident heights outside the visible
cut. An aircraft's center can pass behind its cockpit camera at a tile boundary; it must not wait
indefinitely for already cached ground to become visible before moving again.

`morphMilliseconds` enables refinement height morphs for bare surfaces; call
`stream.updateTransitions(nowMs)` in the frame loop. Vertices start on the actual parent
triangles and finish at their exact target positions with fixed horizontal coordinates. Grounded
semantic layers use coverage-preserving atomic replacement and hysteresis instead. Enabling
one finishes any surface morph before layer publication. Coarsening does not height-morph.
World Explorer uses 180 ms for bare terrain; deterministic `freeze` captures disable morphing.

## Collision neighborhoods

`WalkCollision` from `@bendyline/molen-client/navigation` gives walkers, driven cars and piloted
aircraft a triangle tree of the visible geometry around them. Two costs matter. The **scan** visits
every visible mesh under the root to notice streamed changes; it runs on `update` only when the
subject has left the neighborhood, when `rescanIntervalMs` has passed (the Earth hosts use 200 ms)
or after `invalidate()`. The **rebuild** transforms the nearby triangles into the tree; geometries
of 4096 triangles or more are walked through a per-geometry XZ index, built on first use and kept
with the geometry, so a terrain tile or building cell contributes only the triangles that can reach
the neighborhood instead of every triangle it holds.

A scan brings world matrices up to date only for what it visits (the root's chain, then each object
as the scan reaches it), and skips any group that declares an X/Z rectangle of its own frame as
`userData.walkFootprint` when the rectangle is out of reach: terrain tiles declare theirs, so a jet
that scans many times a second visits the few tiles beneath it rather than everything on screen.
Aircraft cabins (the spec's interior nodes) are `walkIgnore`: nobody walks into a cockpit, and
their parts made a walker's tree beside a parked aircraft take a third of a second to build.

A subject that moves tens of meters a second would otherwise recenter the tree every few frames.
Vehicles and aircraft use a wider `radius` with a larger `rebuildDistance`, and a `verticalRadius`
with `update(root, x, z, y)` so the ground far below an airframe never enters the tree; while it
flies high the tree is empty and rebuilds are free. World Explorer's aircraft use 48 m / 24 m / 40 m,
its cars 32 m / 12 m / 24 m; walkers keep the 24 m / 6 m default and the whole column, which their
placement ray needs. The kernel's own ground contact (`groundHeight`) does not depend on this tree.
Low over a forest an aircraft's neighborhood still held 100k triangles of crowns and shrubs; with
`instanceBounds: true` each instance of an instanced mesh enters the tree as its bounding box,
twelve triangles, which is all an airframe's probes and its chase camera need. Ground cover (plant
models drawn only at near detail) is never solid, and the tree splits at each level by selecting a
median rather than sorting, so a rebuild of that size takes milliseconds rather than most of a second.

## Measurement

World Explorer enables elevation workers, shared admission and shader warmup by default.
For controlled comparisons, query flags `elevationWorker=0`, `materialWorker=0`, `admission=0` and `warmup=0`
disable those individual paths (`worker=0` disables all generation workers). The performance
HUD's `data-graphics` JSON contains bounded distributions of decode/resample/mesh,
world-generation/preparation, assembly/upload/publication and frame CPU timing, plus admission
overrun counts. Queue delay is reported separately from work. Frame CPU does not include
all GPU execution; use the backend GPU timer and browser frame intervals as separate metrics.

On a laptop with two GPUs, check which one the browser renders with (the WebGL renderer string,
`WEBGL_debug_renderer_info`). Chrome on Windows may use the integrated GPU whatever a page asks
for; on one AMD Radeon 880M it froze presentation for about 200 ms every ten seconds, on an empty
page too, while the same machine's discrete GPU drew without a pause. Chrome's
`#force-high-performance-gpu` flag, or the browser's entry in Windows' graphics settings, selects
the discrete GPU.

Measure time to coverage, cold/loading and moving p95/p99, steady frame cost, draws, triangles,
retained bytes and image parity. Staging trades some time to full detail for smaller individual
publication stalls; compiled shaders and GPU buffers must be tested on a cold traversal too.
