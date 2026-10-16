# N0315 — Olavinlinna Castle

Reviewed 2026-10-12 against **49 current frames**: 11 portable source views,
11 geographic/shared-material views and 27 medium-fi views. This is an original
individual exterior reconstruction using the current medium-fi standard.

## Appearance and fit

Two linked photographs in [reference metadata](reference-metadata.json) were inspected.
The model retains the three separate cylindrical towers, reddish open arcade crowns,
muted green cones, broad western roofed ranges, small round stair tower, long upper
curtain, lower angular waterside walls, exposed northern rock bank and narrow dogleg
pontoon approach. A light multi-peaked canopy represents the photographed festival
configuration of the eastern courtyard.

Standard viewer Protomaps 20261008 controls identify the named castle, building envelope,
bridge `35184397724359`, rock and grass polygons. The retained identity-matched OSM
relation `11335890` supplies the compound ring and courtyard holes. They establish
approximate horizontal fit, rather than surveyed architectural plans.

Anchor: **28.901095051°, 61.863834833°**. Heading: **−1.5299339583694802 rad**.
The native X axis bisects the two undirected pontoon segment axes. All geometry,
normals, cameras, review terrain and map controls are transformed consistently from
the retained castle axes; this preserves their geographic bearing. The actual
`withoutStructureRoads` test removes both mapped bridge segments inside the authored
coverage hull and retains an unrelated path and a synthetic separate tunnel crossing.
The synthetic tunnel check does not imply a tunnel exists at this site.

## Source and browser levels

The deterministic [recipe](../../../../../../../packages/worldgen/scripts/olavinlinna-castle-model.mjs)
preserves a **56,764-triangle master** and independently authors four browser levels:

| Level | Triangles | GLB bytes | Draws |
| --- | ---: | ---: | ---: |
| Skyline | 894 | 92,584 | 1 |
| District | 3,073 | 289,464 | 4 |
| Street | 15,588 | 1,528,368 | 6 |
| Closeup | 52,766 | 5,341,788 | 6 |

Initial skyline + district geometry is **382,048 bytes** (109,923 gzip bytes), below
the 3 MB phone and 6 MB laptop targets. POSITION and NORMAL use separate buffer views;
reported CPU and GPU buffer estimates agree.

Six existing 256² graphs are reused: `stone_drywall`, `stone_granite`,
`metal_standing_seam`, `brick`, `wood_plain` and `fabric_canvas`. Surface-aligned metric
UVs and linear vertex tints preserve the shared material contract. No images are
embedded in any of the six GLBs. Each graph is read once in the shared capture and
unloading leaves zero live model geometries.

The first LOD drafts exceeded the skyline/district/street limits. Distant tower
interiors, arcades and window density were reduced; the three-tower silhouette and
separate upper/lower compound remain. The outer walls were lowered after inspecting
their relationship to the inner ranges. Near levels preserve genuine arcade and
window apertures, sparse roof seams and pontoon rails/pontoons.

## Checks and visual scope

- Six GLBs: Khronos validator **0 errors, 0 warnings**, no embedded images.
- Three tower arcade probes and the western gate portal probe: **0 intersections**.
- Source regeneration, import/hash verification, scene validation and 30-tick simulation.
- Portable overview, four turntables and six individual detail views inspected.
- Six shared material bindings and geographic/north-up footprint overlays inspected.
- Economy/High, noon/late, three distances, untextured skyline, six details,
  four matching-view levels and four LOD transitions inspected.

The flat geographic fixture proves transform and material behavior. Its Y=0 plane
clips portions of geometry below the anchor datum; it is not shoreline/contact evidence.
The source and medium-fi terrain views show the complete approach and lower walls
against the retained coarse terrain and explicit lake fixture.

## Accepted limitations

Architectural heights, roof/range plans, openings, rock profile and small stair tower
are picture-led estimates. Interiors, furnishings, festival seating and certified
walkable collision are excluded. The canopy is a fixed approximate festival
configuration, not a year-round claim or engineered rig.

Native Y=0 is the standard terrain sample **100.6225 m** at the anchor. Foundations
follow that unmodified terrain minus 0.30 m. Preview terrain uses the PMTiles lake mask
and an approximate **Y=−6.85 m** review water surface to show the island. This only
affects the review fixture; it does not carve runtime terrain or verify the actual
lake level. Coarse shoreline edges, underwater footings, pontoon/water contact and
precise entrance/approach joins remain approximate. Synthetic cabins are style
context, not real neighboring buildings. Physical laptop/phone measurements remain pending.
