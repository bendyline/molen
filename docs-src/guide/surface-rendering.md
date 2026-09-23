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
  bars and zebra crossings. Mapped paths are cut at same-grade carriageway edges, so footway
  fills cannot compete with asphalt at walking height; paths beneath bridges remain continuous.
  Nearby nodes on divided roads form one junction; crossings follow
  the external approaches, and short turning links receive no independent crossings. Same-grade
  junctions leave their centers clear of lane paint.
  Four-way major junctions can receive illustrative traffic signals. Instanced streetlights
  occupy eligible corners outside road corridors, buildings, and water.
- Parking, plazas, and pedestrian polygons are filled, with holes retained. Pedestrian polygons
  and mapped paths use distinct heights above parking pavement, including inferred lots, so
  overlapping sidewalk and asphalt fills remain stable at walking height. Land cover, paved
  polygons, roads, and markings are clipped to the same rendered terrain grid and cell diagonals,
  so large footprints follow dips and hills without covering streets or intersecting each other. Parking receives rows of bays aligned to mapped aisles (or a regular fallback grid) and deterministic parked cars;
  layout checks keep bays out of mapped aisles, holes, buildings and water.
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
and explicit `width`. Properties absent from the source use class-based defaults. Tunnels are
omitted; bridges and differing layers do not form surface junctions. Bridge ribbons retain the
existing approximate terrain-relative elevation; this renderer does not build engineered bridge
decks. Crossing paint, inferred sidewalks, signal placement and parking occupancy are decorative,
not traffic-control or navigation data.

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
attachment/model placement. Railway switches, wire sag, traffic simulation, and route-level
cross-tile topology are separate consumers of this foundation.
