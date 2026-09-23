# 05 — Client Design

Resolves brief §4 questions 5 (terrain LOD/streaming) and 10 (headless screenshots).
Public API in [02-packages-and-apis.md §4](02-packages-and-apis.md).

## 1. three.js wrapping layer

### 1.1 Version pin

Pin the latest stable three.js release at implementation time — **≈ r183 as of early-2026
knowledge; re-verify at task 0.12** (three releases monthly). Pin exactly
(`"three": "0.18x.0"`, no caret), one pin per engine release. Facts that shape decisions
below: WebGL1 support was **removed in r163** (kills the `headless-gl` Node path, §6);
`WebGPURenderer` (`three/webgpu` + TSL from `three/tsl`) is usable but its API still churns
release-to-release.

### 1.2 Renderer default: `WebGLRenderer` for Phases 1–2

1. **Headless capture.** Headless Chromium + SwiftShader renders WebGL2 reliably and
   near-deterministically; headless WebGPU still needs unsafe flags and is CI-flaky as of
   early 2026. The agent screenshot loop is a product requirement — it sits on the stable path.
2. **AI corpus.** GLSL and the classic renderer have an enormous training corpus; TSL is
   young and thinly represented (the brief's deviation tax).
3. **Stability.** The classic renderer is essentially frozen; WebGPURenderer still shifts.

So this doesn't become a trap:

- Nothing outside `@bendyline/molen-client` constructs a renderer; the wrapper exposes a
  renderer-agnostic handle.
- **The material stack compiles to textures, not shaders, in v1**
  ([06 §4](06-materials-and-assets.md)) — textures plug into `MeshStandardMaterial`
  identically under either renderer, sidestepping the GLSL-vs-TSL fork until Phase 3+.
- Hard rule: **no raw GLSL in shipped capability packages in Phases 1–2**, with one tracked
  exception — the terrain splat shader (§5). Custom-shader escape hatches are prefixed
  `unstable_`.
- Re-evaluate the WebGPU default at every three version bump; the gating item is headless
  capture reliability ([09](09-questions-and-risks.md) R5).

### 1.3 Wrapper shape: wrap lifecycle and conventions, not vocabulary

Re-inventing names for `Vector3` or `Mesh` would burn AI-legibility for zero gain.

**Wrapped (engine-owned):** renderer construction & frame loop (one construction path =
deterministic settings: pixel ratio, tone mapping, color space, AA, and the manual-frame
headless mode); scene-graph sync (the engine owns entity→Object3D; user code never
adds/removes synced objects directly); asset loading (`GLTFLoader`/`TextureLoader` behind a
caching `AssetRegistry` keyed by manifest refs, KTX2/Draco transcoders configured once);
material resolution (`materialRef` → material via rung resolvers); camera rigs (§3).

**Pass-through raw (documented as "this is just three.js"):** math types (`Vector3`,
`Quaternion`, `Color`) — used internally; the *protocol* uses plain arrays. Escape hatch:
`client.unstable_three` → `{scene, renderer, camera}`, outside the compatibility contract.

The wrapper module is the generation source for `three-surface.md` in the docs bundle
([07 §6.2](07-tooling-and-testing.md)) — the antidote to model-knowledge lag on three.js churn.

## 2. Kernel-state → scene-graph sync

### 2.1 The `renderable` component is the entire render contract

Shape in [03 §1](03-data-formats.md): `{kind: "gltf"|"primitive", ref, materialRef?,
primitive?, offset?, visible, castShadow, receiveShadow}` plus the standard `transform`.
Kernel logic sets it; the client interprets it; the kernel never knows what it means.
`transform` is interpolated; `renderable` is configuration — a change patches or rebuilds
the binding, never lerps.

### 2.2 Lifecycle: snapshot diffing

The client keeps `bindings: Map<EntityId, RenderBinding>`; deltas carry the authoritative
entity set.

- **Spawn:** entity present, no binding → create asynchronously (glTF may be in flight).
  **No placeholder meshes** — render nothing until loaded; agents screenshot-diff, and
  placeholders poison goldens. (The capture pipeline instead *waits* for loads, §6.)
- **Update:** `renderable` changed → cheap patch if only `visible`/`offset`/`materialRef`
  changed; full rebuild if `kind`/`ref` changed.
- **Destroy:** remove Object3D, release ref-counted assets via `AssetRegistry`.
- glTF instances are `clone()`d from one cached parsed asset; geometry/textures shared,
  materials cloned only when `materialRef` overrides.

```ts
interface RenderBinding {
  entityId: EntityId;
  root: THREE.Object3D;          // under scene; interpolated transform written each frame
  renderableVersion: number;
  state: "loading" | "live" | "failed";
}
```

### 2.3 Interpolation buffer

Render ~1.5 ticks behind sim (default `interpolationDelayTicks: 1.5` → 50 ms at 30 Hz,
imperceptible for flyover/top-down). Design:

- Ring buffer of the last 4 ticks of transforms (built by applying deltas to the mirror store).
- Estimated kernel clock:
  `estTick(now) = latest.tick + (now − latest.recvTimeMs) / tickMs`, EMA-smoothed to absorb
  postMessage jitter.
- `renderTick = estTick − delay`; find bracketing ticks `a ≤ renderTick ≤ b`;
  `t = (renderTick − a) / (b − a)`; **lerp** position/scale, **slerp** rotation.

Edge rules locked now:

- **Never extrapolate in v1** — clamp to latest. Under jitter the world micro-stutters rather
  than mispredicts; right call for flyover/top-down, and deterministic screenshots depend on
  it. FPS-phase work adds extrapolation + reconciliation (anticipated by the authority-model
  design, [01 §5](01-architecture.md)).
- Entities spawned mid-window **snap** to their first known transform (no lerp-from-origin).
- Despawning entities hold their last transform until removed.
- A `teleport` flag on a transform write suppresses interpolation for that entity that tick.

## 3. Cameras & input

### 3.1 Client-owned, kernel-directed

The camera is never a simulated body in early phases. Kernel logic publishes a
**camera directive** (a normal event on the snapshot stream); `CameraController` interprets:

```ts
type CameraDirective =
  | { mode: "free-fly"; start?: Pose; speed?: number; constraints?: { minHeight?: number } } // P1
  | { mode: "orbit"; targetEntity: EntityId; distance: number }
  | { mode: "top-down-ortho"; center: [number, number] | { followEntity: EntityId };
      viewHeight: number; rotationDeg?: 0 | 90 | 180 | 270 }                                 // P2
  | { mode: "fixed"; pose: Pose; projection: "perspective" | "ortho" };
```

- **Free-fly (Phase 1):** entirely client-side — WASD + mouse-look, smoothed at render rate,
  zero kernel round-trips (a flyover camera needs no adjudication). `minHeight` clamping uses
  the *client-side* terrain heightfield sample (§5.4), costing the kernel nothing.
- **Top-down ortho (Phase 2):** derived from directive + followed entity's interpolated
  transform.
- The client reports camera pose via a throttled (~4 Hz) advisory `view.report` command —
  for interest management and terrain residency, never trusted for gameplay.

### 3.2 Input → command flow

```
DOM events → InputMap (JSON-configured bindings → named actions)
  ├─ camera-local actions (free-fly move/look) → CameraController, never leave the client
  └─ game actions → CommandEmitter → {seq, source, tick: estTick, type, payload} → kernel
```

Bindings are data in the scene manifest ([03 §1](03-data-formats.md)) so agents author them
as text. Pointer picking (Phase 2): the client raycasts the *render* scene to resolve a
click to an entity/terrain coordinate, then emits a semantic command
(`{type: "select", payload: {entityId}}`) — a UX convenience; the kernel re-validates
(entity exists, is selectable). Authority never leaves the kernel.

## 4–5. Terrain rendering & streaming (`@bendyline/molen-terrain`)

### 5.1 LOD: quadtree chunked LOD with skirts (not clipmaps) for v1

- Chunks map 1:1 to **streamable file tiles**; clipmaps don't naturally tile, and streaming
  is in the Phase 1 definition.
- Chunked LOD is simple to implement, debug, and *explain to an agent* ("each chunk is a
  mesh at one of 4 resolutions").
- Cracks handled by **skirts** (chunk borders dropped by `2 × maxVerticalError(lod)`) instead
  of index stitching — visually fine for stylized rendering, removes the hardest part.
- Clipmaps win for huge view distances on a single giant heightfield — a Phase 3+ alternative
  *renderer* over the same tiled data; the descriptor format doesn't foreclose it.

### 5.2 Conventions

| Parameter | Default |
|---|---|
| Chunk world size | 128 m |
| Height samples per chunk edge | 129 (shared borders) |
| LOD levels | 4 (full, ½, ¼, ⅛ density) by distance bands [256, 512, 1024, 2048] m |
| Splat layers | 4 (RGBA weights), 256² splat tile per chunk |

### 5.3 Formats

**16-bit grayscale PNG** height tiles (the Unity/Unreal-adjacent convention: lossless,
viewable in any tool, 65k steps over the height range is ample; rejected raw float32 —
precision nobody needs, zero tooling visibility, sidecar-dimension hassle). RGBA8 PNG splat
tiles, weights renormalized in the sampler. JSON descriptor `molen/terrain@2`
([03 §10](03-data-formats.md)). Height/slope **auto-banding lives in the terrain layer
config** (`auto: {slopeMin, heightMin…}`), not in material graphs — graphs stay pure-UV.

### 5.4 Kernel/client ownership split

- **`@bendyline/molen-terrain/kernel`:** the *logical* heightfield — `sampleHeight(x,z)` (bilinear),
  `raycastDown`, region queries — for game logic and the kinematics ground provider. No
  meshes, no three.js.
- **`@bendyline/molen-terrain/client`:** chunk meshes, LOD selection, skirts, the splat material
  (the one tracked GLSL exception), and a *client-local* heightfield sample used only for
  camera constraints.
- Both halves decode the **same PNG tiles independently**: the kernel (Node + Worker, no DOM
  guarantees) uses a small pure-TS grayscale-PNG16 decoder shipped in the package
  (deterministic everywhere); the client uses `createImageBitmap` + canvas readback for
  speed. The double-fetch of resident tiles is accepted — it keeps the kernel/client
  boundary message-light and lets a flyover run with kernel terrain entirely disabled
  ([09](09-questions-and-risks.md) noted alternative: client fetches and transfers
  ArrayBuffers — a contained protocol change if hosting costs ever matter).
- **Phase 1 call: kernel collision OFF by default** (`collision.enabled: false`) — the
  kernel doesn't even load tiles; camera clamping is the client-side sampler. Honest about
  kernel smallness. Collision-on ships in Phase 2 (units standing on terrain).

### 5.5 Streaming flow: client-driven residency

```
client: camera moves → ChunkManager computes desired set (radius + LOD bands)
client: fetches missing height/splat tiles (HTTP), builds meshes, LRU-evicts far chunks
client → kernel (only if collision enabled):
        command terrain.residency { resident: ["3_4", "3_5", …] }
kernel: loads/decodes listed tiles for sampling; evicts others
kernel → client: event terrain.residencyAck { ready: […] }
        (lets logic gate spawns on collision-ready ground)
```

One command, one event, no bulk data over postMessage. In Phase 2, gameplay-critical chunks
(around units, not the camera) are *added by the kernel itself* from entity positions —
kernel correctness never depends on the client's advisory residency.

## 6. Headless screenshot pipeline

### 6.1 Options

| Path | Verdict |
|---|---|
| Node `gl` (headless-gl) | **Non-viable.** WebGL1-only (WebGL2 support never landed), sparsely maintained, and three.js removed WebGL1 in r163 — modern three cannot run on it at all. Nobody should spend a day rediscovering this. |
| OffscreenCanvas in a Worker | A *browser* feature — solves "render off the main thread," not "render without a browser." A building block for in-page capture, not the headless answer. |
| **Playwright + bundled Chromium (SwiftShader)** | **Primary path** for the agent loop and CI goldens. Real Chromium = the exact production renderer; SwiftShader software WebGL2 is deterministic per-build; works on GPU-less CI; boring, maintained infrastructure. Cost: ~1–2 s cold per capture, amortized to ~100–300 ms with a warm context pool; ~150 MB Chromium in the agent toolchain ([09](09-questions-and-risks.md) Q1). |

### 6.2 Architecture: snapshot-render

The capture page never runs a live kernel. Flow (shared by MCP `screenshot_scene` and
`molen shot`):

1. Simulate to tick N **in Node** (direct kernel import, `stepN`) and serialize a keyframe.
2. Pinned Playwright Chromium (flags `--use-gl=angle --use-angle=swiftshader`) loads a tiny
   static capture page that boots `@bendyline/molen-client` via `createSnapshotViewer(keyframe)` in
   `frameLoop: "manual"`.
3. Wait for the **asset-load barrier** (all bindings `live`, or timeout → warning in stats).
4. Render exactly one frame; return PNG + stats via `page.evaluate`.

The MCP server keeps a **warm browser-context pool** — without it the agent loop feels 10×
worse.

### 6.3 Contract & determinism

Request/response shapes in [03 §12](03-data-formats.md). **Forced settings in capture mode
(non-negotiable):** `pixelRatio: 1`, `antialias: false`, fixed tone mapping + output color
space, manual frame loop (exactly one render), fixed seed, `preserveDrawingBuffer: true`,
asset-load barrier, time uniforms derived from tick only (never `Date.now`).

The stats block (`drawCalls, triangles, entitiesRendered, chunksResident, warnings`) matters
as much as the PNG — "47 entities rendered, 3 renderables still loading" often lets an agent
skip vision entirely.

Golden-image comparison policy (tolerances, CI-container-only golden recording, flake
quarantine) lives in [07 §5.3](07-tooling-and-testing.md). Key fact: SwiftShader is
deterministic **per build**, not bit-stable across Chromium versions or OSes — goldens are
recorded only in the pinned CI container, and the diff tool must clearly distinguish
"within local tolerance" from "CI-authoritative."
