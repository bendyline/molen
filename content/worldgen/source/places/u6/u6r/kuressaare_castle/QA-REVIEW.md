# Kuressaare Castle — reviewed medium-fi exterior

Reviewed2026-10-12. **49 final rendered views inspected.**

All49 final views inspected:11 portable,11 shared-material/map placement and27 medium-fi comparisons. Square stone convent, narrow open court, inward-sloping red roof fields, massive Sturvolt, slender Tall Hermann, crenellated perimeter gallery and timber gate oriel retain the two inspected aerial pictures' main identity. Tower/gate arrangement agrees with the signed mapped building frame. Windows, roof junctions, stone color and individual carved details remain simplified.

All11 current shared-loader views inspected. Common limestone, ceramic tile, wood and painted-metal graphs provide reusable stone, red roof and oriel detail; glass uses local opaque PBR. Every graph loads once; unload releases geometry. Skyline bakes actual common linear means in one draw; detailed levels use five. Six GLBs contain zero embedded bitmap textures.

All27 current lighting/LOD views inspected.617-triangle skyline preserves the square body, open courtyard, two contrasting towers, red roof fields and coarse battlements.1703 district adds sparse windows and timber gate projection;8155 street and8215 close-up add mullions, corbels, stone surrounds, chimneys and courtyard detail. All four triangle budgets pass. PMTiles ground provides site fit; surrounding English terraces are synthetic diagnostic context.

## Placement and runtime

Two inspected aerial pictures confirm the square stone convent, open court, inward-sloping red roofs, massive Sturvolt and slender Tall Hermann. Standard viewer PMTiles and cached building outline set location and signed tower/gate orientation. The flat site varies by less than1m at sampled corners; a reconstructed0.6m working rise and bounded foundation skirts clear that coarse surface. Anchor 22.479324007,58.246897902; heading -0.563076620916; standard PMTiles datum 9.787413303227948m. Floors are reconstructed and foundations extend below the coarse sampled ground.

skyline: 617 triangles, 63604 bytes, 1 draws; district: 1703 triangles, 154296 bytes, 5 draws; street: 8155 triangles, 722524 bytes, 5 draws; closeup: 8215 triangles, 727060 bytes, 5 draws. Initial skyline+district 217900 bytes, below3MB phone/6MB laptop limits. Separate POSITION/NORMAL streams; physical-device timings remain unmeasured.

## Checks and accepted limits

Selected source and all four authored tiers pass finite-attribute, Float32 degeneracy and normal/winding checks. Six GLBs pass Khronos validation with zero errors/warnings/images; source/runtime hashes match current bytes. Shared-material cache and unload checks pass. Original architectural geometry and recipe are preserved, with a separate small datum/foundation derivative. No full repository rebuild, dependency audit or bespoke survey research was run.

Accepted bounded medium-fi main-convent exterior from two actually inspected aerial pictures and standard viewer PMTiles. Sampled site corners vary by less than1m relative to the working datum;0.6m reconstructed rise and bounded foundations seat the body without a large pedestal. Northern Sturvolt, eastern Tall Hermann and northeast gate retain the map orientation. Individual openings, coping, roof junctions, floor levels, stone texture and gate details remain approximate. Surrounding star fort, moat, bridges, vegetation and navigable interiors are outside this model's scope. No survey accuracy, artificial hill or ground cutout is claimed. Physical-device timings and continuous-motion shimmer remain pending.

## Pictures and map

- [Inspected picture 1](https://www.nomadicmun.com/wp-content/uploads/2019/10/Kuressaare-castle.jpg) — actual pixels inspected; image not redistributed.
- [Inspected picture 2](https://www.herder-institut.de/sites/default/files/2025-11/Event_Lesung_Mood_Burgen-Livland_2024-10-22.jpg) — actual pixels inspected; image not redistributed.
- Standard viewer Protomaps20261008/Mapzen Terrarium PMTiles; controls/hashes retained in pmtiles-fit.json. ©OpenStreetMap contributors/ODbL, elevation attribution retained with the fit data.
