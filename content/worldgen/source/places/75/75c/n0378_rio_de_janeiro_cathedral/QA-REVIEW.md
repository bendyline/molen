# N0378 — Rio de Janeiro Cathedral review

Reviewed 2026-10-15 against current source/runtime bytes. Accepted for the medium-fi exterior and approximate map placement scope. **Host terrain/base fit remains unverified** where the retained coarse urban DEM is noisy.

![Molen summary preview](preview.png)

## Built result

Inspected all 11 current portable/source-terrain frames. Individual Rio Metropolitan Cathedral has a broad approximately 107 m circular base tapering to a roughly 33 m crown at the mapped 75 m height. Gray-brown concrete horizontal louvers and narrow radial ribs form four merged grille quadrants around tall recessed dark window bands. Broad sloping borders, small rim vents, a recessed cross skylight and four simplified bronze portals/short steps complete the exterior. Separate mapped campanile has four tapering free-standing legs, six open stages, selected bronze bells and a 75 m cross envelope. Roof/pylon ends were corrected to stay within the mapped height. Source review terrain uses a bounded estimated plaza grade, with the original coarse DEM retained separately. Stained-glass art, portal sculpture and detailed interiors are excluded.

Medium-fi exterior from two actually inspected Commons 2012 exterior and 2016 aerial pictures plus standard viewer PMTiles/DEM. No bespoke surveys/plans researched or reference images redistributed. Individual concrete truncated cone, inset window axes, concrete louver/rib quadrants, cross skylight and separate open campanile are authored. Mapped envelopes/heights are preserved; grille density/depth, portal and glass detail, tower internal stages/cross/bell profiles are picture estimates. Exact stained-glass artwork, bronze relief sculpture, statues, full interiors and surveyed plaza/thresholds are excluded. Current finish/hidden entrance detail and host terrain/base fit remain approximate. Physical laptop/phone timing pending.

## Shared materials, placement and distance

Inspected all 11 current shared/geographic frames. Three existing cached 256-square plain-concrete, boardformed-concrete and cast-bronze graphs serve five merged groups. Metric UVs, linear warm concrete/dark blue-gray tints and flat architectural normals; glazing/metal accents use opaque PBR colors. No embedded images or unique facade textures. Each graph reads once; unloading disposes geometry and leaves zero live model geometries. Shared close views show concrete grille depth, inset full-height window axes, bronze portals, crown cross and open campanile stages/bells. Top placement matches the main notches and separate northwestern tower footprint. Whole views frame the model envelope; some views naturally occlude the tower behind the cone, while the opposite whole/detail views show it independently. Flat geographic diagnostic ground is not surveyed plaza fit.

Retained exact-QID OSM way 30621926/Q2411716 matches current main 35184402710758. Anchor [-43.180691413, -22.910798343], heading 0.326561305996 rad. All 48 main, 20 crown and 16 tower vertices reproduce by rigid rotation without rescale; complete current tags and earlier multilingual identity metadata are preserved. Main/tower height 75 m is retained, as are crown min_height 50 m and height 75 m; the upper part is not extruded as a cylinder from ground. Main approximately 107 m diameter and crown approximately 33 m are map controlled; retained 106 m width/length facts remain distinct. Four inset window notches align paired axes; the separately mapped northwestern campanile signs placement. Internal grille/portal/skylight and tower stage/bell dimensions remain picture estimates. All 48 actual viewer footprint checks cover three selected controls, retain four adjacent buildings and preserve the gap between cathedral and tower across six outputs. Standard DEM datum 17.295082 m has raw perimeter -9.53..8.09 m; floor 0.6 m, original grid retained. Source fixture explicitly grades only bounded cathedral/tower plaza patches near 0.2 m and blends back to the raw terrain. This correction is not sent to the host. Actual runtime base clipping on noisy host DEM, surveyed plaza/door joins, absolute altitude and walking remain unverified. No global flattening or road replacement.

Inspected all 27 current Earth-lighting frames: Economy/High, noon/late, three distances, texture-free silhouette, six details, four matched whole-model LODs and four transitions. Skyline preserves tapered cone, four window axes/crown cross and detached cross-topped campanile. District adds shared textures, 12 coarse horizontal tiers per quadrant, radial ribs and open bell stages. Street refines to 21 tiers and selected bells/portal framing; closeup/master use 33 tiers and denser ribs. Corrected dark district switching by adding five tiers within budget and using geometry-coverage color on omitted grille cells; skyline also uses the estimated facade mean. Density/pop remains deliberately simplified, with physical motion/device timings unmeasured. Four matched whole views frame the full envelope; rear tower is partly occluded from the common front camera and shown by separate opposite views. Synthetic cottages and bounded source plaza are fixtures.

## Browser budgets

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 758 | 80316 | 1 |
| district | 3182 | 285088 | 5 |
| street | 9066 | 777192 | 5 |
| closeup | 20022 | 1656688 | 5 |

Initial skyline plus district: **365404 bytes** of geometry. Master: **2405848 bytes / 20022 triangles**. Three cached shared 256-square graphs; zero embedded images. Bytes exclude graph definitions/texture generation. Split POSITION/NORMAL views have equal CPU/GPU totals. Physical device timing pending.

## Verification

- Targeted byte reproduction and current source/import/LOD/input/report bindings; source/recipe inventory/schema match.
- Six Khronos validations: zero errors, warnings or images. Four browser budgets pass.
- All three raw map controls, retained identity/tags/height facts and standard DEM match.
- **406 actual geometry probes** and **48 current viewer footprint checks** pass.
- Shared graph read-once/unload and hash-bound placement/medium-fi reviews pass.
- Scene validation and 30-tick simulation: sha256:78881a0be666fc170c9464d9de445dd498e26f1f837c797e5c9e7d0138a75abe.
- Inspected **49 current frames**: 11 portable,11 shared/placement,27 medium-fi. Cameras/paths/hashes retained; bulk images ignored.

Source hash: sha256:9b410b1841ed9fa3f2fefff6625a8e4f940a456c4e57bca55ff2dd68d4c7781b. Runtime hash: sha256:96506b8ecdf4b771167c72edc573cf67e91049354b9ced3cf5fef88c9bbc94aa. Input hash: sha256:56e65446be40f0db508a544cc4eec9f0817cefd658ac7d61ab570407f0bb07dc.

Commands: targeted generate/import/LOD/register-landmark-previews --ids=N0378; generate-additional-landmarks.mjs --ids=N0378 --check; capture-next-1000-models.mjs --ids=N0378 --reflections --antialias --fit-shadows; capture-landmark-library.mjs --ids=N0378 --reflections --adaptive-clipping --bounded-placement; capture-medium-fi.mjs --ids=n0378_rio_de_janeiro_cathedral --reflections; molen validate; molen sim run --ticks30 --hash. Routine full source checkpoint covers N0360–N0379.

## Limits

- Retained exact-QID OSM way30621926/Q2411716 matches current main35184402710758: 48 raw vertices and mapped75m height. Upper20-vertex part35184665300982 retains min_height50m/height75m and supplies the approximately33m crown diameter; it is not extruded as a cylinder from ground. Main diameter is approximately107m (retained width/length facts106m). Separate16-vertex circle35184553463044 with height75m matches the open campanile in two inspected pictures, centered at[-50.58970495468355,-80.74536811878683]m. All three raw controls/tags and earlier multilingual metadata are retained. Four inset window axes follow the main notches, signed by the detached northwestern campanile. Frustum slope, concrete grille rhythm/beam thickness, skylight cross, doors, tower legs/stages/bells and cross proportions are picture estimates. Mapped tower75m is treated as its total envelope including cross; exact sub-heights are unverified.
- Standard viewer DEM datum 17.295082m; source floor0.6m, raw whole perimeter -9.53..8.09m. Retained raw urban DEM has about18m local variation; source review uses an explicitly bounded estimated plaza grade near0.2m around the cathedral and campanile, blending into raw terrain. This fixture is not applied to host terrain. Runtime placement uses terrain-contact at the anchor; base clipping/sinking on noisy host DEM, exact plaza/door joins, absolute altitude and walking remain unverified. Footings extend below coarse samples; no global terrain flattening or road replacement.
- Medium-fi exterior from two inspected2012/2016 pictures and standard viewer PMTiles/DEM. Concrete grille and glass artwork are simplified into merged bands/ribs and opaque dark glazing; no sculptural portal panels, statues or full interiors. Exact current finish, hidden portal details and bell shapes/heights remain approximate. Source-only bounded plaza grade is not a host terrain correction; noisy raw DEM can obscure the real runtime base. Physical laptop/phone measurements pending.
- Skyline preserves mapped truncated-cone/crown/window-axis massing and detached cross-topped campanile. District adds shared surfaces/coarse merged grille and open bell stages. Street refines concrete tiers/ribs, portal frames and selected bells; closeup/master refine rhythm. Synthetic cottages are review fixtures.

Readiness accepts this exterior scope. The full1,000-candidate goal remains incomplete.
