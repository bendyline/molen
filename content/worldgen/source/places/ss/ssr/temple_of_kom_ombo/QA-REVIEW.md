# temple_of_kom_ombo — Temple of Kom Ombo

Reviewed 2026-10-19. Accepted for medium-fi present-day exterior and approximate standard-map fit. Built, inspected, corrected and completed in one continuous round.

![Temple of Kom Ombo](preview.png)

## Architecture

Inspected the current source, shared-material, medium-fi and actual-site renders in this continuous round. Southwest-facing double temple: stepped approach, broken forecourt shafts, paired entrance axes and low screens, broad floral/papyrus capitals, surviving stone beams/cavetto cornices with attached winged discs, narrower inner hall, paired roofless rear chambers, mapped enclosure/ancillary remnants and shallow well mouth. The forecourt datum was raised after native-grid probes exposed terrain penetration; retaining foundations, open axial passages and partial roof coverage are checked together with the model. No intact pylon or complete ancient roof is invented.

## Shared materials

Three reused 256² graphs: raw sandstone, coursed sandstone and gravel. Metric UVs, linear grey-beige sandstone tints, no embedded images or unique atlas. Each graph loads once, at most three model draws, and eviction releases geometry. Floral silhouettes, broad cornice bands and winged discs carry recognition; fine hieroglyphs and carved narrative inventories are omitted. Flat shared/context stages expose buried retaining foundations and are not evidence of native terrain grade. The actual-site fixture supplies the unmodified standard terrain.

## Browser levels

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 988 | 103180 | 1 |
| district | 3468 | 342256 | 3 |
| street | 6952 | 693368 | 3 |
| closeup | 10232 | 1019084 | 3 |

All 25 required medium-fi views inspected: noon/late light, Economy/High, street/block/skyline, untextured silhouette, four details, four authored levels and transitions. Levels 988 / 3,468 / 6,952 / 10,232 triangles. Initial geometry is 445,436 bytes. Separate GPU streams prevent duplicated attribute uploads. The principal hypostyle group, narrowing footprint, double axis and enclosure remnants persist at distance; capitals, partial roof slabs, relief discs and small fragments resolve nearer. Physical-device and dense-city timings remain pending.

## Geographic fit

Q1243401/way90446374 identifies the ruin precinct rather than a solid modern building. The standard map supplies the stepped main-hall footprint, two large L-shaped enclosure strips, seven small ancillary remnants, a west detached ruin and the circular well. Internal+U runs northeast; the paired main front faces southwest toward the river. The low front, broad main hall and narrowing rear arrangement follow the mapped vertices. The Crocodile Museum and small later kiosk remain independent, with a0.1mm numerical margin at shared mask edges. Pinned small standard2026-10-14 PMTiles/Mapzen extract. Main and forecourt decks use separate visualization datums above the local coarse grid, with retaining foundations and a stepped transition. Enclosure remnants follow the standard native grade. Ground and Nile water stay native, with no ground/water cutout. The well is a shallow sealed mouth/basin above the native grade rather than a claim to its surveyed underground shaft. Pinned small standard2026-10-14 PMTiles/Mapzen extract. Main and forecourt decks use separate visualization datums above the local coarse grid, with retaining foundations and a stepped transition. Enclosure remnants follow the standard native grade. Ground and Nile water stay native, with no ground/water cutout. The well is a shallow sealed mouth/basin above the native grade rather than a claim to its surveyed underground shaft. Both independent in-tile buildings, including the Crocodile Museum and later kiosk, remain unchanged. Thirteen authored map records are replaced; a 0.00069323m² native enclosure seam remains at the protected kiosk boundary, and other remnants are below 1e-7m². Original terrain and the fixture’s native Nile geometry remain unchanged. Failed loading restores all 15 original map records and eviction frees model geometry.

## Scope and limits

Accepted as a medium-fi surviving exterior and approximate standard-map placement. Heights, number/location of secondary columns, partitions, individual floral capitals, missing roof edges, damage and fragments are photo/map-led visualization estimates. No detailed inscriptions or exact stone inventory are claimed. The well is a shallow sealed mouth/basin treatment above the standard ground, not a reconstruction of its underground shaft. The museum and kiosk stay independent procedural context. Source photographs include night lighting and older views; illumination is not baked into materials. No intact ancient temple or navigable interior is claimed.

## Checks

Two registered recipes rebuild the 1,230,296-byte master. Six Khronos files: zero errors/warnings. 3,024 deck/paired-axis/shrine/well probes pass. Inspected 52 current views:9 portable, 9 shared, 25 medium-fi and 9 actual-site/fallback. Scene validation and sim 30 pass. Broad source reproducibility and lock refresh remain at the planned batch milestone near 525 complete. The prior templo_mayor renderer release gate remains pending that refresh.

Rebuild: node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=temple_of_kom_ombo; node packages/worldgen/scripts/import-structure-models.mjs --ids=temple_of_kom_ombo; node packages/tooling/scripts/generate-landmark-lods.mjs --ids=temple_of_kom_ombo --force.

Source: sha256:0a7c11cb4e7ae96145d9ea50e8e8a74bf6b21abb3561aa8a1bb4e8aabd749604

Runtime: sha256:2913fd6dbd4d44ea6fbe3c4400846d162375028399b6df9f08a6be239e9147bf

Input: sha256:5893ef57a690cf70642ab906920320a75e4f47439510b77a8fefc606f01a0968

## Ordinary pictures

https://commons.wikimedia.org/wiki/File:The_Temple_at_Kom_Ombo_(I).jpg — Iris Fernandez / AWIB-ISAW; 2009-02-28; CC BY2.0; viewed only. No pixels copied.

https://commons.wikimedia.org/wiki/File:KomOmboToSE.jpg — Roland Unger; 2001-08-18; GFDL and Creative Commons options per file page; viewed only. No pixels copied.

https://commons.wikimedia.org/wiki/File:Kom-ombo.jpg — Franck Monnier; 2001-08-01; CC BY-SA3.0 licensing section; viewed only. No pixels copied.
