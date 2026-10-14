# Dunnottar Castle — current model review

Reviewed 2026-10-13 using two inspected aerial pictures and standard viewer PMTiles/DEM.
**Accepted as a medium-fi exterior reconstruction**, with the limits below. `qa.json` binds
the decision to current source, runtime, inputs, placement and captures.

## Inspected result

All 49 current frames were inspected: 11 portable/source-terrain, 11 shared/geographic and
27 Earth-lighting/LOD views. Fourteen individual ruin polygons supply the eastern palace
wings, western L-shaped tower house, chapel, stables and gate/room shells. Roofless rooms,
surviving gables/chimney remnants, dividing lawn walls and the mapped basin remain distinct.
Three mapped court-path groups are drawn on the approximate raised platform.

Corrections include external stairs attached to the retained terrain, supports/reveals at the
inner stair cut, connected gate openings and removal of competing window rhythms at overlapping
map parts. Closed wall loops omit coincident internal end caps. Skyline simplifies the cliff
and omits minor gate/coastal/end rooms, paths and detailed stairs. District restores the selected
compound, sparse openings, paths and coarse flights; street/closeup restore windows, chimney
remnants and individual treads. The basin stays open across all four levels.

## Browser budgets and surfaces

| Level | Triangles | GLB bytes | Model draws |
| --- | ---: | ---: | ---: |
| Skyline | 774 | 77,664 | 1 |
| District | 3,837 | 320,768 | 5 |
| Street | 12,015 | 1,106,464 | 5 |
| Closeup | 14,200 | 1,315,200 | 5 |

The master has 14,200 triangles and occupies 1,707,212 bytes. Initial skyline + district
geometry totals **398,432 bytes**. All six GLBs pass Khronos validation with zero errors,
warnings or embedded images. Runtime position/normal streams are separate; CPU/GPU upload
accounting matches. Three existing 256² graphs supply weathered limestone, granite and gravel
with metric UVs/linear tints. Grass and basin water use vertex colors. Each graph loads once;
unloading leaves zero live model geometries. No unique bitmap was introduced.

## Placement and geometry

Fourteen mapped polygon transforms match the decoded extract. The exact-QID site enclosure,
basin and three court-path groups match retained source controls. Eighty-three raw-GLB probes
pass: 14 representative openings with 28 masonry guards, eight stair clearance/tread pairs,
11 roofless-room/floor pairs, basin clearance/water and outer stair attachment.

Native +X points east-northeast from the western gates toward the palace and sea; +Z points
south-southeast. Native Y=0 follows coarse standard DEM at the anchor (12.3751 m). Estimated
plateau Y=20 m fills the strongly smoothed headland. Inner entry flights rise 10–20 m; outer
mapped flights attach near native Y=2.33 m. No road suppression is registered. Source-terrain
views complement the flat geographic fixture; synthetic neighbors are review context.

## Reproduce

```sh
node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0323
node packages/worldgen/scripts/import-next-1000-models.mjs --ids=N0323
node packages/tooling/scripts/generate-landmark-lods.mjs --ids=N0323
node packages/worldgen-earth/scripts/register-landmark-previews.mjs --ids=N0323
node packages/worldgen/scripts/capture-next-1000-models.mjs --ids=N0323 --reflections --antialias --fit-shadows --force
node examples/world-explorer/test/visual/capture-landmark-library.mjs --ids=N0323 --reflections --adaptive-clipping --bounded-placement --force
node examples/world-explorer/test/visual/capture-medium-fi.mjs --ids=n0323_dunnottar_castle --reflections
```

The 1024×640 summary options are recorded in `capture-report.json`. Bulk views stay local in
ignored folders. Source inventory, recipe discovery, current hashes and four LOD bindings pass.
The generator's targeted `--check` reproduces the master. The scene validates and simulates
for 30 ticks with hash `sha256:e007a5e7136c83a2a915e04dde16995e463992b9f9fb362080eb98126ad69922`.

## Limits

All architectural heights are untagged estimates. Room-role correspondence, damaged profiles,
gables, chimneys, windows, court divisions, basin level, plateau/cliff geometry and entrance
levels/joins are picture-led approximations. Coarse DEM is not a cliff-top or bare-earth survey.
Complete interiors, vaults, full historical plans and certified walking collision are excluded.
Modern toilet, ocean, offshore rocks, mainland paths, town, trees, crowds and visitor fixtures
remain host content. Physical laptop and phone performance measurements remain pending.
