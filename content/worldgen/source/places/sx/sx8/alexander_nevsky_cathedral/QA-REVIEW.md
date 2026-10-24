# Alexander Nevsky Cathedral — current model review

Reviewed 2026-10-13 against two exterior photographs and the standard world viewer PMTiles/DEM. This is an individual medium-fi exterior, with explicitly approximate ornament and ground joins.

## Completed checks

- Inspected all 49 current frames: 11 portable/source-terrain, 11 shared/geographic and 27 Earth-lighting/LOD frames. Bulk captures remain local; the retained summary is 1024 × 640.
- Verified source master, runtime master and four authored levels against current hashes. All six GLBs have zero Khronos errors/warnings and no embedded images.
- Verified 15 unioned PMTiles main/part controls, retained exact-QID outline, signed west entrance/east apse orientation, standard DEM datum and mapped gold-dome/bell-cap intervals.
- All 44 imported geometry probes pass for eight belfry openings and their masonry, three entrance cuts with closed rear doors, nine subsidiary/main dome shells, nave vault and steps.
- Five existing shared 256 × 256 material graphs provide limestone, marble, copper roof, raw foundation stone and wood. Each is read once; unloading leaves zero live model geometries. Gold, glass and simplified original icon motifs use vertex colors.
- Corrected windows across entrance holes and the curved nave roof/end closure. Supporting volumes remain complete below the dome roofs.

| Level | Triangles | Geometry bytes | Draws |
| --- | ---: | ---: | ---: |
| Skyline | 999 | 105,208 | 1 |
| District | 3,637 | 333,448 | 7 |
| Street | 10,044 | 978,284 | 7 |
| Close-up | 18,216 | 1,793,644 | 7 |

Initial skyline plus district geometry is **438,656 bytes**. Each level meets the medium-fi budgets; CPU and GPU geometry bytes match with separate position and normal streams. The source master is 18,216 triangles and 2,190,060 bytes.

## Scope and limitations

The broad gold main dome, taller western gold-capped open bell tower, green subsidiary domes, stepped eastern apses, curved nave roof, arched windows and triple west portal are individually authored. Current PMTiles nominal controls determine the main dome's 31–40 m gold cap and belfry's 41.5–50.5 m cap; the retained overall height gives the 53 m bell cross. Heights are relative to the estimated common floor.

The native terrain datum is 559.521963764894 m. A 0.65 m estimated floor and coarse foundation skirts accommodate the standard DEM; exact plaza levels, doorstep joins and surveyed placement are unverified. The geographic capture uses flat terrain; portable captures inspect the retained native terrain. Medium-fi neighbors are synthetic Balkan-konak context.

Untagged heights, drum/roof profiles, windows, cornices and simplified icon motifs are picture-led estimates. Exact icon artwork, lettering, sculpture, structural plans, crypt/interiors, navigable walking surfaces and certified collision are excluded. No road/bridge replacement is registered.

Current machine review and hashes are in `qa.json`; reproduction inputs and commands are retained in the source bundle and recipe. Source milestone reproducibility is recorded separately from this visual approval.
