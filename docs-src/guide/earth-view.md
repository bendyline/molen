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

- `openPacksFromIndex(indexUrl)` opens `molen.entities`, `molen.worldgen.default`, `molen.earth`,
  `molen.sky` and `molen.sounds` from a pack index you host.
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
anchor falls inside its polygon and the replacement model has loaded. Failed models keep the
procedural building. An Earth pack without a placement document still loads.

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
Rules with `replaceFootprint: true` can also replace a nongeneralized footprint containing a
matching POI, after the asset loads. This is useful when a windmill is a POI plus an unclassified
building outline; the default leaves point features independent of building shells.

The renderer admits at most 64 category models per tile and obeys each rule's smaller budget.
It owns points with half-open tile bounds, deduplicates building/POI pairs and nearby named
landmarks, samples terrain at each model base, and releases shared model resources on tile
eviction. Rules require source classification evidence: a cafe with “Windmill” in its name is
not a windmill. Providers that omit POIs, classifications, or structure tags cannot imply that
object. The semantic decoder preserves public structure tags and Wikidata IDs when supplied.

`content.worldgen.structures.query([west, south, east, north])` returns preview placements in a
geographic rectangle. Pass `true` as the second argument to include drafts. The default
catalog and its source notes live in `content/earth/structures/placements.json` in the engine
repository. Model geometry and previews live in `content/worldgen/source/site-structures/`.
The terrain stream queries only cells intersecting resident tiles. Chicago models are not fetched
while viewing Seattle; a structure model is released from CPU and GPU memory when the last tile
using it leaves view. Returning to the area loads it again. Draft entries never fetch models.
Geographic and category models use `StructureModelLibrary`, preserving the authored mesh
hierarchy, UV coordinates, texture maps, material assignments and PBR parameters. Instances
share those resources until the last reference is released. Long static models retain their
UVs, vertex attributes and material groups when clipped at tile edges; textures do not restart
at each seam. The library accepts static assets: skinned or animated structures require a host
animation implementation. Procedural scatter continues to use the separate instanced prop path.

### Shared architectural surfaces

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

The default library has 51 procedural surfaces, including brick bonds, stone, timber, painted
wood, shingles, concrete, metal, plaster, glass and canvas. Its authoring catalog, physical
repeat sizes, tint variants, swatches and texture audit live in
`content/worldgen/source/material-library/` in the engine repository. Color variants do not
duplicate texture images. The current Earth viewer prepares the registered library after the
first frame and retains it until viewer disposal. Structure eviction releases model geometry
and private materials while preserving shared surfaces used by other structures. A separate
on-demand material eviction policy is not yet implemented.

Hosts composing their own renderer can supply `StructureModelLibrary` with
`resolveSurface: ({ ref, slot }) => materials.materialFor(slot, ref)` using a
`createResolvedMaterialSet` instance. Restrict references to the host's registered material
library and keep it alive until all structure libraries have been disposed. Missing bindings
or UVs preserve the GLB fallback. A new bake upgrades progressive materials in place without
rebuilding model geometry.

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

## Sound

With the `molen.sounds` pack in `content`, the view plays the Earth soundscape: rain and wind
from the weather, birds by day and crickets at night, traffic near streets, footsteps while
walking, and an engine on the car or aircraft you board. Birds, crickets and traffic come from
the ground, so they fade as the view rises above the terrain and are gone a few hundred meters
up. Traffic also fades with distance from the nearest street. Sound starts on the first click or
key press. The `audioready` event fires once it has loaded, and then `view.audio` sets volume,
mute and bus gains (`view.audio.setBusGain('music', 0)` turns music off).

```ts
const view = await mountEarthView({ canvas, content, terrain, audio: { volume: 0.6, music: false } });
view.on('audioready', () => view.audio?.setMuted(localStorage.getItem('muted') === '1'));
```

Pass `audio: false` to keep the view silent, or `audio: { environment }` to replace the rules.
The default rules are exported as `EARTH_AUDIO_ENVIRONMENT`, and `createEarthAudio` builds the
same soundscape for a host that composes its own view. See [Sound and music](audio.md) for the
rule format.

The composing pieces are exported too, for hosts that build their own view: `createEarthWorldgen`,
`EarthVehicles`, `createEarthSky`/`createEarthFog`, `createEarthAudio`, `earthPerformanceTier` and
`earthCredits`.
The [World Explorer](https://molen.dev/play/world-explorer/) sample is built from them.
