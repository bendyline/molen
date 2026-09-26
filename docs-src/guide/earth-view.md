# Earth view

`@bendyline/molen-earth` turns a canvas into an explorable real-world 3D view with one call. It
composes:

- streamed terrain from a `molen/terrain-package@1`;
- worldgen buildings, street surfaces, trees and parked cars from content packs;
- orbit, walk and drive navigation;
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

`touchJoystickContainer` adds an on-screen movement stick while walking or driving. By default it
appears only on touch devices; pass `touchJoystick: 'always'` to show it everywhere.

## Modes

- **orbit** (default): the map camera from [camera navigation](navigation.md). `flyTo(target)`
  animates and `jumpTo(target)` moves at once. The target takes `latitude`, `longitude`, and
  optionally `range` in meters, `heading` (a compass bearing in radians) and `pitch` (radians of
  tilt below the horizon).
- **walk**: `setMode('walk')` drops a walker at the view center. It has capsule collision against
  terrain, buildings and props, WASD or the touch stick to move, mouse-look with pointer lock, and
  Space to jump.
- **drive**: while walking, press E (or `setMode('drive')`) next to a parked car to get in. W/S
  drive, A/D steer, Space brakes, V switches between cockpit and chase views, and E gets out. Cars
  come from the entities content pack. `message` events explain when entering or leaving is
  blocked, for example "Move closer to the door".

Listen for `modechange`. The input profile, clip planes and touch stick follow the mode
automatically.

## Frames and long trips

Heights stay in meters. Horizontal distances are exact at the frame latitude and drift by about
1–1.5% per degree away from it (see [terrain](terrain.md)). The view anchors its frame at the
starting latitude. After a `flyTo` of more than about a degree north or south, or after panning
that far, it re-anchors: it rebuilds the terrain stack in a new frame at the destination while
keeping the viewer, input and markers. `stats().frameLatitude` reports the current anchor.

## Content and packages

Without `content` the view still draws terrain, water, roads and extruded buildings. Content packs
add styled architecture, recognizable businesses, street furniture, trees and drivable cars:

- `openPacksFromIndex(indexUrl)` opens `molen.entities`, `molen.worldgen.default`, `molen.earth`
  and `molen.sky` from a pack index you host.
- `loadEarthContent(packs)` reads them. A missing pack turns its feature off instead of failing.

The terrain package can reference split archive families (`pmtiles-set` sources), or you can pass
your own transports as `archives.elevation`, `archives.landcover` and `archives.features`. That is
how a host routes tiles through offline packs or a retrying reader.

## Credits, quality, lifecycle

- `view.credits` holds the package's required attributions, OpenStreetMap first with its link.
  Keep them visible whenever the view is.
- `quality: 'auto'` adapts terrain budgets, building detail and pixel ratio to measured frame
  times (`stats().qualityLevel`, 0-5). A preset pins the quality.
- `setPaused(true)` stops rendering while the view is hidden, and `dispose()` releases the GPU
  context, workers and listeners. Mounting is abortable through `signal`.

The composing pieces are exported too, for hosts that build their own view: `createEarthWorldgen`,
`EarthVehicles`, `createEarthSky`/`createEarthFog`, `earthPerformanceTier` and `earthCredits`.
The [World Explorer](https://molen.dev/play/world-explorer/) sample is built from them.
