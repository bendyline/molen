# Wawel Cathedral — medium-fi review

Reviewed 2026-10-14. Original exterior geometry from three useful west/aerial/south
pictures and the existing standard viewer Protomaps/Mapzen-USGS extract. No photographs
or downloaded model geometry are redistributed.

## Completed scope

Pale west gable, rose and entry portico; green clock tower and northern Sigismund tower;
shorter brick Silver Bells tower; steep nave, transept and choir roofs; dark Vasa and gold
Sigismund domed chapels; connected northern treasury/chapterhouse; windows, cornices,
simple buttresses, bells, clock hands and steps. Existing N0299 Wawel Castle remains separate.

The deterministic source master contains **17,476 triangles / 2,101,792 bytes**.
Runtime master: **2,101,088 bytes**. Independently authored browser levels:

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| Skyline | 987 | 100,688 | 1 |
| District | 3,841 | 333,432 | 8 |
| Street | 11,662 | 992,856 | 8 |
| Close-up | 17,316 | 1,504,856 | 8 |

Initial geometry totals **434,120 bytes**. Six existing shared 256² limestone, brick,
slate, copper, raw-stone and wood graphs use metric UVs and linear tints. Green and gold
roofs reuse a copper graph/material with different tints; glass uses vertex colors.
Each graph reads once; unload leaves zero live model geometries. No embedded images.
Position/normal GPU streams are separate; CPU/GPU geometry costs match.

All **49 final renders** were inspected: 11 portable/source-terrain, 11 geographic/shared,
and 27 Earth-lighting/detail/LOD/transition frames. Six GLBs validate without errors or
warnings. **126 imported geometry probes** pass, including 54 roof coverage checks for
the concave northern ranges. Source/runtime hashes, current inputs and all 28 unioned
map controls match. Targeted source reproduction, scene validation and headless simulation pass.

Corrected west-gable/window z-fighting, a blocked entry recess, Silver Bells roof intrusion,
northern range footings, missing treasury roof triangulation and over-budget distant levels.
Mapped supporting-footprint unions show **zero intersection area** with the separate palace.

## Placement and limitations

Anchor **19.935495472, 50.054663564**, heading **0.264798508996 rad**. Native +X goes east
toward the choir; +Z goes south toward the domed chapels. West entrance, northern clock
POIs and named Sigismund tower/Silver Bells crypt resolve the approximate signed facing.
Native Y0 follows standard DEM **225.4619855 m**; estimated **3.2 m** floor, foundations,
hill/plaza contact and neighboring palace thresholds remain approximate.

Main 35 m roofs, 22 m lower choir, 12 m west chapel roofs and 45 m north crown retain
nominal map heights. The overlapping **55 m southern cap conflicts with the pictures**;
it remains in the source controls while the shorter tower uses its 36 m lower component
as an approximate crown. Northern Sigismund's 41 m height and every intermediate cap,
drum, gable, window and roof profile are estimates; exact heights are unverified.

Skyline simplifies closed stage surfaces; district restores selected openings and textures;
street restores the large open stages with coarser curved heads; close-up refines dome facets,
rose/clock trim and surrounds. Detail changes remain visible at upgrades. Small chapel
lanterns are simplified closed masses. Synthetic neighbors only test visual compatibility.

Exact sculpture, tracery, lettering, structural plans, interiors, certified walking/collision
surfaces and the surrounding royal/monastic compound are excluded. The shared green/gold
roof material is an approximation. Physical laptop/phone measurements remain pending.
One small preview is retained; bulk captures stay local and ignored.
