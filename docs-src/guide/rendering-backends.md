# WebGPU and WebGL rendering

Molen renders through Three.js WebGPU or the Three.js `WebGLRenderer`. Selecting one is a
`backend` option, not a choice of function: every client factory is asynchronous because picking
a backend is, and `backend` defaults to `'auto'`, which probes WebGPU and falls back to WebGL.
So a page that does nothing special gets WebGPU where the browser has it.

```ts
import { mountExperience } from '@bendyline/molen-client';

const { client, dispose } = await mountExperience({
  link: worker,
  scene: manifest,
  canvas,
});                                          // backend: 'auto' is the default

console.log(client.renderer.backend);        // 'webgpu' or 'webgl'
console.log(client.renderer.fallbackReason); // explains an automatic WebGL fallback
```

`createClient(link, options)`, `createSnapshotViewer(keyframe, options)`, `createViewer(options)`
and the low-level `Renderer.create(options)` take the same option and return the same promise;
`createViewer` is the one for terrain viewers and other hosts without a simulation Worker.
Awaiting the factory *is* awaiting initialization, so the client you get back is ready for
backend-specific materials and the first frame. `createClientCore` stays synchronous — it has no
renderer to initialize.

| `backend` | Behavior |
| --- | --- |
| `'auto'` (default) | Initialize WebGPU when available; otherwise initialize the legacy Three.js WebGL renderer and expose the reason. |
| `'webgpu'` | Require WebGPU. Initialization rejects if it cannot be used; this is useful for testing that WebGPU actually executes. |
| `'webgl'` | Use the legacy Three.js WebGL renderer directly, skipping the WebGPU probe. |

Pin `'webgl'` when the pixels have to be reproducible rather than fast: a golden frame must not
depend on which backend a runner happened to offer. The CLI capture harness and the worldgen
preview page both pass `backend: 'webgl'` explicitly for that reason.

WebGPU requires a supporting browser, GPU adapter, and secure context (HTTPS or localhost).
Its availability can vary with browser policy, graphics drivers and execution environment.
The browser exposing `navigator.gpu` alone does not establish that device initialization works.
An automatic fallback uses `THREE.WebGLRenderer`, preserving existing GLSL materials and the
legacy rendering path, rather than Three's alternate WebGL implementation inside
`WebGPURenderer`.

Automatic fallback covers initialization. A device lost after startup cannot switch the
same canvas into a WebGL context safely; use `onDeviceLost(reason)` to show recovery UI and
reload with `backend: 'webgl'`. The world explorer stops its frame loop and displays this
recovery instruction. Reconstructing the GPU world after a runtime loss is not automatic.

## What WebGPU costs your bundle

`three/webgpu` is a second Three.js build, so the WebGPU backend is real bytes: bundled, it is
about **530 KB** beyond the WebGL core. Molen keeps it behind a dynamic import, and the engine only
reaches that import after `navigator.gpu.requestAdapter()` hands back an adapter. Two consequences
worth knowing:

- **A device without WebGPU never downloads it.** A page served to headless Chromium with software
  rendering requests only the app and worker chunks; the WebGPU chunk is not fetched. Falling back
  costs one adapter request, not a download.
- **Your bundler still emits the chunk.** It is in the module graph, so a production build contains
  it whether or not your users have WebGPU. That is the price of supporting both backends from one
  package, and it is lazy rather than wasted.

`backend: 'webgl'` skips the probe at runtime but does not remove the chunk from a build. A
deployment that will never use WebGPU can drop it by pointing the specifier at a stub. The client
takes exactly four runtime names from `three/webgpu`, so the stub is short:

```js
// webgpu-stub.js
const missing = () => {
  throw new Error('three/webgpu was stubbed out at build time');
};
export const WebGPURenderer = missing;
export const WebGPUBackend = missing;
export const CanvasTarget = missing;
export const BundleGroup = missing;
```

```js
// vite.config.js
export default { resolve: { alias: { 'three/webgpu': '/webgpu-stub.js' } } };
```

Measured over the published client entry, that removes 532 KB and one chunk. Pair it with
`backend: 'webgl'` so nothing ever reaches the stub; if something does, the throw is caught and
`'auto'` falls back to WebGL with the reason on `renderer.fallbackReason`.

## Materials and existing hosts

Standard Three materials, geometry, textures, instancing, lighting and Molen's camera APIs are
shared between the backends. Custom `ShaderMaterial`, `RawShaderMaterial`, and GLSL
`onBeforeCompile` hooks need node-material/TSL equivalents for WebGPU. Select the material
from the **actual** `renderer.backend`, since an `auto` request may have fallen back.

The world explorer includes both atmosphere implementations: `Sky` for WebGL and the
node-based `SkyMesh` for WebGPU. Atmospheric parameters, sun direction and depth settings are
aligned, and SkyMesh's default clouds are disabled to preserve the existing clear sky.
Both keep the sky outside the world's floating-origin group.
The sky depth-tests against the correct far plane, including reverse depth, so cached terrain
commands can execute before the sky without being covered by it.

Generated building and landmark uploads align packed RGB vertex colors to a four-byte stride
for WebGPU. The color attribute remains a normalized RGB triplet, preserving its WebGL
appearance and the kernel/worker buffer format.

For terrain water, use terrain's own asynchronous material factory when supporting both
backends:

```ts
import {
  createTerrainWaterMaterialAsync,
  setTerrainWaterTime,
} from '@bendyline/molen-terrain/client';

const water = await createTerrainWaterMaterialAsync(
  { color: '#286d83', waveScale: 0.028, waveStrength: 0.045 },
  client.renderer.backend,
);

// Each frame: compensate for origin rebasing so wave patterns remain world-anchored.
const origin = client.renderer.getWorldOrigin();
setTerrainWaterTime(water, seconds, [origin[0], origin[2]]);
```

Terrain keeps a synchronous `createTerrainWaterMaterial()` that returns the existing WebGL
material. WebGPU-specific code and shader modules are loaded on demand by the asynchronous path.
Code directly using `renderer.three` should check `renderer.backend` before accessing APIs
specific to one backend, such as a WebGL context.

`preserveDrawingBuffer` is a WebGL option. For WebGPU canvas readback, render immediately
before capturing in the same task, or use a render target and explicit readback. CLI reference
captures stay on WebGL by pinning `backend: 'webgl'`.

## WebGPU performance

`backend: 'auto'` prefers WebGPU. WebGPU optimization is enabled by default too;
pass `optimizeWebGpu: false` to disable the instance-upload and command-cache optimizations
for a controlled comparison. This does not change backend selection, resolution or detail.

Small instance sets use Three's uniform-buffer shaders. Molen avoids uploading unchanged
instance matrices again, using the attribute's `version` rather than comparing matrix contents.
After `setMatrixAt` or direct array edits, set `mesh.instanceMatrix.needsUpdate = true`, as
required by Three. Shared LOD attributes retain their identity. A local adapter for Three's
WebGPU backend (r184–r186, the supported peer range) applies this check only to recognized
instance-matrix buffers; camera, material, animation and other uniforms continue updating
normally. Revalidate this adapter before widening the three peer range. Large instance buffers retain Three's vertex-attribute path.

Use `renderer.createRenderGroup()` for independent opaque terrain/content chunks. It returns
a managed WebGPU `BundleGroup`, or a normal Three `Group` on WebGL. The pyramid terrain stream
accepts `createTileGroup: () => renderer.createRenderGroup()`; World Explorer already uses it.
The renderer checks command state on every frame, updating LOD and re-recording when the
camera, hierarchy, visibility, transforms, draw counts, geometry, materials or lighting change.
During camera motion it uses normal draw submission and skips command snapshots, retaining
Three's frustum and LOD decisions without rebuilding bundles on every frame. Caching resumes
when the view settles.
Statistics include draws executed from cached bundles, not just newly recorded commands.
The pinned renderer also refreshes every instance's material observer even in a static bundle.
Molen skips that refresh only for an initialized, verified unchanged render object without
node animation; changed frames, new objects and animated materials retain normal updates.

These chunks must be independent in draw order. Do not put content requiring ordering across
chunks (such as coplanar overlays) into separate render groups. Transparent materials, disabled
depth testing/writing, skinning, video textures, custom draw callbacks, clipping, XR, shadows and
scene overrides use ordinary rendering instead of command caching. Nested managed groups disable
the outer cache.
Time-based node materials still receive Three's per-frame node updates.

The world explorer also accepts `gpuOptimizations=0` for an uncached WebGPU comparison.

## Testing the world explorer

Run the example with `pnpm --filter @bendyline/molen-examples-world-explorer dev`, then compare
the same location and settings using `?backend=webgpu` and `?backend=webgl`. Omitting the
parameter, or using `?backend=auto`, enables automatic selection. The performance HUD displays
the backend that actually rendered and any automatic fallback reason; its
`#performance-status` element also exposes `data-backend` and `data-fallback-reason` for tests.

For comparisons, keep `quality`, viewport dimensions, device-pixel ratio, camera position,
layer mode and loaded assets the same. A manual quality such as `quality=balanced` prevents
the adaptive controller from choosing different detail during a comparison. `freeze` freezes
the water animation for screenshots. World Explorer requests multisample antialiasing by default
(4x MSAA on WebGPU; context antialiasing on WebGL); pass `antialias=0` only when measuring its
cost. Allow tiles, assets and shader pipelines to warm up
before collecting frame statistics; record startup separately.

Use `renderer.createGpuTimer()` for optional asynchronous GPU timing. It returns `undefined`
when the backend or device lacks usable timestamps. Unavailable timestamps are not zero GPU
cost; CPU/frame timings remain useful. The world explorer already integrates this timer into
its adaptive-quality controller.

WebGPU is an additional rendering backend, not a guaranteed frame-rate improvement. Backend
comparisons require the same workload on real GPU hardware. Software adapters are useful for
API/shader correctness and fallback testing, but their timings do not predict hardware gains.
Keep WebGL reference screenshots pinned to `backend=webgl`; test WebGPU separately rather than
silently regenerating a backend's visual baseline from another renderer.

After building, `pnpm -r test:golden` runs browser regression coverage, including the backend
suite. That suite's default launch uses explicit SwiftShader flags for portable software
execution; WebGPU cases report a skip if Chromium cannot create an adapter/device, while the
WebGL and fallback cases still run. Require WebGPU and use the browser's normal hardware
selection with these PowerShell commands:

```powershell
pnpm -r build
$env:MOLEN_REQUIRE_WEBGPU = '1'
$env:MOLEN_WEBGPU_ARGS = '[]'
$env:MOLEN_WEBGPU_CHANNEL = 'chrome'
pnpm --filter @bendyline/molen-tooling exec vitest run --config vitest.golden.config.ts test/golden/webgpu.golden.test.ts
```

`MOLEN_REQUIRE_WEBGPU=1` makes an unavailable adapter/device fail the suite and also defaults
to normal browser arguments. `MOLEN_WEBGPU_CHANNEL=chrome` selects installed Google Chrome;
omit it to use Playwright's bundled Chromium. Browser builds can have different GPU support,
so an unavailable adapter in bundled Chromium does not establish that installed Chrome lacks
WebGPU. `MOLEN_WEBGPU_ARGS` accepts a JSON array that overrides launch
flags; `[]` explicitly selects normal browser behavior. To require execution through a
software WebGPU adapter, supply
`["--enable-unsafe-webgpu","--use-webgpu-adapter=swiftshader","--use-angle=swiftshader","--enable-unsafe-swiftshader"]`
instead. The suite writes capability diagnostics with browser version, launch flags and
adapter information, so a passing run can be identified as hardware or software execution.

`MOLEN_SKIP_WEBGPU=1` does the opposite: every golden suite treats WebGPU as unavailable, so
WebGPU cases report a skip while the WebGL, fallback and node-WebGL cases still run. CI's golden
job sets it. Its CPU-only runners expose a SwiftShader WebGPU adapter but lose the device on the
world explorer's scenes, which leaves a blank canvas and "Instance dropped" errors. WebGPU coverage
therefore comes from local runs and from GPU runners with `MOLEN_REQUIRE_WEBGPU=1`. The two
switches contradict each other; with both set, the suites fail.

This backend integration does not add GPU-driven terrain selection, compute culling, indirect
draws or a new lighting pipeline. Those are separate optimizations to evaluate after measuring
the shared rendering path.
