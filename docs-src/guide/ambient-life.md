# Ambient life: traffic, pedestrians, trains and aircraft

`@bendyline/molen-ambient` fills a world with background life: cars that keep to their lanes and
stop at signals, pedestrians on footways, trains that dwell at stations, and aircraft crossing
overhead. Agents spawn in a ring around an observer, out of its line of sight, and are removed
once it moves away. The same simulation runs in a scene with a hand-drawn street grid and in the
[Earth view](earth-view.md) on mapped roads.

The package has a **kernel half** (`/kernel`: the transport network, the spawner and the agents,
all deterministic) and a **client half** (`/client`: instanced vehicle proxies, pooled full models
near the camera, and animated figures for pedestrians). There is no root export.

## Quick start

Add an `ambient` block to a scene. This one draws a crossroads with a signal and a footway, and
spawns traffic around the `camera-rig` entity:

```json
{
  "format": "molen/scene@3",
  "name": "crossroads",
  "tickRate": 60,
  "ambient": {
    "network": {
      "format": "molen/transport-network@1",
      "ways": [
        { "id": "main", "class": "road", "subclass": "primary", "points": [[-300, 0], [300, 0]], "lanes": 4 },
        { "id": "cross", "class": "road", "subclass": "residential", "points": [[0, -300], [0, 300]] },
        { "id": "walk", "class": "path", "subclass": "footway", "points": [[-300, 12], [300, 12]] }
      ],
      "signals": [{ "at": [0, 0], "kind": "light" }]
    },
    "observer": "camera-rig",
    "classes": ["car", "pedestrian"],
    "density": { "car": 16 }
  },
  "entities": [
    { "id": "camera-rig", "components": { "transform": { "pos": [30, 0, 30], "rot": [0, 0, 0, 1] } } }
  ]
}
```

```sh
npx molen validate scene.json
npx molen sim run scene.json --ticks 600
npx molen shot scene.json --ticks 600 --camera 40,25,45 --look 0,0,0 --out crossroads.png
```

`sim run` reports what the block produced:

```text
tick: 600
events: 0
ambient: 58 car, 17 pedestrian on 14 lanes (75 spawned, 0 removed)
```

Tooling installs the capability for any scene with the block, and the capture page draws the
agents, so `validate`, `sim`, `replay` and `shot` need nothing else. A scene without the block
pays nothing and has no `molen.ambient` namespace.

## The transport network

Agents move on a `molen/transport-network@1` document: polylines called ways, plus optional
stations, signals and aerodromes. Coordinates are scene metres, `[x, z]` or `[x, y, z]` where `y`
is the road surface height.

| Field | What it holds |
|---|---|
| `ways[]` | `class` (`road`, `rail`, `path`, `air`, `water`), `subclass` (the OSM kind, for example `primary`, `residential`, `service`, `footway`, `tram`), `points`, and optionally `oneway`, `lanes`, `width`, `speed` (m/s), `layer`, `bridge`, `tunnel` |
| `stations[]` | `id`, `at: [x, z]`, `kind` (`rail`, `bus` or `ferry`), `dwell` in seconds. Trains stop at the rail station nearest their track |
| `signals[]` | `at: [x, z]` and `kind`. A `light` signalises the junction nearest the point. A `stop` or `yield` sign makes the arm it stands on give way |
| `aerodromes[]` | `id`, `at: [x, z]`, `heading`, `length`. Some aircraft fly its approach and departure |
| `drivingSide` | `right` (default) or `left`; individual `ways[].drivingSide` can override it |
| `sidewalks` | Infer walk lanes along streets that have no mapped path nearby (default false) |

The network is built into a lane graph when it is added:

- **Lanes.** A way carries `lanes` in total, split between directions (all forward when `oneway`).
  Without `lanes`, the count follows the width. Lanes sit to the right of travel for right-hand
  traffic and to the left for left-hand traffic. One-way point order is unchanged; only lateral
  lane order and turn permissions mirror. Mixed-side networks retain each road's rule on export.
- **Junctions.** Ways that share a point, cross, or end on another way at the same `layer` are
  joined. Different layers, and bridges over roads, never connect mid-way. Each lane gets a curved
  connector to every exit it may take, and movements that cross each other take turns.
- **Control.** A junction is signalised when a `light` is near it, or when four or more arms meet
  and one is a major road. An arm with a `stop` or `yield` sign gives way, and so does a service
  road or a link where it joins a street. Elsewhere cars take the junction in arrival order, one
  conflicting movement at a time.
- **Tunnels** keep their traffic: agents inside are simulated but flagged `hidden`, so they are
  not drawn.

### Baking a network from map data

For a scene on real terrain, bake the roads, railways and paths of a terrain package into a
document:

```sh
npx molen network bake terrain/terrain-package.json --tile 15/5247/11439 --radius 1 --out network.json
npx molen validate network.json
```

`--bbox west,south,east,north` takes an area in degrees instead of a tile. `--classes road,rail`
keeps only some classes, and `--heights` adds surface heights from the package's elevation. The
document's `origin` records the latitude and longitude it was baked at. The MCP tool
`network_bake` does the same.

Reference the file from the scene by path, relative to the scene:

```json
{ "ambient": { "network": "network.json", "observer": "player" } }
```

## The scene block

Every field is optional. [`molen/scene@3`](../schemas/scene.md) lists them with the rest of the scene.

| Field | Meaning |
|---|---|
| `network` | A path to a transport-network document, or the document inline |
| `observer` | The entity the spawn ring follows |
| `classes` | Which classes run: `car`, `pedestrian`, `train`, `aircraft`, `boat` (default `["car"]`) |
| `density` | Target agents per kilometre of lane near the observer, per class. For `aircraft` it is the number in the sky |
| `drivingSide` | `right` (default) or `left`, when the network does not say |
| `radius` | Outer spawn radius for cars in metres (default 350) |
| `despawnRadius` | Distance beyond which cars are removed (default 1.3 × `radius`) |
| `templates` | A prefab name per class. Every spawned agent of that class receives its components |
| `seedSalt` | Mixed into the scene seed, to vary the traffic without reseeding the scene |

Templates are how agents join the rest of the game. The
[City Courier](https://molen.dev/play/city-courier/) sample gives its traffic a prefab with a box
`renderable`, a `collider` and an engine `audioSource`, so the courier can bump into cars and hear
them pass:

```json
{
  "prefabs": {
    "npc-car": {
      "extends": "box",
      "components": {
        "renderable": { "primitive": { "size": [1.45, 0.7, 2.6] }, "materialRef": "palette:#df735e" },
        "collider": { "shape": "circle", "radius": 1.3, "layer": 1, "mask": 2 },
        "audioSource": { "sound": "vehicle.engine.car", "gain": 0.6 }
      }
    }
  },
  "ambient": { "templates": { "car": "npc-car" } }
}
```

Without a template, vehicles get the `ambient-vehicle` renderable and pedestrians a procedural
`figure`.

## Components

| Component | Where | What it holds |
|---|---|---|
| `ambientAgent` | Every agent | Class, content type, colour, lane, distance along it, speed, state and seed. The kernel owns it: read it, never write it |
| `ambientObserver` | Optional, on the observer | Per-observer `radius`, `despawnRadius` and a `density` multiplier |
| `ambientRole` | Entity types in a content pack | Which pool a vehicle type joins and how it drives. See [NPC content](#npc-content-and-ambientrole) |

Agents also carry a `transform` that the kernel writes every tick, so scripts, audio and physics
see them like any other entity. `molen component ambientAgent` prints the full field list.

## The observer and the spawn ring

The spawner follows one observer. It takes, in order:

1. the scene's `observer` entity, or an entity carrying `ambientObserver`;
2. the last `ambient.observer` command, `{ "pos": [x, y, z], "forward": [x, z] }` or
   `{ "entity": id }`;
3. a host's `setObserver` call.

With no observer, nothing spawns and existing agents keep moving.

Each class has three radii around the observer. Agents spawn between `near` and `far`, weighted
by lane length, and never inside the view cone within 150 m ahead, so traffic appears out of sight
and fades in beyond that. Anything past `keep` is removed, as is an agent whose road left the
network or one stuck for 90 s out of sight.

| Class | `near` | `far` | `keep` | Density | Cap |
|---|---|---|---|---|---|
| `car` | 60 | 350 | 450 | 12 per lane-km | 200 |
| `pedestrian` | 25 | 140 | 180 | 25 per lane-km | 60 |
| `train` | 150 | 1200 | 1500 | 0.4 per lane-km | 2 consists |
| `aircraft` | 800 | 5000 | 6000 | — | 4 |

The spawner runs every 6 ticks and places at most 4 agents per run, so a busy street fills over a
few seconds instead of in one frame.

## What agents do

- **Cars** follow the car ahead with the Intelligent Driver Model, slow for curves, stop at red
  lights and for crossing traffic, and pick a turn at each junction from a seeded draw. They also
  stop for a vehicle someone is driving and for pedestrians on a crossing.
- **Pedestrians** walk `path` ways and inferred sidewalks at 1.15 to 1.65 m/s, pause now and then,
  and cross roads only on a pedestrian phase or when no car is close.
- **Trains** run `rail` ways as consists, two cars by default, that follow the lead around
  curves. They dwell at stations for the station's `dwell` or 20 to 40 s, and reverse at the end
  of the line.
- **Aircraft** fly straight corridors a few hundred metres up, or the approach and departure of an
  aerodrome within 6 km.

## Scripts: `molen.ambient.*`

| Call | What it does |
|---|---|
| `stats()` | Agent counts per class, lanes, spawned and removed totals |
| `setObserver(entity \| { pos, forward? } \| null)` | Move the spawn ring |
| `setPolicy(patch)` | Override radii, densities, caps or driver parameters. Recorded in world state |
| `laneAt(x, z, { class?, radius? })` | The nearest lane, the distance along it, and how far away it is |
| `laneSample(lane, s)` | Position, direction and grade at a distance along a lane |
| `agentsNear(x, z, radius, kind?)` | Agent ids within a radius |
| `addRoad(points, opts?)`, `addPolyline(line)` | Extend the network at run time |
| `despawnAll(kind?)` | Remove every agent, or every agent of a class |

```ts
molen.on('tick', () => {
  if (molen.tick % 60 !== 0) return;
  const player = molen.get('player', 'transform');
  if (player === undefined) return;
  const cars = molen.ambient.agentsNear(player.pos[0], player.pos[2], 30, 'car');
  molen.patchState({ carsNearby: cars.length });
});
molen.on('rush-hour', () => molen.ambient.setPolicy({ car: { perLaneKm: 24 } }));
```

Scripts cannot register map tiles: that belongs to the host.

## Browser hosts

A Worker-hosted scene adds the capability in the worker and the renderable kinds on the page:

```ts
// worker.ts
import { ambientCapability } from '@bendyline/molen-ambient/kernel';
import { figuresScriptApi, installFigures } from '@bendyline/molen-figures/kernel';
import { startKernelWorker } from '@bendyline/molen-kernel';

startKernelWorker({
  scene: scene(),
  capabilities: [
    ambientCapability(),
    (world) => ({ figures: figuresScriptApi(installFigures(world)) }), // animates pedestrians
  ],
});

// main.ts
import { ambientVehicleKind } from '@bendyline/molen-ambient/client';
import { mountExperience } from '@bendyline/molen-client';
import { figureKind } from '@bendyline/molen-figures/client';

await mountExperience({ link: worker, scene: scene(), canvas, kinds: [ambientVehicleKind(), figureKind()] });
```

A scene whose `network` is a path needs the document handed over, because the worker cannot read
files. Pass it keyed by the path as written in the scene:

```ts
ambientCapability({ networks: { 'network.json': await (await fetch('/network.json')).json() } });
```

A host that steps its own `World` on the main thread installs the kernel directly and draws with
`createAmbientRenderer`, which instances every vehicle of a shape into one draw call:

```ts
import { createAmbientRenderer } from '@bendyline/molen-ambient/client';
import { installAmbient } from '@bendyline/molen-ambient/kernel';

const ambient = installAmbient(world, { classes: ['car', 'pedestrian'] });
ambient.addDocument(network);
const renderer = createAmbientRenderer({ world, parent: scene });

function frame(dt: number) {
  ambient.setObserver({ pos: camera.position.toArray(), forward: [viewX, viewZ] });
  world.step();
  renderer.update(camera.position.toArray(), dt);
}
```

`installAmbient` takes `traffic`, `classes`, `policy`, `types`, `templates`, `ground` and `seed`.
For streamed maps, `registerTile` and `unregisterTile` add and drop one tile's transportation
features. Changes queue until the next tick, so a tile never changes the network mid-step.
`blocks(box)` answers whether an ambient car overlaps a box, for a vehicle solver's obstacle test.

`createAmbientRenderer` draws pedestrians with `AmbientFigures`, which a host can also use for its
own characters: `update(walkers, camera, tick, tickRate)` takes `WalkerView`s (`id`, `figure`,
`pos`, `rot`, `speed`, `since`, `hidden`), pools a skinned body per descriptor and poses it from
its speed. Three optional fields go beyond walking: `mode` (`'run'`, or `'sit'` for a seated pose),
`anchor: 'eye'` (the position is the eye point, as a vehicle seat names it) and `lookAt` (a world
point the head turns toward). A seated or eye-anchored figure is drawn only at the animated detail
tiers. The Earth view draws its actors and the walker's avatar this way.

## In the Earth view

`mountEarthView` runs ambient life by default on the roads, footways and railways of the streamed
map:

```ts
const view = await mountEarthView({
  canvas,
  terrain,
  content,
  camera,
  ambient: { density: 0.6, pedestrians: true, rail: true, aircraft: true },
});
trafficButton.onclick = () => view.setAmbientEnabled(!view.ambientEnabled);
```

`density` scales how busy the streets are, from 0 to 1. `cars`, `pedestrians`, `rail`, `aircraft` and `boats` switch classes.
Earth resolves driving side from its road-sign country atlas at each terrain tile's centre,
including Japan, Australia and other left-driving regions. The same rule places road markings,
signals and signs. `drivingSide` explicitly overrides this selection; missing geographic content
defaults to right. Custom hosts pass `drivingSideAt` to `EarthAmbient`, or `drivingSide` on each
`AmbientTileInput` to a streamed network. Water traffic still keeps starboard.
`ambient: false` turns the
layer off entirely. `stats().ambient` reports the counts on screen and the tiles in use.

The quality tier caps the numbers:

| Tier | Cars | Pedestrians | Trains | Aircraft | Full-model cars | Activity radius |
|---|---|---|---|---|---|---|
| Minimum | 24 | 8 | 0 | 0 | 2 | 250 m |
| Low | 48 | 16 | 0 | 1 | 4 | 350 m |
| Medium | 96 | 32 | 1 | 1 | 6 | 450 m |
| Balanced | 160 | 48 | 1 | 2 | 8 | 600 m |
| High | 240 | 80 | 2 | 3 | 12 | 800 m |
| Ultra | 320 | 120 | 2 | 4 | 16 | 1000 m |

Ambient cars share the view's vehicle world, so the car you drive stops against them and traffic
waits for you, and for the view's [actors](earth-view.md#actors-companions-and-npcs) on foot. They
follow the rendered ground and bridge decks, and they rebuild when the view re-anchors after a long
trip.

### Promoting a pedestrian

Ambient pedestrians come and go with the spawn ring; a host that wants one to stay (someone the
player stopped to talk to, a fare at the kerb) promotes it to an [actor](earth-view.md#actors-companions-and-npcs):

```ts
const view = await mountEarthView({ /* … */ interaction: { pedestrians: true } });
view.on('interact', ({ kind, id, claim }) => {
  if (kind !== 'pedestrian' || id === undefined) return;
  claim();
  const actor = view.actors.adopt(id, { behaviour: { kind: 'follow', target: 'viewer' } });
  if (actor !== undefined) startConversation(actor);
});
```

`interaction.pedestrians` makes the interact key offer the nearest pedestrian in reach
(`kind: 'pedestrian'`), and `view.actors.adopt(id, { id?, behaviour?, interactable? })` keeps it
where it stands with the same body. The agent leaves ambient life for good: it stops, the spawner
no longer counts or removes it, and the actors draw it from then on, looking at the viewer and
interactable unless the spec says otherwise. `adopt` returns undefined when the pedestrian has
already gone. It is one-way; an actor never returns to the pool.

## NPC content and `ambientRole`

An entity type joins the ambient pools with an `ambientRole`:

```json
{
  "format": "molen/types@1",
  "namespace": "my.pack",
  "types": {
    "my.pack.transit.tram": {
      "components": {
        "transform": { "pos": [0, 0, 0], "rot": [0, 0, 0, 1] },
        "renderable": { "kind": "gltf", "ref": "my.pack.transit.tram" },
        "ambientRole": {
          "role": "rail",
          "length": 30,
          "width": 2.65,
          "height": 3.6,
          "cruise": 14,
          "cars": 3,
          "colors": ["#c8102e"],
          "visual": { "paintMaterial": "tram-livery" }
        }
      }
    }
  }
}
```

`role` is `car`, `bus` (drives with cars), `rail`, `aircraft`, `boat` or `ferry`. A type with a `vehicle`
component takes its dimensions and wheels from the vehicle spec, so its role can be as short as
`{ "role": "car" }`. Other types give `length`, `width` and `height`, and `visual` names their
wheel, paint, rotor and landing-gear nodes. `weight` sets how often a type spawns within its pool,
and `cars` how many cars a train has.

The `molen.entities` pack gives roles to its eleven road vehicles, a city bus, a light-rail car, an airliner
the P-51 and OH-6 aircraft, and eight watercraft. See [Reusable entities](entities.md). Near the
camera the Earth view draws cars, trains and vessels with their full models, painted in the
agent's colour. Their glazing (a transparent material named like `glass` or `glazing`) is tinted
dark and glossy, at least 62% opaque, so a passing car does not read as an open frame of pillars
and seats; a car the player drives keeps its authored glass. Further
out, and without content, every vehicle is a proxy shape built from its dimensions.

## Water traffic

Enable the `boat` agent class and supply **navigation routes**, not water polygon boundaries:

```json
{
  "ambient": {
    "observer": "player",
    "classes": ["boat"],
    "density": { "boat": 1 },
    "network": {
      "format": "molen/transport-network@1",
      "ways": [
        { "class": "water", "subclass": "ferry", "width": 60, "speed": 8,
          "points": [[-800, 0, 0], [800, 0, 0]] },
        { "class": "water", "subclass": "channel", "width": 120, "speed": 7,
          "points": [[-1200, 0, 250], [1200, 0, 250]] }
      ],
      "stations": [{ "id": "harbor", "kind": "ferry", "at": [0, 0], "dwell": 20 }]
    }
  }
}
```

The boat pool serves `water` lanes only. Ferries use `ferry` routes; other vessels use `channel`
routes. Two-way routes keep to starboard regardless of the road driving side; `oneway: true`
uses the centreline. `width` is the whole navigation corridor: a vessel must fit its half on a
two-way route, and its length must fit the segment. Junction choices also reject narrower or
shorter branches. Roads crossing a water route never create road/water connections.

Two-coordinate points default to sea level, **never seabed terrain height**. Use explicit
`[x, y, z]` surface heights for inland/elevated water. Author broad curves and clear channels:
there is no depth, shoreline or obstacle planner. Mapped `ferry` transportation lines and
`ferry_terminal` POIs are retained by streamed Earth networks and `network bake --classes water`.
Mapped routes currently assume sea level; inland ferry elevation needs an authored network.

Vessels accelerate and brake slowly, follow the vessel ahead, and keep a generous gap. Ferries
dwell at terminals (`dwell` seconds, default 30), then resume; an unannotated route end also
receives a 30-second turnaround stop. Boats return along a two-way route at its end. No routes
means no boats: the engine does not invent shipping lanes across arbitrary water.

Defaults are near/far/keep radii of 100/1800/2400 metres, 0.8 vessels per lane-km and a cap of
12. `setBudget({ boats })` caps the kernel population. `createAmbientRenderer` uses vessel
proxies without content and up to four full vessel models within 1.2 km when a model provider
is available; `detailedBoats` controls that separate render budget. Earth quality tiers cap
boats at 0/2/4/6/8/12; `ambient: { boats: false }` disables them, and stats report `boats`.

Content hosts populate `types.boat` with `AmbientVehicleType` entries whose `waterway` is
`"ferry"` or `"channel"`, and supply full models through the existing renderer vehicle adapter
(with empty wheel lists). The Earth content adapter derives these from `ambientRole` automatically.
A scene may instead use `ambient.templates.boat` for a vessel prefab, as the engine repository's
harbor scene does. Without a type pool the capability uses dimensioned ferry/boat proxies.

This is ambient route following. It does not model buoyancy, waves, maritime crossing priority,
ship schedules, passenger boarding or player helm controls. Cycles are player-rideable through [vehicles](vehicles.md#riding-cycles); ambient cycle riders are not spawned.

## Determinism and cost

Agent state lives in components: lane, distance along it, speed, and the seed behind every choice.
It is hashed, keyframed and replayed like the rest of the world. The network itself is derived
data outside the state hash, so a restored world needs the same network added back. Occupancy,
junction grants and signal phases are recomputed from components each tick, and a signal's colour
is a pure function of the junction and the tick.

`ambient.observer` and `ambient.policy` are commands, so replays reproduce where the ring was and
how busy it was. A host's `setBudget` caps are not recorded; hosts reapply them after a restore.

The simulation is kinematic: agents follow lanes instead of running the vehicle solver. On a
laptop, 300 cars, 60 pedestrians, four trains and four aircraft step in 1 to 2 ms per tick.
Building the lane graph for a dense downtown map tile takes about 10 ms, and the Earth view adds at
most one tile every 200 ms. In the engine repository,
`node packages/ambient/bench/agents.bench.mjs` measures both.

## Limits

- Map data has no turn restrictions or speed limits. Speeds follow the road class, and lane
  counts follow the width when OSM does not give them.
- Aircraft fly straight lines. They do not taxi, circle or land beyond the approach.
- Pedestrians keep to their lane and follow the walker ahead. They do not step around each other.
- Agents do not open doors, board, or park. A parked car in the Earth view is a separate entity.
- A promoted pedestrian keeps its body but nothing of its walk: it stands until its actor
  behaviour moves it, and it never rejoins ambient life.

## Read next

- [Earth view](earth-view.md)
- [Figures: humans, bipeds and quadrupeds](figures.md)
- [Mountable vehicles and driving](vehicles.md)
- [Authoring a capability package](capability-authoring.md)
