# leeds_castle — Leeds Castle: backlog review

Reviewed 2026-10-09. **45 images inspected:** 11 portable, 11 shared-material/geographic and
23 medium-fi lighting/detail/LOD frames. Current approval is bound to the source inputs,
exact GLBs, material graphs, placement and image hashes in `qa.json`.

## Source and architectural repairs

The original `leeds-castle-model.mjs` recipe remains unchanged and reproduces its
1,413,956-byte, 11,749-triangle master, hash
`a10423a135cedf41c195722ffcc0de7e7dd7d1235674b8a4983e219e09db78a8`.
The separate current leaf retains the two islands, four mapped buildings, open Gloriette
court, roof coverage, New Castle turrets, Maiden Tower, gatehouse and covered bridge.
It raises the reconstructed courtyard from 4.4 to 6 metres above the archived lake datum
and adds a six-triangle connecting approach from attributed way 94361177.

The operator's aerial, southern elevation and restoration photograph were inspected with
the [Historic England listing](https://historicengland.org.uk/listing/the-list/list-entry/1039919)
and [operator history](https://www.leeds-castle.com/her-castle/history-of-the-castle/).
These guide the original exterior reconstruction; no architectural mesh or photo texture
was copied. Temporary restoration scaffolding is omitted.

## Placement and terrain

Relation 6941053 / Q746876, original footprint traces and island/bridge controls are retained.
Anchor: **0.630100728, 51.248785815**. Native +X points east, +Z south; heading is **0**.
The authoring plan rotation is already baked into the geometry. The 292 original map
coordinate samples round-trip within 0.682 mm; this arithmetic check does not establish
the surveyed accuracy of OpenStreetMap.

The [Environment Agency 2022 1 m DTM](https://www.data.gov.uk/dataset/01b3ee39-da3f-47b6-83da-dc98e73a461f/lidar-composite-dtm-2022-1m)
is the ground reference. Its archived flat lake cells give **56.28 m ODN** and 29 mapped
bailey-path observations have a **62.245 m** median. The current uniform floor at
**62.28 m ODN** is reconstruction near that median, not a survey of castle floors.
The EPSG:27700 conversion used a fallback with nominal 2 m horizontal accuracy, without
an OSTN15 grid. Source observations and attribution are preserved in `terrain-grid.json`.

The raw four-metre review grid is retained. Only the derived review height image sinks
terrain beneath the 21-point castle/island/bridge hull and flat lake surface to keep the
water channel clear. The source-local palette lake box supplies review water. Host
terrain and water must use a compatible ODN datum; the archived DTM does not establish
current seasonal lake height. The DTM removes buildings/bridges and cannot establish
Gloriette court or above-water bridge-floor heights. Approach width and two end controls
are declared reconstruction. Automatic footprint replacement remains disabled.

An incorrect Y0 ground plane in the geographic capture fixture caused perspective separation
between the castle and its opening. The fixture now honors its explicit 56.28 m review datum;
current captures show the cutout aligned, the two covered-bridge arches clear, and ground
restored after unloading. This flat fixture verifies registration and resource lifetime.

## Browser models and shared materials

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| Skyline | 856 | 75,924 | 1 |
| District | 2,905 | 264,172 | 7 |
| Street | 11,725 | 1,059,156 | 7 |
| Close-up | 11,755 | 1,061,928 | 7 |

Initial skyline plus district download is **340,096 bytes**. The five canonical 256-square
graphs are sandstone, raw limestone, flat tile, plain wood and gravel; glass and lawn
use opaque palette colors. Shared graphs each load once and every GLB has separate GPU
attribute streams and no embedded images. The 2 / 0.7 / 0 / 0 metre allowances describe
intentional far roof/turret simplification, not a measured whole-mesh error bound.

Six current GLBs passed Khronos validation with zero errors or warnings. Nine preserved
architecture tests and three current terrain/LOD tests passed, as did the targeted source,
LOD and strict medium-fi checks. All four levels preserve the open court, mapped gate
route and four water arches. Current source: 11,755 triangles / 1,414,664 bytes, hash
`d16b54283a0f86440f462d94a9e9e5c41b4530f2a8f7dab7e021e1bd9878df27`.

## Accepted limits

Roof pitches, upper elevations, window/arch dimensions, fine ornament and uniform floors
are reconstructed. Most outer barbican, exact inscriptions, interiors and navigation are
excluded. Finite review terrain/water and procedural Cotswold neighbors are context fixtures.
Convex collision is an exterior envelope. Physical phone/laptop timings and downtown
memory measurements remain pending; download and geometry budgets pass locally.
