# Bellevue Square car parks

The footprints and parking POIs of one real tile: the Seattle region's PMTiles fixture at
zoom 15, x 5260, y 11442, decoded by `createProtomapsTerrainMvtDecoder`, with coordinates rounded to
six decimals. It keeps the Southeast (2 levels), West (4) and Northeast (6) Parking Garages, whose
POIs carry the footprint's own source id, and Bellevue Square itself, which has an unnamed parking
POI inside it and must stay a mall. OSM tags those three garages `amenity=parking`,
`parking=multi-storey` and `building:levels`; Protomaps keeps the identity and the derived height
(`3 × levels + 2`), not the tags.

The West garage is the stress case: 358 × 144 m, 37 vertices and concave. `size` is the tile's
edge in world meters at this latitude.

© OpenStreetMap contributors; Protomaps Basemap. ODbL-1.0. Source attribution and provenance:
`examples/world-explorer/public/terrain/seattle-bellevue-sammamish/LICENSES.md` and `SOURCES.json`.
