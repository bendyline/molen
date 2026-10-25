# hever_castle — Hever Castle

Reviewed 2026-10-12 against the current deterministic source master, imported master, four authored browser levels and **49 inspected render frames**. Accepted as a picture-led medium-fi reconstruction of the main moated castle.

![Hever gatehouse, entrance bridge and outer ranges](medium-fi/gatehouse-and-entrance.png)

## Appearance and shared surfaces

Three exterior/courtyard pictures, linked in `reference-metadata.json`, guide the tall rectangular gatehouse and square angle turrets, lower front corner towers, dark pitched stone ranges, paired chimney tips and three cream/dark Tudor courtyard gables. The source keeps the mapped courtyard hole and a genuine cut entrance passage. The courtyard camera was moved inside the court before acceptance. No reference photograph is copied or embedded.

Five existing canonical 256² graphs supply stone, slate, brick, wood and lime plaster. Metric UVs and linear vertex tints preserve the common Molen palette. Glazing is a tinted untextured PBR slot. Each shared graph is read once; unloading releases all model geometry.

## Placement

Standard viewer Protomaps `20261008.pmtiles` provides the named castle point, same-ID building envelope, courtyard hole and narrow south entrance centerline. The separate northwest hotel/Tudor village is excluded. The mapped south facade spans 30.327 m. Architectural heights, roof sections and window rhythm are photo-proportion estimates.

Anchor: longitude **0.11387050151824951**, latitude **51.18690251546805**. Placement heading **0** retains native +X east and +Z south: the source already incorporates the facade bearing of approximately 155.966° from north. The north-up shared-material overlay follows the matched main castle envelope.

Native Y=0 is the retained terrain sample at 35.782858 m. Footings follow the coarse terrain minus 0.32 m; the court floor is Y=0.27 m. Terrain at the bridge endpoints is approximately Y=0.177/0.340 m, and the deck is Y=0.34 m. Exact bank, path and water joins are not surveyed. The mapped footpath is not explicitly suppressed and may remain beneath the modeled deck.

Blue moat bands belong only to the review scene. Coarse terrain hides portions of them, especially at the south approach; they do not certify actual water geometry or bank excavation. The runtime castle asset relies on host mapped water.

## Browser levels

| Level | Triangles | Bytes | Draw calls |
| --- | ---: | ---: | ---: |
| Skyline | 959 | 96,904 | 1 |
| District | 2,849 | 273,164 | 6 |
| Street | 7,770 | 722,288 | 6 |
| Closeup | 8,898 | 823,808 | 6 |

The separate source master has 8,898 triangles and 1,071,452 bytes. Initial skyline plus district costs **370,068 bytes**, or 86,751 gzip bytes, below the phone/laptop targets. Skyline retains the gatehouse, corner turrets, roof ranges, open courtyard, Tudor gables and entrance bridge. District adds windows/chimneys; street and closeup retain broad framing and closer crenellations. Separate vertex streams avoid duplicated interleaved uploads.

## Inspected evidence

- 11 portable frames: terrain overview, four isolated turntables and six detail cameras.
- 11 shared-material frames: four angles, six details and the north-up geographic outline overlay. Flat ground supplies horizontal/material evidence only.
- 27 medium-fi frames: retained PMTiles ground with synthetic Cotswold cottages, Economy/High, noon/late, three distances, untextured silhouette, six details, four matching-view tiers and transitions.

The shared/medium courtyard close-ups clip the gable peaks; the corrected portable courtyard view shows all three complete. The synthetic cottages provide style context and are not reconstructions of nearby real buildings.

Selected source regeneration, import/placement checks, asset hash verification, source inventory, scene validation and 30-tick simulation passed. All six GLBs validate with zero errors, zero warnings and no embedded images. `qa.json` binds the current geometry, inputs, placement, texture graphs, LODs and inspected images.

## Limits

This is approximate exterior architecture, not a surveyed building or furnished interior. Exact moat banks, water levels, bridge joints and underwater footings remain approximate. Seasonal ivy, gardens and the separate hotel/Tudor village are excluded. Imported convex bounds are not traversable castle collision. Physical laptop and phone performance measurements remain pending.
