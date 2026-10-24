# Hohensalzburg Fortress — reviewed medium-fi exterior

Reviewed2026-10-12. **49 final images inspected.**

Inspected49 final images:11 portable,11 shared-loader/placement and27 medium-fi views. White high palace, eight shallow parallel roofs, green Krautturm lantern, chapel spire, open courts and stepped perimeter bastions retain the character observed in the actual courtyard and aerial pictures. PMTiles ground replaces the draft's unseated vertical datum. Palace/range footprints remain approximate inside the mapped precinct; details and individual roof/fire-wall shapes are simplified.

All11 shared-loader images inspected. Common lime plaster, limestone, slate and oxidized copper graphs provide reusable texture detail; glass uses local opaque PBR. Every graph loads once and model unload releases geometry. Skyline bakes actual shared linear means in one draw; detailed levels use five draws. No bitmap images are embedded in the six GLBs.

All27 final lighting/detail-level comparison images inspected. Skyline retains the eight roof ridges, white palace, green lantern, chapel and irregular terraced perimeter; district adds sparse windows and battlements; street and close-up add window surrounds, buttresses, dormers and cistern detail.855/3327/4743/5419 triangles meet the four budgets. Synthetic neighboring houses are diagnostic. Coarse PMTiles ground shows foundation contact and hides lower retaining walls; it does not resolve narrow passages.

## Placement and cost

Appearance checked against courtyard and aerial pictures; placement uses standard viewer Protomaps/Mapzen PMTiles. Anchor 13.04787405,47.7952134 and heading 0.255395266735 retain the signed east-northeast palace/chapel frame. Y0 is the PMTiles sample at the site anchor, 540.3154652179358m. Main court is reconstructed5m above this coarse working ground; foundations extend below the hillside. Gate height is adjusted to PMTiles at the west approach. Individual wings and terrace floors remain approximate.

skyline: 855 triangles, 87104 bytes, 1 draws; district: 3327 triangles, 284248 bytes, 5 draws; street: 4743 triangles, 397436 bytes, 5 draws; closeup: 5419 triangles, 446924 bytes, 5 draws. Initial skyline+district371352 bytes, below3MB phone and6MB laptop limits; separate POSITION/NORMAL streams.

## Checks and accepted limits

Changed master and all authored levels pass finite-attribute, normal/winding and Float32 degeneracy validation. Six GLBs have zero Khronos errors/warnings/images. Source/runtime hashes and shared graphs match current files; targeted browser cache and unload checks pass. Original hohensalzburg-fortress-model.mjs remains unchanged and available as the detailed source. No full repository rebuild, npm audit or bespoke terrain research was performed.

Accepted bounded medium-fi exterior using two inspected reference pictures and standard viewer PMTiles for fit. Source preserves the detailed original recipe. Reconstructed court and terrace floors, wing positions, windows, roof pitches and secondary towers are approximate. Foundation skirts extend below the standard coarse hillside, and west entrance height follows the working PMTiles sample. Coarse terrain can still intersect approaches; no surveyed thresholds, navigable paths, artificial mountain, interiors, distant ramparts or forest are claimed. Physical laptop/phone timing and continuous-motion shimmer remain pending.

## Pictures and map

- [Tourism courtyard picture](https://www.salzburg.info/deskline/infrastruktur/objekte/Festung%20Hohensalzburg_7955/1265539/image-thumb__1265539__slider-main/vogelperspektive-festung-hohensalzburg_38594547%402x.88c51d8f.jpg) and [whole aerial](https://wiki.sn.at/images/2/24/Hohensalzburg_Festung_Luftaufnahme.jpg), actual pixels inspected; images not redistributed.
- Standard viewer PMTiles: Protomaps20261008/Mapzen Terrarium, retained controls and hashes in pmtiles-fit.json. ©OpenStreetMap contributors/ODbL; elevation attribution retained with the fit data.
