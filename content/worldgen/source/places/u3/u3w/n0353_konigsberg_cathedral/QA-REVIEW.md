# N0353 — Königsberg Cathedral review

Reviewed 2026-10-14 against current source/runtime bytes. Accepted for this medium-fi exterior and approximate geographic scope.

![Molen summary preview](preview.png)

## Built result

Inspected all 11 final portable/source-terrain views. Individual asymmetric brick westwork has the tall southern octagonal clock drum/concave green spire,northern and central terracotta-colored gables,three tiers of cream pointed blind fields,selected narrow windows and closed central pointed door. Broad nave and narrower eastern choir share a steep dark continuous roof ridge,small roof turret/vents and east turret. Paired choir windows,raw buttress plans and a small attached southern projection are present. Northeast open pink-stone Kant tomb colonnade preserves its side bays,flat entablature and backed monument. Corrected a blocked choir opening by moving it to the exposed mapped projection,added the missing lower west blind-panel rhythm and removed hidden skyline foundation caps. Exact text/tracery/sculpture is excluded.

Medium-fi exterior from four useful westwork/whole-building/tomb pictures and standard viewer PMTiles/DEM only. Mapped20m western blocks and50.75m spire top retained;octagonal drum30m,spire subdivisions and26/25m western gables are estimated. Mapped8m nave/11m choir tags are interpreted as eaves with an estimated24m continuous ridge. Roof/east turret26/14m tags are retained;small masses and roof divisions are approximate. Tomb5m map tag conflicts with tall columns in picture;modeled10.4m entablature is an explicit override. West blind/window cadence,porch,paired choir windows,clock details,roof vents,tomb columns/screen/monument and shared brick approximation for terracotta gable roofs remain estimated. Exact lettering,clock numerals,tracery,sculpture and full interiors excluded. Certified walking and physical device timings remain pending.

## Shared materials and placement

Inspected all 11 final shared-material/geographic views. Five existing 256-square graphs provide running brick,raw limestone,standing-seam metal,copper and plain wood. Cream panels,pink colonnade/dark stone footings and restrained gold clocks use tinted shared graphs;glazing is flat blue-gray. Terracotta-colored gable roofs use the brick graph as an explicit material approximation. UVs are metric,architectural normals hard and skyline colors use graph means. Every graph reads once. Unloading disposes geometry,leaves zero live model geometries and restores ground. Flat placement checks signed raw footprint;source terrain supplies coarse DEM context. Ground colors are diagnostic.

Previously unresolved candidate now has an approximate source-local frame at retained reference coordinate [20.511666666,54.706388888],heading -0.12435513504416938rad. Current organ-hall/Kant-museum/tomb POIs plus raw main,26 part and northeast tomb plans agree with pictured west/east ordering. Native-X faces west, native+X runs toward the eastern choir,native+Z carries tall south spire and native-Z the north gable/tomb. Long choir wall gives heading;all 28 control polygons retain raw scale/position. No exact-QID polygon identity claim. All 36 actual viewer footprint checks cover the main cathedral/tomb while retaining three neighboring buildings and west plaza across six outputs. Standard DEM datum2.246535m,estimated floor0.7m and sampled peak0.257m give approximate contact;precise thresholds/absolute altitude and walking fit unverified. No road replacement.

Inspected all 27 final Earth-lighting views:Economy/High,noon/late,three distances,silhouette,six details,four matched whole-model levels and four transitions. Skyline preserves the asymmetric towers,long steep roof,spire/minor turrets and open tomb bays with simplified buttresses/columns;hidden foundation top is omitted. District adds shared graphs,flat window/closed-door fields,blind arches,clocks and eave cadence. Street opens real window/door recesses and adds mullions. Closeup/master refine frames,clock marks,roof vents and vane. Curvature,facade detail and tomb-column cadence changes remain visible. Whole-model views show the complete cathedral;detail crops are intentional. Swedish-cottage neighbors are synthetic context,not local PMTiles buildings.

## Browser budgets

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 933 | 97320 | 1 |
| district | 3040 | 266348 | 8 |
| street | 4815 | 411872 | 8 |
| closeup | 6291 | 556028 | 8 |

Initial skyline plus district: **363668 bytes** of geometry. Master: **759632 bytes / 6291 triangles**. Five separately cached shared graphs;zero embedded images. Initial geometry excludes graph definitions/texture generation. Separate POSITION/NORMAL streams have equal CPU/GPU totals. Physical device timings pending.

## Verification

- Targeted byte reproduction: generate-additional-landmarks.mjs --ids=N0353 --check. Current source/import/LOD/review hashes match.
- Six GLBs pass Khronos with zero errors,warnings or embedded images. All four browser budgets pass.
- All 28 raw map plans and original height tags,signed frame and standard DEM match. All six outputs retain 50.75m top above common floor. Named POIs and picture ordering support approximate identity;no exact-QID polygon claim.
- **464 imported geometry probes** pass:principal roofs,gable,spire,east turret,tomb entablature/supports and open bays;detailed clear facade/projection/door recesses,closed backing and threshold.
- **36 actual viewer footprint checks** pass:main/tomb covered;three neighboring buildings and west plaza retained across six outputs.
- Five graphs read once;unload disposes geometry/restores ground.
- Source inventory/schema,recipe index,map-frame and medium-fi review bindings pass.
- Scene validation/30-tick simulation pass:sha256:17d5856ed7591c5145541611af1bc28d7d2db26583cce15daf98524d0708bb12.
- Inspected **49 final frames**: 11 portable,11 shared/placement and 27 medium-fi. Reports retain paths/cameras/hashes;bulk captures stay local/ignored.

Source hash:sha256:edce2ecf110bd80dc69889b7fb93d76ad17e641f7b0ab2f7fd1d2de3e6af40e4. Runtime hash:sha256:8271c0da205ea590ce52a8213e3c9b6a9cc2349145e1c65ad1bc2c3a6773d132. Input hash:sha256:4f36f0d867c733cf0fa6e27492665df4793d788bac1fa263bc8cbf078a854819.

Commands:targeted generate/import/LOD;capture-next-1000-models.mjs --ids=N0353 --reflections --antialias --fit-shadows;capture-landmark-library.mjs --ids=N0353 --reflections --adaptive-clipping --bounded-placement;capture-medium-fi.mjs --ids=n0353_konigsberg_cathedral --reflections;molen validate;molen sim run --ticks 30 --hash. No full engine suite/audit or full source rebuild repeated;next routine source checkpoint follows N0359.

## Limits

- Current unscaled PMTiles main outline,26 building-part controls and northeast tomb plan define horizontal fit. Tower20m,spire50.75m,nave8m,choir11m,roof turret26m and east turret14m are mapped tags,not independent surveyed dimensions. Nave/choir tags are used as eaves with estimated24m continuous ridge;west gables26/25m,octagonal drum30m and spire subdivisions are picture-led estimates. Tomb5m tag conflicts with tall pictured columns;10.4m entablature is an explicit picture-led override. Preserve uncertainty;no exact-QID footprint claim.
- Standard DEM datum 2.246535m;estimated common floor 0.7m clears sampled compound peak 0.257m and perimeter -0.97..0.22m. Foundations follow coarse terrain. Exact thresholds,absolute altitude and certified walking unverified;no independent survey.
- Exterior approximation from four useful pictures and standard PMTiles/DEM. Nave/choir height tags are interpreted as eaves;estimated ridge and gable/clock-drum subdivisions,paired lancets,west blind-panel cadence,tomb height/columns/screen and roof vents are picture-led. No exact historical tracery,lettering,clock numerals,sculpture,full interiors or certified walking. Absolute altitude/thresholds and physical device timings pending.
- Skyline preserves principal masses and open tomb bays with simplified buttresses/columns. District adds shared surfaces,flat pointed windows/closed door,blind panels/clocks and cornice rhythm. Street opens real facade recesses with mullions;closeup/master refine frames,clock marks and roof vents. Curvature,windows,ornament and tomb-column cadence change visibly. Synthetic cottage neighbors are diagnostic context,not local map buildings.

Readiness accepts this exterior scope. The 1,000-candidate goal remains incomplete.
