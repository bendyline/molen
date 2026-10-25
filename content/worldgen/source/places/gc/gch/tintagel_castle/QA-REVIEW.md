# tintagel_castle — Tintagel Castle

Reviewed 2026-10-12 against the current source, imported master, four authored browser levels and 61 inspected render frames. Accepted as an approximate medium-fi model of the surviving exterior ruins and modern footbridge.

![Bridge and ruined compounds in retained PMTiles terrain](medium-fi/cantilever-bridge.png)

## Appearance and source

Three external reference pictures guide the roofless island court and hall, separate mainland gatehouse and upper rooms, chapel/garden, selected northern foundation rings, and tapered silver/red crossing. Pictures are linked in `reference-metadata.json`; none is copied into the model or used as a texture. The deterministic recipe is `packages/worldgen/scripts/tintagel-castle-model.mjs`.

The first draft's thick raised hall floor and oversized bridge supports were corrected before the accepted captures. The hall now has a thin floor, open breaks and a real cut arch. Broad faceted wall crests and selected stone stairs supply geometry; the shared stone graph supplies small joints.

Four canonical 256² graphs are used: `stone_drywall`, `gravel`, `metal_painted`, and `metal_stainless`. Metric UVs and linear vertex colors preserve the pale stone and muted red/silver bridge palette. Graph reads occur once per graph and model unload leaves zero live model geometries.

## Placement

Standard viewer PMTiles (`20261008.pmtiles`) supplies the mapped 68.343 m footbridge centerline and named site controls. Anchor: longitude −4.759233891963959, latitude 50.66781754516231. Heading 0 preserves +X east, +Z south and +Y up. The map frame's narrow quad represents the crossing, **not a surveyed castle footprint**. Information points identify rooms but do not measure their corners; room plans and wall heights are picture-led estimates.

Portable and medium-fi views use the retained coarse PMTiles height grid. Native Y=0 represents 26.609459217022664 m at the bridge midpoint; wall footings descend 0.4 m into that coarse ground and the bridge deck clears the higher endpoint by 1 m. Exact terraces and cliff contact remain approximate.

The current placement replaces the mapped bridge road, with a 0.1 m margin at each end for map-projection rounding. An actual `withoutStructureRoads` check confirms full named-bridge suppression and preservation of the unrelated path (`road-fit-report.json`). Approach-height hints are unset because the native frame is skewed relative to the bridge; grade-path joins are not certified.

## Browser levels

| Level | Triangles | Bytes | Draw calls |
| --- | ---: | ---: | ---: |
| Skyline | 832 | 90,200 | 1 |
| District | 2,172 | 216,404 | 4 |
| Street | 6,432 | 610,584 | 4 |
| Closeup | 10,356 | 980,100 | 4 |

The separate source master has 19,176 triangles and 2,304,072 bytes. Initial skyline plus district costs 306,604 bytes (79,848 gzip bytes), below the phone/laptop download targets. Geometry uses separate vertex streams and CPU/GPU byte estimates agree.

## Inspected evidence and checks

- 11 portable frames: lit terrain overview, four isolated turntables and six detail cameras. The isolated turntables show layout; the details supply architectural review.
- 11 shared-material frames: four angles, six details and north-up bridge placement overlay. Their flat ground cannot certify hillside contact.
- 27 medium-fi frames: PMTiles ground, Economy/High, noon/late, three distances, untextured skyline, six details, all four tiers and transitions.
- 12 supplemental flat-context frames: visible synthetic procedural apartments for palette/lighting comparison. The hillside-shaped ruins float without terrain here; this is not geographic evidence.

Selected source regeneration (`generate-additional-landmarks.mjs --ids=margat,tintagel_castle --check`), asset hash verification, scene validation and 30-tick simulation passed. All six GLBs validate with zero errors/warnings and no embedded images. Current hashes, graph bindings, placement, images, LOD budgets and source inventory are checked in `qa.json`.

## Limits

This depicts selected surviving exterior remains, not the complete medieval castle or a precise archaeological survey. Natural caves and cliff geology, buried/lost structures, Gallos sculpture, modern visitor facilities and vegetation are excluded. The retained terrain smooths cliffs and terraces. The imported convex bounds are not walkable ruin collision. Precise path/deck joins and physical laptop/phone performance measurements remain pending.
