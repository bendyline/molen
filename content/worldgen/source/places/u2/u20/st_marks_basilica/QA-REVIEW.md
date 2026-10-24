# st_marks_basilica — St Mark's Basilica

Reviewed 2026-10-13 as a **medium-fi exterior reconstruction**. Two inspected aerial/front
photographs and standard viewer PMTiles/DEM guide the five-dome cross, adjoining ranges and
layered west façade. All 49 current portable, shared/geographic and Earth-lighting frames
were inspected, including the retained 1024×640 summary.

## Geometry and shared surfaces

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| Source master | 16,817 | 2,022,512 | 8 |
| Runtime master | 16,817 | 2,021,808 | 8 |
| Skyline | 984 | 102,904 | 1 |
| District | 3,984 | 373,312 | 8 |
| Street | 15,350 | 1,505,408 | 8 |
| Closeup | 16,817 | 1,661,128 | 8 |

Initial skyline + district geometry totals **476,216 bytes**. Four existing shared 256² graphs
supply marble, brick, standing-seam metal and continuous limestone. Each loads once; unloading
leaves zero live model geometries. Metric UVs and linear cream/pink/brick/lead tints are retained.
Glass, closed rear doors, gold motifs/crowns and four simplified bronze horses use vertex colors.
All four LODs have separate position/normal streams and equal CPU/GPU upload accounting.
Six GLBs validate with zero errors, warnings or embedded images.

Forty-two unioned main/component controls match current PMTiles. The exact-QID envelope,
signed west piazza façade, east apse, south annexes and standard DEM match. Mapped nominal
13 m parent, roof-range heights, 30 m drums, four 41 m/central 45 m shells and four 46.5 m/central
50.5 m crowns control the reconstruction. Actual indexed vertices preserve all five crown tops
relative to the estimated floor. Forty-one imported-GLB probes pass: five narthex apertures,
jambs/heads/rear doors, upper glazing/four gold panels, five closed dome shells/support volumes
and six balcony/pinnacle contacts. Source generation reproduces the master; asset inspection,
scene validation and a thirty-tick simulation pass.

## Corrections and levels

Pinnacles now have continuous supports from the balcony; its outer edge was extended beneath
the outer pier. Horse bodies taper into closed polygonal forms. Roof edges meet their walls,
and roof triangles split at the ridge so inferred peaks survive triangulation. Lower roof masks
now retain supporting volume beneath all five mapped drums. The early floating drums were
corrected before approval.

Skyline uses eight-sided domes, simple crowns without subpixel cross bars, cross-shaped upper
ranges, surface arcade panes and fewer front parts. District restores fourteen principal roof/
annex controls, shared surfaces and actual narthex cuts, while omitting small intermediate range
subdivisions and trim. Street/closeup restore all subdivisions, paired columns, open pinnacles,
cross bars, seam detail and horses. Profile/detail changes remain visible at upgrades; the
overall five-dome silhouette and west façade rhythm hold in Economy and High.

## Accepted limits

Native Y=0 follows standard DEM at **12.2467 m**. The estimated **0.7 m common floor** clears
typical eastern/southern samples; western samples around −0.7 to −2.3 m leave approximate
foundation skirts. Precise piazza/doorstep levels, flood behavior and walking collision are
unverified. Flat geographic views are complemented by source-terrain renders.

Dome/drum/crown profiles, inferred roof subdivisions, façade columns/pediments, window rhythm,
balcony and pinnacles are picture-led approximations. Small windows are surface panes; rear
doors are closed. Four gold panels suggest mosaics using original simple color motifs; exact
artwork, sculpture, reliefs, lettering, horse anatomy/patina, interiors and structural roof plans
are excluded. The detached campanile, Doge's Palace, city and vegetation remain separate host
content. Context neighbors use the synthetic Italian palazzo style. Physical laptop/phone
measurements remain pending. Current hashes and inspected frame lists are in `qa.json` and the
concise capture reports. One summary preview is retained; bulk renders stay local and ignored.
