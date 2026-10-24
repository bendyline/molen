# Moritzburg Castle — current model review

Reviewed 2026-10-13 against two exterior photographs, standard viewer PMTiles and the retained
Mapzen/USGS DEM. **Accepted as a medium-fi exterior reconstruction**, with the limits below.
`qa.json` binds this decision to current source, runtime, input, placement and render-report hashes.

## Inspected result

All 49 current frames were inspected: 11 portable/source-terrain views, 11 shared-material and
geographic views, and 27 Earth-lighting/LOD views. The four red dome towers and lanterns,
connected pale palace ranges, projecting east block and separate west chapel spire read across
the levels. Terrace cut-outs contain stair treads; two axial ramps descend to the island.
Eight mapped pavilions form four approach pairs. Only the two short mapped bridge gaps are
modeled; land causeways and lake remain host content.

Corrections made during review: the park landuse polygon describes grass areas, so a complete
rectangular island retaining perimeter was estimated against the photographs and mapped
pavilions. The retained park polygon remains a separate control. Stair treads replaced sloping
caps. A hidden island cap was removed after its overlap caused distant lawn flicker. Native axes
were rotated to align bridge replacement with the actual north/south paths while preserving
all geographic component positions. Both bridge segments pass actual viewer road suppression;
unrelated bridge, ground-path and tunnel guards remain.

## Browser budgets and surfaces

| Level | Triangles | GLB bytes | Model draws |
| --- | ---: | ---: | ---: |
| Skyline | 901 | 94,692 | 1 |
| District | 3,111 | 293,096 | 7 |
| Street | 10,875 | 973,736 | 7 |
| Closeup | 14,567 | 1,297,832 | 7 |

The source master has 15,424 triangles and occupies 1,854,940 bytes. Initial skyline + district
geometry totals **387,788 bytes**. All six GLBs pass Khronos validation with zero errors,
warnings or embedded images. LOD position and normal buffers are separate; CPU/GPU upload
accounting matches. Five existing 256² material graphs are shared: plaster, ceramic tile,
sandstone, slate and painted metal. Glass and lawn use vertex colors. Shared graphs load once;
unloading leaves zero live model geometries. No new unique texture was introduced.

## Reproduce and inspect

```sh
node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=moritzburg_castle
node packages/worldgen/scripts/import-structure-models.mjs --ids=moritzburg_castle
node packages/tooling/scripts/generate-landmark-lods.mjs --ids=moritzburg_castle
node packages/worldgen-earth/scripts/register-landmark-previews.mjs --ids=moritzburg_castle
node packages/worldgen/scripts/capture-structure-models.mjs --ids=moritzburg_castle --reflections --antialias --fit-shadows --force
node examples/world-explorer/test/visual/capture-landmark-library.mjs --ids=moritzburg_castle --reflections --adaptive-clipping --bounded-placement --force
node examples/world-explorer/test/visual/capture-medium-fi.mjs --ids=moritzburg_castle --reflections
```

The small curated `preview.png` uses `screenshotScene` with the complete reproducible options
recorded in `capture-report.json` under `summaryPreview`. Bulk images remain in ignored local
`shots/` and `medium-fi/` folders. Only this summary image, concise reports and source inputs
belong in Git; no screenshot archive publication or review-lock update is needed.

## Approximation limits

The exact-QID 0.8 m plan is a low building part, not the palace height. Current mapped components
and all 25 coordinate transforms establish approximate plan and facing; eaves, dome profiles,
window/dormer rhythm, stair geometry, retaining edge and bridge engineering are photo-led
estimates. Coarse DEM and water-level joins are approximate. Flat geographic and synthetic
neighbor fixtures do not prove real terrain or neighbor accuracy. Trees, off-island gardens,
complete interiors and certified walkable collision are excluded. Physical laptop and phone
frame-rate measurements remain pending.
