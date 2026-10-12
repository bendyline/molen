# N0155 — New York Times Building: complete

Reviewed2026-10-10.

## Actual visual inspection

Actually inspected all60 final frames:13 portable,13 shared and34 medium-fi. Whole-parcel turntables and dedicated whole-LOD views retain the cruciform228m shaft, eastern24.6m podium, open court, fading260m ceramic veil and319m mast. Added west glass part260282089 fills the formerly omitted strip. Final courtyard views show white multi-stem birches, low sedge hillocks and a straight timber path below the open sky. Initial court camera was hidden by the podium roof and was moved above the opening; the final east whole camera includes the entire mast. Narrow facade cameras deliberately crop the tower.

## Shared surfaces

Five reusable256px granite, concrete, painted-metal, ceramic and wood graphs use metric repeats. Pale ceramic tints replace the original granite coating on rods; generic ceramic tile seams are a shared coating approximation rather than copied photographs. Glass, vegetation and birch bark use palette PBR. All six GLBs contain zero embedded images. The shared fixture reads each graph once and disposes all model geometries on unload. Source and detailed derivatives use eight material groups, skyline one. Initial strip winding faced inward on some thin mapped screen runs; it now explicitly faces each outer side and remains visible with single-sided shared materials.

## Browser levels and medium-fi

Actually inspected noon/late and economy/high views, the untextured skyline silhouette, full source-detail views, court and west glass additions, nine dedicated browser cameras and four transitions. The white veil, exposed X-bracing, court and mast survive distance changes. Closeup uses the same original rod centers and diameter with double-sided strips; street/district combine rows into wider strips with matching coverage and fading crown density. Skyline uses5.2m-pitch strips while retaining an open crown, whole cruciform envelope, eastern podium and court. The grove is an illustrative medium-fi planting abstraction. Synthetic brownstone context is a style fixture, not actual Manhattan surroundings.

Final skyline899triangles/84560bytes/one draw; district3695/301360/eight; street12527/1047828/eight; closeup51643/4350444/eight. Initial skyline+district385920bytes, below3MB phones and6MB laptops. Error allowances2.6m/1.7m/0.7m/0.08m. Detailed reviewed source10092224bytes remains separately reproducible; closeup replaces81984 original cylinder triangles with5776 flat strip triangles while retaining the rod schedule. Geometry remains visible through transitions; distant bands and branches are explicit abstractions. Physical-device timing and full-scene memory remain unmeasured.

## Signed placement

Fresh public OSM API snapshot2026-10-10 confirms exactQ192680 relation1860567, outer138152330 and all nine building parts unchanged. Retain anchor[-73.989728696,40.755919869] and heading-0.500689021167rad: native-X points northwest toward Eighth Avenue, +X southeast to the low TimesCenter podium, +Z southwest to West40th Street and-Z northeast to West41st. Distinct western screen/glass and eastern court/podium resolve the signed frame. Duplicate reversed inner members represent one open court and are deduplicated. Actually inspected the north-up whole-parcel overlay. Rounded-outline residual0.000602m; accepted map/reconstruction tolerance2m/1degree. Y0 is contact datum; slope and absolute grade are unmeasured. Footprint replacement disabled.

## Primary references and declared scope

The unchanged125459-triangle original recipe reproduces exact de47ded118b02c75 hash. Reviewed126843-triangle source adds the omitted mapped western glass section and the open-air birch grove described by the primary landscape team; original facade rods, brackets, braces and mast remain. Screen bases follow mapped6m north/south and12m east/west heights. Actually inspected designer images Nyt__340,550,471,730,591,577 and two HMWhite garden photographs. Primary228m/260m/319m and50ft birch heights are published dimensions. Nine tree sites, canopy shape, panel pitch, joints, support details and entry hardware are original reconstruction; tree count is illustrative, not surveyed. Designer photos are historic2007; current hardware changes are not inferred. Two older PDFs returned404 and were not claimed inspected. Interiors, tenant signage and temporary barriers omitted. Physical-device timing, night and actual terrain remain unmeasured.

References: [designer archive](https://www.fondazionerenzopiano.org/en/project/the-new-york-times-building/), [landscape team](https://www.hmwhitesa.com/projects/the-new-york-times-building), [structural team](https://www.thorntontomasetti.com/project/new-york-times-building), [mapped parcel](https://www.openstreetmap.org/relation/1860567).

## Geometry and reproducibility

Three focused tests pass: exact original-master byte reproduction, current source/runtime hashes and independent nine-part signed map controls; roof rays prove eastern podium, open court/timber path and50ft grove while a glass-only horizontal ray confirms the omitted western strip; deterministic four-level rebuild, download/triangle/draw caps, outward ceramic normal regression, no embedded images and separate12-byte POSITION/NORMAL streams. The final normal test prevents the visibility issue caught in actual renders. All six final GLBs pass Khronos validation with zero errors and warnings. Targeted medium-fi and current recipe checks pass. No repository-wide rebuild or dependency audit was needed.
