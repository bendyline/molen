# Adaptive rendering performance

The world explorer defaults to **Auto (device)** quality. It measures frame cadence, CPU frame
work, and asynchronous GPU time when WebGL timer queries or WebGPU timestamps are available.
Six rendering tiers target 60 FPS without changing simulation state. Manual Economy, Balanced,
and High remain available and can be selected without reloading or moving the camera.

## Feedback and budgets

`AdaptiveQualityController` from `@bendyline/molen-client` returns a new integer tier when the
host should change its budgets. It evaluates one-second windows, uses trimmed frame averages
and slow-frame/p90 statistics, and waits for warmup and sustained overload before lowering detail.
Memory pressure can also lower detail. Recovery requires stable headroom and memory margin in
displayed content. During continuous streaming, both CPU and GPU timings must show spare capacity;
without GPU timing, recovery waits for streaming to settle. Failed upward probes increase the
recovery delay. Hidden intervals and isolated long pauses reset or bypass measurements instead
of being mistaken for normal rendering.
While content streams, slow frames lower detail only when the measured CPU/GPU frame work is itself
heavy: streaming work runs outside the frame, and a lower tier would restart it. After a memory
step, the controller lets that step's lower-detail replacements load (up to the recovery delay)
before stepping again, since retained content keeps displayed bytes high until they arrive.
The explorer starts sampling once its first view has finished loading, or after 20 seconds: the
first frames carry one-time work (ground refining under the camera, collision trees rebuilt for
each refinement, models and materials arriving), and measured as overload it stepped a fast
desktop to the lowest tier before the visitor had moved.

The explorer starts at Balanced and can climb through High to Ultra, using measured performance
rather than the GPU's name. It uses `EARTH_STICKY_QUALITY` timings from the start: down after
2.5 s of sustained overload, up one tier after 20 s of headroom, and frame-time changes at least
6 s apart. Measurements use one-second windows, so these are approximate delays. A failed upward
probe doubles the recovery delay, up to 120 s; that history stays with the controller throughout
the session. Selecting a manual preset resets it. Hidden time and startup loading do not earn an
upgrade. Manual presets remain fixed.

High switches buildings to a more detailed preset, so promotions need sustained headroom and the
explorer applies the resolution, terrain, building, surface and shadow changes over separate
frames. Brief takeoff/streaming stalls do not immediately undo an upgrade. The embeddable Earth
view retains its separate default ceiling of Balanced (`maxQualityLevel: 3`) and its initial
12 s calibration policy; hosts can explicitly raise that ceiling.

The explorer applies each tier to drawing-buffer resolution, terrain screen-space error and
range, selected/resident tile limits, terrain and semantic request concurrency, worldgen cache
bytes, object LOD error, and surface decoration budgets. Every tier keeps at least 12 terrain and 24
layer requests in flight: they bound loading (archive reads, worker decoding and generation), not
main-thread work, which admission meters (see [graphics performance](graphics-performance.md)). At
4 and 8 a jet's newly selected tiles waited in line rather than loading while the workers sat
idle, and the coarse parent stayed on screen for a second or more. Pixel limits include high-DPI and
ultrawide displays. CPU caches and resident geometry have separate limits:

| Tier | Maximum rendered pixels | Terrain error | Selected tiles | Resident buffer budget | Worldgen cache |
| --- | ---: | ---: | ---: | ---: | ---: |
| Minimum | 450,000 | 10 px | 16 | 96 MiB | 24 MiB |
| Low | 700,000 | 7 px | 24 | 144 MiB | 32 MiB |
| Medium | 1,100,000 | 5 px | 40 | 208 MiB | 48 MiB |
| Balanced | 1,800,000 | 3.5 px | 64 | 288 MiB | 64 MiB |
| High | 2,800,000 | 2.4 px | 96 | 400 MiB | 96 MiB |
| Ultra | 4,000,000 | 1.75 px | 128 | 544 MiB | 128 MiB |

Each tier also names its sun shadow quality (`EarthPerformanceTier.shadows`): off at Minimum and
Low, medium at Medium, and high from Balanced up. On WebGPU the main pass keeps its render bundles
while shadows are on. In a replayed bundle that has not changed since it was recorded, only the
first object of each material refreshes in a render: that refresh redraws the shadow map and
updates the material's shared uniforms, and the snapshot of transforms and material properties
re-records the bundle when anything else changes. Node materials whose owners set `uniform()`
values each frame (terrain water's time, the ground's origin) still refresh every object. A node
material without such values sets `userData.bundleStatic` to refresh like the rest (the scatter
and building materials do); three.js would otherwise refresh every node-material object each
frame, about 1,500 refreshes a frame at street level. Bundles exist only inside
the frame. Between frames, warm-up compiles run the sun's shadow pass over the scene, and there
the groups draw normally, so a tile that an admission job swapped and disposed is never replayed
from a stale bundle. Once a WebGPU shadow map
exists it keeps its size, and "off" stops redrawing it and fades it out rather than releasing it,
because three.js's WebGPU shadow node cannot be torn down and rebuilt in place. WebGL parks the
map the same way once a light has cast shadows: each lit program is built for the shadows it
receives, and clearing them rebuilt every program in view, synchronously, in the next frame
(seconds of frozen flight when a tier crossed into Low). Earth hosts turn shadows on once before
anything is built, so tier changes only stop or resume drawing the map. A parked map still draws
once when a caster of a new kind (instanced, skinned, alpha-tested, another side) is prepared, so
its depth program is built as it streams in rather than with every other one in the frame
shadows return. Tiers change cost, never the
look: the palette, light rig and styles are the same in every tier (see the
[medium-fi style guide](medium-fi.md#rendering-modes)).

Resident byte estimates count retained height arrays, geometry attributes/indices and instance
buffers, deduplicating shared backing storage within each object. They exclude textures, archive
caches and GPU copies, so they are not total device memory measurements. The resident cap is soft:
visible ground remains until a replacement is loaded. The explorer feeds the controller displayed
bytes over the fixed device budget (`earthMemoryBudget()`, as Earth view does), so a full,
reclaimable warm cache does not prevent recovery. It does not measure them against the tier's own
resident cap: each step down shrinks that cap, so a dense city's buildings would cascade every
step to the lowest tier while the view stayed the same. Total resident bytes
still control eviction. After asynchronous surface replacements settle, `refreshMemoryUsage()`
updates the cached estimates; the explorer passes `'displayed'`, re-counting only tiles on
screen, where surface detail changes in place. Its HUD shows displayed bytes ("shown") beside the
resident total. Existing surface grids keep their resolution
to preserve drape alignment; newly admitted terrain uses the current cap.

## Object detail and visibility

`ScreenSpaceLod` and `ScreenSpaceLodPolicy` from `@bendyline/molen-worldgen/client` use rendered
viewport height, camera field of view/zoom, conservative spatial bounds and a configurable pixel
error. The same mutable policy updates resident objects without generation or instance uploads.
Perspective and orthographic cameras are supported, including parent scale and floating origins.
Transitions have 15% hysteresis. World Explorer scales the tier's pixel error with height above
the ground, from 100 m up (three times the budget at 300 m, at most four), so a flying camera
spends no GPU time on tree and building detail below a pixel; street and rooftop views keep the
tier's budget.

Builtin vegetation uses three shared models in spatial cells; the far fir/conifer is 12 triangles
and the far broadleaf crown is 20. Building cells use authored materials nearby, a single
vertex-color material farther away (where window glass keeps a dark glass tone rather than turning
white, and buildings still cast shadows), then remove door, trim and detail faces while retaining
walls, roof shapes, foundations and windows, so a distant facade keeps its rows of windows. Cells
store positions as 16-bit offsets with one uniform scale per cell and normals as 8-bit values,
20 bytes a vertex instead of 35. Cell bounds let frustum culling reject offscreen batches.
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
