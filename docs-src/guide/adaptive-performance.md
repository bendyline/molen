# Adaptive rendering performance

The world explorer defaults to **Auto (device)** quality. It measures frame cadence, CPU frame
work, and asynchronous GPU time when the WebGL extension is available. Six rendering tiers
target 60 FPS without changing simulation state. Manual Economy, Balanced, and High remain
available and can be selected without reloading or moving the camera.

## Feedback and budgets

`AdaptiveQualityController` from `@bendyline/molen-client` returns a new integer tier when the
host should change its budgets. It evaluates one-second windows, uses trimmed frame averages
and slow-frame/p90 statistics, and waits for warmup and sustained overload before lowering detail.
Memory pressure can also lower detail. Recovery requires stable headroom, no pending streaming,
and memory margin in displayed content; failed upward probes increase the recovery delay. Hidden intervals and
isolated long pauses reset or bypass measurements instead of being mistaken for normal rendering.

The explorer applies each tier to drawing-buffer resolution, terrain screen-space error and
range, selected/resident tile limits, terrain and semantic request concurrency, worldgen cache
bytes, object LOD error, and surface decoration budgets. Pixel limits include high-DPI and
ultrawide displays. CPU caches and resident geometry have separate limits:

| Tier | Maximum rendered pixels | Terrain error | Selected tiles | Resident buffer budget | Worldgen cache |
| --- | ---: | ---: | ---: | ---: | ---: |
| Minimum | 450,000 | 10 px | 16 | 96 MiB | 24 MiB |
| Low | 700,000 | 7 px | 24 | 144 MiB | 32 MiB |
| Medium | 1,100,000 | 5 px | 40 | 208 MiB | 48 MiB |
| Balanced | 1,800,000 | 3.5 px | 64 | 288 MiB | 64 MiB |
| High | 2,800,000 | 2.4 px | 96 | 400 MiB | 96 MiB |
| Ultra | 4,000,000 | 1.75 px | 128 | 544 MiB | 128 MiB |

Resident byte estimates count retained height arrays, geometry attributes/indices and instance
buffers, deduplicating shared backing storage within each object. They exclude textures, archive
caches and GPU copies, so they are not total device memory measurements. The resident cap is soft:
visible ground remains until a replacement is loaded. The controller uses `displayedByteRatio`
for feedback so a full, reclaimable warm cache does not prevent recovery. Total resident bytes
still control eviction. After asynchronous surface replacements settle, `refreshMemoryUsage()`
updates the cached estimates. Existing surface grids keep their resolution
to preserve drape alignment; newly admitted terrain uses the current cap.

## Object detail and visibility

`ScreenSpaceLod` and `ScreenSpaceLodPolicy` from `@bendyline/molen-worldgen/client` use rendered
viewport height, camera field of view/zoom, conservative spatial bounds and a configurable pixel
error. The same mutable policy updates resident objects without generation or instance uploads.
Perspective and orthographic cameras are supported, including parent scale and floating origins.
Transitions have 15% hysteresis.

Builtin vegetation uses three shared models in spatial cells; the far fir/conifer is 12 triangles
and the far broadleaf crown is 20. Building cells use authored materials nearby, a single
vertex-color material farther away, then remove window/door/trim faces while retaining walls,
roof shapes and foundations. Cell bounds let frustum culling reject offscreen batches.
These are conservative authored detail tolerances, not measured mesh-simplification error bounds.

Terrain selection also culls by horizontal view direction. Mesh frustum culling and the GPU
depth buffer are active. There is no hierarchical depth/terrain occlusion culling; objects behind
hills may still submit vertices. Custom GLBs retain their authored geometry until lower-detail
assets or a simplification path are supplied.

## Background work and instrumentation

World generation, land-cover draping, and road/parking/junction construction use separate workers
in the explorer. They transfer typed buffers, skip obsolete queued work and retain the current
surface while a replacement is generated. Surface quality changes are bucketed to avoid repeated
rebuilds. Archive decoding, terrain mesh construction, scene assembly and GPU uploads still use
the main thread; streaming selection runs at 10 Hz.

`createGpuFrameTimer(renderer.three.getContext())` returns an optional timer. Call `poll()`
before a frame, `begin()` before rendering, and `end()` afterward. Pass only new completed GPU
samples to the controller. It samples one frame in four by default, has a bounded query queue,
never waits for a result, discards disjoint measurements, and handles context loss/restoration.
Call `dispose()` when the renderer is destroyed. Frame-time adaptation works without the extension.

The separate performance HUD shows Auto's active tier/change reason, frame average/max/p90,
CPU/GPU timing, actual draw/triangle counts, drawing-buffer dimensions and resident buffer budget.
These measurements are distinct from cumulative generation counters. Use `?quality=auto` for
adaptation; explicit `quality=economy|balanced|high` fixes a preset. `?worker=0` and
`?surfaceWorker=0` are diagnostic fallbacks. Fixed-grid `?level=N` uses manual quality.

The approach follows screen-space refinement and memory budgeting described in
[Cesium's tileset API](https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileset.html), Three.js
[LOD hysteresis](https://threejs.org/docs/pages/LOD.html), and the
[Khronos asynchronous GPU timer specification](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/).
These mechanisms need representative hardware profiling; they do not guarantee 60 FPS on every
device or eliminate download latency.

Driving and walking share a nearby collision tree. Its bounding-volume hierarchy stores each
rendered triangle once, including overlapping roads, walls and interior portal covers. Rebuilding
as the player moves therefore avoids the recursive triangle duplication of spatial octree cells;
ray, capsule and vehicle-body queries still test the original surfaces.
