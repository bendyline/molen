# N0511 — Temple of Caesar

Reviewed 2026-10-19. Accepted for medium-fi surviving exterior and approximate standard-map fit. Built, inspected, corrected and completed in one continuous round.

![Temple of Caesar](preview.png)

## Architecture

Inspected the current portable, shared-material, medium-fi and actual-site renders in this continuous authoring round. Present-day ruin complex: high flat-topped podium, curved altar recess, four separate concrete/brick cores, low return/foundation traces, polygonal protective canopy with open timber understructure, rough altar blocks, a few fallen marble fragments and low visitor rail. Corrected gaps where the first eroded cap triangulation skipped boundary vertices, flattened the podium top, kept the small foundation trace flat and replaced repeated narrow brick patches with broader areas. No intact ancient colonnade or temple superstructure is invented.

## Shared materials

Five reused 256² graphs: weathered limestone for concrete/tuff cores, long-format brick, marble, plain timber and standing-seam metal for the modern canopy/rail. Metric UVs, neutral linear tints and zero embedded images or unique atlases. Each graph loads once; at most five model draws and geometry is released on eviction. Stone texture, erosion, brick exposure and canopy weathering are broad medium-fi approximations.

## Browser levels

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 320 | 34020 | 1 |
| district | 1315 | 128004 | 5 |
| street | 2117 | 207208 | 5 |
| closeup | 2835 | 274304 | 5 |

All 25 required medium-fi views inspected: noon/late, Economy/High, street/block/skyline, untextured silhouette, four details, four explicit authored levels and their transitions. Levels 320 / 1,315 / 2,117 / 2,835 triangles; all budget caps pass. Initial geometry is 162,024 bytes. Separate attribute streams avoid duplicate GPU uploads. The shelter and separated cores survive at distance; joinery, rail and erosion resolve closer. Physical-device and dense-city timings remain pending.

## Geographic fit

Seven mapped components retain their original vertices. The broad Q1133288/way131451819 archaeological outline is identity/context, not a solid shell. Raw +X east, +Z south at heading 0; the curved altar/shelter component and northwest frontal picture establish the opening direction. Internal architectural +Z points northwest; its authoring XZ rotation is 2.162602 radians (about 124 degrees). Runtime heading remains 0. The nearby Arch of Augustus components, Regia, Vesta and Antoninus/Faustina are excluded from this asset. Approximate fit on the unchanged retained standard Mapzen grid. All mapped concrete cores and low traces have buried retaining foundations; the altar floor and open modern canopy follow the northwest local grade. Seven temple map components are replaced to tiny boundary remnants while all 2,012 independent in-tile buildings remain unchanged. Native ground and mapped water are preserved without a cutout. Exact archaeological floors and damaged profiles are picture-led estimates.

## Scope and limits

Accepted as a medium-fi present-day surviving exterior with approximate standard-map fit. Heights, erosion profiles, exact brick exposure, individual fragments, altar-block shapes, shelter joinery and archaeological floor levels remain picture-led estimates. The canopy is modern protection, not an ancient temple roof. No exact original temple reconstruction or navigable interior is claimed. The coarse native terrain, water and all independent map structures stay intact. Surrounding map-generated shells are preserved context and are not authenticated reconstructions of the other Forum monuments.

## Checks

Two registered recipes rebuild the 343,628-byte master. Six Khronos files: zero errors/warnings. 2,292 core-top/contact probes pass. Inspected 52 current views: 9 portable, 9 shared, 25 medium-fi and 9 actual-site/fallback. Scene validation and sim 30 pass. Native terrain, 127,010.16m² of mapped water and all 2,012 independent in-tile buildings are unchanged; failed loading restores all 2,019 original map records and eviction frees geometry. Broad reproducibility and lock refresh remain batch work.

Rebuild: node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0511; node packages/worldgen/scripts/import-next-1000-models.mjs --ids=N0511; node packages/tooling/scripts/generate-landmark-lods.mjs --ids=N0511 --force.

Source: sha256:276ee0ca3eaac4103a20d201bb49d2979b9af668bd3765335d5f23b8da0ddd32

Runtime: sha256:e5e7dfca463fd0d2fc222114ca6e32d8c97ba2d3ece5b2033419d85aa5b60ceb

Input: sha256:a5a02393190ecb55749232b9dd757e9471460616ac7838dafe3489dcb4d62055

## Ordinary pictures

https://commons.wikimedia.org/wiki/File:Temple_of_Caesar.jpg — Wknight94; 2008-04-26 (description; EXIF differs); CC BY-SA3.0; viewed only. No pixels copied.

https://commons.wikimedia.org/wiki/File:RomaForoRomanoTempioDivoGiulio.JPG — MM (caption and upload history); 2005-05; Public domain per file page; viewed only. No pixels copied.
