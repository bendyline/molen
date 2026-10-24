# church_of_the_holy_sepulchre — Church of the Holy Sepulchre

Reviewed 2026-10-13 as a **medium-fi exterior reconstruction**. Two inspected roof/facade
pictures and standard viewer PMTiles/DEM guide the unequal Rotunda/Catholicon domes,
square paired-arch bell tower/red hip, connected ranges, arched south facade, entrance court,
small cupolas and terrace stairs. All 49 current portable, shared/geographic and Earth-lighting
frames were inspected, including the retained 1024×640 summary.

## Geometry and shared surfaces

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| Source master | 6,194 | 747,800 | 8 |
| Runtime master | 6,194 | 747,084 | 8 |
| Skyline | 575 | 58,908 | 1 |
| District | 2,518 | 227,116 | 7 |
| Street | 5,859 | 538,676 | 8 |
| Closeup | 6,194 | 571,684 | 8 |

Initial skyline + district geometry totals **286,024 bytes**. Three existing shared 256²
graphs supply weathered limestone, standing-seam metal and red tile. Each loads once;
unloading leaves zero live model geometries. Glass, small wood rails/ladder and gold cross
use linear vertex colors. Metric UVs, separate position/normal streams and matching CPU/GPU
upload accounting are retained. All six GLBs validate with zero errors, warnings or embedded images.

Thirty-five unioned exterior component controls match current PMTiles. The exact-QID outline,
signed west/east domes and southern entrance, DEM and principal mapped heights pass. Actual
indexed metal vertices retain the 20–34 m and 24–34 m dome intervals relative to the common
floor; the red bell roof reaches the mapped 30 m height. The gold cross is an untagged estimate.
All 55 opening, glazing, masonry, court/floor, dome, stair-attachment and sealed-portal probes pass.
The targeted generator reproduces the master; asset inspection, scene validation and a 30-tick
simulation pass.

## Corrections

Roof-stair ends were moved onto the terrace footprints and stringers added. Lower bell panes
buried behind adjacent ranges were omitted; visible panes were raised above the adjoining roof.
The third facade pane was moved away from the front cupola. Sparse secondary surface windows
were added as explicit exterior estimates. Aperture filtering avoids cutting unrelated masses.
Skyline uses simpler compound masses and surface belfry panes to preserve the dome/tower silhouette
within its budget; district and nearer levels restore the open paired belfry arches.

## Accepted limits

Mapped nominal dome/body/bell/apse/turret heights are preserved relative to an estimated **0.75 m
native church/court floor**. Native Y=0 follows retained standard DEM at **770.4363 m**. The coarse
west-to-east slope, foundations, court paving, roof stairs and terrace/street joins are approximate;
the flat geographic fixture is complemented by source-terrain views. No surveyed street/church
datum or certified walking collision is claimed.

Untagged component roles/levels, window rhythm, portal details, roof profiles, small cupolas,
rails/ladder, cross and ornament are picture-led approximations. The references show different
roof conditions; principal gray metal and red bell tile follow the newer view. Higher part
footprints mask lower roof caps. Interior Aedicule/chapels, below-grade St Helena volume,
separate east police range, full interiors and exact sculpture/lettering remain excluded.

Skyline omits facade detail and roof stairs. District restores lower ranges and sparse facade
detail; street/closeup restore recessed primary panes, inferred secondary surface windows,
arch bands, eaves and joined stairs. Context neighbors use the synthetic Levantine-stone style.
Surrounding city, visitors and vegetation remain host content. Physical laptop/phone measurements
remain pending. Current hashes and inspected image lists are in `qa.json` and the concise capture
reports; bulk renders stay local and ignored.
