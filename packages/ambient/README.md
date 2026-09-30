# @bendyline/molen-ambient

Background life for Molen: NPC cars, pedestrians, trains and aircraft that move on a transport
network built from roads, railways and paths, spawned around an observer and removed behind it.

Part of [Molen](https://molen.dev), an AI-legible 3D experience engine: a deterministic headless
kernel, a three.js client, and a dev loop an agent can drive end to end.

## Install

```sh
npm i @bendyline/molen-ambient
```

Node >= 22.13, ESM only. There is deliberately **no `.` export**: import
`@bendyline/molen-ambient/kernel` or `@bendyline/molen-ambient/client`. The client half needs the
optional peers `three` (`>=0.184.0 <0.187.0`) and `@bendyline/molen-client`; the kernel half
needs neither, and runs in a Worker and in Node.

## Use

A scene opts in with an `ambient` block. The `molen` CLI installs the capability for any scene
that has one, so `molen validate`, `molen sim run` and `molen shot` work with no extra wiring:

```json
{
  "format": "molen/scene@3",
  "name": "crossroads",
  "tickRate": 60,
  "ambient": {
    "network": {
      "format": "molen/transport-network@1",
      "ways": [
        { "class": "road", "subclass": "primary", "points": [[-300, 0], [300, 0]], "lanes": 4 },
        { "class": "road", "subclass": "residential", "points": [[0, -300], [0, 300]] }
      ],
      "signals": [{ "at": [0, 0], "kind": "light" }]
    },
    "observer": "camera-rig",
    "density": { "car": 16 }
  },
  "entities": [
    { "id": "camera-rig", "components": { "transform": { "pos": [30, 0, 30], "rot": [0, 0, 0, 1] } } }
  ]
}
```

In a browser, the worker adds the capability and the page adds the renderable kind:

```ts
// worker.ts
import { ambientCapability } from '@bendyline/molen-ambient/kernel';
import { startKernelWorker } from '@bendyline/molen-kernel';

startKernelWorker({ scene, capabilities: [ambientCapability()] });

// main.ts
import { ambientVehicleKind } from '@bendyline/molen-ambient/client';
import { mountExperience } from '@bendyline/molen-client';

await mountExperience({ link: worker, scene, canvas, kinds: [ambientVehicleKind()] });
```

A host that steps its own world installs the kernel directly and feeds it map tiles or documents:

```ts
import { createAmbientRenderer } from '@bendyline/molen-ambient/client';
import { installAmbient } from '@bendyline/molen-ambient/kernel';

const ambient = installAmbient(world, { classes: ['car', 'pedestrian', 'train'] });
ambient.addDocument(network);
ambient.setObserver({ pos: [0, 1.7, 0], forward: [0, 1] });
const renderer = createAmbientRenderer({ world, parent: scene });
// each frame: world.step(); renderer.update(cameraPosition, dt);
```

`@bendyline/molen-earth` runs it on the streamed map by default (`mountEarthView({ ambient })`).

## What's in it

| Entry point | For |
| --- | --- |
| `./kernel` | The `molen/transport-network@1` format, the lane graph (planar junctions, lanes, connectors, conflicts, signals, tile stitching), the observer-driven spawner, car following, pedestrians, train consists and aircraft corridors, the `ambientAgent` / `ambientObserver` / `ambientRole` components, `ambientCapability` for scenes, and `molen.ambient.*` for scripts. |
| `./client` | `createAmbientRenderer` for main-thread worlds (instanced proxies, pooled full models near the camera, procedural pedestrian figures, aircraft), and the `ambient-vehicle` renderable kind (`ambientVehicleKind()`) for Worker hosts. |

Agent state lives in hashed components; the network, occupancy and signal phases are derived, so
traffic replays and restores like the rest of the world.

## Status

0.x, versioned independently of the other `@bendyline/molen-*` packages. The
`molen/transport-network@1` format is versioned and beta. Known limits: map data carries no turn
restrictions or speed limits, aircraft fly straight corridors, and pedestrians follow their lane
without stepping around each other.

## Docs

- [Ambient life: traffic, pedestrians, trains and aircraft](https://molen.dev/guide/ambient-life)
- [Earth view](https://molen.dev/guide/earth-view)
- [Transport network format](https://molen.dev/schemas/transport-network)

MIT © Bendyline LLC
