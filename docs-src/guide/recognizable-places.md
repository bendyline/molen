# Recognizable places and mapped props

The Protomaps profile can decode the `pois` MVT layer into renderer-neutral `TerrainPoiFeature`
records. Include `"poi"` in a terrain package's `features.layers`; the bundled Sammamish package
does so. POI names, categories, details, IDs and optional enriched brand/measurement fields survive
decoding. Label `min_zoom` is not a semantic filter: useful points marked 16–18 already exist in
the archive's zoom-15 tiles.

## Identity library

The Earth catalog recognizes **44 mapped source businesses** by exact aliases and verified source
IDs. Each match selects a generic descriptor model rather than a source-business sign: for example,
Walmart maps to `sign.mart_store`, Taco Bell maps to `sign.taco_place`, Best Buy maps to
`sign.electronics_store`, and The Home Depot maps to `sign.hardware_store`. The
[retail catalog](https://github.com/bendyline/molen/blob/main/content/earth/businesses/README.md) documents the
source data and mapping policy.

Nine generic treatments cover grocery, restaurant, cafe, pharmacy, shop, department store, shopping
mall, outlet center and strip mall. These also support unnamed points with known categories.
Unknown identities keep the normal architectural fallback. This is a stylized descriptor library,
not a complete global business database.

Matching lives in
[the Earth business catalog](https://github.com/bendyline/molen/blob/main/content/earth/businesses/catalog.json).
A stable canonical ID selects an appearance; aliases and verified brand:wikidata IDs map source
records onto it. Explicit source IDs take precedence. An explicit conflicting ID blocks name-based
guesses. Name aliases must match exactly after punctuation/spacing normalization and pass category
checks. McDonald's Book Exchange remains a bookshop. Localized aliases can be added without
duplicating models.

The catalog's initial identifiers were verified against the
[OpenStreetMap Name Suggestion Index](https://github.com/osmlab/name-suggestion-index).
Names without explicit IDs are inferred matches; generic names can collide across countries, so
prefer source IDs and conservative alias additions.

At the finest detail level, using unmerged footprints (Protomaps zoom 15+), matching source IDs plus containment associate businesses with their
footprints; otherwise containment is used, including courtyard holes. No unbounded nearest-building
guess is made. Shared buildings retain independent storefronts, with stable nonoverlapping facade
bays. A directly identified supermarket can absorb its internal cafe/pharmacy signage. These are
conservative tenancy heuristics, not surveyed lease boundaries.

A single business directly identified by its footprint can color the whole shell. Containment-only
matches and shared tenants color only their own fascia,
canopy and entry accents. Existing residential/civic/tall-building styles and floor counts survive
when a shop is a ground-floor tenant. Measured footprints/heights remain authoritative. Frontage is estimated
from the POI and nearby access lines; exact entrance location, sign location and tenant width are
generally absent from the archive.

## External model manifests

The reusable definitions are JSON content, not package code. The landmarks ship in the
`molen.worldgen.default` content pack (role `landmarks`) and the business catalog in the
`molen.earth` pack (role `businesses`). `npx molen pack fetch https://molen.dev/packs/index.json`
brings both into a project. Their sources are in the engine repository's `content/`:

| What to edit | Source |
| --- | --- |
| Model index and file paths | [Landmark catalog](https://github.com/bendyline/molen/blob/main/content/worldgen/landmarks/catalog.json) |
| Burger-restaurant descriptor, source-inspired palette and frontage | [burger_restaurant.landmark.json](https://github.com/bendyline/molen/blob/main/content/worldgen/landmarks/burger_restaurant.landmark.json) |
| Unbranded grocery treatment | [grocery.landmark.json](https://github.com/bendyline/molen/blob/main/content/worldgen/landmarks/grocery.landmark.json) |
| Store aliases, source IDs and category matching | [Business catalog](https://github.com/bendyline/molen/blob/main/content/earth/businesses/catalog.json) |
| Lamp, bench, rack and charger geometry recipes | [Landmark library](https://github.com/bendyline/molen/blob/main/content/worldgen/landmarks/README.md) |
| Base building proportions and architectural rules | [Generic store style](https://github.com/bendyline/molen/blob/main/content/worldgen/styles/generic/store.archstyle.json) |
| Shared surface patterns | [Material library](https://github.com/bendyline/molen/blob/main/content/worldgen/materials/README.md) |

A `molen/landmark@1` sign manifest contains its stable model ID, text, initial-based emblem, palette,
wall/accent appearance and default standalone/shared storefront widths. Its optional
`storefront.style` selects a preferred building envelope when the business directly identifies a
low-rise host and the active pack contains that style. Shared tenants cannot select host massing.
The seven additional styles distinguish big-box retail, warehouse clubs, restaurants, department
stores, enclosed malls, strip malls and outlet centers. Broad frontages raise and enlarge their
fascia to remain readable on taller shells; source heights and floor counts still win. The building
generator adapts that treatment to a measured footprint; this is not a fixed building mesh.
Mapped-business descriptors use `symbol: "letters"` with initials derived from their generic
titles. Source recognition stays in the Earth catalog; model-facing names and emblems stay generic.
Furniture uses `generator: "boxes"` with ordered
metric parts and optional detail tiers (0 near, 1 medium, 2 distant).

A host reads the documents from the packs and builds the libraries once, synchronously:
`createPlacesContent({ landmarks: { catalog, models }, businesses })` from
`@bendyline/molen-worldgen-earth/kernel` validates both and cross-checks every sign. Pass the
result as `places` to `semanticTileToBatch`, `createInThreadWorldgenGenerator` and
`createWorldgenSemanticRenderers`; a worker bridge takes the same content as plain documents, so
only data crosses the Worker boundary. Without `places`, mapped businesses are not recognized and
no street furniture is placed. Rendering cache keys include both content hashes, so palette and
recipe changes invalidate cached terrain render output.

Landmarks alone are `createLandmarkLibrary({ catalog, models })` from
`@bendyline/molen-worldgen/kernel`, or `resolveLandmarkCatalogDocuments(catalog, readDocument)` for
just the definitions; pass definitions to `generateLandmarkModel(id, definitions, tier)` or
`new ModelLibrary(assetLoader, definitions)`. A `ModelLibrary` without definitions serves no
landmark models. Editing is not runtime hot reload: change the documents, rebuild the pack with
`molen pack build`, and reload.

## Extending the library

In your own project, put new or overriding landmark and catalog documents in a content pack of
your own (`molen pack build <dir>`) and list it in project.json `packs` after the default packs:
when two packs provide the same id, the later one wins. The steps below are how the engine's own
catalogs are extended in the engine repository.

1. Copy the nearest `.landmark.json`, assign a stable ID, and edit its parameters.
   Add the ID and relative file path to the landmark catalog. Adding a design that uses an
   existing generator needs no manual TypeScript registration.
2. For a new business identity, add its canonical ID, allowed source categories, exact aliases,
   verified source IDs and landmark reference to the Earth business catalog. To change a
   generic treatment, edit its landmark or category mapping.
3. For a mapped-business descriptor, use `symbol: "letters"` and derive `letters` from the generic
   title. Reserve other geometric marks for non-business category signs and props. A new silhouette
   needs a bounded generator implementation and schema update.
4. Increment the edited document version to record the revision. Run `molen validate <file>`
   for structural validation, then `pnpm -r build` in the engine repository to validate catalog
   cross-references. Content hashes handle cache invalidation independently of manual version
   bumps.
5. For behavioral or visual changes, add positive and misleading-name cases, a standalone and
   shared-building example, and inspect near/distant captures. Follow the
   [3D art guidelines](3d-art-guidelines.md).

The engine uses generic `BuildingRequest.appearance` and `storefronts` fields; geographic names
and category matching stay in the Earth adapter. Custom scenes can supply those same fields through
`worldgenBuilding`. Each storefront supplies an identity, local anchor, accent, model reference,
optional native sign size, and desired width. Canonical signs are 4 × 1.35 m, front +Z, base Y=0.
Signs and outdoor objects use shared instanced geometry and a shared vertex-color material.

## Mapped outdoor objects

The adapter places mapped street lamps, benches, bicycle parking, charging stations and trees.
Human mode owns furniture; Land classes mode owns trees. A point in the half-open tile rectangle
[0,1) × [0,1) owns its placement; buffered copies do not create duplicates. Finest-level points
are ground-fitted, deduplicated and budgeted before procedural scatter.

When the source supplies them, tree height/crown diameter/leaf type, lamp height, numeric direction,
and bike-parking capacity influence the model. Missing dimensions use conservative defaults.
A charging POI denotes a station, so the renderer places a representative pedestal rather than
inventing a surveyed bank of connectors. The library includes a red/white fast-charger variant.

Mapped crowns reserve space from procedural scatter. Surface renderers can opt into
`details.preferMappedProps` to suppress inferred lamps near mapped ones; the explorer enables
this when its worldgen library is active. Synthetic and unmapped areas keep procedural fallbacks.
The ordinary Protomaps extract usually supplies position/category, not detailed species or dimensions.

## Repeatable visual review

Open [World Explorer with `?synthetic=1&stores=1&style=default`](https://molen.dev/play/world-explorer/?synthetic=1&stores=1&style=default)
to inspect all 44 mapped descriptor variants, four additional retail-center treatments, mixed tenants and outdoor
props. The original eight stores and interior walkthrough coordinates remain in place; the new
chains occupy the southern blocks and the retail centers flank them.
In the engine repository, the [store-library batch fixture](https://github.com/bendyline/molen/blob/main/packages/worldgen-earth/test/fixtures/store-library.batch.json)
supports deterministic close views:

```sh
molen worldgen preview --batch packages/worldgen-earth/test/fixtures/store-library.batch.json --out .artifacts/store-library.png --angles 4
```
The [U.S. retail batch](https://github.com/bendyline/molen/blob/main/packages/worldgen-earth/test/fixtures/us-retail-library.batch.json)
includes all 40 additions plus Target, including a courtyard mall and independent mixed tenants:

```sh
molen worldgen preview --batch packages/worldgen-earth/test/fixtures/us-retail-library.batch.json --out .artifacts/us-retail.png --angles 8
```

Raw model buffers are available through `generateLandmarkModel` and `generateSignModel`;
`encodeGlb` exports the same geometry for the static asset workflow.

The data and shapes are intentionally stylized. Mapping accuracy, coverage and source freshness
bound recognition. A sign treatment must not be interpreted as recovered photographic appearance.
