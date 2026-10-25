# temple_of_venus_and_roma — Temple of Venus and Roma

Reviewed 2026-10-19. Accepted for medium-fi present-day exterior and approximate standard-map fit. Built, inspected, corrected and completed in one continuous round.

![Temple of Venus and Roma](preview.png)

## Architecture

Inspected the current portable, shared-material, medium-fi and actual-site renders in this continuous round. Exposed east-facing Venus cella with a genuine concave brick apse, thick curved conch, diamond coffer relief, irregular roofless wall returns, broad precinct, 22 mapped surviving perimeter shafts, low bases and pale fragments. Corrected inward wall normals and sealed the conch spring-line ledge during authoring. The original whole-temple record is an archaeological boundary, not a solid shell to extrude. No intact ancient roof, pediment or full colonnade is reconstructed.

## Shared materials

Four reused 256² material graphs: long-format brick, travertine, granite and rammed earth. The latter supplies a low-frequency tinted stylized grass/soil surface on the precinct. Metric UVs, linear neutral tints, no embedded images or unique photo atlas. Each graph loads once; model draws stay at four and eviction releases geometry. Flat shared-material/context stages expose buried retaining foundations; they are not evidence of actual terrain grade. Actual-site captures use the unmodified standard terrain.

## Browser levels

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 852 | 89584 | 1 |
| district | 3420 | 347056 | 4 |
| street | 7728 | 779408 | 4 |
| closeup | 14228 | 1426104 | 4 |

All 25 required views inspected: noon/late light, Economy/High, street/block/skyline, untextured silhouette, four details, four explicit authored levels and transitions. Levels 852 / 3,420 / 7,728 / 14,228 triangles; initial geometry 436,640 bytes. Separate GPU streams avoid duplicate attribute uploads. The main concave apse, precinct and mapped shaft rows persist in the skyline; diamond coffers, capital profiles, fragments and damaged wall edges resolve closer. Physical-device and dense-city timings remain pending.

## Geographic fit

Q430792/relation1841091 identifies the precinct; the broad archaeological boundary is a platform extent rather than a solid temple shell. The pinned PMTiles cella35184503447863 and 22 individual perimeter columns plus the southern column-fragment cluster fix the exposed remains. Architecture+X points southeast toward the Colosseum, about20.58degrees from east in native east/south space. The ordinary east frontal photo resolves the open apse direction. Later church/museum footprints are excluded from the platform and replacement mask. Reused pinned temple_of_portunus standard PMTiles/Mapzen extract. The broad precinct uses a flat visualization datum just above the sampled perimeter; retaining foundations extend below the unmodified native ground. Later independent building footprints are subtracted from the platform. No ground or water cutout; exact archaeological pavement elevation is not surveyed. The pinned main temple and Antiquarium polygons overlap by about 0.032m². The replacement mask excludes the museum with a0.1mm numerical margin; a tiny native temple seam remains inside/along the museum wall. Preserve that shared seam rather than clip the independent museum. This is map-overlap handling, not an inferred archaeological wall boundary. Reused pinned temple_of_portunus standard PMTiles/Mapzen extract. The broad precinct uses a flat visualization datum just above the sampled perimeter; retaining foundations extend below the unmodified native ground. Later independent building footprints are subtracted from the platform. No ground or water cutout; exact archaeological pavement elevation is not surveyed. All 1,634 independent in-tile buildings are unchanged after excluding the museum from the replacement mask. The original main temple and museum footprints overlap by about 0.032m²; the corrected mask preserves the independent museum and leaves 0.03264347m² of native temple geometry at that shared seam, within/along the museum wall. Other temple/column records are replaced to sub-1e-7m² numerical boundary remnants. Native terrain and 3,021.82m² water remain unchanged. Failed loading restores all 1,658 original records; eviction frees geometry.

## Scope and limits

Accepted as a medium-fi present-day exposed temple exterior with approximate standard-map fit. Later church, bell tower, monastery and Antiquarium remain independent procedural context; they are not authenticated reconstructions in this asset. The museum-covered western Roma cella is not opened or claimed as a navigable/exposed interior. Exact floor/height levels, niches, damage, coffers, shaft restorations and individual fragments are visualization estimates. Four shared material graphs approximate brick, pale stone and stylized ground cover. The tiny native overlap seam is intentionally retained to preserve the museum. No intact ancient roof or complete historical temple is invented.

## Checks

Two registered recipes rebuild the 1,710,304-byte master. Six Khronos files: zero errors/warnings. 2,682 platform/conch/roofless-cella probes pass. Inspected 52 current views:9 portable, 9 shared, 25 medium-fi and 9 actual-site/fallback. Scene validation and sim 30 pass. Broad source reproducibility and lock refresh remain at the planned batch milestone near 525 complete. The prior templo_mayor renderer release gate remains pending that refresh.

Rebuild: node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=temple_of_venus_and_roma; node packages/worldgen/scripts/import-structure-models.mjs --ids=temple_of_venus_and_roma; node packages/tooling/scripts/generate-landmark-lods.mjs --ids=temple_of_venus_and_roma --force.

Source: sha256:b15565fc8477201307451ba0e2710987abb300348d085d25e78c881dff0245b4

Runtime: sha256:6c809ba950cfbed271e88a902477ae221e9c714de0a09ba2965c78061fe04469

Input: sha256:8d720eef7bbb0211bf8d3e7f1fc079c8700ca82851599d53c61e3b4e6f19b0ea

## Ordinary pictures

https://commons.wikimedia.org/wiki/File:Rome_-_Temple_of_Venus_and_Rome_(5178790722).jpg — Dennis G. Jarvis; 2010-10-10; CC BY-SA2.0; viewed only. No pixels copied.

https://commons.wikimedia.org/wiki/File:Tempio_di_Venere_e_Roma_-_abside_-_antmoose.jpg — Anthony Majanlahti; 2005-08-23; CC BY2.0; viewed only. No pixels copied.
