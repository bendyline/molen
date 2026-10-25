# Riga Cathedral — medium-fi review

Reviewed 2026-10-14 from two useful cathedral aerial/west-tower pictures and standard
viewer PMTiles/DEM. Original geometry; photographs and third-party models are not redistributed.

## Completed exterior

Arcaded brick western shaft, brown copper clock roof, open lantern and bulb cap; long gray
nave roof, lower aisles, transept/porch and adjoining ranges; low eastern choir/rounded apses;
14 mapped roof features; west circular window, closed doorway and approximate steps.

Source master: **16,157 triangles / 1,943,516 bytes**. Runtime master: **1,942,816 bytes**.
Four independently authored browser levels:

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| Skyline | 986 | 91,864 | 1 |
| District | 3,948 | 357,872 | 8 |
| Street | 10,068 | 937,252 | 8 |
| Close-up | 16,053 | 1,562,868 | 8 |

Initial geometry: **449,736 bytes**. Seven existing shared 256² brick, limestone, slate,
copper, raw-stone, bronze and wood graphs use metric UVs and linear tints. Each graph
reads once; unloading leaves zero live model geometries. Glass uses vertex colors.
No embedded images; separate position/normal GPU streams and matching CPU/GPU costs.

All **49 final frames** inspected: 11 portable/source-terrain, 11 geographic/shared,
27 Earth-lighting/detail/LOD/transition views. Six GLBs validate with zero errors/warnings.
**237 imported geometry probes** pass, covering 20 large upper openings/jambs, west recess
and door, all four complete clock faces, roof coverage and steps. All 30 unioned current
map controls, source/runtime hashes, recipe binding and source inventory match. Exact targeted
source reproduction, scene validation and a 30-tick headless simulation pass.

Corrected clock faces buried in the sloping copper roof with supported raised plates;
lower roofs crossing higher roof surfaces; dormer toes above the sloping roof; generic windows
over the western shaft; clipped Float32 slivers and the district triangle budget.

## Geographic fit and limits

Anchor **24.104849705, 56.949090248**, heading **−0.193194442449 rad**. Native +X goes
east from the western tower to the rounded apse; +Z goes south. Western tower/eastern apse
and north porch resolve the approximate signed facing. Retained exact-QID outline and
30 unioned PMTiles controls preserve the **87×45 m** envelope.

The retained **90 m overall crown** controls the top. Nominal 35 m nave, 21 m aisles,
23 m transept/western shoulders, 61/79/83 m cap stages and 31/34 m roof-feature tips
are retained. Intermediate eaves, curved cap/lantern profiles, arcade/window rhythm,
door design and the low 5/8 m eastern tags remain picture-led estimates or unverified controls.
Native Y0 follows standard DEM **14.348894 m**; estimated **1.6 m** floor clears the coarse
−0.23..1.07 m perimeter. Foundation/plaza/doorstep joins remain approximate.

Skyline simplifies closed stages and omits roof dormers; district adds one selected shaft cut,
four alternate lantern cuts and textures; street restores all 20 large cuts, 14 mapped roof
features and clock/rose trim; close-up refines curves, friezes and surrounds. Detail/profile
changes remain visible. Synthetic neighbors test style only.

Exact brick tracery, clock numerals, sculpture/weathercock shape, full interiors, surrounding
cloister/museum block, surveyed floors and certified pedestrian collision are excluded.
Physical laptop/phone timing remains pending. One small summary is retained; bulk review
images remain local and ignored.
