# @bendyline/molen-figures

Stylized people and animals for Molen: presets and descriptors, canonical rigs, deterministic
gaits and sockets in the kernel; procedurally generated skinned bodies in the client.

Part of [Molen](https://molen.dev), an AI-legible 3D experience engine: a deterministic headless
kernel, a three.js client, and a dev loop an agent can drive end to end.

## Install

```sh
npm i @bendyline/molen-figures
```

Node >= 22.13, ESM only. There is deliberately **no `.` export**: import
`@bendyline/molen-figures/kernel` or `@bendyline/molen-figures/client`. The client half needs the
optional peers `three` (pinned to exactly `0.184.0`) and `@bendyline/molen-client`; the kernel
half needs neither, and runs in a Worker and in Node.

## Use

The kernel half decides what a figure is and how it moves — hashed state, no three.js. The client
half generates and poses the body. Neither is a mover: figures sit on top of whatever moves the
entity (`kinematicBody`, `character` + `moveIntent`, a rapier `velocity`, or transform deltas).

```ts
// Worker or Node: the kernel half
import { installHierarchy, World } from '@bendyline/molen-kernel';
import { FigureState, installFigures } from '@bendyline/molen-figures/kernel';

const world = new World({ tickRate: 60, seed: 'npc' });
installHierarchy(world);
const figures = installFigures(world);

world.spawnRaw(
  {
    transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
    figure: { preset: 'human.adult', height: 1.7, palette: { top: '#3b6ea5' } },
    kinematicBody: { vel: [1.4, 0, 0], slide: true },
  },
  'npc',
);
world.stepN(30);

world.get('npc', FigureState); // { mode: 'walk', speed: 1.4, strideRate: 1.137, phaseAt: 0, ... }
figures.socket('npc', 'hand.r'); // the right hand's world transform under this tick's pose
```

```ts
// Page: the client half
import { mountExperience } from '@bendyline/molen-client';
import { figureKind } from '@bendyline/molen-figures/client';

await mountExperience({ link: worker, scene, canvas, kinds: [figureKind()] });
```

In a scene, an entity carries `figure` plus `renderable: { kind: 'figure', ref: 'procedural' }`;
the `molen` CLI installs these systems on every world, so `molen validate`, `molen sim run --hash`
and `molen shot` work on it with no extra wiring.

## What's in it

| Entry point | For |
| --- | --- |
| `./kernel` | Descriptors and the nine presets (`human.adult`, `dog`, `horse`, …), canonical biped and quadruped rigs, the pure pose function `evaluatePose`, Froude-number gait selection, the `figure` / `figureIntent` / `figureState` / `figureAttachment` components, sockets, riders, and `molen.figures.*` for scripts. |
| `./client` | The `figure` renderable kind (`figureKind()`), the three-tier body geometry cache, `figureGeometry` / `figureBodyToSkinnedMesh`, and `applyPose`. |

Rigs, meshes and poses are derived; only `figureState` and attachment transforms enter the state
hash, and speed is quantized so a steadily walking figure sends no deltas.

## Status

0.x, on one fixed version line with every other `@bendyline/molen-*` package. The `molen/figure@1`
format is versioned and beta. Known limits: hands are mittens (a thumb on the near tier), there
are no faces beyond eyes and brows, foot planting on uneven ground and quadruped IK are not
evaluated yet, and imported skinned glTF figures plus skinned-GLB export are later phases.

## Docs

- [Figures: humans, bipeds and quadrupeds](https://molen.dev/guide/figures)
- [3D art guidelines](https://molen.dev/guide/3d-art-guidelines)
- [Examples gallery](https://molen.dev/guide/examples)

MIT © Bendyline LLC
