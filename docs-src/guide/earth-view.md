# Earth view

`@bendyline/molen-earth` turns a canvas into an explorable real-world 3D view with one call. It
composes:

- streamed terrain from a `molen/terrain-package@1`;
- worldgen buildings, street surfaces, trees and parked cars from content packs;
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

`style` sets the look: `sky.sunElevation` and `sky.sunAzimuth` (degrees; the azimuth is a
compass bearing, 0 north and clockwise) place the sun, and unless `environment.sun.direction` is
given the sunlight comes from the same point, so lit faces agree with the glow in the sky. `fog`,
`water`, `background` and the rest of `environment` (ambient light, tone mapping, exposure) follow.

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
  Space to jump.
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
heading for a car; airspeed, altitude and height above ground, vertical speed, attitude, power,
engine, gear, flaps and stall/impact flags for an aircraft (SI units, compass radians).
`view.setThrottle(power)` sets an aircraft's throttle or collective from an on-screen lever.

Listen for `modechange`. The input profile, clip planes and touch stick follow the mode
automatically.

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

The host can return `archives` in the result to fetch tiles from its own PMTiles service. Keep
pack attribution visible through `view.credits`, which follows the active terrain source. Listen
for `terrainchange` to refresh an attribution panel when the package changes. Direct jumps and
completed flights resolve the destination immediately; manual panning rechecks the host source
after about five kilometers. A second jump while a region is loading follows the latest target.

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

## Geographic structures and regional styles

The Earth pack may provide a `molen/structure-placements@1` document. Each record binds a
WGS84 `[longitude, latitude]` anchor to an asset ID from the style pack, with an optional
heading, scale, terrain or sea-level datum, and minimum tile level. The Earth viewer loads the
catalog with the packs, indexes it by three-character geohash, and draws each `preview` model
in the terrain tile containing its anchor. `draft` records remain queryable but are not drawn.
Long structures may supply `bounds: [west, south, east, north]`. Their extent is indexed across
geohash cells and geometry is clipped to each resident tile, so a bridge end stays visible when
its center is outside the view. Extended structures use either `datum: 'sea-level'` with an
absolute `elevation`, or a `terrainReference` with the host sampler described below. Every
tile must resolve the same model origin, avoiding inconsistent ground samples between tiles.
`replaceRoads: { length, width, deckHeight?, deckHeights? }` describes a model-local rectangle along +X:
mapped parallel bridge lines inside it are replaced only after the model loads successfully.
Outside approach fragments remain procedural. `deckHeight` joins those approaches to the
model's deck height above its origin, blending back over 100 m; include that margin in `bounds`.
For sloped decks, use `deckHeights: [negativeXEnd, positiveXEnd]` instead of `deckHeight`.
Both heights are native model Y and follow the model's Y scale, resolved origin and heading.
These joins apply to remaining bridge-tagged road fragments, not unrelated ground roads.
Skewed or curved structures may add `replaceRoads.outline: [[x, z], ...]`, a simple native
footprint polygon. It replaces the rectangle for suppression, including concave bends;
parallel road segments outside it remain intact. `length` still locates the two connection
stations at native X=-length/2 and X=+length/2, Z=0, and `deckHeights` keeps that endpoint order.
Sunken structures can declare `groundCutout: { outline: [[x, z], ...], basis: 'source evidence' }` on a placement. The simple polygon uses native model metres and follows the same heading and scale as the model. It should bound the ground opening covered by the authored concourse or rim. The terrain pyramid subtracts the polygon from actual elevation and draped ground triangles across tile and LOD boundaries, preserving interpolated heights and surface attributes along its edge. The cutout becomes active only when its successfully loaded structure is visible, and the original ground returns on layer hiding or eviction. Failed or cancelled models leave the ground intact. Heights remain available for anchoring; an opening does not itself author walkable floors or collision.

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

If `replaceFootprint` is set, a mapped building is suppressed only when the anchor falls inside
its polygon and the replacement model has loaded. Failed models keep the procedural building.
Generalized sources (Protomaps below zoom 15, and tiles overzoomed from them) merge neighboring
footprints, so there the polygon is suppressed only when neither side exceeds the loaded model's
horizontal extent by more than 1.6 times plus 12 meters; a larger polygon is a merged block of
other buildings and keeps its procedural shell. An Earth pack without a placement document still
loads.

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
Rules with `replaceFootprint: true` can also replace a footprint containing a matching POI,
after the asset loads, under the same size rule for generalized footprints. This is useful when a windmill is a POI plus an unclassified
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
repository. Named model sources and previews live in
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
These are storage estimates, not measured driver allocations. Alpha-cutout surfaces retain
linear sampling without mip averaging so small perforations remain open.

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
  times (`stats().qualityLevel`, 0-5, with `stats().qualityReason`). A preset pins the quality.
  The view reports its own work per frame, so slow frames while tiles stream in do not lower the
  level unless that work is heavy itself. A level change waits until the camera has been still
  for 0.6 s (at most 4 s), since applying one rebuilds detail across the view; memory pressure
  above 1.25 applies it at once.
- Memory pressure (`stats().memoryPressure`) is the geometry on screen over `memoryBudget`, a
  fixed per-device budget: `earthMemoryBudget()` gives 96 MiB per GiB the browser reports within
  192–768 MiB, or 256 MiB on touch devices and 512 MiB elsewhere without a report. Above 1 the
  level steps down, and since stepping down selects fewer, coarser tiles, pressure falls rather
  than cascading to the minimum. The terrain cache keeps at least the budget, so ground just left
  is still warm when the view pans back.
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
`EarthVehicles`, `EarthAmbient` with `observeSemanticTiles`, `createEarthSky`/`createEarthFog`,
`createEarthAudio`, `earthPerformanceTier` and `earthCredits`.
The [World Explorer](https://molen.dev/play/world-explorer/) sample is built from them.
