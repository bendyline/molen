# Worldgen: styled buildings from outlines, props from land labels

`@bendyline/molen-worldgen` turns any outline into a styled building and any labeled polygon into
deterministic prop placements. It knows nothing about maps: give it an outline in meters, a few
opaque labels, a style, and a stable identity, and it returns typed-array mesh buffers. The
sibling package `@bendyline/molen-worldgen-earth` is the binding that feeds it real map data: it
adapts `molen/terrain-semantics@1` tiles (Protomaps / OpenStreetMap footprints and land use) into
those requests, resolves regional looks from a lon/lat atlas, and plugs the result into the terrain
streamer as tile layers. A dungeon generator and the Earth renderer call the same functions.

## 1. The two layers

The [default structure library](structure-library.md) contains 120 resizable structures in 13
taxonomies and 45 shared materials. The world explorer's `/structures.html` model sheet renders
every entry and provides dimension, texture and detail controls.

For enterable buildings and lazy ground-floor furnishings, see [Building interiors](building-interiors.md).

```
@bendyline/molen-worldgen           world-agnostic core
  /kernel   formats, footprint analysis, roofs and walls, batch generator, GLB encoder, seeds
  /client   buffers to three.js meshes, instanced boxes, style-pack loader

@bendyline/molen-worldgen-earth     Earth binding (terrain-semantics, OSM classes, lon/lat)
  /kernel   molen/region-atlas@1, tile adapter, tile-edge ownership, budgets by quality
  /client   TerrainSemanticTileRenderer implementations, atlas loader

molen.worldgen.default  content pack: the shipped looks (styles, scatter rules, structures)
molen.earth             content pack: world.atlas.json (which style applies where), business catalog
```

The npm packages carry code only. The default looks are content packs (`molen/pack@1` zips),
published with each release at `https://molen.dev/packs/`. In a project,
`npx molen pack fetch https://molen.dev/packs/index.json` downloads them into `packs/` and pins
them in project.json, and an app serves the same zips from wherever it hosts them. Their sources
are [`content/worldgen`](https://github.com/bendyline/molen/tree/main/content/worldgen) and
[`content/earth`](https://github.com/bendyline/molen/tree/main/content/earth) in the engine
repository.

The core package has no terrain dependency and a test forbids map vocabulary in its sources. Core
inputs are `BuildingRequest` (identity, labels, outline, optional height/levels/minHeight) and
`ScatterRequest` (labeled polygons, exclusions, an anchor frame, a keep fraction). Outputs are
`MeshBuffers` (positions, normals, uvs, 8-bit colors, indices, material groups) and
`PlacementSet`s (10 floats per instance: position, yaw, scale, tint).

## 2. Quick start

World explorer, real data, in the browser:

- [molen.dev/play/world-explorer](https://molen.dev/play/world-explorer/): styled Sammamish
  buildings in the Human mode.
- [`?synthetic=1&lineup=1`](https://molen.dev/play/world-explorer/?synthetic=1&lineup=1): one
  building of every footprint class along a road.
- [`?style=none`](https://molen.dev/play/world-explorer/?style=none): flat extrusions, no pack.

From code, one building from one outline, no map involved:

```ts
import { openPack } from '@bendyline/molen-pack';
import { createBuildingObject, createVertexColorMaterialSet } from '@bendyline/molen-worldgen/client';
import { resolveStylePackDocuments } from '@bendyline/molen-worldgen/kernel';

// The default style pack, from wherever the app hosts it.
const styles = await openPack('/packs/molen.worldgen.default.zip');
const pack = await resolveStylePackDocuments(await styles.readJson('stylepack.json'), (path) =>
  styles.readJson(path),
);
const style = pack.archstyles['molen.worldgen.fantasy.hall'];
const hall = createBuildingObject(
  { identity: 'room:hall-1', labels: ['hall'], outline: [[0, 0], [24, 0], [24, 10], [0, 10]], levels: 2 },
  style,
  { name: pack.root.name, version: pack.root.version },
  { materials: createVertexColorMaterialSet() },
);
viewer.renderer.worldRoot.add(hall);
```

Headless, in Node, the same thing produces buffers you can hash or encode:

```ts
import { encodeGlb, generateWorldgenBatch } from '@bendyline/molen-worldgen/kernel';

const out = generateWorldgenBatch({ buildings: [request], pack });
const glb = encodeGlb(out.buildings);   // core glTF 2.0, one primitive per material group
```

From the command line (or the MCP tools of the same names), without writing code. The commands
need a style pack: pass `--pack` (a content pack zip, a pack source directory, or a
`stylepack.json`), list one in the project's `packs`, or set `MOLEN_PACKS`. In a project:

```sh
npx molen pack fetch https://molen.dev/packs/index.json          # once: packs/ + project.json pins
npx molen worldgen preview --out preview.png --angles 4          # the lineup of every shape class
npx molen worldgen preview my.archstyle.json --out preview.png   # a style file, injected into the pack
npx molen worldgen bake --outline "0,0;18,0;18,9;10,9;10,14;0,14" --style molen.worldgen.fantasy.hall --out assets --id keep
npx molen worldgen bake hall.batch.json --out assets --id hall  # a molen/worldgen-batch@1 document
npx molen worldgen stats path/to/terrain-package.json --auto --dump tile.batch.json
```

`preview` generates in Node and renders the buffers, props, and scatter in headless Chromium
from turntable angles (the MCP tool returns the images). `bake` writes a glTF asset with a
`molen/asset@1` sidecar under an assets root, so a dungeon scene references the hall as a plain
`gltf` renderable; roof props and scatter are instanced placements and are reported, not baked.
`stats` opens a real terrain package off disk, generates one tile twice, and reports counts,
footprint and roof histograms, sizes, timings, and whether both runs hashed the same; `--dump`
writes the adapted batch (`molen/worldgen-batch@1`, identities of clipped pieces suffixed so
they stay unique) for `preview` and `bake`. A `molen/worldgen-batch@1` document is the
interchange: ground (`flat` or `slope`), building requests, optional mapped props and a scatter request, rules,
and a detail tier; `molen schema get worldgen-batch` prints its schema. Two example batches live
in the engine repository's
[`content/worldgen/fixtures/`](https://github.com/bendyline/molen/tree/main/content/worldgen/fixtures),
beside the pack source but not packed.

## 3. Authoring a look: `molen/archstyle@1`

A style is one JSON document under a pack namespace. `molen schema get archstyle` prints the
full JSON Schema with units on every field; `molen validate styles/x.archstyle.json` reports
pinpoint errors with did-you-mean hints for palette names. The sections:

- `applicability`: which labels and contexts the style is meant for (informational; a pack or
  atlas rule binds it, and a notice fires when a rule and the style disagree).
- `massing`: floor heights, the `heightFallback` chain used only when a request carries neither
  `height` nor `levels` (ordered `when` rules, last one is a catch-all), how the platform follows
  the ground (`platform-average` keeps within 4 m of the mean, `platform-max` sits on the highest
  point), the exposed foundation, wing decomposition limits, and tower setbacks.
- `roof`: weighted `choices` among `flat | gable | hip | pyramid | shed | mansard | gambrel`, each
  with a pitch range and optional eligibility (`when: { elongationMin: 1.15 }` keeps gables off
  square plans). Roofs are built per wing: an L becomes two gable wings meeting in a valley.
  Outlines that do not decompose, cut pieces at tile edges, and anything beyond `maxWingSpan` fall
  back to flat (with a parapet when the choice has one) or, for small irregular plans, a skillion.
- `facade`: bay widths, window rhythm, base bands, and cornice. Windows and trim are generated
  geometry with cell UVs for glass and metric UVs for solid materials.
- `materials` and `palettes`: one weighted material choice per part (wall, roof, trim, foundation,
  window) and named palettes with HSL jitter. Per-building variation costs nothing: a palette pick
  plus jitter becomes a vertex tint, and metric UVs get a seeded offset.
- `props`: attachments (chimneys, rooftop units) with anchors, counts, and spacing.
- `lod.tiers`: which features survive at each detail tier; beyond the last tier the building is an
  instanced tinted box.

Every choice is sampled from a named stream of the building seed, so editing the roof section
never reshuffles the palettes.

### Materials, windows, and props

A part's `materials` entry lists weighted material references. `palette:#rrggbb` is a flat
color that lands in the vertex tint (it never costs a mesh group); `matgraph:<pack material id>`
is a procedural texture document from the pack's `materials` map. Textured parts declare
`uvScale` (meters per texture repeat); the generator emits UVs already divided by it, so a wall
material shared by several styles still repeats at each style's scale. With `tint: 'multiply'`
the sampled palette color multiplies the texture, so pack textures are authored light (the
default pack asserts a mean luminance of at least 0.55 for every tinted material). Windows use
`tint: 'none'` and `uv: 'cell'`: every window is one texture repeat.

`facade.windows` places windows per bay and floor: `punched` (one window per bay, seeded
`probabilityPerBay`), `ribbon` (one strip per floor), `grid` (glazing filling the bay), or
`none`; `groundFloor: 'storefront'` adds ground-floor glazing even when upper windows are
`none`. Window height caps the storefront glass below a solid wall band; window width controls
its pane spacing. `facade.bands` adds a
base band, floor lines, and a cornice from the trim material. Glazing uses surface quads, gated
by `facade-texture`. The `facade-bands` feature adds raised window surrounds, sills, bounded
storefront mullions, and projecting bands with exposed upper and lower faces. Structural entrance
frames remain open at every tier; simplified frames omit depth and hidden faces to conserve the
geometry budget. Shared linear-filtered worldgen textures use mipmaps and anisotropic filtering.

`props` attach pack or builtin models: `roof-ridge` walks the ridge of the dominant wing
(chimneys), `roof-flat` fills a flat roof with `margin` from every edge (rooftop units),
`roof-edge` lines the outer edges at the parapet (canales). Prop models are pack assets
(`assets` map, a `molen/asset@1` sidecar next to `model.glb`); the default pack generates its
materials and prop models from `scripts/generate-pack.mjs` and the build checks they are current.
Placements come out of the batch as `props:<model>` placement sets, instanced like scatter.

### Building scale and missing measurements

Supplied `height` sets the total envelope, including roof and raised clearance. When `levels`
is also present, it controls the number of storeys: floor spacing fits the available wall height
instead of deriving extra window rows from a nominal floor height. Without levels, the estimate
accounts for the taller ground floor and reserved roof space. Budget variants retain the same
window positions even when they omit the parapet.

The default commercial glass texture has one vertical row per generated storey. Untyped buildings
and low-rise uses with no height or levels default to one or two storeys, independent of footprint
area; explicitly identified offices retain their taller fallback rules. Big-box retail defaults
to one tall storey with storefront glazing and solid walls above. These are conservative visual
defaults, not recovered building measurements. Source heights and levels take precedence.

## 4. Seeds and identity

```
building seed:  wg1|b|<pack.name>@<pack.version>|<style.id>@<style.version>|<identity>
aspect seed:    <building seed>|massing | roof | facade | palette:<name> | material:<part> | props:<id>
prop salt:      wg1|p|<pack>@<version>|<scatter.id>@<version>|<rule.id>   then hashCoord(cellX, cellZ, salt)
```

The identity is caller-owned and opaque. The Earth binding uses the source feature id (`f:<id>`)
because tile cutters clip one building into two tiles and the id is the same on both sides; without
an id it quantizes the centroid to 0.5 projected units (`c:<qx>,<qz>`). Bumping a pack version, a
style version, or the seed scheme is the only way to re-roll a world.

## 5. Placement rules: `molen/scatter@1`

A scatter rule set maps land labels to weighted species with density per hectare, clustering noise,
slope and altitude limits, clearances from roads, buildings, and water, and a keep fraction per
detail tier. It also carries the surface colors the land-classification layer paints. Rules bind
builtin procedural species, model ids from the pack, or an imported namespace such as `molen.entities`.

The sampler walks a jittered grid anchored to the request frame, not to the batch, so a cell yields
the same candidate for every caller that covers it: neighbouring tiles never duplicate or miss a
prop, and a coarser tile shows a nested subset of its children (the keep fraction and every cap
thin by the same per-cell acceptance draw). Per batch it rasterizes the labeled polygons and the
exclusions (roads and waterways as ribbons, buildings as dilated rings), then per rule visits only
the cells under matching polygons, applies clustering noise, slope and altitude limits, picks a
species by weight, and draws scale, heading, and tint from independent streams of the cell hash.
Output is one `PlacementSet` per model (stride 10: position, yaw, scale, tint), ordered by cell.

On the client, `ModelLibrary.prepare(ref)` turns a glTF scene into one merged vertex-colored
geometry (material colors baked in, so an authored tree with two materials is one draw), keeps
builtin primitives (`builtin:tree.conifer`, `builtin:shrub`, `builtin:rock`, ...) for packs
without assets, and `createInstancedPlacements(set, geometry, material)` uploads a placement set
as one `InstancedMesh`. The default regional scatter packs use procedural fir, pine, oak, and
birch (`builtin:tree.conifer.fir|pine`, `builtin:tree.deciduous.oak|birch`), clustered shrubs, and
irregular rocks. Their opaque crowns, bark, and vertex colors share one geometry and material per
species: no texture downloads, alpha cards, or per-tree scene objects. Conifers have a closed,
scalloped crown that conceals the upper trunk; broadleaf crowns use overlapping foliage clumps.
Tiles below the finest level use cached coarse crowns (132 triangles per conifer, 124 per
broadleaf tree; 60 per shrub and 20 per rock), sharing the same material and instance transforms.
The Earth renderer further partitions vegetation into 512-meter cells and switches from near to
medium to distant geometry as the camera moves. Thresholds are 180 and 650 meters beyond each
cell’s bounding sphere, with 15% hysteresis to avoid flicker. Distant crowns use 12 triangles for
conifers and 20 for broadleaf trees. Cells share geometry, materials, and instance buffers across
levels and can be frustum-culled independently; no per-frame placement uploads are needed.
`propLod: false` disables this camera LOD, and the explorer exposes `?propLod=0` for comparison.
The explorer's `AssetCache` still resolves authored GLBs for custom packs and building props.

A population's optional `widthScale: { min: 0.8, max: 1.25 }` multiplies X/Z independently of
its uniform `scale`, allowing tall narrow trees, broad bushy trees, and spreading shrubs in the
same draw. Width uses its own cell-hash stream, so changing it preserves positions, heights,
headings, tints, and the subset shared by neighbouring tiles and detail tiers. Omitting it keeps
uniform scaling. Default vegetation rule sets are version 2 (new planting seeds); architecture
seeds are unchanged.

## 6. Packs: `molen/stylepack@1`

A style pack's source directory looks like this (the default pack's is
[`content/worldgen/`](https://github.com/bendyline/molen/tree/main/content/worldgen) in the engine
repository); `molen pack build <dir>` turns one into a content pack.

```
my-stylepack/
  stylepack.json           name, version (seeds), namespace, id → path maps, defaults, imports
  styles/**/*.archstyle.json
  scatter/*.scatter.json
  materials/, assets/      matgraph documents and prop sidecars (later phases)
```

`defaults.rules` is the pack's own ordered style selection (`when` over labels, context, area,
height presence, elongation, rectangularity) and `defaults.style` closes the chain. Loading a pack
validates every document and cross-checks ids, material kinds, and model sources; a dangling id
fails loudly with the candidate list. `resolveStylePackDocuments(root, readDoc)` is the pure
resolver: give it a content pack's `readJson` and it reads everything from one zip.
`loadStylePack(baseUrl)` fetches an extracted directory in the browser.

## 7. Earth binding: `molen/region-atlas@1`

An atlas lists prioritized regions (a lon/lat bbox and/or polygons) with ordered style rules and a
scatter set, plus a worldwide default chain. Precedence for a building is: region rules, region
default, atlas default rules, atlas default style, pack rules, pack default style. The region is
resolved once per tile at its centre; when a tile straddles regions every building resolves at its
own centroid. Atlas geometry is projected once into the package's world meters, so lookups are
comparisons.

The adapter also decides tile-edge ownership: a footprint that appears complete in two tiles is
rendered by the tile holding more of it, and a footprint cut by both buffers is rendered piecewise
with seam walls and a flat roof. Both tiles reach the same verdict from their own copy.

Stock Protomaps buildings should be extracted through zoom 15. At zoom 14 and below the
basemap merges footprints and rounds heights; zoom 15 retains individual features and the
available unrounded heights. The adapter consumes height, minimum height, and building parts.
The basemap derives some heights from floor counts, but does not retain raw floor counts, roof
shape, roof material, or the original building type for ordinary outlines. Missing attributes
remain estimates; residential land use is evidence of likely use, not a zoning or floor-count
record.

Building context uses several points across the footprint. Mapped land use takes precedence over
physical cover such as grass or woodland; among overlapping uses, the smaller polygon wins.
Explicit building classifications override generic labels. Residential context selects residential
styles even for large or long townhouse footprints, with a conservative two-floor fallback for
larger footprints. Roof eligibility sees supplied or resolved floor counts: the default residential
styles prefer pitched roofs through three floors and flat roofs from four upward. The Southwest
style also allows flat roofs on low buildings. Wide, clipped, or unsuitable footprints can still
require a flat roof for geometric reasons.

### Inferred trees around homes

Atlas region bindings and the worldwide default accept `treeFillFactor` from 0 to 1. The
shipped atlas uses 0.9 in the Pacific Northwest, 0.3 in Japan, and 0 in the Southwest and
unclassified regions. These are configurable visual priors, not measured canopy percentages
or a global climate dataset. Fill is resolved at each home's location, including region edges.

For complete low-rise footprints of 45–700 m², the Earth adapter adds an irregular yard patch
roughly 18–26 meters beyond the home. Explicit house classifications qualify; small untyped
buildings also qualify when land use does not contradict residential use. Known commercial
buildings, elevated parts, tall buildings, and generalized or source-clipped footprints do not.
No residential land-use polygon is required. Unknown parcels and driveways cannot be recovered
from absent data, so this remains an estimate of open space.

The patch and its tree acceptance/species/size use a named `yard-trees` stream of the building
seed. The shared world grid supplies candidate positions: overlapping yards have one stable
owner per cell, feature ordering does not reshuffle trees, and lowering fill or detail keeps
surviving instances unchanged. The serialized scatter polygon carries its optional uint32
`seed`. Existing unseeded scatter retains its previous placements.

Mapped woodland, parks, parking, playing fields, farmland, barren ground, and other incompatible
land cover are cut out before planting. Road, building, water, and mapped-tree exclusions still
apply, as do slope/altitude limits and instance budgets. Neighboring buffered footprints
participate even when their building mesh belongs to another tile; trees emit only inside the
current tile. Coverage still depends on the footprints supplied in the source tile buffer.

The dedicated `home_canopy` scatter rule controls species, spacing, setbacks, and detail tiers;
custom packs opt in by supplying this rule label. Species use the tile's regional scatter set,
as with other vegetation. House infill runs in scatter-only worker requests and uses the same
instanced vegetation and camera LOD as forest scatter. No individual tree records are required.

A supplied building height is the total ground-to-top envelope, including the roof and any
minimum height. Roof geometry fits inside it instead of being added above it. Roof props may
project above that envelope. Parts spatially contained in an outline replace the covered area;
uncovered areas of the original outline remain. Related pieces receive a shared `groundOutline`
for fitting their platform to terrain, and raised parts retain their minimum-height clearance.
Containment is a spatial inference because stock Protomaps does not publish parent relation IDs.

## 8. Budgets and quality

`worldgenTileBudgetForQuality(quality, levelBelowMax)` caps buildings and vertices per tile.
Building batches reserve simple architecture before allocating extra detail to the largest
footprints. The budget fallback preserves the authored footprint, roof shape, and (where the
active style tier permits them) up to three window columns and two rows per wall, using shared
vertex-colored materials during reservation. Eligible simplified buildings recover their shared
textures when material groups fit, even if no geometric detail fits. High admits 24 material
groups at the finest level, including flat fallback slots. The fallback omits raised window
surrounds, trim bands, overhangs, separate foundation meshes, and roof
props. Simplified and coarse buildings extend their walls below the lowest sampled ground,
keeping roofs and windows level without gaps on downhill sides or extra vertices and draw calls.
Box fallbacks do the same; intentionally elevated `minHeight` parts retain their clearance.
`detailedCount` limits eligibility for extra detail; it no longer turns all later buildings into
boxes. Vertex and material-group caps still apply, with boxes used when the simple geometry
cannot fit or the requested tier is beyond the style's last tier. Buildings beyond
`maxBuildings` are still omitted. Quality and detail remain tile-based, not camera-distance
updates per building.

Generation is cooperative: the renderer yields between chunks of both reservation and detail
work, and aborts when a tile is evicted. The explorer HUD reports buildings, boxes, and generation
time per tile.

Detail tiers come from the level below the finest (tier 0 at the finest level, 1 one level
below, ...) plus one at economy quality. A style's `lod.tiers` say which features survive each
tier: roof shape, roof features, facade windows, facade bands, props; beyond the last tier the
building is a tinted box. `maxMaterialGroups` caps the mesh groups (draw calls) of one batch:
once a batch would exceed it, later buildings render their textured parts as vertex colors
(`stats.materialsCollapsed`), so the largest buildings keep their textures first.

Scatter is bounded the same way. `maxInstances` caps the props of one batch as a whole (the
sampler thins uniformly across rules by the same acceptance draw, so a tighter budget is a subset
of a looser one) and `maxInstancesPerRule` caps one rule. The tile budgets shrink both with the
detail level: a tile one level below the finest covers four times the area with a fraction of
the instances, two levels below keeps a sparse hint, and coarser tiles carry no props. Visible
cells draw only their active LOD; keep `maxPropModels` small because each model needs a draw per
visible cell. The per-tile placement budgets still bound the resident instance data. Balanced quality
allows 6,000 nearby placements, 1,200 one level below, and 250 two levels below. Economy uses
2,200 / 400 / 0; high uses 9,000 / 1,800 / 350. The forest rules fill nearby crowns while
understory is limited to the finest tier; parks and yards retain lower densities and all
placements retain road, building, and water clearances.

## 9. Wiring it yourself

```ts
import { loadStylePack } from '@bendyline/molen-worldgen/client';
import { createRegionResolver, createWorldgenSemanticRenderers, loadRegionAtlas } from '@bendyline/molen-worldgen-earth/client';

const { pack } = await loadStylePack('/worldgen/default/');
const atlas = await loadRegionAtlas('/worldgen-earth/default/world.atlas.json');
const regions = createRegionResolver(atlas, { metersPerUnit });
const worldgen = createWorldgenSemanticRenderers(pack, { atlas, regions, metersPerUnit, quality });
const layers = await createProfiledTerrainPackageSemanticLayers(pkg, {
  baseUrl,
  landcoverLayer: { renderer: worldgen.classification },
  featuresLayer: { renderer: worldgen.humanFeatures },
});
```

## 10. Off the main thread, cached, and queryable

`createWorldgenSemanticRenderers` takes a `generator`: by default tiles generate on the calling
thread in cooperative chunks; `createWorldgenWorkerBridge(worker, { pack, atlas, metersPerUnit })`
sends each tile (semantics, geometry, a transferable height grid) to a Worker that runs
`installWorldgenWorker(self)` from `@bendyline/molen-worldgen-earth/worker` and hands back
transferred buffers; aborting a tile cancels its generation between chunks. Both paths sample
the ground through the same height grid, so their output is byte-identical (a test asserts it).
A `cache` (`createWorldgenTileCache`) keeps generated tiles in CPU memory keyed by pack, atlas,
quality, features, and address, so a tile that leaves and re-enters residency is uploaded, not
regenerated. The explorer enables this worker by default; `?worker=0` selects the in-thread diagnostic path.

Land-cover polygon draping and vertex welding also run in a separate worker in the explorer.
`createTerrainLandcoverWorkerBridge` (terrain client) supplies the renderer’s `landcoverGenerator`;
the host’s worker entry calls `installTerrainLandcoverWorker`. It transfers an independent copy of
the height samples and returns indexed geometry, preserving the rendered terrain grid. Only one
job runs at a time in this worker; cancelled queued jobs are skipped. Road/parking construction
also uses a dedicated surface worker in the explorer. Archive decoding, scene assembly, and GPU
uploads still happen on the main thread.

A shared `lodPolicy: ScreenSpaceLodPolicy` enables projected-screen-size LOD for vegetation and
buildings. Buildings retain their structural faces while distant materials and facade details
simplify; geometry attributes are shared across spatial cells and levels. `setQuality(preset)`
changes future generation and queues resident architecture for replacement, one building batch
at a time. The previous buildings stay visible until their replacements are ready; roads remain
in place. Preset changes and eviction cancel obsolete replacements. Policy mutations immediately
affect resident LODs; existing scatter keeps its generation density until reloaded. Generation
cache keys include effective budgets/tier offsets; `setCacheBudget(bytes)` trims the cache in place.
See [Adaptive rendering performance](adaptive-performance.md) for the explorer's device feedback
controller, live terrain budgets and measurement limits.

Gameplay can ask what was generated: `createWorldgenIndex(records, placements)` buckets a batch
(or several tiles, with `add`) and answers `buildingAt(x, z)`, `buildingsNear(x, z, r)`, and
`propsNear(x, z, r)`; `installWorldgen(world, index)` registers it on a kernel world as a side
channel (never in world state or its hash) and `worldgenScriptApi(handle)` exposes it to scene
scripts as `molen.worldgen.*` through `buildWorld`'s `scriptExtensions`.

Scenes that are not maps carry a `worldgenBuilding` component (style id, outline in the entity
frame, holes, height or levels, labels, seed, tier): `createWorldgenEntityLayer(client, { pack })`
renders every such entity on a live client under its `transform`, rebuilding when the component
changes and disposing when the entity goes away.

## 11. Limits

- Inputs include land classes, vector footprints and optional business/prop points; nothing samples imagery. See [recognizable places](recognizable-places.md).
- Protomaps business identity comes from optional POIs at the finest detail level. Buildings mostly carry `kind: building`; rules lean on footprint metrics, height
  presence, and the surrounding land use. Context is available when land use and buildings share
  one archive (the Sammamish package does).
- Roofs of clipped tile-edge pieces are flat; secondary wings share the main eave height.
- Windows are surface quads, not openings; dormers and setbacks are declared in the format but not
  built yet; `wall-any` and `ground-any` prop anchors place nothing yet.
- Builtin vegetation uses spatially batched distance or screen-space LOD. Custom GLBs retain their authored
  geometry; they need authored LOD assets or simplification before the same reduction is possible.
- Baked assets hold the building mesh only; props and scatter stay instanced placements.
- The entity layer places buildings statically (no tweening) and needs prop models prepared
  through a `ModelLibrary` to show roof props.
