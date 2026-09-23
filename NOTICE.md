# NOTICE — third-party data, assets and trademarks in Molen

Molen's source code is licensed under the MIT License; see [LICENSE](LICENSE). That grant does NOT
extend to everything in this repository. Some tracked files are third-party open data redistributed
under their own terms, and some depict third-party trademarks that no license in this repository
can grant. This NOTICE is the authoritative inventory of those exceptions. It records paths,
sources, licenses and the attribution each source requires. Nothing here modifies LICENSE, and
nothing in LICENSE overrides the terms below.

If you fork, vendor, repackage or ship a product built on this repository, read this file first.
Two things need your attention in particular:

- The Sammamish vector tiles are an ODbL 1.0 Derivative Database. ODbL is share-alike: it cannot
  be relicensed to MIT, and a derivative of it must itself be offered under ODbL 1.0. See §1.
- The Earth business catalog contains real source names for map matching; rendered signs use
  generic descriptor models. See §4.

**Section index**

| § | Section |
| --- | --- |
| §1 | Geospatial data — Sammamish terrain package |
| §2 | Geospatial data — OpenStreetMap-derived test fixtures |
| §3 | Brand identity data — OSM Name Suggestion Index |
| §4 | Trademarks |
| §5 | Generated art assets |
| §6 | Everything else |
| §7 | How the claims in this file were verified |

---

## §1 Geospatial data — Sammamish terrain package

- **Path:** `examples/world-explorer/public/terrain/sammamish/`
- **Package-local notice:** [`examples/world-explorer/public/terrain/sammamish/LICENSES.md`](examples/world-explorer/public/terrain/sammamish/LICENSES.md)
- **Machine-readable provenance:** `.../SOURCES.json` and `.../terrain-package.json` (`"attribution"`)

About 21.7 MiB of compiled tiles for a region around Sammamish, Washington, used by the
world-explorer example. NOT covered by MIT.

### 1a. `elevation.pmtiles` — 14,719,561 bytes

| | |
| --- | --- |
| **Source** | Mapzen / Tilezen Terrain Tiles (AWS Open Data registry), Terrarium-encoded, then converted to Molen PNG16 tiles with one shared border sample on the east and south edges. Coverage bounds -123.15,46.95,-120.9,48.3; zoom 8-14. |
| **Underlying data** | United States 3DEP, GMTED2010 and SRTM (U.S. Geological Survey). |
| **License** | U.S. Government works, public domain, with a required courtesy line. The coverage is entirely within the United States, so only the USGS sources apply; other Terrain Tiles providers with their own attribution terms are not present in this extract. |
| **Required attribution** | "Mapzen Terrain Tiles. United States 3DEP, GMTED2010, and SRTM terrain data courtesy of the U.S. Geological Survey." |
| **Reference** | https://github.com/tilezen/joerd/blob/master/docs/attribution.md |

### 1b. `world.pmtiles` — 8,068,547 bytes

| | |
| --- | --- |
| **Source** | Protomaps Basemap build 20260906 (basemap version 4.15.2, planetiler 0.10.2, OSM replication time 2026-09-06T04:00:00Z), extracted to the bbox -122.12,47.55,-121.95,47.7. 476 tiles, zoom 0-15. |
| **Layers actually present** (read from the archive, not assumed) | boundaries (z0-15), buildings (z11-15), earth (z0-15), landcover (z0-7), landuse (z2-15), places (z1-15), pois (z5-15), roads (z3-15), water (z0-15). The `pmtiles extract` tool has no `--minzoom`, so the extract keeps every zoom from 0 up. The application reads only landcover/water/transportation/building/poi; the rest ship regardless, which is why they are credited here. |

Three separate licenses apply to this one file:

**(i) OpenStreetMap — Open Database License (ODbL) 1.0**

Applies to roads, buildings, water, landuse, earth, boundaries, places and pois.
Required attribution: "© OpenStreetMap contributors".
ODbL is a share-alike license. This archive is a Derivative Database: it cannot be relicensed
under MIT, and anyone who publicly uses a database derived from it must offer that derivative
under ODbL 1.0.
<https://www.openstreetmap.org/copyright> · <https://opendatacommons.org/licenses/odbl/1-0/>

**(ii) Daylight Landcover, derived from ESA WorldCover — CC BY 4.0**

Applies to the `landcover` layer, present at zoom 0-7 with the classes barren, glacier, farmland,
scrub, grassland, forest and urban_area (verified by decoding the archive's own tiles).
Required attribution: "© ESA WorldCover project; contains modified Copernicus Sentinel data
processed by the ESA WorldCover consortium", available under CC BY 4.0.
The ESA WorldCover vintage (2020 or 2021) is not recorded in the archive metadata and is therefore
not asserted here.
<https://esa-worldcover.org/en> · <https://creativecommons.org/licenses/by/4.0/>

**(iii) Natural Earth — public domain**

The Protomaps Basemap includes Natural Earth alongside OpenStreetMap; the archive's own metadata
describes its contents as "Basemap layers derived from OpenStreetMap and Natural Earth", and its
`boundaries` layer carries Natural Earth's `brk_a3` attribute. Natural Earth's terms of use place
all versions in the public domain and state that crediting the authors is unnecessary. Credited
here for completeness.
<https://www.naturalearthdata.com/about/terms-of-use/>

Reference for (i)-(iii): the tile producer's own data-license notice,
<https://github.com/protomaps/basemaps/blob/main/LICENSE_DATA.md>

Not present: the Protomaps default Light/Dark styles and their MIT-licensed tangrams/icons POI
icon set are not redistributed here, so that notice does not apply.

---

## §2 Geospatial data — OpenStreetMap-derived test fixtures

Cropped extracts of the §1b archive, committed so tests run without network access. Each carries
OpenStreetMap geometry and attributes and is therefore ODbL 1.0, share-alike, NOT covered by MIT.
Required attribution: "© OpenStreetMap contributors; Protomaps Basemap".

```
packages/terrain/test/fixtures/sammamish-parking.json                       34,810 bytes
packages/worldgen-earth/test/fixtures/sammamish-14-2634-5717.batch.json    242,157 bytes
packages/worldgen-earth/test/fixtures/sammamish-businesses.semantic.json    69,114 bytes
packages/worldgen-earth/test/fixtures/sammamish-shopping-center.batch.json   3,029 bytes
```

Each has a README beside it recording the source tile, what was kept and what was dropped:

```
packages/terrain/test/fixtures/README.md
packages/worldgen-earth/test/fixtures/sammamish-14-2634-5717.README.md
packages/worldgen-earth/test/fixtures/sammamish-shopping-center.README.md
packages/worldgen-earth/test/fixtures/store-library.README.md  (covers the semantic fixture)
```

Not OSM-derived, but listed so the distinction is on the record: `store-library.batch.json` and
`us-retail-library.batch.json` in the same directory are authored art-review blocks with no mapped
geometry. They do carry source-business identifiers for mapping tests — see §4.

---

## §3 Brand identity data — OSM Name Suggestion Index

- **Path:** `packages/worldgen-earth/packs/default/businesses/catalog.json`
- **Local notice:** [`packages/worldgen-earth/packs/default/businesses/README.md`](packages/worldgen-earth/packs/default/businesses/README.md)

The canonical names, the alias strings used to match mapped features, and the Wikidata QIDs in
`brandIds` were transcribed from the OpenStreetMap Name Suggestion Index at revision
`44f3d1a395b63f1438ccc37687a9470720e4f42b`. The per-brand source files are linked in that README.

| | |
| --- | --- |
| **License** | 3-Clause BSD. `LICENSE.md` at that revision reads "Copyright 2026, name-suggestion-index contributors". The project states no separate terms for the index data, and its README says the project "is available under the 3-Clause BSD License". |
| **Notice** | The full BSD-3-Clause text, including the copyright line and disclaimer, is reproduced in the businesses README to satisfy the source-redistribution condition. |
| **Underlying facts** | Collected from OpenStreetMap and linked to Wikidata. |
| **Source** | https://github.com/osmlab/name-suggestion-index |

The generic sign geometry and source-inspired color palettes that these identities resolve to are
Molen's own authored work under MIT. Only the identity data comes from the NSI.

---

## §4 Trademarks

- **Paths:** `packages/worldgen-earth/packs/default/businesses/catalog.json`,
  `packages/worldgen-earth/test/fixtures/us-retail-library.batch.json`,
  `packages/worldgen-earth/test/fixtures/store-library.batch.json`
- **Local notice:** [`packages/worldgen-earth/packs/default/businesses/README.md`](packages/worldgen-earth/packs/default/businesses/README.md)

The Earth business catalog contains real company names, aliases and stable source IDs solely to
recognize mapped records. Those records route to generic descriptor models such as `mart_store`,
`taco_place`, `electronics_store` and `hardware_store`. The default landmark pack's corresponding
filenames, model IDs, titles and wordmarks are generic, and every mapped-business emblem is formed
from the generic descriptor's initials. Source-inspired palettes remain as visual variants. Tests
repeat some source names and identifiers to verify that mapping behavior.

> All product names, company names, logos, color schemes and other trade dress referred to in this
> repository are the property of their respective owners. Molen and Bendyline LLC are not
> affiliated with, endorsed by, sponsored by or approved by any of them, and no such relationship
> is implied. Source names are used only to recognize real places that mapped data identifies as
> those businesses. The MIT License in LICENSE grants rights in this repository's software and data
> only; it grants no right, license or permission in any trademark, service mark, trade name or
> trade dress of any third party.
>
> The generated sign geometry uses generic text and initial emblems, not source logo artwork.
>
> A downstream redistributor's use of these marks is that redistributor's own. Trademark analysis
> depends on use, context and likelihood of confusion, so a use that is descriptive in this
> repository may not be descriptive in your product. Take your own advice. The mapping catalog and
> landmark pack are data and can be replaced independently without changing engine code.

This also covers the real aircraft types depicted as original geometry in
`packages/entities/source/aircraft/` (P-51 Mustang; OH-6) — original polygonal
interpretations built from published reference dimensions, using no third-party mesh or bitmap
(see that directory's README), and identified here by real-world aircraft designations.

---

## §5 Generated art assets

```
assets/structures/red-barn/textures/weathered-red-wood-basecolor.png
    1254 × 1254, 2,549,478 bytes
    sha256 be339efd256e3b949b56f2bbe30dff6799fe487a709e6bcee12e146c64f52364
examples/lantern-dungeon/asset-src/shared/textures/limestone-source.png
    1254 × 1254, 3,137,449 bytes
    sha256 63a4b092e5d459d97452e7243246493546bd4012cac698eb26e35459ef54296d
```

Both are unmodified output of OpenAI's ChatGPT image generation, requested by Bendyline for this
repository (the exact model version was not logged at generation time). Their prompts are recorded
verbatim beside each file, as are their hashes and, for the limestone map, the generation date of
2026-09-05.

OpenAI's terms of use assign ownership of output to the user who generated it, so no third-party
license or attribution obligation attaches to these two files. They are covered by LICENSE with the
rest of the repository, and so are the PBR maps derived from them and the GLBs that embed those
maps (`assets/structures/red-barn/**`, `examples/lantern-dungeon/asset-src/*/*/models/**` and
`examples/lantern-dungeon/public/assets/**`).

They are listed here only so a downstream redistributor can see what they are; nothing needs to be
carried forward. Per-file provenance:
[`assets/structures/red-barn/README.md`](assets/structures/red-barn/README.md) and
[`examples/lantern-dungeon/asset-src/README.md`](examples/lantern-dungeon/asset-src/README.md).

---

## §6 Everything else

Every other model, texture, palette, style pack and fixture in this repository is Molen's own
authored or procedurally generated work, covered by LICENSE. Notably:

- `packages/entities/assets/**` (trees, boulder, aircraft) and
  `examples/lantern-dungeon/asset-src/*/*/models/**` are generated by committed scripts from committed
  parameters; no third-party model pack is vendored. (The lantern-dungeon models embed the §5
  texture, which carries no third-party obligation of its own.)
- Golden and reference images under `**/test/golden/**` and `artifacts/**` are Molen's own renders.
- No third-party webfont, icon set or audio file is redistributed.

npm dependencies are not vendored: their licenses travel with the packages themselves and are not
restated here.

---

## §7 How the claims in this file were verified

Every license statement above was checked against a primary source rather than from memory:

- Layer inventory, zoom ranges, tile count and embedded metadata of both `.pmtiles` archives were
  read directly from the archives with the `pmtiles` package already in this repo, and the
  landcover feature classes were confirmed by decoding the archives' own vector tiles. The
  `world.pmtiles` metadata carries attribution "© OpenStreetMap", description "Basemap layers
  derived from OpenStreetMap and Natural Earth", and planetiler build tags.
- Per-source terms for the vector tiles: the producer's own notice, protomaps/basemaps
  `LICENSE_DATA.md`.
- Elevation attribution wording: tilezen/joerd `docs/attribution.md`.
- ESA WorldCover credit wording: the Overture Maps attribution guidelines that `LICENSE_DATA.md`
  points to.
- Interactive-map attribution placement: the OSM Foundation Licence/Attribution Guidelines, which
  require the credit to be visible without user interaction (any corner of the map is acceptable).
- NSI license: `LICENSE.md` and `README.md` of osmlab/name-suggestion-index at the pinned revision.
- Fixture provenance: the first outline in `sammamish-14-2634-5717.batch.json` carries identity
  `f:35184401286210`, which is feature id 35184401286210 of tile 14/2634/5717 in the committed
  `world.pmtiles`.
- File sizes and SHA-256 digests: computed from the tracked files. The terrain package manifest's
  checksums are verified by `molen validate <manifest> --verify-files`.

Where a fact could not be established it is marked UNRESOLVED (see §5) rather than guessed.
