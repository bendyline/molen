# N0367 — Freiburg Minster review

Reviewed 2026-10-15 against current source/runtime bytes. Accepted for the medium-fi exterior and approximate geographic/terrain scope.

![Molen summary preview](preview.png)

## Built result

Inspected all11 current portable/source-terrain frames. Freiburg Minster has a single stepped west tower, recessed pointed entrance with nested surrounds/dark vaulted backing and lower wood door, geometric clocks, open octagonal belfry and porous stone lattice spire. Long tiled nave, higher polygonal eastern choir/chapel ring, twin smaller cock turrets, large pointed aisle fields, clerestory glazing and flying buttresses retain the individual exterior. Distinct Romanesque transept has geometric rose/three rounded lower windows over a low Renaissance arcade. Added stepped front buttresses and thicker stone lattice members after the first renders; corrected the blue entrance backing to an opaque dark cavity. Fine sculpture, exact tracery/stained glass, temporary scaffold/market stalls and surrounding town omitted.

Medium-fi exterior from three useful inspected pictures and standard viewer PMTiles/DEM only. Clear2023 west tower and2019 upper roof/turrets guide the unscaffolded form;2007 broad south view guides nave/transept/choir. North facade rhythm, low ranges and roof/height subdivisions remain picture/map approximations. The lattice uses simplified structural ribs/rings/diagonal panels rather than exact carved tracery; roses use geometric disks/spokes. All approximate mapped envelopes and raw plans remain retained in source. Exact sculpture/reliefs/inscriptions, stained-glass art, tiny tracery/crockets, restoration scaffold/market stalls/town, surveyed paving/steps, full interiors and certified walking excluded. Shared textures approximate sandstone masonry and tiled roofs. Physical laptop/phone timing pending.

## Shared materials and placement

Inspected all11 current shared-material/geographic frames. Four existing shared256-square sandstone, ashlar, flat tile and plain wood graphs serve six merged groups. Walls and lattice spire share sandstone with pink/red linear tints; tile roofs retain terracotta color. Glass, clock faces/hands and dark vault backing are geometric flat PBR colors. Metric UVs and flat normals; no embedded images, bespoke facade textures or baked shadows. Each graph reads once. Unload disposes model geometry, leaves zero live model geometries and restores ground. Signed geographic top view matches the mapped main/parts; below-datum foundations are partly masked by flat diagnostic ground. Source-terrain views show approximate contact. Ground bands are fixtures.

Exact-QID way110404213/Q250212 matches current main35184482493045. All36 raw main/part plans preserve tags and min_height values or absences without rescale. Anchor[7.852891301,47.995541993], heading0.0366136962848245rad follows the southern high-nave edge, signed by the west portal/tower, eastern choir and south transept. Main/octagon116m agrees with retained116m fact. Approximate envelopes retain western base30m, transition30..37m, octagon37..116m, nave35m, choir/apse38m, aisles20m, transept26m, ring14m and twin turrets53m; these are not stacked wall solids. Estimated nave/choir eaves26/28m, west belfry54..75m/lattice75..114.8m/finial116m and smaller turret subdivisions are explicit picture estimates. Flying strips guide piers/arches rather than broad wall slabs. Only derived Boolean inputs round to0.1mm; raw controls remain exact. Joined height layers, exposed cap partitions and roof differences reproduce. Rendered facade shells regularize tiny mapped notches; detailed foundations retain the raw main outline. Far tiers use coarser components. All240 actual viewer footprint checks cover36 controls while preserving three neighboring buildings and a west-front patch across six outputs. Standard DEM datum280.811636m, display offset0.4m, perimeter-0.58..1.86m. Foundations follow terrain and entry estimates use local DEM+0.22m. Exact altitude, Münsterplatz paving/ramps/steps, threshold levels, cut-fill and walking remain unverified. No road replacement or global flattening.

Inspected all27 current Earth-lighting frames: Economy/High, noon/late, three distances, silhouette, six detail crops, four matched whole-model LODs and four transitions. Skyline preserves the open coarse belfry/porous spire, stepped west tower, nave/choir/low ranges and twin turrets. District adds shared surfaces, flat facade fields/clocks and coarser flying arches. Street adds actual facade/portal/arcade recesses, supports/pinnacles, geometric rose tracery and denser lattice. Closeup/master retain finer arch facets, lattice/crockets, clock spokes and window bars. All four matched whole-model cameras show the complete116m tip and church; default/detail crops intentionally show portions. Synthetic cottage neighbors and terrain bands are diagnostic fixtures, not mapped surrounding Freiburg town/paving.

## Browser budgets

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 995 | 90712 | 1 |
| district | 3760 | 326012 | 6 |
| street | 15844 | 1396268 | 6 |
| closeup | 22326 | 2047640 | 6 |

Initial skyline plus district: **416724 bytes** of geometry. Master: **2682748 bytes / 22326 triangles**. Four cached shared 256² graphs, zero embedded images. Geometry bytes exclude graph definitions/texture generation. Split POSITION/NORMAL streams with equal CPU/GPU totals. Physical device timing pending.

## Verification

- Targeted byte reproduction, source/import/LOD/input/review hashes, recipe index and source inventory/schema match.
- Six Khronos validations: zero errors/warnings/images; four browser budgets pass.
- 36 raw map controls, height/min_height tags or absences, signed frame, joined height layers/exposed cap partitions and standard DEM match.
- **2116 geometry probes** and **240 actual viewer footprint checks** pass.
- Shared graph read-once/unload and hash-bound placement/medium-fi reviews pass.
- Scene validation and 30-tick simulation pass: sha256:cceb5dfc744ebf41ecfd16d652d4adfceac155e666b457702de9544a5f3524ca.
- Inspected **49 current frames**: 11 portable, 11 shared/placement, 27 medium-fi. Cameras/paths/hashes retained; bulk images ignored.

Source hash:sha256:980c1635b09550d14fa50a68acb5dc7935ad136538fe3846def47e5a34f64b7b. Runtime hash:sha256:55516d60581df5debbe23ede89b56ba0689902f0c109a196e0e835019f8dd630. Input hash:sha256:0e7f04daf3df714949dbf2a0738e98785946eca5e0b687c163fe8cf04453f03f.

Commands: targeted generate/import/LOD/register-landmark-previews --ids=N0367; generate-additional-landmarks.mjs --ids=N0367 --check; capture-next-1000-models.mjs --ids=N0367 --reflections --antialias --fit-shadows; capture-landmark-library.mjs --ids=N0367 --reflections --adaptive-clipping --bounded-placement; capture-medium-fi.mjs --ids=n0367_freiburg_minster --reflections; molen validate; molen sim run --ticks 30 --hash. Routine full source checkpoint covers N0360–N0379.

## Limits

- Exact-QID way110404213/Q250212 matches current main35184482493045. All36 main/part controls retain their raw plans/tags and min_height values or absences, without rescale. Main/west octagon height116m agrees with retained116m fact. Western base30m, transition min_height30m/height37m, octagon min_height37m/height116m, nave35m, choir/apse38m, aisles20m, transept26m, chapel ring14m, twin cock turrets53m, buttress strips29m/26m and small6.5/7/4m ranges are approximate full envelopes, not stacked walls. Estimated eaves nave26m/choir28m/aisles13m/transept18m, low roof joins20m/18m, west octagon solid37..54m/open belfry54..75m/lattice spire75..114.8m/finial116m, and small turret bodies30..43m/cones53m subdivide these controls. Flying strips guide actual outer piers/arches rather than full-width29m wall slabs. Derived Boolean inputs round to0.1mm, raw controls remain untouched. Small chapel roof slopes, fenestration, portal depths and carved profiles are picture approximations.
- Standard DEM datum 280.811636m; display offset 0.4m, mapped perimeter terrain -0.58..1.86m. Foundations follow retained viewer terrain; entry estimates use local DEM+0.22m. Coarse DEM does not certify absolute altitude, Münsterplatz paving/ramps/steps, exact doorway levels, cut-fill, interiors or walking. No global terrain flattening.
- Medium-fi exterior from three inspected useful pictures and standard PMTiles/DEM only. Exact sculpture, reliefs/inscriptions, stained-glass art, smallest tracery/crockets, temporary scaffolding, market stalls/town, surveyed paving/ramps/steps, full interiors and certified walking excluded. Rose windows are geometric flat disks/tracery rather than accurate stained glass. Physical device timing pending.
- Skyline retains the porous main spire, open coarse belfry, stepped tower, nave/choir/low ranges and twin turrets. District adds shared surfaces, flat facade fields, clocks and coarse flying arches. Street adds real facade recesses, portal/arcade cavities, supports/pinnacles, rose tracery and denser lattice. Closeup/master refine arch facets, lattice/roof trim and window bars. Synthetic cottage neighbors are review fixtures.

Readiness accepts this exterior scope. The 1,000-candidate goal remains incomplete.
