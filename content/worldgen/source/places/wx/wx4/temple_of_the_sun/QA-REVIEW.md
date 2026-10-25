# temple_of_the_sun — Temple of the Sun

Reviewed 2026-10-19 in one continuous author/build/inspect/fix round.

![Temple of the Sun](preview.png)

## Appearance

Inspected48 current source/shared/medium-fi/native/fallback views in the same construction round. Specific Ritan ritual core: low roofless gray altar with pale coping/corner strips, four straight stair flights and solid splayed stone cheeks; circular low red wall with green tiled coping; three open west stone portals and closed red leaves on the other three cardinal gates. Original simplified pointed finials/lintel registers/scroll ends, no copied sculpture or text. Initial skyline exceeded its cap; merged distant lintel bands and simplified finials while retaining the curve with four segments per quadrant. Current close-up geometry5640triangles and all staircase openings/contact checks pass. No roofed central shrine or invented altar balustrade.

## Shared materials and browser levels

Five existing256-square graphs: stone_ashlar, stone_limestone_raw, plaster_lime, tile_ceramic and wood_plain. Each is read once, metric UVs and linear tints, zero embedded images. Master5640triangles/680196bytes. Four levels940/2452/4552/5640triangles;100208/256780/469416/588848bytes, initial356988bytes, at most five draws. Separate GPU streams and matching CPU/GPU accounting; eviction releases model geometry.

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 940 | 100208 | 1 |
| district | 2452 | 256780 | 5 |
| street | 4552 | 469416 | 5 |
| closeup | 5640 | 588848 | 5 |

Inspected current noon/late/economy/high context, silhouette, all four levels/transitions and three detail angles. Skyline retains the altar/four broader stair flights, circular enclosure, three open west passages and closed other gates; district restores nine stair rises/molded piers/finials, street/close-up add coping ribs/studs. Consistent palette through upgrades. Flat shared stage at anchor datum can bury the negative-offset north gate and expose higher southern footings; source/native/medium-fi terrain-bearing views establish intended contact. Synthetic context does not reproduce the whole park. Native fixture uses ordinary park ground/paths/water; the photographed paved courtyard remains a host landcover surface, not an authored broad slab.

## Approximate map fit

Named Altar of the Sun POI35184495982750 and central platform35185801754351 correlateQ964720. Actual four platform corners fix15.8434x16.7744m envelope, native center[1.891951470026,-6.183890072934] and two explicit slightly skewed near-cardinal axis vectors. Circular pedestrian boundary35184495982750 and four approaches35185801754350 support radius37.3m/layout. Anchor116.438111111,39.914416666, heading0; west triple gates face west. Gate foundations/details remain approximate with roughly3m/5degree uncertainty; no exact-QID footprint/surveyed-facing claim. Only central platform shell replaced with2cm numeric tolerance, zero residual. All182 independent resident inputs, original6m terrain/paths and3994.032075393945m2 of native water retained. Loaded182/failure183 original building records; unload restores surfaces/frees geometry. No native ground/water cutout or flattening.

## Limits

Accepted medium-fi pictured2009/2012 ritual-core state from two inspected ordinary photographs plus standard PMTiles/Mapzen; brief carried through construction/inspection, no bespoke research campaign. This asset covers altar/enclosure/gates. Other park pavilions, northwest auxiliary halls, Sun Worship mural and landscaping remain separate host context, not claimed authored. Gate dimensions/open-closed assignments, repeated details and heights/absolute thresholds are picture/map estimates. Coarse DEM varies by several meters across the court and cannot resolve archaeological paving. Flat stages can expose or bury individual footings; terrain-bearing views and actual geometry probes establish contact. Whole-court paving stays host landcover. Physical-device/dense-city timings remain pending.

## Selected checks

Six Khronos files: zero errors/warnings.276 actual mesh/contact probes; 48 current inspected views. Scene validation/sim30 and strict selected medium-fi audit pass. Source and runtime hashes/material bindings/LOD caps verified.

Rebuild: node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=temple_of_the_sun; node packages/worldgen/scripts/import-structure-models.mjs --ids=temple_of_the_sun; node packages/tooling/scripts/generate-landmark-lods.mjs --ids=temple_of_the_sun --force.

Source: sha256:5e543af225b608803b28687b1de08203c450d326f928c32fa6bbde9f7cee018f

Runtime: sha256:4658183a077844bca59b4d4f5bd5881372885eeffed3b3e38ae94f03d62da5a2

Input: sha256:2a6f026b933d314acac557f39e65a173da4de0893d7a5015f55007efffc0588c

## Viewed ordinary pictures

https://commons.wikimedia.org/wiki/File:Sonnenaltar.jpg — Naplee12; CC-BY-SA-3.0 / GFDL. Viewed only; no pixels copied.

https://commons.wikimedia.org/wiki/File:%E7%A5%AD%E6%97%A5%E5%8F%B0_-_Altar_of_the_Sun_-_2012.04_-_panoramio.jpg — rheins; CC-BY-3.0. Viewed only; no pixels copied.
