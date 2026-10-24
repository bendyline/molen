# Linlithgow Palace — current model review

Reviewed 2026-10-13 against two inspected courtyard/exterior photographs and standard viewer
PMTiles/DEM. **Accepted as a medium-fi exterior reconstruction**, with the limits below.
`qa.json` binds the review to current source, runtime, inputs, placement and captures.

## Inspected result

All 49 current frames were inspected: 11 portable/source-terrain, 11 shared-material/geographic
and 27 Earth-lighting/LOD views. The palace retains its mapped open courtyard, five unequal
hollow stair towers, four corner gable pairs, selected roofless room partitions, south/east
entrance passages and central tiered fountain. No restored roof closes the ruined ranges.

Corrections include gable coping that follows its slope, supported interior gable walls and
removal of court-wall sections overlapping the independently authored stairs. The initial
blocked stair slits and well were corrected. Only courtyard-facing stair slits are authored.
Skyline keeps the upper hollow stair crowns and a simple fountain; district restores full
stair depth and sparse windows. Street and closeup add the window rhythm, coping, room
remnants and simplified fountain/door decoration. Distant triangle budgets were corrected.

## Browser budgets and shared surfaces

| Level | Triangles | GLB bytes | Model draws |
| --- | ---: | ---: | ---: |
| Skyline | 974 | 95,700 | 1 |
| District | 3,976 | 348,760 | 3 |
| Street | 12,170 | 1,045,080 | 3 |
| Closeup | 17,957 | 1,526,568 | 3 |

The master has 17,957 triangles and occupies 2,157,212 bytes. Initial skyline + district
geometry totals **444,460 bytes**. All six GLBs pass Khronos validation with zero errors,
warnings or embedded images. Runtime position/normal streams are separate and CPU/GPU upload
accounting matches. Two existing 256² graphs supply sandstone and weathered limestone using
linear tints and metric UVs; fountain water uses vertex color. Each graph loads once and
unloading leaves zero live model geometries. No unique bitmap was introduced.

## Geometry and geographic fit

Nine current palace/part polygon transforms match the decoded PMTiles extract, including the
main courtyard hole. The mapped fountain fixes its position; the actual south/east tunnel
controls the entrance alignment. Seventy-seven raw-GLB probes pass: 13 representative gates,
facade windows and stair slits with 26 masonry guards, 25 rays through five stair wells,
six courtyard/floor checks and seven roofless-room checks. No road suppression is registered;
the tunnel, site paths, adjacent church and separate eastern mapped building remain host content.

Native +X points south toward the entrance and +Z west. Native Y=0 follows retained standard
DEM at the anchor (51.3701 m); courtyard Y=3.9 m clears the coarse southern approach and
the northern foundations extend into the slope. Source-terrain views complement the flat
geographic fixture. Synthetic English terrace neighbors and pale terrain bands are review context.

## Reproduce

```sh
node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=linlithgow_palace
node packages/worldgen/scripts/import-structure-models.mjs --ids=linlithgow_palace
node packages/tooling/scripts/generate-landmark-lods.mjs --ids=linlithgow_palace
node packages/worldgen-earth/scripts/register-landmark-previews.mjs --ids=linlithgow_palace
node packages/worldgen/scripts/capture-structure-models.mjs --ids=linlithgow_palace --reflections --antialias --fit-shadows --force
node examples/world-explorer/test/visual/capture-landmark-library.mjs --ids=linlithgow_palace --reflections --adaptive-clipping --bounded-placement --force
node examples/world-explorer/test/visual/capture-medium-fi.mjs --ids=linlithgow_palace --reflections
```

The 1024×640 summary's complete render options are in `capture-report.json`. Bulk views remain
local in ignored folders. The authoring index was refreshed after capture; the unchanged six
GLB hashes, all inspected image hashes and deterministic source `--check` justify binding those
pixels to the complete recipe inventory, explicitly recorded in both affected capture reports.
Source inventory, current hashes and four LOD bindings pass. The scene validates and simulates
for 30 ticks with hash `sha256:fad6bd9068cc18f43381bd4ae1506e0f28552ab1e10e37b1fa7b80756c9ca8d9`.

## Limits

All architectural heights are untagged estimates. Room/stair plans, damaged profiles, window
rhythm, floor remnants, fountain water/sculpture, door heraldry, wall walks and terrain/approach
joins are approximate exterior interpretations. This is not a surveyed reconstruction or a
certified walking surface. Complete interiors, church, town, park, trees, crowds and visitor
fixtures are excluded. Physical laptop and phone performance measurements remain pending.
