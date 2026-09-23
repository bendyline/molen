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
    onSample(sample) { /* label, workMs, queueMs, bytes, overBudget */ },
  },
});
```

The queue limits synchronous work started per animation frame. One oversized indivisible job
runs alone and is reported as over budget. This is not a hard GPU/driver time bound. Texture
initialization, geometry preparation and async shader compilation use public Three facilities;
shared resources share pending preparation promises. A cancelled tile cannot cancel another
tile waiting on the same resource. Prepared static batches replace ordinary meshes only when
ready; stale batch results are discarded.
Instanced LOD meshes each prepare their own WebGPU node builder even when every buffer is
shared. Resident world-generation quality replacements use the same preparation/publication
path when supplied with `WorldgenRendererOptions.prepareObject` (enabled in World Explorer).

For custom streamed geometry, call `await renderer.prepareObject(object, signal)` before
publication. Connect the same queue to terrain:

```ts
const terrain = await createTerrainPackagePyramidStream(packageDescriptor, {
  admission: viewer.renderer.admission,
  prepareObject: (object, signal) => viewer.renderer.prepareObject(object, signal),
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

World-generation workers also prepare building spatial cells and full/structural LOD indices.
The renderer requests `renderCellsOnly` when using cell LODs so it does not retain a redundant
canonical building mesh. Per-cell Three object assembly is a separate queue job. Generation
and cell-preparation timings are reported separately. Compatible opaque groups are merged
by the resolved Three material, including groups with different authored references that resolve
to the same material. Transparent group order is preserved.

World prop cells start at 512 metres and grow with coarser terrain levels, capped at 8192 metres.
This retains fine nearby culling without creating thousands of tiny distant batches. Every prop
placement remains intact; larger cells trade some culling precision for fewer submissions.

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

Terrain requests preserve parent-first coverage and prioritize the camera view before the
12-degree turn margin at each level. Distance is measured to tile bounds rather than tile
centers, so large tiles do not push nearby ground behind more distant requests. Semantic layers
use the same view priority and prepare resident selected leaves before the terrain handoff,
even while a slow sibling still holds the parent surface on screen. Selected leaves take
precedence over temporary fallback detail. The existing layer concurrency and residency limits
also bound this preparation. The previous terrain surface and its layers remain visible until
all enabled, level-eligible layers of the replacement tiles have finished construction and GPU
preparation. Surfaces, land use, roads and buildings then switch together; new terrain cannot
occlude the previous detail while its own detail is still loading. This applies to refinement and
coarsening, including intermediate fallback tiles. Cached LODs reuse their prepared geometry.

Previously unvisited ground can show its base surface immediately; its enabled layers appear
together once settled. Empty layer results count as ready. Failed replacement layers preserve
the old tiles until `retryFailed()` succeeds or the layer is disabled; on cold ground, successful
layers can still appear after another layer fails. Hidden layers do not delay a handoff. This
stages scene geometry rather than rendering a second full-screen image, and retains old visual
coverage under residency pressure until its replacement can safely take over.

`morphMilliseconds` enables refinement height morphs for bare surfaces; call
`stream.updateTransitions(nowMs)` in the frame loop. Vertices start on the actual parent
triangles and finish at their exact target positions with fixed horizontal coordinates. Grounded
semantic layers use coverage-preserving atomic replacement and hysteresis instead. Enabling
one finishes any surface morph before layer publication. Coarsening does not height-morph.
World Explorer uses 180 ms for bare terrain; deterministic `freeze` captures disable morphing.

## Measurement

World Explorer enables elevation workers, shared admission and shader warmup by default.
For controlled comparisons, query flags `elevationWorker=0`, `materialWorker=0`, `admission=0` and `warmup=0`
disable those individual paths (`worker=0` disables all generation workers). The performance
HUD's `data-graphics` JSON contains bounded distributions of decode/resample/mesh,
world-generation/preparation, assembly/upload/publication and frame CPU timing, plus admission
overrun counts. Queue delay is reported separately from work. Frame CPU does not include
all GPU execution; use the backend GPU timer and browser frame intervals as separate metrics.

Measure time to coverage, cold/loading and moving p95/p99, steady frame cost, draws, triangles,
retained bytes and image parity. Staging trades some time to full detail for smaller individual
publication stalls; compiled shaders and GPU buffers must be tested on a cold traversal too.
