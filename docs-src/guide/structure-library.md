# Default structure library

Molen ships **120 procedural structures**: the original 16 styles and 104 additional interpretations
of real-world buildings. They share 45 material graphs and the existing footprint-driven worldgen
pipeline. Each entry has a stable style ID, taxonomy, country references, use, characteristic
details, and a representative footprint and floor count. These are original stylized studies,
not surveyed replicas or static meshes stretched to fit a parcel.

The generated runtime index is
[`structures/catalog.json`](https://github.com/bendyline/molen/blob/main/content/worldgen/structures/catalog.json), shipped in the
`molen.worldgen.default` content pack (role `structures`). All 120 styles are
registered in the default style pack. The editable source for each logical building lives in its
own copyable directory under
[`source/structures/`](https://github.com/bendyline/molen/tree/main/content/worldgen/source/structures); its `source.json` inventories
the local recipe or archstyle and definition metadata. Supporting architectural references are
maintained in the collection-wide
[`catalog.json`](https://github.com/bendyline/molen/blob/main/content/worldgen/source/shared/structure-library/catalog.json)
in the engine repository. Get the pack itself with
`npx molen pack fetch https://molen.dev/packs/index.json`.

## See and reshape every structure

Open the [structure library](https://molen.dev/play/world-explorer/structures.html) in the
browser, or use the **Explore 120 structures** link in
[World Explorer](https://molen.dev/play/world-explorer/).
The collection renders the actual shipped generators and shared material graphs. Search by name,
country, construction material or description; filter by taxonomy; select any card to change
width, depth and storeys, orbit, compare front and rear, or inspect the silhouette without textures.
The detail menu uses the production geometry tiers. The sheet shows complete exteriors; optional
enterable interiors are generated separately by the world renderer.

**Download model sheet** exports all 120 rendered entries as a labeled PNG. For reproducible
captures in the engine repository, build once and run:

```sh
pnpm -r build
node examples/world-explorer/scripts/capture-structure-sheet.mjs
```

This creates `artifacts/building-diversity/model-sheet.png`, 13 taxonomy sheets, front/rear/detail
and resized inspection frames for six representative structures, and `render-report.json`
with material failures, mesh counts and hashes. The report must contain 120 entries, 120 unique
IDs, and no failed materials or browser errors. The full sheet is normalized to fit each card;
dimensions beneath each study supply its real scale.

## Taxonomies

| Family | Examples |
| --- | --- |
| North American homes | Cape Cod, Craftsman, brownstone, ranch, timber barn |
| Latin American and Caribbean streets | Patio house, hacienda wing, sobrado, Chiloé shingles |
| Northern European vernacular | Nordic timber, croft, thatched farmhouse, boathouse |
| Western European town and country | Canal house, mansard apartments, half-timbered house |
| Mediterranean buildings | Palazzo, azulejo townhouse, Cycladic house, farmhouse |
| Eastern European and alpine buildings | Konak, timber cottage, gallery house, alpine inn |
| North African and West Asian buildings | Riad, courtyard house, earthen tower, stone house |
| African domestic and community buildings | Swahili house, Sahel townhouse, courtyard compound |
| South Asian buildings | Haveli, nalukettu, Newari townhouse, bungalow |
| East Asian buildings | Machiya, gassho farmhouse, hanok, siheyuan, square tulou |
| Southeast Asian buildings | Shophouse, tube house, timber house, limasan |
| Australian, New Zealand and Pacific buildings | Queenslander, villa, bach, community hall |
| Civic, commercial and working structures | Library, fire station, market, factory, clinic, retail |

## Place and resize a building

Supply a catalog entry's `style` to any normal `BuildingRequest`, `worldgenBuilding` component,
worldgen batch, preview or bake operation. Regenerate with a new footprint to change width/depth;
the wall bays, windows, roofs and ornament are rebuilt in meters. Changing `levels` changes the
storeys; supplied `height` remains the total envelope. Transformed and nonrectangular footprints
use the same analysis and safe roof fallback as existing styles.

```ts
const request = {
  identity: 'neighborhood:home-42',
  style: 'molen.worldgen.catalog.craftsman',
  labels: ['bungalow'],
  outline: [[0, 0], [16, 0], [16, 11], [0, 11]],
  levels: 2,
};
// generateWorldgenBatch({ buildings: [request], pack })
```

The default Earth atlas now has 45 geographic regions. Weighted variants sample a named stream
of stable building identity, so reordering features or regenerating a tile preserves its style.
Rules retain a fallback `style`; optional `variants: [{ style, weight }]` supplies the weighted
pool. Explicit building styles win. Measured heights and floor counts are retained, and known
tall buildings bypass low-rise residential variant pools. Geographic envelopes are broad visual
priors and do not identify the architecture of an individual mapped building.

## Architecture and material authoring

`facade.details` adds shutters, balconies, timber framing or pilasters, awnings and verandas.
Details use the actual facade rhythm, a bounded perimeter allocation, and the existing
`facade-bands` tier flag. Structural openings, clipped edges and courtyard constraints take
precedence. Dormers use `roof.features.dormers` on eligible pitched wings. Simplified budget
representations omit ornament while retaining their footprint, primary roof and measured envelope.

The [standard material catalog](https://github.com/bendyline/molen/blob/main/content/worldgen/materials/README.md)
groups all 45 shared graphs by construction. It includes several brick bonds, cut/rubble stone,
clapboard and board-and-batten, shingles, clay tiles, slate, thatch, rammed earth and metal roofs.
Physical repeat sizes live in `scripts/standard-materials.mjs`. Common textures are 256² and
prepared once per shared material set. Window graphs use cell UVs; solid surfaces use meter UVs.

To vary a structure in your own project, copy its `archstyle.json` (or write a new one), preview
it with `npx molen worldgen preview my.archstyle.json --out preview.png`, and ship your styles as
your own style pack with `molen pack build`. [Worldgen](worldgen.md) covers the format.

The library itself is maintained in the engine repository. Edit the applicable
`content/worldgen/source/structures/<style>/` bundle there. Generated styles use `recipe.json`;
the original styles carry their complete `archstyle.json`. After editing, from the repository
root:

```sh
node packages/worldgen/scripts/generate-structures.mjs
node packages/worldgen-earth/scripts/generate-structure-atlas.mjs
pnpm -r build
pnpm docs:gen
node examples/world-explorer/scripts/capture-structure-sheet.mjs
```

The worldgen build rejects stale generated catalog resources. Keep the model-sheet review in
the loop: inspect roof silhouettes, window proportions, trim contrast, shadows and resized
placements before accepting a recipe change. Kernel tests generate every entry repeatedly at
independent footprint scales and a supplied height, and verify valid deterministic geometry.
