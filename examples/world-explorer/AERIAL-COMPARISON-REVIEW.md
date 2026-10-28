# World Explorer aerial comparison review

Reviewed 25 October 2026. Research and recommendations; no production palette, scene or runtime changes in this pass.

Aerial and oblique reference review for all five World Explorer region packages, with Seattle, Bellevue and Sammamish treated separately. Twenty proposed improvements prioritize large color/coverage patterns and medium-fi silhouettes before small props. Images are evidence, not runtime textures.

Local interactive evidence: [comparison gallery](../../.artifacts/aerial-comparison/index.html). Durable source, camera and capture-hash record: [reference manifest](aerial-comparison.reference.json). Bulk photographs, captures, source metadata and diagnostic scripts stay in ignored `.artifacts/aerial-comparison/`.

Implementation and validation follow-up: [AERIAL-IMPLEMENTATION.md](AERIAL-IMPLEMENTATION.md).
The original captures and recommendations below remain the research baseline.

## Main findings

The largest gains are urban ground-cover classification, canopy area, district-specific wall/roof palettes, quieter water/road patterns, and continuous distant coverage. Apply these before adding more small props. Seeded cities should match distributions and spatial relationships rather than individual randomly placed objects.

The user’s approximate “20% red” Seattle observation is a useful symptom, not a verified measurement. The generic commercial source chooses brick with weight 2 out of 9, but only 2 of the brick palette’s 6 weight units are red: a nominal 7.4% red outcome for that style alone. Regional styles and area-weighted visibility differ. Audit the selected styles and visible facade area before choosing final proportions.

Seattle is also not uniformly evergreen. The [City’s 2016 canopy study](https://www.seattle.gov/Documents/Departments/Trees/Mangement/Canopy/Seattle2016CCAFinalReportFINAL.pdf), p. 11, reports 72% deciduous / 28% coniferous overall, versus 60% conifers in parks’ natural areas and 10% downtown. Its LiDAR shape classification used conifers as an evergreen proxy. These dated figures support habitat-specific treatment, not literal current quotas.

## Comparison method and limits

Overhead comparisons use the same center and ground extent. Oblique camera poses are approximate except where source metadata helps; no pixel-perfect or surveyed pose claim is made. Old photo dates, lighting and seasonal differences are retained in source credits. Captures use a fixed seed, WebGL, frozen animation and neutral leaf-on vegetation; they are not autumn validation captures. Pending layers are explicitly excluded from missing-content and palette conclusions.

North-up frames are 1200 × 800. Their geographic centers/extents and source URLs/hashes are in `references.json`; camera URLs, source hashes, scene statistics and loading state are in `captures*.json`. Oblique source EXIF and licensing are in `oblique-references.json`. Sydney’s source records camera GPS −33.8574817, 151.2338767, altitude 275.1 m and a 64 mm lens; orientation remains estimated. Other poses use visible anchors and approximate lens/altitude fits. No SSIM or raw whole-image color score is meaningful across these unmatched lighting, seasonal and scene-generation conditions.

The capture harness uses the existing orthographic/FOV APIs through a temporary Vite transform; the final telephoto verification also passes that FOV to streaming and structure LOD (earlier attempts retained the normal 60-degree selector); it does not modify production source. Local runtime copies isolate captures from concurrent package rebuilds. Diagnostic retries can disable GPU warmup/admission and worker generation; their query parameters remain recorded. The Sammamish overhead frame retained four pending layers after repeated retries; its oblique capture completed. An empty or partial frame is explicitly a failed comparison, not evidence that the final scene lacks buildings or vegetation.

| Area | View | Capture state |
|---|---|---|
| Seattle | Overhead | Loaded capture |
| Seattle | Oblique | Loaded capture |
| Bellevue | Overhead | Loaded capture |
| Bellevue | Oblique | Loaded capture |
| Sammamish | Overhead | Incomplete capture — do not score missing content |
| Sammamish | Oblique | Loaded capture |
| Yuma | Overhead | Loaded capture |
| Yuma | Oblique | Loaded capture |
| Kyoto | Overhead | Loaded capture |
| Kyoto | Oblique | Loaded capture |
| Sydney | Overhead | Loaded capture |
| Sydney | Oblique | Loaded capture |
| New Delhi | Oblique | Loaded capture |

## Twenty improvements

The numerical palette ranges and budgets below are proposed engineering targets, not measurements extracted from the photographs.

### 1. Give Seattle and Bellevue separate downtown wall palettes

**P0 · Seattle, Bellevue; reusable for Sydney.** The Seattle oblique photograph is dominated by pale concrete, gray metal and blue-gray glass, with warm masonry concentrated in lower buildings. The current style sources reuse broad regional palettes across building uses.

Condition wall material and color on district, use and height. Trial a neutral/glass-heavy downtown palette with 0–5% warm red facades on generated towers; retain brick in historic low-rise blocks. These percentages are proposed tuning ranges, not a measured census.

**Complexity:** Palette weights and style selection; no added geometry or unique textures.

**Acceptance:** Across five seeds, inspect facade-area proportions separately for towers and low-rise blocks; no citywide red quota. Preserve distinctive dark towers.

**Entry points:** content/ecology/source/build-architecture.mjs; content/worldgen/styles/generic/commercial.archstyle.json.

### 2. Replace Yuma's repetitive red infill roofs with a light roof mix

**P0 · Yuma.** The overhead photograph shows many white, pale gray and sandy roofs. The matched render has conspicuous rows of similarly sized orange-red roofs.

Bias generated residential and commercial roofs toward chalk, warm gray and pale tan; keep terracotta as a neighborhood-dependent minority. Vary roof color independently from walls, with small value variation.

**Complexity:** Existing palette and material slots only.

**Acceptance:** Compare roof-only swatches and warm-roof area over several blocks and seeds; orange rows should cease dominating the view.

**Entry points:** content/ecology/source/build-architecture.mjs; content/worldgen/styles.

### 3. Tune Kyoto roofs toward a compact gray mosaic

**P1 · Kyoto.** The GSI overhead image reads as a dense silver-gray roof field. The render has dark brown-green roof islands separated by conspicuous green ground.

Use charcoal tile, medium gray tile, weathered gray metal and light flat roofs by building use. Preserve larger temple roof silhouettes and modest warm exceptions.

**Complexity:** Palette changes and existing roof archetypes.

**Acceptance:** At the Nijo frame scale, the urban field should read gray before green; do not globally bleach temple roofs.

**Entry points:** content/ecology/source/build-architecture.mjs; content/worldgen/styles.

### 4. Make seeded infill depend on block character

**P1 · All seven locations.** Yuma's repetitive frontage rows and Kyoto's regular detached infill differ from the photographs' varied parcel occupancy and connected roof fields.

Choose a stable district/block profile first, then seeded footprints, setbacks, roof types and color weights within it. Distinguish compact Kyoto blocks, Yuma detached lots, Bellevue towers and Sammamish woodland housing; respect mapped exclusions.

**Complexity:** Generation rules; keep the existing building and triangle caps.

**Acceptance:** Five seeds keep similar block coverage and height distributions without repeating a single house rhythm; roads, parks and civic spaces remain clear.

**Entry points:** packages/worldgen/src; content/ecology/source/build-architecture.mjs.

### 5. Preserve the skyline height distribution in oblique views

**P0 · Seattle, Bellevue, Sydney.** Airplane photographs distinguish tall slender towers, broad podiums and low historic blocks. An overhead roof map alone cannot validate those proportions; distant renders also lose parts of the city.

Use mapped heights/levels where available, bounded district priors otherwise, and a few reusable tower/podium silhouettes. Preserve height and roof outline in coarse LOD instead of replacing a skyline with low blocks.

**Complexity:** Redistribute existing geometry; use instanced or merged coarse massing.

**Acceptance:** After loading is complete, compare skyline occupancy and height quantiles at an agreed pose. Do not infer a height defect from a still-pending layer.

**Entry points:** packages/worldgen/src; packages/terrain/src; examples/world-explorer/src/main.ts.

### 6. Protect civic landmarks from ordinary building fallback

**P1 · New Delhi, Kyoto, Sydney, Seattle.** In the Central Vista render, the India Gate position reads as a generic multi-story building. Nijo's compound and Sydney's waterfront rely on a small number of distinctive shapes.

Reserve landmark footprints and preserve an inexpensive recognizable silhouette at airplane distance. Start with India Gate's arch and Nijo's roof/compound masses; audit existing landmark bindings before creating assets.

**Complexity:** A small per-region landmark allowance; reuse shared materials and replace overlapping autogen.

**Acceptance:** Landmark silhouette is recognizable in its paired view, ordinary infill does not overlap it, and its coarse LOD stays inside the existing region budget.

**Entry points:** content/worldgen/landmarks; packages/worldgen/src; examples/world-explorer/src/main.ts.

### 7. Use actual urban cover instead of the regional ground default

**P0 · New Delhi, Sydney, Kyoto, Seattle.** Delhi and Sydney renders expose large tan areas around streets and buildings where photographs show planted grounds or pavement. Kyoto shows green ground between tightly packed roofs.

Resolve ground cover in order: mapped water/building/paving/park/crop classes, district inference, then regional biome fallback. Use muted impervious cover inside dense blocks and explicit planted cover in parks.

**Complexity:** Color/class masks and existing surface meshes; avoid new city-sized textures.

**Acceptance:** In each matched overhead frame, broad planted and paved regions occupy the right places; unclassified lots no longer make an entire city look like grassland or desert.

**Entry points:** packages/terrain/src/landcover-blend.ts; packages/terrain/src/landcover-worker.ts; examples/world-explorer/src.

### 8. Separate dry soil, dry grass and irrigated lawn palettes

**P0 · Yuma, New Delhi, Sydney; secondary Washington.** Yuma's photo has muted gray-beige soil and patchy green-brown ground; the render is a nearly continuous yellow sand field. Bellevue's render lawns are much brighter than the photo.

First calibrate exposure and neutral material values under one shared daylight rig. Then use three or four restrained ground swatches per climate/land-use combination, with low-frequency value variation. Keep irrigated lawns greener than dry verges; do not make Sydney botanical grounds inherit an arid base.

**Complexity:** Palette and shader parameters; no additional draw calls.

**Acceptance:** Compare sunlit soil/lawn regions separately from shadows and water, with exposure held fixed; avoid copying a photograph's white balance globally.

**Entry points:** examples/world-explorer/src; packages/terrain/src; content/ecology.

### 9. Keep Yuma's irrigated field patchwork visible from an airplane

**P1 · Yuma; Kyoto basin agricultural fringes.** Yuma's south-looking airplane photo is organized by rectangular crop fields against bare desert. The Kyoto basin reference also separates agriculture from dense settlement.

Carry field polygons or a coarse land-use classification into distant LOD. Assign a small seeded set of crop/fallow colors per field, aligned to field boundaries; retain major canals without individual crop plants.

**Complexity:** Coarse colored polygons or shared low-resolution classification tiles.

**Acceptance:** The cultivated valley remains a patchwork at high altitude, while adjacent desert stays sparse. Crop rows disappear before they alias.

**Entry points:** packages/terrain/src; content/ecology/source/build-catalog.mjs.

### 10. Concentrate Yuma greenery along water and irrigation

**P1 · Yuma.** The overhead reference has dark, connected riparian vegetation along the Colorado, with dry open areas beyond. The render spreads sparse small objects across pale ground.

Use water-distance and land-use masks for riparian groves, irrigated park trees and sparse desert scrub. Reuse the existing mesquite, saguaro, prickly pear and barrel-cactus assets; reserve palms for planted contexts.

**Complexity:** Reallocate existing vegetation instances rather than increasing the region's tree count.

**Acceptance:** The river corridor reads as a continuous darker band and desert remains open; cactus and palms do not become universal urban fillers.

**Entry points:** content/ecology/source/build-catalog.mjs; packages/worldgen/src/kernel/scatter.ts.

### 11. Match canopy area with groves and larger crowns

**P0 · Bellevue, Sammamish, New Delhi, Seattle.** The photos show connected canopy over residential blocks and civic grounds. Valid Bellevue and Delhi renders show isolated small crowns and large exposed ground areas. Sammamish's overhead capture initially stalled, so its absence of trees is not scored as an art defect.

Cluster existing instances, vary mature crown size and add a coarse canopy representation for distance. Prioritize wooded blocks and Central Vista's flanking gardens over evenly scattered individual trees.

**Complexity:** Instance redistribution plus merged canopy LOD within the existing foliage budget.

**Acceptance:** Measure canopy screen-area and gap sizes, not tree count. Roofs and streets should be partly occluded where the photograph shows mature trees.

**Entry points:** content/ecology/source/build-catalog.mjs; packages/worldgen/src; examples/world-explorer/src/main.ts.

### 12. Make autumn treatment follow habitat and species

**P1 · Seattle, Bellevue, Sammamish; Kyoto season checks.** The Lake Sammamish November photograph mixes dark evergreen cover and deciduous color. Seattle's 2016 city study reports 72% deciduous and 28% coniferous overall, with strong land-use differences; that is not a present-day target for every neighborhood.

Keep woodland conifers green, separate street/park/residential mixes, and vary deciduous color by species and date. Audit the existing evergreen-preserving phenology before changing species weights.

**Complexity:** Selection and color parameters only.

**Acceptance:** Run paired summer/autumn/winter captures. Evergreen cover remains stable; autumn color appears in plausible clusters rather than as a uniform citywide treatment.

**Entry points:** content/ecology/source/build-catalog.mjs; packages/worldgen/src.

### 13. Give Sydney botanical grounds a broadleaf canopy profile

**P1 · Sydney.** Both Sydney references show substantial dark broadleaf canopy with irregular rounded crowns beside the harbour. The overhead render exposes much more tan ground; the completed oblique reveals pale, similarly shaped pointed crowns and sparse canopy overlap.

Tune planted-park canopy separately from the Australian woodland biome. Use existing eucalyptus and other appropriate broadleaf forms, crown-size variety and dark olive greens; retain open lawns as separate shapes.

**Complexity:** Reuse species meshes and shared foliage materials; rebalance instances.

**Acceptance:** Botanic Gardens and Domain remain recognizable as a planted belt in both overhead and oblique views, without turning all open lawns into forest.

**Entry points:** content/ecology/source/build-catalog.mjs; packages/worldgen/src.

### 14. Separate Kyoto garden groves, gravel courts and built blocks

**P1 · Kyoto.** The Nijo aerial has dark perimeter groves, pale courts and compact roof compounds. The render uses broad light green surfaces and sparse, similarly sized trees.

Retain the existing compound boundaries but assign distinct gravel, lawn, grove and roof treatments. Concentrate trees along photographed/mapped garden belts; use restrained evergreen and seasonal deciduous variation.

**Complexity:** Landcover classification and instance placement; no per-garden phototextures.

**Acceptance:** Nijo's large-scale light/dark pattern survives thumbnail size while nearby streets remain compact and gray.

**Entry points:** packages/terrain/src; content/ecology/source/build-catalog.mjs; content/worldgen.

### 15. Reduce water brightness and repetitive wave patterning

**P0 · Seattle, Bellevue, Sammamish, Sydney, Yuma, Kyoto.** Current overhead renders show conspicuous cyan diagonal crosshatching across almost every water body. Photos range from dark blue-green harbour water to muted river/moat water, without the same uniform pattern.

Use a small set of water types, lower chroma where appropriate, and fade normal/detail frequency with projected size. Keep stylized highlights while suppressing the repeating lattice at altitude.

**Complexity:** Shared shader parameters and texture filtering; no new water meshes.

**Acceptance:** At 1200-pixel comparison size, water reads as a coherent area rather than a checker pattern; harbour, river and moat remain distinct.

**Entry points:** packages/terrain/src; packages/client/src; examples/world-explorer/src.

### 16. Tighten shorelines, narrow watercourses and pier shapes

**P1 · Yuma, Bellevue, Kyoto, Sydney, Seattle.** The paired views show broad, bright water ribbons around Yuma and Nijo and an exaggerated Bellevue park ring. Sydney's wharves and waterfront edges contain conspicuous thin or fan-like geometry.

Audit polygon/line classification, width defaults and coastline joins; use actual width tags where available and restrained class defaults otherwise. Preserve the broad shape of piers and seawalls in coarse LOD.

**Complexity:** Correct or simplify existing geometry; often reduces triangles.

**Acceptance:** Overlay only verified overhead pairs to compare banks and pier endpoints. No synthetic wide canal should appear from an unqualified stream line.

**Entry points:** packages/terrain/src; packages/worldgen/src; regional terrain inputs.

### 17. Make aerial road markings quieter and scale-correct

**P1 · All locations.** The renders' dense bright white linework dominates streets and paths more than in the aerial references, especially Kyoto, Yuma and Delhi.

Respect physical widths, reduce overly bright paint, remove redundant edge markings on minor paths, and fade subpixel lines by distance. Preserve major intersections and carriageway hierarchy.

**Complexity:** Existing material/LOD settings; potentially fewer distant primitives.

**Acceptance:** At altitude, roads read first as muted connected surfaces, with markings emerging only at useful screen sizes.

**Entry points:** packages/terrain/src/surface-client.ts; packages/terrain/src/surface-styles.ts.

### 18. Retain roof and parking texture at the right LOD

**P2 · Bellevue, Seattle, Sydney, Yuma.** The Bellevue oblique photo shows rooftop plant, parking decks and parked-car patterns. The valid overhead render has broad uniform roofs and relatively empty paved areas. HVAC and parked cars already exist in the generator.

Keep a few large rooftop units near the camera, and use shared atlas/value patches for distant roof clutter and parked-car rows. Vary parking occupancy by use while preserving aisles.

**Complexity:** Reuse current props and a shared atlas; replace detail rather than stacking extra meshes.

**Acceptance:** Roofs and parking lots gain readable variation at middle distance without sparkling detail or a per-car draw-call increase.

**Entry points:** content/ecology/source/build-architecture.mjs; packages/terrain/src/surface-client.ts.

### 19. Place small roadside and habitat details selectively

**P2 · Yuma, Kyoto, suburban Washington; all regions at ground level.** The aerials establish distinct planted corridors, lot edges and street contexts, but do not resolve animal populations or individual utility networks. Poles and wires are already generated in surface-client.ts.

Use road class and local infrastructure data for pole spacing and underground-utility exclusions. Add only a bounded near-camera mix of hedges, fences, dry scrub and region-appropriate ambient fauna; verify fauna separately with ecological sources before changing species distributions.

**Complexity:** One shared near-camera pool under existing furniture/ambient caps; no airborne fauna or pole-detail budget.

**Acceptance:** No poles blanket downtown streets, no desert animals populate irrigated civic lawns by default, and all tiny detail disappears before it becomes subpixel noise.

**Entry points:** packages/terrain/src/surface-client.ts; content/ecology/source/build-catalog.mjs; packages/ambient.

### 20. Preserve broad city and vegetation coverage across distant LOD

**P0 · All airplane views, especially Seattle, Kyoto, Yuma and Sammamish.** Completed Sammamish, Kyoto, Yuma and Seattle oblique captures lose urban/vegetation coverage at distance; separate attempts retain pending layers. The latter are diagnostic failures rather than palette evidence. Telephoto capture validation must pass the same FOV to streaming and rendering.

First resolve persistent pending/admission cases; then retain coarse urban massing, canopy coverage and agricultural classes beyond the detailed radius. Blend atmospheric distance gently without hiding a hard coverage boundary.

**Complexity:** Merged/instanced low-detail proxies replace distant detailed assets; keep a hard resident-memory limit.

**Acceptance:** A completed oblique capture has no abrupt bare city rectangle. Compare footprint coverage at near, middle and far distances; refuse art metrics while required layers remain pending.

**Entry points:** packages/terrain/src; packages/earth/src/client/performance.ts; packages/worldgen/src; examples/world-explorer/src/main.ts.

## Complexity and validation policy

The fixed balanced captures already report 344–760 rendered draws and 2.46–5.48 million triangles in the five accepted overhead city frames. The final Sydney metadata-pose capture reports 876 draws, 6.07 million triangles and 882.3 MiB total resident buffers. These counters are a baseline, not a frame-rate benchmark; total resident buffers are not identical to the terrain-geometry budget. Small additions must be funded by simplification elsewhere.

Use the current platform tier’s memory/instance/furniture limits as hard ceilings in their own accounting categories. Palette and distribution work adds no geometry. For the first visual tuning batch, propose at most +5% rendered triangles, +10 draws and +16 MiB resident resources in any accepted comparison frame, while remaining inside the device tier’s existing limits. If a baseline already exceeds that tier, reduce it first. These are review gates, not a claim of laptop performance or a budget granted independently to each recommendation.

Reuse shared materials/atlases and existing meshes. Large mature crowns can replace multiple small trees. Far canopy and buildings should replace detailed instances with merged coarse representations. Keep poles, wires, small shrubs and animals in bounded near-camera pools; cull them when subpixel. The photographs do not justify animal population estimates, so fauna distributions require a separate ecological check.

Tune on one fixed seed, then validate on at least five seeds without per-seed hand placement. Compare roof and facade colors separately, mask sky/water/shadow when checking land color, and inspect canopy screen-area, built-area coverage, height distribution and shoreline alignment. Repeat a near/middle/far camera and summer/autumn/winter checks. Require all needed layers loaded before scoring.

Suggested order: 7/8/11/15/20 (coverage and broad colors), 1/2/3/4/5 (building distributions), 6/9/10/12/13/14/16/17 (regional structure), then 18/19 (small detail).

## Public imagery and attribution

“Open” here means publicly reusable imagery under the stated source license, not merely a publicly viewable commercial map. Photographs are kept as comparison evidence and are not incorporated into runtime materials. All downloads were retrieved on 25 October 2026.

| Reference | Credit and reuse |
|---|---|
| [USGS NAIP Plus imagery service](https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer) | USGS / USDA and contributing agencies; public-domain imagery. Mosaic acquisition dates not established for these exports. |
| [GSI seamless aerial photographs](https://www.gsi.go.jp/ENGLISH/page_e30286.html) | Geospatial Information Authority of Japan; Public Data License 1.0 / GSI attribution terms. Created by mosaicking and cropping GSI seamlessphoto tiles; acquisition date not established. |
| [NSW Imagery](https://www.data.nsw.gov.au/data/dataset/nsw-imagery) | NSW Spatial Services / Department of Customer Service and credited suppliers; catalog lists CC BY 3.0. Export acquisition date not established; service copyright years are not capture dates. |
| [Aerial view of Downtown Seattle with Bellevue in the background, 2019.jpg](https://commons.wikimedia.org/wiki/File:Aerial_view_of_Downtown_Seattle_with_Bellevue_in_the_background,_2019.jpg) | SounderBruce · 2019-06-08 14:44:44 · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0). Resized source thumbnail; no color adjustment. |
| [Aerial Downtown Bellevue Park May 2012.JPG](https://commons.wikimedia.org/wiki/File:Aerial_Downtown_Bellevue_Park_May_2012.JPG) | Jelson25 · 2012-05-08 · [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0). Resized source thumbnail; no color adjustment. |
| [Aerial Lake Sammamish November 2011.jpg](https://commons.wikimedia.org/wiki/File:Aerial_Lake_Sammamish_November_2011.jpg) | Jelson25 · 2011-11-06 · [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0). Resized source thumbnail; no color adjustment. |
| [Aerial view of Kyoto 20250901.jpg](https://commons.wikimedia.org/wiki/File:Aerial_view_of_Kyoto_20250901.jpg) | 掬茶 · 2025-09-01 16:51:03 · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0). Resized source thumbnail; no color adjustment. |
| [Aerial View of Yuma, Arizona.jpg](https://commons.wikimedia.org/wiki/File:Aerial_View_of_Yuma,_Arizona.jpg) | AddisWang · 2016-10-07 12:08:03 · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0). Resized source thumbnail; no color adjustment. |
| [Sydney (AU), Central Business District -- 2019 -- 2916.jpg](https://commons.wikimedia.org/wiki/File:Sydney_(AU),_Central_Business_District_--_2019_--_2916.jpg) | Dietmar Rabich · Taken on 25 October 2019, 10:17 · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0). Resized source thumbnail; no color adjustment. |
| [Central Vista aerial still](https://commons.wikimedia.org/wiki/File:Aerial_view_of_Central_Vista_in_Delhi.png) | Narendra Modi / YouTube; source lists 12 November 2022; [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Shooting date not independently verified. |

USGS exports may combine NAIP and other high-resolution public-domain sources. GSI seamless tiles were mosaicked and cropped to the requested geographic extent. NSW’s service metadata credits Department of Customer Service and third-party suppliers; retain its full `references/sydney-service.json` attribution when reusing an export. Acquisition dates of the three mosaics are unknown here; retrieval dates and copyright years are not acquisition dates. Historical oblique photos support material/landscape character, not a claim that every photographed building should still exist.

## Reproduction and verification

Local scripts: `fetch-references.mjs`, `fetch-oblique.mjs`, `assemble.py`, `snapshot.mjs`, `capture.mjs`, `build-report.py`. The capture metadata includes the complete query string. Main options: `node .artifacts/aerial-comparison/capture.mjs --ids=seattle,bellevue` and `node .artifacts/aerial-comparison/capture.mjs --oblique`; `--no-worker` is a diagnostic retry.

Library compilation with `pnpm --filter './packages/**' -r exec tsdown` succeeded for the captures. The ordinary build encountered pre-existing missing generated bridge assets and an entity-source formatting issue; this research did not alter those inputs or claim a green full engine CI run. No engine implementation was changed, so the report does not claim that any of the twenty improvements has already shipped.
