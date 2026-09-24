# Mounting an experience in a browser page

The headless loop proves a scene; the browser plays it. The same manifest drives both: the
kernel runs in a Web Worker built with `buildWorld` (which installs the scene's scripts), and
the page mounts a client on that Worker with one call.

## worker.ts (the kernel)

```ts
/// <reference lib="webworker" />
import { startKernelWorker } from '@bendyline/molen-kernel';
import { project } from './project';

// Builds the world (scripts, commands and physics all from data) and serves it on this Worker's
// own port. Returns `{ world, host }` if you want to step or dispose it yourself.
startKernelWorker({ ...project() });
```

`startKernelWorker` takes `keyframeInterval` from the scene, so the page gets its first keyframe
promptly. Everything `buildWorld` accepts — `setup`, `physics`, `terrain`, `capabilities` — passes
straight through, and `host` carries `KernelHost` options such as `startPaused`.

## project.ts (the manifest, scripts inlined)

Tooling reads `scripts[].path` files from disk; a bundler does it with raw imports:

Scene scripts are read as text here too. Register the `molenScripts()` plugin in
`vite.config.ts` so a `.ts` script is type-stripped when Vite loads it raw — the browser never
sees TypeScript, and nothing is transpiled at runtime:

```ts
// vite.config.ts
import { molenScripts } from '@bendyline/molen-client/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [molenScripts()],
  // Worker bundles have their own plugin pipeline in Vite, and the kernel runs in the Worker.
  worker: { format: 'es', plugins: () => [molenScripts()] },
  build: {
    // Keep three.js and the client out of the entry chunk; see "Production builds" below.
    rollupOptions: { output: { manualChunks: { vendor: ['three', '@bendyline/molen-client'] } } },
  },
});
```

```ts
import { loadProject } from '@bendyline/molen-kernel';
import sceneDoc from '../scene.json';
import typesDoc from '../types/main.types.json';   // omit when the scene declares no `type` refs

const scripts = import.meta.glob('../scripts/*.ts', { query: '?raw', import: 'default', eager: true });

export function project() {
  return loadProject({ scene: sceneDoc, types: typesDoc, scripts });
}
```

`loadProject` validates both documents, resolves the type registry, and inlines each script by
matching the glob's keys to the `path` the scene declares — so the glob's own prefix never has to
be stripped by hand. A bad document throws the validator's formatted message, the same text
`molen validate` prints; a script with no matching source names the keys it did have.

(Scenes whose scripts are all inline `code` still go through `loadProject` for the validation; the
`scripts` option is simply omitted.)

## main.ts (the page)

```ts
import { mountExperience } from '@bendyline/molen-client';
import { scene } from './scene';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

const { client } = await mountExperience({ link: worker, scene: scene(), canvas, clearColor: '#11131a' });
```

`mountExperience` creates the client, applies the scene's `camera` block (fixed / free-fly /
top-down-ortho / follow), wires the `input` block (bindings + `emit` rules: `press`, `release`, `axis2d`)
to `client.command`, and keeps the renderer sized to the canvas (ortho framing refits on resize).
It returns `{ client, input, dispose }`.

The call is asynchronous because it picks a graphics backend: `backend` defaults to `'auto'`,
which probes WebGPU and falls back to the existing Three.js WebGL renderer, so this page gets
WebGPU wherever the browser has it. Pass `backend: 'webgl'` to skip the probe — pinning a
backend is what makes a captured frame reproducible. `client.renderer.backend` reports the one
that actually initialized, and `client.renderer.fallbackReason` explains a fallback. See
[rendering backends](rendering-backends.md) for strict selection, material compatibility and
diagnostics.

### Production builds

A page that mounts with a top-level `await`, as above, needs three.js and
`@bendyline/molen-client` in a chunk of their own (the `manualChunks` line in the Vite config
above). The client lazy-loads its WebGPU driver. If the bundler leaves three.js and the client in
the entry chunk, that lazy chunk imports the entry while the entry is still suspended at the
`await`, the import never settles, and the built page stays blank in every browser with WebGPU,
with no error. The dev server does not bundle, so only the production build shows it. `molen new`
and every sample template already carry the setting.

## Feedback from the simulation

The client exposes what a HUD, sound, or win screen needs — no wire-protocol parsing:

```ts
client.onEvent('collision', (e, tick) => flash());
client.onEvent('*', (e) => log(e.type));
client.onDiag((d) => console.warn(d.code, d.detail));   // rejected commands, tick overruns
client.onError((e) => showStopped(e.message));           // the kernel died, or a frame threw
const hp = client.get('player', 'health');               // a detached copy of the component
client.entities();                                       // every mirrored entity id
client.tick;                                             // the latest applied kernel tick
```

Wire `onError` in every experience. It is the only signal for the two failures the simulation
cannot report about itself: the Worker throwing (its scheduler stops and the world faults, which
arrives as the `tick-failed` diagnostic and, when the Worker dies outright, as `link-error`), and
an exception escaping the client's own render frame (`frame-error`). Without it a broken kernel
looks exactly like a paused one — the last frame keeps rendering and nothing is logged.

Events arrive with their tick: on a delta's tick, or on the keyframe's tick when the kernel sent
a keyframe instead of a delta. Periodic keyframes keep the interpolation ring, so motion stays
smooth across keyframe boundaries.

## Holding the world until assets are in

A `KernelHost` starts ticking the moment it is constructed, so a scene with models to fetch
simulates through its own loading screen — enemies close in, timers run down, and the player
cannot act yet. Boot the worker paused and let the page start it:

```ts
// worker.ts
startKernelWorker({
  ...project(),
  host: { startPaused: true },   // the initial keyframe still posts, so the page renders
});                              // tick 0 while it loads
```

```ts
// main.ts
await client.ready();                           // every pending asset load has settled
client.control({ action: 'resume' });
```

`client.control` carries the rest of the scheduler surface too — `pause`, `step` for a fixed
number of ticks, `set-rate` to change playback speed (not the sim's `tickRate`), and
`request-keyframe`:

```ts
client.control({ action: 'pause' });
client.control({ action: 'step', ticks: 30 });  // advance exactly one second at 30Hz
client.control({ action: 'set-rate', hz: 15 }); // half-speed playback for a debug view
```

Stepping is what makes a browser test independent of machine speed: pause, send input, step a
known number of ticks, assert. A test that instead waits on wall-clock time is racing the
renderer, and on a software rasterizer it will lose.

## Manual frame loop

Pass `frameLoop: 'manual'` to drive rendering yourself (machinima camera tracks, custom timing):

```ts
const { client } = await mountExperience({ link: worker, scene: scene(), canvas, frameLoop: 'manual' });
function loop(now: number) {
  client.setCamera(evaluateCameraTrack(track, tick(now)));
  client.renderFrame(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
```

## The escape hatch

`client.renderer` is the three.js wrapper (`scene`, `worldRoot`, `camera`, `setCamera`,
`setTopDownOrtho`, `setSize`), and `client.getObject(id)` hands back the three.js object bound to
an entity — take it from there rather than searching `worldRoot`, because that is what releases a
statically batched entity into its own object:

```ts
const player = client.getObject('player');   // or client.backend for the whole surface
player?.add(myParticleSystem);
```

`mountExperience` is built from public pieces you can use directly: `await createClient(link, opts)`,
`applySceneCamera(camera, renderer)`, `applyInputRules(input, inputMap, emit)`,
`createClientCore({ link, backend })` (renderer-free and synchronous, for tests and custom
backends). See
[three-surface.md](three-surface.md).

Entity-follow cameras use scene data and the renderer interpolation buffer; see
[game samples](game-samples.md#follow-cameras) for overhead, first-person, and side-scroll configurations.

## Controller profiles and remapping

The mounted `input` supports keyboard, joystick/gamepad axes and buttons, named profiles, and
runtime rebinding. See [Input profiles and joysticks](input.md) for scene declarations and the
optional React remapping editor. Hosts can build their own UI with the same API.
