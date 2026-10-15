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
unrelated hash mismatch in `n0232_gran_torre_costanera/models/source.glb`; no whole-repository
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

All next-1,000 candidates and collection members remain assigned to the other device.
Kensington Palace (`N0904`) was removed from the local 100 and replaced by Liebermann Villa;
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

At this twenty-five-model milestone, all 22 Qualla workflow tests and 20 source-discovery, indexing and architectural-surface tests pass. All 25 authored sources regenerate exactly. The fixed goal remains 100 local models, excluding every next-1,000 candidate and collection member assigned to the other device.

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
