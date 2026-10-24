# Earth view

`@bendyline/molen-earth` turns a canvas into an explorable real-world 3D view with one call. It
composes:

- streamed terrain from a `molen/terrain-package@1`;
- worldgen buildings, seeded infill for streets with missing outlines, street surfaces, trees and parked cars from content packs;
- traffic, pedestrians, trains and aircraft that come and go around the viewer;
- orbit, walk, drive and fly navigation, with cars and aircraft the host can put the viewer in;
- markers placed by latitude/longitude;
- sky, haze and adaptive quality.

You speak latitude and longitude; the view keeps its metric world frame internally.

```ts
import {
  loadEarthContent,
  mountEarthView,
  openPacksFromIndex,
} from '@bendyline/molen-earth/client';

const manifestUrl = new URL('/terrain/terrain-package.json', location.href);
const terrain = await (await fetch(manifestUrl)).json();
const content = await loadEarthContent(await openPacksFromIndex('/packs/index.json'));

canvas.tabIndex = 0;
const view = await mountEarthView({
  canvas,
  terrain,
  baseUrl: manifestUrl,
  content,
  camera: { latitude: 47.6205, longitude: -122.3493, range: 1500, heading: 0.8, pitch: 0.55 },
  workers: {
    elevation: () => new Worker(new URL('./elevation.worker.ts', import.meta.url), { type: 'module' }),
    worldgen: () => new Worker(new URL('./worldgen.worker.ts', import.meta.url), { type: 'module' }),
  },
  touchJoystickContainer: canvas.parentElement ?? undefined,
});

view.setMarkers([{ id: 'needle', latitude: 47.6205, longitude: -122.3493, image: pinCanvas }]);
view.on('markerclick', ({ id }) => openArticle(id));
view.on('camerachange', (camera) => syncMap(camera.latitude, camera.longitude));
creditsElement.textContent = view.credits.map((credit) => credit.label).join(' · ');
```

Each worker file is one line, for example `import '@bendyline/molen-earth/workers/elevation';`.
There are entries for `elevation`, `landcover`, `surface`, `worldgen` and `material`. Any worker
you omit does its work on the main thread instead.

Buildings appear with vertex colors while shared material textures bake in the background.
Completed textures update the existing materials without regenerating buildings. Terrain detail
refines in small groups, retaining visible detail during camera turns while replacements load.

Metal and glass use a shared procedural sky/ground reflection environment by default. The viewer
reuses its filtered texture until lighting changes; camera movement does not regenerate it.
Pass `reflections: false` for the legacy light-only appearance. A host-assigned
`view.viewer.renderer.scene.environment` takes precedence if you supply your own HDR environment.

Without a `style`, the view uses the shared medium-fi look: a strong warm sun over a sky fill,
ACES filmic tone mapping, and haze in the sky's horizon color. Its values are exported as
`EARTH_SKY_PALETTE`, `EARTH_LIGHTING`, `EARTH_TONE_MAPPING`, `EARTH_EXPOSURE` and
`EARTH_WATER_COLOR`, so a host that builds its own viewer can match it. `earthHazeColor` converts
a sky color into the fog color for the backend. Terrain and landcover share one ground material
from `createTerrainGroundMaterialAsync` (`@bendyline/molen-terrain/client`) with world-space
variation; a custom host passes it to the terrain stream's `material` and to `createEarthWorldgen`
as `groundMaterial`, and calls `setTerrainGroundOrigin` with the world origin each frame. Roads,
sidewalks and lots take `createTerrainPavementMaterialAsync` through the surface renderer's
`setMaterial`, with the same origin call. Trees, shrubs and props take
`createScatterMaterialAsync` (`@bendyline/molen-worldgen/client`) as `createEarthWorldgen`'s
`modelMaterial`, and generated buildings `createBuildingWeatheringAsync` as its
`buildingDecorator`. The [medium-fi style guide](medium-fi.md) explains the look and the rules
models follow inside it.

`style` sets the look: `sky.sunElevation` and `sky.sunAzimuth` (degrees; the azimuth is a
compass bearing, 0 north and clockwise) place the sun, and unless `environment.sun.direction` is
given the sunlight comes from the same point, so lit faces agree with the glow in the sky. `fog`,
`water`, `background` and the rest of `environment` (ambient light, tone mapping, exposure) follow.
`ground` recolors the terrain package's bare-ground surface layers by name (for example
`{ lowland: '#8b9e70' }`), and `landcover` sets landcover class colors (forest, grass, park,
residential, commercial…) over the style pack's palette; an unlisted class falls back to a
neutral olive.

Buildings, trees and landmarks cast sun shadows onto everything around what the camera frames:
the orbit target (sized to the view), or a little ahead of the walker, car or aircraft. The
shadow map follows that focus in whole texels, so edges hold still as it moves. Adaptive quality
turns shadows off at its two lowest levels; `shadows: false` turns them off entirely. Only layer
parts taller than `EARTH_SHADOW_CASTER_HEIGHT` (3.5 m) cast: shrubs, brambles and saplings stay
out of the shadow pass, where their shadows would mostly fall inside the canopy's.

`touchJoystickContainer` adds an on-screen movement stick while walking, driving or flying. By default it
appears only on touch devices; pass `touchJoystick: 'always'` to show it everywhere.

## Modes

- **orbit** (default): the map camera from [camera navigation](navigation.md). `flyTo(target)`
  animates and `jumpTo(target)` moves at once. The target takes `latitude`, `longitude`, and
  optionally `range` in meters, `heading` (a compass bearing in radians) and `pitch` (radians of
  tilt below the horizon). The camera stays within `earthOrbitMaxRange(viewDistance)` of its target
  (45% of the current performance tier's terrain view distance, at least 2 km), so it cannot pull
  back past where the scene still draws; a farther `range` is clamped, and the limit follows
  adaptive quality.
- **walk**: `setMode('walk')` drops a walker at the view center. It has capsule collision against
  terrain, buildings and props, WASD or the touch stick to move, mouse-look with pointer lock, and
  Space to jump. The camera is first person until the host gives the walker a body; then V
  switches to a camera behind it (see [Walking](#walking-place-pose-avatar-and-third-person)).
- **drive**: while walking, press E (or `setMode('drive')`) next to a parked car to get in. W/S
  drive, A/D steer, Space brakes, V switches between cockpit and chase views, and E gets out. A car
  at rest with no throttle holds itself, even on a slope. Cars come from the entities content
  pack. `message` events explain when entering or leaving is blocked, for example "Move closer to
  the door". From any mode, `setMode('drive', { vehicle: true })` puts the viewer in a car in the
  nearest mapped road lane (or `vehicle: '<entity type id>'` for a particular car).
- **fly**: `setMode('fly')` starts an aircraft from the entities pack (the P-51D, or
  `{ aircraft: 'molen.entities.aircraft.oh6' }` for the helicopter) already flying: engine
  running, gear up, heading the way the view faced. From orbit it starts a little behind the view,
  flying toward it, at a height matched to the orbit camera; `airborne: { altitude, speed }`
  chooses meters above the ground and m/s, and `airborne: false` parks it on the ground with the
  engine off. The `pilot` input profile flies it (see [navigation](navigation.md)); V switches
  cockpit and chase views, R recovers after an impact (`view.recover()`), and E leaves once it
  has landed, stopped and shut down. See [aircraft](aircraft.md) for the flight model.

Drive and fly need the ground under their start, and drive a road lane, so `setMode` switches at
once and boards when that has streamed in, keeping the orbit camera on the spot meanwhile. With no
lane after a few seconds the car takes the nearest open ground, never a roof, deck or catalogued
landmark. Leaving follows the vehicle's rules (stop, land, shut down); a host control such as a
mode menu passes `{ force: true }` to step out at once, which also removes a vehicle `setMode`
added.

`view.vehicleStatus()` describes the car or aircraft the viewer is in for a HUD: speed and
heading for a car; airspeed, altitude and height above ground, vertical speed, attitude, load
factor (g), sideslip, power, engine, gear, flaps and stall/impact flags for an aircraft (SI units,
compass radians). Both carry the type's `label` and, where the type declares them, its name-free
`genericLabel` (`Full-size pickup`) and `bodyStyle`, so a HUD that must not show a real
manufacturer or model name has something to show instead. An airplane started in flight is trimmed for level flight at its launch speed.
`view.setThrottle(power)` sets an aircraft's throttle or collective from an on-screen lever.

Listen for `modechange`. The input profile, clip planes and touch stick follow the mode
automatically.

## Hooks for game hosts

A game built on the view needs to know where the viewer is every frame, put the walker somewhere,
give it a body, keep a few vehicles and characters of its own, and hear the interact key. These are
the generic pieces; what they mean (missions, scores, dialogue) stays in the host.

### Per-frame hook and coordinates

```ts
view.on('frame', ({ dt, now, mode, viewer }) => {
  // viewer: { latitude, longitude, altitude, heading, speed } — the walker's feet, the car, the
  // aircraft, or the orbit target; altitude in meters above sea level, heading a compass bearing in
  // radians, speed in m/s (0 in orbit).
  needle.pointAt(bearing(viewer, destination));
});
const [x, z] = view.toWorld(47.6205, -122.3493); // world meters in the current frame
view.toGeo(x, z);                                 // { latitude, longitude }
view.groundHeight(47.6205, -122.3493);           // m ASL, or undefined until that ground has streamed
```

`frame` fires once per rendered frame, after the world has stepped and before the camera is set,
so markers and objects placed from it appear in the frame being drawn. World meters are relative to
the metric frame: they stay valid until the next `terrainchange` (a re-anchor), while everything
geographic (`viewer`, poses, places) is stable across re-anchors.

### Walking: place, pose, avatar and third person

```ts
view.setMode('walk', { at: { latitude, longitude, heading } }); // start here, facing heading
view.walker.place({ latitude, longitude });                       // teleport (enters walk mode if needed)
view.walker.pose();   // { latitude, longitude, altitude, heading, speed, grounded } | undefined
view.walker.ready;    // standing on streamed ground
```

A place inside the current frame drops the walker at once (it lands when the ground there has
streamed, as a walk start always does). A place more than about a degree of latitude away, or in
another terrain region with `terrainSource`, re-anchors first: the mode is `walk` immediately, the
orbit camera holds over the destination while the frame rebuilds, and the walker lands when it is
done.

```ts
view.walker.setAvatar({ figure: { preset: 'human.adult', height: 1.7, palette: { top: '#2f5a3b' } } });
view.walker.setAvatar({ type: 'my.app.character.guide' }); // an entity type with a `figure`
view.walker.setView('third');   // or 'first'; V toggles while walking with an avatar
view.walker.view;               // 'first' | 'third'
view.walker.setAvatar(undefined); // no body (the default)
```

The walker has no body by default, and the view is first person. `setAvatar` gives it one: a
[figure](figures.md) descriptor, or `{ type }` naming an entity type from the content packs with a
`figure` component. In the third-person view a chase camera sits 4.5 m behind the feet, pulled in
front of any wall between it and the walker. Mouse-look turns the walker's heading and the camera
with it; vertical look tilts the camera and eases back. Movement stays relative to the camera, and
the body faces the way it walks (the camera's heading while standing). The avatar is drawn on foot
in the third-person view and seated at the wheel in a car's or aircraft's chase view; never in first
person or a cockpit.

### Owned vehicles

```ts
const car = view.vehicles.spawn({
  id: 'car-1',
  type: 'molen.entities.vehicle.sedan',
  latitude, longitude, heading, color: '#b8362d',
});
await view.vehicles.whenPlaced(car);     // the ground under it has streamed and the entity exists
view.vehicles.pose(car);                 // { kind, type, latitude, longitude, altitude, heading, speed, occupied, placed }
view.vehicles.board(car);                // within reach of the door; { force: true } from anywhere
view.vehicles.release();                 // step out at once; the car stays
view.vehicles.setColor(car, '#123456');  // cars only: the type's paintMaterial
view.vehicles.remove(car);
view.on('vehiclechange', ({ id, change }) => save(id, view.vehicles.pose(id)));
```

Owned vehicles differ from the car `setMode('drive', { vehicle: true })` adds: they survive
stepping out, forced exits and re-anchors, and they are never removed by the view. The registry
is geographic: a vehicle whose ground has not streamed (parked out of view) is placed when the
viewer gets there, and after a long trip rebuilds the frame every owned vehicle is placed again
from its last known place. An aircraft spawned `airborne` flies once; after a re-anchor it is parked
where it was. `vehiclechange` reports `placed`, `boarded`, `left` (read `pose()` then to persist
where it was parked), `painted`, `removed` and `blocked` (no room within 30 m of the spot; the
view retries every few seconds). `type` must be a car (`vehicle`) or aircraft type from the content
packs; `spawn` throws otherwise, and when the id is already taken. `setMode('drive' | 'fly', {
board: id })` is the same boarding through the mode API. The entities pack's cars and the OH-6
carry a `passenger` seat and the P-51D a rear seat, so a companion can ride along (see
[Actors](#actors-companions-and-npcs)).

### Actors: companions and NPCs

```ts
const guide = view.actors.add({
  id: 'guide',
  figure: { preset: 'human.adult', height: 1.66, palette: { top: '#b0553a' } }, // or { type }
  latitude, longitude, heading,
  behaviour: { kind: 'follow', target: 'viewer' },
  interactable: true,
});
view.actors.setBehaviour(guide, { kind: 'goTo', to: { latitude, longitude, heading } });
view.actors.lookAt(guide, 'viewer');      // a place, 'viewer', { actor: id }, or null
view.actors.pose(guide);                  // { latitude, longitude, altitude, heading, speed, mode, behaviour, mounted?, placed }
view.on('actorchange', ({ id, change, reason }) => {
  // added | arrived | boarded | alighted | stuck | teleported | removed
});
```

Actors are characters the host keeps: a companion who follows the viewer, a guide waiting at a
door, a passenger. Each is a [figure](figures.md), placed by latitude and longitude once the ground
there has streamed (`pose().placed`), and kept, like owned vehicles, through drives and re-anchors
until `remove(id)`. A behaviour decides what it does:

| Behaviour | What the actor does |
|---|---|
| `{ kind: 'idle' }` | Stands, turning toward its `lookAt` target when that is behind it. The default. |
| `{ kind: 'wander', around, radius? }` | Strolls the mapped footways within `radius` (default 20 m) of a place, pausing between walks. It stands when ambient life is off or no footway is near. |
| `{ kind: 'follow', target, distance?, jogBeyond?, teleportBeyond? }` | Keeps `distance` (2.5 m) behind the viewer on foot or another actor (`{ actor: id }`), jogs past `jogBeyond` (8 m), and teleports behind the target past `teleportBeyond` (60 m; `Infinity` never). |
| `{ kind: 'goTo', to, arriveWithin? }` | Walks to a place, emits `arrived` within `arriveWithin` (1 m), then idles facing `to.heading`. |
| `{ kind: 'board', vehicle, seat?, force? }` | Walks to the door nearest the seat and sits: `seat` names one, otherwise the first free `passenger` seat. `force` seats it at once, from anywhere and whatever the vehicle is doing. |
| `{ kind: 'alight' }` | Steps out by the vehicle's exits once it has stopped, then idles. |

`stuck` carries a reason: `blocked` (a goal and no progress for three seconds), `target-mounted`,
`no-vehicle`, `no-seat`, `moving` (the vehicle has not stopped) or `unreachable`. Each is reported
once when it starts; the actor keeps trying. A follower whose target climbs into a vehicle stands
still and reports `target-mounted`, which is the host's cue:

```ts
view.on('actorchange', ({ id, change, reason }) => {
  if (change === 'stuck' && reason === 'target-mounted') {
    const vehicle = view.interactable().id;   // aboard, the vehicle the viewer is in
    if (vehicle) view.actors.setBehaviour(id, { kind: 'board', vehicle });
  }
  if (change === 'alighted') view.actors.setBehaviour(id, { kind: 'follow', target: 'viewer' });
});
view.on('modechange', ({ mode }) => {
  if (mode === 'walk' && view.actors.pose('guide')?.mounted)
    view.actors.setBehaviour('guide', { kind: 'alight' });
});
```

A seated actor rides along in the vehicle's seat (`mode: 'sit'`, `mounted: { vehicle, seat }`) and
is drawn sitting there. It waits in its seat whatever its behaviour until `alight`; boarding another
vehicle needs an `alight` first. When the vehicle is removed it stands where the vehicle was
(`alighted` with reason `vehicle-gone`). An actor seated in an owned vehicle is seated again when a
re-anchor places that vehicle again. A passenger never drives and does not start an engine sound.

Actors walk straight at their goal; there is no pathfinding, so a building between an actor and
its goal leaves it `stuck`. The few nearest the viewer walk with the walker's capsule collision
against buildings and props; the rest move over the bare terrain, through walls, until they come
close. `mountEarthView({ actors: { activeRadius, maxActive } })` sets how many and how near (60 m,
4). Actors do not collide with each other or the walker, and ambient cars stop for them like for the
walker. `actors.adopt(pedestrianId)` turns an ambient pedestrian into an actor (see
[Promoting a pedestrian](ambient-life.md#promoting-a-pedestrian)).

### Interaction

```ts
const view = await mountEarthView({ /* … */ interaction: { reach: 2.5, pedestrians: true } });
view.setInteraction({ pedestrians: false }); // change it later, e.g. only while a game runs
view.interactable();   // { kind: 'actor' | 'vehicle' | 'pedestrian' | 'none', id?, distance? }
view.on('interact', (interaction) => {
  if (interaction.kind === 'actor') {
    interaction.claim();   // the view does nothing else with this press
    talkTo(interaction.id);
  } else if (interaction.kind === 'pedestrian') {
    const id = view.actors.adopt(interaction.id);   // stop them and talk
    if (id) talkTo(id);
  }
});
```

The interact key (E, or F, or the right mouse button) emits `interact` first with what it found. On
foot that is the nearest of: a car or aircraft within reach of its door (aircraft can be boarded on
foot too), an interactable actor within `interaction.reach` (2.5 m) of the walker's eyes and in
sight, and, with `interaction.pedestrians`, an ambient pedestrian. Aboard, it is the vehicle the
viewer is in; otherwise `none`. A handler that calls `claim()` synchronously takes the press, and
nothing else happens. Unclaimed, the view boards or leaves a vehicle as it always did (or explains
why there is nothing to board), and does nothing for an actor or a pedestrian.

## Frames and long trips

Heights stay in meters. Horizontal distances are exact at the frame latitude and drift away from it
by about 1.75% × tan(latitude) per degree: 1% at 30°, 1.5% at 40°, 2% at Seattle's 47.6°, 3% at 60°
(see [terrain](terrain.md)). The view anchors its frame at the starting latitude. After a `flyTo`
of more than about a degree north or south, or after panning that far, it re-anchors: it rebuilds
the terrain stack in a new frame at the destination while keeping the viewer, input and markers.
Walking, driving and flying keep their frame, so a long flight north or south slowly stretches
distances by the same rule; return to orbit to re-anchor. With `terrainSource`, a longitude-only trip also checks
the destination's terrain region. `stats().frameLatitude` reports the current anchor.

## Content and packages

Without `content` the view still draws terrain, water, roads and extruded buildings. Content packs
add styled architecture, recognizable businesses, street furniture, trees and drivable cars:

- `openPacksFromIndex(indexUrl)` opens `molen.entities`, `molen.worldgen.default`, `molen.earth`,
  `molen.sky` and `molen.sounds` from a pack index you host.
- `loadEarthContent(packs)` reads them. A missing pack turns its feature off instead of failing.

Entity types come from every opened pack that provides `types` documents, merged into one
library with the entities pack first: pass your own pack's id in `ids` (for example
`[...Object.values(EARTH_PACK_IDS), 'my.app']`) and its figure or prop types sit beside the stock
cars and aircraft in `content.types`. A type id declared by two packs is an error that names both.

`openPacksFromIndex(indexUrl, ids, fetchImpl)` accepts a host fetch implementation for the index,
archive opening and subsequent asset requests. Landmark model bytes are loaded as nearby
placements need them. Large packs require HTTP Range support to retrieve those bytes selectively:
serve range requests with `206 Partial Content` and a correct `Content-Range` header (expose that
header through CORS when hosting across origins). A server returning `200 OK` for a range request
uses the compatible whole-file fallback, which downloads the entire archive before models can
load. Packs below the small-pack threshold are intentionally fetched in one request.

The world-explorer sample builds the worldgen collection as a small style core plus regional
model archives. All material graphs, style documents, asset sidecars and catalogs remain in
`molen.worldgen.default`. Its `model-archives` document routes the existing model paths to
deterministic geohash2 archives, split at a256MiB source-byte budget. Larger individual models
use isolated archives with a hard512MiB limit. Generic models without a geographic anchor use
separate shared archives. The public documentation site uses the same builder and route format.
The build reads and compresses one shard at a time, avoiding the ZIP32 size limit and the
memory cost of assembling the whole world's models in one archive.

`openPacksFromIndex` recognizes the routing document automatically. It opens no regional archive
until a model is requested, sends its range requests through the same host `fetchImpl`, and
checks the archive identity and content hash plus each model's SHA-256. Seattle placements
therefore do not open Chicago's archives. Archive opens are deduplicated; failed opens can be
retried; idle archive handles and their byte caches are evicted after four open archives.
Active reads remain pinned. `content.packs.close()` aborts reads and closes all regional handles.
This is independent of the viewer's GPU model residency and tile unloading.

Existing monolithic packs work unchanged. Hosts opening cores from offline storage can call
`withModelArchives(core, async (id, contentHash, signal) => openYourPack(id, contentHash, signal))`
before `loadEarthContent`; its optional `maxOpenArchives` controls the idle cache. The wrapper's
manifest describes the physical core, while `has`, `paths` and reads also expose explicitly
routed model paths. Ordinary `pack:molen.worldgen.default/...` references continue to resolve.
The builder publishes the index after all shards and keeps old hash-named archives for viewers
already using them; deployment storage may retire those versions after its cache lifetime.

The terrain package can reference split archive families (`pmtiles-set` sources), or you can pass
your own transports as `archives.elevation`, `archives.landcover` and `archives.features`. That is
how a host routes tiles through offline packs or a retrying reader.

For a viewer that can travel between separately hosted regions, provide `terrainSource` instead
of a fixed `terrain`. Molen calls it for the initial camera and after geographic travel. The host
returns a package manifest plus URLs or archive transports; Molen replaces the terrain stream,
semantic layers, and local frame while keeping the viewer and navigation alive. A stable `key`
identifies a region, so returning the same key for a nearby move keeps its resident tiles.

```ts
const view = await mountEarthView({
  canvas,
  content,
  camera: { latitude: 47.6205, longitude: -122.3493, range: 1500 },
  terrainSource: async ({ latitude, longitude }, signal) => {
    const region = chooseRegion(latitude, longitude);
    const url = new URL(`/terrain/${region}/terrain-package.json`, location.href);
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Terrain ${region}: HTTP ${response.status}`);
    return { key: region, terrain: await response.json(), baseUrl: url };
  },
});
```

The host can return `archives` in the result to fetch tiles from its own PMTiles service
(`elevation`, `landcover`, `features`, and `buildingDetail` for a package's finer building tier;
see [terrain](terrain.md)). A building-detail archive that fails to open is reported as an error
and the view carries on with the feature tiles' own footprints. Keep
pack attribution visible through `view.credits`, which follows the active terrain source. Listen
for `terrainchange` to refresh an attribution panel when the package changes. Direct jumps and
completed flights resolve the destination immediately; manual panning rechecks the host source
after about five kilometers. A second jump while a region is loading follows the latest target.

## Byte cache and prefetch

Terrain, landcover, feature and building tiles, content packs and the small documents that name
them can persist across visits in a byte cache from `@bendyline/molen-pack/cache`. Ground a viewer
has seen then streams from disk instead of the network, and a revisited city costs almost no
requests. The cache splits each archive into 64 KiB blocks held in memory and in IndexedDB,
merges neighbouring misses into one range request, shares a block between concurrent reads, and
evicts least recently used blocks past a byte budget.

```ts
import { createBlockCache, createIndexedDbByteStore, createMemoryByteStore } from '@bendyline/molen-pack/cache';
import { loadEarthContent, mountEarthView, openPacksFromIndex } from '@bendyline/molen-earth/client';

const store = createIndexedDbByteStore({ name: 'my-app-bytes', budgetBytes: 300 * 1024 * 1024 });
const byteCache = createBlockCache(store ?? createMemoryByteStore());

const packs = await openPacksFromIndex(indexUrl, undefined, undefined, { byteCache });
const view = await mountEarthView({
  canvas,
  terrain,
  baseUrl,
  content: await loadEarthContent(packs),
  byteCache,
  camera: { latitude: 47.6205, longitude: -122.3493, range: 1500 },
});
```

The view opens the package's own archives through the cache, keyed by the SHA-256 that its
`files` list or archive sets give, or by URL when none is listed. Archives you pass in `archives`
are used as given, so route them through the cache yourself where you want them kept: wrap a
PMTiles source with `cachingRangeSource`, or open archive-set members with `cachingArchiveOpener`
from `@bendyline/molen-terrain/client`. A stable URL whose file is replaced in place needs
`keyBy: 'etag'`, so each server version becomes its own archive. Content packs are keyed by their
content hash, file and size. Pass the same cache to `openPacksFromIndex` and `mountEarthView` so
packs and terrain share one budget. `cachingDocumentFetch` keeps the small JSON documents (pack
index, archive sets, manifests) and revalidates them with `If-None-Match`, serving the stored copy
offline.

With a byte cache the view also prefetches. It follows the camera's own track, so it works for an
orbit pan, a car and an aircraft alike. It places virtual views 20, 40 and 60 seconds ahead,
selects their tiles the way the stream would, and reads those archive tiles into the cache. It
reads bytes only and decodes nothing, two reads at a time, only while the stream has a free load
slot, and pauses when the page is hidden, offline or on Save-Data. It waits out camera animations
(a fly-to, getting into a vehicle), whose momentary speed is not travel, and never looks more than
15 km ahead. Tune it with `prefetch` (`horizonSeconds`, `stepsSeconds`, `maxConcurrent`,
`maxDistanceMeters`), or turn it off with `prefetch: false`. A host
that knows the route, such as a simulator's flight plan, queues places with
`view.prefetch([{ latitude, longitude, altitude }])`. Those go first and resolve once read. A
`flyTo` within the current frame queues its destination. `view.cacheStats()` reports block hits,
network requests, stored bytes and prefetch progress.

## Ambient life

Cars drive the mapped roads, pedestrians walk the footways, trains run the railways and aircraft
pass overhead. They appear out of sight around the viewer and leave once it moves on. The layer is
on by default:

```ts
const view = await mountEarthView({ canvas, terrain, content, camera, ambient: { density: 0.4 } });
view.setAmbientEnabled(false);
```

`density` runs from 0 to 1 (default 0.6). `cars`, `pedestrians`, `rail` and `aircraft` switch a
class off, and `ambient: false` removes the layer. The quality tier caps how many agents run and
how many cars get full models. With the entities pack in `content`, vehicles use its car, bus,
light-rail and airliner models near the camera. The car you drive stops against ambient traffic,
and traffic waits for it. See [Ambient life](ambient-life.md) for the tier table and how the
simulation works.

## Airfields

`view.airfields` lists the runways the ambient layer's transport network holds and places things
on them. Everything it returns is latitude, longitude and a compass heading in radians, so a
result stays valid while the view re-anchors its metric frame as the camera travels; world
coordinates do not. A runway's id (`runway:<hash>` of its endpoints rounded to 1e-5°) is the same
each time its tile streams in.

```ts
const [runway] = await view.airfields.whenNear(47.53, -122.3, { radiusM: 3_000 });
if (runway !== undefined) {
  const start = view.airfields.placement(runway.id, 'threshold', { end: 'a' });
  // start: { latitude, longitude, heading, elevation }, 60 m in from end a, facing down the runway
  const parked = view.airfields.placement(runway.id, 'beside'); // 40 m to the right of the threshold
}
```

- `near(latitude, longitude, radiusM)` returns the runways whose midpoint lies within the radius,
  nearest first. Each has its `ends` (`a` then `b`), the `heading` from `a` to `b`, its geodesic
  `length` in metres, its `elevation` above sea level, and the nearest `aerodrome` point of
  interest within 3 km when one is mapped.
- `whenNear(latitude, longitude, { radiusM, timeoutMs, signal })` resolves as soon as `near` is
  non-empty, with `[]` after the timeout (20 s by default), and rejects only when the signal
  aborts.
- `placement(id, where, options)` gives a place with an `elevation`: `threshold` is 60 m in from
  end `a` (or `options.end: 'b'`) facing down the runway toward the other end, `midpoint` is the
  centre facing from `a` to `b`, and `beside` is the threshold moved `options.offsetM` (default
  40) metres to the right of the runway, facing parallel to it. It returns `undefined` once no
  registered tile carries that runway.

Runways exist only for the tiles the ambient layer has registered: those within its activity
radius plus 250 m of the viewer. Move the camera to the airport first (`flyTo` or `jumpTo`) and
keep the layer on: `ambient: { cars: false, pedestrians: false, rail: false, aircraft: false }`
still registers runways, while `ambient: false` removes the network. The map data carries no
aprons or taxiways, so `beside` is a parking approximation. Hosts composing their own view use
the same `EarthAirfields` class from `@bendyline/molen-earth/client`, built on an
`EarthAirfieldsSource` of callbacks (the network's runways, aerodromes and version, and the
world/geographic conversion) and ticked on their sync.

## Geographic structures and regional styles

The Earth pack may provide a regional `molen/structure-placement-index@1` directory, or a
legacy flat `molen/structure-placements@1` document. Each placement binds a
WGS84 `[longitude, latitude]` anchor to an asset ID from the style pack, with an optional
heading, scale, terrain or sea-level datum, and minimum tile level. The Earth viewer loads the
regional directory with the packs, then reads compact `molen/structure-placement-data@1`
regions as terrain tiles need them. Flat catalogs still load eagerly. Resident placements
are indexed by three-character geohash, and the viewer draws each `preview` model
in the terrain tile containing its anchor. `draft` records remain queryable but are not drawn.
Long structures may supply `bounds: [west, south, east, north]`. Their extent is indexed across
geohash cells and geometry is clipped to each resident tile, so a bridge end stays visible when
its center is outside the view. Extended structures use either `datum: 'sea-level'` with an
absolute `elevation`, or a `terrainReference` with the host sampler described below. Every
tile must resolve the same model origin, avoiding inconsistent ground samples between tiles.

Models with `groundCutout` stay whole in each intersecting resident tile. Their floors and
openings therefore remain together while adjacent tiles load, including when the anchor tile
is absent. These instances share the library's geometry and textures and release with their
tiles. Ordinary extended bridges continue to use clipped geometry.

`replaceRoads: { length, width, deckHeight?, deckHeights? }` describes a model-local rectangle along +X:
mapped parallel bridge lines inside it are replaced only after the model loads successfully.
Outside approach fragments remain procedural. `deckHeight` joins those approaches to the
model's deck height above its origin, blending back over at most 100 m; include that margin in `bounds`.
For sloped decks, use `deckHeights: [negativeXEnd, positiveXEnd]` instead of `deckHeight`.
Both heights are native model Y and follow the model's Y scale, resolved origin and heading.
Each remaining bridge fragment uses its nearest authored endpoint and returns to the height
of a connected ground road at its far end. If a replaced bridge ends on the model boundary,
an outward ground approach sharing that endpoint receives a local height correction, fading
back to terrain within 20 m or the approach length. The painter and traffic graph use the same
profile. This does not generate a slab beneath ground roads or lift nearby perpendicular
crossings, tunnels or disconnected riverbank paths.
Skewed or curved structures may add `replaceRoads.outline: [[x, z], ...]`, a simple native
footprint polygon. It replaces the rectangle for suppression, including concave bends;
parallel road segments outside it remain intact. Connection stations use the outline's outer
intersections with native Z=0, ordered negative to positive X. Without an intersecting outline,
they fall back to X=-length/2 and X=+length/2. `deckHeights` keeps that endpoint order.
If the asset includes its retaining walls and approach pavement, set
`replaceRoads.includeConnectedApproaches: true`. A grade road is then clipped inside the outline
only if it shares a covered endpoint with a mapped bridge and continues outward along the bridge
axis. The remaining grade fragment receives a 20 m terrain blend. Nearby roads, transverse paths
and tunnels remain intact. This requires the source tile to retain the shared bridge/approach
endpoint; disconnected or generalized map geometry is left in place.
Sunken structures can declare `groundCutout: { outline: [[x, z], ...], basis: 'source evidence' }` on a placement. The simple polygon uses native model metres and follows the same heading and scale as the model. It should bound the ground opening covered by the authored concourse or rim. The terrain pyramid subtracts the polygon from actual elevation and draped ground triangles across tile and LOD boundaries, preserving interpolated heights and surface attributes along its edge. The cutout becomes active only when its successfully loaded structure is visible, and the original ground returns on layer hiding or eviction. Failed or cancelled models leave the ground intact. Heights remain available for anchoring; an opening does not itself author walkable floors or collision. Separate excavations can add `additionalOutlines: [[[x, z], ...], ...]` to the same object (up to 64 total polygons). Ground between those outlines stays intact; every opening needs matching model geometry. Client integrations can register the same set with `setTerrainGroundCutouts(object, outlines)`. The singular `setTerrainGroundCutout` remains available for one polygon.

For separated parts, `groundCutout.outlines` supplies the complete set of up to 64 simple polygons
and supersedes the single `outline`. Keep `outline` as the primary boundary for compatibility.
Each ring follows the same model pose and lifetime; ground in the gaps stays visible. This lets
a structure cover a main building and a detached component without clearing the ground between them.
For an extended structure, each resident tile clips these openings to its own rendered model
piece. Terrain outside that tile stays intact until the corresponding model piece loads.

A landmark that authors a lake or basin can separately declare
`waterCutout: { outlines: [[[x, z], ...], ...], basis: 'source evidence' }` with geographic
`bounds`. Up to 16 simple native model polygons replace only the covered native water. The
viewer keeps other polygons from the same map feature, and clips replacement to resident model
tiles. Native water returns when the model is hidden or evicted; failed or cancelled loads
leave it intact. Ground openings and water openings are independent, so a bridge's ground
opening does not remove the river underneath it. Custom water adapters can register their mesh
with `markTerrainWaterSurface`; `TerrainGroundCutoutController` coordinates both surface kinds.

When a map merges a landmark with neighboring buildings, declare
`buildingCutout: { outline: [[x, z], ...], basis: 'source evidence' }` and geographic `bounds`.
This simple native model polygon follows the placement's heading and scale. While the model is
loaded, the viewer subtracts only that area from mapped buildings and preserves their remaining
polygons, holes, heights and other attributes. It takes precedence over `replaceFootprint` for
that placement. Bounds ensure every overlapping tile receives the mask. Failed loads leave the
mapped buildings intact; eviction restores the original source data. This affects procedural
building geometry; use `groundCutout` separately when the model also covers the terrain opening.
For separated buildings or precincts, `buildingCutout.outlines` provides up to 64 independent
simple masks and supersedes `outline`. Keep the primary `outline` for compatibility. Separate
masks preserve intervening buildings without inventing connecting structure geometry.

For a whole landmark whose source footprint slightly overlaps a neighboring building, set
`buildingCutout.minimumCoverage` to a fraction in `(0, 1]`, for example `0.995`. This changes
the mask to whole-building replacement: a mapped feature goes only when the union of that
placement's masks covers at least that fraction of its occupied area. The calculation includes
all components and subtracts holes; overlapping masks do not count twice. Lower-coverage
neighbors keep their original polygons and attributes intact. Separate placements make separate
coverage decisions. Generalized tiles fall back to area subtraction so a coarse merged block
can retain the surrounding complex while the landmark occupies its part. Use ordinary
subtraction when only part of a precise map building should go.

### Bridge elevations and terrain fit

With the default `datum: 'terrain'`, a placement's origin Y is the sampled terrain height at
`anchor` plus `elevation` (default zero). That works for a model authored with its ground contact
at Y=0. A bridge authored from a riverbed or buried foundation needs a corresponding reference:
a coarse elevation grid may contain the road surface or smooth the gorge across several pixels.
Increasing tile zoom cannot recover relief absent from the source elevation data.

For a measured model origin, use `datum: 'sea-level'` and set `elevation` to its absolute height
in the same vertical reference as the host terrain. This bypasses terrain sampling and gives every
clipped portion of a long bridge the same vertical position. The name `sea-level` selects the
world's absolute Y frame; it does not convert between EGM96, EGM2008, a local survey datum or an
ellipsoidal height. The host must perform that conversion before providing the value.

For a terrain placement referenced to another point, add
`terrainReference: { anchor: [longitude, latitude], modelHeight, basis }`. For example, a bank
at native Y=8 uses `modelHeight: 8`; the model origin becomes the reference elevation minus
`modelHeight * scaleY`, plus `elevation`. Record the source and meaning of that point in `basis`.
This field is incompatible with `datum: 'sea-level'`.

Hosts can supply `sampleStructureTerrain(coordinate, { entry, signal })` to `mountEarthView`,
`createEarthWorldgen`, or `createWorldgenSemanticRenderers`. It may return a height or a promise
and must use the same world height reference as the rendered terrain. Resolve the coordinate
from its own terrain tile or a surveyed source; honor `signal` when fetching. Returning
`undefined` means coverage is unavailable: the model remains unloaded and procedural map
features remain visible. Absolute placements bypass this callback. Without a host callback,
the renderer samples only a reference inside the current tile, never its clamped edge.
An extended terrain structure (`bounds` plus `terrainReference`) requires this host callback;
without it, all its model pieces remain deferred and their procedural fallback stays visible.
The callback must resolve the same reference height for every clipped tile. A bank reference
therefore also works when the landmark anchor lies over unknown river elevation cells.
For loaded terrain, the pyramid stream's `sampleHeight` searches covering resident tiles
and returns `undefined` when none covers the point. A host that requires guaranteed cross-tile
references should retrieve those source tiles independently of the current visible tile set.

Check the approaches and channel in addition to the model origin. A bridge may have the correct
height while a host's elevation data still fails to represent its banks. Supply better local
elevation data through the terrain archives for that case. The reference hook changes model
placement; it does not modify a smoothed river channel. A `groundCutout` removes covered terrain
but does not reconstruct riverbanks, water levels, or a riverbed. The source repository includes a
repeatable real-terrain review: `build-bridge-terrain-evidence.mjs` preserves original Terrarium
samples, and `test/visual/capture-bridge-terrain.mjs` in the world-explorer example uses the
production terrain mesher and structure renderer, records approach ray measurements, and checks
model eviction. `build-copernicus-bridge-evidence.py` and the capture runner's
`--terrain-set=copernicus` option preserve a separate comparison with Copernicus elevations;
neither capture set substitutes altered heights to make a bridge fit. These reports are research
evidence and are excluded from the Earth runtime pack.

If `replaceFootprint` is set, mapped buildings are suppressed only once the replacement model
has loaded; failed models keep the procedural building. In exact data a polygon goes when the
anchor falls inside it, when it lies wholly inside the loaded model's horizontal extent around the
anchor, or when at least half of it stands on the model's own ground footprint (its triangles
stamped on a 64-cell grid). The last two catch a landmark's off-centre mapped parts: a tower's
legs and observation level, a grandstand, a ballpark's parked roof. The footprint also reaches
neighbouring tiles, so a stadium anchored near a tile edge clears its mapped stands there too.
Those tiles regenerate their buildings when the landmark loads, and again when its tile is evicted.
A ring polygon whose hole holds the anchor (a stadium bowl, a cloister) goes under the size rule
below. Generalized sources (Protomaps below zoom 15, and tiles overzoomed from them) merge
neighboring footprints, so there the polygon must contain or ring the anchor, and is suppressed
only when neither side exceeds the loaded model's horizontal extent by more than 1.6 times plus
12 meters; a larger polygon is a merged block of other buildings and keeps its procedural shell.
An Earth pack without a placement document still loads.

For unsurveyed orientation, `orientation: 'mapped'` requires an explicit
`mapIdentity: { wikidata: 'Q…', maxDistance: 150 }`. The viewer admits that model only after a
nearby matching building, directed POI, or bridge supplies an orientation. Exact name aliases
are supported only when the catalog supplies no Wikidata ID. A footprint's longest edge gives
an undirected axis, not proof of the entrance direction. `lengthAxis: 'x' | 'z'` identifies the
authored longitudinal axis. Entries with surveyed catalog headings use `orientation: 'fixed'`
(the default). No matching geometry means no speculative placement for a mapped entry.

### Reusable mapped categories

An Earth pack can list multiple `provides.structures` documents. Alongside geographic `entries`,
each document may contain `rules` for deliberately generic assets. The shipped
`structures/map-rules.json` recognizes windmills and wind turbines from class, subclass, or
explicit map tags. Unique named landmarks never become arbitrary category replacements.

Regional types can set `bounds: [west, south, east, north]` in WGS84 degrees. An optional
`match.names` array accepts exact category labels such as “Svan tower”; it requires regional
bounds and a class, subclass or explicit tag match. Partial names and business names do not
establish a type. Bounds use half-open east/north edges. With `fit: "footprint"`, an explicitly
typed point can use its sole complete containing building for size and the undirected longest
axis; the matcher never chooses the nearest house. Generalized, clipped or ambiguous footprints
do not establish that fit. A footprint axis alone does not establish the entrance's facing.

```json
{
  "id": "generic.windmill",
  "title": "Smock windmill",
  "asset": "molen.worldgen.structure.map_smock_windmill",
  "match": { "classes": ["windmill"] },
  "dimensions": [23.3, 30.6, 16.5],
  "orientation": "direction",
  "fit": "native",
  "minLevel": 14,
  "maxPerTile": 16,
  "source": "https://wiki.openstreetmap.org/wiki/Tag:man_made%3Dwindmill"
}
```

Match fields are AND conditions; the values within a field are alternatives. Put separate
rules in priority order for alternative source schemas. `dimensions` are authored X/Y/Z meters
with the base at Y=0 and front along +Z. `fit: 'footprint'` fits horizontal dimensions to a
confirmed nongeneralized building; `native` retains authored proportions. Measured heights
uniformly scale native models, bounded from 0.2 to 5 times native dimensions; footprint fitting
adjusts the three dimensions independently. Explicit source `direction`
or compass bearings take priority; otherwise footprints use their longest axis and points
default north. This default is an estimate, especially for rotatable turbine nacelles.
Rules with `replaceFootprint: true` can also replace a footprint containing a matching POI,
after the asset loads, under the same size rule for generalized footprints. This is useful when a windmill is a POI plus an unclassified
building outline; the default leaves point features independent of building shells.

The renderer admits at most 64 category models per tile and obeys each rule's smaller budget.
It owns points with half-open tile bounds, deduplicates building/POI pairs and nearby named
landmarks, samples terrain at each model base, and releases shared model resources on tile
eviction. Rules require source classification evidence: a cafe with “Windmill” in its name is
not a windmill. Providers that omit POIs, classifications, or structure tags cannot imply that
object. The semantic decoder preserves public structure tags and Wikidata IDs when supplied.

`content.worldgen.structures.query([west, south, east, north])` returns resident preview
placements in a geographic rectangle. Pass `true` as the second argument to include drafts.
For a regional catalog, `isLoaded(bounds)` distinguishes complete coverage from an unloaded
region. Use `await structures.queryAsync(bounds, { signal, viewingDate, includeDraft })` to
load and query complete coverage; flat indexes expose only the synchronous query. Async
results remain valid even when a large query exceeds the retained cache budget. Terrain
renderers await coverage before replacing buildings, roads, water or ground. Parking avoids
unloaded landmark coverage until nearby terrain has loaded it.

Regional reads share in-flight requests, run at most four requests at once, and retain at most
32 parsed regions or 4 MiB of serialized data (JavaScript object overhead is additional).
Cancelling one query does not cancel another query sharing its read. `dispose()` on the
regional stream cancels its reads and drops the cache. Directory coverage includes complete
structure extents and mapped identity search neighborhoods across region boundaries and the
antimeridian. Regions whose minimum tile level exceeds the requested level are skipped.

In the engine repository, authoritative placements and their source notes live in individual
`content/earth/source/placements/<gh2>/<gh3>/<placement-id>.json` files. A deterministic build
produces the ignored `content/earth/structures/placements/index.json` and `cells/*.json` files.
Runtime data retains titles and source URLs, all placement numbers, cutouts, statuses and
historical dates, while omitting `note` and `basis` explanations. Detailed map evidence stays
in the source; only `wikidata`, `names` and `maxDistance` are runtime matching fields.
The compiler starts with geohash2 regions and subdivides regions over 192 KiB when possible.
The pack keeps these files independently readable rather than combining them in solid blocks.
The generated `authoring.json` aggregate supports local review fixtures and is excluded from packs.

Named model sources and previews live in
`content/worldgen/source/places/<gh2>/<gh3>/<source-key>/`; imported runtime bundles mirror
that organization under `content/worldgen/assets/places/<gh2>/<gh3>/<source-key>/`.
Each runtime bundle contains `asset.json`, `model.glb`, and any collision data. Reusable models
use `assets/reusable/urban/<source-key>/`, `assets/reusable/infrastructure/<source-key>/`, or
`assets/reusable/map-structures/<source-key>/`. The two geographic folders are geohashes of
length two and three. New named entries without an organizational anchor start in `places/unlocated/`.

`content/worldgen/source/structure-index.json` resolves source keys to authoring directories.
The runtime mappings are separate: `content/worldgen/project.json` registers stable asset IDs
to sidecars for tooling, and `content/worldgen/stylepack.json` registers the same IDs for pack
resolution through `stylePackAssetIndex`. Asset IDs remain unchanged when folders move;
hosts resolve these mappings instead of deriving a model URL from the dotted ID. Folder
reference coordinates organize files and do not approve or activate geographic placement.
The terrain stream queries only cells intersecting resident tiles. Chicago models are not fetched
while viewing Seattle; a structure model is released from CPU and GPU memory when the last tile
using it leaves view. Returning to the area loads it again. Draft entries never fetch models.

Historical reconstructions use `status: 'historical'` and an `appearance` record:

```json
{
  "kind": "historical",
  "currentWorldEligible": false,
  "representedDate": "1930",
  "validFrom": "1926-01-06",
  "validUntil": "1934-04-01"
}
```

They remain unloaded in the default view. A host explicitly passes `viewingDate: '1930-01-01'`
to `mountEarthView`, `createEarthWorldgen`, or `createWorldgenSemanticRenderers` to include
historical assets for that day. The lower-level index accepts
`query(bounds, { viewingDate: '1930-01-01' })`. Dates must be valid `YYYY-MM-DD` calendar dates;
the first bound is inclusive and the last is exclusive. Date selection is independent of the
system clock and sky simulation. Remount the viewer to change it. Historical assets retain
geographic tile filtering, deferred loading, fallback on failed loads, and eviction cleanup.

This option selects dated landmark appearances. Hosts supply matching historical PMTiles and
terrain when needed; undated present-day map features and preview landmarks have no inferred
historical lifetime. For source authoring, combine `appearance` with a
`geographicProposal.status: 'historical-proposal'` and the usual reviewed ground contact and
placement evidence. Older historical sources without a complete supported date interval remain
drafts. Shared placement QA uses `capture-landmark-library.mjs --viewing-date=1930-01-01` and
records the explicit date in its hash-bound report.

Geographic and category models use `StructureLodStreamer`. Each asset has separately fetched
`skyline`, `district`, `street`, and `closeup` files in its sidecar's `runtimeLods`. The default
viewer loads skyline first and chooses detail by projected geometric error and remaining
budgets. The source master stays available for authoring and review. Generated close-ups are
reduced runtime models; they are not a promise of every detail in the master.

The streamer prioritizes nearby placements, limits concurrent requests, reserves memory before
loading, verifies payload hashes, and cancels unused requests. Instances keep the old level while
the replacement is prepared, then swap atomically. Placement, heading, elevation, ground cutouts
and bridge clipping are reapplied before publication. A five-second warm cache avoids immediately
reloading recently released models; memory pressure can evict unused models sooner. Shared
geometry and materials are counted once. Procedural scatter uses its separate instanced path.

| Default landmark allowance | Phone/tablet | Laptop/desktop |
| --- | ---: | ---: |
| Resident skyline payloads, uncompressed | 3 MB | 6 MB |
| Geometry CPU backing buffers | 64 MB | 192 MB |
| Estimated geometry GPU uploads | 64 MB | 192 MB |
| Shared worldgen textures, including mipmaps | 16 MB | 48 MB |
| Triangle / draw-call allowance | 350,000 / 100 | 1,000,000 / 200 |
| Concurrent model loads | 2 | 4 |
| Cooperative preparation time per frame | 2 ms | 4 ms |

These are decimal MB, separate from terrain, render targets, transport caches and parser/driver
overhead. Initial payload limits cover the active skyline set, not lifetime travel downloads or
pack metadata. Upgrades can download larger files after a one-second skyline grace period.
Draw/triangle admission reserves twice the nominal geometry cost for extra passes; shadows and
other renderer passes have their own costs. Preparation yields between instances; an individual
GLB parse or GPU upload can exceed the cooperative time allowance.

Touch devices or browsers reporting at most 4 GB use the phone preset. Hosts can choose explicitly:

```ts
const view = await mountEarthView({
  canvas,
  // ... terrain source, content and other required options
  landmarkStreaming: {
    mobile: true,
    budget: { maxInitialBytes: 3_000_000, maxGpuBytes: 64_000_000 },
  },
});
// view.stats().structures: resident levels, payloads, geometry, texture bytes,
// queued/in-flight loads, upgrades, failures and evictions.
```

Runtime variants use separate vertex attribute streams so Float32 positions and Uint8 colors
do not cause overlapping GPU uploads. The reducer preserves source material references on detailed
levels; skyline uses a single color material and local convex pieces derived from the source.
Small openings and fine trim can disappear in that distant silhouette. Detailed levels use
conservative reduction and can exceed their advisory triangle targets. Expensive models stay
coarse when an upgrade does not fit; source-authored LODs may be needed for more detail on phones.
Geometric error is an estimate for selection, not a certified maximum deviation.

Assets without current LOD metadata keep their procedural fallback in the default viewer. A host
can deliberately select `landmarkStreaming: false` to use the original `StructureModelLibrary`
and full imports for inspection or legacy content. Static geometry is required; animation and
skinning need a host-specific implementation.

### Shared architectural surfaces

The Earth viewer bakes shared surfaces when they are first used, with two concurrent jobs and the
texture allowance above. Each graph is cached once for that worldgen instance. If adding a texture
would exceed the allowance, its flat material remains usable. The library is released with the
worldgen instance. Rejected textures do not trigger a repeated bake every frame.

Authored GLB materials can opt into the same texture library as procedural buildings. Set
the material's glTF `extras.molenSurface` (available as Three.js material `userData.molenSurface`):

```json
{
  "ref": "matgraph:molen.worldgen.material.wood_painted_lap",
  "slot": "wall",
  "uv": "repeats"
}
```

`encodeGlb` exposes this as `GlbMaterialMeta.sharedSurface`. Author UV0 in texture repeats:
divide local surface coordinates in meters by the material's `repeatMeters` once during
authoring. Wood grain must follow the timber; masonry courses remain horizontal. Put color
variants in vertex colors with a white base-color factor, so white painted wood and green
painted wood share the same maps and material. Model-specific artwork and special PBR effects
keep their original unbound materials. GLBs retain portable fallback PBR materials for other
viewers and ordinary asset previews; the Earth viewer applies shared surfaces explicitly.

The default library has 65 procedural surfaces, including brick bonds, stone, timber, painted
wood, shingles, concrete, metal, plaster, glass and canvas. Its authoring catalog, physical
repeat sizes, tint variants, swatches and texture audit live in
`content/worldgen/source/material-library/` in the engine repository. Color variants do not
duplicate texture images. The current Earth viewer prepares the registered library after the
first frame and retains it until viewer disposal. Structure eviction releases model geometry
and private materials while preserving shared surfaces used by other structures. A separate
on-demand material eviction policy is not yet implemented.

Constant roughness and metalness channels use exact numeric factors instead of textures;
other maps retain their authored pixels. Across the full library this removes 58 texture
allocations, reducing estimated base-level RGBA8 texel storage from 45.75 to 31.25 MiB.
These are storage estimates, not measured driver allocations. Hard alpha-cutout surfaces retain
linear sampling without mip averaging. Fine porous surfaces can opt into `alphaCoverage: true`:
mipmapped alpha blending preserves average open area at distance, with the same `BLEND` fallback
in portable GLBs. Review overlapping transparent layers and close-up hole detail from both sides.

Hosts composing their own renderer can supply `StructureModelLibrary` with
`resolveSurface: ({ ref, slot }) => materials.materialFor(slot, ref)` using a
`createResolvedMaterialSet` instance. Restrict references to the host's registered material
library and keep it alive until all structure libraries have been disposed. Missing bindings
or UVs preserve the GLB fallback. A new bake upgrades progressive materials in place without
rebuilding model geometry.

`StructureModelLibrary` preserves host ownership of decoded ImageBitmaps by default. Its
`ownsImageBitmaps: true` option explicitly transfers ownership, allowing unused
fallback images to close after shared-material replacement and remaining images to close
after their last scene is released. A per-scene predicate can transfer ownership selectively.
The built-in Earth loader opts in only when every image uses an embedded bufferView: these
decode through fresh blob URLs excluded from Three's cache. Scenes with URI/data-URI images
retain host ownership, including mixed scenes. A fresh parse alone does not establish ownership
of images that may come from an external cache.

Mapped roads with `bridge: true` receive solid decks, edge barriers and regularly spaced
supports in the shared terrain surface renderer, including its worker path. Road, rail and
pedestrian spans follow mapped centerlines and widths. Complete spans
interpolate between bank heights and connect to adjoining ground roads. Clipped spans use
estimated terrain clearance (6 m for roads/rail, 3 m for paths); a semantic provider can set
`deckElevation` to an absolute surveyed height. These are visual approximations: tile data
does not establish bridge engineering type, navigation clearance, foundations or collision.
The SR-520 preview replaces the floating section; its approaches use this same fallback.

Mapped tunnels receive separate inferred underground bores and portal cuts that retain the
terrain above them. Aircraft support queries use the bore floor while underground. Centerlines
alone do not establish surveyed grades, widths or clearances; see [Tunnels](surface-rendering.md#tunnels)
for the metadata overrides, inference and bounded route stitching.

Regional procedural styles are separate from exact structures. The atlas's ordered rules use
mapped building class, footprint size, context, and known height to choose a style. A rule can
give weighted variants, sampled from a stable building identity, so a neighborhood has a
repeatable mix. `suggestStructureStyles(atlas, longitude, latitude, metrics)` from
`@bendyline/molen-worldgen-earth/kernel` exposes the matching weights and normalized shares for
inspection. The Pacific Northwest's unmeasured low-rise mix includes wood-sided PNW houses,
Craftsman, brick Prairie, and Ranch forms; Japan and broader regions have their own rules.
These regional forms are visual priors, not surveyed attributes of individual buildings.

## Credits, quality, lifecycle

- `view.credits` holds the package's required attributions, OpenStreetMap first with its link.
  Keep them visible whenever the view is.
- `quality: 'auto'` adapts terrain budgets, building detail and pixel ratio to measured frame
  times (`stats().qualityLevel`, 0-5, with `stats().qualityReason`). A preset pins the quality.
  It starts at `earthInitialQualityLevel()`: level 1 on touch devices and at 2 GiB or less, 2 at
  4 GiB, otherwise 3, and climbs no higher than `maxQualityLevel` (default 3; above it buildings
  switch to the high preset, which rebuilds them across the view). Where the browser can time the GPU (`renderer.createGpuTimer()`), the view
  reports GPU and CPU work per frame, so slow frames while tiles stream in lower the level only
  when rendering itself is the cost; without GPU timing it goes by frame times alone. The view
  first calibrates quickly, so a slow device settles within seconds. Once a level has held for
  12 s it turns sticky, because a level change swaps resolution and detail across the view: down
  after 2.5 s of sustained overload, up after 20 s of headroom, at least 6 s apart. Any change
  waits until the camera has been still for 0.6 s (at most 4 s); memory pressure above 1.25
  applies it at once.
- Ground 20° past each side of the view stays loaded as bare terrain (the stream's
  `peripheralDegrees`), so turning the camera reveals ground at once and its buildings and trees
  follow.
- Memory pressure (`stats().memoryPressure`) is the geometry on screen over `memoryBudget`, a
  fixed per-device budget: `earthMemoryBudget()` gives 96 MiB per GiB the browser reports within
  192–768 MiB, or 256 MiB on touch devices and 512 MiB elsewhere without a report. Above 1 the
  level steps down, and since stepping down selects fewer, coarser tiles, pressure falls rather
  than cascading to the minimum. The terrain cache keeps at least the budget, so ground just left
  is still warm when the view pans back.
- `stats().worldgen` counts styled building generation since the current terrain stream started
  (with content packs): tiles generated, buildings drawn as geometry, and instanced stand-ins.
- `setPaused(true)` stops rendering while the view is hidden, and `dispose()` releases the GPU
  context, workers and listeners. Mounting is abortable through `signal`.

## Sound

With the `molen.sounds` pack in `content`, the view plays 100 contextual sounds: 88 recorded
ambience beds and 12 walking surfaces, alongside vehicle engines and music. Rain and wind
follow weather, morning birds and warm-night crickets/frogs follow the rendered sky clock,
and broad regional palettes follow geographic location. Surf fades away from mapped ocean
shores; rivers and traffic follow nearby watercourses and streets. Enclosed cockpits smoothly
reduce outdoor ambience to 18%; open boats and exterior cameras retain outside sound.
Mapped ground materials, rain and snow select walking sounds. Birds, crickets and traffic come from
the ground, so they fade as the view rises above the terrain and are gone a few hundred meters
up. Unknown terrain height silences ground ambience. Traffic also fades with distance from the nearest street. Sound starts on the first click or
key press. The `audioready` event fires once it has loaded, and then `view.audio` sets volume,
mute and bus gains (`view.audio.setBusGain('music', 0)` turns music off).

```ts
const view = await mountEarthView({ canvas, content, terrain, audio: { volume: 0.6, music: false } });
view.on('audioready', () => view.audio?.setMuted(localStorage.getItem('muted') === '1'));
```

Pass `audio: false` to keep the view silent, or `audio: { environment }` to replace the rules.
The legacy/default rules are exported as `EARTH_AUDIO_ENVIRONMENT`; `createEarthAudio` extends
them using bank tags `earth:category:*` and `earth:region:*` unless given a custom environment.
A composing host passes `location`, `solarHour`, `terrain`, and `inVehicle` to `update`.
`EarthAudioTerrain.observer` can wrap water, landcover and features renderers with
`observeSemanticTiles`; sample it at about 4 Hz for coast/river/street distances and ground
material. `surface` overrides the mapped walking material, and `indoors` attenuates outdoor
ambience for a host that detects interiors. Missing mapped data uses conservative fallbacks;
lakes do not produce surf, and wildlife rendering density does not mute regional ambience.
A pack's `birdsong` catalog replaces broad bird palettes with curated recordings selected by
geography, habitat, season and sunlight; uncovered places stay quiet. The default pack includes
eight such recordings. Hosts pass the sky's `utcMs` and `sunAltitudeDeg` in `location`, along with
`regionalAmbience.habitat` and habitat levels. Curated birds fade out inside enclosed vehicles.
See [Sound and music](audio.md) for the rule format.

The composing pieces are exported too, for hosts that build their own view: `createEarthWorldgen`,
`EarthVehicles`, `EarthAmbient` with `observeSemanticTiles`, `createEarthSky`/`createEarthFog`,
`createEarthAudio`, `earthPerformanceTier` and `earthCredits`.
The [World Explorer](https://molen.dev/play/world-explorer/) sample is built from them.

## Boats and water conditions

Use `setMode('drive', { vehicle: 'molen.entities.watercraft.speedboat', force: true })` near
mapped water, or spawn an owned boat through `view.vehicles`. Actors can ride its passenger
seats. `water` configures deterministic swells and currents; `waterAt` can provide measured depths.
See [Boats and water](boats.md) for controls, mounting, limitations and the reusable kernel API.

## Dioramas

Use `dioramas: { maxActive, placements }` or `view.dioramas.add(...)` for bounded scripted set
pieces such as a football game, apron traffic or a market. Each geographic placement supplies
a lazy scene loader, optional calendar policy, and entry/exit distances. It waits for terrain,
plays nearby, and releases its local world when out of range. See [Dioramas](dioramas.md) for
the full contract and current prototype limits.
