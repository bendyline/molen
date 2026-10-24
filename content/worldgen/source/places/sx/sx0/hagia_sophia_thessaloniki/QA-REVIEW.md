# hagia_sophia_thessaloniki — Hagia Sophia, Thessaloniki review

Reviewed 2026-10-15 against current source/runtime bytes. Accepted for this medium-fi exterior and approximate geographic/terrain scope.

![Molen summary preview](preview.png)

## Built result

Inspected all11 current portable/source-terrain frames. Individual Thessaloniki Hagia Sophia with ochre upper west facade, three wood entries, four lower round window fields and ten narrow upper clerestory windows. The central portal has broad stepped round limestone arch bands. Warm masonry side/east walls, large polygonal central apse, two lower side apses and low tiered tile roofs follow the retained plans. The square brick drum has three large arched window fields per face, a short round crown and low gray-green ribbed metal dome/cross. The small northwest bell has a tiled hip cap and genuinely open paired upper arches. Removed a generated side window occluded by the bell, restricted ochre painting to the west wall and widened the central portal surround. Degenerate Float32 clipping remnants are omitted; no visible feature is removed by that filter. Exact carved reliefs/icons, tiny grille detail, inscriptions and interiors are omitted.

Medium-fi church exterior from two useful clear west/east pictures, one older street context and standard viewer PMTiles/DEM only. Main11m, bell14m and shared17m drum controls are recorded as approximate map controls; no surveyed heights are claimed. Apse/roof subdivisions, drum/dome profiles, portal bands, side window rhythm, bell openings, metal ribs and thresholds are picture estimates. The mixed historic masonry uses a shared running-bond brick approximation. The separate courtyard gateway/retaining wall/fence has no retained modeled plan and is excluded, along with surrounding town/landscaping, exact reliefs/icons/text, fine grilles, interiors and certified walking. Physical laptop/phone timings remain pending.

## Shared materials and placement

Inspected all11 current shared-material/geographic frames. Six existing256-square lime plaster, plain running-bond brick, flat tile, standing-seam metal, limestone and plain wood graphs serve eight material groups. Replaced the first Flemish-brick binding, which read as vertical bands on the large walls, with the existing plain brick graph; the shared library itself is unchanged. Ochre plaster, warm masonry, muted tile, gray-green metal and pale stone use linear tints and metric UVs. Dark glass/grilles and gold accents use flat PBR colors. No embedded images, bespoke facade textures or baked weathering/shadows. Every graph reads once; unload disposes model geometry, leaves zero live model geometries and restores ground. Flat placement confirms plan alignment and partially hides below-datum entry geometry; source terrain views show the approximate entries/steps. Ground colors are diagnostic.

Retained exact-QID way27715355/Q1568660 matches current main35184399804187. Six current unscaled main/part/tower controls retain all raw tags and absent min_height values. Anchor[22.947015043,40.632780936], heading-0.6140197209272313rad follows the longest current nave edge; western three-door facade, northwest bell and eastern apses sign it. The retained-0.588359947721rad axis differs by about1.47deg. Main11m and bell14m are current map tags; the retained main has3building levels and no measured height. The two17m central controls share the drum-top datum. Bell wall/control14m has an estimated hip cap to14.75m; dome/cross above17m reach modeled21m. All raw transforms, recorded body/apse unions/subtractions and standard DEM match. All60 actual viewer footprint checks cover six controls while preserving three unrelated neighboring buildings and a west-front courtyard patch across six outputs. Final detailed triangles are bounded to16m so conservative viewer masks do not spill into that patch. Standard DEM datum24.401000m, display offset0.4m and perimeter terrain-2.40..1.69m. Foundations follow terrain; entries use local DEM+0.22m and short estimated steps. Exact sunken-court/retaining edges, thresholds, altitude and certified walking are unverified. No road replacement or terrain flattening.

Inspected all27 current Earth-lighting frames: Economy/High, noon/late, three distances, silhouette, six detail crops, four matched whole-model levels and four transitions. Skyline retains low dome/cross, square drum, open small bell, three apses and roof tiers at963 triangles. District adds shared textures, flat glazing/doors and paired bell arches. Street adds facade/drum/entry recesses, portal bands, sparse mullions/grilles and dome ribs. Closeup/master refine arch/dome facets and ribs. Whole-model views retain the full church, dome, tower and apses; detail crops intentionally omit other portions. Standard terrain height-band colors and Swedish-cottage neighbors are synthetic diagnostics, not real Thessaloniki geology/snow or mapped city buildings.

## Browser budgets

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 963 | 81412 | 1 |
| district | 2190 | 169848 | 8 |
| street | 9228 | 812872 | 8 |
| closeup | 12992 | 1125068 | 8 |

Initial skyline plus district: **251260 bytes** of geometry. Master: **1626000 bytes / 13512 triangles**. Six cached shared graphs; zero embedded images. Initial geometry excludes graph definitions/texture generation. Separate POSITION/NORMAL streams with equal CPU/GPU totals. Physical device timings pending.

## Verification

- Targeted byte reproduction: generate-additional-landmarks.mjs --ids=hagia_sophia_thessaloniki --check. Source/import/LOD/input/review hashes match.
- Six GLBs pass Khronos with zero errors/warnings/images; four browser budgets pass.
- Six raw map controls, signed approximate frame, body/apse partitions, raw tags and standard DEM match.
- **886 imported geometry probes** and **60 actual viewer footprint checks** pass.
- Source inventory/schema, recipe index, hash-bound placement/medium-fi reviews and shared graph read-once/unload pass.
- Scene validation and30-tick simulation pass: sha256:ef5b84de7b6cde02c5eba95cced74481cbae74c0f2a0123a09b8a4fed153a303.
- Inspected **49 current frames**:11 portable,11 shared/placement,27 medium-fi. Reports retain cameras/paths/hashes; bulk images remain local and ignored.

Source hash:sha256:f50bbf50ad23d8fe966114a6a77da704149c7e617a33d72823454a39b8890f6c. Runtime hash:sha256:4e6f79fae4ca44da9d8e31603e100745269c709927a258cd0e50254a323ae110. Input hash:sha256:3e947792b143666f773193ee614f974f9e2bb6e103af17d62722d479ffcf8b59.

Commands: targeted generate/import/LOD/register-landmark-previews --ids=hagia_sophia_thessaloniki; capture-structure-models.mjs --ids=hagia_sophia_thessaloniki --reflections --antialias --fit-shadows; capture-landmark-library.mjs --ids=hagia_sophia_thessaloniki --reflections --adaptive-clipping --bounded-placement; capture-medium-fi.mjs --ids=hagia_sophia_thessaloniki --reflections; molen validate; molen sim run --ticks 30 --hash. Next full source checkpoint covers ljubljana_cathedral–saint_sophia_cathedral_in_polotsk.

## Limits

- Retained exact-QID OSMway27715355/Q1568660 matches current main35184399804187. Six unscaled main/part/tower controls retain every raw tag and missing min_height. Main11m and northwest bell14m are current map heights; the retained main describes3building levels with no measured height. Both central square and round controls are tagged17m and share the modeled drum-top datum rather than being stacked as two17m solids. Low roofs,8.8m central apse,5.7m side apses, body/drum divisions, bell openings and dome/cross above17m are picture-led estimates; no surveyed dimensions claimed.
- Standard DEM datum24.401000m; display datum offset0.4m, perimeter terrain-2.40..1.69m. Foundations follow terrain; west entries use local DEM+0.22m and short estimated steps. The source does not flatten terrain or certify the sunken courtyard/retaining edges, absolute altitude, thresholds, cut/fill, interiors or walking.
- Medium-fi exterior from two clear west/east photographs plus an older street context and standard viewer PMTiles/DEM. Exact carved portal reliefs/icons, inscriptions, door/grille finework, separate unmapped courtyard gateway/retaining wall/fence, surrounding town/landscaping, full interiors and certified walking excluded. Physical laptop/phone timings pending.
- Skyline retains the low dome/cross, square drum, small open bell, three eastern apses and roof tiers. District adds shared textures, flat glazing/doors and paired open bell arches. Street adds recessed windows/entries, portal arch bands, sparse mullions/grilles and dome ribs. Closeup/master refine arch/dome facets and ribs. Foundations and local entry steps approximate coarse standard terrain; synthetic context neighbors are not mapped Thessaloniki buildings.

Readiness accepts this exterior scope. The 1,000-candidate goal remains incomplete.
