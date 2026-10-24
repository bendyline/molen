# Chinon Castle — current model review

Reviewed 2026-10-13 under `docs-src/guide/medium-fi.md`. All **49 current frames** were inspected: 11 portable, 11 geographic/shared-material and 27 medium-fi images. `qa.json` binds acceptance to the actual source, runtime, recipe inputs and image hashes.

![Current shared-material lodging and western towers](medium-fi/royal-lodging-and-slate-ridges.png)

## Individual structure and map fit

The main ridge enclosure follows the retained exact-QID `way131114399`, approximately 258 × 101 m. Nine current standard viewer PMTiles building polygons control the roofless western round tower, flat-sided south tower, broad interior round keep, royal lodgings, eastern clock gate and minor ranges. Two mapped bridge LineStrings control the western moat crossing and eastern entrance. The native +X axis points east along the ridge; +Z points south toward the town. The anchor is `[0.235974057, 47.168140769]`, heading `-0.12452132583` radians.

The two linked photographs in `reference-metadata.json` were visually inspected. They guide the unequal towers, slate roof and gable silhouette, projecting stairs, open grounds and tall narrow gate. They show differing lodging roof states; the roofed photograph supplies the roof treatment without asserting a historical date. No bespoke survey or historical research was used.

## Browser cost and shared textures

| Level | Triangles | Bytes | Draw calls |
| --- | ---: | ---: | ---: |
| Skyline | 964 | 94,876 | 1 |
| District | 1,382 | 131,056 | 6 |
| Street | 5,350 | 507,048 | 7 |
| Closeup | 10,492 | 987,116 | 7 |

The deterministic source master has **10,852 triangles**, seven merged material groups and **1,306,332 bytes**. Initial skyline plus district geometry totals **225,932 bytes**, or **57,959 bytes gzip**. Every browser level has separate POSITION/NORMAL streams and equal recorded CPU/GPU buffer totals.

Five existing 256² graphs supply limestone, rubble, slate, wood and painted metal. Lawn and modest blue-grey glazing use plain linear vertex colors. Seven near draws keep those five shared graphs and two plain surfaces distinct. Metric UVs and sRGB-to-linear tints are used; none of the six GLBs embeds an image. Shared capture reads each graph once, and unloading leaves zero live model geometries.

## Corrections and checks

The first terrain render exposed blended DEM through the courtyard; the authored plateau was raised while retaining the unmodified review heightfield. The western crossing now spans a visible dry moat. Minor ranges were raised above the plateau, the clock faces were attached to actual gate planes and separated from the upper window, and duplicated solid gate faces were removed. The eastern deck descends to its sampled approach instead of ending above the ground. These are approximate exterior reconstruction choices.

All six GLBs pass Khronos validation with zero errors and warnings. Five current geometry probes confirm the hollow western tower, 22 m gate/curtain passage, open dry moat, open middle court and upper gate window. Both actual mapped bridge paths are suppressed; tested intervening path and separate tunnel are preserved. Preservation controls are synthetic and do not establish a real tunnel here.

Source generation `--check`, import `--check`, placement `--check`, asset hash verification, scene validation and a 30-tick simulation pass. Economy/High, noon/late, three distances, untextured skyline, six details, four matching LOD views and four transitions were inspected. Main towers, lodging ridge and eastern gate persist; near windows, bastions, minor buildings and roof detail intentionally appear at closer levels.

## Accepted limits

Native Y=0 is the standard viewer DEM's 76.6857 m anchor sample. The shallow authored plateau is approximately Y=7 m at the anchor, declining slightly westward. Retaining-wall footings follow the retained DEM; the coarse elevation grid blends the ridge. Wall heights/thicknesses, tower caps, room remains, moat depth, ridge skirt and bridge profiles are approximate. There is no runtime terrain carving or claim of surveyed contact, engineering accuracy or certified walkable collision.

The main western/middle fortress and clock gate are modeled. The separate eastern visitor building and buried archaeological plans beyond the entrance are outside this exterior reconstruction. Trees obscuring the photographs are not reproduced as castle geometry. Complete interiors and furnishings are excluded.

Flat geographic captures clip negative retaining footings; source-terrain captures provide complementary ground review. Synthetic English terraces and the bounded heightfield test style, not actual neighbors. Physical laptop and phone performance measurements remain pending.
