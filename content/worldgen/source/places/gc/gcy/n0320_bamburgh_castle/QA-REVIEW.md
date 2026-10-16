# Bamburgh Castle — current model review

Reviewed 2026-10-13 against two inspected exterior photographs, standard viewer PMTiles and
the retained Mapzen/USGS DEM. **Accepted as a medium-fi exterior reconstruction**, with the
limits below. `qa.json` binds this decision to current source, runtime, input, placement and
render-report hashes.

## Inspected result

All 49 current frames were inspected: 11 portable/source-terrain views, 11 shared-material and
geographic views, and 27 Earth-lighting/LOD views. The square keep with four corner crowns,
long slate-roofed palace, unequal eastern hall towers and rounded return, separate north
curtain, lower west gate, open stepped courts and small western windmill are individually
authored. Seven mapped polygons retain their separate identities; the two pieces of the
curtain/gate MultiPolygon are never joined into one mass.

Corrections made during review: facade masonry now stops above distinct sloped rock skirts,
rather than extending down the full cliff. The keep roof replaces an overlapping cap. The
lower entrance cuts through the terrace and meets a landing with real stair treads. Upper
and eastern passages cut through the full wall thickness. An overlapping curtain segment
and duplicate landward ramp walls were removed after close renders exposed blocked views.
Four passage probes pass, with eight adjacent/overhead masonry guards. District crowns on
curved or irregular plans use simpler continuous caps to retain the browser budget.

## Browser budgets and surfaces

| Level | Triangles | GLB bytes | Model draws |
| --- | ---: | ---: | ---: |
| Skyline | 939 | 96,348 | 1 |
| District | 3,670 | 353,232 | 6 |
| Street | 9,199 | 906,580 | 7 |
| Closeup | 9,959 | 976,192 | 7 |

The source master has 9,959 triangles and occupies 1,199,204 bytes. Initial skyline + district
geometry totals **449,580 bytes**. All six GLBs pass Khronos validation with zero errors,
warnings or embedded images. LOD position and normal buffers are separate; CPU/GPU upload
accounting matches. Five existing 256² shared graphs supply sandstone, weathered limestone,
slate, painted metal and lime plaster. Glass and lawn use vertex colors. Each graph loads
once; unloading leaves zero live model geometries. No unique texture was introduced.

## Reproduce and inspect

```sh
node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0320
node packages/worldgen/scripts/import-next-1000-models.mjs --ids=N0320
node packages/tooling/scripts/generate-landmark-lods.mjs --ids=N0320
node packages/worldgen-earth/scripts/register-landmark-previews.mjs --ids=N0320
node packages/worldgen/scripts/capture-next-1000-models.mjs --ids=N0320 --reflections --antialias --fit-shadows --force
node examples/world-explorer/test/visual/capture-landmark-library.mjs --ids=N0320 --reflections --adaptive-clipping --bounded-placement --force
node examples/world-explorer/test/visual/capture-medium-fi.mjs --ids=n0320_bamburgh_castle --reflections
```

The small curated `preview.png` uses `screenshotScene`; its complete options are recorded in
`capture-report.json` under `summaryPreview`. Bulk images remain in ignored local `shots/`
and `medium-fi/` folders. Source inventory, current hashes, six GLBs, seven map transforms,
four LOD budgets and twelve entrance/guard probes were checked. The preview scene validates
and simulates for 30 ticks with state hash
`sha256:2d551d230831199ac5a80bb7f73b06ab70e88cd1eae6227d1c9113959517b434`.

## Approximation limits

The retained exact-QID enclosure and seven current PMTiles component polygons establish
approximate exterior horizontal fit and signed facing. Native +X runs southeast along the
castle; +Z faces southwest toward the village and palace frontage. Component heights are
untagged: keep height, palace/roof profiles, window rhythm and gate openings are picture-led
estimates. Native Y=0 follows the standard viewer DEM at the mapped anchor (41.1229 m);
inner court Y=6.5 m, western bailey, foundations, rock skirts, paths and gate joins remain
approximate. Coarse terrain is not a bare-earth survey or certified navigable surface.

The flat geographic fixture hides lower western geometry, including the windmill; the
source-terrain and Earth-lighting views show the full compound. This fixture proves model
loading and signed transforms, not real terrain contact. Synthetic terrace neighbors and
pale terrain bands are review context, not site materials or real neighboring buildings.
Village, dunes, separate southwest building, complete interiors, historical windmill sails
and certified walkable collision are excluded. Physical laptop and phone measurements remain
pending.
