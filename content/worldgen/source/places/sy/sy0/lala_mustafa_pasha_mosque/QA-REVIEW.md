# Lala Mustafa Pasha Mosque — medium-fi review

Reviewed 2026-10-14 from two useful elevated front/side photographs and the standard viewer
PMTiles/DEM. Original geometry; photographs and third-party models are not redistributed.

## Completed exterior

Three pointed west portal hoods and closed wooden doors, central pointed rose panel,
two open upper tower shells, northern minaret/balcony, low vaulted nave, long aisles,
rounded eastern apse, ten curved flying buttresses, warm stone trim, terrace and side stairs.

Source master: **5,446 triangles / 658,232 bytes**. Runtime master: **657,524 bytes**.
Four independently authored browser levels:

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| Skyline | 998 | 83,584 | 1 |
| District | 2,549 | 206,452 | 8 |
| Street | 4,242 | 340,596 | 8 |
| Close-up | 4,966 | 400,348 | 8 |

Initial geometry: **290,036 bytes**. Five existing shared 256² sandstone, slate,
raw-stone, bronze and wood graphs use metric UVs and linear tints. Sandstone is reused
for walls, trim and roof; glazing uses vertex colors. Each graph reads once, and unloading
leaves zero live model geometries. No embedded images; separate position/normal GPU
streams and matching CPU/GPU geometry costs.

All **49 final frames** inspected: 11 portable/source-terrain, 11 geographic/shared and
27 Earth-lighting/detail/LOD/transition views. Six GLBs validate with zero errors/warnings.
**57 imported geometry probes** cover seven upper apertures/jambs, three portal recesses
and doors, ten flying arches, twelve vault points, terrace/stairs and minaret support.
Current source/runtime hashes, recipe binding and source inventory match. Targeted source
reproduction, scene validation and a 30-tick headless simulation pass.

Corrected bronze material binding, upper-gable intrusion into tower windows, floating surface
windows over portals, overlapping side-stair caps, skyline budget and minaret support.

## Geographic fit and limits

Anchor **33.942700973, 35.124903745**; heading **0.394358076621 rad**. Native +X goes
from the western front toward the rounded eastern apse; +Z goes south toward the stairs.
The photographed northern corner minaret and the mapped flat front/rounded apse resolve
the approximate signed facing. One unioned current PMTiles parent and the retained exact-QID
outline preserve the complete **61×30 m** envelope.

There are no mapped roof/tower parts or heights. The **44.6 m minaret**, **36.1 m façade
peaks**, tower stubs, low vault, buttresses and every intermediate profile are picture-led
estimates. Native Y0 follows standard DEM **10.9117001 m**; estimated **2.8 m** floor,
terrace, stairs and foundation/plaza contact remain coarse. The retained old `ele=21` site
tag disagrees with this coarse DEM and is not used as a surveyed floor datum.

Skyline simplifies closed upper surfaces; district restores front tower cuts/textures;
street restores the seven large upper cuts and curved flying arches; close-up refines
roof/minaret facets, balcony, pinnacles and rose/portal trim. Detail changes remain visible.
Synthetic neighbors test style only. Doors remain closed; full interiors and certified
pedestrian collision are excluded.

Exact stone tracery, sculpture, lettering, damage outlines, surrounding precinct and temporary
restoration scaffolding are not reconstructed. Physical laptop/phone measurements remain
pending. One small summary is retained; bulk review images stay local and ignored.
