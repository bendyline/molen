# N0548 — Temple of Romulus

Reviewed 2026-10-19 in one continuous author/build/inspect/fix round.

![Temple of Romulus](preview.png)

## Appearance

Inspected48 current source/shared/medium-fi/native/fallback views during the same construction round. Specific standing Romulus exterior: round weathered brick/lime body, shallow concentric tiled roof rings, eight arched lantern windows and gray metal dome/finial. Projecting pale nested portal/entablature, original simplified leafy capitals on smooth purple shafts, static closed green bronze paired leaves with recessed panels/studs/ring fitting. Concave lower wings have actual blind arched niches; two standing right-hand columns and broken left bases remain distinct. Initial renders prompted moving partly buried purple columns forward and replacing regular plaster stripes with broad irregular fields; adapted shared Corinthian capitals to smooth photographed shafts. No hidden ritual interior or complete restoration of lost front colonnades.

## Shared materials and browser levels

Six existing256-square graphs: brick_longformat, plaster_lime, stone_limestone_raw (pale trim and purple shaft tints), tile_ceramic, metal_painted (cap and dark inset roles), metal_bronze_cast. Eight authored roles merge to at most six runtime draws. Each graph read once, metric UVs and linear tints; zero embedded images. Separate GPU streams and matching CPU/GPU accounting. LODs990/3212/9448/11088triangles; initial400828bytes, optional close-up1070784bytes. Eviction releases model geometry.

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 990 | 105296 | 1 |
| district | 3212 | 295532 | 6 |
| street | 9448 | 915564 | 6 |
| closeup | 11088 | 1070784 | 6 |

Inspected current noon/late/economy/high, street/block/skyline context, silhouette, all four levels/transitions and three combined detail angles. Skyline keeps round body, roof steps/lantern, portal/green leaves, curved wings, standing/broken columns and short stair. District restores window/niche depth and denser faceting; street/close restore smooth tapered shafts, original leafy capitals, finer frame/panel/stud/handle detail, plaster fields and metal roof seams. Skyline omits plaster patches and detailed ornament; the recognizable shape remains. Native/terrain and flat shared-stage contact differ slightly; current source/native views and mesh probes establish local footing/stair contact. Dark lantern insets sit behind actual apertures at district and nearer. Procedural office-like church/hall facades, paths, green ground and surrounding water are host context.

## Approximate map fit

Exact-QID relation1841089/Q338397 correlates parent52776559974337, dome35184503447773 and lantern35184503447753. Parent23.3x17.7m outline/two front holes control extent. Anchor12.487210858,41.891868949; heading0; internal cross-axis+.419392559901rad, portal faces southwest/local+z. Replace only those three controls with2cm numeric pad and subtract independent church/hall envelopes+1mm. All2056 independent resident inputs, including church52776559959379 and halls52776559974416/52776559974418, remain unchanged. Parent residual0.007717618924m2 is wholly inside independent envelopes+1.1mm, outside area0; roof-part residuals0. Loaded levels2057 records including protected fragment; failed load2059 full originals. Original6m ground, paths and3971.984898m2 native water retained. Occupied round/stair/threshold and narrow wing/column footings only, bases buried; mapped front holes open to native ground. No broad Forum slab, flattening or ground/water cutout. Unload restores ground/water and frees geometry.

## Limits

Accepted medium-fi from two inspected ordinary pictures:2008 whole high-front exterior and2005 closed-door detail, plus standard PMTiles/Mapzen. Carried the initial picture/map brief into this construction round without restarting research. Current exterior profile/height, capital/repair inventory, peripheral column positions, carving and absolute levels remain approximate. Nominal24m mapped dome height is retained as a source fact; authored roughly19m floor-to-finial profile follows pictured proportions against the27m mapped church, not a surveyed threshold-relative height. Static closed bronze leaves follow the2005 detail;2008 picture shows an open state. Original simplified leaf/frame ornament, no copied sculpture, text, painting or photo atlas. No hidden ritual interior, church reconstruction or precise excavated paving/threshold claims. Physical-device/dense-city timings remain pending.

## Selected checks

Six Khronos files: zero errors/warnings.188 actual mesh/map-envelope probes; 48 current inspected views. Scene validation/sim30 and strict selected medium-fi audit pass. Source and runtime hashes/material bindings/LOD caps verified.

Rebuild: node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0548; node packages/worldgen/scripts/import-next-1000-models.mjs --ids=N0548; node packages/tooling/scripts/generate-landmark-lods.mjs --ids=N0548 --force.

Source: sha256:77a6a56e216b285ccbbcefb76361bb8b7970b3f0fb9d0e68dd0273aad2f775f5

Runtime: sha256:ee970d7fbdecb28037f34a8845238aefbad235a4193a1203b6ec1134487242b3

Input: sha256:90dcfdf173e0a75545aef591cee2a47ff7bf4f1cbad661e2e34053dc29a761b9

## Viewed ordinary pictures

https://commons.wikimedia.org/wiki/File:4309_-_Roma_-_Fori_-_Tempio_di_Romolo_-_Foto_Giovanni_Dall%27Orto_-_17-Mar-2008.jpg — Giovanni Dall'Orto; Attribution; permission for any purpose, redistribution and derivative work. Viewed only; no pixels copied.

https://commons.wikimedia.org/wiki/File:Temple_of_Romulus_-_Ancient_doors.JPG — Joris; CC-BY-SA-3.0. Viewed only; no pixels copied.
