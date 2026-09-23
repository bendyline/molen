# Surface regression data

`sammamish-landcover.json` contains the land-cover extract at zoom 15, x 5275, y 11439
from `examples/world-explorer/public/terrain/sammamish/world.pmtiles` (2026-09-06 fixture).
It covers the overlapping forest, park, meadow and residential polygons
northeast of the camera at 47.635587, -122.0428172 where sparkling triangles were reported.
The regression checks that only the last covering feature is meshed at each sampled point,
including inside holes, instead of relying on tiny height offsets to hide lower surfaces.

`sammamish-parking.json` is a cropped semantic extract of zoom 15, x 5276, y 11442 from
`examples/world-explorer/public/terrain/sammamish/world.pmtiles` (2026-09-06 fixture).
It preserves the shopping-center service aisles, nearby roads, buildings, and planted islands.
Coordinates are normalized to the original tile. The real-data test checks pavement between
repeated aisles without depending on network access.

`sammamish-service-courts.json` contains cropped semantic extracts from the same archive at
zoom 15: 5275/11442, 5276/11442 and 5276/11443. They cover the service-road courts west of
228th Avenue NE, the shops south of NE 4th Street, and the office loop farther south reported
in the terrain Human view. Source coordinates, clipped tile-edge geometry, building footprints
and land-use exclusions are retained. These fixtures exercise angled aisles, missing site
boundaries, tile seams and enclosed access-road loops without fetching external data.

© OpenStreetMap contributors; Protomaps Basemap. ODbL-1.0. See the source package's
`LICENSES.md` and `SOURCES.json` for attribution and provenance.
