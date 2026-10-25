# Qualla batch 001 — pilot review

Reviewed 2026-10-14. **All five pilots are complete as medium-fi exteriors.**
The [completion ledger](PROGRESS.md) verifies current source, references, runtime, visual and
geographic evidence before counting a completion. The goal remains all 100 local models.

| Pilot | Completed exterior | Source triangles | Review limits |
| --- | --- | ---: | --- |
| [Lorraine Motel](../../places/9y/9yp/lorraine_motel/README.md) | Preserved room block, jog and return, balcony, stairs, wreath and two-sided sign; corrected west-facing courtyard position | 7,554 | Modern museum excluded; hidden rear closure and fine lettering are interpretations |
| [Ford's Theatre](../../places/dq/dqc/fords_theatre/README.md) | Theatre and lower south wing, paneled entrances, window hoods, cornice, pediment and three ridge ventilators | 8,034 | Fine ornament and unseen rear details are interpretations; no interior |
| [Anne Frank House](../../places/u1/u17/anne_frank_house/README.md) | Corrected 263 facade, hipped front roof, connecting section and transverse annex roof | 2,448 | Adjacent museum excluded; hidden annex dimensions are interpretations |
| [Brandenburg Gate](../../places/u3/u33/brandenburg_gate/README.md) | Five open passages, fluted columns, corrected attic, projecting pavilions and original simplified quadriga | 20,448 | Fine sculpture and facade carving are simplified; no surveyed plaza levels |
| [Watergate complex](../../places/dq/dqc/watergate_complex/README.md) | Distinct residences, hotel and offices with curved plans, balcony rhythm, roof forms and interpreted court connections | 49,972 | Exact roof equipment, pools, landscaping, interiors and measured terrace joins omitted |

Every pilot has 33 inspected final views: seven portable, seven with actual shared viewer
materials (including a north-up map overlay), and nineteen context/detail-level views.
Each has four verified runtime detail levels, preserved independent terrain samples and
an active preview placement with footprint suppression disabled. Source-local `qa.json`
records the approved hashes, observations and limitations. Coarse map/terrain controls are
not architectural or ground surveys; no physical-device frame-rate claim is made.

Corrections made during review included the Lorraine courtyard heading and two-sided sign;
Ford's lower south wing, terrain encoding and distorted automatic skyline; Anne's neighboring
parcel, roof directions and painted trim; Brandenburg's pavilion proportions and false small
masonry texture; and Watergate's pale skyline and review cameras inside the large complex.
Rejected drafts do not count toward completion.

Qualla story annotations are synchronized after verified completion. Changes to geometry,
references, material graphs, terrain or placement invalidate affected approvals on rerun.
The source generator and ordinary importer reproduce the five pilots exactly; all twenty
runtime derivatives pass current hash and budget checks. The 22 Qualla workflow tests and
9 source-discovery tests pass. A repository-wide source check has a previously identified,
unrelated hash mismatch in `gran_torre_costanera/models/source.glb`; no whole-repository
CI or independent Khronos-validator result is claimed.

The fixed 100 now has 94 accepted starting reference sets and six requiring better exterior evidence:
Arizona Biltmore, Fairmont Banff Springs,
Ennis House, Hollyhock House, Getty Villa and
Sun Yat-sen Memorial Hall in Taipei. Rejected images remain rejected on reruns. Additional
canonical media folders have been found for some targets and still require selection/review.

The first ten are now complete, including 13 Kensington Palace Gardens, Eastern State Penitentiary,
Fallingwater, Faneuil Hall and Ford Island control tower. Each has the same 33-view/current-hash
review gate and a synchronized Qualla story annotation. The tower uses a local aerial for site
context plus inspected museum and Warren LeMay exterior photographs; published height
differences are documented as approximation. Eastern State's originally suggested hero image
was an old lithograph and was replaced with useful photographs. The 22 workflow and nine
source-discovery tests were rerun successfully at this ten-model milestone.

Hearst Castle is the eleventh completed exterior. The coordinated site retains Casa Grande,
three guest houses, Neptune pool architecture and the Roman Pool exterior/roof courts.
All 33 final views, plus pool and guest-house close views, were inspected. Source and runtime
reproduce exactly and all four detail levels pass budgets. The review corrected facade
occlusion, the roof underside, guest-house roof directions, pool retaining walls and stair
contact. Exact vertical terrace levels, hidden windows, curved stair geometry and fine
sculpture remain interpretations; the independent terrain is preserved. A conflicting Casa
del Sol image attribution was resolved against its original source. The completion ledger
remains the authority for current hash-bound readiness.

All structure catalog candidates and collection members remain assigned to the other device.
Kensington Palace (`kensington_palace`) was removed from the local 100 and replaced by Liebermann Villa;
13 Kensington Palace Gardens is a distinct local target. No generic building counts as a
finished individual replica.

See [the fixed queue](QUALLA-001.md) and [the resumable workflow](../README.md#first-100-and-reference-evidence).

Hollywood Sign is the twelfth completed model. Two local Qualla front/rear photographs, individual mapped letter lines, and independent USGS terrain control the sign. All 33 current views were inspected; exact regeneration, import verification, four detail levels and strict budgets pass. The original terrain-driven panel arch was corrected using photographic panel heights, with support feet sampled separately. Published total length conflicts with map geometry; exact ground contact with another host DEM remains uncertain. These limitations are recorded in the source review.

Hollywood Sign annotation synchronization also repaired its older curation-only tile mismatch (`9q5c` to canonical story tile `9q5f`) through Qualla’s locked relocation routine. All previous curation fields and review history were preserved; the subsequent annotation check reports no pending changes.

Hotel del Coronado is the thirteenth completed exterior. Four inspected local photographs establish the historic open courtyard, white wooden wings, verandas, three smaller turrets and twelve-sided main roof with dormers and belvedere. All 33 final views were inspected; exact regeneration, import verification, terrain encoding and four detail-level budgets pass. The later north pavilion and separate resort neighborhoods are excluded. Heights, hidden facade spacing and roof joins remain interpretations; dated 2006–2019 references do not establish every 2021–2025 restoration change.

Hangar 37 is the fourteenth completed exterior. A local Qualla aerial establishes site context; inspected museum and architect photographs resolve its own twin shallow gables, corrugated doors, roof vents and checker entrance canopy. All 33 final views were inspected after correcting canopy normals, entrance glazing occlusion and the number plaque. Exact regeneration, import, terrain encoding and four detail levels pass. Dated signage, hidden elevations and equipment positions are documented approximations; Hangar 79, the control tower and aircraft are excluded.

Reichstag (local batch #15) completed on 2026-10-15: 35,333 triangles, four current LODs, 33 inspected render frames and independent Berlin DGM1 terrain. The forecourt reference and entrance stairs were corrected using the 1 m ground data. Current source hashes and detailed limitations are recorded in its `qa.json`. All 15 local models regenerate exactly.

At the fifteen-model milestone, all 22 Qualla workflow tests and 20 source-discovery, indexing and architectural-surface tests pass. Reichstag story synchronization changed one article, and its subsequent check reported zero pending changes.

Robben Island Lighthouse is the sixteenth completed model. The inspected local 2012 image and architect’s 2019 full view informed its circular shaft, east daymark, curved galleries and red lantern. Review corrected compressed upper proportions and over-decorated window surrounds. All 33 final views, source/import hashes, four detail levels and terrain encoding pass. The Qualla island story now links to the validated lighthouse; a subsequent synchronization check reports zero pending changes.

Robben Island maximum-security prison is the seventeenth completed model. Five individually inspected local exterior photographs, mapped blocks/towers and the official museum description informed the compound. All 33 final views plus an entrance close view were inspected; source/import hashes, four detail-level budgets and terrain encoding pass. Review corrected entrance window counts, stone pattern, terrain floors and the map overlay. The separately cataloged prison article was matched to this same structure, so both it and the island story receive the completion link. Hidden roof/court details, window spacing and coarse ground levels remain interpretations.

Winchester Mystery House is the eighteenth completed model. Individually inspected Qualla front, roof, south-court and driveway photographs plus museum aerial/site evidence define the mansion core. Review corrected front windows, projecting bays, veranda, arched attic opening, colors and the skyline silhouette. All 33 final frames, exact source/import checks, four detail levels and terrain encoding pass. The combined estate footprint and explicit mansion scope cuts are preserved; hidden roof joins and rear-wing details remain interpretations. Stables, greenhouse connections, visitor facilities and the demolished tower are excluded.

Liebermann Villa (19) passed its 33 current render views, exact regeneration, ordinary import, four LOD budgets and hash-bound geographic review. The two street columns, eyebrow dormer, lake pediment and open loggia follow individually inspected Qualla originals; Berlin DGM1 provides independently preserved terrain. Fine capitals, hidden side openings and terrace depth remain estimates.

Lincoln Memorial is the twentieth completed model. Two inspected local exterior photographs, statue detail, NPS dimensions and architectural drawings control the colonnade, attic, portal and upper stair flights. All 33 current views, exact source/import checks, four detail levels and independent terrain encoding pass. Fine inscriptions and the statue likeness remain simplified. At this milestone, all 22 workflow tests and 20 source-discovery, indexing and architectural-surface tests pass; all twenty authored sources reproduce exactly.

## Model 21 — Jefferson Memorial

Completed 2026-10-15. Individually inspected Qualla front, aerial, Ionic capital and statue photographs, NPS column counts, and HABS 1994 north elevation and longitudinal section control the 54-column temple, stepped dome, north portico and raised terrace. Final visual review corrected stair landings and connected the curved retaining wall to the stairs. All 33 current portable, shared-material and medium-fi frames were inspected; exact regeneration, ordinary import, four LODs and strict medium-fi checks pass. Runtime levels contain 966 / 3,298 / 15,642 / 63,310 triangles. Independent terrain PNG round-trip error is below 0.000046 m. Fine sculpture and inscriptions remain simplified. Current evidence and hashes are in the source-local `qa.json`; the wider gardens and basin are outside scope.

## Model 22 — Arizona Biltmore Hotel

Completed 2026-10-15. Individually inspected Qualla south-front, north-court, tower and textile-block photographs, the architect’s 1929 floor plans and the official current resort map control the historic main block, stepped guest core, tower, veranda and Aztec/Gold/Grand wings. Later resort wings and separate conference facilities are excluded. Final review corrected roof normals, obscured Gold Room windows, courtyard window directions and the small pylon opening. All 33 current portable, shared-material and medium-fi frames were inspected; exact regeneration, ordinary import, four LODs and strict medium-fi checks pass. Runtime levels contain 928 / 3,152 / 12,974 / 60,176 triangles. Independent terrain PNG round-trip error is below 0.000069 m. Fine block relief, hidden roof joins and vertical dimensions remain approximations. Current source-local QA records the hashes and limitations.

## Model 23 — Hotel Chelsea

Completed 2026-10-15. Individually inspected local 2025 and 2010 facade photographs, a 2011 ironwork close-up and the official city designation report establish the varied balcony tiers, pointed end gables, four dormers, substantial chimneys and central roof. Review corrected the faceted center bay, upper window row and projecting sign clearance. All 33 current portable, shared-material and medium-fi frames were inspected; exact regeneration, ordinary import, four LODs and strict medium-fi checks pass. Runtime levels contain 880 / 3,787 / 13,199 / 43,677 triangles. Independent terrain PNG round-trip error is below 0.000031 m. Story heights, hidden roof/service details and fine ironwork remain approximations; the 2025 image governs restored finishes. Current evidence and hashes are recorded in source-local QA.

## Model 24 — Fraunces Tavern

Completed 2026-10-15. Individually inspected local corner, Pearl Street, brick-detail and sign photographs plus official city descriptions and the district boundary map establish the restored corner tavern. Review corrected dormer winding, overlapping foundation surfaces, solid balcony side panels and a pronounced shared-texture seam. All 33 final portable, shared-material and medium-fi frames were inspected; exact regeneration, ordinary import, four LODs and strict medium-fi checks pass. The close model has 19,895 triangles. Independent terrain PNG round-trip error is below 0.000214 m. Adjacent museum properties and the narrow rear connector are excluded. Vertical dimensions, hidden surfaces, brick bond and fine profiles remain approximations; no exact 1783 reconstruction is claimed. Current source-local QA records the hashes and limitations.

## Model 25 — Stonewall Inn

Completed 2026-10-15. Individually inspected local 2014 and 2016 photographs, the official city designation photograph/map and current NPS visitor-center photograph establish both 51 and 53 Christopher Street. Review corrected residential-door geometry, visitor-center entrance framing, rear foundations and the two-footprint map overlay. All 33 final portable, shared-material and medium-fi frames were inspected; exact regeneration, ordinary import, four LODs and strict medium-fi checks pass. Runtime levels contain 338 / 2,969 / 5,171 / 7,733 triangles. Independent terrain PNG round-trip error is below 0.000046 m. Hidden rear/roof details and vertical dimensions remain approximations. Current source-local QA records the hashes and limitations.

At this twenty-five-model milestone, all 22 Qualla workflow tests and 20 source-discovery, indexing and architectural-surface tests pass. All 25 authored sources regenerate exactly. The fixed goal remains 100 local models, excluding every structure catalog candidate and collection member assigned to the other device.

## Model 26 — The Ritz Hotel, London

Completed 2026-10-15. Individually inspected local Green Park, Piccadilly arcade and Arlington entrance photographs, original plans/elevations and the 2021 condition survey establish the dated main hotel. Review corrected roof continuity, chimney connections, two-level pediment dormers, window occlusion and the close-detail budget. All 33 final portable, shared-material and medium-fi frames were inspected; exact regeneration, ordinary import, four LODs and strict medium-fi checks pass. Runtime levels contain 876 / 3,331 / 15,535 / 54,267 triangles. Independent terrain PNG round-trip error is below 0.000077 m. William Kent House, the later 22 Arlington extension and interiors are excluded. Vertical dimensions, hidden elevations and fine ornament remain approximations; current source-local QA binds the reviewed evidence.

## Model 27 — Hotel des Indes (The Hague)

Completed 2026-10-15. Four individually inspected local front, entrance and rear-corner photographs, official municipal/hotel records and AHN4 elevations control the hotel. Review corrected inward side openings/dormers, rounded-corner window contact, roof/lightwell gaps and ground masonry joints. All 33 final portable, shared-material and medium-fi views were inspected; exact regeneration, ordinary import, four LODs and strict medium-fi checks pass. Runtime levels contain 461 / 1,969 / 7,093 / 28,305 triangles. AHN4 terrain PNG round-trip error is below 0.000031 m. Valid ground pixels remain unchanged; masked cells beneath buildings use explicitly documented interpolation, with maximum nearest valid source distance about 15.9 m. Roof heights supersede the inconsistent coarse map height. Hidden elevations, court faces, roof joins and fine ornament remain approximations; current source-local QA binds the evidence.

## 28. Hotel Majapahit — terrain review pending

The researched model preserves the Art Deco entrance and twin glazed beacons, three gardens, open two-storey galleries, red hipped roofs, classical pediment and curved balcony. Four local Qualla originals and the official hotel aerial were inspected. The later eastern service/pool extension is excluded. Current geometry, import, shared surfaces and all four LOD budgets pass; all 33 current frames were inspected.

This model is **not completed**: the independent Terrarium grid varies by several metres across the compound and hides parts of the lower galleries. The official BIG DEMNAS service timed out during acquisition. Its terrain has not been flattened to force acceptance. Source `qa.json` preserves current hashes, passed checks and the unresolved geographic/fidelity review. Resolve suitable independent ground evidence or a reviewed terrain policy before counting it toward 100.

## Model 29 — Jamaica Inn

Completed 2026-10-15. Four individually inspected Qualla photographs, Historic England architectural evidence and mapped roof context establish the slate-hung five-window bar range, twin chimneys, perpendicular granite museum wing, eaves dormers and lower east connector. Review corrected dormer profiles, stone coursing and the lower-range entrance. All 33 current portable, shared-material and medium-fi frames were inspected; exact regeneration, ordinary import, four LODs and strict medium-fi checks pass. The close model has 8,905 triangles. Independent unmodified terrain PNG round-trip error is below 0.000085 m. Heights, hidden rear elevations, roof joins and fine stonework remain approximations. Long modern hotel extensions are excluded. Current source-local QA binds the evidence. This brings the accepted local total to 28; model 28 remains open for terrain review.

## Model 30 — Ponce de Leon Hotel

Completed 2026-10-15. Six individually inspected Qualla photographs, the NPS architectural nomination, official Flagler descriptions and mapped roof context establish the U-shaped hotel, paired water towers, four King Street miradors, timber galleries, central solarium, dining oval and original service range. Review corrected obscured openings, balcony projection, rear elevations and the central paired windows. All 33 current portable, shared-material and medium-fi frames were inspected; exact regeneration, ordinary import, four LODs and strict medium-fi checks pass. The close model has 47,683 triangles. Independent unmodified terrain PNG round-trip error is below 0.000031 m. NPS overall tower height governs the skyline; conflicting map tags remain recorded. Other heights, hidden elevations, roof joins and fine ornament remain approximations. Separate boiler/chimney, Artists Studios and later college facilities are excluded. Current source-local QA binds the evidence. Accepted local total: 29, with model 28 still open for terrain review.

## Model 31 — Fairmont Banff Springs Hotel

Completed 2026-10-15. Three individually inspected Qualla originals, the official hotel floor plan, Parks Canada architectural description and mapped roof context establish the stepped central tower, guest wings, angled end pavilions, public-room podiums and Rundle cross-wing. Review corrected buried dormers, floating ridge details, thin gable backs and disconnected low wings. All 33 final portable, shared-material and medium-fi frames were inspected; exact regeneration, ordinary import, four LODs and strict medium-fi checks pass. The close model has 55,422 triangles. Independent unmodified terrain PNG round-trip error is below 0.000123 m. Actual footprint placement supersedes the story coordinate approximately 650 m away. Heights, roof joins, hidden elevations and fine ornament remain approximations. Later Gatehouse/conference, pool/spa facilities and interiors are excluded. Current source-local QA binds the evidence. Accepted local total: 30; model 28 remains open for terrain review.

At the thirty-completed-model milestone, all 22 Qualla workflow tests and 26 source-discovery, indexing and architectural-surface tests pass. All 31 authored sources regenerate exactly, including the unaccepted Majapahit source. Banff story annotation synchronization changed one article; the subsequent check reports zero pending changes.

## Model 32 — Palace Hotel, San Francisco

Completed 2026-10-15. Five individually inspected Qualla originals, the city landmark-report roof plan, four elevations and aerial establish the surviving 1909 hotel, rounded corners, grouped windows, triple curved entrance canopies, narrow lightwell and open-frame roof sign. Review corrected the main court skylight axis and shallow hipped form. All 33 final portable, shared-material and medium-fi frames were inspected; exact regeneration, ordinary import, four LODs and strict medium-fi checks pass. The close model has 58,133 triangles. Independent unmodified terrain PNG round-trip error is below 0.000069 m. City roof/parapet labels govern principal heights; coarse map part heights remain recorded as conflicting evidence. Floor spacing, low-roof heights, hidden joins and fine ornament remain interpretations. No 1875 reconstruction, interiors or proposed antennas are included. Current source-local QA binds the evidence. Accepted local total: 31; model 28 remains open for terrain review.


## Model 33 — Château Frontenac

Completed 2026-10-15. Three individually inspected Qualla originals, the original ground-floor plan, CIEQ phase silhouette, heritage descriptions and mapped roof context establish the Maxwell tower, rounded rooms, two courts, through-arched entrance and connected copper-roofed wings. Review corrected missing riverfront and western connectors, side openings and stone pavilion panels. All 33 final portable, shared-material and medium-fi frames were inspected, including full terrain-front and entrance views. Exact regeneration, ordinary import, four LODs and strict medium-fi checks pass; the close model has 46,146 triangles. Independent NRCan HRDEM Mosaic ground data confirms the southwest rise and river cliff; the raw GeoTIFF and hash are preserved. No flattening or building fitting is applied. Terrain PNG round-trip error is below 0.000567 m. The 77 m architectural height and rounded 80 m tourism figure remain distinguished; individual heights, service elevations, roof joins, terraces and ornament remain interpretations. Full Dufferin promenade, kiosks and interiors are excluded. Current source-local QA binds the evidence. Accepted local total: 32; model 28 remains open for terrain review.

### Château Laurier — local batch entry 34, completed 2026-10-15

- Two primary local Qualla photographs individually inspected (2012 Rideau front and 2008 canal elevation), with night/historical supplements, NCC phase/aerial study, Parks Canada architectural description, existing hotel elevation in the 2020 heritage-impact report and satellite roof context. Proposed additions and the removed garage are excluded.
- Individual mapped roof facets, historic U-shaped wings, low central halls, octagonal entrance pavilions and high rear tower, inset round turrets, oriels, through-open carriage arches and the canal terrace are authored. Roof junctions, entrance gables and window depth were corrected during render review.
- Independent unmodified NRCan HRDEM Mosaic DTM gives a 72.0103 m street datum. Sampled footprint controls range from −5.514 to +0.933 m; the canal descent remains intact. Raw GeoTIFF provenance and 16-bit terrain round-trip pass (maximum error 0.000306 m).
- Exact source regeneration, ordinary import verification, four LODs and strict medium-fi checks pass. Current 7 portable, 7 shared-material and 19 medium-fi frames were inspected. LOD triangles: 777 / 3,279 / 15,874 / 53,105; runtime GLB 6,374,580 bytes, two shared surfaces plus local glass.
- Current source hash: `c79935600a563608dddebc2d5e8e814748d32bd9190ce31dc20ab254a6655559`; QA input hash: `de86852291f25e3629dfe78a7e5e602fb072fb7200fc13eaa1ac1db43ffa4971`.
- Fine carving, exact openings, hidden elevations and roof/terrace joins are medium-fi interpretations. No measured-survey, independent Khronos or physical-device performance claim. Preview placement keeps footprint suppression off.

## Model 35 — Ernest Hemingway House

Completed 2026-10-15. Three individually inspected Qualla originals (2006 gallery, 2009 overall front, 2019 facade detail) and HABS FL-179 plans, three elevations and architectural description establish the flat parapeted house/ell, curved corrugated gallery roofs, arched shutters, two open galleries and ironwork. Review corrected the northwest stair direction and deck/joist clearance, and separated the flat roof membrane from the corrugated canopies. All 33 current portable, shared-material and medium-fi frames were inspected. Exact regeneration, ordinary import, four LODs and strict medium-fi checks pass; LOD triangles are 902 / 2,254 / 13,678 / 36,694. Five shared surfaces plus glass; runtime GLB 4,406,464 bytes. Independent unmodified Terrarium elevations use a 4.0214 m entry datum; sampled footprint range is −0.025 to +0.116 m, with PNG round-trip error below 0.000023 m. HABS measured gallery dimensions supersede the approximately one-metre-inset coarse map envelope, which remains recorded unchanged. Fine dimensions, hidden details and ornamental profiles are medium-fi interpretations. Separate garden structures, studio, former catwalk, pool and interiors are excluded. Accepted local total: 34; model 28 remains open for terrain review.


## Model 36 — Ennis House

Completed 2026-10-15. Seven individually inspected Qualla originals, HABS CA-1942 measured elevation and architectural description, the 1928 Architectural Record floor plan/perspective and satellite context establish the articulated textile-block compound. Model includes the projecting dining window, high living-room transom, stepped roofs, rear gallery, motor court, linked garage/servants wing, bridge, north pool terrace and retaining/boundary walls. Final review added the northwest street return and stepped living-window surround. All 33 current portable, shared-material and medium-fi frames were inspected. Exact regeneration, ordinary import, four LODs and strict medium-fi checks pass; LOD triangles are 878 / 2,064 / 12,526 / 60,816. Three shared surfaces plus glass and pool water; runtime GLB 7,300,564 bytes. Unmodified USGS CA_LosAngeles_B23 bare-earth evidence replaces the coarse Terrarium comparison and is retained as a raw GeoTIFF. Motor-court datum is 255.9812 m NAVD88; sampled footprint range is −7.052 to +5.643 m, with PNG error below 0.000314 m. The initial sloping-street datum was corrected before authoring. Terrain under structures is source-interpolated; no flattening or geometry fitting was applied. Dimensions, hidden joins, cast relief and leaded-glass details remain medium-fi interpretations. No photo pixels, interiors, scaffolds, vegetation or neighboring buildings included. Accepted local total: 35; model 28 remains open for terrain review.

At the thirty-five-completed-model milestone, all 22 Qualla workflow tests and 26 source-discovery, indexing and architectural-surface tests pass. All 36 authored sources regenerate exactly, including the unaccepted Majapahit source. Ennis story annotation synchronization changed one article; the subsequent check reports zero pending changes.


## Model 37 — Hollyhock House

Completed 2026-10-15. Six individually inspected Qualla originals, HABS CA-356 exterior description, the official 2024 museum room layout and aerial roof context establish the battered-wall courtyard house. The model includes the continuous upper east bridge, glazed bedroom bay, west living projection, northern entry gallery, open pergola, attached gardens and pools, and paired stair finials. Render review corrected the east wall continuity, west glazing groups and terrace parapet. All 33 current portable, shared-material and medium-fi frames were inspected. Exact regeneration, ordinary import, four LODs and strict medium-fi checks pass; LOD triangles are 836 / 3,802 / 13,938 / 28,990. Four shared surfaces plus glass and pool water; runtime GLB 3,481,800 bytes. Unmodified USGS CA_LosAngeles_B23 bare-earth evidence is retained as a raw GeoTIFF, with datum 150.0724 m NAVD88 beside the northern gallery. Sampled footprint range is −0.275 to +1.539 m; PNG round-trip error is below 0.000207 m. The incompatible generic 18.7 m map height remains recorded and is not used for the roof. Dimensions, hidden joins, relief and glass patterns remain medium-fi interpretations. Long northern pet pergola, separate park buildings, vegetation, interiors, sculpture and temporary coverings are excluded. Accepted local total: 36; model 28 remains open for terrain review.

## 38. Gamble House — completed 2026-10-15

Individually inspected Qualla front/rear photographs, porch and entrance details, HABS first-floor plan and construction detail, and aerial roof context. Authored overlapping deep gables, raised attic glazing, three open sleeping porches, olive cedar shakes, timber windows and beam ends, three capped chimneys and attached terraces. Corrected porch obstruction, attic visibility, foundation bounds and rear stair connections during visual review.

All 33 current portable/shared/medium-fi frames inspected. Exact regeneration, ordinary import verification, four LOD checks and strict medium-fi audit pass. Final mesh: 28,706 triangles, six materials (five shared). LODs: 638 / 3,942 / 13,830 / 28,706 triangles. Independent unmodified USGS B23 raster 41348 retained; front-garden datum 273.7152 m NAVD88, footprint range +0.628 to +1.180 m, PNG round-trip error 0.000108 m or less. Footprint replacement remains disabled. Hidden joins and small ornament are medium-fi estimates; detached garage and interiors excluded. Source-local qa.json binds the current hashes.


## Model 39 — Getty Villa

Completed 2026-10-15. Two primary and four supplemental Qualla originals, both pages of the official Getty visitor plan and aerial roof context establish the main villa, open inner peristyle, west atrium/entrance gallery, south balcony and long outer peristyle. Attached viewing terrace includes brick support arches above the hillside. Modern campus buildings and artworks are excluded. Render review corrected the south colonnade opening, northern projection and pool basin depth conflict.

All 33 current portable, shared-material and medium-fi frames inspected, including a full shared rear view of the corrected water surface. Exact regeneration, ordinary import verification, four LOD checks and strict medium-fi audit pass. LOD triangles: 904 / 3,929 / 14,065 / 63,477. Runtime GLB: 7,620,240 bytes, four shared surfaces plus local glass and pool water. Independent unmodified USGS B23 raster 114605 retained; west-approach datum 53.8476 m NAVD88, mapped controls −9.910 to +0.846 m, PNG round-trip error below 0.000352 m. Terrain remains unflattened and footprint replacement disabled. Hidden joins, exact dimensions and ornament remain medium-fi estimates. Source-local QA binds current hashes. Accepted total: 38; Majapahit remains open for terrain review.

Getty Villa annotation was written and its article-scoped check reports zero pending changes. A full-catalog sync is currently blocked by an unrelated Hollywood Sign relocation mismatch: catalog/9q5c.json holds the entry while the merged story remains at _c/art/9/q/5/f/. No location or editorial fields were changed. The sync tool now supports explicit Qualla article IDs, retaining full backlog freshness and selected-entry identity checks. All 23 workflow tests pass, including isolation, retirement, duplicate, moved-entry and atomic-write coverage.

## Beethoven House — 2026-10-15

Bonngasse 20 front house, attached lower birthplace garden wing and courtyard completed from five individually inspected local Qualla originals, official building history and aerial/map context. The final review corrected rear dormer positions and peaked caps, restored the small high vent and partly obscured upper window. Neighboring museum/research/concert buildings remain excluded. Five shared surfaces plus local glass; 7,510 source triangles. All 33 current portable, shared and medium-fi views inspected, including all four runtime detail levels. Exact regeneration, import verification, LOD checks and strict medium-fi audit pass. Unmodified Terrarium datum 64.7853 m; footprint-relative ground -0.08871 to +0.48581 m, PNG encoding error 0.00003826 m. Current hashes, frame paths, level counts and limitations are retained in source `qa.json`. Batch progress: 39/100 ready, all five pilots ready. Qualla annotation uses the article-scoped sync because the unrelated Hollywood Sign catalog relocation mismatch remains unresolved.


## Bach House — 2026-10-15

Historic Frauenplan 21 exterior completed from five individually inspected Qualla originals, official museum history and aerial/map context. Ochre plaster, irregular window groups, projected upper bay, carved doorway, three front gabled dormers and five rear shed dormers are represented. Final review removed a repeating tile-weathering pattern and softened facade/foundation colors. Modern museum and neighboring buildings remain excluded. All 33 current portable, shared-material and medium-fi frames inspected. Exact regeneration, ordinary import verification, four runtime LOD checks and strict medium-fi audit pass. LOD triangles: 367 / 1,199 / 8,153 / 25,937; runtime GLB 3,115,580 bytes, five shared surfaces plus local glass. Unmodified Terrarium datum 243.5478 m; mapped controls −1.299 to +1.347 m, PNG encoding error below 0.000161 m. No terrain flattening. Hidden joins, dimensions and fine ornament remain estimates. QA binds current input/source/runtime and frame hashes. Accepted batch total: 40/100; Majapahit remains open for terrain review.

At 40 accepted models, all 41 authored recipes regenerate exactly (including Majapahit, still awaiting geographic acceptance). All 23 Qualla workflow tests and 26 source/index/surface tests pass; source and authoring index checks pass. Bach House article-scoped annotation write changed one story, and the following check reports zero pending changes.


## Chatsworth House — 2026-10-15

Main quadrangular house, attached north wing, two service courts, orangery, belvedere and return gateway completed from six individually inspected Qualla originals, all four pages of the official visitor plan, Historic England architecture description and aerial/map context. Distinct west pediment, south pavilions and stairs, east window rhythm and bowed north range are retained. Final review corrected the gatehouse windows and checked the three open arches. Detached stables, garden structures, sculpture and interiors excluded.

All 33 current portable, shared-material and medium-fi views inspected. Exact regeneration, ordinary import verification, four runtime LOD checks and strict medium-fi audit pass. Closeup/source: 62,060 triangles, four materials (three shared), runtime GLB 7,449,592 bytes. All LODs meet their budgets. Unmodified Terrarium datum 119.1626 m, mapped control range −1.785 to +4.273 m, PNG encoding error below 0.000253 m. Terrain remains unchanged; footprint replacement disabled. Dimensions, hidden roof joins and fine ornament remain medium-fi estimates. Source QA binds current hashes and detailed level counts. Accepted local total: 41/100; Majapahit remains open for terrain review.


### Ordinary geographic names — 2026-10-15

All 42 authored source/runtime bundles and recipes now have ordinary structure identities;
the batch is called **Qualla compat**. All 100 entries reserve neutral model names. Source,
runtime and all 168 detail-level GLBs rebuilt to byte-identical outputs; 1,686 binary files,
including terrain and inspected captures, remain unchanged. The explicit identity-migration
record retains the previous evidence hashes, and QA reports identify the retained inspections.
Targeted regeneration/import, LOD checks and strict medium-fi checks pass; 25 workflow tests
and 26 source/authoring tests pass. Completion remains **41/100**, with Majapahit terrain fit
unresolved. Existing Qualla links migrated in 42 articles; an immediate second run made zero
changes. Full story reconciliation and the new Chatsworth annotation remain pending because
Qualla catalog `e9wq.json` and `meta.json` contain unrelated unresolved merge-conflict markers.
Those editorial files were not changed. After resolution, run the normal scan/prepare/sync
workflow; the earlier Hollywood Sign relocation discrepancy may also need reconciliation.


### Pre-resumption branch integration audit — 2026-10-15

Audited all 42 produced models on `main`: 41 remain complete, including all five pilots.
All source recipes, required inputs, previews and runtime sidecars are tracked. A full source
rebuild completed (3,512 GLBs); all 42 local source hashes remain exact. Fixed four stale LOD
fingerprints and regenerated and inspected all 33 current frames for Brandenburg Gate, Hearst
Castle, Liebermann Villa and Lincoln Memorial. Their source-local QA now binds the current
branch inputs. All 168 local LODs and strict medium-fi checks pass. Source checks pass for
820 bundles and canonical addressing checks for 564 structures; 55 focused workflow/authoring
tests pass. All 42 scenes validate and repeat the same state after 30 simulated ticks.

Built the actual Earth pack and geographic model archives locally. Verified the 42 models’
210 runtime/LOD files by exact hashes in 21 regional archives. No pack was published.
Majapahit is now an explicit draft excluded from default Earth queries, with its existing
Qualla link updated to needs-review and no active placement. Its terrain fit remains unresolved.
The other 41 are placement previews; procedural footprint suppression remains disabled.
They are not newly certified as final live-world replacements.

The complete per-model evidence and limits are in [INTEGRATION-REVIEW.json](INTEGRATION-REVIEW.json).
Full Qualla reconciliation and Chatsworth’s new annotation still await the unrelated catalog
merge-conflict resolution. No Git mutations were performed; audit fixes remain in the working
tree for the owner.

### Stowe House and bounded completion sync — 2026-10-15

Stowe House is complete: all 33 current portable, shared-material/placement and medium-fi
frames were visually inspected against the local south-front and aerial originals, with two
local detail supplements and the conservation architect's north-front photo/description.
The main house, flanking links and pavilions, oval dome, six-column south portico and steps,
four-column north entrance and curved colonnades are represented. Service courts and garden
temples remain excluded. Final render review corrected glazing hidden behind blind-arch panels.
All four detail levels pass their budgets, source regeneration/import verification and schemas
pass, and repeated 30-tick simulation states match. Independent terrain is unchanged, with
about 1.2 m relief across the mapped footprint; footprint suppression remains disabled.
Completion is now **42/100**, including all five pilots; Majapahit remains an unfinished draft.

Added `sync-completed.mjs` for explicit, freshly verified local completions. It preserves
unselected associations and all curation, and never withdraws coverage. Changed stories,
identity/relocation conflicts, relevant malformed bundles and stale model evidence fail closed.
Five new safety tests and all 30 workflow tests pass. Stowe and Chatsworth's matching Qualla
stories were updated through locked transactions; a second check found zero changes.
Unrelated editorial fields and both conflicted catalog files were verified unchanged.
The full-corpus scan/reconciliation remains pending those unrelated conflicts; the bounded
completion sync does not certify corpus-wide freshness. See [COMPLETION-SYNC.json](COMPLETION-SYNC.json).

### Cadmans Cottage draft and next model — 2026-10-15

Cadmans Cottage is authored and imported, with all four detail levels (374/544/1,410/1,988
triangles), six materials and no photographic textures. Inspected both selected front originals
and one northwest roof/rear supplement, then all 32 current render frames (7 portable,
6 isolated shared-material, 19 medium-fi). The three-bay whitewashed original, two chimneys,
broken-back shingle roof and lower sandstone annex with two arched doors are represented.
Source/runtime verification, schemas and repeat 30-tick simulation pass. The source-local QA
rejects geographic contact: Terrarium rises only about 0.3 m at the rear center and leaves the
upper-floor west doorway floating; the photograph shows a raised cliff-side approach.
NSW public 5 m elevation export and point-sample requests timed out. No ground was flattened
or invented. Placement remains a draft, excluded from automatic Earth rendering; the model
is **not complete**. Progress remains **42/100**, with 44 authored and two terrain drafts.

Blue House (Hong Kong), order 45, is researched next. Individually inspected both selected
front originals and a courtyard supplement. Official heritage records confirm that all four
units 72–74A Stone Nullah Lane belong to Blue House, including its white-painted southern end.
Separate Yellow and Orange Houses remain excluded. The map footprint, pitched roof, front
cantilevered balconies/corbels, paired glazed doors, ironwork and modern rear access stairs
are the next geometry controls. Raw map and numbered review plot remain local in `.artifacts/`.

Final targeted checkpoint: all 44 local source/runtime/detail-level files and canonical
geographic registrations are present, both newly authored models regenerate/import exactly,
eight new LODs and strict medium-fi audits pass, 30 workflow tests pass, and touched-code
format/lint checks pass. Repo-wide source/path checks currently stop on missing generated
source/runtime GLBs for the separate-device `new_cathedral_linz` model. That unrelated
model was not generated or edited. This does not invalidate the targeted local-model checks;
repository-wide validation is not reported green at this checkpoint.

### Blue House completed — 2026-10-15

Blue House is complete: **43/100**, including all five pilots. Individually inspected the two
selected local street originals and courtyard supplement, then all33 current portable, shared
material/placement and medium-fi frames. The four72–74A units include white-painted74A,
three balcony tiers and corbels, ornamental ironwork, glazed doors, clinic canopy, shallow
pitched roof and own rear stairs. Separate Yellow/Orange Houses remain excluded. Final
review closed a side-cornice gap. Source10,826 triangles; LODs862/3,610/9,066/10,826 pass.
Exact regeneration/import, schema checks, strict medium-fi audit and matching30-tick states
passed. Official Lands Department5m DTM replaces unsuitable Terrarium ground; original
cells, EPSG2326/HKPD provenance and published±5m limits are retained without flattening.
Shop thresholds follow the roughly1m southward rise. Placement remains a preview with
footprint replacement disabled. Story annotation was written; repeated check found0 changes.
Flagstaff House is now authored and undergoing current capture review.

### Flagstaff House completed — 2026-10-15

Flagstaff House is complete: **44/100**, including all five pilots. The main house, deep
colonnaded verandahs, panelled upper rail, white louvres, dark sash framing, fanlight entry
and four-chimney hipped roof follow the inspected local exterior original and aerial context.
Mapped scope excludes the narrow passage and later K.S.Lo Gallery. All33 final portable,
shared-material/placement and medium-fi frames were inspected. Source14,912 triangles;
four authored detail levels meet budgets with four shared surface graphs and local glass.
Exact regeneration/import, source/scene/terrain/placement schemas and matching30-tick states
pass. Unmodified official5m DTM gives datum27mHKPD at the park-front forecourt, near-flat
front contact and about3m fall behind the house. Off-site foreground relief remains; the front
review camera was raised for visibility. Coarse±5m accuracy and partly unseen rear foundation
remain explicit. Footprint replacement is disabled. Story annotation write and repeat check
passed. Old Parliament House, Canberra, is being researched next.

### Old Parliament House draft and next model — 2026-10-15

Old Parliament House is authored and imported, with source52,778 triangles and detail levels
888/3,776/14,906/52,778. All35 current frames were visually inspected: eight portable, seven
isolated shared-material and twenty medium-fi, including the close north-front view. Corrected
arch/window panels hidden behind stepped front surfaces and preserved both narrow side
courtyards in the skyline recipe. Four independent court-center vertical paths pass at each
of four levels. Main ranges, paired chamber roofs, four courts, dark windows, low open porch,
steps, tall arches and simplified classical trim are represented. Five shared surface graphs
and local glass bind correctly. Exact regeneration/import, schemas, strict medium-fi audit,
LOD budgets and matching30-tick states pass.

The geographic review does not pass: the unchanged Terrarium ground has a broad central
bump and roughly6.9m relief across the footprint, producing uncertain north-front contact
and excessive exposed end foundations. ACT public service directory offered imagery only;
both documented Geoscience Australia5m LiDAR metadata endpoints returned403. No ground
was fabricated or flattened. Placement remains a draft excluded from automatic Earth display;
this model is not counted complete and has no ready story annotation. Completion stays
**44/100**, with47 authored and three geographic drafts.

Parliament House, Canberra, order48, is researched next. Inspected the selected local front
original, aerial roof/curved-wall context and the Parliamentary Education Office architecture
overview. Preserve distinct circular Senate and angular House roof forms, grassed slopes,
forecourt portal, skylights, side office courts and the four-legged flag mast. The ordinary
mapped parts are acquired, but anchor/scope and terrain contact remain to be authored.
Research records are in the batches/research directory.

### Parliament House draft and capture identity repair — 2026-10-16

Parliament House is authored and integrated with ordinary geographic paths and model identity.
Source54,425 triangles; detail levels975/3,671/15,679/54,425 pass. All35 current frames were
inspected: eight portable, seven shared-material and twenty medium-fi. The main wings and
nine courts, curved walls and architectural grass roofs, distinct chamber roof forms, open
marble entrance, forecourt basin and four-legged steel flag mast are represented. Four shared
surface graphs bind correctly. Exact regeneration/import, schemas and strict audits pass.
The ground intrudes into the reflecting pool and entrance paving; the initial research
reference lies inside that pool. Independent ground remains unchanged. Geographic contact is
not accepted, placement stays a draft, and no completion annotation is written. Progress is
**44/100**, with48 authored and four geographic drafts.

Visual inspection found a capture-fixture suffix collision: requesting Parliament House
selected Old Parliament House for the medium-fi frames. This was caught before approval.
The fixture now resolves exact canonical identity, and the driver verifies the browser's
asset ID, runtime bytes and selected LOD bytes before each screenshot. Version2 readiness
checks require that identity in every frame. All twenty corrected frames were recaptured and
inspected. An audit of all48 authored identities found no affected completed models. Two
identity tests, five readiness tests and all30 workflow tests pass; touched-code lint passes.
See MEDIUM-FI-IDENTITY-AUDIT.json. Taipei Guest House is the next model.

### Taipei Guest House completed — 2026-10-16

Taipei Guest House is complete: **45/100**, with49 authored and four geographic drafts.
The main Western mansion follows the confirmed local south-front original, hospital birdview
and north-garden supplement; official MOFA architecture text confirms the separate Japanese
bungalow, which remains excluded with its connector and the gardens. The selected Gongyuan
Road block has uncertain mansion identity and is context only. Corrected oversized main-roof
coverage that hid the central pediment/louvred attic and separated the rounded north room
from its wider structural terrace. Paired columns, open arcades, own entrance canopy/steps,
balustrades, mansards/dormers and green corner roofs remain recognizable. Heights, fine
ornament and partly unseen sides are photographic estimates.

All36 final frames inspected: eight portable, eight shared-material/placement, twenty medium-fi
with exact browser asset/runtime/LOD identity. Source43,706 triangles; levels984/3,990/14,640/43,706
pass budgets. Five shared graphs and local glazing bind correctly. Exact regeneration/import,
source/scene/terrain/placement schemas, matched30-tick states and16 independently chosen open
arcade/entrance paths pass. Independent Terrarium ground stays unchanged, with about1.6m
relief across the mapped envelope; own floors/plinths and low steps meet it in the bounded
preview. Coarse urban ground and hidden foundations remain explicit limits. Footprint
replacement stays disabled. Qualla story annotation written through the bounded completion
sync; repeat check found0 changes. Taipei Story House is next.

### Taipei Story House completed and local50 integration checkpoint — 2026-10-16

Taipei Story House is complete: **46/100**, with50 authored and four terrain drafts. Two
selected local2010/2016 originals guide the red-brick lower floor, yellow branching Tudor
timber, divided windows, white Ionic semicircular entrance balcony/steps, copper gables and
spired attic with coloured glass. One2006 frontal supplement resolved the curved rear rooflet;
its full depth/skirt and hidden rear openings remain estimates. Corrected timber at gable/window
edges, a balcony rear rail crossing the door approach and a gap beneath the rooflet. All36
final frames inspected, including exact browser asset/runtime/LOD identities for20 medium-fi
frames. Source7,510 triangles; levels998/3,142/6,390/7,510 pass budgets. Five shared graphs and
local glazing bind correctly. Exact generation/import, schemas, strict audits, matching30-tick
states and eight independent entrance/upper-balcony clear paths pass.

The source anchor uses the actual house polygon and museum POI; the article point is offset
toward a neighboring police station. Independent Terrarium ground remains unchanged, with
roughly0.8m relief across the mapped footprint. Own low steps and structural foundations meet
this bounded preview; hidden rear foundations remain approximate and footprint replacement is
disabled. Story annotation written. A combined repeat check for both Taipei completions found
zero changes. Gateway of India is next.

At the50-authored milestone, all50 source models regenerate exactly,150 source/scene/terrain
schemas pass, all50 runtime bundles and200 detail-level files verify,250 main/detail files are
included by the current runtime pack source, and repeated30-tick states match for all50 scenes.
All ordinary geographic identities/registrations pass; default Earth queries include46 previews
and exclude all four drafts. These are targeted integration checks, distinct from the historical
42-model full-build/archive audit. No new full engine CI, archive publication or Git mutation is
claimed. Current owner branch is bendymike-models10.15. Missing separate-device Linz outputs
still limit repository-wide source/path checks. See LOCAL-50-INTEGRATION.json.

### Gateway of India draft — 2026-10-16

Gateway of India is authored and integrated under its ordinary geographic identity. Source
21,468 triangles; levels996/3,920/14,100/21,468 pass. The selected local2016 complete city-front
original and2011 carved-pier detail, official architecture accounts and aerial roof/step context
guide the three pointed portals, projecting octagonal piers, four tiered turret crowns, carved
jali/cornice details, three shallow roof caps and own immediate base/sea steps. The2025 oblique
is obscured by scaffolding and was context only. Fine inscriptions and motifs, hidden joins,
rear details and exterior cap heights remain estimates. Nominal26m height and48ft central
roof diameter are controls; the official83ft dome-apex prose is not a resolved exterior datum.

Final review widened piers that had been buried in the main wall and opened the tall central
hall between the entrance arch faces. All35 final frames inspected: eight portable, seven
isolated shared-material and twenty medium-fi, each with verified exact asset/runtime/LOD
identity. Four shared graphs bind correctly. Exact generation/import, schemas, strict audits,
matching30-tick states and24 independently chosen main/side portal and hall clear paths pass.
Sidecar and all five runtime/detail files are included in the current runtime pack source.

Geographic contact does not pass. Unchanged coastal Terrarium ground spans about-5.47..+1.19m
across the mapped footprint, leaving the southwest wing/base unsupported and obscuring other
footing areas. No replacement ground or water surface was invented to hide the mismatch.
Placement stays draft and is excluded from default Earth queries; no ready story annotation
is written. Progress stays **46/100**, with51 authored and five geographic drafts. Hiroshima
Peace Memorial is next. The historical50-model integration audit remains a separate checkpoint.


## 2026-10-16 — Hiroshima Peace Memorial completed

Preserved ruined hall, open courtyard and windows, projecting entrance, oval masonry drum and bare steel dome authored from two selected originals, one focused rear original, official post-bombing drawings and mapped/aerial plan controls. Original roofs/floors were not reconstructed. All36 final frames inspected; exact regeneration/import, source/runtime and four LOD hashes, strict medium-fi, schemas, matching30-tick simulation and28 independent negative-volume checks pass. LOD triangles946/3998/10608/19374; four shared materials.

Official GSI1A terrain retained unchanged: all16641 bounded land-side samples valid; five original source tile byte hashes verified (5A fallback checked but unused). Foundation contact and north-up placement reviewed; preview active with footprint replacement disabled. Story hiroshima-peace-memorial-wp in catalog wyn5 annotated ready, all other story fields unchanged except the catalog manager timestamp; repeated sync finds zero changes. Batch47 ready/52 authored; five geographic drafts remain.


## 2026-10-16 — Washington Monument (Baltimore) completed

Unfluted marble column, square gallery/stepped terrace with four circular skylights, square abacus/lookout and draped Washington figure authored from selected night/figure originals, focused local colour gallery view, caretaker architecture account and mapped/aerial controls. Own circular iron enclosure and four approaches included; separate Lafayette/equestrian and park monuments excluded. All39 final captures inspected after correcting skyline gate obstruction, vent-like inscription bars, upper pedestal proportions, folded cloth normals and inward-facing sleeve surfaces. Exact source/import/runtime/four LOD hashes, strict medium-fi and Float32 geometry audits, schemas, repeated30-tick state and48 independent gate/stair clearance controls pass. LOD triangles912/3996/15968/44996.

Native Terrarium ground retained unchanged: datum29.993m at dry south path, gallery+.27..+.41m and own circular plinth edge+.04..+.24m. Own paving top+.55m/foundations-.8m meet the source grade. Preview active, footprint replacement disabled. Story washington-monument-baltimore-wp annotated ready in dqcx with curation unchanged except catalog manager timestamp; repeat sync zero changes. Batch48 ready/53 authored, five terrain drafts remain.

### Phoenix Shot Tower —2026-10-16

Completed and annotated its Qualla story. Inspected39 final frames using selected2015 tower, focused crown crop and2017 entrance image plus MHT dimensions and aerial controls. Rounded crown corrected; sparse openings/deep arched iron entry retained.4,342 source triangles;512/1,230/3,102/4,342 LODs;41 independent recess/crown checks. Native Terrarium contact reviewed unchanged. Exact generation/import, schema, pack membership, preview query, repeated30-tick states and strict material/LOD audits pass. Hidden windows/fine masonry remain estimates; footprint replacement disabled.

### Nusretiye Clock Tower —2026-10-16

Completed and annotated its Qualla story; batch now50 ready/55 authored. Inspected39 final frames against2012 silhouette,2024 clock detail and focused2024 restored full-tower original/crop plus Galataport caretaker record and aerial. Restored exposed lower stage, paired columns, two land/sea clocks and floral scroll crown retained; inward hour wedges and abbreviated skyline support repaired.56,852 source triangles;884/3,870/15,144/56,852 LODs;40 independent recess checks. Native Terrarium contact preserved unchanged. All55 authored models exactly regenerate and pass165 schemas,220 LOD hashes,275 runtime GLB memberships and repeat30-tick states;50 previews included/five drafts excluded. Fine ornaments/hidden elevations remain estimates; footprint replacement disabled.

### Kobe Port Tower —2026-10-16

Completed and annotated its Qualla story; batch now51 ready/56 authored. Inspected42 final frames against local2009/2019 originals, primary structural dimensions and actually viewed operator2024 roof/low terrace photos.32 straight pipes preserve the open hyperboloid; corrected low white panel band and retained five upper glazed tiers, cage, integral lettering/lightning tip.44,660 source triangles;1,000/3,620/15,016/44,660 LODs;67 independent lattice-gap/entry checks. Original GSI5A ground/two tiles/all16,641 valid samples preserved unchanged. Exact generation/import, schemas, pack membership, default preview query, repeat30-tick states and strict material/LOD audits pass. Exact gauges/cage/window details and entry azimuth remain estimates; footprint replacement disabled.

### Kyoto Tower —2026-10-16

Completed and annotated its Qualla story; batch now52 ready/57 authored. Inspected42 final frames against selected2016 dusk/night originals, focused2016 daylight/2019 observation detail, mapped height hierarchy and aerial own-roof context. Smooth white shell, two glazed tiers inside orange-red curved cage, dark lower bowl and nine-storey hotel podium retained. Smoothed cage ribs, varied room glazing/curtain tones and cut actual south entry.48,590 source triangles;990/3,516/15,840/48,590 LODs;47 independent cage-gap/entry/window checks. Original GSI1A ground/three tiles including unused5A fallback/all16,641 valid samples preserved unchanged. Exact generation/import, schemas, pack membership, default preview query, repeat30-tick states and strict material/LOD audits pass. Rear facades, room pattern, rib gauges/count and roof boxes remain estimates; footprint replacement disabled.

### White Tower of Thessaloniki —2026-10-16

Geometry/material/LOD review passed after inspecting41 current frames and67 independent door/window/corbel controls.32,212 source triangles;998/3,810/15,854/32,212 LODs. Corrected detail crossing recesses, restored cordon and closed spandrel gaps. Local2019/2015/2011/2006 originals and museum roof detail control weathered stone, brick battlements, arched gallery and pointed entry; official33.9m/21.7m control scale. Native coastal Terrarium ranges-2.667..-.071m under mapped footprint and leaves southwest footing unsupported. Ground unchanged, placement draft/default Earth excluded; no completed story annotation. Batch remains52 ready/58 authored.

### Tower of the Winds —2026-10-16

Completed and annotated; batch now53 ready/59 authored.42 final frames inspected against selected2008 original, focused surviving porch/annex/relief photos, archaeological primary text and mapped/aerial controls. Missing porch roofs/full columns and bronze Triton not restored.24,742 source triangles;876/3,976/15,924/24,742 LODs;29 independent door/porch/vent/open-annex controls and24 outward roof normals. Corrected roof winding, restrained annex damage and added relief depth. Original Terrarium terrain retained unchanged; north approaches below.9m thresholds, higher west/south grade meets lower steps/annex, preview bounded with footprint replacement disabled. Exact generation/import, schemas, pack/default query, repeated30-tick states and strict LOD/material checks pass. Fine sculptural contours, total elevation/courses and site grade accuracy remain estimates.

### Grand Central Terminal —2026-10-16

Completed and story annotated;54 ready/60 authored. Official NYC BIN1035381 footprint91.584x87.720m separates own walls from the wider121x104m map/viaduct boundary. Local2019/2012 photographs, operator2010 section and aerial control the three great south/side arches, ten columns, oval windows, clock/sculptures and green/light roof masses. Corrected inward roof/plate winding.58,566 source triangles;794/3,840/15,974/58,566 LODs.42 final views inspected;52 recess/area-way controls and72 roof direction controls pass. Native Terrarium retained unchanged; below-grade granite base meets own footprint-.784..+1.151m, bounded preview with footprint replacement disabled. Exact regeneration/import, schemas, pack/default preview, matching30-tick states and strict geometry/material checks pass. Sculptures/hidden faces/thresholds remain estimates; neighboring viaduct/MetLife/towers/underground tracks excluded.

### Hoboken Terminal —2026-10-16

Completed and story annotated;55 ready/61 authored. Selected2010/2015 local originals, three focused2010/2011/2012 photographs, official NPS plans, NJ TRANSIT/STV records and independent mapped room/terminal outlines control the six open elliptical ferry slips, five rear gabled pavilions/open lower arcade, own rail waiting room/north vestibule and225ft replica tower. Corrected hidden clock faces, missing north vestibule and false lower-arcade glazing.60,537 source triangles;764/2,957/15,595/60,537 LODs.48 final views inspected;76 passage controls and96 roof direction controls pass. Original USGS1m NJ_NE6County_B23 raster48017 retained and sampled unchanged; dry datum1.3136m outside north canopy. North entry/approach+.004..+.099m remains clear. Marine returns are hydroflattened water, not seabed/tide; pile embedment and fixed gangway poses remain estimates. Own geometry excludes western platforms/train sheds and neighboring baggage/YMCA/Pullman. Exact generation/import, schemas, runtime pack/default preview, matching30-tick states and strict geometry/material/LOD checks pass. Footprint replacement disabled; bounded visual preview, not marine engineering verification.

### Clevedon Pier —2026-10-16

Completed and story annotated;56 ready/62 authored. Eight inspected local2007–2013 originals, attributed supplementary2009 tollhouse original, primary Historic England/operator records and independent pier/head/tollhouse mapping control the open eight-arch iron neck, timber benches/deck/globe lamps, three separate glazed shelters, raised central pagoda/front diagonal stair, true landing-stair floor openings and narrow castellated tollhouse. Corrected shelter quarter-turn, continuous-pyramid roof, duplicate side stairs, dark glazing and tollhouse corner/entry gaps.44,628 source triangles;964/1,902/15,488/44,628 LODs.48 final views inspected;48 opening controls and484 sloped-roof direction controls pass. Native Terrarium four original tiles retained unchanged; dry datum15.8501m,209 entry samples top+.4511m below deck.55m. Mapped pier outline-21.797..+.0072m stays above fixed-25m support bottom; tollhouse base-5m meets local grade. Marine tide/seabed/pile embedment remain unverified; fixed landing levels and estimated35m station spacing are bounded approximations, with conflicting nominal100ft spans/historical842ft lengths explicit. Selected era excludes later Glass Box/Bell Room infill and neighboring hotel. Exact generation/import, schemas, runtime pack/default preview, matching30-tick states and strict geometry/material/LOD checks pass. Footprint replacement disabled. Distant white silhouette has low contrast; portable dark profiles and forced-LOD views provide clearer outline evidence.

### Penarth Pier —2026-10-16

Completed and story annotated;57 ready/63 authored. Eight individually inspected local originals (one pre-restoration comparison only), two primary architect external photos, primary Cadw/operator records, aerial and independent map control the restored four-domed1929 pavilion, barrel roof/four tall dormers per side/diamond grilles, seaward colonnade/two terraces, concave shop wings/projecting clock, surviving iron/concrete pier/two open side-porch shelters/head hut/fixed landing stair. Corrected roof cuts/recesses, crossed braces, high gable windows/porches, long-head width and shore foundations. Original map deck ring retained; four authored bulge vertices widened up to1.3m to cover independently mapped shelter walls/porch floors.48,790 source triangles;998/1,614/15,812/48,790 LODs.51 final views inspected;56 opening controls and3440 roof direction controls pass. Independent Welsh Government1m DTM/DSM survey2022-04-01 retained as four lossless native TIFF windows, exactly matching original Float32 cells/hashes. Rejected Terrarium16m absolute ocean plateau and all4 original tiles retained unchanged. Dry datum8.4271m; DSM deck median9.0200m/ridge19.2m/dome22.3m guide proportional heights; DSM never used as ground. Dry entrance-.0242..+.0372m clears steps/deck. Own deck grade-12.879..-3.129m stays above fixed support bottom-15.5m; shore-wing samples-3.673..+.0806m meet fixed-8m foundations. Hidden foundations/tide/seabed/landing operation remain approximate. Exact generation/import, schemas, runtime pack/default preview, matching30-tick states and strict geometry/material/LOD checks pass.25 actual medium-fi identities verified. Distant white silhouette has low contrast; dark portable profiles/forced-LOD views provide clearer evidence. Lost1931 wooden theatre and neighboring promenade buildings excluded; footprint replacement disabled.

### Saltburn Pier —2026-10-16

Completed and story annotated;58 ready/64 authored. Five individually inspected local originals plus25-image reference sheets, primary pier/entrance listings, current aerial and two rendered existing council elevation/site sheets control shortened open-ended pier/20 triple raked iron pipe trestles, grey timber deck/black curved posts/four white rails/kickboards, two paired side bays/benches and integral three-gabled cream/burgundy1925 entrance arcade. No end shelter survives in the inspected evidence; original draft scope and earlier1250ft story length corrected for this model. Three pitched slate ranges/taller central ridge, true perforated terracotta cresting, diamond panels, projecting bays and clear through doorway retained. Fixed intrusive doorway framing, duplicate rail-joint posts/missing shore rail and bench facing/positions.44,354 source triangles;962/3,528/11,818/44,354 LODs.48 final views inspected;104 open-volume controls/66 roof direction checks pass;24 actual medium-fi identities verified. Four original Terrarium tiles unchanged/hash-verified; dry datum5.6524m and native8m grid have about-.126m contact interpolation difference. Own pier grade-6.596..-.816m clears deck.3m and fixed pipe bottoms-8m.459 apron samples grade-.663..-.107m meet fixed-1.5m edge; plain entrance apron is explicitly estimated paving, not surveyed ramp detail. Source/runtime GLB ray hits confirm correctly wound deck tops atY.3. Default giantY0 shared stage occluded that low deck; isolated backdropY-8 exposes full deck/supports without changing actual geometry, native terrain, placement or sampler. Synthetic backdrop is not sea/tide/seabed evidence. Nominal207m versus mapped201.5m open deck/216m with arcade/220.5m platform definitions remain explicit. Exact generation/import, schemas, strict materials/LOD, runtime pack/default preview and matching30-tick states pass. Lost offshore length, cliff lift/neighbors/interiors excluded; footprint replacement disabled.

### Santa Monica Pier —2026-10-16

Completed and story annotated;59 ready/65 authored. Eight individually inspected local originals plus33-image contact sheets, current aerial, NPS/Conservancy descriptions and current wheel operator control combined native pier platform/neck/head, timber piles/X braces/teal rails, peach/blue three-tower arched Looff carousel with concave tent roof/cupola, static current20-gondola Pacific Wheel/yellow twin-helix coaster and integral main roof/head restaurant/harbor-office masses. No obsolete onion dome or pre2008 wheel details. Corrected wheel diagonal, high/low head deck/stair notch and matching rail/pile top elevations; explicit931/3691/15970/63926 LODs replace reductions that lost structure. Reverse-side thin wood/metal strokes explicitly have both face directions for shared binding visibility.51 final views inspected/25 actual medium-fi identities verified;45 actual runtime geometry controls and1170 outward sloped roof triangles pass. Four original Terrarium tiles unchanged/hash-verified; dry datum5.706m,17m review grid, exact dry reference interpolation-.021m. Native outline ground-5.991..+.698m clears deck3m/fixed pile bottoms-10m; lower native landing ground-5.818..-5.595m clears1.4m deck. Exact source/import/schema/strict LOD/material, runtime pack/default preview and matching30-tick states pass. Fine facade/hidden faces/coaster chainages and marine tide/seabed/embedment remain estimates; no terrain fitting, photo pixels, surrounding city or bridge-replacement proposal.65-model milestone source reproduction/195 schemas/260 LODs/325 GLB pack members/65 repeated simulations and59 active previews pass.

### Ryman Auditorium —2026-10-16

Completed and story annotated;60 ready/66 authored. Eight individually inspected local originals plus19-image contact sheets, aerial and primary NPS/architect/owner descriptions control historic red-brick Gothic auditorium, sloping limestone base, twin deeply recessed shallow-pointed front portals/independent stairs, grouped lancets/white belts/piers/tablet, front traceried gable and paired colored side lights. Boarded rear gable light follows primary description; separate native rear wing/copper-screen open entrance and glazed pavilion remain subordinate. Corrected portal curves, stone lines/bands crossing side openings and rectangular rear service envelope. Four explicit994/3991/15141/63051 levels validated;59 actual runtime cavity/recess/perforation/roof-height controls and352 outward sloped roof triangles pass.51 current views inspected/25 medium-fi identities verified. One unchanged original Terrarium tile/3m grid, dry sidewalk datum137.5265m; all native outlines ground-2.484..+.707m clears fixed foundation-4m and floor.9m. Exact source/import/schema/strict LOD/material, runtime pack/default preview and matching30-tick states pass. Ryman story catalog annotation written and repeat check0 changes; all unrelated curation preserved. Fine tracery/trim/perforation pitch, roof/threshold heights and rear faces are proportional estimates; no terrain fitting, photo pixels, interiors, adjacent towers or footprint replacement.

### Royal Albert Hall —2026-10-16

Completed and story annotated;61 ready/67 authored. Nine individually inspected local originals and38-image contact sheets, current aerial and primary Historic England/MOLA2020building record control five-stage red-brick/buff-terracotta oval, square/round window rings, pilasters/cornices, recessed fourth-stage balcony/open balusters, dark mosaic band with original abstract figure rhythm, upper drum/gridded radial dome/30pediments/low central oval lantern. Three large arched N/E/W porches and smaller pedimented/oculus south porch retained. Corrected blank porch sides, shallow balcony depth, concave frieze triangulation and misread Door9 inner threshold. South lower central arch remains proportional reconstruction from1986comparison and partly screened2014south view; separate memorial/large public south steps excluded. Explicit953/3865/15865/62969 LODs pass all hard ceilings; an over-budget automatic street derivative was replaced.71 actual runtime recess/oculus/balustrade/roof controls and15508 outward sloped roof triangles pass; all four Float32 meshes/actual street valid.51 current views inspected, final forcedstreet view re-inspected while other contact sheets pixel-identical to just inspected final iteration;25 actual medium-fi identities verified. Two unchanged original Terrarium tiles/3m grid, dry north sidewalk datum18.3328m; all retained native rings ground-.381..+.149m clears foundation-3m/floor.45m, dry interpolation-.00033m. Exact source/import/schema/strict LOD/material, runtime pack/default preview and matching30-tick states pass. Royal Albert Hall story catalog annotation written and repeat check0 changes; unrelated curation preserved. Fine frieze/trim/roof profiles/window chainages/thresholds remain estimates; no photo pixels, interior, basement, neighboring buildings/chimney/memorials/scaffolds or footprint replacement.

### Apollo Theater —2026-10-16

Completed and story annotated;62 ready/68 authored. Nine individually inspected Qualla originals and24-image contact sheets, primary1983LPC1299exterior description and current aerial control the dated2013–2019frontage: four bays/five colossal pilasters, two recessed square/transomed window tiers, fluted shield/meander spandrels, Ionic scrolls/modillion cornice/open parapet. Western recessed four-door entrance under half-width marquee with blue bands, pale static panels, soffit bulbs and two short-side APOLLOcaps; eastern same-building shop/yellow outline fascia. Double-sided geometric APOLLOblade/counters/tube strokes on open three-tier steel trestle/Vsupport. Exact six-vertex native L-shaped historic footprint and stepped flat roof masses; Victoria/new spaces/neighbors excluded. Corrected cap see-through backs, brick-patterned entrance floor and overly bold fascia lettering. Explicit988/3378/11010/15818 LODs meet all ceilings;66actual runtime window/entry/scaffold/counter/parapet/roof controls and82upward roof triangles across4sources pass, Float32normals/winding/color valid.51current views inspected/25actual medium-fi identities checked. One unchanged original Terrariumtile/2mgrid/source3.616mpixels; dry eastern sidewalk datum8.7256m, native footprint-.01462..+.26820m clears fixed-3mfoundation/.4mfloor, dry interpolation-.000146m. Exact regeneration/import/schema/strict LOD/material, pack/default preview and matching30-tick states pass. Story annotation written and repeat check0changes; all other catalog curation preserved. Heights/roof steps/fine ornament/hidden walls remain estimates; no photo pixels/event artwork/interiors/neighboring structures/footprint replacement.

### Castro Theatre —2026-10-16

Completed and story annotated;63 ready/69 authored. Eight individually inspected local originals/23contact images, current aerial and primary2023SFlandmark description/PDFp49facade+foyer photos control native broad-front/narrower-rear concrete shell, three-part white/buff stucco face/tall arched grid light/scroll parapet/shell niche/oval/small balcony lights, original abstract cartouche/garland/foliage relief. Native trapezoid1937marquee with blankboards/red-blue-gold zigzags+hexagons/central CASTROcrest/bulbs and two-sided CASTROblade/white channel letters/edge scrolls/crown/diamond. Real arcade ceiling/recesses/five glazed doorpairs/faceted island booth with projecting cap/cream-blue base; same-building shop awnings. Fixed hidden relief, lettering/pattern clash, missing ceiling/backing, false flush poster panels and hidden booth panel overlay; retained open blade attachment gap. Explicit999/3974/11422/31920LODs meet all ceilings/eightmaterials; district retains high roof service parts within1merror.160actual-runtime controls include96floor/independent terrain clearance samples(.0609..+.0999m), recesses/sign counters/ceiling+roof caps;24source rooftriangles upward/Float32winding+normals valid.51current views inspected/25actual medium-fi identities verified. Two unmodified original Terrariumtiles/2mgrid/source3.777mpixels, dry north sidewalkdatum43.5497m, native footprint-2.177..+.145m/foundation-5m. Sloping arcade paving and shop thresholds follow independent broad grade+.075m; exact interior-floor/threshold engineering remains unmeasured, no terrain fitting/flattening. Exact source/import/schema/strict LOD+material/pack/default preview/matching30tickchecks pass. One story annotation written/repeatcheck0changes/all other catalog curation preserved. Dated2008–2016exterior supplemented2019facade/2022arcade; no post-renovation2026finish claim, actual poster/art/photo pixels/interiors/neighbors/footprint replacement.

### Grauman’s Chinese Theatre —2026-10-16

Completed and story annotated;64 ready/70 authored. Nine individually inspected full local originals/33contact images, current aerial and primary preservation record control native auditorium/open curved court and single swept green pagoda entrance/coral square columns/stepped pale-coral caps/open-mouth bronze masks. Original geometric dragon/guardian relief, gold double doors flanking actual dark central passage/small canopy/sun disk/gong/grid ceiling, wing window grids/curved red band, paired street gateway blocks/faceted bronze spires/CHINESEblades and inward niches/flame-bell plaques. Fixed inward-facing court artwork, downward paving, missing eave underside, false masonry-like shared stucco, concealed cap panels and incorrect closed center entrance. Refined dark recessed mouth/physical dragon body/head/spikes and restrained small slab pattern. Four explicit1000/3978/15930/35706LODs meet ceilings/7materials;179actual-runtime controls include140paving clearance samples(.0535..+.1014m), open court/portico/central passage/prong gaps/mask mouth and roof/ceiling/arch recess. Four authored and four runtime Float32meshes validate,2928roof and4206paving triangles upward across levels.51current views actually inspected/25actual medium-fi identities verified. One unchanged Terrariumtile/2mgrid, dry south sidewalkdatum118.5639m, native footprintground-.264..+3.052m/foundation-3m; no terrain fitting. Exact source/import/schema/strictLOD/material/pack/preview/repeat30tickchecks pass; one story write/repeatcheck0/catalog curation preserved. Native own44vertexplan/mapped18.1mauditorium and nominal90ft(27.432m)pagoda top control scale; roof sweep/fine sculpture/gateway proportions/heights/threshold engineering remain estimates. No handprint/landscape microdetail/actual advertising/photo pixels/modern neighbors/interior/footprint replacement. All70authored local models pass source/runtime/280LOD/210schema/350runtimeGLBpack/repeat-state integration; all67current story links for64ready models pass read-only association audit. Six terrain drafts stay excluded and structureCatalogownership clear.

### Spreckels Organ Pavilion —2026-10-16

Completed and story annotated;65 ready/71 authored. Seven individually inspected local originals/28contact views, current aerial, City floor-plan diagram and primary2012historic report text/actual physicalpp108–109 photographs control native central organ enclosure and curved paired-row Corinthian peristyle/terminal pavilions. Chosen closed shutter, giant pierced floral arch with six-petal rosettes/open almond links/radial supports/raised moldings, original simplified shell/leaf/scroll relief and plain inset plaque/door bays; curving parapet/urns, paired side window recesses/mullions/round louver/crest and inset barred gate. Actual open colonnade bays/ceiling/floors/turned roof balustrades, terminal segmental portals/stairs and separate stage approaches. Fixed hole boundary filling arch, concealed shutter bottom, false flush gates, filled terminal intrados and leaf strokes crossing rosette holes.893/3999/15767/57983explicit LODs meet all ceilings/7materials;278actual-runtime controls include132near-LODpetal counters/open bays+terminal passages/recesses/roof+floor+ceiling+intrados/stair contacts.204upward source roof triangles/four authored+four runtime Float32meshes validate.51current views actually inspected/25actual medium-fi identities verified. One unchanged original Terrariumtile/3mgrid/source4.0188mpixels, datum80.7054m at dry audience approach[0,4], floor+.55m/foundation-4m. All4225grid samples recomputed from original pixels with<.0001merror; original-pixel datum likewise verifies. The retained coarse grid interpolates-.0616m at reference; no datum/terrain adjustment. Nine shallow stage/eight terminal treads continue below ground, lowest visible tread clearances+.0106..+.1681m; exact visible counts/threshold engineering remain approximate. Native65vertex combined U-plan/main23.109×11.805m/nominal23mheight control structure; City schematicstage/plaza dimensions are comparisons only. Fine sculpture/heights/column rhythm/roof service/rear detail remain estimates; no interior/pipe reconstruction/benches/plaza/fountain/neighbors/art text/footprint replacement. Exactsource/import/schema/strictLOD+material/pack/defaultpreview/repeat30tick checks pass. One story annotation written/repeatcheck0/all tile curation preserved; all68current links for65ready models pass read-only association audit. Prior full70integration retained; structureCatalogcandidate/collection overlap0.

### Belfry of Ghent —2026-10-16

Completed and story annotated;66 ready/72 authored. Eight individually inspected local originals/27contact views, current aerial and official heritage/operator records control native Gothic tower, attached eleven-bay ClothHall and small Mammelokker entrance. Three paired lancet stages/seven stringcourses, actual pointed bell openings/skeletal gold Roman clocks/pierced balcony, projecting polygonal turrets/hourglass shutters/slate spires/weather poles/watchmen/gargoyle silhouettes and open gilded crown/original dragon. Hall actual Gothic cross-window recesses/stone blind tympana/buttresses/stepped and timber dormers/pinnacles/south gable and split stair; annex curved gable/oval recess/barred inset door/original abstract paired relief and closed pitched-roof sides. Fixed hidden turrets/wrong annex projection/concealed gable windows/inward gable-stair direction/missing blind window heads/roof-side gap/hidden upper frieze. Explicit977/3983/15348/51950LODs/7materials;187actual-runtime controls cover clock/arch/balcony openings, exposed window/annex recesses, all16turret profiles, roofs/gallery/stair contact and closed annex roof underside.725upward source roof triangles/four authored+four runtime Float32meshes validate.51current views actually inspected/25actual medium-fi identities verified. Two unchanged Terrariumtiles/2mgrid/source3.003mpixels, datum14.151m atdrytowerwestapproach[0,-10], native ground+.0458..+.6697m/foundation-3m. All4225grid samples independently verified from originals(maxerror<.00005m); datumerror-.0000193m. First visible stair treads clear ground+.1797..+.2493m; other lower treads may be buried. Native tower15.6×12.1m/hall42.5×12.7m/nominal95mtop/16meave/25mridge; operator/native95m conflicts withQualla91m/Cityanecdote101–103m. No survey claim. Fine sculpture/window/crown/stair engineering remain approximate; no interiors/neighbors/market pavilion/square/fountain/photo textures/footprint replacement. Exactsource/import/schema/strictLOD+material/pack/defaultpreview/repeat30tick checks pass. One story annotation written/repeatcheck0/alltilecuration preserved; all69current links for66ready models pass read-only audit. Prior full70integration retained; all100structureCatalogcandidate/collection overlap0. Next local model:DomTowerofUtrecht.

### Dom Tower of Utrecht —2026-10-16

Completed and story annotated;67 ready/73 authored. Ten individually inspected local originals/23contact views, City stage dimensions and native tower/passage outlines control the detached two-square-stage tower/open octagonal lantern/short slate cap and original gilded StMartin vane. Recent2024post-restoration photograph confirms scaffold-free appearance; aerial with older scaffolding used only for site/footprint. Native lower~19.5×19.5m/second~16.8×16.6m; official stage heights38.6/68.08/94.08m/roof106.75m/vane112.32m. Historical23×23mfoundation excavation and proposed126mspire do not control exterior size. Actual flared pointed ground passage/deep layered moldings/physical ribs, recessed blind Gothic panels/quoin rhythm, open bell bays/mullions/louvers/ties, skeletal green/gold Roman clocks, pierced galleries/pinnacles, divided open lantern lights/corner buttresses/gables, open green roof rail/cross/vane. Fixed flat portals/low band across entrance/zero-thickness ribs/closed upper rail. Explicit996/3976/15942/59614LODs;460actual-runtime controls,152upward source roof triangles and all4authored+4runtime Float32meshes pass.51current views actually inspected/25actual medium-fi identities verified. One unchanged Terrariumtile/2mgrid/source2.935mpixels, datum13.5078m atdryeastapproach[13,0], native ground-.6261..-.0514m/foundation-4m. All4225grid samples verified from original pixels(maxerror<.00005m); datumerror-.0000171m. All60runtime passage-floor samples clear unchanged ground+.0438..+.0603m. No fitted terrain/cathedral nave/neighbors/visitorreception/square/scaffolding/interiors/photo textures. Fine ornament/threshold/rail/crown dimensions and individual2024repair blocks remain approximate. Exactsource/import/schema/strictLOD+material/pack/defaultpreview/repeat30tick checks pass. One story annotation written/repeatcheck0/alltilecuration preserved; all70current links for67ready models pass read-only audit. Prior full70integration retained; all100structureCatalogcandidate/collection overlap0. Next local model:TribuneTower.

### Tribune Tower — 2026-10-16

Completed and story annotated: 68 ready, 74 authored. Inspected six full local originals and 29 contact views, including the 2021 conversion aerial, upper crown and ground details. City/CAC/SCB/CTBUH records and native historic tower part 35184499195870 control the scope. The 20 m whole-complex outline is context only. The model excludes the Radio/TV/printing-plant buildings, new glass wings, court/pool, proposed Tribune East, neighboring buildings, statue and interiors.

The limestone shaft has raised piers, real recessed divided glazing, dark spandrels, rounded window heads and a Gothic base with a pointed entrance, bronze doors and glazed tympanum. Reworked the crown with clustered piers, a central divided upper light and blind flanks, stepped pierced screens, curving tracery, canopies, eight real open flying buttresses, pinnacles and simplified gargoyles. It retains a flat cap and flagpole. Fine sculpture, embedded-fragment identities, intermediate heights and threshold engineering remain approximate. Nominal CTBUH architectural/occupied/tip heights are 141.7/123.7/145.8 m; native 141 m and Qualla 462 ft differ slightly.

All 51 final views were inspected; all 25 version-2 frames verify the canonical Chicago asset and correct level. Oakland Tribune Tower remains a distinct asset. Explicit levels contain 935/3921/15386/59462 triangles. All 840 actual-runtime controls, four authored and four imported Float32 mesh checks, and 108 upward roof triangles pass. Exact source/import, strict LOD/material, schema, asset inspection, repeat 30-tick state, pack membership and default preview query checks pass.

One unchanged Terrarium tile and 2 m review grid establish datum 179.622 m at the dry west Michigan Avenue approach [-19,0]. Independently verified all 4,225 samples from original pixels, original SHA, native datum and PNG16 round trip. Native perimeter ground spans -0.0196 to +0.0934 m; footing reaches -4 m; 96 runtime ground-closure controls pass. Online map image capture failed; orientation instead uses the inspected local aerial and photographs. Footprint replacement remains disabled.

Wrote one story annotation; repeating the check changes nothing. Preserved all catalog curation. All 71 current story associations for 68 ready models pass a read-only audit. All 100 local targets remain clear of structure-catalog candidate and collection ownership. The full 70-model integration report remains authoritative; the next full milestone is 75 authored. Next: Freedom Tower, Miami.

### Freedom Tower (Miami) — 2026-10-16

Completed and story annotated: 69 ready / 75 authored. Eight individually inspected local originals and 35 contact views support the historic tower, Mediterranean base and directly attached plain west printing wing. NPS nomination pages 4, 5 and 8 were read and visually inspected; CTBUH nominal heights and owner/heritage restoration records were read. The linked 2026 award portrait was rejected as exterior evidence. Nominal 86.3m overall, 64.9m highest occupied and 19ft restored vane controls differ from Qualla/native map heights; intermediate geometry remains an estimate.

The model includes recessed divided windows, corner quoins, bracketed cornices, a raised six-riser east entrance, original closed oak doors and glazed fanlight, paired columns, scroll pediment/cartouche, simplified figures, iron balcony, glazed quatrefoils, pierced balconies/parapets and obelisks. The crown has four open corner turrets, a decorated square stage, true open lantern arches and oculi, turned balustrades, paneled green copper dome, open beacon and geometric ship vane. Repairs corrected downward roofs, unsupported upper stages, blocked openings and entrance/window misalignment.

Four explicit LODs contain 949 / 3571 / 15865 / 48481 triangles. Seven authored material groups use four shared identities. All 710 actual-runtime geometry controls pass, including 48 upward authored roof triangles, actual window recesses/closures, upper negative spaces, support plinths, ground closures and entrance treads. All 51 current renders were actually inspected; all 25 medium-fi frame identities verify the canonical asset.

Four unchanged original Terrarium tiles produce the independent 2m grid with 4.302m source pixels. All 4225 samples, native datum and PNG16 round trip verify. Ground spans −0.3532 to +0.4163m relative to the 2.5325m dry eastern datum; the foundation extends to −4m. Actual stair clearances are 0.1641–0.7855m. Rectangular shaft/crown planes deviate at their corners by at most 0.3172m/0.3546m from the preserved native outlines. Ground was not fitted or flattened. No neighboring campus, transit, plaza, statue, interiors, event scaffolds or photographic textures. Fine sculpture, exact restoration finish and threshold engineering remain approximate.

Source/import/strict LOD and medium-fi checks, schemas, asset inspection, repeated 30-tick states, runtime packaging and default preview queries pass. Footprint replacement remains disabled. One bounded story annotation write; repeat check zero; all story curation preserved. All 72 current associations for 69 ready models pass, and all 100 local identities remain outside the other-device candidate and collection lists. Full 75-model integration review is being recorded separately. Next local model: Buckingham Palace.

### Local 75-model integration milestone — 2026-10-16

All 75 authored local models passed targeted source regeneration and import verification, 225 schema validations, 75 verified asset bundles, 300 strict detail-level file checks, runtime packaging and repeated 30-tick state comparisons. A forced source and detail-level rebuild reproduced all 525 checked source/runtime/sidecar files exactly. All 69 approved previews are returned by default geographic queries; the six earlier drafts remain excluded. All 72 current story associations for 69 ready models pass. All 100 local targets remain outside the other-device candidate and collection lists. The detailed evidence is in [LOCAL-75-INTEGRATION.json](LOCAL-75-INTEGRATION.json). The 100-model goal remains active.

### Buckingham Palace — 2026-10-16

Completed and story annotated: 70 ready / 76 authored. Four full local originals (2020 east front, 2019 garden front, 2025 exterior and 2008 Ambassadors’ Court) and all 78 reference contact views were inspected. Interiors, the Shenzhen replica and unrelated landmarks were rejected as exterior controls. Owner dimensions and Royal Collection/primary architectural records support the interpretation. Aerial pixel capture was unavailable and is not claimed. Owner records place the balcony in the 1847–1849 east wing, conflicting with the story’s 1913 claim; story content remains unchanged.

The individual palace preserves three native courtyard voids and excludes the separate Royal Mews, memorial, gates and neighbors. The pale east facade follows the 3:7:3:7:3 rhythm, with giant Corinthian orders, three pediments, actual carriage passages, recessed divided glazing and ceremonial balcony. The warm garden front has the native circular five-window bow, shallow copper half dome, own raised terrace, conservatory and original simplified frieze relief. Ambassadors’ Court has an actually open temple porch: its mapped six-metre solid projection was interpreted as free columns and roof above an own platform and steps, with its low body wall recessed behind.

Repairs removed channels crossing the gateways, overlapping window/arch holes, hidden distant glazing, unsupported columns, an incorrectly placed porch and excessive curve simplification. The final limestone material replaces overly weathered ancient-stone coloring. All 51 current renders were actually inspected, including refreshed medium-fi views after a metadata-only draft-to-preview label correction; all six model files remained byte-identical during that correction. All 25 canonical medium-fi frame identities verify.

The four explicit levels contain 993 / 3993 / 15844 / 63641 triangles, with one / six / six / seven draw calls. All 1033 actual-runtime geometry controls and all 1110 upward authored roof triangles pass. Four unchanged Terrarium tiles, all 37249 independent samples at 2m spacing, the 6.4092m dry eastern datum and PNG16 round trip verify. Native ground spans −1.1735 to +0.4693m; foundations extend to −4m. Actual steps, porch negative space and authored perimeter ground closures pass. Thin courtyard paving covers the exact 5092.6183531m² area: all 1316 runtime triangle centroids clear native ground by 0.0358–0.0583m, with no terrain changes or clipped floor islands.

Source/import, strict detail-level and medium-fi audits, schemas, asset inspection, repeated 30-tick states, runtime packaging and default preview queries pass. Fine sculpture, unseen service facades, intermediate dimensions, the bare flagstaff and threshold engineering remain estimates. Footprint replacement is disabled. One bounded story annotation write; repeat check zero; all curation and unrelated stories/associations preserved. All 73 current story associations for 70 ready models pass. All 100 targets remain outside other-device candidate and collection lists. The completed 75-model integration milestone is retained. Next local model: Château de Chenonceau.

### Château de Chenonceau — 2026-10-16

Completed and story annotated: **71 ready / 77 authored**. Seven full local originals were individually inspected, including the actual 2025 west aerial, 2006 west view, 2007 north entrance, 2012 east/north view, 2014 tower/approach and two 2009 terrace/bridge views. All 61 candidate contacts were reviewed; interiors, other châteaux and historical/unbuilt proposals were rejected as exterior controls. The owner’s architectural description and modern guide/plan corroborate the five-arch bridge and detached tower. The guide’s 60×6m and 18-window figures describe the interior room; native exterior geometry was not rescaled to them.

The individual site includes the river house, gallery, five actual principal arch voids, separate mill boat passage, pointed-glazed chapel, east study, conical corner turrets, tall chimneys, roof valley and open clock lantern. Nine gallery windows/oculus dormers per face, round window bays and upper lookouts align with native piers. Detached Marques Tower retains its corbelled upper floor, stair turret, cone, chimney and open cupola. Own retaining terrace, paving, well, arched entry bridge, supported balcony and six treads are included. Gardens, service houses, interiors, people, landscape and photo textures are excluded. Minor service apertures and fine carving remain simplified.

**Terrain limitation retained:** the original two-tile Terrarium baseline does not resolve the raised terrace and river channel and would bury the arches. It is preserved as rejected evidence. Before geometry, unchanged official IGN RGE ALTI provider responses supplied 25921 independent values on a 2m grid, a 60.84m dry terrace datum and river surface about 6.52m below it. All six exact requests and six original responses are retained and hash-checked. Effective native resolution and surveyed accuracy are unspecified; provider values are rounded to 0.01m. No ground fitting or flattening. This bounded preview requires a compatible host field; it does not certify default coarse terrain, riverbed or live water. Footprint replacement remains disabled.

All 51 current portable/shared/placement/context frames were actually inspected. All 25 canonical version-2 identities verify. Four explicit levels contain 954 / 3556 / 15993 / 58112 triangles with one / seven / seven / seven draw calls. Four authored and four actual imported Float32 meshes pass attribute, winding and normal checks. All 399 runtime controls pass, including five principal arch voids/pylons, mill and approach passages, both open lanterns, glazing recesses, balcony counters and entry steps. All 546 native in-island grid controls lie below the +0.25m own terrace paving by at least 0.03m. Source/import, strict detail and medium-fi checks, schemas, actual asset inspection, matching repeated 30-tick states, runtime packaging and default bounded-preview query pass.

Repairs corrected the gallery centerline, window/pier rhythm, eight intervening panels, chapel edge orientation, hidden applied glazing, entry landing and distant geometry/export budgets. One bounded Qualla annotation write; repeat check zero; every editorial field and unrelated story/association preserved. All 74 ready story associations for 71 models pass read-only checks. All 100 fixed targets remain outside other-device candidate and collection lists. Existing six drafts remain pending. Next local model: Château de Chambord.

### Château de Chambord — 2026-10-16

Completed and story annotated: **72 ready / 78 authored**. Eight full local originals were individually inspected, including the actual 2025 southeast aerial, 2007 roof view, 2012 northwest panorama and five 2013 courtyard/entry/stair/enclosure/roof close views. All 40 candidate contacts were reviewed. Other châteaux, interiors, historical/unbuilt schemes and unrelated references were rejected as current exterior controls. Owner architecture, terrace, restoration and visitor-plan evidence controls the composition. The plan PDF has January 2025 metadata despite its 2022 URL; it is a visitor diagram, not a construction survey.

Native connected castle retains the square keep/four drums, four separate steep hipped roof pavilions, chapel/royal wings/two tall outer towers, low U-enclosure/two flat front towers and single open courtyard. Six open restored corner roof lanterns remain distinct from the 56 m central stone lantern. Three-storey facades have crossed windows, small intermediate lights, open upper keep galleries and two arched main doors/three treads. Linking arcades, individually positioned chimneys/dormers/turrets, circular/diamond inlays, true courtyard entrance/vault, exterior helical stairs/open shafts/arcade heads/rising parapets and own paving are included. Fine relief, exact paired-column and baluster forms, intermediate heights, roof/stair engineering and thresholds remain proportional approximations. Moat, gardens, interiors and detached service buildings are excluded.

Before geometry, unchanged official IGN responses supplied 25921 independent values on a 2 m review grid and a 77.73 m dry entrance datum, exactly matching a separate direct probe. All six original requests and six responses are retained and verified. Effective native resolution and surveyed accuracy remain unspecified; API rounding and review spacing are not survey accuracy. The original two-tile Terrarium baseline has substantial site/building returns and is preserved as rejected evidence. Own paving alone was lifted to clear the unchanged bilinear field. All 62910 runtime paving controls pass with minimum 0.05458 m clearance. This bounded preview requires compatible host terrain; default coarse terrain, bathymetry and live water are not certified. Footprint replacement remains disabled.

All 51 current portable/shared/placement/context frames were actually inspected; all 25 canonical version-2 identities verify. Four explicit levels contain 998 / 3477 / 15559 / 63940 triangles with 1 / 7 / 7 / 8 draw calls. Four source and four actual imported Float32 meshes pass normals/winding/attribute checks. All 234 actual-runtime checks pass, covering entrance and courtyard voids, seven lantern openings, stair shafts/treads, gallery/window/door recesses and entrance steps. Source/import, strict detail and medium-fi checks (no findings), schemas, asset inspection, matching repeated 30-tick states, six runtime-pack members and default preview query pass. Repairs removed openings overlapping wing masses, pilasters crossing glazing, full stair-shaft floor caps and paving clipping.

One bounded Qualla annotation write; repeat check zero; every editorial field and unrelated story/association preserved. All 75 ready story associations for 72 models pass read-only checks. All 100 fixed targets remain outside other-device candidate and collection lists. Six older drafts remain pending. Next local model: Dresden Castle.

### Dresden Castle — 2026-10-16

Completed and story annotated: **73 ready / 79 authored**. Eight full local originals individually inspected: 2008 western exterior/stone detail, 2019 Small Court and Stallhof, 2025 Great Court/fountain/actual entrance and 2007 Fürstenzug/Georgenbau. All 117 main contacts and 12 selected sibling contacts reviewed. Cathedral views were rejected as castle controls. Actual owner floor plans/dome pages, architect ETFE account, operator height and arcade dimensions control scope and form. The December 2025 conservation report gives a planned spring 2026 completion only; exact current finish is not asserted.

Native main castle/three courts, Georgenbau, connected stable wings and separately retained Langer Gang are modeled. Cathedral/covered church bridge, Zwinger, Johanneum, Taschenbergpalais and neighboring buildings are excluded. Hausmann tower reaches the owner’s 100.27 m, with nominal 39 m platform, octagonal exposed drum, bulb, real open lantern and tall needle. Two west corner lantern towers, two southern green-copper crowns, four pointed court stair towers, stepped gables, interpreted continuous pitched clay roofs, dormers/chimneys, three-tier Altan, two-storey Small Court arcades and raised transparent diamond canopy distinguish the palace. Four through-entry routes, 22 real long-gallery arches, original abstract gold frieze/sgraffito, south wooden doors, basin and tournament columns are included. Fine relief/paintings, exact ridges/valleys, canopy cushions, minor bay counts, intermediate heights, fountain/door placement and thresholds remain interpretations.

Before geometry, unchanged official GeoSN DGM1 GeoTIFF (native 1 m, epoch 2024-11-30) was acquired. Original TIFF/worldfile/CSV/aux files and hashes are retained. All 50625 review values on a 2 m grid rederive exactly to 0.0001 m rounding, with maximum rounding error below 0.00005 m. GRS80 UTM33 cell centres and DHHN2016 vertical datum are documented; approximate local projection and WGS84/ETRS89 epoch differences limit accuracy. Dry Great Court datum at [30,0] is 112.3239 m. Native own ground ranges −0.988..+0.712 m; walls continue to −2 m. Original two-tile Terrarium baseline has 121.8257 m datum and is retained/rejected. Own paving alone follows the unchanged ground: 41940 runtime samples clear it by +0.055..+0.361 m. Compatible host terrain is required; default coarse terrain and engineering accuracy are not certified. Footprint replacement remains disabled.

All 51 current portable/shared/placement/context frames were actually inspected, with widened context framing and 25 verified canonical identities. Four explicit levels have 939 / 2031 / 13068 / 62000 triangles and 1 / 6 / 8 / 8 draws. Four source and four actual imported Float32 meshes pass. All 378 runtime controls pass for routes, court voids, 22 arches, five upper/corner lantern openings and representative recessed windows/wood doors. Real Small Court gallery columns can occlude return windows; those sightlines are not incorrectly treated as unobstructed. All five native whole components have verified base simplification and Float32 coordinates. The single magenta primary overlay excludes the separate long-gallery polygon, which is checked independently. Source/import, strict detail and medium-fi audits, schemas, asset inspection, repeated 30-tick state, six runtime-pack files and default preview query pass.

Repairs resolved gateway cuts across small map segments, a roof lantern erroneously extruded to ground, gold frieze covering street-level arcade openings, ornament crossing windows, mismatched south-door pier, fountain/entry conflict, a lower gallery column obstructing entry and uneven roof mounds. One bounded Qualla annotation write; repeat check zero; all editorial and unrelated story/association fields preserved. All 76 current ready story associations for 73 models pass read-only checks. All 100 targets remain outside other-device candidate and collection lists. Six older drafts remain. Next local model: Sintra National Palace.

### Sintra National Palace — 2026-10-16

Completed and story annotated: **74 ready / 80 authored**. Seven full local originals,111 candidate contacts and actual owner PDF page9 were inspected. The owner image is an oblique visitor illustration, not a measured plan. Main facade is southeast-facing native edge14→13, with4 actual pointed exterior recesses and5 paired upper window groups. Native4 court/lightwell boundaries are distinct from2 occupied circular chimney boundaries. Main irregular ranges, lower front pavilions, Manueline6 paired principal groups/2x3 open round loggias,3 basement lights/offset doors/small middle light, northwest Coats-of-Arms tower, separate western entry, stepped red roofs, own terraces/Patim stair, fountain and broad front stair are modeled. Twin chimneys preserve the operator’s33m kitchen-floor-to-top control. Original abstract carved detail and wood frames avoid literal heraldry/inscriptions. Current2026 conservation finish, interior reconstruction, exact small roof valleys and minor stair/bay/threshold details are not certified.

Before geometry, public DGT viewer point responses were preserved:127 chunks/36,352,402 compressed bytes plus2 indexes, with source filenames identifying July2024 and a2026 re-encoding header. These are original viewer responses, not complete unmodified survey LAZ.911745 decoded class2 ground points are retained unchanged; class6 roof/court observations are separate structural controls. The fixed12-neighbor inverse squared distance derivative has15625 values on2m grid, all reproducible;122 independent full-cloud probes agree.210.5518m Cascais dry forecourt datum[-6,38] has native ground0.125m away and exact bilinear grid contact. No classified ground under most roofs/courts; nearest-support distance reaches22.123m, so hidden terrain and retaining interpolation remain uncertain. No ground fitting/flattening. Compatible host field is required; default coarse Earth terrain/engineering accuracy are not certified. Footprint replacement disabled.

All51 current source/shared/placement/context renders actually inspected, with25 canonical identities verified. Four explicit levels have388 /3608 /15335 /29790 triangles and1 /6 /6 /7 draws. Four authored and4 actual runtime Float32 meshes pass. All464 runtime controls and1923 roof coverage probes pass; native master/court/western-entry XY discrepancy is below0.000002m. Original-to-simplified plan errors2.440 /.823 /.104 /0m.4704 own-paving samples clear unchanged terrain by+.0396..+11.350m; high court floors are enclosed elevated slabs. All strict interior samples find actual imported surfaces;350 exact edge/vertex ray misses are numerical boundary cases. Repairs corrected roof-step face orientation, shallow arch returns, unsupported tower-window rows, front pavilion roof alignment, basement/light/wood detail and minor own-floor/stair intersections. Main court raised.20m from preliminary218.95m to219.15m; finished levels remain estimates.

Source/import reproduction, strict detail/material audits, schemas, asset inspection, repeated30-tick simulation,6 runtime-pack files and default preview query pass. One bounded Qualla annotation write; repeat check zero; editorial content and unrelated story/model associations preserved. All77 current ready story links for74 models pass, with zero other-device candidate/collection overlaps across the fixed100. Six older drafts remain; next local structure is Nagoya Castle.

### Local 80 integration milestone — 2026-10-16

All80 authored local structures regenerated from current source, with400 runtime GLBs forcibly rebuilt and560 source/runtime/sidecar byte comparisons unchanged. All240 source/scene/terrain schema checks,80 asset inspections,320 strict detail levels,80 strict material audits, runtime-pack memberships and80 repeated30-tick state checks pass. Normal names and one geographic placement per model verify;74 previews appear in default queries and6 drafts remain excluded. All77 current story links for74 ready models pass. Earlier visual approvals remain hash-current; only Sintra’s51 views were newly inspected in this milestone. All100 fixed targets remain outside the other-device candidates and collections. No Git mutations, publication, asset-lock/review-lock edits, engine-wide CI or device/Khronos certification. Next: Nagoya Castle; goal remains active.

### Nagoya Castle — 2026-10-16

Completed and story annotated: **75 ready / 81 authored / 81 started / 100**, with six older independent-ground drafts remaining. Ordinary geographic identity/folder `nagoya_castle`; all100 targets have zero structureCatalog candidate/collection ownership overlaps. Nine actual local originals,59 contact thumbnails and both owner2026 guide pages inspected. Present1959 main/small keeps retained; future wooden reconstruction and separate Honmaru Palace/enclosure excluded. Five curved green main roofs, white window tiers, distinct gray small-keep roofs with east/west upper ridge, fan-battered stone bases, exposed bridge/parapets, real recessed entries and own narrow dogleg stair, modern attached east access and north/south gold ornaments are original medium-fi geometry.

[QA](../../places/xn/xn3/nagoya_castle/qa.json): all51 final frames actually inspected,25 canonical context identities,432 actual runtime controls including36 top-floor visibility rays, four strict980/3452/12496/56741-triangle levels with1/7/7/7 draws, schemas/integrity/pack/default preview query and repeated30-tick state pass. Independent original GSI5A/10m source PNGs and25921 derived values reproduce;258 require coarser fallback.14.825m dry east court datum and all source terrain held unchanged before/through geometry.1220 actual bridge/stair surface samples clear fixed field by+.0532..+6.9172m after own bridge+.64m/stair start+.06m corrections. Native cap/access coordinates preserved below.0001m in every runtime level. Top-floor roof occlusion, small ridge direction, overly dense gable decoration, floating tile ribbons and soffit gaps repaired. Portable fitted shadows remove confirmed shadow acne. Hidden-ground/foundation classification, lower toe, small details and threshold engineering remain approximate; compatible host field required and default coarse terrain not certified. One bounded Qualla annotation write, repeat check zero; editorial/source story, unrelated records and associations preserved.78 current ready story links for75 models pass read-only audit. No Git mutation, upload, review/asset-lock edit or engine-wide CI. Next: Matsumoto Castle.

### Matsumoto Castle — 2026-10-16

Completed and story annotated: **76 ready / 82 authored / 82 started / 100**, with six older ground-review drafts remaining. Ordinary geographic identity/folder `matsumoto_castle`; all100 targets have zero structureCatalog candidate/collection overlaps. Six actual local2013–2019 originals,30 contact thumbnails and both operator2018 guide pages inspected. Five connected black/white structures retain five main gray roof tiers, varied triangular/curved white-bordered dark gables, enclosed upper room, gray south-male/north-female fish, three-tier Inui with east/west ridge and cusp windows, two-story roofed Watari with real stone entry/steps, Tatsumi and a genuinely open north/east/south red-railed Moon room. Detached gates/red moat bridge, modern office/city and interiors excluded.

[QA](../../places/xn/xn6/matsumoto_castle/qa.json): all51 final frames actually inspected,25 canonical context identities,152 actual runtime controls, four strict956/3066/13154/54286-triangle levels with1/6/6/6 draws, schemas/integrity/pack/default preview query and repeated30-tick state pass. Native whole cap outline preserved below.0001m error in all4 levels; internal partitions/lower fan toe inferred. Independent4 original GSI PNGs and all16641 values reproduce:8394 use1A,57 use5A,8190 need coarser10m fallback, often near moat.590.06m dry court datum and original field held byte-identical before/through geometry;1108 own entry/stair/Moon-floor points clear it by+.07060..+5.09113m. Trim excursions/opening occlusion, window side, projection winding, plaster bands and Moon ridge direction repaired. Approximate owner-guide silhouette heights have unspecified vertical endpoints; stone toe, hidden ground, exact bays and threshold engineering remain estimates. GSI moat pixels do not certify water/bed. Compatible host field required; default coarse Earth terrain not certified. One bounded annotation write, repeat check zero; source story/editorial/unrelated records and model associations preserved.79 current ready story links for76 models pass read-only audit. No Git mutation, upload, review/asset-lock edit or engine-wide CI. Next: Fort Zeelandia.

### Fort Zeelandia first draft — 2026-10-16

**76 ready / 83 authored / 83 started / 100.** Ordinary geographic source/folder `fort_zeelandia`. This is an incomplete draft, with no active placement or completed-story annotation. Current later three-tier brick platform, broad western entrance, narrower higher southern flight, native-plan arcaded double-eave gray-roof hall and independently cardinal square white lookout/splayed glazed cabin/red pyramid roof authored and imported. Ten local originals,58 contact thumbnails, official aerial/topographic sheets, posted guide photograph/archaeology-board image and primary owner/repair descriptions reviewed.

[Draft review](../../places/ws/wsj/fort_zeelandia/qa.json): all11 current portable views actually inspected; four829/2901/11363/26311-triangle levels with1/6/6/6 draws fit strict budgets.48 actual runtime controls verify open arcade/cabin recess/glazing and native platform/hall cap vertices.570 actual walk/step samples clear independently held-fixed ground by+.21045..+4.67987m; all66049 source heights reproduce from retained original tile. Broad entrance corrected to west, southern base raised to1.65m over the retained higher court, buried foundations and native-supported veranda columns repaired. Source/import exact checks,3 schemas, asset integrity, current source/authoring indexes and touched-code lint pass. This does not prove whole-model fidelity/geography.

Required next: original ragged outer-south wall (primary repair document approx65.8m), low northern remnant and southwest broken remnant, with real openings/weathered brick/plaster; finalize bounded wall trace, then full final shared/context/geographic runtime review and annotation. Rounded native feature is not the photographed square tower.2012 official city1:1000 survey tiles now retained/inspected, but partial coverage/line semantics do not yet prove the entire wall trace. No full vanished Dutch fort substitution. No Git mutation, upload, asset/review-lock edit or engine-wide CI.

### Fort Zeelandia — 2026-10-16

Completed and story annotated: **77 ready / 83 authored / 83 started / 100**, with six older ground-review drafts remaining. Ordinary geographic identity/folder `fort_zeelandia`; all100 targets have zero structureCatalog candidate/collection overlaps. Ten local originals and all58 thumbnails, primary owner/heritage/repair sources, official PHOTO2/EMAP mosaics, partial2012 city topographic map and photographed posted guide distinguish historic remnants from later Anping Fort platform/hall/lookout. Southern wall has actual through gate, blind pockets, buttresses/iron ties and connected plaster loss; northern remnant is lower, southwest broken run separate. Approx65.8m southern length follows city repair document. Wall axes remain interpreted with3.5/4.5/5m uncertainty. Later platform keeps three battered tiers, perforated brick rail, broad west/narrower south stairs, gray double-eave arcaded memorial hall and independently cardinal white square lookout/splayed cabin/red pyramid roof. No complete vanished Dutch fortress, separate Customs House museum, interiors, city, trees/roots or temporary scaffolding.

[QA](../../places/ws/wsj/fort_zeelandia/qa.json): all51 current frames actually inspected,25 canonical context identities,184 actual runtime controls, four strict915/3677/15329/39583-triangle levels with1/6/6/6 draws; schemas/integrity/pack/default preview query and repeated30-tick state pass. Native platform/hall cap errors below.0001m; wall axes and vertical heights are bounded photographic/map interpretations. One original Terrarium PNG and all66049 values reproduce; independent field frozen before geometry and retained byte-identical,3.0m provider-relative lower-west-court datum.570 own stair/veranda points clear field by+.21045..+4.67987m;48 cap/base probes over4 levels verify distinct wall bodies. Replaced regular surface patches, fixed hall five-sided core/west closure/roof infill and restored brick veranda/window divisions.1m output oversamples~4.40m pixels and potentially coarser DEM; hidden urban ground classification/default Earth host compatibility remain unverified. Preview placement keeps footprint replacement disabled. One bounded annotation write, repeat check zero; raw story, editorial values, unrelated records/associations preserved.80 ready story links for77 models pass read-only audit. No Git mutation, upload, review/asset-lock edit or engine-wide CI. Next: Castle Clinton.

### Castle Clinton — 2026-10-16

Completed and story annotated: **78 ready / 84 authored / 84 started / 100**, with six older ground-review drafts remaining. Ordinary geographic identity/folder `castle_clinton`; all100 targets have zero structureCatalog candidate/collection overlaps. Eleven actual local originals and all62 thumbnails plus primary NPS descriptions distinguish the current restored open-court fort from the accepted1959–1967 aerial. Exact D-shaped39-point outer plan,21-point roof/court boundary and14/16-point kiosk plans retained; broad gray-shingle roof ring is separate from approximate8ft thick masonry. True front gateway toward Manhattan and opposite rear passage follow native tunnel paths. Four rusticated pilasters, filled upper arch/rectangular lower through-door, stepped cornice/two chimneys, pale wood porch/restored quarters, curved brick-pier walks, inner masonry projections/light deck,28 interpreted gunports and two polygonal dark kiosks retained. No aquarium/theater dome, historical causeway, city, trees, portable signs/cannon displays, copied plaques/lettering or room interiors. Heights, exact bay/port/buttress locations and fine ornament remain photographic estimates.

[QA](../../places/dr/dr5/castle_clinton/qa.json): all48 current frames actually inspected,24 canonical context identities,968 actual runtime controls, strict961/3973/15519/37203-triangle levels with1/7/7/7 draws; four schemas, integrity/pack/default preview query and repeated30-tick state pass. Roof long diagonal folds repaired with corresponding boundary sections;288 probes remain within.23m at coarse levels and.08m street/close of the interpreted crossfall (actual maxima.1924/.0459m). Native plan errors below.0001m. Independent original401² F32 USGS export locks NY_CMPG_2013 dataset30939; original160801 pixels matched via independent stdlib/Pillow decoders, four metadata files and all66049 values reproduce.2.5969m provider-relative dry court datum/NAVD88 catalog; grid/PNG frozen before geometry remain byte-identical.1987 own floor/threshold/base probes clear original field by+.06876..+.17525m; own thin paving/deck follows source grade, without terrain fitting/flattening. Rejected Terrarium baseline retained separately for implausible offshore lows. Export pixel spacing/resampled1m source is not survey accuracy; later resurfacing/hidden foundations and default Earth host compatibility unverified. Preview placement keeps footprint replacement disabled. One bounded annotation write, repeat check zero; raw story/editorial/unrelated values and associations preserved.81 ready story links for78 models pass read-only audit. No Git mutation, upload, review/asset-lock edit or engine-wide CI. Next: El Morro.

### Reference resumption review — 2026-10-16

Progress remains **78 ready /84 authored /100**; El Morro preparation is the85th started item. Refreshed the current38916-story scan and explicitly joined both Puerto Rico El Morro stories to the fixed target. Current Lorraine Motel/Ponce de Leon narratives were reread after semantic hash changes; three completed sources (Saltburn Pier/Apollo Theater/Castro Theatre) still carried generic reference scope/era despite their correctly researched batch/QA descriptions. Renewed the five source reference records and all216 affected portable/shared/context frames, actually inspected in this turn. Exact source/runtime geometry, selected photo bytes, mapped frame, placement and independent terrain stayed unchanged.20detail levels, strict medium-fi audit with0findings,15schemas,5asset/pack/default-query/repeated30-tick checks and21workflow tests pass. [Review](REFERENCE-RESUMPTION-REVIEW.json) records explicit previous/current story-hash transitions. Ordinary completion sync then updates two stories and repeats with zero changes; raw stories/editorial/unrelated records/associations preserved. All81 current ready story hashes/associations across78 models pass.

El Morro now has nine individually inspected local originals, all66image thumbnails,52fort/five lighthouse drawing thumbnails and seven individually inspected measured original sheets, native54-point fort outline/bridge/tunnel/lighthouse controls, and a256m independent USGS D24field frozen before geometry. All66049values reproduce;223729nonempty original pixels independently agree with Pillow.137472empty sparse offshore pixels outside the fixed review square are retained untouched and never substituted.34.8123m provider-relative dry esplanade datum; source vertical reference and hidden-ground classifications remain unverified. Main measured-plan/native control registration and relative terrace-height interpretation precede geometry. No source model, runtime registration, placement or completion annotation exists for El Morro yet. No Git mutation, upload or lock changes.

### El Morro — 2026-10-16

Completed with two story annotations: **79ready /85authored /85started /100**, five pilots ready; six older terrain drafts and15unstarted models remain. Ordinary identity/folder `el_morro`. Registered historical component plans, nine individually inspected local originals/66photo thumbnails and seven individually inspected measured originals/57drawing thumbnails support the tiered fort, battered bastions, lower batteries/Caballero wall and real ramps, open parade with wraparound ochre arcade, true sallyport/six-arch bridge, corbelled garitas, blue-gray integral lighthouse, dry grass moat and counterscarp. Surrounding city/cemetery/esplanade landscape excluded. Fine mouldings, gallery curvature, gun positions, weathering and some levels remain photographic estimates.

[QA](../../places/de/de2/el_morro/qa.json): all51current standard frames plus six current real-terrain study views inspected. Actual999/3968/15176/29200-triangle levels with1/5/6/6draws meet strict budgets;176actual geometry controls,17976full-opening1m probes and732sub-metre gallery-joint probes per level pass with zero misses, plus15positive/negative gallery checks. Original USGS D24 raster34494 and baseline256m grid/PNG untouched; independent280m crop adds78961reproduced values while exactly retaining all66049baseline values. Explicit dry approach terrain reference preserves34.8123m provider-relative datum. Physical ground opening is confined to authored immediate fort/moat footprint, retains source elevations for anchoring and restores exact original geometry when model hides. Prior roof/deck overlap and234uncovered probes resolved with proper gallery/retaining/moat geometry; no terrain flattening. Current canonical terrain context confirms active opening/unchanged heights in every view. Five schemas, runtime/pack/default-query integrity and repeat30-tick state pass. Opt-in review workflow supports separate research terrain crop/physical opening and isolated portable datum; all78prior ready model inputs unchanged, Castle Clinton/Matsumoto exact generation unchanged. Two bounded story writes, repeat check0; raw story/editorial/unrelated curation preserved. All83current ready story associations for79models pass semantic hash/identity/placement audit. No construction survey, absolute-datum or default coarse-host terrain certification; no Git mutations, uploads or asset/review-lock edits. Next: Trevi Fountain.
