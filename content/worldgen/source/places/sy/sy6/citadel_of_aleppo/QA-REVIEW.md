# Citadel of Aleppo — current exterior review

Reviewed 2026-10-12 against two inspected reference pictures and standard viewer PMTiles.
The detailed deterministic source master and four authored browser levels are accepted under
the current medium-fi exterior standard, with the limitations below. No claim of a measured
conservation or historical reconstruction is made.

## Appearance and fit

The model includes separate lower and upper gates, an ascending masonry arch approach,
the large pointed entrance with projecting brackets and selective dark stone courses,
a muted red upper-gate roof and small raised lantern, the oval stone-faced hill and inset
curtain/bastions, two distinct mosque/minaret silhouettes, bath domes, a roofed north range,
a low open theatre enclosure and selected roofless room groups.

Current PMTiles polygons control the gates, mosques, bath and roofed components. The bridge-tagged
steps control the southwest approach. The retained Q206231 outline is the **hill foot**, not
the upper curtain. The crest inset and room grids are picture-led estimates. Tile-clipped duplicate
components use their largest exterior ring; original map arrays are preserved in the source.

Native X follows the bridge. Placement at longitude **37.16293972**, latitude **36.199384527**
uses heading **-1.9600215196180855 radians** to restore the geographic bearing. A five-meter-wide
replacement outline suppresses the actual mapped bridge while preserving an unrelated path and
the mapped upper-gate tunnel. Bridge approach height hints are intentionally unset.

The retained terrain supplies native Y=0 at **434.1433 m**. Foundations descend 0.30 m into it.
The slope skin follows that terrain with 0.6 m closeup clearance to avoid coplanar clipping;
coarser levels use larger clearances and fewer surface subdivisions. The fitting terrain and QA
cameras are rotated consistently with the model, while raw east/south controls remain in the bundle.

## Current inspected evidence

**59 frames** were inspected after the final frame alignment: 11 portable, 11 geographic/shared,
10 isolated shared-material frames and 27 medium-fi frames. Initial slope strip clipping and
inward-facing gate brackets were corrected before these captures. The six GLBs pass Khronos
validation with zero errors/warnings; short probes through both gate portals and three bridge
arches hit no triangles. The source/import/placement checks, asset verification and 30-tick
scene simulation pass. Current hashes and frame paths are recorded in `qa.json`.

Four existing 256² material graphs supply limestone, ceramic roof tiles, basalt trim/courses and
plain wood. Metric UVs and linear vertex tints are retained. No photograph or unique image is embedded.
The viewer reads each graph once and unloads all live model geometries. Flat geographic and isolated
fixtures prove transforms/material loading; retained terrain views supply approximate ground evidence.

| Browser level | Triangles | GLB bytes | Draws |
| --- | ---: | ---: | ---: |
| Skyline | 998 | 101,204 | 1 |
| District | 3,968 | 381,700 | 2 |
| Street | 14,896 | 1,406,648 | 4 |
| Closeup | 30,198 | 3,015,856 | 4 |

Initial skyline plus district geometry is **482,904 bytes** (**144,027 gzip bytes**), below the
3 MB phone and 6 MB laptop targets. The source master is separate: 32,704 triangles, 3,927,440 bytes.
Separate position/normal streams keep CPU and GPU estimates equal.

## Explicit limitations

- Upper curtain location, bastion cadence, heights, roofs, rooms and ornament are approximate.
- Standard terrain smooths the moat, hill and terraces. The runtime does not carve the moat;
  underarch visibility, exact thresholds and path joins depend on host terrain resolution.
- Selected room groups are not an inventory of every room or temple excavation. Modern service
  huts, damage inventories, inscriptions, interior artifacts and furnishings are excluded.
- Synthetic riad neighbors provide lighting/style context; they are not actual Aleppo buildings.
- Imported convex bounds do not provide certified walkable ruin/bridge collision.
- Physical laptop and phone frame-rate measurements remain pending.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=citadel_of_aleppo` (or `--check`),
then the targeted import, LOD, placement and capture commands recorded in `qa.json`.
The recipe is `packages/worldgen/scripts/aleppo-citadel-model.mjs`; all model inputs, map controls,
shared-material means and fitting terrain are retained in this source bundle. GLBs remain build outputs.
