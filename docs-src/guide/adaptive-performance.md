# Adaptive rendering performance

The world explorer defaults to **Auto (device)** quality: one of six rendering tiers, guessed once
from what the device reports and then kept for the session, without changing simulation state.
Nothing a frame costs moves it afterwards. Manual Economy, Balanced, and High remain available and
can be selected without reloading or moving the camera. The embeddable Earth view's `'auto'`
chooses at the beginning and keeps its choice the same way (see below).

## Feedback and budgets

`AdaptiveQualityController` from `@bendyline/molen-client` returns a new integer tier when the
host should change its budgets. It evaluates one-second windows, uses trimmed frame averages
and slow-frame/p90 statistics, and waits for warmup and sustained overload before lowering detail.
Memory pressure can also lower detail. Recovery requires stable headroom and memory margin in
displayed content. During continuous streaming, both CPU and GPU timings must show spare capacity;
without GPU timing, recovery waits for streaming to settle. Failed upward probes increase the
recovery delay. Hidden intervals and isolated long pauses reset or bypass measurements instead
of being mistaken for normal rendering. A second pause within a minute of rendering
(`pauseRepeatMs`) is a stall rather than a tab resume, and lowers detail one level.

Frame times cannot show a level that streams more than it can hold: that work runs outside the
frame. A host can report it as `strained` in each sample. Strain blocks upgrades at once and,
sustained for `strainDelayMs` (10 s), lowers detail with the reason `'streaming'`. Neither the
explorer nor the Earth view reports it: tiles built again soon after their eviction (the terrain
stream's `thrashedTiles`) are what turning over one place does, three full turns over downtown
Seattle rebuilt two fifths of their tiles that way with the near ground at its selected detail
throughout, and a level given up for it took the city off the screen to save worker time.
`upgradeWorkFraction` (default 0.9) is the share of the target that measured frame work must
stay under before a step up.
While content streams, slow frames lower detail only when the measured CPU/GPU frame work is itself
heavy: streaming work runs outside the frame, and a lower tier would restart it. After a memory
step, the controller lets that step's lower-detail replacements load (up to the recovery delay)
before stepping again, since retained content keeps displayed bytes high until they arrive.
The explorer starts sampling once its first view has finished loading, or after 20 seconds: the
first frames carry one-time work (ground refining under the camera, collision trees rebuilt for
each refinement, models and materials arriving), and measured as overload it stepped a fast
desktop to the lowest tier before the visitor had moved.

## Auto is chosen at the beginning and kept

A tier change swaps resolution, shadows, terrain detail and tile budget across the whole view at
once: every tile in view is given up for a coarser one that has to be built first, and built
again when the tier comes back. What a frame costs depends on where the camera is, what it is
doing and what else the machine is doing more than on the tier. Each rule that let the tier
follow frame times, once a view was under way, lost a flight the world it was flying over:

- Followed both ways, a piloted aircraft weaving over a city went Balanced, Medium, Balanced,
  High in four minutes, each step a visible drop or rebuild.
- Guessed once but given up for good on slow frames, streaming strain or memory, a long session
  ran down to Minimum, where a street view shows bare ground with no buildings near and has
  nothing left to load.
- With a lowered tier brought back after a minute of calm, a P-51 over Seattle with other work on
  the machine lost two tiers to slow frames in forty seconds. At Low the ground beneath it was the
  box shells of a tile four times too coarse, with no roads, until the tiers came back and it was
  all built again. Turning over downtown did the same through streaming strain.
- The Earth view, after its calibration, went down a tier after 2.5 s under 50 frames a second and
  came back after 20 s of headroom, for as long as it ran.

So neither moves once it is under way.

**The explorer** starts at `earthInitialQualityLevel()` (Low on touch devices and at 2 GiB or less,
Medium at 4 GiB, otherwise Balanced) and keeps that tier: no frame rate lowers it, nothing about
the stream does, and nothing raises it. A device the guess is wrong for has the quality menu: a
manual preset is a tier by choice, and choosing Auto again makes the guess afresh. High is a
manual preset (Ultra, whose view alone holds most of the terrain cache, is reached only with
`?tier=5`); `?tier=N` holds one tier outright.

**The Earth view** (`quality: 'auto'`) starts at the same guess, no higher than
`maxQualityLevel` (default 3, Balanced), and calibrates at the beginning: for the first seconds
after its first view has settled it runs the controller with its quick recovery and cooldown
(`EARTH_CALIBRATION_QUALITY`: down after 2.5 s of overload, not one burst of streaming as a
takeoff reveals the view), so a slow device settles on what it can draw. Once a level has held for
`EARTH_QUALITY_CALIBRATION_MS` (12 s) that is the level for the session, and the controller is not
asked again (`stats().qualityCalibrating` turns false). `setQuality('auto')` starts over.

Calibration moves two levels differently. The level the view is *drawn* at
(`stats().qualityLevel`: resolution, shadows, clouds, ambient life, how soon a model hands over
to a coarser one) follows the controller, since each of those changes in place. The level the
world is *built* at (`stats().worldQualityLevel`: how far the ground refines, how many tiles are
held, building and surface quality) follows it upward, for a tablet that starts low and proves
faster, and is never taken below the level the device started at: a busy first minute on a
capable machine costs resolution, not the city.

**Memory is the one exception, in both.** What is on show holding more than the memory budget
(`earthMemoryBudget()`, or a host's `memoryBudget`) for ten seconds running, or more than a
quarter past it for two, gives one level up, with half a minute for the lower level's tiles to
take over before the budget is judged again (`createEarthMemoryGuard`). Shorter spells are
handovers, when a tile and what replaces it are both on show. The level does not come back:
over the same place it would outgrow the budget again, and each round is the whole view rebuilt.
Left alone, a view over its budget ends with the tab killed. A host that sets `memoryBudget`
should size it for the level it wants kept in the densest place it shows. The explorer's panel
says when this has happened ("Auto · Medium · lowered for memory, kept"), and choosing Auto again
restores the guess.

The explorer's panel also says how the ground near the camera stands: "ground within 2km 96%
finished · level 14.8 of 15". Finished means drawn at the detail the view selects, with its
layers. Coarse ground that is finished is all the view asks for (the tier, the camera's height or
its speed); coarse ground that is not finished is late.

The explorer applies a tier's resolution, terrain, building, surface and shadow changes over
separate frames, as the Earth view does when calibration or `setQuality` changes its level.

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

Those are each tier's own limits. Hosts pass them through `earthTerrainBudget` and
`earthWorldgenCacheBytes`, which raise the resident limits to the device's memory budget and the
worldgen cache to a quarter of it: one view of a dense city can pass a tier's cap alone, and a cache
with no room for hidden tiles loses everything the moment it leaves the view.

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
still control eviction, farthest tiles first. After asynchronous surface replacements settle,
`refreshMemoryUsage()` updates the cached estimates; the explorer passes `'displayed'`,
re-counting only tiles on screen, where surface detail changes in place. Its HUD shows displayed
bytes ("shown") beside the resident total. Existing surface grids keep their resolution
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
vertex-color material farther away (where window glass keeps the tone a pane shows up close, its
sky reflection included, and buildings still cast shadows), then remove door, trim and detail faces while retaining
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
Auto; explicit `quality=economy|balanced|high` fixes a preset. `?worker=0` and
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
