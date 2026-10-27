# emley_moor_transmitting_station — Emley Moor review

Refreshed 2026-10-27 against current source/import/browser hashes. All **68 current frames** were freshly captured and inspected: 16 portable, 16 shared-material/geographic-flat-terrain and 36 medium-fi. The joined-path source/runtime/closeup meshes changed; skyline, district and street geometry remain byte-identical. Six current GLBs validate with zero errors/warnings, the detailed source reproduces, and all three focused geometry/LOD tests pass. Existing reference interpretation, approximate geographic registration and the limits below are retained.

## Source and compass frame

Named OSM communication-tower way476925020 supplies ring center[-1.664470242105263,53.61206580526316] inside exact-Q638586 site295843613; the tower way itself is not asserted to have that QID. mb21 March2014 text explicitly locates eight-tier crossed rack on north and two trough antennas west; inspected September2023 close-up corroborates configuration. Arup1972 Fig4 plan north arrow fixes four GPO platforms north. Heading0 maps native+X east,+Z south. Entrance approximately east is inferred from inspected2011 ground photo with north platforms at right;20degree uncertainty is explicit. Actual mapped17.6m ring is smaller than engineering24.38m base, so used for center only with no stretch/replacement. Host terrain supplies ground height.

[Arup1972 engineering journal](https://www.arup.com/globalassets/downloads/arup-journal/the-arup-journal-1972-issue-1.pdf) sets concrete dimensions and north-platform plan. [Dated2014 antenna survey](https://tx.mb21.co.uk/gallery/gallerypage.php?txid=336&pageid=1851) signs north/west arrays; [September2023 survey](https://tx.mb21.co.uk/gallery/gallerypage.php?txid=336&pageid=4370) and [April2011 ground photograph](https://admin.mb21.co.uk/tx/userimages/203proc20110428010748.jpg) were inspected. References remain research sources, not embedded textures.

## Actual visual review

Inspected all16 final portable views. Complete tapered concrete shaft,20-bay turret with inset tinted/boarded panes, galleries and mounting tracks, four north-facing GPO platforms with actual recessed doors, lower dish gallery, eight-tier north crossed rack, west trough panels, two-stage modern radome/collar ladder and tip rails, and approximately east-facing entrance cage are visible. The historical master remains independently reproducible; the current detailed master has **271,260 triangles / 21,815,884 bytes**.

Inspected all16 final shared-material views including north-up placement and north platform/east entrance cameras. Three canonical256px graphs supply concrete_plain,metal_painted and metal_copper. Turret tinted panes remain local opaque PBR; no photograph or embedded bitmap. Each shared graph is read once and unload disposes all model geometries. Source ground and geographic-flat-terrain are inspection surfaces, not measured site terrain.

Inspected all36 final browser frames: noon/late light under economy/high presets, synthetic cottage scale context, named detail views, district north platforms, street east entrance, all four whole-tower levels, district/street upper antenna arrays and four transitions. Full319m silhouette,20-bay cabin,4north platforms and two-stage antenna persist. District reduces rack/dish/rail detail; skyline uses shared graph mean colors and local far panes. Default neighborhood/far camera crops this very tall tower; explicit whole-level cameras independently show every top and base. No missing geometry inferred from that intentional crop.

## Browser/source structure

Four independent browser models contain **866 / 3,978 / 15,880 / 51,104 triangles**, each within its 1,000 / 4,000 / 16,000 / 64,000 cap and eight-draw limit. Skyline+district total **369,020 bytes**, under the 3 MB phone / 6 MB laptop initial budgets. The **3,744,784-byte closeup** and detailed 21.82 MB master load separately. Shared texture graphs are reused and the far level uses their baked mean colors. Physical laptop/phone frame-time and transfer benchmarks remain separate work.

Six current Khronos validations pass with zero errors/warnings and no embedded images. Three focused tests pass: every browser level has full319m envelope, all four north platform decks and20turret bays; exact historical-source bytes and signed placement control with un-stretched engineering width; exact deterministic browser regeneration, strict triangle/draw/download caps, all three shared graph bindings and separate12-byte position streams. Test deck ray intentionally avoids the dish mounted above the second platform.

## Accepted reconstruction limits

Medium-fi exterior combines Arup engineering concrete274.32m/base24.38m/top6.4m/20radial-bay facts with inspected2011 ground and2023 upper-array photos. Four north platforms replace archival east-platform phase. Modern319m is the photo-proportioned modeled envelope, not a reported measured height; Arqiva2023 retains historical330.4m. Exact service-door phases, entrance bearing, minor equipment allocations, segment heights and cabin external radius are reconstructed. Detached site buildings, fences/ducts, hidden internal equipment and operating radio functions excluded. Original dense source remains unchanged through emleyMoor.build.

Current pixel/GLB/input/placement/material/recipe hashes and inspected frame paths are bound in qa.json. Synthetic cottages and flat ground are review context; no terrain survey or current radio-installation certification is claimed.
