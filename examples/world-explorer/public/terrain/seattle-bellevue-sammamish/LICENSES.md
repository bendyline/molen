# Data attribution

This package redistributes third-party open data. It is **not** covered by the repository's MIT
license: each dataset below keeps its own terms, and the OpenStreetMap-derived tiles are share-alike.
The repository root [NOTICE](../../../../../NOTICE.md) carries the full inventory.

- **Elevation** (`elevation.pmtiles`): Mapzen Terrain Tiles. United States 3DEP, GMTED2010, and
  SRTM terrain data courtesy of the U.S. Geological Survey.
- **Roads, buildings, water, land use, earth and boundaries** (`world.pmtiles`):
  © OpenStreetMap contributors, distributed in the Protomaps Basemap under ODbL 1.0. ODbL is a
  share-alike license; a Derivative Database of these tiles must itself be offered under ODbL 1.0.
- **Landcover, zoom 0-7** (`world.pmtiles`, layer `landcover`): Daylight Landcover, derived from
  the ESA WorldCover dataset. © ESA WorldCover project; contains modified Copernicus Sentinel data
  processed by the ESA WorldCover consortium. Available under CC BY 4.0
  (<https://creativecommons.org/licenses/by/4.0/>). This layer is present at zoom 0-7 because the
  bbox extract keeps every zoom; the app does not render it.
- **Natural Earth**: public domain, no permission or credit required. The archive's own metadata
  describes its contents as "Basemap layers derived from OpenStreetMap and Natural Earth", and the
  `boundaries` layer carries Natural Earth's `brk_a3` attribute.

The producers document the per-source terms and the exact credit strings: Protomaps
[LICENSE_DATA.md](https://github.com/protomaps/basemaps/blob/main/LICENSE_DATA.md) for the vector
layers, Tilezen joerd
[docs/attribution.md](https://github.com/tilezen/joerd/blob/master/docs/attribution.md) for the
elevation tiles. `SOURCES.json` records which layers this archive actually contains.

The elevation tiles were converted from Terrarium RGB into molen PNG16 tiles and given one shared
border sample on the east and south edges. They are not suitable for navigation.
