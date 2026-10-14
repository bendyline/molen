# Fixed model QA backlog — completed

The owner-authorized backlog of **213 already-authored candidates is cleared**. The
[ledger](../QA-BACKLOG.json) has 213 completed, zero remaining and no selected candidate.
At backlog closure, the plan had **319 authored and ready models**, with 681 still unauthored.
New-model generation has since resumed. As of 2026-10-13, **329 candidates are authored and
ready**, with **671 remaining**; the subsequent reviews and build milestones appear below.

## Review scope

Use reference pictures for appearance and standard viewer PMTiles for approximate position,
orientation, dimensions and terrain fit. Reuse existing authored facts and controls. New
artifact-specific surveys, cadastral sources and local terrain research are outside this round.
Individual source reviews record accepted limits; readiness means the declared visualization
scope passed, including any retained legacy fidelity scope.

Kernavė completed the final round with 58 inspected current source, shared-material/geographic
and medium-fi views. Its continuous landscape replaces disconnected ground patches, and its
paths and fences follow each terrain LOD. Exact knoll contours and stair rises remain approximate.
Princess Tower's exact entrance bearing and Palacio Barolo's parcel boundaries also remain
approximate. Heidelberg's bespoke terrain verification remains deferred.

## Batch verification — 2026-10-12

| Check | Result |
| --- | --- |
| Current source/runtime/input/placement hashes, complete source inventory, schemas, registered recipes and readiness | All 213 backlog candidates passed after rebuilding |
| Four LOD files against sidecar sizes and SHA-256 hashes | All 1,276 files across the 319 authored candidates passed |
| Reviewed initial skyline + district download | Largest: N0160, 557,912 bytes; every backlog candidate is below the 3 MB phone target |
| Source rebuild | 31 generators succeeded; all 485 runtime imports already matched regenerated sources |
| Asset inventory verification | All 2,728 GLBs passed for source-input bundle `assets-ffb43e5eb88dc241` |

The milestone build used `node scripts/build-assets.mjs --jobs 2`. The targeted bundle check
used `.artifacts/check-reviewed-bundles.mjs`, followed by LOD byte checks and
`node scripts/asset-packs.mjs check`. Build logs and reports are in `.artifacts/asset-build/`.
The build reported 69 existing metadata files that generators would rewrite and retained their
pre-build versions. The current backlog checks and all 319 models' LOD byte checks passed with
those retained records. Those metadata differences are listed in the build report.

Detailed source recipes remain available independently of browser derivatives. Shared material
bindings and separately generated skyline, district, street and close-up models were reviewed
without transferring older approvals to a new fidelity scope. These checks establish asset
integrity and download sizes; physical laptop/phone performance measurements remain pending.

## New-model batch milestone — N0310 through N0314

The next meaningful clean rebuild completed all 32 generators and 490 current imports,
then generated browser derivatives. `node scripts/build-assets.mjs` produced **2,758 GLBs**
in 647 seconds for source-input bundle `assets-e692e2ae3c89892b`.
`node scripts/asset-packs.mjs check` verified that complete inventory. Compared with the
previous installed inventory, all prior GLB bytes were unchanged and 30 files were added
for Margat, Tintagel, Hever, Cashel and Aleppo (master, import and four LODs each).

The five source recipes passed targeted `--check` regeneration. Their current QA input
hashes still match; Aleppo's 59-frame finalizer also passed after the clean rebuild.
The build retained the current pre-build text of 70 metadata files that generators
would otherwise rewrite; the report lists these differences. No releases were uploaded.

Olavinlinna was authored after this milestone and passes its targeted source/import,
placement, six-GLB validation and 49-frame current visual review. Its six new outputs
belong to the next source-build batch; the earlier installed bundle is not presented
as containing Olavinlinna. At that review the catalog reached **325 ready candidates out of 1000**.

Harlech Castle now passes its targeted source/import and geographic checks, six-GLB
Khronos validation, eleven aperture probes and 49-frame current visual review.
Its four levels use five existing shared graphs, with a 242,888-byte initial geometry
download. All four actual mapped bridge segments are suppressed without removing
unrelated paths. [The durable model review](../../places/gc/gcm/n0316_harlech_castle/QA-REVIEW.md)
records corrections and explicit hillside/bridge approximations. The readiness ledger
now contains **326 ready candidates**, with **674 remaining**. Harlech and Olavinlinna's
outputs await the next meaningful source-build batch; the earlier installed inventory
is not claimed to contain them.

## Chinon Castle — 2026-10-13

Chinon passes targeted generation/import/placement checks, scene validation and simulation,
six-GLB Khronos validation, five current aperture probes and **49 inspected current frames**.
Its four viewer levels use five existing shared texture graphs, with **225,932 bytes** of
initial skyline/district geometry. Both actual mapped bridge paths are suppressed while
the tested intervening path and separate tunnel remain. [The durable model review](../../places/u0/u02/n0317_chinon_castle/QA-REVIEW.md)
records the individual reconstruction, corrections, roof-reference discrepancy and explicit
terrain/height/scope limitations. The readiness ledger now has **327 ready candidates** and
**673 remaining**. Chinon's six new outputs join Olavinlinna and Harlech for the next meaningful
source-build milestone; the earlier installed release inventory does not contain them.

## Loarre Castle — 2026-10-13

Loarre passes targeted source/import/placement checks, scene validation and simulation,
six-GLB Khronos validation, twenty aperture probes and **49 inspected current frames**.
Five existing shared256-square graphs and four independently authored browser levels keep
initial skyline/district geometry to **265,488 bytes**. Seven mapped components and two
named castle/chapel POIs establish approximate scale and signed facing; the lower curtain
and upper perimeter remain explicitly picture-led estimates, with no exact-QID wall claim.
[The durable review](../../places/ez/ezx/n0318_loarre_castle/QA-REVIEW.md) records the corrections,
flat geographic fixture clipping and coarse hillside limitations. The readiness ledger now
has **328 ready candidates**, **672 remaining**. Loarre's six new outputs join Olavinlinna,
Harlech and Chinon for the next meaningful clean source-build milestone; the earlier installed
release inventory is not claimed to contain them.

## Moritzburg Castle and source-build milestone — 2026-10-13

Moritzburg passes deterministic regeneration, source/import and placement checks, scene
validation and simulation, six-GLB Khronos validation and **49 inspected current frames**.
Five existing shared graphs supply its four browser levels. Initial skyline + district
geometry totals **387,788 bytes**; the source master has 15,424 triangles. All 25 mapped
component transforms and both short bridge suppression checks pass. The island edge,
steps, heights and terrain/water joins remain explicit exterior estimates.
[The durable review](../../places/u3/u31/n0319_moritzburg_castle/QA-REVIEW.md) records the
individual reconstruction and corrections. Bulk captures remain local and ignored; the
bundle retains one 1024×640 summary preview and concise source/review reports.

The five-model batch N0315–N0319 is included in the current clean source rebuild:
`node scripts/build-assets.mjs --jobs 2` completed **32 generators**, found all **495 imports**
already matching regenerated masters, and built all **450 models' four browser levels**.
It verified **2,788 GLBs** in 892 seconds as local source-input bundle
`assets-16f966c72052fd6c`. `node scripts/asset-packs.mjs check` independently passed that
inventory. All outputs match the pre-build snapshot byte for byte. The owner's intervening
installed bundle already contained N0315–N0318; relative to that 2,782-file inventory, only
Moritzburg's six outputs were added. The build preserved the pre-build text of 48 metadata
files that generators would otherwise rewrite. No release was uploaded.

Refreshing readiness exposed **68 stale review input bindings** after existing recipe edits.
Each old input hash was reconstructed from the retained pre-format recipes or Git HEAD,
then compared against current inputs. Changes were formatting/bound-import ordering,
one discarded `forEach` callback return and a README reproduction-command correction.
For every affected model, all six rebuilt GLBs, all originally inspected frame hashes,
shared graphs, placement and four-LOD review bindings passed before any record changed.
`qa.json` and the portable/shared reports now record this reconciliation, with prior hashes
and unchanged output hashes. Original inspection dates, fidelity scopes and limitations
remain intact; these are preserved reviews, not new visual approvals.

The refreshed readiness ledger reports **329 authored/imported and ready candidates**,
**325 active geographic previews**, and **671 candidates still to author**. Bamburgh Castle
is the next explicit model: two exterior photos and its standard viewer extract are prepared,
but no source model or completion is claimed. Local comparison logs are in
`.artifacts/moritzburg-review/`; physical laptop and phone timings remain pending.

## N0320 Bamburgh Castle — 2026-10-13

Bamburgh Castle is complete as a medium-fi exterior reconstruction. Two inspected exterior
pictures, the retained exact-QID enclosure and seven independent current PMTiles polygons
guide its keep, long palace, eastern hall towers, rounded return, separate curtain/gate pieces,
stepped courts and western windmill. All 49 current portable, shared/geographic and
Earth-lighting/LOD frames were inspected. Facade foundations, roof overlap, gateway depth and
duplicate entrance walls were corrected. Seven map transforms and twelve entrance/masonry
guard probes pass. The six GLBs validate with no errors, warnings or embedded images;
the selected source generator reproduces the current master and metadata. Shared graphs load
once, and unloading disposes all model geometries.

The source master is 9,959 triangles / 1,199,204 bytes. Four independently authored browser
levels contain 939 / 3,670 / 9,199 / 9,959 triangles, with 1 / 6 / 7 / 7 model draws.
Initial skyline plus district geometry is **449,580 bytes**. Five existing 256² material
graphs are reused; position and normal upload streams are separate. Current
[QA and approximation limits](../places/gc/gcy/n0320_bamburgh_castle/QA-REVIEW.md) bind the
decision to source, runtime, inputs, placement and current render reports. The flat placement
fixture hides lower western geometry, complemented by full source-terrain views. Heights,
foundations, rock skirts, courts, paths and gate/terrain joins remain exterior estimates.
One 1024×640 summary preview is retained; bulk images remain local and ignored.

The refreshed ledger reports **330 authored/imported and ready candidates**, **326 active
geographic previews** and **670 candidates still to author**. The next explicit round is
**N0321 — Český Krumlov Castle**. Bamburgh used the targeted model loop; the latest full clean
source build remains the preceding N0315–N0319 milestone. No engine suite or dependency audit
was run for this model-only addition.

## N0321 Český Krumlov Castle — 2026-10-13

Český Krumlov Castle is complete as a medium-fi exterior reconstruction. Two inspected pictures
and standard viewer PMTiles/DEM guide the decorated round tower, open arcade, flared copper
roofs/lantern, two-courtyard upper palace, lower Hrádek, selected castle service ranges,
theater, western gallery and stacked Cloak Bridge. All 49 current portable, shared/geographic
and Earth-lighting/LOD frames were inspected. Bridge window facing, supports and upper-deck
joins were corrected; redundant foundations were removed. Terrace outlines now simplify
sequentially after clipping, preserving first-court paving across all four levels.

The master is **13,792 triangles / 1,658,816 bytes**. Four browser levels contain
**966 / 3,973 / 12,864 / 13,792 triangles**, with **1 / 6 / 6 / 6 model draws**. Initial
skyline plus district geometry is **483,072 bytes**. Five existing 256² material graphs are
shared and loaded once; no new unique texture was introduced. All six GLBs validate with zero
errors, warnings or embedded images, and separate position/normal streams have matching
CPU/GPU upload accounting. The selected source generator reproduces current master/metadata.

All 57 selected mapped polygon transforms pass. Twenty arch passages and 40 adjacent/overhead
masonry guards pass, together with six courtyard/floor probes. The actual named Cloak Bridge
and western elevated corridor paths pass viewer suppression while the separate lower-castle
crossing and unrelated ground-path/tunnel/bridge guards remain. Current
[QA and approximation limits](../places/u2/u2d/n0321_cesky_krumlov_castle/QA-REVIEW.md) bind
the review to source, runtime, inputs, placement and captures. Untagged heights, painted
motifs, roof profiles, court levels, bridge stories/supports and terrain joins remain exterior
estimates. Other crossings remain host content. One small 1024×640 summary preview is retained;
bulk renders remain local and ignored.

The ledger now reports **331 authored/imported and ready candidates**, **327 active geographic
previews** and **669 candidates still to author**. The next explicit round is
**N0322 — Linlithgow Palace**. This model used targeted checks, reusing the current package
builds; the latest full clean source rebuild remains the N0315–N0319 milestone.

## N0322 Linlithgow Palace — 2026-10-13

Linlithgow Palace is complete as a medium-fi exterior reconstruction. Two inspected pictures
and standard viewer PMTiles/DEM guide its roofless ranges, open court, five unequal hollow
stairs, four corner gable pairs, two mapped entrance passages and tiered fountain. All 49
current portable, shared/geographic and Earth-lighting/LOD frames were inspected. Gable
supports/coping, overlapping stair-bay walls and distant triangle budgets were corrected.

The master has **17,957 triangles / 2,157,212 bytes**. Browser levels contain
**974 / 3,976 / 12,170 / 17,957 triangles**, with **1 / 3 / 3 / 3 model draws**; initial
skyline + district geometry totals **444,460 bytes**. Two existing shared 256² material
graphs load once. All six GLBs pass with zero errors, warnings or embedded images;
position/normal streams are separate. Nine mapped component transforms, the courtyard hole,
fountain and retained DEM match. All 77 aperture/masonry/well/courtyard/room probes pass.

[Current QA and limitations](../places/gc/gcv/n0322_linlithgow_palace/QA-REVIEW.md) bind the
inspected result to source, runtime, inputs, placement and captures. Skyline models upper
stair crowns; district and nearer levels restore full stair depth. Untagged heights, damage,
room/stair layouts, fountain sculpture, heraldry and terrain joins remain estimates. The
mapped tunnel, other paths, adjacent church and separate eastern building remain host content.
One small summary is retained; bulk renders stay local. Source recipe indexing was reconciled
against unchanged six-GLB/image hashes and the deterministic source check, without rerendering.

The ledger now reports **332 authored/imported and ready candidates**, **328 geographic previews**
and **668 remaining**. Next: **N0323 — Dunnottar Castle**. Targeted model checks reused existing
package builds. The next full source-build milestone remains the N0320–N0324 batch.

## N0323 Dunnottar Castle — 2026-10-13

Dunnottar Castle is complete as a medium-fi exterior reconstruction. Two inspected aerial
pictures and standard viewer PMTiles/DEM guide fourteen individual roofless ruin polygons:
eastern palace wings/basin, western tower house, chapel, stables and gate/room shells. Three
mapped court-path groups, lawn divisions, an approximate faceted cliff platform and the
connected stair approach are included. All 49 current portable, shared/geographic and
Earth-lighting/LOD frames were inspected. Stair attachment/cut support and overlapping
facade openings were corrected; coincident internal wall-loop caps were removed.

The master has **14,200 triangles / 1,707,212 bytes**. Four browser levels contain
**774 / 3,837 / 12,015 / 14,200 triangles**, with **1 / 5 / 5 / 5 model draws**. Initial
skyline + district geometry totals **398,432 bytes**. Three existing shared 256² graphs
load once; no unique bitmap was introduced. All six GLBs pass with zero errors, warnings
or embedded images, and separate vertex streams have matching CPU/GPU upload accounting.
All fourteen component transforms, basin, retained enclosure/axis, DEM and court paths match.
Eighty-three aperture/masonry/stair/room/basin/attachment probes pass.

[Current QA and limitations](../places/gf/gfn/n0323_dunnottar_castle/QA-REVIEW.md) bind the
review to current source, runtime, complete recipe inputs, placement and captures. Heights,
room roles, damage, plateau/cliff levels and terrain/entrance joins remain exterior estimates.
The modern toilet, ocean, offshore rocks and separate mainland content remain with the host.
One small summary preview is retained; bulk renders stay local. The targeted generator
reproduces the master; the scene validates and simulates for 30 ticks.

The ledger now reports **333 authored/imported and ready candidates**, **329 geographic previews**
and **667 remaining**. Next: **N0324 — Pidhirtsi Castle**. Targeted checks reused package builds.
The full source-build milestone follows completion of the N0320–N0324 batch.

## N0324 Pidhirtsi Castle and batch source-build milestone — 2026-10-13

Pidhirtsi Castle is complete as a medium-fi exterior reconstruction. Two inspected aerial
pictures and standard viewer PMTiles/DEM guide the mapped palace, twin differently colored
pavilion roofs, central bays, framed windows, main roof, opposing stair arms, belvederes,
lower fortified wings and open gate/causeway. All 49 current portable, shared/geographic
and Earth-lighting/LOD frames were inspected. Roof ordering, gate depth, central glazing,
stair landings and arcade clearance were corrected; 56 geometry probes pass.

The master has **16,626 triangles / 1,998,416 bytes**. Browser levels contain
**802 / 3,134 / 11,346 / 16,626 triangles**, with **1 / 5 / 5 / 5 model draws**. Initial
skyline + district geometry totals **343,512 bytes**. Four existing shared 256² graphs
load once. All six GLBs have zero validation errors, warnings or embedded images;
separate position/normal streams have matching CPU/GPU upload accounting. Main outline,
current palace polygon, signed orientation, garden/entry controls and retained DEM match.

[Current QA and limitations](../places/u8/u8c/n0324_pidhirtsi_castle/QA-REVIEW.md) bind the
review to current source, runtime, recipe inputs, placement and captures. Untagged heights,
outer fortification plans, roof tiers, ornament and terrain/moat joins remain exterior
estimates. The untagged causeway has no bridge-specific road suppression. Separate church,
estate, full gardens, vegetation and interiors remain outside the asset. Physical device
performance measurements remain pending. One small summary preview is retained; bulk captures
stay local. Catalog thumbnails now use the retained previews available in fresh checkouts.

The N0320–N0324 clean source-build milestone passed using
`node scripts/build-assets.mjs --force --jobs 2`: **32 generators, 500 imports,
455 structure LOD sets and 2,818 GLBs** in 973 seconds. All thirty reviewed source,
runtime and LOD outputs reproduced byte for byte with unchanged input bindings.
The build reported 49 potential metadata rewrites and retained the existing metadata;
it added no metadata files. This checkpoint proves reproducibility, while individual
QA records retain their stated fidelity and placement limits. No GLBs were added to Git
and no release was published.

The ledger now reports **334 authored/imported and ready candidates**, **330 geographic
previews** and **666 remaining**. Next: **N0325 — Cardiff Castle**. Continue targeted
model checks using existing package builds; the next source-build milestone is N0325–N0329.

## N0325 Cardiff Castle — 2026-10-13

Cardiff Castle is complete as a medium-fi exterior reconstruction. Two inspected pictures and
standard viewer PMTiles/DEM guide the open shell keep/court, motte/stairs, individual western
palace/towers, southwest clock, outer/inner curtains, gates, named north/west bridges and
simplified visitor range. All 49 current portable, shared/geographic and Earth-lighting/LOD
frames were inspected. Bridge gaps, unsupported clock pieces, low panes, intersecting window
reveals and six tile-split component outlines were corrected.

The master has **22,875 triangles / 2,749,476 bytes**. Browser levels contain
**927 / 3,974 / 15,793 / 22,875 triangles**, with **1 / 8 / 8 / 8 model draws**. Initial
skyline + district geometry totals **450,876 bytes**. Four existing shared 256² graphs
load once; unloading leaves zero live model geometries. All six GLBs have zero validation
errors, warnings or embedded images, with separate position/normal streams and matching
CPU/GPU upload accounting. Twenty-four component IDs produce 25 unioned mapped polygons;
the keep hole, retained site, standard DEM and native output transform match. Forty-nine
passage, masonry, glazing, courtyard/floor, roof, stair and bridge/deck probes pass.

The source recipe authors cardinal coordinates and rotates its exported frame 135 degrees.
Inverse viewer heading restores the same mapped geographic footprint; both bridge axes then
meet the engine's longitudinal replacement rule. Actual North Gate Bridge and West Gate
Bridge paths are suppressed, with unrelated bridge, untagged path and tunnel guards retained.

[Current QA and limits](../places/gc/gcj/n0325_cardiff_castle/QA-REVIEW.md) bind the review
to current source, runtime, inputs, placement and captures. Untagged heights, component roles,
roof profiles, clock decoration and terrain/moat joins remain estimates. The coarse DEM misses
the small motte, so its 10.8 m plateau is explicitly reconstructed. Full interiors, underground
shelters and certified walking surfaces are excluded. Physical laptop/phone measurements remain
pending. One 1024×640 summary preview is retained; bulk captures stay local. The targeted source
generator reproduces the master; asset inspection, scene validation and a 30-tick simulation pass.

The ledger now reports **335 authored/imported and ready candidates**, **331 active geographic
previews** and **665 remaining**. Next: **N0326 — Church of the Holy Sepulchre**. The latest
full clean source milestone remains N0320–N0324; Cardiff's six additional outputs passed
targeted checks. The next full source milestone is N0325–N0329. No Git operation or publication
was performed.

## N0326 Church of the Holy Sepulchre — 2026-10-13

Holy Sepulchre is complete as a medium-fi exterior reconstruction. Two inspected roof/facade
pictures and standard viewer PMTiles/DEM guide the unequal domes/crowns, red-capped square
belfry, arched south facade, court, stepped ranges, small cupolas and terrace stairs. All 49
current portable, shared/geographic and Earth-lighting/LOD frames were inspected. Stair ends
were joined to their terraces with stringers, buried lower bell panes omitted/raised, and the
third facade pane moved away from the front cupola. Sparse secondary windows are explicit estimates.

The master has **6,194 triangles / 747,800 bytes**. Four browser levels contain
**575 / 2,518 / 5,859 / 6,194 triangles**, with **1 / 7 / 8 / 8 model draws**. Initial
skyline + district geometry totals **286,024 bytes**. Three existing shared 256² graphs
load once; unloading leaves zero live model geometries. All six GLBs validate with zero
errors, warnings or embedded images, with separate position/normal streams and matching
CPU/GPU upload accounting. Thirty-five component controls, the retained exact-QID outline,
signed facing and standard DEM match. Actual indexed metal/tile vertices preserve the mapped
20–34 m and 24–34 m dome intervals and 30 m bell height relative to the common floor.
All 55 opening, glazing, masonry, court/floor, dome, stair-attachment and sealed-portal probes pass.

[Current QA and limits](../places/sv/sv9/n0326_church_of_the_holy_sepulchre/QA-REVIEW.md)
bind the review to current source, runtime, inputs, placement and captures. Native Y=0 follows
the standard DEM at 770.4363 m; the 0.75 m church/court datum, untagged component roles/levels,
window rhythm, small cupolas, roof stairs, cross and terrain/terrace joins remain estimates.
Interiors, Aedicule/chapels, below-grade St Helena volume, separate east police range and exact
sculpture/lettering are excluded. Physical device measurements remain pending. The skyline
uses simpler masses and surface belfry panes; district and nearer levels restore the open
arches. One small summary is retained; bulk renders stay local. The targeted generator
reproduces the master; asset inspection, scene validation and a 30-tick simulation pass.

The ledger now reports **336 authored/imported and ready candidates**, **332 active geographic
previews** and **664 remaining**. Next: **N0327 — Florence Cathedral**. The latest full source
milestone remains N0320–N0324; Cardiff and Holy Sepulchre's twelve additional outputs passed
targeted checks. The next full source milestone is N0325–N0329. No Git operation or publication
was performed.

## N0327 Florence Cathedral — 2026-10-13

Completed the individual cathedral/campanile medium-fi exterior from two inspected aerial
photographs and standard viewer PMTiles/DEM. Thirteen current controls preserve the main
outline, nave, eastern dome/three tribunes/four buttress bodies and southern campanile.
The two nave planes retain their outer envelope across a sub-metre map seam. The eight-rib
red dome/open lantern/gold crown, stepped marble front/three closed portals/roses and square
open belfry are individually authored. The separate baptistery and museum are excluded.

The deterministic master has **9,500 triangles / 1,143,988 bytes**. Browser levels contain
**858 / 3,916 / 9,322 / 9,500 triangles**, at **1 / 7 / 7 / 7 draws**. Initial skyline + district
geometry totals **440,948 bytes**. Three existing shared 256² marble/tile/limestone graphs
load once; unloading leaves zero live model geometries. Six GLBs validate without errors,
warnings or embedded images. All thirty imported-geometry aperture/jamb/head/closed-door,
dome and nave-roof probes pass. Source generation reproduces the master; asset inspection,
scene validation and a thirty-tick simulation pass. All **49 final frames** were inspected,
including portable/source terrain, actual geographic fit, shared materials, Economy/High,
noon/late, three distances, silhouette, six details, four matched levels and four transitions.

Corrected lower tower panels hidden inside the smaller crown, drum panes buried by marble
insets, inward north-facing window offsets, belfry cut depth and distant dome-rib winding.
The estimated native floor was lowered from1.25m to−5m to reduce the first exaggerated pedestal.
[Current QA and limits](../places/sr/srb/n0327_florence_cathedral/QA-REVIEW.md) bind the current
source/runtime, inputs, placement and inspected reports. Standard DEM73.4272m remains the
origin; perimeter samples leave approximate foundation skirts/embedding and doorstep joins.
Mapped nominal25/45/85/114.5m heights are retained relative to the estimated floor. Intermediate
profiles, panel/window rhythm and ornament are picture-led estimates; exact sculpture,
lettering, interiors, structural shell thickness and certified walking surfaces are excluded.
Physical device measurements remain pending. One small summary is retained; bulk captures
stay ignored/local, with no review archive publication.

The ledger now reports **337 authored/imported and ready candidates**, **333 active geographic
previews** and **663 remaining**. Next: **N0328 — St Mark's Basilica**. Cardiff, Holy Sepulchre
and Florence's eighteen additional outputs passed targeted checks; the latest full source
milestone remains N0320–N0324 and the next is N0325–N0329. No Git operation or publication
was performed.

## N0328 St Mark's Basilica — 2026-10-13

Completed the individual medium-fi basilica exterior from two inspected aerial/front pictures
and standard viewer PMTiles/DEM. Forty-two current controls preserve the five-dome cross,
west piazza facade and adjoining ranges. Lead domes, brick drums, onion crowns/crosses,
five actual narthex arches/closed rear doors, upper glazing/gold motifs, balcony/pinnacles
and four simplified bronze horses are authored. Detached campanile and Doge's Palace are
excluded from this asset.

The source master has **16,817 triangles / 2,022,512 bytes**. Browser levels contain
**984 / 3,984 / 15,350 / 16,817 triangles**, at **1 / 8 / 8 / 8 draws**. Initial geometry totals
**476,216 bytes**. Four existing shared 256² marble/brick/metal/limestone graphs load once;
unloading leaves zero live model geometries. Six GLBs validate without errors, warnings or
embedded images. Forty-one imported-geometry probes pass, including five drum-support volumes.
Source generation reproduces the master; current asset hashes, scene validation and a thirty-
tick simulation pass. All **49 final frames** were inspected across portable/source terrain,
shared/geographic, Economy/High, noon/late, three distances, silhouette, details and LODs.

Corrected unsupported pinnacles, an outer balcony gap, roof/wall gaps, missing ridge vertices,
horse body taper and roof masks that had removed support beneath the dome drums. The final
review binds current source/runtime, inputs, placement and renders. Mapped nominal dome/drum/
crown heights are preserved; profiles, windows, gold motifs, horses and ornament are estimates.
NativeY0 follows standardDEM12.2467m, with estimated0.7m floor and approximate western skirts/
piazza joins. Exact mosaic artwork, sculpture, lettering, interiors and certified walking
surfaces are excluded. Physical device measurements remain pending. One small summary is
retained; bulk captures stay local/ignored and no review archive was published.

[Current QA and limits](../places/u2/u20/n0328_st_mark_s_basilica/QA-REVIEW.md) describe the
accepted scope. The ledger reports **338 authored/imported and ready candidates**, **334 active
geographic previews** and **662 remaining**. Next: **N0329 — Alexander Nevsky Cathedral, Sofia**.
Twenty-four additional outputs for N0325–N0328 passed targeted checks; the latest full source
milestone remains N0320–N0324. The N0325–N0329 full build follows N0329. No Git operation or
publication was performed.

## N0329 — Alexander Nevsky Cathedral and N0325–N0329 source milestone

Completed 2026-10-13 from two inspected photographs, the retained exact-QID outline,
15 unioned standard PMTiles controls and the standard viewer DEM. Individually authored
the broad eastern gold dome, taller western open bell tower/gold cap/cross, green subsidiary
domes, stepped apses, complete supports, curved nave vault, arched windows and triple west
entry/porch/steps. Corrected entrance panes crossing the openings and the curved roof/end closure.

The source master has **18,216 triangles / 2,190,060 bytes**. Browser levels contain
**999 / 3,637 / 10,044 / 18,216 triangles**, at **1 / 7 / 7 / 7 draws**, with **438,656 bytes**
of initial geometry. Five existing shared 256² limestone/marble/copper/raw-stone/wood graphs
load once; unloading leaves zero live model geometries. All six GLBs validate without errors,
warnings or embedded images. Fifteen polygon controls, signed facing, retained DEM, indexed
gold-cap intervals and 44 imported geometry probes pass. All **49 current frames** were
inspected, including portable terrain, geographic/shared surfaces and Earth lighting/LOD views.

The estimated common floor is 0.65 m above native DEM559.521963764894 m. Exact plaza levels,
doorstep joins, untagged profiles, windows, cornices and icon motifs are approximate. Exact
artwork, sculpture, lettering, structural plans, crypt/interiors and certified walking/collision
surfaces are excluded. Physical laptop/phone measurements remain pending. One small summary
is retained; bulk captures stay local and ignored.

[Current QA and limits](../places/sx/sx8/n0329_alexander_nevsky_cathedral/QA-REVIEW.md) record
the accepted scope. The post-rebuild ledger confirms **339 authored/imported and ready
candidates**, **335 active geographic previews** and **661 remaining**. Next: **N0330 —
Tournai Cathedral**; picture/PMTiles preparation is complete, model authoring remains pending.

The meaningful N0325–N0329 batch checkpoint ran:

`node scripts/build-assets.mjs --force --jobs 2`

It completed **32 generators, 505 imports, 460 structure LOD sets and 2,848 GLBs in 938 seconds**,
named **assets-83342286d16ec6ac** from source inputs. All **30** reviewed source,
runtime and browser-level files for Cardiff Castle, Holy Sepulchre, Florence Cathedral,
St Mark's Basilica and Alexander Nevsky Cathedral reproduced **byte for byte**. Their input
bindings and selected review/source metadata remained unchanged. The verifying build reported
49 pre-existing generator metadata differences, retained the reviewed working-tree files and
added none. Local exact-hash proof: `.artifacts/nevsky-review/batch-build-proof.json`;
global build diagnostics: `.artifacts/asset-build/report.json`.

## N0330 — Tournai Cathedral

Completed 2026-10-14 from two inspected elevated photographs, the rigidly reframed retained
exact-QID outline,56 unioned main/part controls and standard viewer PMTiles/DEM. Individually
authored four taller open-belfry towers, a lower central lantern, pointed slate roofs, stepped
rounded transepts, lower western nave, taller Gothic choir/apse, lower chapels/annexes,
masonry flying arches and an estimated closed west portal/rose.

The source master has **26,570 triangles / 3,192,620 bytes**. Browser levels contain
**989 / 3,997 / 13,688 / 26,570 triangles**, at **1 / 7 / 7 / 7 draws**. Initial geometry totals
**472,080 bytes**. Five existing shared256² limestone/slate/tile/raw-stone/wood graphs load
once; unloading leaves zero live model geometries. All six GLBs validate without errors,
warnings or embedded images. The56 polygon controls, signed facing, standard DEM,
indexed four83m tower/70m lantern crowns and161 imported geometry probes pass.
Targeted source generation reproduces the master; asset hash verification, scene validation
and a30-tick headless simulation pass. All **49 final frames** were inspected across portable
terrain, geographic/shared surfaces, Earth lighting, matched LODs and transitions.

Corrected floating apse-buttress connections, intersecting belfry reveals, a nave volume blocking
the entrance recess and a rose panel hidden inside the west wall. Skyline simplifies secondary
roofs; district preserves eight selected belfry cuts; street restores all48 with coarser curved
heads, while close-up refines masonry and trim. All levels meet their budgets.

NativeY0 follows standardDEM27.636844092521216m. Estimated1.5m floor against coarse perimeter
−2.22..3.25m yields approximate skirts/embedding and ground joins. Intermediate heights,
round roofs, window rhythm, flying arches and ornament are estimates. Both pictures show side
views; exact west-façade design, sculpture/tracery/lettering, interiors, structural plans,
separate city belfry and certified walking/collision surfaces are excluded. Physical laptop/phone
measurements remain pending. One small summary is retained; bulk renders stay local and ignored.

[Current QA and limits](../places/u0/u0f/n0330_tournai_cathedral/QA-REVIEW.md) describe the
accepted scope. The ledger confirms **340 ready candidates**, **336 active geographic previews**
and **660 remaining**. Next: **N0331 — Etchmiadzin Cathedral**. Tournai's six outputs passed the
targeted loop; the latest full source checkpoint remains N0325–N0329. The next full milestone
is N0330–N0334.

## N0331 — Etchmiadzin Cathedral

Completed 2026-10-14 from two inspected aerial/front photographs, a retained exact-QID
outline, one unioned current PMTiles parent and standard viewer DEM. Individual exterior
includes a faceted main drum and stone cone, gray crossing roofs, open western entry/gallery/
belfry, three smaller roof belfries, side apses, eastern range, bells, cornices, windows and steps.

Source master: **18,613 triangles / 2,238,316 bytes**. Four browser levels:
**754 / 3,472 / 11,497 / 18,613 triangles**, **1 / 8 / 8 / 8 draws**.
Initial geometry: **357,356 bytes**. Five shared 256² graphs are reused across eight roles;
each reads once, and unloading leaves zero live model geometries. Six GLBs validate with
zero errors, warnings or embedded images. Separate position/normal streams, budgets,
source/runtime hashes and 116 imported aperture/support probes pass. Final source bytes
reproduce exactly; asset inspection, scene validation and a 30-tick simulation pass.
All **49 final portable, geographic/shared and medium-fi frames** were inspected.

Removed a leftover wall strip around the portico, completed small roof-belfry pedestals and
bell hangers, and reduced distant opening complexity. The whole mapped 55m envelope is
preserved; retained 27m overall height controls the crown, while 29×23m core dimensions
do not shrink the whole site. Native Y0 follows standard DEM 874.764015m. Untagged heights,
roof roles, eastern belfry placement, ornament and the estimated 0.65m floor/contact remain
approximate. Exact reliefs, lettering, structural plans, interiors, surrounding compound and
certified walking surfaces are excluded; physical laptop/phone measurements remain pending.

[Current QA and limits](../places/sz/szp/n0331_etchmiadzin_cathedral/QA-REVIEW.md).
Ledger: **341 ready**, **337 active previews**, **659 remaining**. Next: **N0332 — Wawel Cathedral**.
N0330–N0331 passed the targeted loop; next full source checkpoint remains N0330–N0334.

## N0332 — Wawel Cathedral

Completed 2026-10-14 from useful west/aerial/south pictures and the existing standard viewer
PMTiles/DEM extract. Individual pale west gable/rose/portico, green clock and northern Sigismund
towers, shorter Silver Bells tower, steep nave/transept/choir roofs, dark Vasa/gold Sigismund
domes and northern treasury/chapterhouse. Separate N0299 palace footprint remains clear.

Master: **17,476 triangles / 2,101,792 bytes**. Browser levels:
**987 / 3,841 / 11,662 / 17,316 triangles**, **1 / 8 / 8 / 8 draws**.
Initial geometry: **434,120 bytes**. Six shared 256² graphs, no embedded images, separate GPU
streams. Source reproduces exactly; six GLBs, source/runtime hashes, scene validation and
30-tick simulation pass. All **49 final frames** inspected. **126 geometry probes** include
54 coverage checks for concave northern roofs; **28 map controls** match current fragments.
Shared graphs read once and unload leaves zero live model geometries.

Corrected gable/window z-fighting, blocked entry, roof intrusion, northern footings,
over-budget distant levels and missing treasury roof triangulation. Nominal main 35m/north45m
heights retained; disputed southern55m cap remains in source while the pictured shorter
Silver Bells tower uses36m lower component. Northern Sigismund41m and intermediate profiles
are estimates. Native DEM225.461986m, estimated3.2m floor and exact neighboring thresholds
remain coarse. Sculpture, tracery, lettering, interiors, certified walking surfaces and full
royal/monastic compound excluded; physical-device timing pending. Green/gold roofs share
one material compromise. One small preview retained; bulk evidence stays local/ignored.

[Current QA and limits](../places/u2/u2y/n0332_wawel_cathedral/QA-REVIEW.md).
Ledger: **342 ready /338 active previews /658 remaining**. Next **N0333 — Lala Mustafa Pasha Mosque**.
Targeted checks pass; next full source milestone remains N0330–N0334.

## N0333 — Lala Mustafa Pasha Mosque

Completed 2026-10-14 from two useful elevated front/side photographs and standard viewer
PMTiles/DEM. Individual three-portal Gothic front/rose, open upper tower shells, northern
minaret/balcony, low vaulted nave/aisles/rounded apse, ten flying arches and terrace/side steps.

Master: **5,446 triangles /658,232 bytes**. Browser levels:
**998 /2,549 /4,242 /4,966 triangles**, **1 /8 /8 /8 draws**. Initial geometry:
**290,036 bytes**. Five existing shared256² graphs, no embedded images and separate GPU
streams. Six GLBs,57 imported geometry probes, source/runtime hashes and source inventory
pass. Exact targeted reproduction, scene validation and30-tick simulation pass. All
**49 final portable, geographic/shared and Earth-lighting/LOD frames** inspected. Each
graph reads once; unloading leaves zero live model geometry.

Corrected bronze binding, tower-gable aperture intrusion, windows floating across portals,
overlapping side-stair caps, skyline budget and minaret support. One unioned current parent
and retained exact-QID outline preserve the61×30m envelope and signed west-front/north-minaret/
east-apse frame. All heights, damage profiles and ornament are picture-led estimates.
NativeDEM10.911700m with estimated2.8m floor/terrace/steps remains coarse; retained old ele21m
is not a surveyed floor. Exact sculpture/tracery/lettering, full interiors, surroundings,
temporary scaffolding and certified walking surfaces excluded; physical-device timing pending.
One small summary retained; bulk images stay local and ignored.

[Current QA and limits](../places/sy/sy0/n0333_lala_mustafa_pasha_mosque/QA-REVIEW.md).
Ledger: **343 ready /339 active previews /657 remaining**. Next: **N0334 — Riga Cathedral**.
Targeted checks pass; the full N0330–N0334 source checkpoint follows Riga.
