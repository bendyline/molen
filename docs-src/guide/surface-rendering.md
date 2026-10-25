# Surface styles and parameterized line features

The terrain client renders roads, parking areas, pedestrian surfaces, and street fixtures from
normalized semantic tiles. World explorer exposes **Surfaces → Modern traffic / Circa 1910 /
Simple surfaces** in Human mode. Styles change in place, preserving the camera, streamed data,
and generated buildings. Expand **Surface details** to control markings, sidewalks, crossings,
streetlights, signals, parked cars, and inferred parking. The URL preserves these choices:
`?surfaces=1910`, `?surfaces=modern&parkedCars=0`, or `?inferParking=0`.

## Shared rendering API

```ts
import {
  createTerrainSurfaceRenderer,
  createDefaultTerrainSemanticRenderer,
} from '@bendyline/molen-terrain/client';

const surfaces = createTerrainSurfaceRenderer({
  style: 'modern',
  details: {
    maxFixturesPerTile: 160,
    maxDetailElements: 16_000,
    parkingOccupancy: 0.7,
  },
});
const renderer = createDefaultTerrainSemanticRenderer({ surfaceRenderer: surfaces });
// Supply renderer to createTerrainSemanticPyramidLayer, or featuresLayer.renderer
// in createTerrainPackageSemanticLayers.

await surfaces.setOptions({ style: '1910' });
// Call once per frame with absolute simulation time (seconds).
surfaces.updateSignals(tick / tickRate);
console.log(surfaces.stats());
// Dispose the stream/layers, then the shared controller when the experience closes.
surfaces.dispose();
```

Worldgen's `createWorldgenSemanticRenderers(pack, { roads: { surfaceRenderer: surfaces } })`
uses the same controller. Static consumers can pass
`{ surfaces: { style: '1910', details: { streetlights: false } } }` to
`createTerrainSemanticObject` or the default semantic renderer. `createTerrainSurfaceObject`
also works directly with a tile and `TerrainPyramidTileLayerContext`.

`setOptions` replaces the options, validates them, and cooperatively rebuilds resident surface
groups. New tiles use the latest options immediately. A newer update supersedes an older update.
The default semantic disposer unregisters controller-owned tiles and frees their geometry and
instance buffers. Caller-supplied materials remain caller-owned; `materials.road` applies to the
static renderer, while the shared controller uses its style palette.

For streamed worlds, run surface generation in a module worker. World explorer enables this by
default (diagnostic opt-out: `?surfaceWorker=0`, or `?worker=0` for all generation workers).
The worker handles road topology, intersections, parking inference, draping, fixture transforms,
and culling bounds. It transfers typed geometry and instance buffers; the main thread creates
render objects and uploads them to the GPU. The geometry and style match synchronous generation.

```ts
// surface-worker.ts
import { installTerrainSurfaceWorker } from '@bendyline/molen-terrain/client';
installTerrainSurfaceWorker(self);

// viewer.ts
import {
  createTerrainSurfaceWorkerBridge,
  createTerrainSurfaceRenderer,
} from '@bendyline/molen-terrain/client';
const generator = createTerrainSurfaceWorkerBridge(
  new Worker(new URL('./surface-worker.ts', import.meta.url), { type: 'module' }),
);
const surfaces = createTerrainSurfaceRenderer({ style: 'modern' }, generator);
```

The default semantic renderer awaits `surfaces.createTileAsync(tile, context)` before publishing
a tile, so pending-layer counts and `whenIdle()` include surface work. Custom streamed renderers
should await that method too. `createTile` and `createTerrainSurfaceObject` remain synchronous for
static callers. The worker runs one job at a time; aborted queued jobs are removed before height
samples are copied. Cancellation settles the caller immediately; a job already executing in the
worker finishes before the next job starts. `setOptions` cancels older queued revisions, keeps
existing surfaces visible until their replacement arrives, and makes initial tile readiness follow
the newest style. `stats().loading` counts pending resident replacements, and
`stats().geometryRevision` advances when rendered geometry changes. A host using terrain memory
budgets can call the stream's `refreshMemoryUsage()` after a new revision finishes loading.
Disposing the controller
also disposes its generator; do not share that generator between separately owned controllers.

## Pavement material

By default the surfaces draw in a plain vertex-color material. For textured asphalt, concrete and
paint, give the controller the pavement material for the renderer's backend once the renderer
exists; resident tiles switch in place and later tiles use it too:

```ts
import {
  createTerrainPavementMaterialAsync,
  setTerrainGroundOrigin,
} from '@bendyline/molen-terrain/client';

const pavement = await createTerrainPavementMaterialAsync({}, renderer.backend);
surfaces.setMaterial(pavement);
// Each frame, or whenever the floating origin moves, keep the pattern on the ground:
setTerrainGroundOrigin(pavement, [worldOrigin[0], worldOrigin[2]]);
```

The material reads a `surfaceDetail` attribute the surface builder writes on every road, sidewalk,
curb, marking and lot: meters along the band, meters across it from its edge, the surface kind
and band width, and a road's lane width. Roads and lots get asphalt aggregate (within a few meters,
crisp pale chips and dark pits a few centimeters across), blotchy wear, polished wheel
tracks and an oil line in each lane, grit in the gutters, storm-drain grates, manhole covers and
the odd darker repaired section; asphalt and concrete both get hairline cracks; lots get oil
stains; sidewalks and footways get 1.5 m saw-cut slabs and curbs 3 m ones, each slab its own
tone, weathered with water stains and, close up, the odd spot of gum; plazas and pedestrian areas get a half-meter paver grid; markings wear through to the
asphalt. Detail fades to the plain swatch with distance, so it never shimmers, and each layer's
noise is evaluated only where it still shows: distant pavement skips the fine layers, and only
fragments within 2 m of a frayed edge evaluate the fray. `setMaterial(undefined)` restores the plain material. Your own geometry can opt in with
`TerrainSurfaceMeshBuilder.surfaceSince(start, TERRAIN_SURFACE_KIND.road, …)`, or a
`surface` (and `lanes`) on a `TerrainLineBand`.

Edges that meet bare ground fray into it rather than ending on a ruled line: the lawn side of a
sidewalk, both sides of a footpath, dirt road or track bed, a road's shoulder, and a narrow fringe
traced around each lot and plaza (skipped where a road, footway, other paved area or building meets
it). The material discards a ragged margin so the ground shows through, and inside it a patchy
brown soil margin about a third of a meter wide, where soil washes and is tracked onto the paving;
it fades out by twenty or thirty meters away, where it would draw a ruled outline round each lawn.
Cast paving keeps its formed edge; grass blades creep up to 3 cm over it, and on the lawn side of
a street sidewalk or parking lot tufts of lawn about 35 cm across grow up to 10 cm over it,
so from mid distance that edge wanders rather than ending on a ruled line. Footpaths and plazas,
which often abut other paving, keep only the blades. Where a driveway, footway or paved lot crosses
a sidewalk's lawn side, that stretch stays clean (the builder clears the fray flag on its vertices,
`TerrainSurfaceMeshBuilder.unfraySince`), so no ragged seam runs between two slabs. Loose surfaces
(dirt, gravel, shoulders) break up to 0.1 m deep, a gentle waviness with blade-scale tufts rather
than blob islands. With multisampling the ragged edge is antialiased through alpha to coverage. The
margin shrinks away as its noise falls below a pixel, leaving the band's own antialiased edge, and
it also closes up within the last few meters of the camera, where its cells would grow to dozens of
pixels and read as torn paper. A band opts in with `fray: 'outer' | 'inner' | 'both'` on its
`TerrainLineBand` (outer is the edge away from the line); bridge decks keep their edges whole.

Maps often stop a cul-de-sac street at the bulb's near edge, or simply stop it, and trace only
the sidewalk wrapping round the end. Where a street dead-ends and a mapped footway rings most of a
circle about its end (rays from candidate centers meet the footway's inner edge at similar
distances, all but the mouth the street enters by), that circle is paved as plain asphalt: a
turning circle, or for a tight wrap a rounded end. Footway pieces inside it are clipped away, and
footways that merely connect to the street's end do not count as the ring, so a circle never
spills past a footway onto a lawn (`SurfaceNetwork.findTurningCircles`).

Roads overlap wherever they meet: at a junction, at the corners of their sidewalks, across a narrow
median. Their paving never shares a plane there, or which road drew on top would change pixel by
pixel as the camera moved: the widest road keeps its nominal heights, and each road overlapping
another sits one or more 2 mm steps lower, asphalt, sidewalks, curbs and paint alike
(`SurfaceNetwork.stackRoads`). A mapped line that would lie on itself becomes separate roads: where
it doubles back more sharply than a band can miter, as two one-way carriageways joined where a
divided road narrows do, and at the vertex its own end returns to, as a cul-de-sac mapped up the
street and round a loop back to its middle does. A stall line two parking bays share is painted once.

Curbs are a step, not a stripe: a 15 cm vertical face drops from the curb's road-side edge to the
asphalt, split finer than the ground grid so it follows the draped ground, and jointed like the curb top.
Any draped band can have one with `riser` (meters) on its `TerrainLineBand`.

Styles with streetlights also furnish their blocks: utility poles every 38 m on one side of each
street with sidewalks, set back behind the sidewalk with a crossarm and a pair of sagging lines
between neighbors, and a hydrant at the other curb about every 100 m. Residential streets that
run through residential land also get a mailbox on a post behind the sidewalk every 22–30 m on
both sides (on a mounting board, a top vaulted in stepped courses, a door with a handle facing the
curb and a red flag), about a third of them with a pair of wheeled bins beside it. Poles and
hydrants (1,200 boxes) and mailboxes and bins (4,800) have
per-tile budgets of their own, enough to furnish every street of a dense suburban tile.
Placement is fixed per road, skips junctions, buildings and other roads, and draws in the same
instanced box batch as the lights (`streetFurniture` in the surface stats).

`TERRAIN_SURFACE_STYLES` provides immutable presets. Pass a custom `TerrainSurfaceStyle` to
change colors, inferred road widths, sidewalk width, and defaults for each detail class:

```ts
import { TERRAIN_SURFACE_STYLES } from '@bendyline/molen-terrain/client';
await surfaces.setOptions({
  style: {
    ...TERRAIN_SURFACE_STYLES['1910'],
    id: 'quiet-country',
    label: 'Country lanes',
    dirt: '#a99069',
    roadWidthScale: 0.7,
  },
});
```

## What is drawn

- Modern streets use asphalt, exposed shoulder strips, curb/sidewalk bands, lane dividers, edge paint, stop
  bars and zebra crossings. Shoulders, like the other street details, are drawn on the finest
  detail tiles only: local shoulders are a few decimeters wide, below a pixel on the coarser tiles kilometers
  away, where draping them segment by segment once cost more memory than the roads themselves. Mapped paths are cut at same-grade carriageway edges, so footway
  fills cannot compete with asphalt at walking height; paths beneath bridges remain continuous.
  Nearby nodes on divided roads form one junction; crossings follow
  the external approaches, and short turning links receive no independent crossings. Same-grade
  junctions leave their centers clear of lane paint.
  Mapped signal junctions and inferred crossings of two substantial arterials can receive curbside masts with bars over the incoming lanes,
  yellow backplates, shaded round lenses, and one signal head per lane (up to three).
  Red, amber and green lenses are self-lit, remaining visible at night. Instanced streetlights
  occupy eligible corners outside road corridors, buildings, and water.
- Freeways receive wider paved shoulders, longer lane dashes, a yellow left edge on one-way
  carriageways, and white ramp edges. Green overhead boards use mapped route references or
  destinations. At a connected outgoing ramp, an advance gantry and roadside exit board use
  its exit number and destination when supplied; otherwise the board says only `EXIT`.
  Speed-limit boards require a literal numeric `maxspeed` and display its units. No exit numbers,
  destinations, or numeric speed limits are invented. Supports sit outside the carriageway;
  overhead panels retain at least six meters of inferred road clearance.
- Local intersections use octagonal stop signs by default. A local street meeting an arterial
  receives stops only on the side street; an all-local junction receives all-way plaques.
  Mapped `traffic_signals`, approach `stop`/`give_way` points and central `stop=all` controls
  override this inference, with grade-separated points excluded. A broad `major_road` class
  alone no longer puts lights at every residential intersection. Stop bars cover incoming lanes.
  This is a North American visual fallback, not a survey of local regulations; disable
  `details.inferStopSigns` to retain only mapped stops, or `details.roadSigns` to hide all signs.
  Historical and minimal styles omit signs. Sign faces and lettering are batched geometry with
  host-supplied fonts and no per-sign textures; the worker produces the same geometry as the direct renderer.
- Parking, plazas, and pedestrian polygons are filled, with holes retained. Pedestrian polygons
  and mapped paths use distinct heights above parking pavement, including inferred lots, so
  overlapping sidewalk and asphalt fills remain stable at walking height. Land cover, paved
  polygons, roads, and markings are clipped to the same rendered terrain grid and cell diagonals,
  so large footprints follow dips and hills without covering streets or intersecting each other. Parking receives rows of bays aligned to mapped aisles (or a regular fallback grid) and deterministic parked cars;
  layout checks keep bays out of mapped aisles, holes, buildings and water. Cars are drawn from
  `details.parkedVehicles`, a list of `{ id, spec }` a host builds from loaded vehicle types (the
  world explorer uses the `molen.entities` pack's, in type order); without it no cars are parked.
- Some basemaps omit parking polygons. Service-aisle pairs can infer pavement inside mapped
  commercial/retail sites, near large buildings outside mapped residential areas, or with explicit
  `parking_aisle` metadata. These pairs can be angled and 9–60 world units apart, with at least
  12 units of overlap and half the shorter run. This also fills wedges where access roads meet.
  Without this evidence, the fallback requires three parallel runs at least 28 units long,
  9–26 units apart, with at least 20 units of overlap and half the shorter run. Nearly straight
  fragments are joined before measuring; aisle pairs across ordinary streets are rejected.
- Bounded service-road loops also infer pavement when their connected courts have parking tags,
  a commercial site, or a nearby building of at least 240 square world units outside residential
  land use. This covers office loops and small entrance courts without paving an entire property.
  Faces must be 80–12,000 square units and no more than 240 units across. Junctions tolerate up to
  0.6 units of source simplification error; larger gaps and clipped tile boundaries remain open.
  Tagged driveways, alleys, unpaved roads, bridges,
  tunnels and other road layers do not supply inference geometry.
- Inferred areas are clipped to the site or tile and cut around buildings, water, existing parking,
  and mapped vegetation, playgrounds and sports fields. New loop fills also exclude residential
  land use. This is a visual inference, not surveyed parking geometry; disable `inferParking` to
  use only mapped lots. Large unclassified buildings can still be mistaken for commercial premises,
  and repeated aisle patterns can occur in residential developments too.
- Circa 1910 uses earth-colored roads, narrower inferred widths, and wheel tracks. Its defaults
  omit road paint, sidewalks, signals, streetlights, parking stripes, and modern parked cars.
  It retains the **present-day map layout and buildings**; this is an art treatment rather than
  a historical reconstruction. Individual details can be overridden.
- Simple surfaces retain road and parking fills with decoration disabled.

The decoder preserves road `subclass`, `service`, `link` (including Protomaps `is_link`), `surface`, `lanes`, `oneway`, `layer`, `bridge`, `tunnel`
and explicit `width`. Properties absent from the source use class-based defaults. Tunnel roads are
excluded from the ground painter; Earth views add separate underground bores as described below.
Bridges and differing layers do not form surface junctions. Bridge ribbons retain the
existing approximate terrain-relative elevation; this renderer does not build engineered bridge
decks. Crossing paint, inferred sidewalks, signal placement and parking occupancy are decorative,
not surveyed traffic-control or navigation data. [Ambient life](ambient-life.md) builds its own lane graph
from the same features for NPC traffic. Earth view and world explorer match signal heads to
that graph, displaying the same phase that controls approaching cars. Without a matching
simulation junction, signals use a deterministic cycle: 24 seconds green, 3 seconds amber,
and 2 seconds all-red clearance, with opposing approaches sharing a phase. Custom hosts
call `surfaces.updateSignals(elapsedSeconds, resolver?)`; a resolver receives a world-space
`junction`, outward approach `direction`, and junction `radius`, and returns `'red'`, `'amber'`,
`'green'`, or `undefined` for the default cycle. Direct/static consumers can call
`updateTerrainSurfaceSignals(object, elapsedSeconds, resolver?)` on the surface object instead.
Here `object` is the group returned by `createTerrainSurfaceObject`.

## Signage data in PMTiles

PMTiles is the archive format, so its contents depend on the tile producer. OSM supports
[`highway=motorway_junction` with `ref`](https://wiki.openstreetmap.org/wiki/Tag:highway%3Dmotorway_junction)
for an exit number; ramps can carry `junction:ref`, `destination` and `destination:ref`.
Road `ref` identifies the route, not the exit. The decoder preserves these fields as `ref`,
`junctionRef`, `destination` and `destinationRef`, plus `maxspeed`; exit POIs retain `ref` and
legacy `exit_to` as `exitTo`. `oneway=-1` reverses the decoded geometry, and one-way fragments
join without reversing their travel direction. Motorways are implicitly one-way unless the
source explicitly says otherwise.

OSM also records [`highway=stop` and `stop=all`](https://wiki.openstreetmap.org/wiki/Tag:highway%3Dstop),
`highway=traffic_signals`, and `highway=give_way`. These need point features in the configured
POI layer; merely having an OSM-derived basemap does not guarantee their presence.
The [Protomaps layer reference](https://docs.protomaps.com/basemaps/layers) describes a selective
context map. Its current road producer retains route/shield text and high-zoom one-way cues,
but does not emit the destination, junction-reference or maxspeed attributes consumed here.
Accurate numbered exits and posted limits therefore require an enriched tile source that retains
those tags. There are no live Overpass requests or extra network lookups during rendering.

Numeric OSM speeds without a unit are km/h; explicit `mph` stays mph. Variable, conditional and
country-code speed values are not interpreted. Road signs, gantry positions and sparse spacing
are visual approximations, using a right-hand-traffic layout, with a maximum of 48 signs per
detail tile inside its shared fixture budget. Labels fit uniformly within the panel (bounded to 80 characters); unsupported
glyphs use a question mark. `stats().roadSigns` counts the placed boards. Ambient traffic uses
the more conservative signal inference and treats mapped stop controls as give-way controls;
this change does not add a full-stop/dwell simulation for the decorative signs.

Ground surfaces render at all available semantic levels. Fine markings and fixtures default to
the finest pyramid level; `detailLevelsBelowMax` extends them to coarser levels. Fixture/car and
detail-work budgets bound each tile. A portion of the detail budget is reserved for parking.
Geometry is batched by surface role, broad land-cover meshes share indexed vertices, and fixture/car parts are instanced. Stats cover resident
surface tiles, including temporarily hidden tiles.

## Parking data in PMTiles

PMTiles is an archive format; the encoded tile schema determines which features it contains.
The local Sammamish archive retains service aisles but has no parking polygons in the nine
zoom-15 tiles around the shopping center. The reported shopping and office courts also lack
`parking_aisle` road subtypes: their roads carry `kind=minor_road`, `kind_detail=service`, so
geometry and nearby buildings supply the missing evidence. The renderer consumes polygon features
classified as `parking` or `car_park` when supplied, including holes; those footprints take
priority over inferred fills. A parking POI alone does not supply a boundary.

Protomaps deliberately includes a subset of OSM features. Its documented `landuse` polygon
kinds do not currently include parking, while roads may carry `parking_aisle` detail.
See the [Protomaps layer reference](https://docs.protomaps.com/basemaps/layers).

## Tunnels

World explorer and `mountEarthView` render mapped `tunnel: true` corridors in Human mode.
Roads, paths and railways receive an open-ended floor, walls and ceiling. Portal cuts remove
terrain and draped paving only below the bore ceiling, leaving the hill above it intact.
Visible mesh collision includes the lining. World explorer's free flight slows near the ground,
can descend to 2 m above a road, and uses the bore floor and ceiling while underground.
Aircraft ground support also uses the bore floor at the aircraft's altitude; its existing body
collision still determines whether an aircraft fits.

The Seattle PMTiles fixture contains `is_tunnel` centerlines for the Mount Baker Ridge road and
bicycle/pedestrian tunnels. It supplies neither surveyed floor elevations nor clearances.
The default infers a straight grade between terrain heights at the complete route's endpoints,
with 6.5 m road, 6 m rail and 3.5 m path clearance and the existing transport width defaults.
These are approximate interiors, not surveyed tunnel geometry. Semantic providers can supply
`tunnelFloorElevation` (absolute world Y) and `tunnelClearance`; the MVT decoder accepts
`tunnel_floor_elevation` and `tunnel_clearance`/`tunnel_height`, or configurable property names.

Fragments are clipped out of their tile buffers and joined across neighboring tiles before
grading, so tile boundaries do not create portals or conflicting floor heights. Searches are
bounded to 16 tiles. Unresolved long routes and branches are omitted rather than assigning a
terrain height to an underground tile boundary. A route end counts as a portal only where an
ordinary (non-tunnel) line continues from it: a gap between fragments of a longer buried line,
such as a city subway split into thousands of pieces, would otherwise grade the bore to the
street there and open the ground along its whole length. Tunnel inference runs at the finest source
feature level and above. Hiding the Human layer also removes its portal cuts and navigation
support; the original elevation heightfield always remains available for surface anchoring.

Custom package hosts opt in with `createTerrainPackageSemanticLayers` (or its profiled variant),
passing `tunnels: { heights: elevationSource }` alongside their feature renderer. Share the
elevation source returned by `openTerrainPackagePyramid` with the terrain stream.
`withTerrainTunnels` wraps a custom semantic renderer, and `sampleTerrainTunnel(root, x, y, z)`
returns a visible bore's floor and ceiling in the root's coordinate frame. Observers above the
ceiling continue using the surface height. Static hosts can use `createTerrainTunnelObject`
with complete route lines and a ground sampler that covers both portals.

## Lines beyond roads

`createTerrainLinearObject(lines, context, profile)` is independent of road semantics. Lines use
normalized tile-local `[u,v]` points; profile dimensions use world units (meters in metric Earth
packages). A profile combines offset bands with optional dash patterns and repeated fixtures.
Compatible degree-two fragments join before rendering. The path sampler handles duplicate
points, arc-length spacing, continuous offset edges, bounded joins at bends, closed-loop seams,
and tile clipping. Bands can follow terrain or use absolute elevations. Streamed layer contexts
provide `surfaceResolution`, the actual ground-grid resolution after quality capping; custom
contexts may supply it when their rendered grid is coarser than the source heightfield. Ground
overlays use this grid without changing the logical heightfield used by simulation and collision.

For example, a rail profile combines ballast, two raised rails, and repeated sleepers:

```ts
import { createTerrainLinearObject } from '@bendyline/molen-terrain/client';
const track = createTerrainLinearObject(lines, context, {
  bands: [
    { width: 3.2, color: '#837f70', elevation: 0.25 },
    { width: 0.08, offset: -0.72, color: '#b8b8b2', elevation: 0.46 },
    { width: 0.08, offset: 0.72, color: '#b8b8b2', elevation: 0.46 },
  ],
  repeaters: [
    { spacing: 0.65, size: [2.4, 0.16, 0.22], color: '#76604b', elevation: 0.28 },
  ],
  maxElements: 20_000,
});
```

For a utility corridor, use narrow elevated bands and widely spaced pole repeaters. `size` is
width across the route, height, and length along it. Band `dash: [length, gap]` and `phase` use
world units along the path; callers can carry phase across tile fragments when their source
provides route chainage. `terrainLinePath` and `sampleTerrainLine` are exported for custom
attachment/model placement. Railway switches, wire sag and route-level cross-tile topology are
separate consumers of this foundation, and traffic simulation is [ambient life](ambient-life.md).

## Road sign fonts

Pass `fonts` and optional `signFont` in surface options. The default Earth font catalog supplies
Overpass for highway, exit, speed and stop signs; source case and accents are preserved. Font
geometry is batched into the sign mesh and the worker receives font data only when it changes.
See [Fonts and lettering](typography.md) for the shared layout engine and custom typefaces.


## Road sign pattern library

The world-explorer sample includes **Road sign library** (`road-signs.html`), linked from its
main view. It renders ten patterns from synthetic semantic tiles through the production
detector, with country/state selectors, a 50-state route-marker collection, searchable cards,
rotatable 3D previews, and source-cue annotations. The samples
are demonstrations, not records of surveyed signs. All hardware positions are estimated.

| Pattern ID | Supported cues | Missing-data behavior |
| --- | --- | --- |
| `highway-overhead` | Connected motorway departure; `destination`, `destination:ref`, `junction:ref`, or nearby `motorway_junction` metadata | Regional exit label, if configured, only when topology establishes a departure |
| `highway-exit` | Same departure cues; smaller roadside assembly | No invented exit numbers |
| `all-way-stop` | Central `stop=all` or mapped controls on every incoming approach | Local junctions may infer all-way stops; explicit signals override them |
| `minor-stop` | Mapped approach stop | Minor approaches to an arterial may infer stops |
| `street-speed` | Literal `maxspeed` | Omit unknown, conditional, or variable limits |
| `freeway-speed` | Motorway plus literal `maxspeed` | Same rule, with a 40% larger panel outside the shoulder |
| `yield` | Mapped `highway=give_way` approach | No inference from ramps or roundabouts alone |
| `attraction` | Ramp `destination` with aligned `destination:colour=brown` | Nearby tourism POIs alone do not establish an exit or driving distance |
| `route-guide` | Motorway `ref`/`shield_text`, name, or destination | Omit when labels are unknown |
| `route-marker` | Exact supported `network` plus `shield_text`/`ref`; explicit state reference; local `SR`/`SH` plus state geography | Omit ambiguous or unsupported networks; never invent a route number |

The MVT decoder retains `destination:colour` as `destinationColour`. Semicolon entries align
with the destination list, including empty entries. A single brown colour applies to the
whole destination list. Mixed green/brown destinations become separate boards, keeping only
the brown names on the attraction board. Exit numbers are included only when mapped.
See [OSM destination colours](https://wiki.openstreetmap.org/wiki/Key:destination:colour) and
[FHWA recreational sign guidance](https://mutcd.fhwa.dot.gov/pdfs/11th_Edition/mutcd11thedition.pdf).
Global pattern identities are independent of the regional appearance described below.
Directional/lane-specific destination suffixes, service logos,
temporary restrictions, and exact hardware surveys are not supported yet.

`TERRAIN_ROAD_SIGN_PATTERNS` from `@bendyline/molen-terrain/client` exposes the catalog.
Each `SurfaceSign` in `object.userData.roadSigns` carries `pattern`, `evidence`, `source`,
the resolved `appearance`, and an optional `roadId`. For an overhead exit or attraction board, that ID identifies the ramp
providing the legend. `source: 'mapped'` means the control or legend comes from mapped data;
it does not mean the gantry, pole, or exact sign location was surveyed. This metadata also
survives the surface-worker path. `createTerrainRoadSignObject(sign, context, { fonts })` renders
one detected sign with the same batched face/support geometry; dispose it with
`disposeTerrainSurfaceObject`. Coordinates remain local to the supplied tile context.

## Regional sign appearances

Patterns describe what a sign means and which map cues support it. A `TerrainRoadSignProfile`
supplies guide colours, speed-sign shape, native units, exit wording, stop/yield legends,
roadside placement and a font role. The first Earth presets are:

| Country | Motorway guides | Posted speed panel | Roadside placement |
| --- | --- | --- | --- |
| United States | Green | Rectangular, mph | Right |
| Great Britain | Blue | Circular, mph | Left |
| Germany | Blue | Circular, km/h | Right |
| France | Blue | Circular, km/h | Right |
| Italy | Green | Circular, km/h | Right |
| Switzerland | Green | Circular, km/h | Right |

Europe has no single guide colour. Destination category also matters: British primary routes
use green and local destinations white; French major destinations use green and other
destinations white; Italian non-motorway interurban routes use blue. The British and French
side-exit presets use white when the destination category is unknown. A uniform mapped
`destination:colour` of green, blue, white or yellow overrides the default panel colour;
light panels receive dark lettering. Mixed-colour panels remain approximate. The catalog's
`sources` link the relevant national references, and its `notes` state each preset's limits.

The Earth pack provides `road-signs` (`signs/catalog.json`) and `road-sign-regions`
(`signs/regions.atlas.json`). `loadEarthContent` loads these independently of buildings and
fonts. World explorer and `mountEarthView` select a profile from the terrain tile's centre,
using dedicated country and U.S. state outlines in the same Mercator coordinate frame.
Exact containment wins; a bounded 2.5 km nearest-outline fallback fills coastal gaps.
Right-driving countries are included too, so their interiors cannot inherit a nearby left-driving rule.
Architectural regions do not select signs. These simplified outlines can be imprecise near borders and
coasts. Countries without a preset use the neutral `generic` profile; it is not a national
standard and keeps source units visible. Country coverage is deliberately explicit.

Posted values are never converted or guessed from the profile: `50` means 50 km/h, while
`50 mph` remains 50 mph even under a metric preset. Circular signs omit the unit only when
it matches the country's convention. All presets except the U.S. require mapped stop controls
by default; a local crossroad alone does not establish an all-way stop. Explicit mapped
signals still win. `details.inferStopSigns` can override the profile's inference default.
The same regional driving side controls roadside signs, approach stop lines, signal heads and
the inner edge of a one-way motorway. Mapped one-way direction is preserved. Marking colours
and sign hardware remain medium-fi approximations rather than complete national standards.

Earth uses these country outlines for ambient traffic too. Japan, Australia, New Zealand,
Ireland, India, Thailand, South Africa and other left-driving countries and territories use
the `generic-left` profile where a national sign appearance is not supplied. It retains neutral
panels and explicit source units while placing signs on the left. Hong Kong and Macao have
separate outlines from mainland China. Selection uses the same terrain tile centre for roads
and traffic; simplified borders and coastal outlines can be imprecise.

Custom hosts can pass `signProfile` in `TerrainSurfaceOptions`. It takes precedence over the
optional fourth argument to `createTerrainSurfaceRenderer`, a `(x, z) => profile` resolver.
The host resolves the profile before dispatching a serializable worker job. To share Earth's
selection, call `createEarthRoadSigns(content.roadSigns, metersPerUnit)` from
`@bendyline/molen-earth/client` and pass its `profileAt` callback. Without sign content or an
explicit profile, standalone terrain rendering keeps its existing U.S. appearance.

`TerrainSurfaceOptions.drivingSide` overrides handedness for markings, signals and signs together.
`mountEarthView({ ambient: { drivingSide: 'left' } })` applies this override to its surfaces as
well as its traffic. Without an override, the Earth sign content selects the rule automatically;
without that content, the default remains right. Custom hosts can share
`createEarthRoadSigns(...).drivingSideAt` with `EarthAmbient`.

Profiles request roles such as `sign.gb` or `sign.de`; hosts can bind those roles to additional
compiled font faces. The shipped catalog currently falls back to Overpass for every country.

The Earth pack also provides `road-sign-profiles` (`signs/us-states.json`) and `route-shields`
(`signs/route-shields.json`). All 50 U.S. states have primary route-marker artwork and subdivision
profiles, which override the country appearance. U.S. regulatory panels stay shared;
municipal street-name blade styles are not inferred from state identity. View all state markers
at `road-signs.html?view=states`, or use `?region=us-wa` for Washington's full pattern set.

The decoder retains `network` and `shield_text` independently as `network` and `shieldText`.
Exact network identity takes precedence over geography. County, Interstate, U.S. highway,
business, toll and unsupported secondary networks are not mapped to primary state shields.
Tennessee specifically requires `US:TN:primary`. Missing/compound route numbers are omitted.
For custom hosts, pass `routeShields: content.roadSigns.shields` with the profile resolver.
The worker caches this vector library just like fonts; sign annotations retain network and
number without copying the artwork into every detection record. `profileForSubdivision`
provides explicit subdivision lookup alongside `profileForCountry`.

Artwork is a medium-fi adaptation of CC0 OpenStreetMap Americana symbols and authored shapes;
state borders use public-domain Natural Earth data. It is not a set of exact DOT fabrication
drawings. See `content/earth/signs/README.md` for licenses, source pins and offline regeneration.
It approximates Highway Gothic and does not supply exact Transport, DIN or Frutiger faces.
Route shields, detailed national panel layouts, lane arrows and multilingual exit plaques
remain future extensions. Source destination names are preserved rather than translated.
