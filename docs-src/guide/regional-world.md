# Regional plants, wildlife, ground, and ordinary buildings

Earth content has three independent regional channels. Ecological geography selects vegetation
and ground palettes. Architectural geography selects building recipes. Wildlife combines ecology,
native-country limits, and mapped habitat. They share composable content packs and bounded
quality settings; plants/buildings use deterministic tile generation, while animals use a
separate deterministic population and movement loop.
Mapped land cover, building use, footprints, and measurements remain the local evidence.

## Content and downloads

| Pack | Regional content | Role |
| --- | --- | --- |
| `molen.ecology` | Ecological atlas, plant presets, habitat profiles | `ecology-atlas`, `regional-catalog` |
| `molen.wildlife` | Procedural animals, habitat populations, attributed native-country limits | `wildlife-ranges`, `regional-catalog` |
| `molen.earth` | Architectural region outlines | `atlas` |
| `molen.worldgen.default` | Architectural profiles, archstyles, shared materials | `regional-catalog`, `stylepack` |

`openPacksFromIndex` includes ecology and wildlife among the default Earth pack IDs. Hosts still supply the
index URL and opened packs; the kernel never fetches data. `loadEarthContent` discovers regional
catalogs across those packs, validates references, and passes plain documents to the worker.
An architecture-only catalog works without an ecological atlas. A catalog scoped to a different
style pack is omitted, so a custom style pack can retain the ecological content.

The ecological atlas and catalog total about 99 KB gzip. Its 58 procedural plant presets need no
GLB downloads. The architectural atlas is about 313 KB gzip; ordinary regional recipes are small
JSON files using the default pack's shared material graphs. Authored landmark GLBs continue to
use the existing geographically sharded, lazy model archives.

## Geographic evidence

The ecological atlas derives from [RESOLVE Ecoregions 2017](https://developers.google.com/earth-engine/datasets/catalog/RESOLVE_ECOREGIONS_2017)
under CC-BY-4.0. It uses a quarter-degree grid with run-length encoded rows. Metadata retains 847
source entries, including rock and ice; 843 appear in the reduced grid. Small islands use
intersecting land polygons when a cell center misses land. Four very small source regions fall
below this resolution. This describes potential habitat, not current vegetation or species
observations. Actual local land cover controls whether a plant can be placed.

Architectural envelopes derive from [Natural Earth 1:50m country outlines](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/),
which are [public domain](https://www.naturalearthdata.com/about/terms-of-use/). Exterior rings are
simplified at 0.02 degrees and coordinates rounded to 0.001 degrees. The shipped atlas groups 241
country/territory features into 53 broad envelopes, retaining the Pacific Northwest and US
Southwest subregions. Exact containment wins; an optional nearest-outline fallback fills
otherwise unclassified coastal gaps within 2.5 km in local world coordinates. These envelopes
are visual priors, not building-style surveys or a political boundary service.

Ecological lookup uses a separate grid, so a national border does not move a forest. Each plant
candidate and each building centroid resolves its own profile. Ground meshes sample regional
palettes at vertices, and worker-generated surfaces use the same samples. Uncovered ecological
cells are visible in generation diagnostics and do not receive invented wild vegetation.

Bare and distant terrain receives the same ecological ground palette before detailed map
surfaces arrive. `createRegionalGroundColor` supplies the terrain stream's optional
`surfaceColor` callback; it runs before upload for both worker-prepared and local meshes and
returns linear RGB. An explicit host `style.ground` palette takes precedence in `mountEarthView`.
Nature-reserve, national-park and protected-area designations retain their protection metadata,
but do not paint over the physical habitat beneath them. With no mapped physical cover, sparse
open-ground planting remains a prior, rather than inferred forest or a wildlife-presence claim.

## Composable catalogs

`molen/regional-catalog@1` contains `profiles`, `scatters`, optional `plants`, `animals`, `populations`, and exact-version
`requires`. The `overrides` list names items intentionally replaced from required catalogs.
Load order has no effect. Missing dependencies, accidental ID collisions, unused overrides,
missing references, and equal-priority overlapping profiles in the same channel are errors.

A profile matches any listed value within a dimension and all specified dimensions together:
`biomes`, `realms`, `ecoregions`, and architectural atlas `regions`. Higher `priority` wins
independently for `scatter`, `buildings`, and `wildlife`. A botanical module can refine the vegetation without
changing buildings; a city architecture module can refine buildings without rearranging plants.
Architecture catalogs may name `stylePack`, matching the resolved style pack's `name` identity
(the default is `molen-worldgen-default`, distinct from its content-pack ID).

Use the registered schemas through `molen schema get regional-catalog` and
`molen schema get ecology-atlas`. The low-level API accepts already-loaded data:

```ts
import {
  createRegionalEnvironment,
  createRegionalLibrary,
} from '@bendyline/molen-worldgen-earth/kernel';

// Validate dependencies and architectural references against the host's resolved pack.
const library = createRegionalLibrary(catalogs, pack);
const environment = createRegionalEnvironment(
  { atlas: ecologicalAtlas, catalogs: [...library.catalogs] },
  metersPerUnit,
  architecturalRegionResolver,
);
const selection = environment.at(worldX, worldZ);
```

Pass this environment to the Earth tile adapter/renderer; pass its `docs` to the corresponding
worker bridge. The worker and renderer must use the same documents. `ModelLibrary` accepts the
environment's `library.plants` as its fourth constructor argument (including any derived seasonal
variants). Geometry is cached separately by preset
and LOD, and released when its last consumer drops it. Content hashes include regional documents;
placement seeds stay tied to individual scatter IDs/versions rather than unrelated catalogs.

## Plant and building selection

The plant families cover broadleaf, conifer, palm, cactus, succulent, bamboo, banana, grass, fern, reed,
mangrove, and deadwood silhouettes. Habitats combine canopy, understory, ground cover, open land,
parks, orchards, and wetlands. Regional refinements keep American cacti out of Old World wild
desert profiles and avoid applying Australian eucalyptus profiles to New Zealand.

Mapped trees preserve source `species`, `genus`, `leafType`, `height`, and `crownDiameter` when
available. Exact species names take precedence over genus names; preset `taxa` names match
case-insensitively. These choose a representative silhouette, not a botanically exact specimen.
Observed trees may be planted outside their native habitat. Unknown trees use compatible local
park-tree populations, with the legacy measured broadleaf/conifer form as a fallback. Crown
width and height scale independently to source measurements.

Observed land-cover `crop`, `trees`, and `irrigated` tags survive semantic decoding. Supported
crop tags select olive, date palm, coconut, oil palm, coffee, tea, banana, rubber, and grapevine
forms. Untyped orchards use a regional fruit-tree prior. `rows` on a scatter rule specifies
between-row `spacing`, along-row `interval`, `angle` in degrees, and bounded `jitter`. Rows share
the global placement grid across tile boundaries and retain nested quality subsets; density can
thin the grid but cannot overfill it. The default row bearing is an inferred presentation choice,
not a surveyed field orientation. Crops are confined to mapped cultivated polygons or explicit
crop tags; bare desert does not imply an irrigated oasis.

Scatter rules may require `nearWater: { maxDistance, classes? }`. This gates placement against
mapped water at the exclusion raster's resolution; it does not infer groundwater or tides.
Water polygons preserve dry island holes. Mangroves in an ecological coastal envelope require
nearby mapped water for generic forest/scrub, or mapped wetland/mangrove land cover. Riparian
populations use mapped river/lake proximity and gentler slopes. Missing water data can therefore
underpopulate a real habitat instead of planting wetland trees far inland.

## Seasonal appearance

`mountEarthView` and `createEarthWorldgen` accept `vegetationMonth: 1..12`. The equivalent low-level
setting lives in `RegionalEnvironmentDocs` and is passed unchanged to workers and cache keys.
Omitting it keeps neutral leaf-on appearance. The World Explorer freezes the current UTC month
for its mount; `?month=1..12` selects a repeatable month and `?month=0` disables the seasonal cycle.

Only presets with explicit deciduous `phenology` change. Derived spring and autumn colors and
bare winter branching keep the same mature dimensions, instance positions, individual variation,
and placement seeds. The coarse calendar reverses the southern hemisphere and extends dormancy
at high latitudes. Tropical locations stay leaf-on; evergreen plants do not become bare. This
does not infer local weather, snow, tropical wet/dry seasons, crop harvest dates, or climate change.
Remount with another month to change appearance.

The ordinary architectural catalog supplies 91 recipes across 13 construction families and seven
uses: detached homes, attached homes, apartments, commercial, civic, industrial, and farm
buildings. Mapped use wins over neighborhood inference. Taller measured residential buildings
select compatible apartment recipes; source footprint, height, and levels still control the
generated geometry. Named precedents from the 120-entry structure library remain available
explicitly. Without evidence of age, the ordinary catalog does not randomly assign an iconic
historic building type to an untyped home.

Near-detail ordinary facades include a bounded single, double, or service entrance. The inferred
entrance fits an eligible exterior wall, reserves a ground-floor window bay, and yields to known
structural openings, open ground floors, and raised buildings. It is a visual entrance; it does
not create a traversable opening or claim a surveyed door position. Industrial and farm recipes
also include high windows and larger service doors.

## Wildlife and habitat sound

The optional `molen.wildlife` pack adds an independent `wildlife` profile channel, `animals`, and
`populations` to regional catalogs. It depends on `molen.ecology.regional@1`; opening packs in a
different order does not change selection. Earth and World Explorer load it by default when it
is in the host's pack index. `ambient: { wildlife: false }` disables animals in `mountEarthView`;
World Explorer accepts `?wildlife=0`. Frozen captures retain the existing ambient opt-in rule.

The first catalog has 30 recipes: 21 named mammal taxa and nine functional bird, reptile, fish,
and insect groups. Mammal country membership comes from Mammal Diversity Database v2.5 under
CC BY 4.0. A quarter-degree Natural Earth map-unit grid preserves overseas territory distinctions.
The range document compresses to about 30 KB; the recipe catalog adds a few KB. No animal GLBs
are downloaded. Source hashes, transformations, licenses, and limitations ship in the pack.

Country membership is a coarse limit, not within-country occupancy. Named taxa require an
attributed range plus compatible biome/realm and actual mapped land cover. Recent introduced
populations and uncertain country memberships are omitted. Large/rare mammals also require
explicit mapped conservation habitat, and water-dependent animals require mapped nearby water.
An uncovered range cell cannot authorize a named mammal. Unnamed functional groups deliberately
make no precise species claim. These choices and visual densities are authored priors, not a census.

Wildlife reads the finest displayed land-cover and human-feature tiles. Unknown terrain, built
areas, roads, buildings, water inappropriate to the animal, and steep slopes reject placement.
Island/courtyard holes remain usable. Swimming animals share the rendered water datum; flight
uses a bounded clearance. The 20 Hz kernel uses stable world-grid candidates, independent seeds,
plain restorable state, bounded wandering, and path substeps. Population, distance and pose caps
follow Earth quality. Models share recipe geometry, use one opaque skinned draw per animal, and
dispose with the terrain stream. Tiny animals disappear at short distances.

An explicit vegetation month also suppresses the generic insect/lizard groups in the coarse
cold season and changes the arctic-fox coat. It does not simulate migration or actual weather.
Existing generic birdsong and cricket recordings are gated by regional habitat and season, then
by weather, daylight and height above ground. They are not recordings of the named visual taxa.
Hosts composing their own view can supply `EarthAudioFrame.regionalAmbience` or use
`EarthWildlife.ambience`; omission preserves the legacy generic soundscape.

## Authoring and verification in this repository

The authoring source is in `content/ecology/source/`. Run `build-catalog.mjs` for plants/habitats
and `build-architecture.mjs` for regional archstyles and bindings; both support `--check`.
`packages/worldgen-earth/scripts/generate-structure-atlas.mjs` derives the runtime architectural
atlas from the checked-in reduced country data and geographic assignments.

Large upstream geography stays outside runtime packs. The Python converters under
`packages/worldgen-earth/scripts/` accept an explicitly supplied source ZIP and use the pinned
authoring requirements there. Source URLs, hashes, licenses, and reduction methods travel with
the data or its notice. Regeneration does not require downloading the upstream datasets during
ordinary builds.

`content/wildlife/source/build-catalog.mjs` builds the animal recipes and supports `--check`.
`build-wildlife-ranges.py` takes explicit, checksum-pinned MDD CSV, metadata CSV and Natural Earth
map-unit ZIP inputs. `content/wildlife/source/preview-animals.mjs` imports, inspects and captures
procedural bind poses through the public asset pipeline; it does not verify live animation.

`preview-plants.mjs`, `preview-regions.mjs`, and `preview-architecture.mjs` produce local review
artifacts. Landscape fixtures exercise the real scatter adapter but bake placements for portable
capture; they do not measure live instancing performance. Review real streamed locations as well
as fixtures, including camera movement, terrain slopes, boundaries, and quality changes. Follow
the [medium-fi style guide](medium-fi.md) for geometry, color, and LOD budgets.

`preview-live-viewer.mjs` accepts a local terrain package and geographic camera position, captures
the streamed Explorer in fixed daylight, and records loading failures, draw/geometry counts,
wildlife counts, and measured frame intervals. `profile-live-tile.mjs` separates scatter and
building CPU costs on real decoded map tiles. `preview-mounted-viewer.mjs` exercises the public
`mountEarthView` API through orbit, walking, driving and flight. Browser measurements describe
the reviewing machine; they are not portable device performance guarantees. The reusable terrain
extract builder accepts an explicit source release, bounds, package name and snapshot date, so
these small local QA extracts retain their own provenance.

`content/wildlife/source/preview-motion.mjs` captures changing skinned poses from the actual
wildlife renderer and deterministic movement system. It complements the static asset previews.
After completing those captures, `content/ecology/source/build-review-gallery.mjs` assembles a
searchable local gallery at `.artifacts/regional-world/review.html`, with separate live terrain,
controlled landscapes, building families, wildlife poses, and public API camera modes. It retains
the known visual limitations beside the evidence rather than treating successful capture as
art approval.

Fine habitat transitions, richer wildlife behavior/body variation, and detailed city/rural
architectural overrides need finer evidence and additional authored content. The repository's
`content/ecology/coverage-plan.json` records implementation, acceptance evidence, and these
remaining fidelity limits.
