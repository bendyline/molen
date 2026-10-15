# N0365 — Glasgow Cathedral review

Reviewed 2026-10-15 against current source/runtime bytes. Accepted for the medium-fi exterior and approximate geographic/terrain scope.

![Molen summary preview](preview.png)

## Built result

Inspected all 11 current portable/source-terrain frames. Individual Glasgow Cathedral has a long high nave/choir, lower lean-to aisles, crossing transepts, northern ancillary ranges and a square open belfry carrying a tall tiered octagonal stone spire. Pale copper roofs, paired clerestory lancets, larger aisle fields, stepped buttresses/pinnacles, great west pointed glazing with circular tracery, recessed wood portal and small gable oculus establish its exterior. Corrected the west portal/window overlap, lowered lean-to joins so they no longer bury clerestory glazing, moved east lower-church windows onto the exposed chapter face and moved a chapter field away from the attached sacristy. Added the low northern entry and south-range end window. Deep paired belfry cavities, source-terrain thresholds and smaller crypt fields are visible. Temporary restoration scaffolding is excluded.

Medium-fi exterior from three inspected useful pictures plus standard viewer PMTiles/DEM only. All approximate map envelopes/raw plans retained, with explicit estimated roof joins, eaves, spire/belfry subdivisions, doorway/window/tracery dimensions, buttress rhythm and thresholds. Shared ashlar and limestone approximate historic masonry; shared copper provides the pale green roofs. Exact stained-glass artwork, sculpture/text, restoration scaffolding, graveyard and retaining terraces, landscaping, full interiors and certified walking excluded. Physical laptop/phone timing pending.

## Shared materials and placement

Inspected all 11 current shared-material/geographic frames. Four existing shared 256-square ashlar stone, limestone, copper and plain wood graphs serve six merged groups. Wall and stone spire reuse the ashlar graph with different linear tints; green roofs share copper. Glass and minor metal accents are flat PBR colors. Metric UVs, no embedded images, unique facade textures or baked shadows. Every graph reads once; unload disposes model geometry, leaves zero live model geometries and restores ground. Geographic flat-terrain view confirms the signed mapped plan; below-datum lower-church geometry is partly masked by the flat diagnostic ground. Standard-terrain source views show its approximate foundations and thresholds. Ground bands are diagnostic fixtures.

Exact-QID OSMway102152591/Q1473348 matches current main35184474241423. Ten raw main/part controls preserve tags and min_height values or absences with no rescale. Anchor[-4.23454771,55.86297441], heading0.19451149382379765rad follows the southern high-roof edge, signed by the west portal, eastern end and northern ranges. The retained compound-envelope axis differs by1.78deg. Approximate map envelopes retain27m high/transept roofs,20m aisles,17m chapter,21m sacristy,7m south range,4m low entry,35m crossing and62m spire with min_height35m. These envelopes are not stacked wall solids. Lean-to joins are estimated15.3m to expose the clerestory; main eaves21m, aisle/chapter12.5m, sacristy15m and belfry28.5..35m are explicit picture-led subdivisions. No independent measured dimensions in retained facts. Derived Boolean input coordinates round to0.1mm for robust coincident-edge joins; all raw controls remain exact. Raw transforms, joined-height wall layers and standard DEM reproduce. All84 actual viewer footprint checks cover ten controls while preserving three nearby buildings and a west-front patch across six outputs. Standard DEM datum36.618234m, display offset0.4m, perimeter-2.33..3.05m; foundations follow terrain and entry thresholds use local DEM+0.22m. Absolute altitude, crypt floor levels, cemetery/retaining terraces, paving/steps and certified walking remain unverified. No road replacement or global terrain flattening.

Inspected all 27 current Earth-lighting frames: Economy/High, noon/late, three distances, silhouette, six detail crops, four matched whole-model levels and four transitions. Skyline preserves the long nave/choir and aisles, transepts, northern ranges, coarse buttresses and square/octagonal stone spire. District adds shared textures, glazing/doors, oculus and open belfry. Street adds true facade recesses, pointed surrounds, paired lancets, stepped buttresses/pinnacles, west circular tracery and spire ribs. Closeup/master refine facets and tracery petals. All four matched whole-model views show the complete spire and church; detail/default street crops intentionally show portions. Synthetic cottage neighbors and terrain bands represent review fixtures rather than mapped Glasgow town or paving.

## Browser budgets

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 794 | 70204 | 1 |
| district | 1777 | 145760 | 6 |
| street | 10532 | 891076 | 6 |
| closeup | 13132 | 1142312 | 6 |

Initial skyline plus district: **215964 bytes** of geometry. Master: **1579476 bytes / 13132 triangles**. Four cached shared 256² graphs, zero embedded images. Geometry bytes exclude graph definitions/texture generation. Split POSITION/NORMAL streams with equal CPU/GPU totals. Physical device timing pending.

## Verification

- Targeted byte reproduction, source/import/LOD/input/review hashes, recipe index and source inventory/schema match.
- Six Khronos validations: zero errors/warnings/images; four browser budgets pass.
- Ten raw map controls, height/min_height tags or absences, signed frame, robust joined wall layers and standard DEM match.
- **1964 geometry probes** and **84 actual viewer footprint checks** pass.
- Shared graph read-once/unload and hash-bound placement/medium-fi reviews pass.
- Scene validation and 30-tick simulation pass: sha256:ccc8f6e84a531f536d376c4330cb09e79d12c73225784e051cd6ed940df7619b.
- Inspected **49 current frames**: 11 portable, 11 shared/placement, 27 medium-fi. Cameras/paths/hashes retained; bulk images ignored.

Source hash:sha256:b753ccf3e1f63e17ec5fa64cb3b2b3706d36ad74c6b05c61f4a6b3b1d11c7aee. Runtime hash:sha256:f547c0352f4f835c0b591fa7c1ce81ff9b89d427b6bc1bad7b936fd7522cfed4. Input hash:sha256:5c518b74b54457072d1512dfc0121d63aef3e71f03dc0c9800f2e7f07773110d.

Commands: targeted generate/import/LOD/register-landmark-previews --ids=N0365; generate-additional-landmarks.mjs --ids=N0365 --check; capture-next-1000-models.mjs --ids=N0365 --reflections --antialias --fit-shadows; capture-landmark-library.mjs --ids=N0365 --reflections --adaptive-clipping --bounded-placement; capture-medium-fi.mjs --ids=n0365_glasgow_cathedral --reflections; molen validate; molen sim run --ticks 30 --hash. Routine full source checkpoint covers N0360–N0379.

## Limits

- Exact-QID OSMway102152591/Q1473348 matches current main35184474241423. Ten raw main/part plans retain all tags and min_height absences. Current high/transept roofs27m, aisle20m, chapter17m, sacristy21m, south range7m, low north entry4m, crossing square35m and octagonal spire min_height35m/height62m are approximate full envelopes, not stacked wall solids. The raw aisle20m tag is retained as an approximate envelope; rendered lean-to joins15.3m preserve exposed clerestory glazing instead of burying it. Estimated main eaves21m, aisle/chapter12.5m, sacristy15m, south4.7m, low entry3.2m and belfry28.5..35m subdivide those controls. Stone spire from35m tapers in stages to a short modeled62m finial. Retained facts provide no independent measured dimensions. Boolean joins round local coordinates to0.1mm for robust coincident-edge clipping; raw controls remain untouched. Joined part volumes regularize tiny raw buttress notches; detailed foundation retains mapped main envelope. Crypt fenestration, buttress rhythm and thresholds are picture/standard-DEM estimates.
- Standard DEM datum 36.618234m; display datum offset 0.4m, mapped perimeter terrain -2.33..3.05m. Foundations follow terrain. Western/northern entry thresholds use local DEM +0.22m; east lower-window bases use local terrain clearance. Coarse viewer terrain does not certify absolute altitude, crypt floor levels, retaining terraces, cemetery/step joins, paving, thresholds, cut/fill, interiors or walking. No global terrain flattening.
- Medium-fi exterior from three useful pictures and standard PMTiles/DEM. Current heights are approximate map envelopes; roof slopes, window/rose geometry, buttress rhythm, crypt windows/floor levels and thresholds are estimates. Exact stained-glass art, carvings/text, scaffolding, graveyard/retaining terraces, landscaping, full interiors and certified walking excluded. Physical device timing pending.
- Skyline preserves the long roofs, aisles/transepts, northern ranges and square/octagonal stone spire. District adds shared textures, flat glazing/doors, gable oculus and open belfry. Street adds recesses, paired lancets, stepped buttresses/pinnacles, portal bands, great-window circular tracery and spire ribs; closeup/master refine facets/petals. Synthetic context neighbors are not mapped Glasgow buildings.

Readiness accepts this exterior scope. The 1,000-candidate goal remains incomplete.
