# N0313 — Rock of Cashel

Reviewed 2026-10-12 against the current deterministic source master, imported master, four browser levels and **49 inspected render frames**. Accepted as an individual picture-led medium-fi exterior reconstruction.

![Cathedral ruins, chapel and lower ranges](medium-fi/south-chapel-and-vicars-ranges.png)

## Appearance and shared surfaces

Three official north-side pictures and one south-side aerial guide the roofless cruciform cathedral, hollow crossing and west tower-house, transept gables with pointed lancets and round upper openings, narrow round tower with a stone cone, roofed warm-stone Cormac chapel with unequal belfries, and two lower roofed ranges. References remain linked in `reference-metadata.json`; no photograph is redistributed or embedded.

Four existing canonical 256² graphs supply weathered limestone, sandstone, slate and plain wood. Metric UVs and linear vertex tints use the common library. Each graph is read once; unloading releases all model geometry.

A buttress initially blocked one north-transept lancet. Buttresses were moved between openings, the corrected geometry was recaptured, and five short rays through selected lancets and the north oculus now hit no geometry. Other walls can be visible through openings. The overview camera was moved south to expose the chapel and lower ranges.

## Placement

Standard viewer Protomaps `20261008.pmtiles` supplies the cathedral and Cormac chapel polygons with their named points, separate round tower and two lower ranges. The already retained OSM relation `2836753` supplies the identity-matched site enclosure. Its old undirected frame is converted to native east/south coordinates; it is used for a low boundary wall rather than a filled hill platform.

Anchor: longitude **-7.89064**, latitude **52.52016**. Placement heading **0** retains native +X east and +Z south. Component rotations are already inside the source mesh. The mapped cathedral spans approximately 61.4 m east/west and 42 m north/south, while the mapped round tower is about 4.5 m across. Architectural heights and damaged profiles are picture-proportion estimates.

Native Y=0 samples retained viewer terrain at **119.1608 m**. Bases follow the coarse terrain minus 0.30 m, and the ruin floor follows terrain plus 0.12 m. Source and medium-fi views show approximate seating and component arrangement. The rocky hill is smoothed by the standard terrain; exact terrace, floor and path elevations remain unverified.

The shared-material fixture uses flat ground, which hides boundary sections below Y=0. Its north-up overlay proves approximate horizontal registration and material binding; it does not prove terrain contact. Synthetic cottages in the medium-fi scene are style context rather than actual nearby buildings.

## Browser levels

| Level | Triangles | Bytes | Draw calls |
| --- | ---: | ---: | ---: |
| Skyline | 998 | 93,748 | 1 |
| District | 3,750 | 352,220 | 3 |
| Street | 8,684 | 814,348 | 4 |
| Closeup | 17,460 | 1,633,324 | 4 |

The detailed source master has 17,460 triangles and 2,098,144 bytes. Initial skyline plus district costs **445,968 bytes**, or 124,064 gzip bytes. Skyline preserves the hollow ruin masses, conical round tower, chapel roofs/belfries and separate lower ranges. It merges tiny lancet triplets and boundary corners; district restores selected openings, street adds flat broad surrounds, and closeup uses projecting frames. Separate vertex streams avoid duplicate GPU uploads.

## Inspected evidence

- 11 portable frames: terrain overview, four isolated turntables and six detail cameras.
- 11 shared-material frames: four angles, six details and bounded north-up enclosure overlay.
- 27 medium-fi frames: Economy/High, noon/late, three distances, untextured silhouette, six details, four matching-view levels and four transitions.

Source regeneration, import/placement checks, asset hash verification, source inventory, scene validation and a 30-tick simulation passed. All six GLBs validate with zero errors, zero warnings and no embedded images. Five selected aperture probes pass. `qa.json` binds the current geometry, inputs, placement, shared graphs, levels and inspected images.

## Limits

This is approximate exterior architecture rather than a measured conservation reconstruction. Wall damage, portal detail, openings and roof sections remain picture-led estimates. The cross is schematic. Individual graves, carvings, frescoes, scaffolding, service huts and furnishings are excluded. Coarse hill terrain and exact terrace/path/floor joins remain unverified. Imported convex bounds are not traversable ruin collision. Physical laptop and phone performance measurements remain pending.
