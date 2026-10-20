# N0518 — Temple of Hercules Victor

Reviewed 2026-10-19. Completed in one continuous authoring/inspection round for the visible exterior and approximate map fit.

![Temple of Hercules Victor](preview.png)

## Visible architecture

Inspected current source, shared-material, medium-fi and retained-terrain site renders during the same authoring round. Nineteen individually mapped fluted Corinthian columns, isolated surviving twentieth base, low circular podium and four east access treads, round pale lower/brick upper cella, closed recessed arched door, shallow present tiled roof, timber underside/ring beams, small summit cap and selected shaft tie bands. Corrected panel side winding before captures and moved the protective bands outside the flutes after the first render exposed dotted intersections. No lost ancient architrave, entablature or original roof is invented.

## Shared materials

Five reused 256² graphs: raw limestone, long-format brick, ceramic tile, plain wood and standing-seam metal. Metric UVs and linear pale stone/grey-brown roof tints, zero embedded images and no unique atlas. Shared graphs load once, at most five model draws, separate GPU attribute streams, geometry disposal on eviction. Flat shared/context stages expose buried retaining foundations; native-grade evidence comes from the actual-site fixture.

## Browser levels

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 956 | 100016 | 1 |
| district | 3852 | 377572 | 5 |
| street | 13460 | 1303784 | 5 |
| closeup | 19764 | 1942968 | 5 |

Inspected 24 current medium-fi views: noon/late, Economy/High, street/block/skyline, untextured silhouette, three model details, four explicit authored levels and transitions. Levels 956 / 3,852 / 13,460 / 19,764 triangles. Initial geometry totals 477,588 bytes. The round cella, column ring, east steps and present roof survive at skyline distance; fluting, broad leaf masses, mouldings, timber and protective bands resolve nearer. Physical laptop/phone and dense-city timing measurements remain pending.

## Map and terrain

Q576929/way251342364 fixes the circular temple. Eleven pinned standard PMTiles records supply the main footprint, podium, nineteen separate standing shaft polygons in one feature, isolated base, C-shaped cella, roof, roof cap and four east stair parts. The open east sector of the mapped cella and stair projection resolve the entrance facing east, independently of the circle bounding-box axis. Raw+X east/+Z south at runtime heading0; each mapped shaft keeps its individual center. Reused pinned N0506 standard Rome PMTiles/Mapzen extract. The lower datum clears the actual standard-grid triangles beneath each mapped entrance tread and podium, using retained footprint intersections. Foundations extend below the minimum local grade. Native ground and water stay unchanged with no cutout. Exact archaeological floor and modern fence/garden levels remain approximate. The original union had degenerate slivers, so the replacement mask is a clean 29-vertex convex envelope of only the eleven temple records, with a2cm margin. All 1,290 independent in-tile buildings, including neighboring Portunus, remain unchanged. All eleven authored native records are replaced completely. Native ground and original Tiber/water geometry stay unchanged. Failed loading restores all 1,301 original records; unloading releases model geometry.

## Limits

Accepted as the medium-fi present-day exterior and approximate standard-map fit. The map fixes nineteen individual shaft centers, one base, C-shaped cella, east treads and approximate roof/height envelope. Flute/drum profiles, capital leaf/corner forms, repairs, tie-band inventory, timber members, roof tiles and door joinery are simplified picture-led visualization estimates. The model includes the present roof and a closed door, with no intact lost ancient entablature, exact archaeological reconstruction or navigable interior. Modern garden, fence and street furniture remain context.

## Selected checks

Two registered recipes rebuild the 2,375,120-byte source master. Six Khronos files: zero errors/warnings. 2,982 actual mesh probes pass. Inspected 48 current views (8 source, 8 shared, 24 medium-fi, 8 site/fallback). Scene validation/sim 30 and strict selected medium-fi audit pass. Full source rebuild, lock refresh and the prior N0512 renderer release gates remain at the planned batch milestone near 525 complete.

Rebuild: node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0518; node packages/worldgen/scripts/import-next-1000-models.mjs --ids=N0518; node packages/tooling/scripts/generate-landmark-lods.mjs --ids=N0518 --force.

Source: sha256:db356c324a6aba533ddf443839aed5b8558aa65f1374c7483a6c26f411b9ee5c

Runtime: sha256:485fd42120d57fb3e2236138a7fafe49380bb8d725e0c7f7fd769cfb7c9da853

Input: sha256:5349bc9e38a38c5f34857bb50fed9b064bb03e808613a09cdcd97fe195161346

## Ordinary pictures

https://commons.wikimedia.org/wiki/File:L06_725_Tempel_des_Hercules_Victor.jpg — Falk2 / Falk Arnhold; 2025-10-20; CC BY-SA4.0; viewed only. Viewed only; no pixels copied.

https://commons.wikimedia.org/wiki/File:Temple_Hercule_(Rome)_-_Chapiteaux.JPG — Ursus; 2012 (EXIF2012-05-06); CC BY-SA3.0; viewed only. Viewed only; no pixels copied.
