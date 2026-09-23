# @bendyline/molen-client

The browser half of Molen: a three.js renderer that syncs itself from a kernel's keyframes and
deltas over a Worker message port, interpolates between ticks, and turns a scene's camera and
input blocks into a running experience.

Part of [Molen](https://molen.dev), an AI-legible 3D experience engine: a deterministic headless
kernel, a three.js client, and a dev loop an agent can drive end to end.

## Install

```sh
npm i @bendyline/molen-client
```

ESM only; the runtime target is the browser, and Node >= 22.13 is what the toolchain around it
expects. three.js is a pinned **dependency** (0.184.0) with its types, not a peer — nothing else
to install, and nothing to reconcile with a different three version. The `./vite` subpath is a
build-time plugin and the one Node-only entry point.

## Use

The page owns the canvas; a Worker owns the simulation. `mountExperience` is the one call that
joins them:

```ts
import { mountExperience } from '@bendyline/molen-client';
import { validate } from '@bendyline/molen-schema';

const parsed = validate('scene', await (await fetch('/scene.json')).json());
if (!parsed.ok) throw new Error(parsed.formatted);

const { client, dispose } = await mountExperience({
  link: new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
  scene: parsed.value,
  canvas: document.getElementById('view') as HTMLCanvasElement,
  clearColor: '#11131a',
});

client.command('move', { x: 1, z: 0 });
client.onEvent('collision', (event, tick) => console.log(event.type, tick));
client.onError((error) => console.error(error.source, error.message));
```

It creates the client, applies the scene's `camera` block (fixed / free-fly / top-down-ortho /
follow), wires the `input` block's bindings and emit rules to `client.command`, keeps the
renderer sized to the canvas, and returns `{ client, input, dispose }`. The Worker side is
`buildWorld` + `KernelHost` from `@bendyline/molen-kernel` on the same manifest.

Wire `onError` in every experience: it is the only signal for the two failures the simulation
cannot report about itself — a Worker that died (`source: 'link'`) and an exception escaping the
render frame (`source: 'frame'`).

The mount is asynchronous because it picks a graphics backend. `backend` defaults to `'auto'`:
WebGPU when the browser has it, the Three.js WebGL renderer otherwise, with
`client.renderer.backend` reporting which one initialized. Pass `backend: 'webgl'` to skip the
probe — a pinned backend is what makes a captured frame reproducible.

## What's in it

| Entry point | For |
|---|---|
| `.` | `mountExperience`, `createClient`, `createSnapshotViewer` (render one keyframe), `createViewer` (no kernel) — all four asynchronous, each taking `backend` — plus `createClientCore` (renderer-free, synchronous), `Renderer`, `ThreeSceneBackend`, `SceneMirror`, `MaterialResolver`, `AssetCache`, `InputMap`, `InterpolationBuffer`, `AdaptiveQualityController`, and a `THREE` re-export |
| `./camera-track` | `molen/cameratrack@1`: `registerCameraTrackSchema` + `evaluateCameraTrack` for scripted camera moves |
| `./vite` | `molenScripts()` — a Vite plugin that type-strips `*.ts?raw` scene scripts so the browser never sees TypeScript |
| `./vehicles` | `createVehicleVisual`, `createParkedVehicleBatch`, `vehicleCameraPose` — car visuals and cockpit/chase views, the render half of `@bendyline/molen-kernel/vehicles` |
| `./aircraft` | `createAircraftVisual`, `aircraftCameraPose` — animated airframe and instrumented cockpit, the render half of `@bendyline/molen-kernel/aircraft` |

Renderables are data, not three.js objects: primitives and glTF assets described by a
`renderable` component, with materials resolved from `palette:`, `matgraph:` and `pixelgrid:`
refs at load time. When you do need the real object, `client.getObject(id)` hands it over (and
un-batches the entity so your edits stay visible); `client.backend` and `client.renderer` are the
wider escape hatches.

## Status

0.x. The wrapper surface (`mountExperience`, `client.*`) is the stable part; everything reached
through `backend`, `renderer` or `getObject` is explicitly unstable — you own whatever you mutate.
The three.js pin moves with engine releases, so treat 0.184.0 idioms as authoritative over older
ones. WebGPU support is newer than the WebGL path; `backend: 'auto'` reaches for it and falls
back, and `backend: 'webgl'` opts out.

## Docs

- [Mounting an experience in a browser page](https://molen.dev/guide/browser-mount) — worker, scene, page
- [The three.js surface](https://molen.dev/guide/three-surface) — what the client wraps, and the escape hatch
- [WebGPU and WebGL](https://molen.dev/guide/rendering-backends) — backend selection and material compatibility
- [API reference](https://molen.dev/api/client/index)

MIT © Bendyline LLC
