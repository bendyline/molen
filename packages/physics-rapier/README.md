# @bendyline/molen-physics-rapier

Opt-in Rapier rigid-body physics for Molen, mirrored into the ECS: `collider3d` and `rigidbody`
components, joints, forces, spatial queries, and a snapshot that survives save/restore.

Part of [Molen](https://molen.dev), an AI-legible 3D experience engine: a deterministic headless
kernel, a three.js client, and a dev loop an agent can drive end to end.

## Install

```sh
npm i @bendyline/molen-physics-rapier
```

Node >= 22.13, ESM only, one `.` export. This is a **kernel-only** capability: no three.js, no DOM,
no client half. `@dimforge/rapier3d-compat` (pinned to `0.19.3`) and `@bendyline/molen-kernel`
come with it — the WASM runtime is loaded by `initRapier()`, which **must be awaited before**
`installRapier()` or the install throws a named error rather than an opaque WASM failure.

## Use

```ts
import { World } from '@bendyline/molen-kernel';
import { initRapier, installRapier } from '@bendyline/molen-physics-rapier';

await initRapier(); // once per process, before any install
const world = new World({ tickRate: 60, seed: 'drop' });
const physics = installRapier(world, { gravity: [0, -9.81, 0] });

world.spawnRaw(
  {
    transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
    collider3d: { shape: { type: 'cuboid', hx: 10, hy: 0.5, hz: 10 } }, // no body = static
  },
  'floor',
);
world.spawnRaw(
  {
    transform: { pos: [0, 5, 0], rot: [0, 0, 0, 1] },
    rigidbody: { body: 'dynamic' },
    collider3d: { shape: { type: 'ball', radius: 0.5 }, restitution: 0.1 },
  },
  'ball',
);

world.stepN(180); // 3 s: the ball rests at y = 0.999 (floor top 0.5 + radius 0.5)
physics.raycast([0, 5, 0], [0, -1, 0], 10); // { id: 'ball', distance: 3.50, point, normal }
physics.dispose(); // frees the Rapier world and detaches the system + snapshot provider
```

A scene with a `physics` block can skip all of that: `installScenePhysics(world, manifest)`
installs from the manifest when its `engine` is `"rapier"`, and `rapierScriptApi(handle)` hands
scene scripts `raycast`, `overlapSphere` and `velocityOf` under a namespace you name (by
convention `molen.physics.*`).

## What's in it

- Components: `collider3d` (ball, cuboid, capsule, convex hull, trimesh, `asset`, `heightfield`),
  `rigidbody`, `joint`, `force`, `impulse`, `setVelocity`, and the opt-in `velocity` mirror.
- `installRapier` / `installScenePhysics` / `rapierScriptApi`, plus a handle with `raycast`,
  `overlapSphere`, `velocityOf`, the live `world` escape hatch, and `dispose`.
- `ShapeResolvers` so `asset` and `heightfield` shapes resolve without any filesystem access here
  — a `@bendyline/molen-terrain` `Heightfield` gives you one via `toRapierHeightfield()`.

## Status

0.x, on one fixed version line with every other `@bendyline/molen-*` package.

**Determinism is narrower here than elsewhere in Molen.** Rapier is deterministic on the same
build and platform only, *not* across platforms — unlike the built-in `kinematics` engine, which
is cross-platform deterministic. A replay recorded on one machine may diverge on another when the
scene sets `physics.engine: "rapier"`, so keep portable regression fixtures on the built-in
engines and treat rapier hashes as same-machine checks. The scene schema says the same thing.

## Docs

- [Scene manifest: the `physics` block](https://molen.dev/schemas/scene)
- [Authoring a capability package](https://molen.dev/guide/capability-authoring)
- [Examples gallery](https://molen.dev/guide/examples)
- [Terrain](https://molen.dev/guide/terrain) — heightfield colliders

MIT © Bendyline LLC
