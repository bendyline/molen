# turku_castle — Turku Castle: completed medium-fi exterior review

Reviewed2026-10-09. Fresh48image inspection and current source/runtime/placement/graph hashes; original draft approvals are not transferred.

## References and preserved source

[Museum history](https://turunlinna.fi/sv/abo-slotts-historia/) confirms published38/32m towers and3m maximum wall thickness. [Operator access guidance](https://turunlinna.fi/en/getting-here/) describes steep uneven approach and current route constraints. Operator courtyard and gallery photos, VisitTurku aerial and the[2023 city planning presentation](https://kaupunkisuunnittelu.turku.fi/kaavoitus/5661-2019Yleisotilaisuusesitys2023ID11290-Valmisteluehdotus.pdf) were visually compared, not redistributed as textures.

Fresh current medium-fi exterior review, replacing previous incomplete draft approval. Museum38m west/32m east totals and3m maximum walls, city measured inner-court height, operator gallery/courtyard photographs and visitor/city aerial inform the original reconstruction. Original6844triangle recipe and825888byte master reproduce unchanged hash48c1c41f347c996f1384fb2dca43b3ac5575b9791f2ea3763e9dbb6f27131cdd. Current6954triangle leaf adds graded bases, stairs/path and consistent far cladding. Museum height reference planes are not surveyed; second-court/bailey floors, pitches, windows, plaster patches and connecting-stair dimensions are declared estimates. Natural rock microdetail, modern accessibility ramps, port development, interiors and exact ornaments are excluded.

## Geographic attachment

Exact-QID Q136893 way466736288 and17 attributed component traces retained, anchor22.22874532,60.435351107, native+X East/+Z South, heading0. Original514 coordinate samples have0.666mm round-trip error. City WFS inner-court point22.2279555,60.4353175 gives8.572m N2000. Local Y0 is reconstructed bailey4m N2000, preview sea-level elevation4; upper courts are4.572m above it. Source4m grid interpolates27 city heights and107 contour fragments, with declared court/path constraints. Foundation bottoms extend below local interpolation. This is an original review fixture, not official DTM. Matching host N2000 terrain is required; footprint replacement remains off.

City[open geographic information](https://www.turku.fi/en/about-turku/maps-and-geographic-information) declares EPSG3877 and N2000. The public[WFS](https://turku.asiointi.fi/teklaogcweb/wfs.ashx) GIS:Kanta_Korkeuspiste/GIS:Kanta_Korkeuskayra responses and private WMS Maastokartta image were read. Original numerical controls, attribution and sparse interpolation ship in terrain-grid.json under the city's CC-BY4.0 attribution. There is no surveyed bailey point and no official DTM claim. Source review PNG is a terrain fixture, not a model texture.

## Inspected renders

Eleven final portable images inspected with the original interpolated source terrain, against three operator/visitor photographs and the City2023 planning aerial. All17 mapped parts have roofs, two unequal copper-topped rectangular towers, elevated timber/glass gallery, three open courts, white/grey bailey and round tower. Inner courts now stand4.572m above the bailey; eastern connecting stairs and the mapped western wooden path attach to the raised court. Corrected terrain intrusion through the bailey floor; current captures have clear courtyard paving and visible arched entrances. Modern accessibility-ramp geometry is excluded.

Eleven final shared-material/placement views inspected. Seven existing canonical256-square irregular stone_drywall, plaster_lime, metal_copper, metal_painted, wood_plain, brick and gravel graphs load once, with flat opaque glass. Eight near groups and one flat skyline group. North-up mapped alignment retains all17 footprints without double rotation; the flat geographic fixture verifies horizontal registration, not N2000 terrain fit. Unload disposes every live model geometry. No embedded texture or copied photo/mesh.

All26 final browser frames inspected: noon/late economy/high at three distances, untextured silhouette, six architectural views, district/skyline plaster comparisons, east court grade and four forced levels. Coarse plaster coverage now remains present at skyline instead of disappearing. Rectangular patch simplification, sparse windows and faceted distant round tower remain intentional. Copper main castle and contrasting bailey, roofs, gallery and open courts persist. Nearby Swedish cottages and flat ground are style fixtures, not actual Turku geography. Court stairs are clear in the detailed east view.

## Runtime and tests

984/1694/6954/6954 triangles and1/7/8/8draws; initial259516bytes, close-up741480bytes. Initial payload meets3MBphone/6MBlaptop limits. All levels use separate vertex streams, shared material graphs and identical geographic anchor. Authored1/.4/0/0m allowances describe intentional far outline and cladding simplification, not whole-mesh measured Hausdorff error. Physical-device timings and downtown memory remain unmeasured.

Six final current GLBs validate with zero Khronos errors/warnings and no embedded images. Ten focused tests pass across preserved and current recipes: deterministic budgets, exact identity and mapped roofs; open courts; original gallery glazing/clearance; three passage centerlines clear at all four levels; measured city height and current terrain skirts; exact current source hash, all authored levels and canonical irregular stone binding. Current source check, strict medium-fi audit and LOD checker pass. Convex collision is an exterior envelope, not a walkable castle navigation mesh.

No GLBs enter Git. Current source-local review-scope.json selects the new leaf, preserving turku-castle-model.mjs and its reference/map inputs. All source and QA limitations remain explicit.
