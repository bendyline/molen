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

Buildings appear with vertex colors while shared material textures bake in the background.
Completed textures update the existing materials without regenerating buildings. Terrain detail
refines in small groups, retaining visible detail during camera turns while replacements load.

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
keeping the viewer, input and markers. With `terrainSource`, a longitude-only trip also checks
the destination's terrain region. `stats().frameLatitude` reports the current anchor.

## Content and packages

Without `content` the view still draws terrain, water, roads and extruded buildings. Content packs
add styled architecture, recognizable businesses, street furniture, trees and drivable cars:

- `openPacksFromIndex(indexUrl)` opens `molen.entities`, `molen.worldgen.default`, `molen.earth`
  and `molen.sky` from a pack index you host.
- `loadEarthContent(packs)` reads them. A missing pack turns its feature off instead of failing.

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

The host can return `archives` in the result to fetch tiles from its own PMTiles service. Keep
pack attribution visible through `view.credits`, which follows the active terrain source. Listen
for `terrainchange` to refresh an attribution panel when the package changes. Direct jumps and
completed flights resolve the destination immediately; manual panning rechecks the host source
after about five kilometers. A second jump while a region is loading follows the latest target.

## Geographic structures and regional styles

The Earth pack may provide a `molen/structure-placements@1` document. Each record binds a
WGS84 `[longitude, latitude]` anchor to an asset ID from the style pack, with an optional
heading, scale, terrain or sea-level datum, and minimum tile level. The Earth viewer loads the
catalog with the packs, indexes it by three-character geohash, and draws each `preview` model
in the terrain tile containing its anchor. `draft` records remain queryable but are not drawn.
Long structures may supply `bounds: [west, south, east, north]`. Their extent is indexed across
geohash cells and geometry is clipped to each resident tile, so a bridge end stays visible when
its center is outside the view. Extended structures require `datum: 'sea-level'`; `elevation`
is the model origin's absolute height, avoiding inconsistent ground samples between tiles.
`replaceRoads: { length, width, deckHeight? }` describes a model-local rectangle along +X:
mapped parallel bridge lines inside it are replaced only after the model loads successfully.
Outside approach fragments remain procedural. `deckHeight` joins those approaches to the
model's deck height above its origin, blending back over 100 m; include that margin in `bounds`.
If `replaceFootprint` is set, a nongeneralized mapped building is suppressed only when the
anchor falls inside its polygon. An Earth pack without a placement document still loads.

`content.worldgen.structures.query([west, south, east, north])` returns preview placements in a
geographic rectangle. Pass `true` as the second argument to include drafts. The default
catalog and its source notes live in `content/earth/structures/placements.json` in the engine
repository. Model geometry and previews live in `content/worldgen/source/site-structures/`.
The terrain stream queries only cells intersecting resident tiles. Chicago models are not fetched
while viewing Seattle; a structure model is released from CPU and GPU memory when the last tile
using it leaves view. Returning to the area loads it again. Draft entries never fetch models.

Mapped roads with `bridge: true` receive solid decks, edge barriers and regularly spaced
supports in the shared terrain surface renderer, including its worker path. Road, rail and
pedestrian spans follow mapped centerlines and widths; tunnels are omitted. Complete spans
interpolate between bank heights and connect to adjoining ground roads. Clipped spans use
estimated terrain clearance (6 m for roads/rail, 3 m for paths); a semantic provider can set
`deckElevation` to an absolute surveyed height. These are visual approximations: tile data
does not establish bridge engineering type, navigation clearance, foundations or collision.
The SR-520 preview replaces the floating section; its approaches use this same fallback.

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
  times (`stats().qualityLevel`, 0-5). A preset pins the quality.
- `setPaused(true)` stops rendering while the view is hidden, and `dispose()` releases the GPU
  context, workers and listeners. Mounting is abortable through `signal`.

The composing pieces are exported too, for hosts that build their own view: `createEarthWorldgen`,
`EarthVehicles`, `createEarthSky`/`createEarthFog`, `earthPerformanceTier` and `earthCredits`.
The [World Explorer](https://molen.dev/play/world-explorer/) sample is built from them.
