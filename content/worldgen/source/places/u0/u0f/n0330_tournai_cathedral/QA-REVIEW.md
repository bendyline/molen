# Tournai Cathedral — current model review

Reviewed 2026-10-14 against two inspected elevated exterior photographs and standard viewer PMTiles/DEM. This is an individual medium-fi exterior; exact façade detail and ground joins remain approximate.

## Completed checks

- Inspected all 49 final frames: 11 portable/source-terrain, 11 shared/geographic and 27 Earth-lighting/LOD frames. Bulk captures remain local; the retained summary is 1024 × 640.
- Source master, runtime master and four browser levels match their recorded hashes. All six GLBs have zero Khronos errors/warnings and no embedded images.
- Verified 56 unioned main/part controls, the rigidly reframed exact-QID outline, signed west nave/east choir orientation, standard DEM datum and indexed 83 m outer-tower/70 m central-lantern heights.
- All 161 imported-geometry probes pass for 48 belfry cuts and their jambs/heads, the entrance recess and rear door, five spires/supports, roofs and steps.
- Five existing shared 256 × 256 graphs provide limestone walls/trim, slate, chapel tile, raw stone foundations and wooden doors. Each reads once; unloading leaves zero live model geometries. Glazing uses vertex colors.
- Corrected floating apse-buttress connections, intersecting window reveals, the nave volume blocking the entrance recess and a rose panel hidden inside the west wall.
- Targeted source generation reproduces the master. Asset hash verification, scene validation and a 30-tick headless simulation pass.

| Level | Triangles | Geometry bytes | Draws |
| --- | ---: | ---: | ---: |
| Skyline | 989 | 103,408 | 1 |
| District | 3,997 | 368,672 | 7 |
| Street | 13,688 | 1,335,072 | 7 |
| Close-up | 26,570 | 2,633,224 | 7 |

Initial skyline plus district geometry totals **472,080 bytes**. All levels meet medium-fi budgets; CPU/GPU geometry bytes match and positions/normals use separate streams. The source master is **26,570 triangles / 3,192,620 bytes**.

## Scope and limitations

The five-tower cluster, pointed slate roofs, rounded transepts, lower western nave, taller Gothic choir/apse, masonry flying arches and lower chapels/annexes are individually authored. Mapped footprints and nominal heights control fit. Intermediate eaves/spires, round roofs, window rhythm, buttress profiles and untagged 12 m ancillary volumes are estimates.

Skyline simplifies secondary roofs and omits small detail. District restores eight selected belfry cuts and surface panes on other faces. Street retains all 48 belfry cuts with coarser curved heads; close-up refines their curves, trim and masonry. Profile and detail changes remain visible in the reviewed transitions.

Native Y=0 follows standard DEM **27.636844092521216 m**. The estimated **1.5 m common floor** accommodates coarse perimeter samples of about −2.22 to 3.25 m. Foundation skirts, some embedding and exact plaza/doorstep joins remain approximate. Geographic captures use flat terrain; portable views inspect the retained native terrain. Neighboring terraces in medium-fi views are synthetic context.

Both reference pictures show elevated side views. The west portal and rose panel are reasonable exterior estimates; exact west-façade design was not verified. Exact sculpture, tracery, lettering, interiors, structural plans, the separate city belfry and certified walking/collision surfaces are excluded. Physical laptop and phone measurements remain pending.

Current hashes and machine review are in `qa.json`. The latest full library source checkpoint covers N0325–N0329; N0330 has targeted reproduction checks and joins the next meaningful batch milestone.
