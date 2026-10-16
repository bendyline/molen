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
Five existing shared 256-square graphs and four independently authored browser levels keep
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
exact-QID outline, 56 unioned main/part controls and standard viewer PMTiles/DEM. Individually
authored four taller open-belfry towers, a lower central lantern, pointed slate roofs, stepped
rounded transepts, lower western nave, taller Gothic choir/apse, lower chapels/annexes,
masonry flying arches and an estimated closed west portal/rose.

The source master has **26,570 triangles / 3,192,620 bytes**. Browser levels contain
**989 / 3,997 / 13,688 / 26,570 triangles**, at **1 / 7 / 7 / 7 draws**. Initial geometry totals
**472,080 bytes**. Five existing shared 256² limestone/slate/tile/raw-stone/wood graphs load
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
pass. Exact targeted reproduction, scene validation and 30-tick simulation pass. All
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

## N0334 — Riga Cathedral

Completed 2026-10-14 from two useful cathedral aerial/west-tower pictures and standard viewer
PMTiles/DEM. Individual western brick arcades/copper clock roof/open lantern/bulb cap,
stepped gray nave/aisle/transept roofs, lower choir/apses/ranges,14 mapped roof features,
round west window, closed portal and steps.

Master: **16,157 triangles /1,943,516 bytes**. Four browser levels:
**986 /3,948 /10,068 /16,053 triangles**, **1 /8 /8 /8 draws**. Initial geometry:
**449,736 bytes**. Seven existing shared256² graphs, no embedded images, separate GPU streams.
Six GLBs,30 unioned map controls,237 imported geometry probes, current hashes/source inventory,
exact targeted reproduction, scene validation and 30-tick simulation pass. All **49 final frames**
inspected; each graph reads once and unload leaves zero live model geometries.

Corrected buried clocks with supported plates, lower roof intersections, floating dormer toes,
windows across the west shaft, Float32 slivers and district budget. Retained90m crown,
nominal roof/cap heights and signed western-tower/eastern-apse frame. Intermediate eaves,
curves, windows, low eastern5/8m tags and precise terrain/doorstep joins remain estimates or
unverified controls. StandardDEM14.348894m; estimated1.6m floor clears coarse perimeter.
Exact brick tracery, clock numerals, sculpture/weathercock, interiors and surrounding museum/
cloister excluded; physical-device timing pending. Bulk evidence stays local/ignored.

[Current QA and limits](../places/ud/ud1/n0334_riga_cathedral/QA-REVIEW.md).
Ledger: **344 ready /340 active previews /656 remaining**. Next: **N0335 — York Minster**.
The full N0330–N0334 source checkpoint is pending; all five individual targeted loops passed.

## N0330–N0334 full source checkpoint

The N0330–N0334 full source checkpoint passed: **32 completed generators, 510 forced imports, 465 structure LOD sets and 2,878 generated GLBs**. All thirty reviewed GLBs reproduced byte for byte, with unchanged source input bindings and review metadata. A Windows UNKNOWN file-open error at Rodsher interrupted the first import phase; recovery completed imports/derivatives with two workers and retained the completed generator logs. One existing generator metadata difference was reported and the reviewed file retained. Installed source bundle: **assets-6369b5199490d7f2**.

The checkpoint includes Tournai Cathedral, Etchmiadzin Cathedral, Wawel Cathedral,
Lala Mustafa Pasha Mosque and Riga Cathedral. Current QA scopes and limitations remain
unchanged. Generation ran once; the import-only recovery avoided repeating those jobs.
The local proof retains all thirty output hashes, input bindings, review metadata hashes,
generator log hashes and the recovery report. Physical-device measurements remain pending.

Catalog: **344 ready /340 active previews /656 remaining**. Next explicit model:
**N0335 — York Minster**, with pictures/map inputs prepared; geometry and QA pending.

## N0335 — York Minster

Completed 2026-10-14 from two useful aerial/west-front pictures and standard viewer PMTiles/DEM.
Individual twin western pinnacle towers, broad flat crossing, great west/east windows,
closed portals, long lead-gray nave/choir, stepped aisles and flying buttresses,
gabled transepts/rose and northeast octagonal chapter house with pyramid roof.

Master: **15,521 triangles /1,866,320 bytes**. Four browser levels:
**984 /2,803 /9,205 /15,521 triangles**, **1 /6 /6 /6 draws**.
Initial geometry: **368,252 bytes**. Four existing shared256² graphs, no embedded images,
separate GPU streams. Six GLBs pass Khronos;23 unioned current map controls,65 imported
geometry probes, current source/runtime/input hashes, source inventory, exact targeted
reproduction, scene validation and30-tick simulation pass. All **49 final frames** inspected.
Each graph reads once and unload leaves zero live model geometries.

Corrected mullions behind panes, rectangular rose, portable west framing and missing
district belfry surfaces. Signed west-tower/east-choir/northeast-chapter frame preserves
the whole site without scaling it to the160x76m core facts. Nominal54m tower bodies,
54..63m west pinnacle controls and35/22/30/26m roofs retained. Eaves, lower untagged
annexes, tracery/buttress details and thresholds remain estimated or unverified.
StandardDEM15.794474m; estimated0.7m floor clears coarse perimeter−0.334..0.363m.
Exact sculpture/heart tracery/inscriptions/gargoyles, interiors and temporary scaffolding
excluded; physical-device timing pending. Bulk evidence stays local/ignored.

[Current QA and limits](../places/gc/gcx/n0335_york_minster/QA-REVIEW.md).
Ledger: **345 ready /341 active previews /655 remaining**. Next: **N0336 — Nidaros Cathedral**.
N0335 begins the next targeted batch; no full source rebuild was repeated after the
completed N0330–N0334 checkpoint.

## N0336 — Nidaros Cathedral

Completed 2026-10-14 from two useful northeast/west-front pictures and standard viewer
PMTiles/DEM. Individual broad west screen/rose/selected niche reliefs/three closed portals,
twin western towers, high green crossing spire/four conical turrets, green nave/choir,
lower aisles/flying buttresses, transepts and eastern octagon/ambulatory.

Master: **15,571 triangles /1,872,768 bytes**. Four browser levels:
**912 /2,581 /10,977 /15,571 triangles**, **1 /7 /7 /7 draws**.
Initial geometry: **335,964 bytes**. Five existing shared 256² graphs, no embedded images,
separate GPU streams. Six GLBs pass Khronos; 157 unioned map controls, 75 imported geometry
probes, current source/runtime/input hashes, source inventory, exact targeted reproduction,
scene validation and 30-tick simulation pass. All **49 final frames** inspected.
Each graph reads once; unload disposes model geometry and restores ground.

Added the upper gable niches and lower west arcade; closed the crossing roof at the spire
base and extended eastern turret supports to the foundation. Signed western-screen/eastern-
octagon frame retains the full approximately 101x51m envelope. Nominal roof/tower/cone stages,
including the 82m spire, are retained. Eaves, window/niche rhythms, selected faceted reliefs,
exact heights and thresholds remain estimated or unverified. Lower crossing belfry panes
intersect joining roof masses; probes establish visible heads rather than full-height visibility.
Standard DEM 13.866477m; estimated 0.5m floor clears coarse perimeter −0.740..0.233m.
Exact sculpture identities/tracery, finial/weathercock, interiors, graveyard/trees and neighboring
Archbishop’s Palace excluded. Native terrain fixture uses diagnostic ground colors; synthetic
English-terrace neighbors do not reconstruct Trondheim. Physical-device timing pending.
Bulk evidence stays local/ignored.

[Current QA and limits](../places/u5/u5r/n0336_nidaros_cathedral/QA-REVIEW.md).
Ledger: **346 ready /342 active previews /654 remaining**. Next: **N0337 — Saint Sophia Cathedral**.
N0335–N0336 passed targeted loops in the next batch; the completed N0330–N0334 full checkpoint
was not repeated after these two models.

## N0337 — Saint Sophia / Selimiye Mosque, Nicosia

Completed 2026-10-14 from useful elevated/west/detail photographs, a 2025 post-restoration
material/entrance view and standard viewer PMTiles/DEM. Present-day Selimiye Mosque keeps
the planned former-cathedral candidate identity Q1476251. Individual twin minarets/single
balconies, asymmetric northern square bay/southern round base, three recessed Gothic porch
arches/closed doors, pale pointed screen, low nave roof/aisles, small gable crests/flying
buttresses and polygonal eastern/annex envelope.

Master: **6,195 triangles /748,140 bytes**. Four browser levels:
**599 /1,591 /3,705 /5,959 triangles**, **1 /8 /8 /8 draws**.
Initial geometry: **210,936 bytes**. Five existing shared 256² graphs, no embedded images,
separate GPU streams. Six GLBs pass Khronos; current map parent, signed geographic transform,
full clipped-zone coverage, 53 imported probes, current hashes/source inventory, exact targeted
source reproduction, scene validation and 30-tick simulation pass. Actual porch recess/door
checks repeat in district/street/closeup. All **49 final frames** inspected.
Every graph reads once; unload releases model geometries and restores ground.

Tightened the southern porch opening to retain its outer jamb. Corrected the pale screen
from the glass role to solid trim, enabling the shared plaster graph. Retained approximately
79x41m whole footprint; no usable height facts or tower/roof map parts. Generic parent11m
is a three-level value, not a measured cathedral height. Main23m eave/25m low vault,
13m aisle,18.5m porch,26m square tower,64m tips and all balcony/annex/profile dimensions
are picture-led estimates. Exact roof subdivision, annex functions and thresholds remain
unverified. StandardDEM148.685587m; estimated0.7m floor clears coarse perimeter−0.216..0.312m.
Exact fretwork/sculpture, flags/loudspeakers, finials/crescents, full interiors, market and
neighboring buildings excluded. Terrain colors and English-terrace neighbors are diagnostic/
synthetic context. Physical-device timing pending. Bulk evidence stays local/ignored.

[Current QA and limits](../places/sw/swr/n0337_saint_sophia_cathedral/QA-REVIEW.md).
Ledger: **347 ready /343 active previews /653 remaining**. Next: **N0338 — Pannonhalma Archabbey**.
N0335–N0337 passed targeted loops in the next batch; the completed N0330–N0334 full checkpoint
was not repeated for these individual models.

## N0338 — Pannonhalma Archabbey historic core

Completed2026-10-14 from two useful aerial/tower photographs and standard viewer PMTiles/DEM.
Six current controls preserve monastic ranges, basilica/tower, library/link and adjoining
gatehouse with two roofless paved courts. Individual cream/tile ranges, dark hipped library,
clock/belfry, open round colonnade/copper dome, classical front, raised split-entry steps
and photo-led retaining terrace. Modern school, sports/visitor and neighboring campus excluded.

Master: **33,623 triangles /4,039,468 bytes**. Four browser levels:
**931 /3,456 /5,324 /33,623 triangles**, **1 /8 /8 /8 draws**.
Initial geometry: **425,536 bytes**. Seven existing shared256² graphs; no embedded images.
Six GLBs pass Khronos; six map transforms, current full-core zone coverage, retained legacy
outline,56 imported probes, source/runtime hashes/inventory, exact targeted reproduction,
scene validation and30-tick simulation pass. All **49 final frames** inspected.
All seven graphs read once; unload releases model geometry and restores ground.

Corrected a basilica gable/window overlap crossing the clock tower. Raised the estimated
floor from 0.2m to 0.8m to clear the sampled 0.454m courtyard crest. StandardDEM datum 273.595795m;
deep downslope foundations and photo-led retaining boundary remain approximate. Architectural
heights are picture-led estimates, including 56.4m crown; no measured height facts. Exact
roof subdivision, reliefs, numerals, sculpture, interiors, modern campus and certified walking
surfaces excluded. Physical phone/laptop timings pending. Bulk captures remain local/ignored.

[Current QA and limits](../places/u2/u2k/n0338_pannonhalma_archabbey/QA-REVIEW.md).
Ledger: **348 ready /344 active previews /652 remaining**. Next: **N0339 — Šibenik Cathedral**.
N0335–N0338 passed targeted loops; the next full source checkpoint follows N0339.

## N0339 — Šibenik Cathedral

Completed 2026-10-14 from two useful exterior pictures and standard viewer PMTiles/DEM.
Nine current controls retain parent, nave, dome, aisles, transept and three eastern apses.
Individual curved/ribbed stone roofs, western rosettes/pointed portal, northern portal,
octagonal windowed drum/pointed dome and selected side bays/pilasters. Corrected the
floating crossing plinth and added small transept roses. Exact figures/head frieze excluded.

Master: **10,843 triangles /1,304,980 bytes**. Four browser levels:
**431 /1,669 /6,923 /10,441 triangles**, **1 /6 /6 /6 draws**.
Initial geometry: **205,664 bytes**. Four shared256² graphs, no embedded images, separate GPU streams.
Six GLBs pass Khronos; nine raw map transforms, retained exact-QID outline, source/runtime
hashes/inventory, exact targeted reproduction, scene validation and30-tick simulation pass.
All **49 final frames** inspected. 92 imported probes cover vault/apse roofs, crossing support,
portal recesses/closed doors, roses, exposed clerestory panes and drum windows across levels.
All four graphs read once; unload disposes model geometry and restores ground.

Current map heights 20.16m nave,32m dome,12.56m aisles,20.5m transept,14.9m/8.84m apses
constrain picture-led roof/eave/drum roles. Parent/part union differs 0.297m² across two
approximately 7cm edge slivers; full parent supplies lower body/foundation. StandardDEM
datum 8.650114m and estimated 1.4m floor clear sampled footprint peak 1.091m. Exact sculptures,
full tracery/interiors and adjacent town/plaza excluded; deep reveals can hide oblique glazing.
Coarse ground/stair thresholds and physical phone/laptop timings remain unverified.

[Current QA and limits](../places/sr/srg/n0339_sibenik_cathedral/QA-REVIEW.md).
Ledger: **349 ready /345 active previews /651 remaining**. Next: **N0340 — Matthias Church**.
The N0335–N0339 full source checkpoint passed as recorded below; no repository-wide engine suite or audit was run.

## N0335–N0339 full source checkpoint — passed

Completed 2026-10-14 after all five targeted model loops. Full source checkpoint passed: **32 generators, 515 forced imports and 2908 GLBs** rebuilt in 925s. All thirty reviewed GLBs reproduced byte for byte, with unchanged input bindings and review/source metadata. Local installed source bundle: **assets-ed15b2d48ed81ff6**. The build reported 49 generator metadata differences and retained the existing files. A focused consistency audit confirmed source, runtime and LOD hashes for all 48 affected structure bundles; reconciliation of other semantic metadata fields remains separate cleanup. No Git operations, uploads or release publication were performed.

Ledger: **349 ready /345 active previews /651 remaining**. Next: **N0340 — Matthias Church**, Q493133. Useful front/aerial pictures and standard viewer PMTiles/DEM are prepared in ignored local artifacts; no new source model or readiness approval yet.

## N0340 — Matthias Church

Completed 2026-10-14 from useful west/south and aerial pictures plus standard viewer PMTiles/DEM. Individually authored unequal western towers, tall octagonal pointed belfry/open upper gallery/ribbed spire, patterned lower Bela crown, repeated cross-gables, eastern conical apse, west rose/recessed portal, north/south porches and low chapels.

Source master: **9,363 triangles /1,127,848 bytes**. Browser levels **986 /2,479 /7,574 /9,363 triangles**, **1 /7 /7 /7 draws**; initial geometry **324,296 bytes**. Five shared256² graphs, no embedded images, separate GPU streams. All six GLBs pass Khronos; source reproduction/hashes, 37 raw map controls, source inventory, scene/30-tick simulation, 123 imported support/aperture probes and all **49 current frames** pass. Graphs read once and unload releases geometry/restores ground.

Map heights and roof-stage roles, eaves, selected roof motifs/fretwork, terrain/plaza/steps and thresholds remain approximate. Exact sculpture/full interiors/adjacent landmarks and certified walking excluded; physical device timings pending. [Current QA and limits](../places/u2/u2m/n0340_matthias_church/QA-REVIEW.md).

Ledger: **350 ready /346 active previews /650 remaining**. Next **N0341 — Euphrasian Basilica**. Next routine full source checkpoint covers N0340–N0359; targeted checks continue per model.

## N0341 — Euphrasian Basilica

Completed 2026-10-14 from useful aerial,tower and atrium pictures plus standard viewer PMTiles/DEM. Individual raised nave/clerestory,lower aisles,polygonal east apse,west triple windows/selected mosaic bands,actual atrium arcades/courtyard,octagonal baptistery,square bifora belfry/stone spire,northern palace ranges and attached chapels. Corrected missing lower connections,overlapping palace ranges,inner belfry obstructions and tiny Float32 clipping wedges.

Master **10,524 triangles /1,267,160 bytes**. Browser levels **581 /2,044 /6,368 /10,524 triangles**, **1 /7 /7 /7 draws**. Initial geometry **261,836 bytes**, five shared256² graphs and no embedded images. Six GLBs/Khronos,source reproduction/current hashes,seven raw map controls/source inventory,scene/30-tick simulation and **280 imported probes** pass. All **49 final views** inspected; registered-recipe capture refresh reproduced the already inspected22 portable/shared images exactly. Graphs read once; unload releases geometry/restores ground.

All seven map controls lack heights. Every vertical dimension,roof/arcade/episcopal role and octagonal baptistery is picture-led/approximate. Exact mosaic figures/tesserae,sculpture,full interiors,excavations,seawall/town and certified walking excluded; exact terrain/thresholds and physical device timings unverified. [Current QA and limits](../places/u2/u21/n0341_euphrasian_basilica/QA-REVIEW.md).

Ledger **351 ready /347 active previews /649 remaining**. Next **N0342 — Modena Cathedral**. Source checkpoint remains N0340–N0359.

## N0342 — Modena Cathedral/Ghirlandina

Completed 2026-10-14 from useful aerial,west-facade and southern portal pictures plus standard viewer PMTiles/DEM. Individual stepped facade/large recessed spoke rose,closed recessed portals,selected triple-arch bays/pilasters,two-tier west porch,pink southern Porta Regia,raised red-tiled nave/single-slope aisles,three eastern apses/four roof turrets and tiered square/octagonal Ghirlandina with stone spire. Corrected aisle slopes,southern portal obstruction and roof-turret support gaps.

Master **24,852 triangles /2,986,052 bytes**. Four browser levels **565 /2,434 /15,254 /24,852 triangles**, **1 /6 /6 /6 draws**. Initial geometry **269,652 bytes**. Four shared256² graphs,no embedded images,separate GPU streams. Bounded aperture filtering avoids distant triangle splits; street omits closeup capitals to remain below16k triangles. Six GLBs/Khronos,22 raw map transforms,source reproduction/current hashes/inventory,scene/30-tick simulation and **253 imported probes** pass. All **49 final views** inspected. Graphs read once; unload releases geometry/restores ground.

Current map heights constrain the85m tower crown and church/turret/apse stages; eaves,spire transitions,porch/gallery/roof roles and thresholds remain approximate. Selected blind galleries are shallow pane/arch/column representations. Exact figures/lions/reliefs,full interiors,town/square and certified walking excluded. Physical device timings pending. [Current QA and limits](../places/sp/spz/n0342_modena_cathedral/QA-REVIEW.md).

Ledger **352 ready /348 active previews /648 remaining**. Next **N0343 — Cathedral of the Most Holy Conception**,Q210869,in Concepción,Chile. No draft started. Source checkpoint remains N0340–N0359.

## N0343 — Cathedral of the Most Holy Conception

Completed 2026-10-14 from useful elevated/oblique current facade pictures and standard viewer PMTiles/DEM. Individual grey modern cathedral with rounded banded pylons,monumental recessed arch/rose/vertical glazing,three closed portals/warm lunettes,tall side arches,upper crown slots,metal nave/single-slope aisles,low faceted crossing lantern,rounded rear apse/transverse arms and selected roofline figure. Corrected stray doorway reveal triangle,recessed front-panel depth and arch jambs.

Master **6,847 triangles /825,456 bytes**. Browser levels **667 /2,208 /4,937 /6,847 triangles**, **1 /6 /6 /6 draws**. Initial geometry **285,148 bytes**,four shared256² graphs,no embedded images,separate GPU streams. Six GLBs/Khronos,one raw parent/retained exact-QID outline,rigid internal frame,source reproduction/hashes/inventory,scene/30-tick simulation and **171 imported probes** pass. Six current outputs have zero stray front triangles in the corrected region. All **49 final views** inspected. Each graph reads once;unload releases geometry/restores ground.

One35m mapped parent supplies overall height and69x38m envelope;there are no building-part height controls. Roof/opening/lantern/figure dimensions and side/rear details are picture-led approximations. Exact statue/mosaics,full interiors,adjacent civic/office wings,plaza and certified walking excluded. Terrain/stair thresholds and physical device timings unverified. [Current QA and limits](../places/63/63k/n0343_cathedral_of_the_most_holy_conception/QA-REVIEW.md).

Ledger **353 ready /349 active previews /647 remaining**. Next **N0344 — Saint George's Cathedral**,Q1774485,Lviv. Readiness confirms source/runtime missing;no draft begun. Source checkpoint remains N0340–N0359.

## N0344 — Saint George's Cathedral

Completed 2026-10-14 from three inspected useful pictures and standard viewer PMTiles/DEM. Individual mapped cross plan, yellow plaster/pale Baroque trim, bowed west facade with closed recessed portal and tall arched window, curved gable/selected sculptural silhouettes, split stairs and central recessed grotto, chamfered drum/dark metal dome/gold lantern and cross, selected side/rear openings, pilasters and balcony ledges. Enlarged side windows, added main side pilasters/ledges and closed roof-edge gaps after visual inspection.

Master **10,368 triangles /1,248,464 bytes**. Browser levels **593 /3,491 /8,055 /10,368 triangles**, **1 /7 /7 /7 draws**. Initial geometry **383,008 bytes**, five existing shared 256² graphs, no embedded images and separate GPU streams. Six GLBs/Khronos, one raw parent/retained exact-QID outline, source reproduction/hashes/inventory, scene/30-tick simulation and **186 imported probes** pass. All **49 final views** inspected. Each graph reads once; unloading releases geometry/restores ground.

The approximately 42x24m footprint controls the plan, signed to the west court. The mapped 5m height is clearly inconsistent with photographs and explicitly unused. Vertical stages,42m cross top above raised floor, sculpture/crest silhouettes, side/rear details and stair/terrain thresholds are estimates. Exact sculpture, full interiors, adjacent palace/courtyard wings, gates, belltower and certified walking excluded; physical device timings pending. [Current QA and limits](../places/u8/u8c/n0344_saint_george_s_cathedral/QA-REVIEW.md).

Ledger **354 ready /350 active previews /646 remaining**. Next **N0345 — Salzburg Cathedral**, Q258908, Salzburg. Readiness confirms source/runtime missing; no draft begun. Source checkpoint remains N0340–N0359.

## N0345 — Salzburg Cathedral

Completed 2026-10-14 from two inspected useful exterior pictures and standard viewer PMTiles/DEM. Individual stepped twin west towers, clocks/open belfries, green cupolas/lanterns/crosses, three recessed closed entrance portals, pale layered facade with selected windows/pediments/pilasters/figures, long dark nave/aisles, three rounded eastern/transept arms and central octagonal drum/green dome/lantern. Corrected a foreground wall hiding lower facade details, moved lower glazing onto the outer mapped masonry and replaced dark crest placeholders with stone fields. Reduced district/street trim while retaining the detailed master.

Master **21,774 triangles /2,616,208 bytes**. Browser levels **926 /3,401 /14,682 /21,774 triangles**, **1 /5 /5 /5 draws**. Initial geometry **386,252 bytes**, four existing shared 256² graphs, no embedded images and separate GPU streams. Six GLBs/Khronos,35 current raw controls/retained exact-QID outline, source reproduction/hashes/inventory, scene/30-tick simulation and **307 imported probes** pass. All **49 final views** inspected. Each graph reads once; unloading releases geometry/restores ground.

The approximately 103x69m footprint and individual 28/41/52/53/63/69/78/79m part heights control the silhouette; interior stage splits, openings, roof profiles, selected sculpture/crest/clock geometry, stairs and terrain thresholds remain approximate. Side/rear and oval glazing uses selected panels. Exact sculpture/reliefs/inscriptions, full interiors, adjacent arcades/palace wings, plaza monuments and certified walking excluded; physical device timings pending. [Current QA and limits](../places/u2/u23/n0345_salzburg_cathedral/QA-REVIEW.md).

Ledger **355 ready /351 active previews /645 remaining**. Next **N0346 — Vilnius Cathedral**, Q1281237, Vilnius. Readiness confirms source/runtime missing; no draft begun. Source checkpoint remains N0340–N0359.

## N0346 — Vilnius Cathedral and detached bell tower

Completed 2026-10-14 from two inspected useful elevated exterior pictures and standard viewer PMTiles/DEM. Individual six-column west portico with real open bays,closed recessed central door,selected niche figures/relief fields,triangular pediment/three roofline figures/cross,open lateral galleries,long gray nave roof,pair of rear domed chapels/lanterns and detached round-base/faceted staged clock/bell tower/dark spire. Reframed the portico and summary cameras to avoid tower obstruction. Matched Economy/High images confirmed the diagonal corner marks are shadows rather than stray geometry;High shadow artifacts remain a recorded rendering limit.

Master **16,272 triangles /1,956,440 bytes**. Browser levels **830 /3,776 /11,186 /16,272 triangles**, **1 /6 /6 /6 draws**. Initial geometry **452,160 bytes**,five existing shared 256² graphs,no embedded images and separate GPU streams. Six GLBs/Khronos,74 raw current controls/retained exact-QID outline,source reproduction/hashes/inventory,scene/30-tick simulation and **322 imported probes** pass. **24 actual viewer footprint checks** confirm both cathedral and detached bell are covered while the neighboring palace and intervening square remain uncovered. All **49 standard final views** plus two matched shadow diagnostics inspected. Each graph reads once;unloading releases geometry/restores ground.

Approximately 73x60m cathedral/gallery envelope and detached 14.3m tower base retain mapped spacing about 70m west/21m south. Principal 20/14/16/17/24/25m cathedral and 15/24/36/57/59m tower controls set stages;column taper/capitals,upper tower profile,selected figures/relief fields/niches/clocks,roof subdivisions and terrain/entry thresholds remain approximate. Exact sculpture/carvings,full interiors,adjacent palace/square monuments and certified walking excluded;physical device timings pending. [Current QA and limits](../places/u9/u99/n0346_vilnius_cathedral/QA-REVIEW.md).

Ledger **356 ready /352 active previews /644 remaining**. Next **N0347 — St. John's Co-Cathedral**,Q613619,Valletta. Readiness confirms source/runtime missing;no draft begun. Source checkpoint remains N0340–N0359.

## N0347 — St. John's Co-Cathedral

Completed 2026-10-14 from two useful inspected elevated/front pictures and standard viewer PMTiles/DEM. Individual twin limestone towers/pale pyramids/open belfries/green bells,exposed upper-right bell frame,three right-tower clock fields,column-supported projecting balcony/single closed recessed portal,blind niches/central gable,pale nave roof,repeated sloping buttresses and lower side/rear masonry. Corrected the detached landing,column-base contact and hidden side/rear glazing. Subdivided broad faces to prevent the actual viewer's rotated triangle boxes from covering the open front square.

Master **9,285 triangles /1,118,492 bytes**. Browser levels **941 /3,589 /7,219 /9,285 triangles**, **1 /7 /7 /7 draws**. Initial geometry **405,604 bytes**,five existing shared 256² graphs,no embedded images and separate GPU streams. Six GLBs/Khronos,three current controls/retained exact-QID outline,source reproduction/hashes/inventory and scene/30-tick simulation pass. **248 imported probes** validate roofs,buttresses,belfries/bells,portal/niches/glazing,balcony and landing/column bases. **24 current viewer footprint checks** retain the cathedral while leaving north/clock-side neighbors and open front square uncovered across all six GLBs. All **49 final views** inspected. Each graph reads once;unloading releases geometry/restores ground.

Approximately 65.5x44.2m parent and two tower parts retain the signed Valletta plan. The levels-derived 17m parent is not an overall-height control;all vertical stages and 9.5x9.3m northern upper tower are picture-led. Exact sculptures/carvings/inscriptions/clock-calendar text,full interiors,adjoining museum/city blocks,background dome and certified walking excluded;terrain/entry thresholds approximate and physical device timings pending. [Current QA and limits](../places/sq/sq6/n0347_st_john_s_co_cathedral/QA-REVIEW.md).

Ledger **357 ready /353 active previews /643 remaining**. Next **N0348 — Dresden Cathedral**,Q666935,Dresden. Readiness confirms source/runtime missing;no draft begun. Source checkpoint remains N0340–N0359.

## N0348 — Dresden Cathedral

Completed 2026-10-14 from two useful inspected elevated exterior pictures and standard viewer PMTiles/DEM. Individual rounded lower/upper body,layered hipped roofs/pale apron,two balustrade/selected-figure tiers,repeated pilasters/tall windows/oval lights and single staged tower with eight actual open bays,green onion/spike/cross and closed recessed portal. Corrected the inward-folded upper roof,excessively boxy distant reduction and pilasters overshooting short facade segments. Curvature survives all four LODs; ornaments are reduced first.

Master **39,121 triangles /4,697,848 bytes**. Browser levels **996 /3,969 /14,031 /39,121 triangles**, **1 /5 /5 /5 draws**. Initial geometry **429,024 bytes**,four existing shared 256² graphs,no embedded images and separate GPU streams. Six GLBs/Khronos,86 raw current controls/retained exact-QID outline,source reproduction/hashes/inventory and scene/30-tick simulation pass. **410 imported probes** validate staged roofs,tower floors/crown,landing,principal glazing/portal recesses and eight open tower apertures. **24 current viewer footprint checks** retain the cathedral while leaving adjacent castle block,castle tower and open front square uncovered. All **49 final views** inspected. Each graph reads once;unloading releases geometry/restores ground.

Approximately 94.3x53.9m signed parent/tower/nave plans retain scale. Retained tags explicitly flag inconsistent heights. Mapped 24m lower cornice,29.8m apron and 49.5/67.5/79.5/86m tower stages plus 87.9m top are approximate controls;upper nave 40m cornice/43.5m ridge and about 3.5m figures are picture-led. Upper-body raw inward fold supplies a reconstructed convex envelope;distant lower bodies retain the parent outer envelope. Exact sculpture/carved crests/inscriptions,full interiors,adjacent castle/covered connection and certified walking excluded;terrain/threshold fit approximate and physical device timings pending. [Current QA and limits](../places/u3/u31/n0348_dresden_cathedral/QA-REVIEW.md).

Ledger **358 ready /354 active previews /642 remaining**. Next **N0349 — Cattedrale di Monreale**,Q1303856,Monreale,Sicily. Readiness confirms source/runtime missing;no draft begun. Source checkpoint remains N0340–N0359.

## N0349 — Cattedrale di Monreale and cloister complex

Completed 2026-10-14 from two useful inspected elevated-front/apse pictures and standard viewer PMTiles/DEM. Individual unequal west towers/short clock tower/tall single-and-paired open belfry,three-arch pale front portico/balustrade/closed recessed portal,selected patterned front,terracotta nave,green north-gallery/transept roofs,high eastern sanctuary,three rounded decorated apses,open paired-column cloister/garden and surrounding mapped monastery ranges. Both courts retain authored paving and remain roofless above it. Corrected inward-facing apse decoration triangles and widened the detail camera.

Master **39,202 triangles /4,708,872 bytes**. Browser levels **888 /3,795 /11,978 /35,170 triangles**, **1 /8 /8 /8 draws**. Initial geometry **394,696 bytes**,four existing shared 256² graphs,no embedded images and separate GPU streams. Six GLBs/Khronos,five current raw map controls/retained exact-QID outline,source reproduction/hashes/inventory and scene/30-tick simulation pass. **533 imported probes** validate roofs,tower floors/courtyard paving,roofless courts,sampled actual arcade shafts/heads,principal glazing/closed portal,twelve belfry apertures and outward-facing curved inlays. **54 current viewer footprint checks** retain the modeled complex/ground paving while preserving north/east neighboring buildings and front plaza. All **49 final views** inspected. Each graph reads once;unloading releases geometry/restores ground.

Approximately 95.9x45.6m cathedral and 156x173m mapped complex retain global position and scale. Origin centers the full mesh at 13.29222539302813,38.081419154829405;original cathedral anchor/outline and centering calculation remain recorded. The 70.16m identity offset is within 80m. Secondary ranges exactly equal the union of two monastery parents minus cathedral/cloister outer footprints. All current controls lack heights;architectural stages,selected motif/column profiles,secondary roofs/windows and main 3.1m/other-court 4.7m DEM-relative floors are estimates. Exact bronze/carved inlay,full interiors,individual monastery rooms and certified walking excluded;physical device timings pending. [Current QA and limits](../places/sq/sqc/n0349_cattedrale_di_monreale/QA-REVIEW.md).

Ledger **359 ready /355 active previews /641 remaining**. Next **N0350 — St. Martin's Cathedral, Bratislava**,Q239560,Slovakia. Readiness confirms source/runtime missing;no draft begun. Source checkpoint remains N0340–N0359.

## N0350 — St. Martin's Cathedral, Bratislava

Completed 2026-10-14 from two useful inspected elevated-front/tower pictures and standard viewer PMTiles/DEM. Pale single west tower with four actual pointed belfry apertures,clock/rose fields,green copper apron/rounded bulb,open octagonal lantern,tall spike and abstract golden crown. Steep red nave,lower polygonal chancel,northern chapels,south vestibule,tall lancets,closed recessed side doors,selected west pinnacles and stepped outward buttresses. Corrected inward buttresses/taper steps,removed the chapel-covered window,moved apse supports away from glazing and aligned clock/metal details to the floor.

Master **8,280 triangles /997,836 bytes**. Browser levels **947 /2,381 /5,888 /8,280 triangles**, **1 /7 /7 /7 draws**. Initial geometry **317,976 bytes**,five existing shared 256² graphs,no embedded images and separate GPU streams. Six GLBs/Khronos,eight raw current PMTiles controls/retained exact-QID outline,source reproduction/hashes/inventory and scene/30-tick simulation pass. **310 imported geometry probes** cover roofs/crown,outward buttresses,closed glazing/door recesses and backing,bell floor,four open belfry/eight open lantern apertures. **78 current viewer footprint checks** retain eight selected controls and preserve four nearby buildings/west plaza across six outputs. All **49 final views** inspected. Each graph reads once;unloading releases geometry/restores ground.

Approximately 77.22x38.07m envelope remains at 17.10506053,48.142001435 with heading 0.309301458594rad. Current 85m tower,34m nave,25.03m chancel,15.5m east chapel and 8m vestibule heights retained;the older 16m fact is not overall height. DEM datum 155.384861m,estimated floor 4.4m and sampled footprint peak 4.005m provide approximate contact. Wall cores/eaves,buttress/opening details,copper profile,clock/rose/crown and terrain thresholds are picture-led approximations. Exact insignia/sculpture/tracery,full interiors,adjacent citywalls/buildings and certified walking excluded;physical device timings pending. [Current QA and limits](../places/u2/u2s/n0350_st_martin_s_cathedral_bratislava/QA-REVIEW.md).

Ledger **360 ready /356 active previews /640 remaining**. Next **N0351 — Turku Cathedral**,Finland. Current readiness confirms source/runtime missing;no current draft begun. Source checkpoint remains N0340–N0359.

## N0351 — Turku Cathedral

Completed 2026-10-14 from two useful elevated-tower/whole-south pictures and standard viewer PMTiles/DEM. Individual western brick clock tower with pale patch/band/blind-niche rhythm,dark closed upper belfry,green flared copper spire with closed narrow roof-light marks/gold ball/cross,long clerestory/gabled nave,broad lower aisle roofs,northern projecting chapel,rounded northeast chapel,southern additions and polygonal east choir. Reconstructed sloping mapped roof planes replace flat extrusions. Selected windows and west/south doors have real recesses and closed backing. Removed roof-hidden tower windows and narrowed the spire tip.

Master **9,515 triangles /1,146,504 bytes**. Browser levels **846 /2,671 /6,647 /9,515 triangles**, **1 /8 /8 /8 draws**. Initial geometry **353,752 bytes**,five existing shared 256² brick/limestone/granite/copper/wood graphs,no embedded images,separate GPU streams. Six GLBs/Khronos,36 raw PMTiles controls/retained exact-QID outline,derived roof unions,source reproduction/hashes/inventory and scene/30-tick simulation pass. **514 imported geometry probes** cover principal/aisle/chapel/choir roofs,spire/cross and detailed glazing/closed-door/shutter recesses/backing. **240 current viewer footprint checks** retain 36 controls and preserve three nearby buildings/west plaza across six outputs. All **49 final views** inspected. Five graphs read once;unloading releases geometry/restores ground. Imported brick V repeat matches 0.6m library repeat.

Approximately 88.75x50.36m envelope remains at 22.278491799,60.452447201 with heading -0.054920877897rad. Nave/north wall plans equal the recorded current roof unions. Current 85m spire/tower stages and main 42m/choir 40m/lower-roof intervals guide reconstruction;retained 101.9m fact has uncertain datum. Main 35m/northeast 24.4m eaves,roof slopes,selected openings/clock/shutter/copper profiles and 1.8m choir finial are estimates. DEM datum 40.297409m,estimated floor 2.1m and sampled peak 1.729m provide approximate contact;absolute altitude/plaza/thresholds unverified. Exact weathering/sculpture,full interiors,adjacent city/plaza and certified walking excluded;physical device timings pending. [Current QA and limits](../places/u6/u6x/n0351_turku_cathedral/QA-REVIEW.md).

Ledger **361 ready /357 active previews /639 remaining**. Next **N0352 — Vank Cathedral**,Q1398856,Isfahan,Iran. Readiness confirms source/runtime missing and unresolved orientation;no current draft begun. Source checkpoint remains N0340–N0359.

## N0352 — Vank Cathedral

Completed 2026-10-14 from three useful elevated-church/west-gateway/pavilion pictures and standard viewer PMTiles/DEM. Individual buff pointed dome/short drum,blind-niche church,open tiled roof belfry/column lantern/cone,freestanding double-stage open belfry/pale rails,western clock gateway/blue lunette/alternating pyramid roof,northwest pedimented pavilion and four mapped surrounding ranges with low shallow-vaulted south roofs. Courtyard stays roofless above paving;the mapped garden has no authored paving. Corrected roof-belfry support gap/door threshold,removed shared-wall windows,lowered/vaulted the southern range and optimized hidden skyline paving/upper belfries.

Master **9,402 triangles /1,132,940 bytes**. Browser levels **982 /3,307 /7,244 /9,002 triangles**, **1 /8 /8 /8 draws**. Initial geometry **396,768 bytes**,five existing shared 256² graphs,no embedded images and separate GPU streams. Six GLBs/Khronos,eight raw map controls/named Vank/museum points,current outlines/courtyard difference,source reproduction/hashes/inventory and scene/30-tick simulation pass. **724 imported geometry probes** validate roofs/crosses,open five-stage belfry shafts/heads,gateway,courtyard/paving,garden void and detailed niches/closed-door/glazing backing/threshold. **66 actual viewer footprint checks** retain eight buildings and preserve neighboring parking/hotel and west plaza across six outputs. All **49 final views** inspected. Five graphs read once;unloading releases geometry/restores ground.

The previously unresolved candidate now has an approximate source-local frame at 51.65575,32.634888888 with heading 0.0975156746134511rad. Named Vank site POI is about 22m from the retained coordinate;named museum/current plans and three pictures resolve the western gateway/belfry,eastern dome and northern courtyard range. No exact-QID building-polygon claim. None of the eight controls has heights;all architecture is estimated,including 11.2m church/26.3m dome,21.5/23.2m belfries,28.2m clock tip and 5.5..6.7m southern vaults. Peripheral facades/functions,approximate enclosure and exact thresholds/altitude remain unverified. Standard DEM datum 1583.040460m,estimated floor 0.6m and sampled peak 0.205m give approximate contact. Exact lettering/tile designs/sculpture,full interiors,forecourt statue/fountain and certified walking excluded;physical device timings pending. [Current QA and limits](../places/tj/tju/n0352_vank_cathedral/QA-REVIEW.md).

Ledger **362 ready /358 active previews /638 remaining**. Next **N0353 — Königsberg Cathedral**,Q225459,Kaliningrad. Current readiness confirms source/runtime missing and unresolved orientation;no current draft begun. Source checkpoint remains N0340–N0359.

## N0353 — Königsberg Cathedral

Completed 2026-10-14 from four useful westwork/whole-building/tomb pictures and standard viewer PMTiles/DEM. Individual asymmetric brick west front with northern/central gables, three cream pointed blind-panel tiers, octagonal clock drum/concave green south spire; broad nave/narrower choir with steep continuous dark metal roof, paired windows, mapped buttresses/small south porch, roof/east turrets and open northeast pink-stone Kant tomb colonnade. Corrected a window blocked by the mapped south projection, added missing lower west-panel cadence and omitted hidden skyline foundation caps.

Master **6,291 triangles / 759,632 bytes**. Four browser levels meet 1000/4000/16000/64000 triangle and eight-draw budgets; initial geometry **363,668 bytes**. Five existing shared 256² graphs, metric UVs, flat architectural normals, zero embedded images and split GPU streams. **464 geometry probes**, **36 actual viewer footprint checks**, six Khronos validations, raw control transforms/heights, source/runtime/LOD/inventory hashes, targeted byte reproduction and scene/30-tick simulation pass. All **49 final frames** inspected. Shared graphs read once; unload disposes geometry/restores ground.

Anchor [20.511666666,54.706388888], heading **-0.12435513504416938rad**. Main/26 parts/tomb plans preserve scale/position; named organ-hall/Kant-museum/tomb and pictured west/east/south ordering support approximate identity. No exact-QID polygon claim. Mapped 50.75m spire top retained; 8/11m nave/choir tags interpreted as eaves with estimated 24m ridge, 30m drum and 26/25m gables. Tomb map5m conflicts with tall pictured columns; modeled 10.4m entablature is an explicit override. Standard DEM datum2.246535m, floor0.7m and sampled peak0.257m give approximate contact. Facade/porch/clock/roof/tomb details and precise thresholds/altitude remain approximate. Terracotta gable roofs share the brick graph as a material approximation. Exact lettering/numerals/tracery/sculpture, full interiors and certified walking excluded; physical device timing pending. [Current QA and limits](../places/u3/u3w/n0353_konigsberg_cathedral/QA-REVIEW.md).

Ledger **363 ready / 359 active previews / 637 remaining**. Next **N0354 — St. Mary's Cathedral**, Q937320, Tallinn. Current readiness confirms no source/runtime model; no next draft started. Routine full source checkpoint remains N0340–N0359.

## N0354 — St. Mary's Cathedral, Tallinn

Completed 2026-10-14 from three useful south-entry/tower/east-aerial pictures and standard viewer PMTiles/DEM. Individual off-white basilica, clerestory and lower aisle roofs, polygonal choir, western square clock tower/two-bulb copper spire/open octagonal lantern, northern rooms, connected south frontage with pediment/pointed wood entry and east hip-roofed bay, mapped buttresses and minor choir post lantern. Corrected tiny boolean slivers by using posts in the minor lantern, placed choir windows clear of buttresses, followed skewed map quads in gables, added an exposed upper south-aisle window and refined upper bulb. Added estimated entry steps/ramp over coarse DEM height difference. Corrected matched LOD cameras to retain the full finial.

Master **7,625 triangles / 919,728 bytes**. Browser levels meet 1000/4000/16000/64000 triangle and eight-draw budgets; initial geometry **427,680 bytes**. Five existing shared 256² graphs, metric UVs, flat architectural normals, no embedded images and split GPU streams. All **49 final frames** inspected. **770 imported geometry probes**, **30 actual viewer footprint checks**, six Khronos validations, raw map control/height transforms, retained exact-way identity, composed choir/east-front plans, targeted source reproduction/hashes/inventory and scene/30-tick simulation pass. Each shared graph reads once; unload disposes geometry/restores ground.

Anchor **[24.739166428,59.437057279]**, heading **-0.030561530713rad**. Retained exact-QID OSM way26902813 matches current main numeric feature35184398991645. Main/21 church-part plans preserve position/scale; western tower/eastern choir/south entry in pictures sign the old undirected axis. Current37m tower,43m lower octagonal roof and69m upper spire tags contrast with old coarse main42m tag. Other current roof heights are retained with estimated eave/wall subdivisions. Standard DEM datum56.265474m, floor2.3m and sampled peak1.911m give approximate hill contact. Entry transition, bulb/lantern/clock/windows/annex roofs and minor turret are estimated; thresholds/absolute altitude/physical device timings unverified. Color follows inspected2013/2015 ground views and labeled2023 aerial still; later restoration appearance unverified. Exact lettering/numerals/tracery/sculpture, full interiors and certified walking excluded. [Current QA and limits](../places/ud/ud9/n0354_st_mary_s_cathedral/QA-REVIEW.md).

Ledger **364 ready / 360 active previews / 636 remaining**. Next **N0355 — Cathedral of Magdeburg**, Q668341, Germany. Current readiness confirms source/runtime missing; no next draft started. Routine full source checkpoint remains N0340–N0359.

## N0355 — Cathedral of Magdeburg

Completed 2026-10-14 from three useful exterior pictures and standard viewer PMTiles/DEM. Individually authored twin square western towers/open octagonal round-arched belfries/gray-tinted stone cones/finials, central clock gable and pointed wood portal, high nave/transept/polygonal choir, lower aisle gables, ambulatory/five radiating chapels, unfinished eastern square towers, crossing turret and southern cloister ranges around an empty court with open pointed galleries. Corrected window/buttress rhythm and gable-obscured inward tower fields, supported sloping gallery roofs and widened portal/court review cameras.

Master **19,807 triangles / 2,381,552 bytes**. LODs **995/3,967/13,556/19,807 triangles**, **1/8/8/8 draws**, initial skyline/district **476,900 bytes**. Five existing shared 256² limestone/slate/copper/granite/wood graphs, linear tints, metric UVs, flat architectural normals, zero embedded images and separate GPU vertex streams. All **49 final frames** inspected; **1,050 imported geometry probes**, **42 actual viewer footprint checks**, six Khronos validations, 37 raw map plan/tag transforms, compound courtyard/ambulatory compositions, source hashes/inventory/recipe index, targeted byte reproduction and scene/30-tick simulation pass. Graphs read once; unload disposes geometry/restores ground.

Anchor **[11.63472471,52.124648732]**, heading **-0.169401623226rad**. Retained exact-QID way 22993770 matches current main numeric identity. Current 99m upper tower tags conflict with retained unqualified 104m fact. Standard DEM datum 57.575970m, estimated floor 2.8m and sampled peak 2.419m give approximate contact. Individual wall/eave/roof/cone/belfry/chapel/arcade subdivisions and peripheral cloister facades remain estimated. Exact sculpture/tracery/text, full interiors and certified walking excluded; terrain/door thresholds and physical device timings pending. [Current QA and limits](../places/u3/u32/n0355_cathedral_of_magdeburg/QA-REVIEW.md).

Ledger **365 ready / 361 active previews / 635 remaining**. Next **N0356 — Cathedral of Saint Mother Teresa in Pristina**, Q1115637. Current readiness confirms source/runtime missing; no next draft started. Routine full source checkpoint remains N0340–N0359.

## N0356 — Cathedral of Saint Mother Teresa in Pristina

Completed 2026-10-14 from three useful exterior pictures and standard viewer PMTiles/DEM. The August2025 two-tower state supersedes older one-tower construction views. Individually authored tiered square campaniles with round lower/paired upper open stages, clock and blank circular field, shallow terracotta caps/crosses, red-roofed basilica with paired clerestory/aisles/transept, rounded rear apse, front rose, open gabled porch/closed wood doors, broad steps and low mapped platform/basement. Corrected a quantized porch-edge spike that caused a hipped roof, the lower tower/transept attachment, oversized upper piers/reveals, skeletal district towers and tower ground contact. Current deeper cavity rays confirm empty upper chambers; earlier filled appearance came from thick piers, not stray interior geometry.

Master **19,100 triangles / 2,296,148 bytes**. LODs **633/3,490/11,543/19,100 triangles**, **1/7/7/7 draws**, initial skyline/district **395,140 bytes**. Five existing shared 256² ashlar/raw-limestone/ceramic-tile/granite/wood graphs, linear tints, metric UVs, flat architectural normals, zero embedded images and split GPU streams. All **49 final frames** inspected. **1,674 geometry probes**, **42 actual viewer footprint checks**, six Khronos validations, four raw map plan/tag transforms, source body/roof partitions, exact-way identity, targeted byte reproduction, source/recipe inventory and scene/30-tick simulation pass. Shared graphs read once; unload disposes geometry/restores ground.

Anchor **[21.159371609,42.656365443]**, heading **1.185666760539rad**. Retained exact-QID way 105555618 matches the current main identity. Two 70m tower footprints and low 5m building outline retain raw tags/plans. Standard DEM datum 585.753036m, estimated floor 1.8m and sampled church/tower peak 1.433m give coarse contact. Tower stage/roof/wall divisions, church/transept/apse/porch heights, rose/windows/corbels/steps and lower platform/basement interpretation remain estimates; rear and low-platform functions/facades are not independently pictured. Exact lettering/numerals/sculpture/stained-glass pictures, full interiors and certified walking excluded; thresholds/absolute altitude/physical device timings pending. [Current QA and limits](../places/sr/srx/n0356_cathedral_of_saint_mother_teresa_in_pristina/QA-REVIEW.md).

Ledger **366 ready / 362 active previews / 634 remaining**. Next **N0357 — Cefalù Cathedral**, Q1354756. No next draft started. Routine full source checkpoint remains N0340–N0359. GLBs and bulk captures remain ignored; no Git mutations or uploads performed.

## N0357 — Cefalù Cathedral

Completed 2026-10-14 from three inspected exterior/elevated pictures and standard viewer PMTiles/DEM. Individually authored unequal-crowned twin west towers, open upper belfries, pale octagonal north cone/broader south pyramid, pointed single/paired windows, two blind west arcade tiers/round-headed window, open three-arch porch/closed wood entry, raised tiled nave/aisles, gray transverse barrel crossing, high choir and three fitted rounded eastern apses, colonnettes/blind arcades, terrain-following lower foundations and descending front stairs. Corrected apse window placement, south crown centering, steep nave roof, missing porch frames/paired-window mullions, aisle-blocked lower tower windows and the flat skyline entrance block. Added optional review-camera yaw so terrain cameras stay outside the steep Rocca hillside; no terrain flattening.

Master **10,777 triangles / 1,297,828 bytes**. Four LODs **442 / 1,957 / 8,867 / 10,777 triangles**, **1 / 8 / 8 / 8 draws**; initial skyline/district **226,672 bytes**. Five existing shared 256² limestone/lime-plaster/ceramic-tile/granite/wood graphs, linear tints, metric UVs, flat architectural normals, zero embedded images and separate GPU streams. All **49 current frames** inspected. **1,250 imported geometry probes**, **36 actual viewer footprint checks**, six Khronos validations, current raw plan/partitions, retained exact-way identity, targeted byte reproduction, source/recipe inventory and scene/30-tick simulation pass. Graphs read once; unload disposes geometry/restores ground.

Anchor **[14.023596886,38.039841968]**, heading **-0.126022523437rad**. Retained exact-QID way 425988640 matches current main feature 35184798077472; west front/east apses and separate north cloister sign the frame. Raw main has no height tags. Tower tops44m, floor0.5m and all roof/stage/apse/window/stair divisions remain estimates. Standard DEM datum33.867381m; main perimeter terrain spans -8.43..11.00m. Coarse Rocca influence may conceal lower east/south foundations; precise street/door thresholds, cut/fill and absolute altitude remain unverified. Separate cloister/urban ranges remain host buildings. Exact statues, ironwork, lettering, mosaics, interiors and certified walking excluded; physical device timings pending. [Current QA and limits](../places/sq/sqc/n0357_cefalu_cathedral/QA-REVIEW.md).

Ledger **367 ready / 363 active previews / 633 remaining**. Next **N0358 — St Giles' Cathedral**, Q1547466. No next draft started. Routine full source checkpoint remains N0340–N0359. GLBs and bulk captures remain ignored; no Git mutations or uploads performed.

## N0358 — St Giles' Cathedral

Completed 2026-10-15 from four useful exterior/crown/aerial pictures and standard viewer PMTiles/DEM. Individually authored eight open stone crown ribs, central shaft, tiered finial/pinnacles, triple louvered belfry fields, broad silver-gray nave/choir/crossing/aisle roofs, stepped lower ranges, pointed west/east windows, sparse tracery/blind niches, buttress piers, northwest turret, polygonal Thistle Chapel and entry steps. Thirteen current building parts corrected the first estimated tower width/height and nave footprint. Closed support gaps beneath tower/turret, narrowed overlapping side niches, moved buttresses off window bays, cut overlapping body walls and removed roof/cornice pieces across the upper pointed windows. Louvers, glazing and wood entry are closed; crown interior remains open.

Master **16,957 triangles / 2,038,984 bytes**. LODs **901 / 2,260 / 9,313 / 16,573 triangles**, **1 / 7 / 7 / 7 draws**; initial skyline/district **310,324 bytes**. Five shared 256² coursed/raw sandstone, standing-seam metal, granite and wood graphs; linear tints, metric UVs, flat architecture normals, zero embedded images and split GPU streams. All **49 current frames** inspected. **2,080 imported geometry probes**, **108 actual viewer footprint checks**, six Khronos validations, source/recipe inventory, targeted byte reproduction, scene/30-tick simulation and graph read-once/unload checks pass.

Anchor **[-3.190858255,55.949465243]**, heading **0.110403903006rad**. Retained exact-QID way42407060 matches main35184414495892 plus thirteen raw architectural parts. Raw total heights **6/14/16/20/39m** are retained; aisle plans subtract the higher nave/crossing from the16m control. Standard DEM datum94.402203m, estimated floor1.16m, perimeter terrain-1.91..0.91m. Foundations/turret/piers follow terrain; short west steps approximate the threshold. Wall/roof divisions, crown curves, windows/tracery, ornament and precise street/door/altitude fit remain estimated. Exact sculpture, adjacent monument/town buildings, text/stained-glass art, full interiors and certified walking excluded; physical device timings pending. [Current QA and limits](../places/gc/gcv/n0358_st_giles_cathedral/QA-REVIEW.md).

Ledger **368 ready / 364 active previews / 632 remaining**. Next **N0359 — Transfiguration Cathedral**, Q2299324, Odesa, Ukraine. No next draft started. Routine source checkpoint remains N0340–N0359. GLBs and bulk captures remain ignored; no Git mutations or uploads performed.

## N0359 — Transfiguration Cathedral

Completed 2026-10-15 from two useful exterior/aerial pictures and standard viewer PMTiles/DEM. Individual cream/white cruciform cathedral with low gray roofs, three bronze-brown domes, tall western needle/clock tower, truly open upper belfry and four classical columned porticoes. Detailed wall/drum recesses have closed glass backing. Corrected inward dome/needle winding, missing low-wing roof caps, window overlap at the west door and high basement base. The mapped3m raised entry plane remains; lower basement faces can lie below coarse terrain.

Master **16,673 triangles / 2,005,360 bytes**. LODs **925 / 3,436 / 10,339 / 14,419 triangles**, **1 / 8 / 8 / 8 draws**; initial skyline/district **415,316 bytes**. Five shared256² plaster, standing-seam metal, bronze, granite and wood graphs; linear tints, metric UVs, zero embedded images and separate GPU streams. Inspected49currentframes. **2,176 imported geometry probes**, **138 actual viewer footprint checks**, six Khronos validations, source/recipe inventory, targeted byte reproduction, scene/30-tick simulation and graph read-once/unload pass.

Anchor **[30.731041666,46.483177777]**, heading **-0.10649991776594932rad**. Nineteen raw map controls retain unscaled plans/tags; no exact mapped QID way is claimed. Main0.1m is footprint/plinth,37m bulb-stage boundary is distinct from the unqualified retained72m total claim. Standard DEM datum54.645605m, basement0.5m and entry3.5m above perimeter terrain-1.62..3.28m. Exact repair/damage/roof condition after2023, ornament, doorway terrain joins and physical device timings remain unresolved. Separate pavilion, sculpture/icons/text, interiors and certified walking excluded. [Current QA and limits](../places/u8/u8m/n0359_transfiguration_cathedral/QA-REVIEW.md).

Ledger **369 ready / 365 active previews / 631 remaining**. Next **N0360 — Ljubljana Cathedral**. Full source-only checkpoint N0340–N0359 is next, before starting the next model. GLBs and bulk captures remain ignored; no Git mutations or uploads.

## N0340–N0359 full source checkpoint — passed

Completed2026-10-15. The N0340–N0359 full source checkpoint passed: **32 generators, 535 forced imports, 490 structure LOD sets and 3028 GLBs** rebuilt in 901s. All **120 reviewed master/runtime/LOD files** reproduced byte for byte, with unchanged model-input, source/review/capture and runtime metadata bindings. Installed source bundle: **assets-edcecf1cbf9e3eef**. The build reported 49 generator metadata differences and retained the existing files; those differences did not alter this batch's reviewed metadata. Other semantic metadata reconciliation remains separate cleanup. No Git mutations, uploads or release publication were performed.

The local proof retains120 output hashes and the unchanged per-model input, placement, spec, source manifest, QA, capture-report, map-frame and runtime-sidecar hashes. The32 generation jobs ran once; all535imports were forced from source. Four browser levels were regenerated. No engine-wide CI or npm audit was run. Individual geographic, exterior and device-measurement limitations remain as recorded in each model review.

Ledger **369 ready /365 active previews /631 remaining**. Next explicit model **N0360 — Ljubljana Cathedral** has two inspected exterior pictures and a local standard PMTiles/DEM extract with eleven main/part controls. Its recipe/geometry/current QA are pending. The next routine source checkpoint is **N0360–N0379**.

## N0360 — Ljubljana Cathedral

Completed2026-10-15 from two useful elevated/north pictures and standard viewer PMTiles/DEM. Paired western clock/belfry towers with large louvered arches, octagonal ocelli stages, stacked green copper caps and dark open lanterns; large eastern green dome, arched-window drum and pale open lantern; red tiled nave/cross/choir roofs, lower green aisle roofs, cream classical walls/pilasters, curved west pediment, sparse glazing bars and closed entries. The first renders exposed coplanar overlapping wall skins and blocked panes. Replaced them with joined wall layers, retained true lantern gaps, and checked facade/drum recesses with closed backing. Refreshed and inspected current medium-fi captures after completing geographic identity metadata; portable/shared frames remained byte-identical.

Master **16,896 triangles /2,032,100 bytes**. LODs **826 /2,468 /12,282 /16,400 triangles**, **1 /8 /8 /8 draws**; initial skyline/district **327,052 bytes**. Five existing shared256² plaster, flat tile, copper, granite and wood graphs; linear tints/metric UVs, zero embedded images and split GPU streams. Inspected49currentframes. **1,444 imported geometry probes**, **90 actual viewer footprint checks**, six Khronos validations, source/recipe inventory, targeted byte reproduction, scene/30-tick simulation and graph read-once/unload pass.

Anchor **[14.508252023,46.050763304]**, heading **0.15942023578998998rad**. Retained exact-QID way176486012 matches current main35184548574844 and ten architectural parts. Raw11/17/19/23/25m total tags and retained5m nave roof are recorded, with missing min_height values preserved. The OSM note marks heights estimated. Standard DEM datum304.007768m, display offset0.4m, perimeter-2.82..2.29m. Foundations follow terrain; local DEM+0.22m sets estimated west/north entry bottoms. Flat placement captures partly hide the below-datum entry; source terrain views show it. Front details, cap profiles, thresholds and absolute altitude remain approximate; exact reliefs/sculpture/text, market/neighbors, interiors, certified walking and physical device timings excluded or pending. [Current QA and limits](../places/u2/u24/n0360_ljubljana_cathedral/QA-REVIEW.md).

Ledger **370 ready /366 active previews /630 remaining**. Next **N0361 — Hagia Sophia**, Q1568660, Thessaloniki, Greece. Next routine full source checkpoint remains **N0360–N0379**. GLBs and bulk captures remain ignored; no Git mutations or uploads.

## N0361 — Hagia Sophia, Thessaloniki

Completed2026-10-15 from two useful clear west/east pictures, an older street context and standard viewer PMTiles/DEM. Ochre upper west front, three wood entries, four larger lower windows, ten narrow clerestory windows and broad stepped central arch; exposed masonry east/side walls; square three-window drum, short round crown and low ribbed gray-green metal dome/cross; large central polygonal apse, two lower side apses, tiered tile roofs and small northwest open bell. Removed a generated side window blocked by the bell, limited ochre finish to the main west wall, widened the portal surround, and bounded final detailed triangles so conservative viewer footprint cells preserve the west courtyard patch. Replaced a banded-looking Flemish brick binding with the existing plain running-bond graph; no shared graph was edited.

Master **13,512 triangles /1,626,000 bytes**. LODs **963 /2,190 /9,228 /12,992 triangles**, **1 /8 /8 /8 draws**; initial skyline/district **251,260 bytes**. Six existing shared256² plaster, brick, flat tile, standing-seam metal, limestone and wood graphs; linear tints, metric UVs, zero embedded images and split GPU streams. Inspected49currentframes. **886 imported geometry probes**, **60 actual viewer footprint checks**, six Khronos validations, source/recipe inventory, targeted byte reproduction, scene/30-tick simulation and graph read-once/unload pass.

Anchor **[22.947015043,40.632780936]**, heading **-0.6140197209272313rad**. Retained exact-QID way27715355 matches current main35184399804187 plus five related part/tower controls. Raw11/14/17m tags and absent min_height values retained; both17m controls share the drum-top datum. Main3levels has no retained measured height. Estimated bell hip cap reaches14.75m and dome/cross above17m reach21m. Standard DEM datum24.401000m, display offset0.4m, perimeter-2.40..1.69m; foundations follow terrain and west thresholds use local DEM+0.22m. Exact sunken-court/retaining edges, thresholds, absolute altitude and physical device timings remain unverified. Separate unmapped courtyard gateway/fence, exact reliefs/icons/text, interiors and certified walking excluded. [Current QA and limits](../places/sx/sx0/n0361_hagia_sophia/QA-REVIEW.md).

Ledger **371 ready /367 active previews /629 remaining**. Next **N0362 — Black Church**, Q910124, Brașov, Romania. Next routine full source checkpoint remains **N0360–N0379**. GLBs and bulk captures remain ignored; no Git mutations or uploads.

## N0362 — Black Church, Brașov

Completed 2026-10-15 from three useful exterior pictures and standard viewer PMTiles/DEM. Long gray-tan Gothic hall with very steep broad tiled nave roof and lower polygonal eastern choir; one southwest square clock tower with two geometric clocks, narrow upper slits, tile hip, genuinely open octagonal crown gallery, tile spire and metal tip. Lower western corner, south stair turret, small ridge fleche, tall recessed pointed glazing/wood entries, stepped buttresses/pinnacles, restrained mullions/tracery and circular choir parapet band. Corrected inward-wound tower hip/spire/pinnacle surfaces and verified their outward sides directly.

Master **16,776 triangles / 2,017,224 bytes**. LODs **718 / 3,322 / 12,876 / 16,776 triangles**, **1 / 7 / 7 / 7 draws**; initial geometry **346,956 bytes**. Five existing shared 256² ashlar, limestone, flat tile, wood and standing-seam metal graphs; linear tints, metric UVs, zero embedded images and split GPU streams. Inspected **49 current frames**. **602 imported geometry probes**, **48 actual viewer footprint checks**, six Khronos validations, source/recipe inventory, targeted byte reproduction, scene/30-tick simulation and shared graph read-once/unload pass.

Anchor **[25.588207851,45.641023332]**, heading **0.3169818482414655 rad**. Exact-QID way866090450/Q910124 matches current main35185238179282 plus three nave/choir/apse parts. Raw 41m nave and 37m choir/apse tags are approximate complete roof envelopes, not stacked solids; eaves at 24m and clock tower divisions/65m finial are picture estimates, the latter guided by an unqualified retained Wikidata claim. Retained 89m length/38m width claims do not rescale raw map plans. Standard DEM datum597.075184m, display offset0.4m, perimeter-1.46..-0.17m; foundations follow terrain and thresholds use local DEM + 0.22m. Exact altitude/paving/steps, small ornament and physical device timings remain unverified. Clock mural/numerals, sculpture/inscriptions, interiors and certified walking excluded. [Current QA and limits](../places/u8/u84/n0362_black_church/QA-REVIEW.md).

Ledger **372 ready / 368 active previews / 628 remaining**. Next **N0363 — St. Martin's Cathedral, Utrecht**, Q936545. Routine full source checkpoint remains **N0360–N0379**. GLBs and bulk captures stay ignored; no Git mutations or uploads.

## N0363 — St. Martin’s Cathedral, Utrecht

Completed 2026-10-15 from four useful exterior pictures and standard viewer PMTiles/DEM. Surviving north/south transept, central west gable/entry, polygonal eastern choir, slate cross roof and lower ambulatory/chapels; warm mixed brick/stone, recessed pointed glazing and sparse tracery, flying buttresses and pinnacles. Separate Dom Tower west across an open square: square base/through-passage, narrower belfry and open octagonal upper lantern, slate cap and metal finial. South low U-shaped cloister with open garden arcades. No vanished connecting nave. Fixed thin choir-plan sliver, low annex roof/wall overlap and a blocked arcade; regularized tiny mapped buttress notches to the high/aisle union while detailed foundation retains raw mapped outline. Widened whole-model LOD cameras so all show the complete tall tower, church and cloister.

Master **12,395 triangles / 1,491,964 bytes**. LODs **759 / 3,601 / 11,003 / 12,395 triangles**, **1 / 8 / 8 / 8 draws**; initial geometry **401,092 bytes**. Six existing shared 256² brick, ashlar, limestone, slate, wood and standing-seam metal graphs; linear tints, metric UVs, zero embedded images and split GPU streams. Inspected **49 current frames**. **1,050 geometry probes**, **174 actual viewer footprint checks**, six Khronos validations, source/recipe inventory, targeted byte reproduction, scene/30-tick simulation and shared graph read-once/unload pass.

Anchor **[5.122413686,52.090856631]**, heading **0.3366742404547878 rad**. Exact-QID way1159618262/Q936545 matches current main35185531707094; all 24 current church/cloister/tower stage/envelope/tip/pinnacle controls preserve raw height/min_height tags. Main high/low roofs are tagged33.5/20m; eaves25/13m and subdivisions are approximate. Tower controls retain38.6m base,38.6..68.08m middle,68.08..106.75m upper envelope and106.75..112.32m tip;12 low pinnacles38.6..43m. The112.3m Wikidata claim is qualified to Dom Tower/Q200334, not church walls. Standard DEM datum12.733629m, display offset0.4m, perimeter-1.07..0.81m; foundations follow terrain and thresholds use local DEM +0.22m. Exact altitude/paving/thresholds, sculpture/text/clocks, bells/inner stairs, temporary west artwork, gardens/trees/fountain, interiors and certified walking excluded or unverified. Physical device timing pending. [Current QA and limits](../places/u1/u17/n0363_st_martin_s_cathedral_utrecht/QA-REVIEW.md).

Ledger **373 ready / 369 active previews / 627 remaining**. Next **N0364 — Cathedral of St. Peter and Paul, Brno**, Q45033. Routine full source checkpoint remains **N0360–N0379**. GLBs and bulk captures stay ignored; no Git mutations or uploads.

## N0364 — Cathedral of St. Peter and Paul, Brno

Completed 2026-10-15 from four useful exterior pictures and standard viewer PMTiles/DEM. Twin square stone towers beside the nave/choir junction, open pointed belfries/crowns and very slender green metal needle spires. Broad higher western nave with four small roof dormers per side; lower polygonal east choir and smaller ridge fleche. Warm rubble masonry, pale trims, recessed pointed glazing, stepped buttresses/pinnacles, low northern chapels and southern vestry. West gabled facade, pointed upper/flanking windows and open outer porch with a closed wood entry behind. Corrected the porch back face that occluded the recessed entry, removed an extra horizontal foundation cap and cut side arch apertures through the inner wall skin. Deeper cavity checks pass. Far tiers omit subpixel trim and use coarser triangle subdivision.

Master **8,764 triangles / 1,055,332 bytes**. LODs **1,000 / 3,913 / 8,182 / 8,764 triangles**, **1 / 6 / 6 / 6 draws**; initial geometry **390,980 bytes**. Four existing shared 256² rubble stone, limestone, standing-seam metal and wood graphs; roof and needles share one graph with different tints. Linear colors, metric UVs, zero embedded images and split GPU streams. Inspected **49 current frames**. **708 geometry probes**, **66 actual viewer footprint checks**, six Khronos validations, source/recipe inventory, targeted byte reproduction, scene/30-tick simulation and shared graph read-once/unload pass.

Anchor **[16.607488912,49.191010457]**, heading **-0.07961876147662411 rad**. Exact-QID way32877797/Q45033 matches current main35184404966629. Seven raw plans preserve tags and absent min_height values:40m nave/crossing,30m choir,84m paired tower envelopes and45m fleche. These are full roof/spire controls; estimated eaves28/23m, tower subdivisions42/55/60.5m, chapel/vestry clips, porch dimensions and facade rhythm remain approximate. Retained facts have no independent measured dimensions. Standard DEM datum239.782823m, display offset0.4m, perimeter-3.04..0.84m; foundations follow terrain and approximate thresholds use local DEM +0.22m. Exact altitude/paving/steps, Petrov retaining terraces, sculpture/text/stained-glass art, bells/interiors, surrounding town/landscaping and certified walking excluded or unverified. Physical device timing pending. [Current QA and limits](../places/u2/u2e/n0364_cathedral_of_st_peter_and_paul/QA-REVIEW.md).

Ledger **374 ready / 370 active previews / 626 remaining**. Next **N0365 — Glasgow Cathedral**, Q1473348. Routine full source checkpoint remains **N0360–N0379**. GLBs and bulk captures stay ignored; no Git mutations or uploads.


## N0365 — Glasgow Cathedral

Completed 2026-10-15 from three useful exterior pictures and standard viewer PMTiles/DEM. 49 inspected frames, 1,964 imported geometry probes, 84 actual viewer footprint checks, ten raw PMTiles controls and four existing shared 256² ashlar/limestone/copper/wood graphs. Long nave/choir, lower aisles, crossing transepts, north ranges and open square belfry with tiered octagonal stone spire. Great west window/circular tracery, recessed wood entries, paired clerestory lancets, lower-church windows, buttresses and pinnacles. Corrected portal/window overlap, roof joins that buried clerestory glazing and fields hidden by adjacent ranges. LODs use 794 / 1,777 / 10,532 / 13,132 triangles; initial geometry is 215,964 bytes. Map envelopes, roof subdivisions, crypt levels and coarse DEM/threshold fit remain approximate; exact sculpture/art, graveyard/retaining terraces, full interiors and physical device timing are excluded or pending.

Master **13,132 triangles / 1,579,476 bytes**. Six merged material groups at district/street/closeup, one at skyline; linear tints, metric UVs, zero embedded images and split GPU streams. Six Khronos validations, source/recipe inventory, targeted byte reproduction, scene/30-tick simulation, hash-bound placement and shared graph read-once/unload pass. All current master/runtime/LOD bytes agree with their reports.

Anchor **[-4.23454771,55.86297441]**, heading **0.19451149382379765 rad**. Exact-QID way102152591/Q1473348 matches main35184474241423. All ten raw controls/tags remain unchanged, including spire min_height35m/height62m. Only derived Boolean inputs round to0.1mm to join coincident edges robustly. Approximate tags retain27m high/transept roofs,20m aisle envelope,17m chapter,21m sacristy,7m south range,4m north entry and35m crossing. Lean-to joins15.3m expose the clerestory; roof eaves, openings, crypt floor levels and spire subdivisions remain picture estimates. Standard DEM datum36.618234m, display offset0.4m, perimeter-2.33..3.05m; foundations follow terrain, entries use local DEM+0.22m. No global terrain flattening or road replacement. [Current QA and limits](../places/gc/gcu/n0365_glasgow_cathedral/QA-REVIEW.md).

Ledger **375 ready / 371 active previews / 625 remaining**. Next **N0366 — Ghazanchetsots Cathedral**, Q2001493. Routine full source checkpoint remains **N0360–N0379**. GLBs and bulk captures stay ignored; no Git mutations or uploads.


## N0366 — Ghazanchetsots Cathedral

Completed2026-10-15 from three useful2018–2019 pictures and standard viewer PMTiles/DEM. 49 inspected frames, 1,180 imported geometry probes, 36 actual viewer footprint checks, two raw PMTiles controls and four existing shared 256² ashlar/limestone/standing-seam metal/wood graphs. Photographed2018–2019 cathedral: three faceted entrance porches, round recessed portals, crossed gable lights, narrow arched glazing, folded roofs and faceted drum with tall silver cone/cross. Detached western bell tower has an open base, two arcaded stages and pointed stone cone. Corrected shallow cone proportions and excessive portal panels; approximate steps now meet standard terrain. LODs use 761 / 2,051 / 10,419 / 14,574 triangles; initial geometry is 269,716 bytes. Later restoration changes, exact sculpture/text, surveyed plaza/threshold levels, full interiors and physical device timing are excluded or pending.

Master **14,574 triangles / 1,752,540 bytes**. Six merged material groups at district/street/closeup and one skyline group; linear tints, metric UVs, zero embedded images and split GPU streams. Bell arcades use explicit compact ring meshes at distant tiers. Six Khronos validations, source/recipe inventory, targeted byte reproduction, scene/30-tick simulation, hash-bound placement and shared graph read-once/unload pass. Current master/runtime/LOD bytes agree with their reports.

Anchor **[46.747531266,39.758753614]**, heading **0.09124930272510762 rad**. Exact-QID way292349517/Q2001493 matches main35184664438349(height34.7m); western bell35184706969661 retains15m. Both raw plans/tags and absent min_height values remain exact. Derived Boolean inputs round to0.1mm for core/porch and roof-fold partitions. Main eave10.8m/ridges14.3m, porches10.1m, drum14.3..22.5m/cone33.5m/cross34.7m; bell stages3.5/6.5/10m/cone14.3m/cross15m are approximate subdivisions. Bell uses its own standard-DEM center offset-3.987562m. Standard DEM datum1373.138947m, display offset0.4m; main perimeter-4.51..0.14m, bell-4.56..-3.21m. Main thresholds use estimated display datum+0.2m, with approximate flights to local DEM+0.22m; bell passage uses local DEM+0.22m. No global flattening or road replacement. Actual paved terrace/stair levels, podium/cut-fill and walking unverified. [Current QA and limits](../places/tp/tp1/n0366_ghazanchetsots_cathedral/QA-REVIEW.md).

Ledger **376 ready / 372 active previews / 624 remaining**. Next **N0367 — Freiburg Minster**, Q250212. Routine full source checkpoint remains **N0360–N0379**. GLBs and bulk captures stay ignored; no Git mutations or uploads.


## N0367 — Freiburg Minster

Completed2026-10-15 from three useful exterior pictures and standard viewer PMTiles/DEM. 49 inspected frames, 2,116 imported geometry probes, 240 actual viewer footprint checks, 36 raw PMTiles controls and four existing shared 256² sandstone/ashlar/flat tile/wood graphs. Single stepped west tower with dark recessed portal, wood door, geometric clocks, open octagonal belfry and porous stone lattice spire. Tiled nave, higher polygonal choir/chapel ring, twin cock turrets, pointed glazing, flying buttresses and distinct Romanesque transept rose over an open Renaissance arcade. Corrected coarse west buttresses, thin lattice members and blue vault backing. LODs use 995 / 3,760 / 15,844 / 22,326 triangles; initial geometry is 416,724 bytes. Tiny carved tracery/sculpture, exact stained glass, north-side/fenestration details, Münsterplatz paving/thresholds and physical device timing remain simplified, excluded or pending.

Master **22,326 triangles / 2,682,748 bytes**. Six merged groups at district/street/closeup, one skyline group. Linear tints, metric UVs, flat normals, zero embedded images and split GPU streams. Main walls and lattice spire share sandstone; clock/rose/vault details use flat geometric colors. Far tiers simplify small ornament and use coarse components. Detailed facades regularize tiny map notches, with the raw main foundation retained. Six Khronos validations, source/recipe inventory, targeted byte reproduction, scene/30-tick simulation, hash-bound placement and shared graph read-once/unload pass. Current source/runtime/LOD bytes agree with reports.

Anchor **[7.852891301,47.995541993]**, heading **0.0366136962848245 rad**. Exact-QID way110404213/Q250212 matches main35184482493045. All36 raw main/part plans/tags, including transition min_height30m and octagon min_height37m, remain intact. Main116m agrees with retained116m fact. Approximate component envelopes are not stacked solids: base30m, transition37m, octagon116m, nave35m, choir/apse38m, aisles20m, transept26m, chapel ring14m, twin turrets53m. Eaves26/28m, belfry54..75m, lattice75..114.8m/finial116m and turret body/cones are explicit picture estimates. Derived Boolean inputs round to0.1mm; joined layers, exposed caps and roof partitions reproduce. Flying strips guide piers/arches rather than broad slabs. Standard DEM datum280.811636m, display offset0.4m, perimeter-0.58..1.86m; foundations follow terrain and approximate entries use local DEM+0.22m. No global flattening or road replacement. Absolute altitude/paving/ramps/steps, threshold levels and walking unverified. [Current QA and limits](../places/u0/u0t/n0367_freiburg_minster/QA-REVIEW.md).

Ledger **377 ready / 373 active previews / 623 remaining**. Next **N0368 — Basilica of Saint Nicholas**, Q550514. Routine full source checkpoint remains **N0360–N0379**. GLBs and bulk captures stay ignored; no Git mutations or uploads.


## N0368 — Basilica of Saint Nicholas

Completed2026-10-15 from three useful inspected west/south2016 and east2021 pictures and standard viewer PMTiles/DEM. 49 inspected frames, 1,562 imported geometry probes, 30 actual viewer footprint checks, one raw PMTiles control and four existing shared256² ashlar/limestone/tile/wood graphs. Unequal flat-topped west towers, open south belfry, triple portals/gabled prothyron, paired rounded windows/oculi, six deep side arcade bays, five groups of upper gallery fields and flat eastern wall with framed barred window. Closed the low-tower shoulder gap, fitted side bays clear of the tall tower, repaired round surrounds and lowered east blind arches beneath the central window. LODs use 979 / 1,824 / 12,328 / 23,190 triangles; initial geometry is 262,096 bytes. All heights, inferred north facade, fine Romanesque carving and plaza/doorstep contact are approximate or excluded; physical device timing pending.

Master **23,190 triangles / 2,786,436 bytes**. Six merged groups at district/street/closeup, one skyline group; shared metric UVs, linear cream/tile tints, flat architectural normals, zero embedded images and split GPU streams. Source/import/LOD/input/review hashes, source/recipe inventory, targeted byte reproduction, six Khronos validations, scene/30-tick simulation and shared graph read-once/unload checks pass. Current reports bind the reviewed model bytes.

Anchor **[16.870169215,41.130326863]**, heading **-0.06826997932098744 rad** follows the southern long edge and is signed by the triple west portals/unequal towers versus flat eastern wall. Exact-QID way417998763/Q550514 matches main35184790087595. Its13-vertex raw outline/tags retain absent height/min_height; no separately mapped parts or surveyed dimensions are retained. Internal body/tower/nave/transept subplans approximate the main envelope without rescale. All heights are picture estimates: nave eave25/ridge29.8m, aisle wall20.5/join24m, transept24/29m, north tower18.8m and south27.5m. All30 viewer footprint checks preserve three neighboring buildings and a west-front patch across six outputs. Standard DEM datum10.557088m, display offset0.4m, perimeter-1.28..0.88m; side foundations follow terrain. Floor+0.2m doorways are estimates. Plaza paving, absolute altitude, entry steps/thresholds, interiors and walking remain unverified; entry steps are not modeled. No global flattening or road replacement. [Current QA and limits](../places/sr/sr7/n0368_basilica_of_saint_nicholas/QA-REVIEW.md).

Ledger **378 ready / 374 active previews / 622 remaining**. Next **N0369 — San Thome Basilica**, Q733577. Routine full source checkpoint stays **N0360–N0379**. GLBs/bulk captures remain ignored; no Git mutations or uploads.


## N0369 — San Thome Basilica

Completed2026-10-15 from three useful inspected front/reverse-side/elevated pictures and standard viewer PMTiles/DEM. 49 inspected frames, 1,114 imported geometry probes, 30 actual viewer footprint checks, one raw PMTiles control and four existing shared256² plaster/limestone/tile/wood graphs. Off-white Gothic nave, offset west-south main needle/cross, smaller crossing spire, triple west facade/porch gables, two tiers of pointed side fields, buttresses/pinnacles, red roofs, tall transept and three eastern choir/chapel fingers. Changed the common porch roof into three small gables, seated side doors at estimated entry floor and removed chapel fields hidden under the taller transept. LODs use 523 / 3,703 / 7,859 / 8,447 triangles; initial geometry is 394,100 bytes. Raw8m map height is retained as incomplete whole-building metadata; all authored heights, north/hidden roof details and paving/thresholds are approximate. Fine carvings/interiors and physical device timing remain excluded or pending.

Master **8,447 triangles / 1,016,912 bytes**. Five merged groups at district/street/closeup, one skyline group. Shared metric UVs, linear off-white/red tints, flat normals, no embedded images and split GPU streams. Source/import/LOD/input/review hashes, source/recipe inventory, targeted byte reproduction, six Khronos validations, scene/30-tick simulation and shared graph read-once/unload pass. Door-base probes additionally verify closed wood backing near the estimated floor.

Anchor **[80.277782363,13.033613683]**, heading **-0.2536740015731081 rad** follows the northern nave edge, signed by west entrance/south offset tower and eastern choir/fingers. Exact-QID way1115403900/Q733577 matches main35185487492732. Its30-vertex raw outline retains8m height and absent min_height; no separately mapped parts/surveyed dimensions. The8m whole-building attribute is visibly incomplete for high nave/spires and is retained as metadata, not used as an overall limit. Every authored height is an estimate: main eaves14.5m, nave/transept ridges19.5m/choir18.5m, low chapels8m/roofs10.5m, main square20m/octagon29m/needle44.4m/cross45.5m and crossing22/26.4/27.4m. Derived Boolean inputs round0.1mm; main/porch/high-wall/low-roof partitions reproduce, while raw map/multilingual tags remain exact. Thirty viewer footprint checks preserve three neighbors and a west-front patch across six outputs. Standard DEM datum12.720526m, floor offset0.4m, perimeter-1.42..1.24m. Side foundations follow terrain; door floor+0.2m is approximate. Absolute altitude/courtyard paving/entry steps/thresholds/crypt/interiors/walking unverified or excluded. No global flattening or road replacement. [Current QA and limits](../places/tf/tf3/n0369_san_thome_basilica/QA-REVIEW.md).

Ledger **379 ready / 375 active previews / 621 remaining**. Next **N0370 — St Bavo's Cathedral**, Q938154. Routine full source checkpoint stays **N0360–N0379**. GLBs/bulk captures remain ignored; no Git mutations or uploads.


## N0370 — St Bavo's Cathedral

Completed2026-10-15 from one June2025 western picture, one undated historical southeast architectural picture and current standard viewer PMTiles/DEM only. 49 inspected frames, 1,768 imported geometry probes, 156 actual viewer footprint checks, 22 raw PMTiles controls and four existing shared256² ashlar/limestone/slate/wood graphs. Stepped western tower with recessed vault/wood entry, paired lancet tiers, four89m corner pinnacles and smaller83m crown; slate nave/round choir, lean aisles, high transept/four46m turrets, two29m western stair turrets and low chapel ring. Closed roofs independently of wall cutouts, raised clerestory above roof joins, moved lower fields to exposed chapel faces and removed a window occupied by a buttress. LODs use 754 / 2,894 / 9,473 / 10,793 triangles; initial geometry is 313,024 bytes. Roof/eave subdivisions, modern hidden chapel/north details, exact carving and paving/thresholds remain approximate or excluded; physical device timing pending.

Master **10,793 triangles / 1,298,772 bytes**. Six merged groups at district/street/closeup, one skyline group; metric UVs, linear stone/slate tints, flat normals, zero embedded images and split GPU streams. Source/import/LOD/input/review hashes, source/recipe inventory, targeted byte reproduction, six Khronos validations, scene/30-tick simulation and shared graph read-once/unload pass. Actual aisle-roof probes verify closed surfaces; facade/portal probes verify recesses/closed glazing and a vault clear2.8m with wood/dark backing.

Anchor **[3.727188581,51.052981822]**, heading **-0.24618519330162225 rad** follows the southern high-nave edge, signed by west tower/portal and round-ended eastern choir. Exact-QID way105192350/Q938154 matches main35184477281182. All22 raw main/part plans, tags and absent min_height remain exact after rigid rotation with no rescale. Four89m corner tips agree with retained89m fact. Lower tower60m, upper78m/crown83m, nave/round choir/transept43m, transept turrets46m, aisles/west chapels26m and western turrets29m are whole envelopes rather than stacked solids. Estimated high eaves34/ridges43m, aisle walls18/joins26m, low eaves10/roofs14m, tower shaft18..60/core60..78/crown78..83m with corner shafts78/cones89m and smaller turret subdivisions are explicit picture approximations. Main14m is interpreted as low chapel envelope. Boolean inputs round0.1mm; joined layers and roof differences reproduce, while render shells simplify tiny map notches and detailed foundations preserve the raw main. All156 viewer footprint checks cover22 controls while preserving three neighboring buildings and a west-front patch across six outputs. Standard DEM datum17.738603m, floor offset0.4m, perimeter-1.01..0.51m; foundations follow terrain, main portal uses local DEM+0.22m and secondary doors floor+0.2m. Sint-Baafsplein paving/steps/ramps/thresholds, absolute altitude/cut-fill and walking unverified. Historical picture informs visible proportions only; modern hidden chapel/roof/north details remain approximate. No global flattening or road replacement. [Current QA and limits](../places/u1/u14/n0370_st_bavo_s_cathedral/QA-REVIEW.md).

Ledger **380 ready / 376 active previews / 620 remaining**. Next **N0371 — St. Mary's Cathedral**, Q1193480, Tokyo. Routine full source checkpoint stays **N0360–N0379**. GLBs/bulk captures remain ignored; no Git mutations or uploads.


## N0371 — St. Mary's Cathedral

Completed2026-10-15 from three useful Commons building/belfry photographs, one viewed-only architect aerial and standard viewer PMTiles/DEM. Eight curved silver steel sails, narrow cross skylight, unequal tall glazed ends, wood doors, low beige annexes and detached unequal-blade concrete belfry with an open bell slot. Four existing shared256² stainless/concrete/granite/wood graphs, six merged groups, metric UVs, linear tints, flat architectural normals and zero embedded images. Corrected vertical shell-tip winding using local ruled-surface normals per triangle. **49 inspected frames,716 imported geometry probes,36 current viewer footprint checks**. LODs **532 /2,310 /6,732 /11,020 triangles**; initial skyline plus district **249,212bytes**. Main39.4m height retained; eight ruled sails and other subdivisions approximate the exterior. Belfry location/61.6m auxiliary height and courtyard pocket are explicitly picture-estimated rather than mapped. Terrain grading, exact steel fabrication, hidden annex/interior plans, bell proportions and thresholds remain approximate or excluded; physical device timing pending.

Master **11,020triangles /1,326,044bytes**. Browser bytes skyline:55388, district:193824, street:590260, closeup:1042100. Source/import/LOD/input/review hashes, source/recipe inventory/schema, targeted byte reproduction, six Khronos validations, scene/30-tick simulation and shared graph read-once/unload pass. Actual geometry rays verify outward/closed visible sails, roof cross edges and open bell slot/blades; detailed outputs additionally verify recessed glazing/wood doors and ribbon openings.

Anchor **[139.726526164,35.714287404]**, heading **-0.4231293275906802rad** follows the long roof-spine edge, signed by long western arm, high eastern glass end and southwest belfry/long hall relationship in the aerial. Exact-QID way120704384/Q1193480 matches main35184492793216. Both raw main45-vertex and roof cross12-vertex controls/tags rotate rigidly without rescale. Main height/min_height and part min_height remain absent; part40m is a roof envelope rather than a whole solid church. Retained39.4m controls high eastern shell tip. Center27.5m, west30m, north32m, south26.5m, annex6m and valley feet are picture estimates. Detached bell center[-13,16]m,3.2x2.6m footprint,61.6m auxiliary height, unequal blades/bells and8x8m courtyard pocket are independent estimates with5m/5degree uncertainty; no separate bell control exists in standard PMTiles. Boolean inputs round0.1mm while raw plans stay exact. All36 viewer footprint checks cover both controls while preserving three nearby buildings and west approach patch across six outputs. Standard DEM datum30.944234m, floor0.4m, perimeter-0.06..2.81m; side footings follow terrain, bell base uses local DEM+0.15m. Paving/grading, cuts/fills, steps/ramps/thresholds, absolute altitude and walking unverified. No global flattening or road replacement. [Current QA and limits](../places/xn/xn7/n0371_st_mary_s_cathedral/QA-REVIEW.md).

Ledger **381 ready /377 active previews /619 remaining**. Next **N0372 — Uspenski Cathedral**, Q1355001, Helsinki. Routine full source checkpoint stays **N0360–N0379**. GLBs/bulk captures remain ignored; no Git mutations or uploads.


## N0372 — Uspenski Cathedral

Completed2026-10-15 from three useful Commons2019/2022/2025 entrance/exterior photographs and standard viewer PMTiles/DEM only. Red-brick cross church with three round east apses, high polygonal drum/tiered green copper helmet/gold onion and44m tip, four27m medium roof turrets, eight23m smaller corner tips, lower south22m bell/vestibule tower and joined low link, and open western gabled porch with granite columns/wood entrance. **49 inspected frames,1822 imported geometry probes,336 current viewer footprint checks and52 raw PMTiles controls**. Four existing shared256² brick/granite/copper/wood graphs, six merged groups, metric UVs, linear tints, flat normals and zero embedded images. LODs **885 /3541 /15207 /27987 triangles**; initial geometry **469360bytes**. Corrected unsupported turret bases, a roof-buried window, uncapped base ledges and mismatched simplified wall/cap outlines. Joined the low corridor with an approximate rectangular envelope; smaller distant crosses merge into solid gold tips. Heights are mapped whole envelopes with explicit picture-estimated subdivisions. Fine brick ornament, hidden room/roof plans, precise hill/plaza grading and thresholds remain approximate or excluded; physical device timings pending.

Master **27987triangles /3362072bytes**. Browser bytes skyline:95020, district:374340, street:1478976, closeup:2825460. Source/import/LOD/input/review bindings, source/recipe inventory/schema, targeted byte reproduction, six Khronos validations, scene/30-tick simulation and shared graph read-once/unload pass. Aperture rays verify open porch, recessed closed glazing/wood doors; roof/gold/shaft probes verify seated continuous roof towers and outward closed surfaces.

Anchor **[24.959961931,60.168458719]**, heading **0.04995819636175475rad**, signed by western separate layer1 open porch, eastern round apses and lower southern tower/link. Exact-QID way15242921/Q1355001 matches main35184387331753. Exact-QID way15242921/Q1355001 matches main35184387331753. All52 current controls retain raw plans/tags: main,50 church parts and separate layer1 western porch35185635043709. Main height is absent; all min_height values remain absent. Heights are whole envelopes, not stacked solids: central core23m, drum/copper helmet39m and tip44m; arms21m; four medium roof turrets25m with27m tips; eight smaller shafts/copper pyramids22m with23m tips; corner roofs14.7m; main apse16m/side apses8.8m; south link7.7m; low bell base10.4m/upper16.4m/copper cone20.5m/tip22m; west porch7.5m. There is no retained Wikidata height fact. Picture estimates subdivide these into base5.2m, main eaves16.4m/gable ridges21m/core23m, corner eaves12.2m/hips14.7m, apse eaves12m/roofs16m and side eaves6.4m/roofs8.8m, link eaves5.9m/roof7.7m, central drum16.4..31.8m (lower portion intersects roofs; exposed above approximately23m)/copper helmet31.8..39m/gold onion39..42.5m/cross44m. Medium turret brick16.4..24m (lower portion intersects arm roofs)/copper collar25m/gold/cross27m; small masonry shafts from local footings to20m/copper pyramid22m/gold/cross23m. Low bell wall to16.4m/cone20.5m/tip22m; porch eaves5.7m/ridge7.5m. The three low corridor parts meet at one quantized point; their local bounding rectangle joins the low roof, with sub-metre simplification of its stepped edges. Exposed base ledges are capped. Raw controls rotate rigidly without rescale; Boolean inputs round0.1mm. Exact fenestration, hidden roof joins, carvings, brick courses and doorway steps remain picture estimates.

Standard DEM datum33.868569m, floor offset0.4m, mapped perimeter-2.26..0.45m; footings follow coarse terrain. Western raised threshold/steps and southern doorway contact are visual estimates. Exact hill/plaza rock/grading, cut-fill, paving/steps/ramps/thresholds, absolute altitude and walking remain unverified. No global flattening or road replacement. [Current QA and limitations](../places/ud/ud9/n0372_uspenski_cathedral/QA-REVIEW.md).

**Retained authoring correction:** whole component heights do not specify lower joins. Extend roof turrets into their supporting roofs/walls; cap exposed differences where a lower footprint steps back, and use matching outlines for the adjoining wall/cap. Simplifying one side of that joint alone can leave visible slivers. Keep roof faces independent of wall-opening masks. These corrections are preserved in the recipe and verified current renders.

Ledger **382 ready /378 active previews /618 remaining**. Next **N0373 — Saint Gregory the Illuminator Cathedral**, Q2942349. Routine full source checkpoint stays **N0360–N0379**. GLBs/bulk captures remain ignored; no Git mutations or uploads.


## N0373 — Saint Gregory the Illuminator Cathedral

Completed2026-10-15 from two useful Commons2025 west-front/2019 aerial photographs and current standard viewer PMTiles/DEM only. Warm stone complex with large rear church/steep roof planes/54m main drum-cone-cross, two lower western chapel pavilions/36m cupolas, projecting west gateway-bell shaft/37m open bell arcade cupola, deep round portal and flanking stacked bays, blue polygonal roof skylight, rectangular side window strips and short local approach steps. **49 inspected frames,2034 imported geometry probes,30 viewer footprint checks and one raw36-vertex PMTiles control**. Four existing shared256² ashlar/limestone/granite/wood graphs, six merged groups, metric UVs, linear tints, flat normals and zero embedded images. LODs **558 /2557 /5957 /7811 triangles**; initial geometry **272016bytes**. Raised the hidden main roof apex to40m for the aerial slope and moved drum glazing above the roof join. Retained54m fact and full mapped envelope; internal partitions/tower centers, other heights, rear fenestration and entry/terrain details are explicit picture estimates. Fine carving/panel seams, bells/interiors, park/long approach and surveyed plaza/thresholds remain excluded or approximate; physical device timings pending.

Master **7811triangles /940968bytes**. Browser bytes skyline:54964, district:217052, street:512552, closeup:692380. Current source/import/LOD/input/review bindings, source/recipe inventory/schema, targeted byte reproduction, six Khronos validations, scene/30-tick simulation and shared graph read-once/unload pass. Actual rays verify outward closed cones/main/narthex/skylight roofs, open small bell arcade clear2.2m, recessed closed glazing, main portal clear3.5m with lower wood/dark backing, and deep side bays clear1.2m with lower wood/upper glass.

Anchor **[44.516868288,40.172053712]**, heading **-0.003415557573rad**, signed by projecting west gateway/two lower chapels versus larger eastern church/altar. Retained exact-QID OSM way31622320/Q2942349 matches current main35184403711152. All36 raw vertices/tags remain exact after rigid rotation with no rescale, including two sub-millimetre map artifacts. Main height/min_height remain absent; there are no separate component controls in standard PMTiles. Retained54m whole height controls the main cross tip, not a stack of tower parts. Main church, two western chapels and entrance/narthex are picture-estimated partitions of the mapped envelope. Approximate levels: base12m, main wall21m/steep fan roof with40m apex hidden inside the drum (visible roof joins approximately32..35m); main drum21..42m (lower portion hidden by roof), cone52m/cross54m. Chapel walls18m/hips23m, drums18..30m (lower portion intersects roofs), cones34m/crosses36m. Entrance flat roof16m, bell shaft16..27m, octagonal bell arcade27..31m/cone35m/cross37m. Main drum center[16.5,0.6]m/radius11.2m, chapel drum centers from their mapped-envelope partitions/radius4.65m, front bell center[-44.7,1.2]m/radius3.65m and skylight[-27.5,1]m/radius5.5m are picture estimates, with approximately3m internal location uncertainty. Facet pediments, fenestration, dark-backed deep portal/flanking bays, stairs and hidden roof joins are approximate. Derived Boolean input rounds0.1mm and removes collapsed adjacent points; raw source remains intact. No engineering or survey accuracy claimed. Recombined partition symmetric difference is0.000295275m², below0.1mm input-rounding bounds; extra collinear split vertices do not imply changed geometry. All30 actual viewer footprint checks cover the main and preserve three neighboring buildings plus a western approach patch across six model outputs.

Standard DEM datum989.258594m, model floor0.4m, mapped perimeter-5.02..2.79m; side foundations follow terrain. Portal threshold uses local DEM+0.22m/minimum0.3m above model floor. Short steps approximate the immediate approach. Exact terrace/plaza grading, retaining walls, cut-fill, long approach/ramps, absolute altitude and walking remain unverified. No global flattening or road replacement. [Current QA and limitations](../places/sz/szp/n0373_saint_gregory_the_illuminator_cathedral/QA-REVIEW.md).

Ledger **383 ready /379 active previews /617 remaining**. Next **N0374 — Lucca Cathedral**, Q1282278. Routine full source checkpoint stays **N0360–N0379**. GLBs/bulk captures remain ignored; no Git mutations or uploads.


## N0374 — Lucca Cathedral

Completed2026-10-15 from three useful Commons2023 west-front/north-side elevated/nave-transept roof photographs and current standard viewer PMTiles/DEM only. Asymmetric marble west front with two large/one small deep portico arches, three recessed gallery tiers, red-tiled long nave/aisles and cross transept, rounded apse and southwest69m brick/marble campanile with graduated belfry arches and merlons. **49 inspected frames,1494 imported geometry probes,96 viewer footprint checks and12 raw PMTiles controls**. Five existing shared256-square ashlar/limestone/tile/brick/wood graphs, seven merged groups, metric UVs, linear tints, flat normals and zero embedded images. LODs **667 /1492 /13271 /25603triangles**, initial geometry **196080bytes**. Corrected obstructed galleries, coplanar base/tower overlap, crowded belfry surrounds, rib/window clash and fields buried by attached chapels. Raw map outlines/tags remain intact; only69m tower height is mapped. Most heights, roof partitions, openings, fine ornament and plaza/threshold joins remain approximate; physical device timings pending.

Master **25603triangles /3076412bytes**. Browser bytes skyline:59716, district:136364, street:1159332, closeup:2309644. Current source/import/LOD/input/report bindings, source/recipe inventory/schema, targeted byte reproduction, six Khronos validations, scene/30-tick simulation and shared graph read-once/unload pass. Actual rays verify outward closed roof surfaces, three unequal portico bays clear9.6m to rear door zone, gallery clear0.86m with stone backing, hollow belfry openings clear2.1m, recessed closed glazing and wooden portals.

Anchor **[10.506033674,43.840660731]**, heading **-0.110953247557rad**, signed by west portico/southwest tower versus east rounded apse. Retained exact-QID OSM way180366824/Q1282278 matches current main35184552455656. All22 raw main vertices and11 component plans/tags remain exact after rigid rotation with no rescale. Current mapped campanile35185841751561 has69m height; other height/min_height tags are absent. The western portico, southwest tower, long eastward nave/cross transept and east rounded apse sign the retained axis. Nave/transept roof partitions are picture estimates within the mapped envelope. Approximate levels: portico14.5m, full-width marble galleries15..21.5m and22..28m, narrower central gallery28.5..35m; nave/transept eaves30m/ridges36m; aisle walls19.8m/lean-to joins26.5m; eastern side chapels22m/hips26m; projecting north/south side chapels13m/hips17m; apse30m/faceted roof35.8m. Campanile brick lower shaft0..47m, pale upper47..67m, open belfry tiers with one/two/three/four arches, crenellations67..69m. Recessed tier galleries, arch/column rhythm, clerestory circles, side blind arcades, portals and trim are picture approximations. No survey or engineering accuracy claimed. Base subtracts raw tower plan to remove overlapping walls; upper tower merges a near-collinear map split under0.1m while retaining raw metadata. All96 actual viewer checks cover12 selected main/component controls and retain three neighbors plus west approach across six outputs.

Standard DEM datum18.798031m, floor2.5m, perimeter0.08..2.31m; footings extend below coarse terrain. Portico threshold0.3m above model floor with short local steps. Exact Piazza San Martino grading, threshold joins, absolute altitude and walking remain unverified. No global flattening or road replacement. [Current QA and limitations](../places/sp/spz/n0374_lucca_cathedral/QA-REVIEW.md).

Ledger **384 ready /380 active previews /616 remaining**. Next **N0375 — St. Paul's Cathedral, Mdina**, Q1630170. Routine full source checkpoint stays **N0360–N0379**. GLBs/bulk captures remain ignored; no Git mutations or uploads.


## N0375 — St. Paul's Cathedral, Mdina

Completed2026-10-15 from three useful Commons2005 front/2024 dome-drum/2021 rear photographs and current standard viewer PMTiles/DEM only. Warm limestone Baroque west front with three recessed portals, paired pilasters/capitals, clocks and open belfry towers/curved stone spires, central triangular pediment and upper arched window; larger eastern octagonal drum/low weathered metal dome/ribs/lantern and low nave/aisle roof forms. **49 inspected frames,546 imported geometry probes,48 viewer footprint checks and four raw PMTiles controls**. Five existing shared256-square ashlar/limestone/granite/standing-seam-metal/wood graphs, seven merged groups, metric UVs, linear tints, flat normals and zero embedded images. LODs **639 /1784 /5650 /8042triangles**; initial geometry **241316bytes**. Removed tower/front/base overlaps and made pediments solid from behind. Main20m/dome30m/towers30m remain whole-component map controls; internal heights, octagonal reconstruction and roof partitions are estimates. Fine carving/heraldry/scrolls/clock numerals and hidden rear details remain approximate; coarse DEM exposes taller rear foundations and does not certify plaza/threshold fit. Physical device timings pending.

Master **8042triangles /969156bytes**. Browser bytes skyline:67116, district:174200, street:519064, closeup:735748. Current source/import/LOD/input/report bindings, source/recipe inventory/schema, targeted byte reproduction, six Khronos validations, scene/30-tick simulation and shared graph read-once/unload pass. Actual rays verify closed outward roof/tower/dome/lantern surfaces and solid pediment backs across six outputs; detailed tiers pass open belfries clear2.1m and recessed wood-backed portals/glazing.

Anchor **[14.404111382,35.886427018]**, heading **0.180503202087rad**, signed by twin western towers versus larger rear dome. Retained exact-QID OSM way27044968/Q1630170 matches current main35184399133800. All6 raw whole vertices and current dome19/tower4+4 component vertices and full tags remain exact after rigid rotation with no rescale. Main20m and dome/towers30m heights are PMTiles controls for complete components, not offsets added on top of the main height. West twin-tower facade versus eastward nave/dome signs the retained axis. Main body: estimated low aisle walls12m/parapet13.2m, central nave and transept walls17.8m with low roof20m; full west screen20m/central pediment23.3m/finial24.3m. Towers: lower clock shaft20m, open bell tier20..25.2m, hood25.2..26.3m, curved stone spire26.3..29m/cross30m. Dome: estimated octagonal drum18..25m, low faceted metal canopy25..27.9m, lantern27.8..29.4m/cross30m. Drum center[6.614,-0.708]m/radius9.1m is derived from mapped circular control; octagonal shape/phase and roof partitions are picture estimates. Portals, clocks, window rhythm, stone pilasters/capitals and scrolls are approximate. No survey or engineering accuracy claimed. Base/front/aisle partitions exclude tower plans to avoid duplicate walls. All48 actual viewer checks cover four selected map controls and retain three neighboring buildings plus west approach across six outputs.

Standard DEM datum193.391278m, floor4.1m, perimeter-4.71..3.85m; footings extend below coarse terrain. West threshold0.3m above floor with short steps. Coarse DEM falls beneath the rear plateau and may expose tall foundations; exact plaza/retaining-wall grading, threshold joins, absolute altitude and walking remain unverified. No global flattening or road replacement. [Current QA and limitations](../places/sq/sq6/n0375_st_paul_s_cathedral_mdina/QA-REVIEW.md).

Ledger **385 ready /381 active previews /615 remaining**. Next **N0376 — Cathedral of the Holy Name of Saint Virgin Mary**, Q1637149, Minsk. Routine full source checkpoint stays **N0360–N0379**. GLBs/bulk captures remain ignored; no Git mutations or uploads.


## N0376 — Cathedral of the Holy Name of Saint Virgin Mary

Completed2026-10-15 from three useful Commons2018 whole-front and2026 front/tower-detail photographs plus current standard viewer PMTiles/DEM only. Pale cream plaster/white pilaster Baroque twin-tower front with stacked arches, curved gray metal caps/34.95m crosses, shaped central gable/figure niche/lantern, projecting wood-backed entry/arched glazing/free-standing columns/open balcony and long25m nave/10m aisles/21m rounded rear apse/two smaller cupolas. **49 inspected frames,744 imported geometry probes,498 viewer footprint checks and79 raw PMTiles controls**. Four existing shared256-square plaster/limestone/standing-seam metal/wood graphs, six merged groups, metric UVs, linear tints, flat normals and zero embedded images. LODs **881 /3598 /11343 /16315triangles**; initial geometry **312620bytes**. Separated inset ground entry from elevated balcony/deck and shortened large triangle spans to eliminate conservative rotated-grid spill into the front plaza probe. Full height/min_height tags and retained earlier controls remain intact. Fine ornament and hidden side/rear appearance/roof joins are explicit approximations; exact plaza/threshold joins and physical device timings remain unverified.

Master **16315triangles /1961484bytes**. Browser bytes skyline:80308, district:232312, street:953444, closeup:1432324. Current source/import/LOD/input/report bindings, source/recipe inventory/schema, targeted byte reproduction, six Khronos validations, scene/30-tick simulation and shared graph read-once/unload pass. Actual rays verify outward closed roofs/caps/gable backs, under-overhang air, four projecting columns, real upper belfry openings clear2.1m and recessed glass/wood-backed portal/stone niche beside the simple figure.

Anchor **[27.554656574,53.903119676]**, heading **0.672306071478rad**, signed by paired+X front towers/projection versus rounded-X apse. Retained exact-QID OSM way482601336/Q1637149 matches current main35184854690168. All25 current whole-outline vertices and78 component plans/tags reproduce by rigid rotation without rescale; retained earlier map details remain separately preserved. Main has no height; numerous component height/min_height values are retained. Front twin towers and rectangular entrance projection are native+X; rounded rear apse is-X. Current principal controls: nave25m, aisles10m, apse/link21m, two tower bases20m, narrower tiers25/30m, caps33/34m, crosses34.95m, shaped central gable21.5/22.85/24.5/26.5m, central lantern27m/cross28m, entrance deck11.5m/balcony elements min11..13m, rear side cupolas14m with small17.5m finials, and low side/rear ranges5/7m. Heights are whole component levels, not increments stacked on previous controls. Estimated internal subdivisions: nave walls20m/gable25m; aisle walls9.3m/hips10m; apse walls18m/faceted roof21m; towers lower windows14..18.5m, middle tier20..25m and upper attic25..30m, curved metal caps30..34m/cross34.95m. Front projection walls11.0m/deck11.5m; upper balcony/columns/rail approximately11.5..13m. Gable profile, vaulted portal depth, pilasters/capitals, figure niche and hidden side/rear fenestration/roof joins are picture/map approximations. No survey or engineering accuracy claimed. The inset ground-entry plan is separate from the elevated11.5m deck/min11..13m balcony; columns support that projection. Long XZ triangle spans split at16m skyline/6m nearer levels remove conservative rotated-grid spill without changing shape; all498 actual viewer checks cover79 selected controls and retain three neighbors plus the front plaza across six outputs.

Standard DEM datum209.964141m, floor0.4m, perimeter-0.88..0.00m; footings extend below coarse terrain. Threshold0.3m above floor and short local steps. Exact Freedom Square/side court grading, railing/threshold joins, absolute altitude and walking remain unverified. No global flattening or road replacement. [Current QA and limitations](../places/u9/u9e/n0376_cathedral_of_the_holy_name_of_saint_virgin_mary/QA-REVIEW.md).

Ledger **386 ready /382 active previews /614 remaining**. Next **N0377 — Nikortsminda Cathedral**, Q1802388. Routine full source checkpoint stays **N0360–N0379**. GLBs/bulk captures remain ignored; no Git mutations or uploads.


## N0377 — Nikortsminda Cathedral

Completed 2026-10-15 from three inspected Commons 2007 church/drum/whole and campanile pictures plus standard viewer PMTiles/DEM. Gray-tan stone church with cross-gabled silver metal roofs, tall twelve-sided drum with narrow slits and blind arcades, conical roof and 25.8 m cross. Selected relief crosses/rosettes and wood-backed portal with short steps; western campanile has open middle/upper tiers and a 19.2 m tip. **49 inspected frames, 538 imported geometry probes and 30 viewer footprint checks**. Four existing shared 256-square ashlar/limestone/standing-seam metal/wood graphs, six merged groups, metric UVs, linear tints, flat normals and zero embedded images. LODs **382 / 1,700 / 4,440 / 7,265 triangles**; initial geometry **172,536 bytes**. Extended lower drum support into the roof volume and removed the internal ledge across narrow wall windows. Exact-QID whole outline is retained; all heights and internal partitions are picture estimates. The western campanile/porch assignment has about 3 m internal uncertainty and its separation is unverified. Exact churchyard grading, hidden details/roof joins, thresholds and physical device timings remain unverified.

Master **7265 triangles / 875448 bytes**. Browser bytes: skyline: 37528, district: 135008, street: 395744, closeup: 669380. Current source/import/LOD/input/report bindings, source/recipe inventory/schema, targeted byte reproduction, six Khronos validations, scene/30-tick simulation and shared graph read-once/unload pass. Actual probes verify outward closed roofs/cone/hip, lower drum support, open bell arcades clear for 2.1 m, recessed glass/wood door and continuous lower slits without an internal cap at 5 m.

Anchor **[43.088122567, 42.459252177]**, heading **-0.074998849372 rad**. Retained OSM way 712271284/Q1802388 matches current main 35185084360116. Two raw fragments union into 18 main vertices without rescale. No map heights/min_height or independent component controls were fabricated. Full earlier/Georgian identity metadata remain intact. All 30 actual viewer footprint checks cover the selected whole and preserve three nearby buildings plus a western test patch across six outputs.

Standard DEM datum 1221.879417 m, floor 0.6 m, perimeter -1.38..0.37 m; footings extend below coarse terrain and short local steps approach thresholds 0.3 m above the model floor. Exact yard grading, bell/porch separation and joins, hidden architecture, absolute altitude and walking remain unverified. No global flattening or road replacement. [Current QA and limitations](../places/sz/szw/n0377_nikortsminda_cathedral/QA-REVIEW.md).

Ledger **387 ready / 383 active previews / 613 remaining**. Next **N0378 — Rio de Janeiro Cathedral**, Q2411716. Routine full source checkpoint stays **N0360–N0379**. GLBs/bulk captures remain ignored; no Git mutations or uploads.


## N0378 — Rio de Janeiro Cathedral

Completed for recorded medium-fi exterior/map scope on 2026-10-15 from two inspected Commons 2012 whole exterior and 2016 aerial pictures plus standard viewer PMTiles/DEM. Mapped 75 m high concrete truncated cone, approximately 107 m base/33 m crown, four tall inset window axes, merged concrete louver/rib quadrants, recessed cross skylight and simplified bronze portals/steps. Separate mapped open tapering campanile has six stages, selected bells and a 75 m cross envelope. **49 inspected frames, 406 imported geometry probes, 48 viewer footprint checks and three raw PMTiles controls**. Three existing shared 256-square plain/boardformed concrete and cast-bronze graphs, five merged groups, metric UVs, linear tints, flat normals and zero embedded images. LODs **758 / 3,182 / 9,066 / 20,022 triangles**; initial geometry **365,404 bytes**. Corrected crown/pylon height and dark district switching with additional tiers and omitted-grille coverage color. Full original multilingual identity/map tags and upper min_height 50 m remain retained. Exact glass art, portal sculpture/interiors and tower sub-heights are simplified. **Raw urban DEM varies about 18 m across the main footprint; bounded estimated plaza grading exists only in the source fixture. Noisy host-terrain base fit, surveyed thresholds and physical device timing remain unverified.**

Master **20022 triangles / 2405848 bytes**. Browser bytes: skyline: 80316, district: 285088, street: 777192, closeup: 1656688. Current source/import/LOD/input/report bindings, source/recipe inventory/schema, targeted byte reproduction, six Khronos validations, scene/30-tick simulation and shared graph read-once/unload pass. Actual probes verify outward closed crown/sloped envelope/cross skylight, louver recess air/closed glass backing, bronze portals/bells/outward undersides and open bell stages.

Anchor **[-43.180691413, -22.910798343]**, heading **0.326561305996 rad**. Retained exact-QID way 30621926 matches current main 35184402710758; crown 35184665300982 retains min_height 50 m/height 75 m, and detached campanile 35184553463044 retains height 75 m. All 48 + 20 + 16 vertices/tags reproduce without rescale. Tower location breaks rotational ambiguity. All 48 actual viewer checks cover those three controls and preserve four neighboring buildings plus the inter-building gap across six outputs.

Standard DEM datum 17.295082 m, floor 0.6 m, raw main perimeter -9.53..8.09 m. Raw samples remain unchanged in pmtiles-fit.json. Source review only uses bounded approximate plaza patches, blending back into raw terrain; this does not modify the host. Actual noisy-host base clipping, plaza/door joins, absolute altitude and walking remain unverified. No global flattening or road replacement. [Current QA and limitations](../places/75/75c/n0378_rio_de_janeiro_cathedral/QA-REVIEW.md).

Ledger **388 ready / 384 active previews / 612 remaining**. Next **N0379 — Saint Sophia Cathedral in Polotsk**, Q2465016. Routine full source checkpoint stays **N0360–N0379**, due after that model. GLBs/bulk captures remain ignored; no Git mutations or uploads.


## N0379 — Saint Sophia Cathedral in Polotsk

Completed2026-10-15 from two inspected Commons2025 front and2006 reverse-side pictures plus standard viewer PMTiles/DEM. Off-white Baroque twin towers with two actual open arched belfry tiers each, round-window attics, green caps and estimated 55 m crosses; shaped central/rear gables, tall arched glazing/wood portal, green nave roof, rounded side chapels/rear apse with lanterns and low service ranges. **49 inspected frames, 1,202 imported geometry probes, 30 viewer footprint checks and one51-vertex raw PMTiles whole**. Four existing shared 256-square lime-plaster/limestone/standing-seam metal/wood graphs, six merged groups, metric UVs, linear tints, flat normals and zero embedded images. LODs **793 / 3,680 / 12,517 / 15,369 triangles**; initial geometry **397,304 bytes**. Separate skyline removes tiny roof partitions/trim; district keeps real open belfries. Added service windows, fan glazing and gable opening thickness/reveals. Retained map height5m conflicts with the pictured cathedral and remains cartographic metadata; original source supplies no measured height. Every modeled height/internal partition is an explicit picture estimate. Fine stucco/ironwork/interiors and exact hilltop paving/thresholds remain approximate; physical device timings pending.

Master **15369 triangles / 1847948 bytes**. Browser bytes: skyline: 81436, district: 315868, street: 1037624, closeup: 1311320. Current source/import/LOD/input/report bindings, source/recipe inventory/schema, targeted byte reproduction, six Khronos validations, scene/30-tick simulation and shared graph read-once/unload pass. Actual probes verify outward closed roofs/caps and gable backs, both open tiers of each belfry clear for2.1m, recessed body/gable/service glazing and wood portal.

Anchor **[28.75858498,55.486289303]**, heading **-1.486221584761 rad**. Retained exact-QID way502489243 matches current main35184874578075;51 vertices rotate without rescale. Original multilingual identity/white plaster/green metal roof/building:levels1 tags remain retained. No measured height or independent component plans claimed. All30 current viewer checks cover the whole and retain three neighbors/front plaza across six outputs.

Standard DEM datum133.974217m, floor0.4m, perimeter-2.26..0.00m; footings extend below coarse terrain and short local steps approach threshold0.3m above floor. Exact hilltop paving/door joins, absolute altitude and walking remain unverified. No global flattening or road replacement. [Current QA and limitations](../places/u9/u9u/n0379_saint_sophia_cathedral_in_polotsk/QA-REVIEW.md).

Ledger **389 ready /385 active previews /611 remaining**. Next **N0380 — Dubrovnik Cathedral**, Q584428. The **N0360–N0379 full source checkpoint follows now**, with120 reviewed output bytes and source/review bindings snapshotted before the clean rebuild. GLBs/bulk captures remain ignored; no Git mutations or uploads.

## N0360–N0379 full source checkpoint — passed

Completed 2026-10-15. The N0360–N0379 full source checkpoint passed: **32 generators, 555 forced imports, 510 structure LOD sets and 3148 GLBs** rebuilt in 723s. All **120 reviewed master/runtime/LOD files** reproduced byte for byte, with unchanged model-input, source/review/capture and runtime metadata bindings. Installed source bundle: **assets-06bf9933d26e89c7**. The build reported 49 generator metadata differences and retained the existing files; those differences did not alter this batch's reviewed metadata. Other semantic metadata reconciliation remains separate cleanup. No Git mutations, uploads or release publication were performed.

The local proof retains all120 reviewed output hashes and unchanged per-model input, placement, spec, source manifest, QA, capture-report, map-frame and runtime-sidecar hashes. All generator jobs ran once; every discovered import was forced from source, and four browser levels were regenerated. No engine-wide CI or npm audit was run. Per-model exterior, height/terrain and physical-device limitations remain unchanged.

Ledger **389 ready /385 active previews /611 remaining**. Next explicit model: **N0380 — Dubrovnik Cathedral**, Q584428. Two front/elevated roof pictures and the standard viewer PMTiles/DEM extract are prepared in ignored local artifacts; source authoring and visual approval remain pending. Next routine full source checkpoint: **N0380–N0399**.


## N0380 — Dubrovnik Cathedral

Completed2026-10-15 from two inspected Commons2011 front/2016 elevated-side pictures plus standard viewer PMTiles/DEM. Pale limestone Baroque front with four free-standing columns/recessed wood entry, two side doors, actual figure niches, upper rectangular window/open balcony, volute shoulders/balustrades/statues and triangular crown; gray nave/aisle/transept roofs, pale windowed drum, dark ribbed dome and slender pale lantern/cross. **49 inspected frames, 784 imported geometry probes, 36 viewer footprint checks and one77-vertex raw PMTiles whole**. Four existing shared256-square coursed limestone/continuous limestone/standing-seam metal/wood graphs, six merged groups, metric UVs, linear tints, flat normals and zero embedded images. LODs **911 /1572 /12120 /17137 triangles**; initial geometry **223776 bytes**. Fixed crown/volute edge winding and canopy underside. No measured height or independent component control; all modeled heights/internal partitions/dome position are explicit picture estimates. Fine carving/statue identity, hidden rear/current finish, interiors and exact paving/thresholds remain approximate; physical device timings pending.

Master **17137 triangles / 2060112 bytes**. Browser bytes: skyline: 90496, district: 133280, street: 1064180, closeup: 1563128. Targeted byte reproduction, current source/import/LOD/input/report bindings, source/recipe inventory/schema, six Khronos validations, scene/30-tick simulation and shared graph read-once/unload pass. Actual imported probes verify outward roofs/caps/crown edges/canopy underside, solid columns, open colonnade space, recessed wall/drum/lantern glazing/wood doors and stone niches.

Anchor **[18.110420769,42.639904088]**, heading **0.11135625687rad**. Retained exact-QID way737699509 matches current main35185109788341; all77 raw vertices rotate without rescale. Original multilingual identity/control retained; unrelated northern building_part excluded. No measured heights or independent component controls claimed. All36 viewer footprint checks cover the whole and retain four neighbors/parts plus front plaza across six outputs.

Standard DEM datum13.547986m, floor0.6m, perimeter-0.98..0.29m; footings extend below coarse terrain and local steps approach threshold0.3m above floor. Exact old-town paving/door joins, absolute altitude and walking remain unverified. No global flattening or road replacement. [Current QA and limitations](../places/sr/srs/n0380_dubrovnik_cathedral/QA-REVIEW.md).

Ledger **390 ready /386 active previews /610 remaining**. Next **N0381 — St. Pierre Cathedral**, Q666516. Next routine full source checkpoint **N0380–N0399**. GLBs/bulk captures remain ignored; no Git mutations or uploads.


## N0381 — St. Pierre Cathedral

Completed2026-10-15 from inspected Commons2013 front,2014 southwest,2020 elevated and an undated older rear-detail picture plus standard viewer PMTiles/DEM. Six-column pale classical portico with actual clear entry space/recessed wood portals,triangular pediment/rounded gray vault; adjoining Gothic Maccabees chapel with tall pointed glazing/clean steep brown roof,buttressed nave/aisles/rounded apse,unequal actual open belfry towers and tall green octagonal central spire. **49 inspected final frames,1294 imported geometry probes,96 viewer footprint checks and11 raw PMTiles controls/312 current vertices**. Five existing shared256-square stone/continuous limestone/flat tile/copper/wood graphs,seven groups,metric UVs,linear tints,flat normals and zero embedded images. LODs **945 /3896 /15604 /19340 triangles**;initial geometry **391936 bytes**. Fixed overlapping core/base and residual front strip that blocked the portico,roof spikes following buttress jogs,and conservative far-footprint spill. No measured heights;all vertical architecture/internal partitions/clean roof contours remain explicit estimates. Exact carving/current hidden finish,interiors and surveyed paving/thresholds remain approximate;physical-device timings pending.

Master **19340 triangles /2324904 bytes**. Browser bytes:skyline:87300, district:304636, street:1278952, closeup:1600080. Targeted byte reproduction,current source/import/LOD/input/report bindings,source/recipe inventory/schema,six Khronos validations,scene/30-tick simulation and shared graph read-once/unload pass. Actual probes verify outward roofs/pediment/canopy underside,six columns,full-depth portico air,36 open belfry arches and first-hit recessed glazing/wood doors.

Anchor **[6.148535178,46.201101002]**,heading **-0.403878092016rad**. Retained exact-QID way397737238 matches current main35184769826070. Current whole113 vertices differs from earlier124;original multilingual identity/control remains verbatim. Main/ten component controls reproduce312 raw vertices/tags rigidly. No individual component identity or measured height fabricated. All96 current viewer checks cover11 controls and retain four neighbors/front plaza across six outputs.

Standard DEM datum405.265282m,floor2m,perimeter-2.02..1.58m;footings extend below coarse terrain and local steps approach threshold0.5m above floor. Exact hilltop paving/door joins,absolute altitude and walking remain unverified. No global flattening or road replacement. [Current QA and limitations](../places/u0/u0h/n0381_st_pierre_cathedral/QA-REVIEW.md).

Ledger **391 ready /387 active previews /609 remaining**. Next **N0382 — Cathedral of Our Lady Immaculate**,Q667450. Next routine full source checkpoint **N0380–N0399**. GLBs/bulk captures remain ignored;no Git mutations or uploads.


## N0382 — Cathedral of Our Lady Immaculate

Reviewed 2026-10-15 from three inspected Commons pictures (2021 front, 2021 west transept, 2015 front oblique) plus standard viewer PMTiles/DEM. Pale Romanesque front with three deep round porches, paired two-stage supports, rectangular timber portals beneath arched stone tympana, twelve-spoke wheel rose, round window tiers, blind arcades and raised gable/abstract figures. Red-tiled nave/aisles and transepts, scalloped apse/ambulatory, broad rounded east chapel, actual open paired rear belfries, octagonal lantern and front corner chapel/gray-roof turret. **49 final frames inspected, 1952 imported geometry probes and 36 viewer footprint checks passed.** Four existing shared 256-square stone/continuous limestone/tile/wood graphs. LODs **654 / 3856 / 12673 / 42641 triangles**; initial geometry **367272 bytes**. Corrected blocked porches, hidden/disconnected supports, floating figures, gable arcade crossings, pilaster/window overlaps and stairs. All heights, internal partitions and hidden architecture remain explicit estimates. **Exterior and approximate horizontal placement accepted; host-DEM ground contact remains pending.**

Master **42641 triangles / 5120572 bytes**. Browser bytes: skyline: 62476, district: 304796, street: 998384, closeup: 3747992. Targeted byte reproduction, current source/import/LOD/input/report bindings, source/recipe inventory/schema, six Khronos validations, scene/30-tick simulation and shared graph read-once/unload pass. Split POSITION/NORMAL streams avoid duplicate upload totals. Probes verify actual clear porch air behind supports, wood/stone backing, belfry arches and appropriate recessed glazing; small flat street/district fields are intentional.

Anchor **[7.422658929,43.730341513]**, heading **1.5098034602171353rad**. Retained exact-QID way/362871296 matches current main 35184734960128. All 71 current raw vertices/tags reproduce rigidly; original multilingual identity and earlier 109-vertex control remain intact. Signed long nave-wall edge corrects the old minimum-rectangle heading by 6.887668 degrees. No independent components or measured heights were supplied. Whole/four neighbors/front plaza checked across six outputs.

**Terrain remains unverified in the host.** Standard DEM datum 58.459324m, floor 1.5m and raw perimeter -16.53..9.98m produce roughly 26.5m of slope through the footprint. The bounded source-preview plaza is an explicit estimate at Y=0.4m, footprint plus 8m with a further 16m blend. It does not alter host terrain. The Y=0 coordinate convention was reviewed; runtime front skirt exposure/rear clipping, exact street/door joins, absolute altitude and walking contact remain pending. Raw samples retained; no global flattening or road replacement. [Current QA and limitations](../places/sp/spv/n0382_cathedral_of_our_lady_immaculate/QA-REVIEW.md).

Ledger **392 ready / 388 active previews / 608 remaining**. Readiness covers the exterior/horizontal review scope, not surveyed ground contact. Next **N0383 — Esztergom Basilica**, Q991832. Next routine full source checkpoint **N0380–N0399**. GLBs and bulk captures remain ignored; no Git mutations or uploads.


## N0383 — Esztergom Basilica

Reviewed2026-10-15 from inspected2012 aerial,2013 front and an undated older aerial (uploaded2006), plus standard viewer PMTiles/DEM. Broad pale masonry basilica with eight free-standing classical portico columns, clear deep portico/inset timber portals and triangular pediment; two wing passages with actual open round arches/balustrades, square tower bases/oculi, octagonal upper stages and green domes/crosses. Dominant24-column central drum with recessed rectangular bays, heavy cornice and ribbed green copper dome/orb/cross; side lunettes/paired round fields, shallow copper roof and rear parapeted terrace. **49 final frames inspected,1604 imported geometry probes and30 viewer footprint checks passed.** Four existing shared256-square stone/continuous limestone/copper/wood graphs, six groups, metric UVs, linear tints and flat normals; no embedded images. LODs **870 /3275 /15608 /29430 triangles**; initial geometry **409204 bytes**. Corrected tower-door trim obstruction, conservative stair footprint spill and an over-tall drum. **Existing100m height/dome tag and120m length/40m width facts retained; modeled90m tip above entrance floor is an explicit picture estimate because source measurement scope/datum is unresolved.** Other heights/internal partitions/hidden/current finishes are approximate. Exact hilltop ground/retaining-wall and doorway joins, absolute altitude and physical-device timings remain unverified.

Master **29430 triangles /3535260 bytes**. Browser bytes:skyline:89492, district:319712, street:1489880, closeup:2876692. Targeted byte reproduction,current source/import/LOD/input/report bindings,source/recipe inventory/schema,six Khronos validations,scene/30-tick simulation and shared graph read-once/unload pass. All imported levels have split POSITION/NORMAL streams and equal CPU/GPU totals. Actual probes verify outward roofs/portico underside,eight solid facade supports,clear portico lanes and wing passages,recessed glazing/wood backing,and no drum columns protruding above their corrected stage.

Anchor **[18.736478664,47.79909506]**,heading **0.494588533929rad**. Retained exact-QID way/77102132 matches current main35184449190964; current whole24 vertices versus earlier34. Dome component35185413897395 has20 vertices/height100m. Both controls reproduce44 current raw vertices/tags rigidly; exact identity and multilingual metadata remain intact. About116.4m mapped length/94.4m width includes lateral tower wings; central body about43.8m wide. Existing100m height/120m length/40m width facts are preserved without forcing an unspecified measurement scope onto the entire envelope. Model exterior tip90m above estimated entrance floor is a picture proportion estimate; crypt/basement-to-cross datum unresolved.

Standard DEM datum156.867491m,floor0.8m,raw perimeter-13.18..0.22m. Footings crossY=0 and extend below coarse terrain; local eastern steps descend toward front samples. Exact hilltop retaining-wall/ground contacts,street/door joins,absolute altitude and walking remain unverified. No preview flattening,host DEM changes or road replacement. Two neighbors/front plaza retained across six outputs. [Current QA and limitations](../places/u2/u2m/n0383_esztergom_basilica/QA-REVIEW.md).

Ledger **393 ready /389 active previews /607 remaining**. Readiness accepts the exterior/approximate placement scope; it does not establish surveyed height datum or ground contact. Next **N0384 — São Paulo Cathedral**,Q1050668. Next routine full source checkpoint **N0380–N0399**. GLBs/bulk captures remain ignored;no Git mutations or uploads.


## N0384 — São Paulo Cathedral

Reviewed2026-10-15 from inspected2025 complete elevated front,2026 low-angle front detail and an older undated city overview,plus standard viewer PMTiles/DEM. A misleadingly titled lateral photograph showed an interior and was excluded from exterior evidence. Twin pale Gothic towers with pointed fields/recessed louver stages,corner shafts/pinnacles,steep green octagonal spires and92m crosses. Deep central and tower timber/glass portals,large geometric wheel/flower rose,steep central stone gable,small lancets/supported simplified figures and connected entry landing/broad stairs. Buttressed nave/aisles,gabled transepts,faceted southern apse,green copper roofs and broad ribbed dome/actual open lantern/cross at70m. **49 current frames inspected,1384 imported geometry probes and66 viewer footprint checks passed.** Four existing shared256-square stone/continuous limestone/copper/wood graphs,six groups,metric UVs,linear tints,flat normals and no embedded images. LODs **650 /3306 /11903 /15915 triangles**;initial geometry **377132 bytes**. Corrected roof/window intersections,buried tower fields,figure/lancet overlap,disconnected landing and district portal backing. Raw26/40/70/92m heights and92m height/111m length/46m width facts retained;floor/measurement datum and hidden side/rear details remain approximate. **Exact runtime urban terrain contact remains unverified.**

Master **15915 triangles /1913452 bytes**. Browser bytes:skyline:68368, district:308764, street:1087120, closeup:1471916. Targeted byte reproduction,current source/import/LOD/input/report bindings,source/recipe inventory/schema,six Khronos validations,scene/30-tick simulation and shared graph read-once/unload pass. All runtime levels have split POSITION/NORMAL streams and equal CPU/GPU totals. Actual probes verify outward roofs/spires/crosses,connected entry landing,open lantern,clear district/near portal recesses,and first-hit recessed glass/wood/shutter backing.

Anchor **[-46.63437728,-23.551283288]**,heading **1.153725362049rad**. Retained exact-QID way/8093737 matches current main35184380182569. Whole16 vertices versus earlier26; five component controls add40 vertices. All56 current vertices/tags reproduce rigidly,with original multilingual identity and earlier control retained. Main26m,towers92m,nave/cross40m,dome70m raw heights and existing92m height/111m length/46m width facts remain intact. Cap/ridge/tip levels are interpreted above an estimated0.6m floor; internal stages/eaves,roof contours,buttresses/flying arches and hidden details are picture estimates.

Standard DEM datum791.873583m,raw whole perimeter-15.73..-0.36m. Footings crossY=0 and extend below raw samples;front landing/stair grade is approximate. No source preview flattening or host DEM change. Runtime foundation exposure/base clipping,exact plaza/street/door joins,absolute altitude and walking remain unverified. Four neighboring buildings/front plaza retained across six outputs;no road replacement. [Current QA and limitations](../places/6g/6gy/n0384_sao_paulo_cathedral/QA-REVIEW.md).

Ledger **394 ready /390 active previews /606 remaining**. Readiness accepts the exterior/approximate horizontal-placement scope,not surveyed ground/height datum. Next **N0385 — Serbian Orthodox Cathedral in Sarajevo**,Q1271286. Next routine full source checkpoint **N0380–N0399**. GLBs/bulk captures remain ignored;no Git mutations or uploads.


## N0385 — Serbian Orthodox Cathedral in Sarajevo

Reviewed2026-10-15 from four inspected2006/2011/2019/2023 exterior photographs and standard viewer PMTiles/DEM;no bespoke plans/surveys. Single projecting western square bell tower with round-headed dark louver fields,clocks,pediments,rounded-square swelling metal cap,dark upper lantern/onion and gold cross. Broad central windowed drum/dome plus four smaller corner drums/domes over dark hip roof;rose-brown plaster body,cream pilasters/cornices,recessed round-headed windows/portals,front/rear curved shoulder gables,three eastern rounded apses and connected entry landing/stairs. **49 current frames inspected,1308 imported geometry probes and246 viewer footprint checks passed.** Four existing shared256-square plaster/continuous limestone/standing-seam metal/wood graphs,six groups,metric UVs,linear tints,flat normals and no embedded images. LODs **909 /2427 /15162 /41753 triangles**;initial geometry **332900 bytes**. Corrected angular bulb,light cap lantern,sideways shoulders and district door backing.247 current whole/component vertices,tags,heights/min_height values retained rigidly;floor,overlapping stage interpretations and hidden details remain approximate. **Exact runtime terrain contact remains unverified.**

Master **41753 triangles /5014056 bytes**. Browser bytes:skyline:94552, district:238348, street:1452568, closeup:3896604. Targeted byte reproduction,current source/import/LOD/input/report bindings,source/recipe inventory/schema,six Khronos validations,scene/30-tick simulation and shared graph read-once/unload pass. Split POSITION/NORMAL streams and equal CPU/GPU totals. Actual rays verify outward roofs,connected landing,clear door/near field recesses and glass/wood/clock backing behind intentional mullions. Street satellites keep flat fields to meet16k;closeup has actual recesses.

Anchor **[18.425198099,43.858218828]**,heading **0.265486248946rad**. Retained exact-QID way/157329998 matches current whole35184529418830. Whole25 distinct vertices versus earlier25/closing-point control;35 component controls bring current total247. All raw heights/min_height values retained,including15.5m whole,45.62m tower tip,34m central dome/35.86m cross and25m satellite domes/25.95m crosses. Empty Wikidata height/width/length arrays and original multilingual identity retained. Cap-stage/roof interpretations above estimated0.6m floor,hidden bay rhythm and plaster/ornament details remain approximate.

Standard DEM datum552.646207m,raw whole perimeter-1.63..1.46m. Foundations crossY=0 and extend below raw samples;landing/stairs are approximate. No preview flattening or host DEM change. Runtime base clipping,exact garden/street/door joins,absolute altitude and walking remain unverified. Four neighboring buildings/front garden retained across six outputs;no road replacement. [Current QA and limitations](../places/sr/srv/n0385_serbian_orthodox_cathedral_in_sarajevo/QA-REVIEW.md).

Ledger **395 ready /391 active previews /605 remaining**. Readiness accepts the exterior/approximate horizontal-placement scope. Next **N0386 — Archcathedral Basilica of St. Peter and St. Paul**,Q2064095. Next routine full source checkpoint **N0380–N0399**. GLBs/bulk captures remain ignored;no Git mutations or uploads.


## N0386 — Poznań Cathedral

Reviewed2026-10-15 from undated front,2006 and2012 eastern exteriors and a distant hazy2026 aerial used only for broad silhouette,plus standard viewer PMTiles/DEM.No bespoke plans/surveys. Twin tall western brick towers with dark copper belfries,recessed louvers,narrow lower fields,one southern front clock and tiered caps/crosses. Deep central pointed portal/window field and stepped Gothic pale-panel gable. Long pitched green nave/lower aisles,three smaller faceted eastern brick choir towers with swelling copper caps/actual open lanterns/onions,and pale ambulatory/chapels with domed eastern chapel,pilasters and supported geometric figures. **49 current frames inspected,1412 imported geometry probes and174 viewer footprint checks passed.** Five existing shared256-square brick/stone/copper/wood/plaster graphs,seven groups,metric UVs,linear tints,flat normals and no embedded images. LODs **997 /3247 /13319 /24318 triangles**;initial geometry **415856 bytes**. Corrected front-belfry tone,short gable panels,oversized plinths and a brick pattern reading as vertical bands.337 current vertices/tags and raw0.1m envelope/component height controls retained rigidly;72m length/36m width facts retained with differing mapped scope. Floor,hidden architecture and exact runtime terrain contact remain approximate or unverified.

Master **24318 triangles /2922276 bytes**. Browser bytes:skyline:102480, district:313376, street:1153264, closeup:2178900. Targeted byte reproduction,current source/import/LOD/input/report bindings,source/recipe inventory/schema,six Khronos validations,scene/30-tick simulation and shared graph read-once/unload pass. Split POSITION/NORMAL streams and equal CPU/GPU totals. Actual rays verify outward roofs,connected landing,clear air through three choir lanterns at all levels,door/near-field recesses and glass/wood/clock backing behind intentional mullions. Street retains flat alternating lower aisle/chapel fields. Whole LOD views show the complete envelope;generic street/detail fixtures intentionally crop other sections.

Anchor **[16.94871332,52.41158606]**,heading **0.399652257489rad**,refined **+4.542450deg** from prior minimum-area axis using long north nave edge. Retained exact-QID way/279545051 matches current whole35184651633883. Current whole114 versus earlier117 distinct vertices;23 component controls bring total337,all rigidly preserved with raw tags.0.1m whole tag retained as envelope/base,not roof height.52/62m front tower controls,44m choir towers,35m nave,24m aisles,28m narrow cross-nave strips and11.2..18m low caps preserved. Existing72m length/36m width facts retained;whole80.6x44.1m includes projecting chapels/buttresses/porches,with no rescale. Cap-stage/eave/roof interpretations above estimated1m floor and hidden side rhythm/ornament remain approximate.

Standard DEM datum59.888618m,raw perimeter-1.25..0.91m. Foundations crossY=0 and extend below raw samples;landing/stairs approximate. No preview flattening or host DEM change. Runtime base clipping,exact plaza/street/door joins,absolute altitude and walking unverified. Four neighbors/front plaza retained across six outputs;no road replacement. [Current QA and limitations](../places/u3/u3k/n0386_archcathedral_basilica_of_st_peter_and_st_paul/QA-REVIEW.md).

Ledger **396 ready /392 active previews /604 remaining**. Readiness accepts exterior/approximate horizontal placement. Next **N0387 — Crystal Cathedral**,Q1051217. Next routine full source checkpoint **N0380–N0399**. GLBs/bulk captures remain ignored;no Git mutations or uploads.


## N0387 — Crystal Cathedral

Reviewed2026-10-15 from three actually inspected2007/2009 exterior/spire photographs and standard viewer PMTiles/DEM.No bespoke plans/surveys or redistributed reference photographs. Individually authored four-point folded glass shell with high wing tips/inward valleys,blue-gray pane grid,silver primary framing and recessed low entrances. Separate mapped73m open steel spire has pointed staggered blades,connectors,simplified bell rows and a small capped pale pavilion. **49 current frames inspected,156 imported geometry probes and42 actual viewer-footprint checks passed.** Four existing shared256-square graphs,five groups,metric UVs,linear tints,flat normals,no embedded images. LODs **828 /1780 /5024 /7960 triangles**;initial geometry **225096 bytes**. Corrected portable glass tone,blade density and conservative footprint stamps covering the real plaza gap.15 current map vertices/tags,40m/73m controls and signed rigid placement retained. Roof folds,entrances,steel/bell details,floor and exact ground contact remain estimated or unverified.

Master **7960 triangles /958508 bytes**,runtime957992 bytes. Browser bytes:skyline72244,district152852,street421956,closeup702128. Targeted byte reproduction,current source/import/LOD/input/report bindings,source/recipe inventory/schema,six Khronos validations,scene/30-tick simulation and actual shared-texture read-once/unload pass. Split POSITION/NORMAL streams and equal CPU/GPU totals. Capture telemetry now recognizes the existing :glass shared-material variant while retaining real texture UUID validation. No engine runtime change. Window-slot glass uses its existing untinted graph;skyline uses canonical graph mean. Actual geometry rays verify roofs,recesses,glass backing and genuine spire air at all levels.

Anchor **[-117.898898516,33.787396967]**,heading **-0.442946546014rad**,unchanged. Retained exact-QID way/29280620 matches current main35184401369452,11 versus earlier32 distinct vertices. Separate associated spire35184492802876 adds4 vertices. All15 raw current vertices/tags and40m/73m heights retained without rescale. Spire association is positional/visual,not an independent exact-QID claim. Four neighbors and open plaza gap retained across six outputs after local triangle subdivision corrected conservative footprint stamping. Other campus buildings/basins/gardens/roads remain host content.

DEM datum39.853387m,estimated floor0.8m,raw perimeter-0.09..0.37m. Footings crossY=0 and extend below raw samples. No flattening,host DEM change or road replacement. Exact plaza/street/door joins,base clipping,absolute altitude and walking unverified. Roof folds/valleys,grid pitch,entrances,blade sections/offsets,bell count,pavilion/current campus changes remain estimates. Opaque exterior glazing;interiors/transmission and engineering detail simplified. [Current QA and limitations](../places/9q/9qh/n0387_crystal_cathedral/QA-REVIEW.md).

Ledger **397 ready /393 active previews /603 remaining**. Readiness accepts exterior/approximate horizontal placement. Next **N0388 — Samtavisi Cathedral**,Q1269808. Next routine full source checkpoint **N0380–N0399**. GLBs/bulk captures remain ignored;no Git mutations or uploads.


## N0388 — Samtavisi Cathedral

Reviewed2026-10-15 from actually inspected2010 eastern,2019 southern exterior and2024 east-context pictures plus standard viewer PMTiles/DEM.No bespoke plans/surveys or redistributed reference photographs. Individually authored stepped cream/tan ashlar body,red-tile nave/cross gables and lower lean roofs,tall12-sided slit drum and brown-gray cone/cross. Decorated east facade has two genuine deep pointed V-section niches,large geometric cross,slit frame,selected rosettes/paired diamonds and round blind arches. Southern transverse gable/slit,blind bays and small recessed western-side door/landings complete the main church. **49 current frames inspected,514 actual geometry probes and30 viewer-footprint checks passed.** Five existing shared256-square graphs,seven groups,metric UVs,linear tints,flat normals,no embedded images. LODs **240 /2172 /6072 /8326 triangles**;initial geometry **234512 bytes**. Corrected shallow arcade readability with rib depth. Four current map vertices/raw tags and earlier exact identity retained rigidly;all component partitions/heights,hidden rear details,floor and exact ground contact are estimates or unverified. Separate bell tower/ruins remain host content.

Master **8326 triangles /1003204 bytes**,runtime1002572 bytes. Browser bytes:skyline25604,district208908,street558008,closeup752116. Targeted byte reproduction,current source/import/LOD/input/report bindings,source/recipe inventory/schema,six Khronos validations,scene/30-tick simulation and actual shared-texture read-once/unload pass. Split POSITION/NORMAL streams,equal CPU/GPU totals. Actual rays verify outward roofs/cone/continuous drum support,genuine0.62m clearance into east niches with deeper inclined masonry backing,real door/slit recesses and correct wood/glass backing,connected landing surfaces. Final recipe cleanup removed unused declarations/style notices without changing any GLB bytes;captures were refreshed and compared to the actually inspected contact sheets.

Anchor **[44.408904194,42.006342721]**,heading **0.194449913877rad**,unchanged. Exact-QID way/161568098 matches current35184533656930 by rigid envelope/location. Four current corners/raw tags and earlier five distinct corners/multilingual identity retained with empty dimension arrays. No map height/min_height/component controls. Whole about26.75x19.45m;central nave width8.8m,cross x[-2.4,5.1],drum center[1.35,0]/radius4.05 and all heights are picture estimates. Lower8.8/11.6m,nave13.8/16.5m,drum15.8..24.3m,cone30.5m/tip31.4m above0.6m floor.2019 red tile guides lower roofs over older gray finish;current finish/hidden details approximate. Three nearby buildings/east court retained across six outputs. Separate bell tower,ruins/enclosure/trench and roads remain host content.

Standard DEM datum686.884168m,raw perimeter-0.66..1.63m. Footings crossY=0 and extend below raw samples;steps/landings approximate. No flattening,host terrain change or road replacement. Exact yard/street/door joins,base clipping,absolute altitude and walking unverified. Fine interlace/inscriptions/figures,full interiors and engineering accuracy simplified or excluded. [Current QA and limitations](../places/sz/szr/n0388_samtavisi_cathedral/QA-REVIEW.md).

Ledger **398 ready /394 active previews /602 remaining**. Readiness accepts main-church exterior/approximate horizontal placement. Next **N0389 — Cathedral of Christ the Saviour**,Q135271,Banja Luka. Next routine full source checkpoint **N0380–N0399**. GLBs/bulk captures remain ignored;no Git mutations or uploads.


## N0389 — Cathedral of Christ the Saviour, Banja Luka

Reviewed 2026-10-15 from four actually inspected 2018/2019 exterior/porch/carving/tower photographs and standard viewer PMTiles/DEM. No bespoke plans/surveys or redistributed reference pictures. Individually authored five-domed striped church with curved side gables, recessed rose windows/wooden portals and sparse white star/diamond relief. A low northwest three-door porch/wing joins the separate mapped clock tower, with paired louvers, four clocks, stepped cornices and a genuinely open upper crown/cap. **49 current frames inspected, 1419 actual geometry probes and 42 viewer-footprint checks passed.** Five existing shared 256-square graphs, seven merged groups, metric UVs, linear tints, flat normals and no embedded images. LODs **792 /3931 /15837 /37632 triangles**; initial geometry **430024 bytes**. Fixed crown support and filled the raised porch gable. Both raw map controls retain all36 vertices/tags and22.37/44.95m heights rigidly. Internal partitions, height datums, crown openness, hidden bays and exact ground contact remain estimates or unverified. Distant average color and simplified street band pitch are intentional LOD differences.

Master **37632 triangles /4519980 bytes**, runtime4519328 bytes. Browser bytes: skyline82460, district347564, street1343344, closeup3236020. Targeted byte reproduction, current source/import/LOD/input/report bindings, source/recipe inventory/schema, six Khronos validations, scene/30-tick simulation and actual shared-texture read-once/unload pass. Split POSITION/NORMAL streams, equal CPU/GPU totals. Real rays verify outward roofs/six dome caps, continuous crown support, air through crown at three heights, door recesses/landings at district+ and all glazing/rose/louver recesses with correct backing at street+.

Anchor **[17.191717162,44.772231084]**, heading **0.921711846857rad**, unchanged. Exact-QID way/1287023880 matches current whole35185659112712; separate associated tower35185837450814 fits the low link. Tower association is positional/visual, not another exact-QID claim. Current32 whole plus4 tower vertices, all raw tags and22.37/44.95m heights retained without rescale; earlier48 distinct whole vertices/multilingual identity and empty dimension arrays retained. Native+X northeast ornate side, +Z southeast apse, -Z northwest low porch; tower at[-16.72,-8.59]. Height controls interpreted as highest respective crosses above0.8m floor, datum unverified. Main roof14.6m, central drum14..19.4/cap21.65/cross22.37, satellite tips18.35, porch hip5.4/raised curved gable6.05 and tower stage profiles are picture estimates. Three neighbors/east-west court patches retained across six outputs; roads remain host content.

Five existing ashlar/marble/standing-seam/bronze/wood graphs; pink/ochre bands share one graph/draw. Detailed source band pitch0.68m, street1.36m and distant averaged color are inspected LOD differences. Sparse geometric relief/tracery substitutes for fine icons/interlace/lettering. Hidden bays, current finishes, full interiors/bells and engineering accuracy simplified or excluded. DEM datum166.450042m, raw perimeter-0.23..0.19m; foundations crossY=0 and extend below samples. Exact plaza/street/door joins, base clipping, absolute altitude and walking remain unverified. No flattening, host terrain change or road replacement. [Current QA and limitations](../places/sr/sru/n0389_cathedral_of_christ_the_saviour/QA-REVIEW.md).

Ledger **399 ready /395 active previews /601 remaining**. Readiness accepts exterior/approximate horizontal placement. Next **N0390 — Havana Cathedral**, Q15043487. Next routine full source checkpoint **N0380–N0399**. GLBs/bulk captures remain ignored; no Git mutations or uploads.


## N0390 — Havana Cathedral

Reviewed 2026-10-15 from actually inspected Dudva2024 front, Ji-Elle2015 front/plaza and lin padgham2019 elevated roof pictures, plus standard viewer PMTiles/DEM only. No bespoke plans/surveys or redistributed photographs. Individually authored unequal clock/bell towers with genuinely open stages/crowns, wavy pale-stone Baroque screen, three recessed timber doors, two column orders, blind niches, broken cornices/pediments and simplified floral tracery/volutes. Red clay nave/aisle/rear roofs and broad rear dome/open lantern complete the envelope. **49 current frames inspected, 745 actual geometry probes and 48 viewer-footprint checks passed.** Four existing shared256-square graphs, six merged groups, metric UVs, linear tints, flat normals and no embedded images. LODs **986 /3860 /12540 /18283 triangles**; initial geometry **396464 bytes**. Fixed side-to-side bell air blocked by inner walls, crown aperture placement, conservative stamps hiding a neighbor, and tall entrance-step blocks. All37 raw map control vertices/tags and11/17m heights retained; full31/30.4m tower crowns, differently scoped36/34m dimensions and historic plaza grading remain explicitly uncertain. Steps adapt to coarse standard DEM; exact host contact remains unverified.

Master **18283 triangles /2197608 bytes**, runtime2197044 bytes. Browser bytes: skyline91628, district304836, street1073736, closeup1552272. Targeted byte reproduction, current source/import/LOD/input/report bindings, source/recipe inventory/schema, six Khronos validations, scene/30-tick simulation and actual shared-texture read-once/unload pass. Split POSITION/NORMAL streams, equal CPU/GPU totals. Real rays verify closed roofs/caps, both-axis air through bell/crown/lantern stages, proper door/glass/niche recess/backing and front landings. Central floral glazing has backing around the full ring.

Anchor **[-82.351849194,23.141353768]**, heading **-1.15681402154rad**, unchanged. Exact-QID way/23870813 matches current whole35184395959645. Ten whole, four narrow tower35184765394979, four wide tower35184765394978 and nineteen rear dome-roof35184765394980 vertices retain all37 current points/raw tags without rescale. Original13 distinct whole vertices/multilingual identity retained. Four controls agree with inspected front/dome arrangement; associations are positional/visual, not another exact-QID claim. Native+X south-southeast plaza/front,+Z narrow clock tower,-Z wider belfry,rear dome at-X.36m width/34m length statements have no reference URLs; current53.14x33.31m whole includes rear/side annex scope. Raw11m main and17m component heights remain intact:11m main eave/17m dome-cap interpretation; tower17m lower-stage control versus picture-led31/30.4m crowns explicitly uncertain. Facade21.6m/cross22.5m,nave15.5m,lantern22.5m and internal partitions are estimates.

Source/closeup use near arched wall stages; distant stages use individual corner posts while preserving unequal tower widths/clock/air. Four shared ashlar/continuous-limestone/tile/wood graphs serve six groups. Three neighboring buildings/front plaza preserved across six outputs. Retained neighbor35184763267430 boundary guides local UV-preserving subdivision that corrected conservative viewer stamps. No road replacement.

DEM datum11.732798m, raw perimeter-2.52..1.16m, estimated floor0.7m. Footings crossY=0 and extend below samples. Front steps adapt to coarse ground instead of tall vertical blocks, so they do not reproduce surveyed historic plaza grading. No flattening or host terrain change. Exact street/door/plaza joins, base clipping, absolute altitude and walking unverified. Fine figures/interlace/inscriptions,hidden annex roof/windows,full interiors/bells and engineering accuracy simplified or excluded. [Current QA and limitations](../places/dh/dhj/n0390_havana_cathedral/QA-REVIEW.md).

Ledger **400 ready /396 active previews /600 remaining**. Readiness accepts exterior/approximate horizontal placement. Next **N0391 — Liège Cathedral**, Q1573417. Next routine full source checkpoint **N0380–N0399**. GLBs/bulk captures remain ignored; no Git mutations or uploads.


## N0391 — Liège Cathedral

Reviewed2026-10-15 from actually inspected Juan Antonio Cordero2013 north exterior and Marc Ryckaert2023 cloister R08/R14 pictures,plus standard viewer PMTiles/DEM only. No bespoke plans/surveys or redistributed reference images. Individually authored Gothic nave/transept and polygonal choir,steep shared-slate roofs,recessed pointed glazing with cream geometric tracery,step buttresses/flying struts,pinnacles and blind transept panels. West paired-louver tower has corner turrets,clocks attached to its sloping spire and genuinely open upper lantern. Low cloister ranges,dormers and stair turret surround a genuinely open court. **49 current frames inspected,1230 actual geometry probes and30 viewer-footprint checks passed.** Four existing shared256-square graphs,six groups,metric UVs,linear tints,flat normals and zero embedded images. LODs **997 /3038 /10733 /20815 triangles**;initial geometry **280484 bytes**. Corrected floating upper cornices/detached clocks,window/buttress intersections,blocked cloister recesses and north-square footprint overreach. All38 current compound/court points and earlier exact identity/facts retained without rescale. No mapped height exists;vertical dimensions and exact host-ground joins remain explicit estimates.

Master **20815 triangles /2501432 bytes**,runtime2500868 bytes. Browser geometry:61744 /218740 /887768 /1806320 bytes. Four existing ashlar/continuous-limestone/slate/wood graphs. Targeted byte reproduction,current source/import/LOD/input/report bindings,source/recipe inventory/schema,six zero-error/warning/image Khronos validations,scene validation/30-tick simulation and actual texture read-once/unload pass. Split POSITION/NORMAL streams,equal CPU/GPU totals. Geometry rays verify all roof ranges,open court,lantern air,recess/backing and20 clock surface attachment positions. Thirty actual viewer-footprint checks cover the compound while retaining court core,north square,west pavement and selected south neighbor. UV-preserving local triangle subdivision corrects conservative stamps.

Anchor **[5.571799634,50.640129855]**,heading **0.293601642088rad**,unchanged. Retained exact relation/2295569,Q1573417 and multilingual identity match current compound52776560428817.32 current outer/6 court vertices,tags and earlier36 distinct outer/6 court vertices retained.37m width/110m length facts lack reference URLs and differ in scope from86.35x75.9m compound;no forced rescale. Native+X east-northeast choir,-X west tower,+Z south-southeast cloister. No height tag or height fact. All vertical dimensions and architectural partitions are picture-led:aisle14.5m,nave/transept23m eave/31m ridge,tower34m/shoulder36m,lantern48..51m,finial62m above0.65m floor. DEM70.393040m,raw perimeter-0.49..0.78m;footings crossY=0 and extend below samples. No flattening,host DEM change or road replacement. Exact pavement/door joins,base clipping,altitude and walking pending.

Skyline has simplified solid tower/cloister envelopes and an open lantern/court. District adds selected glazing,clock,turrets/buttresses;street adds more windows/louvers/dormers;closeup refines simple foils/transoms and gable panels. Fine curved tracery,sculpture,crockets,glass artwork/clock lettering,hidden bays,full interiors and engineering sections simplified or excluded. Surrounding city/vegetation/site furniture stays host content. Physical-device timing pending. [Current QA and limitations](../places/u1/u15/n0391_liege_cathedral/QA-REVIEW.md).

Ledger **401 ready /397 active previews /599 remaining**. Readiness accepts exterior/approximate horizontal placement. Next **N0392 — New Cathedral, Linz**,Q257481. Next routine full source checkpoint **N0380–N0399**. GLBs and bulk captures remain ignored;no Git mutations or uploads.


## Branch integrity audit — 2026-10-15

Before resumed production,checked all **564 authored structures /3384 master,runtime and LOD GLBs**,all820 logical source bundles,canonical paths/shared UV-material bindings and2256 LOD layouts. A clean34-generator/629-forced-import source build produced3512 generated GLBs in770s as **assets-4c110226cdb7e02d**. Every structure GLB reproduced byte for byte;no model or required source was missing. The five retained vehicle masters bring the full local inventory to3517.

Revalidated122 stale next-1000 source fingerprints only after proving unchanged master/runtime/LOD bytes,scenes,cameras,terrain,map controls,placements,shared graphs and all stored capture hashes. Original inspection dates/scopes remain intact. Ledger **401 ready /397 active previews /599 remaining**. Four other site reviews with absent disposable captures remain pending,and19 older site reviews retain their unfingerprinted historical scope. Existing medium-fi budget exceptions remain separate cleanup. Build metadata differences141 were retained;five unrelated generated Dungeon source GLBs changed and pre-build copies remain local. No structure bytes changed,no Git mutations/uploads.

