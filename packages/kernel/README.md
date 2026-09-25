# @bendyline/molen-kernel

The deterministic headless simulation kernel behind Molen: an ECS world on a fixed timestep, a
deterministic script host, snapshots and replay. No DOM, no three.js — it runs in a Web Worker
and in Node, and the same build produces the same state hash in both.

Part of [Molen](https://molen.dev), an AI-legible 3D experience engine: a deterministic headless
kernel, a three.js client, and a dev loop an agent can drive end to end.

## Install

```sh
npm i @bendyline/molen-kernel
```

ESM only, Node >= 22.13. Its only dependencies are `@bendyline/molen-schema` and `ses` (the
per-script `Compartment`).

> **Script trust:** scene scripts are evaluated in-process and run with the authority of that
> process. The `Compartment` and its tamed `Math`/`Date`/`Intl` endowments make simulation
> deterministic; they are not an isolation boundary (intrinsics are shared and mutable). Treat a
> scene manifest as source code. A kernel-only host can opt into SES `lockdown()` with
> `hardenScripts()` — see the scripting guide's "Script trust" section.

## Use

`buildWorld` is the one build order every host uses — scene data, then your systems, then the
manifest's scripts:

```ts
import { buildWorld, stateHash, Transform } from '@bendyline/molen-kernel';
import { validate } from '@bendyline/molen-schema';

const parsed = validate('scene', {
  format: 'molen/scene@3',
  name: 'drift',
  seed: 'demo',
  entities: [{ id: 'cube', components: { transform: { pos: [0, 1, 0] } } }],
});
if (!parsed.ok) throw new Error(parsed.formatted);

const world = buildWorld(parsed.value, (w) => {
  w.addSystem(
    (world, ctx) => {
      for (const [id, t] of world.query(Transform)) {
        world.set(id, Transform, { ...t, pos: [t.pos[0], t.pos[1], t.pos[2] + ctx.dt] });
      }
    },
    { name: 'drift' },
  );
});

world.stepN(30);
console.log(world.tick, stateHash(world)); // 30 sha256:08eb66ea0fc8ce55…
```

Rerun it and the hash is identical. Reads are frozen — never mutate what `get` or a query row
hands back; `set` and `patch` install a new object. Route randomness through the world RNG and
transcendental math through `dmath`; how far the hash then travels depends on which subsystems the
scene uses, which the [determinism guide](https://molen.dev/guide/determinism) states per
subsystem.

In the browser, wrap the same world in a `KernelHost` on the Worker's message port and let the
page mount `@bendyline/molen-client` on it.

## What's in it

| Entry point | For |
|---|---|
| `.` | `World` (ECS + four-phase tick), `buildWorld`, keyframes/deltas/`stateHash`, `KernelHost` + `Scheduler`, `defineExperience`, gameplay helpers (timers, tweens, FSM, hierarchy, lifetime) |
| `./testing` | `runHeadless`, `runReplay`, assertions and selectors, `diffKeyframes`, `perTickHashes` |
| `./determinism` | `dmath`, the seeded `Rng`, quaternion/transform math, `canonicalBytes` + `hashJson` |
| `./scripting` | the script host: `installScripting`, `installSceneScripts`, `ScriptAPI`, `hardenScripts` |
| `./kinematics` | cross-platform deterministic collision: `installKinematics`, `raycast`, `overlapCircle` |
| `./character` | `installCharacterController` — planar move + jump against a ground height |
| `./platformer` | `installPlatformer` — XY bodies against static boxes, with coyote time and jump buffering |
| `./terrain` | the ground-field hook: `installTerrain`, `groundFieldOf`, `terrainScriptApi` |
| `./vehicles` | mountable vehicles, seats, and `stepVehicle` driving |
| `./aircraft` | `installAircraft` / `stepAircraft` — fixed-wing and helicopter flight |
| `./world` | `World`, `Transform`, `defineComponent` and the RNG without the scripting runtime — for main-thread hosts that must not load SES (it hardens the whole page) |

## Status

0.x. Keyframe compatibility and hash comparability are gated on the exported `STATE_FORMAT`
constant, not on the package version, so a release that changes nothing about simulation
semantics leaves your save files and recorded `*.replay.json` fixtures valid. `ENGINE_VERSION`
rides along in a keyframe as metadata only. The API still moves with the engine's single version
line; capability subpaths are the newest and least settled part of it.

## Docs

- [Quickstart](https://molen.dev/guide/quickstart) — zero to cubes in Node and the browser
- [The headless agent dev loop](https://molen.dev/guide/agent-loop) — author, validate, simulate, assert, screenshot
- [Game logic: scripts and setup](https://molen.dev/guide/scripting) — the script verb set and setup modules
- [API reference](https://molen.dev/api/kernel/index)

MIT © Bendyline LLC
