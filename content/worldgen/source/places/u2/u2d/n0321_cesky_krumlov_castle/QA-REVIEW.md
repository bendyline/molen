# Český Krumlov Castle — current model review

Reviewed 2026-10-13 against two inspected exterior pictures, standard viewer PMTiles and the
retained Mapzen/USGS DEM. **Accepted as a medium-fi exterior reconstruction**, with the limits
below. `qa.json` binds this decision to current source, runtime, inputs, placement and captures.

## Inspected result

All 49 current frames were inspected: 11 portable/source-terrain views, 11 shared-material and
geographic views, and 27 Earth-lighting/LOD views. The upper palace retains both mapped open
courtyards; the lower Hrádek retains its courtyard and decorated round tower. The tower has
colored masonry/pilaster bands, a real open arcade, two flared copper roofs and a lantern.
Selected castle service ranges follow their individual plans. The western theater, elevated
gallery and stacked Cloak Bridge remain separate, with an open ravine beneath the bridge.

Corrections made during review: bridge windows now face outward; bridge supports continue to
the covered corridor and its upper deck joins are filled. Foundations already supplied by the
courtyard terraces were removed. The skyline originally lost much of the paved first court:
sequential outline simplification now happens after clipping the two independent terraces.
The paved court persists across all four levels. Skyline uses simpler oriented service-range
envelopes and omits minor service footprints below 250 m²; district restores all selected
components and a simpler open tower arcade. Street and closeup add frames, masonry bands,
full arcade reveals and selected chimneys. The authoring master preserves the selected plans.

## Browser budgets and surfaces

| Level | Triangles | GLB bytes | Model draws |
| --- | ---: | ---: | ---: |
| Skyline | 966 | 101,352 | 1 |
| District | 3,973 | 381,720 | 6 |
| Street | 12,864 | 1,257,696 | 6 |
| Closeup | 13,792 | 1,351,188 | 6 |

The master has 13,792 triangles and occupies 1,658,816 bytes. Initial skyline + district
geometry totals **483,072 bytes**. All six GLBs pass Khronos validation with zero errors,
warnings or embedded images. Runtime position/normal buffers are separate and CPU/GPU upload
accounting matches. Five existing 256² graphs supply lime plaster, weathered limestone,
ceramic tile, slate and painted metal. Glass uses vertex color. Each graph loads once;
unloading leaves zero live model geometries. No unique photo or bitmap was introduced.

## Geometry and placement checks

All 57 selected PMTiles polygon transforms match the decoded standard extract. Twenty arch
passages are open: 16 tower-gallery bays and four bridge arches, with 40 adjacent/overhead
masonry guards. Six courtyard probes verify three open wells and their retained floors.
Mapped overall heights are retained: 54.5 m tower, 23 m upper palace, 11 m theater and tagged
5–14 m service ranges. Untagged ranges use conservative exterior estimates.

The actual named Cloak Bridge and western elevated corridor paths pass the viewer's bridge
suppression rule. A separate mapped lower-castle crossing remains host content; unrelated
ground-path, tunnel and parallel-bridge guards also remain. The signed native frame points +X
east-northeast toward the lower castle/tower and +Z south-southeast toward the river-facing
facades. Native Y=0 follows the retained standard DEM at the anchor (497.6021 m).

## Reproduce and inspect

```sh
node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0321
node packages/worldgen/scripts/import-next-1000-models.mjs --ids=N0321
node packages/tooling/scripts/generate-landmark-lods.mjs --ids=N0321
node packages/worldgen-earth/scripts/register-landmark-previews.mjs --ids=N0321
node packages/worldgen/scripts/capture-next-1000-models.mjs --ids=N0321 --reflections --antialias --fit-shadows --force
node examples/world-explorer/test/visual/capture-landmark-library.mjs --ids=N0321 --reflections --adaptive-clipping --bounded-placement --force
node examples/world-explorer/test/visual/capture-medium-fi.mjs --ids=n0321_cesky_krumlov_castle --reflections
```

The curated `preview.png` is a 1024×640 Molen scene render; complete `screenshotScene` options
are recorded in `capture-report.json`. Bulk captures remain local in ignored `shots/` and
`medium-fi/` folders. Source inventory, current hashes and LOD bindings were checked. The
preview scene validates and simulates for 30 ticks with state hash
`sha256:f475fea4c854d950d1f316686c154a3b4234e55ef36d84686261eb7d661792ce`.

## Approximation limits

The retained enclosure and selected component plans establish approximate exterior fit.
Nearby town polygons and overlapping building-part overlays are excluded. Tower decoration
uses sparse shared-material/palette bands instead of exact fresco imagery. Roof profiles,
window rhythm, untagged heights, lower/upper/theater court levels (0/3/15 m), foundations,
bridge stories, arch geometry, western-gallery supports and approach joins are estimates.
Other site crossings remain host-generated content. Gardens, village, site trees, detailed
interiors, exhibits and certified walking collision are excluded.

Coarse DEM is not a bare-earth survey. Source-terrain views complement the flat geographic
fixture; synthetic Bohemian townhouse neighbors and pale terrain bands are review context,
not real site materials or neighbor accuracy. Physical laptop and phone measurements remain
pending.
