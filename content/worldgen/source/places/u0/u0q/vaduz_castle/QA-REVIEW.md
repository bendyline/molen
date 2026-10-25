# Vaduz Castle — reviewed medium-fi exterior

Reviewed2026-10-12. **49 final rendered views inspected.**

Inspected49 final views:11 portable,11 shared-material placement and27 medium-fi images. Square stone keep, pyramidal tiled roof, timber-covered southern roundel, open northern roundel, cream crossed-gable residence and red/white shutters retain the two aerial pictures' visible identity. Raised courtyard camera clears the revised floor; this is an exterior view and does not certify a walkable interior. Reconstructed roof overhangs and wing junctions remain simplified.

All11 final shared-loader views inspected. Common limestone, lime-plaster, wood and ceramic-tile graphs supply reusable masonry, timber and roof texture; local opaque PBR supplies glass. Shared graphs load once, and unload releases model geometry. Skyline bakes actual common linear means into one draw; detailed levels use five draws. Six GLBs contain no embedded bitmap textures.

All27 final lighting/LOD comparisons inspected. The768-triangle skyline retains covered/open roundel contrast, keep and major crossed roof masses;2625 district adds sparse windows, shutters and parapets;5501 street and6623 close-up add frames, dormers, coarse timber and cornerstone detail. All four tier budgets pass. Retained PMTiles ground tests the sloped site; synthetic neighbors and flat material-loader ground are diagnostic.

## Placement and runtime

Appearance checked against two aerial pictures; signed north-south orientation distinguishes covered south roundel from open north roundel. Standard viewer Protomaps/Mapzen PMTiles set location and hillside fit at anchor 9.52434566,47.139574837 and heading 1.549323723192. Y0 is the working terrain sample 563.3922911400916m; reconstructed court10m above it clears the coarse hillside and bounded foundations extend below sampled ground. Exterior walls and floors are approximate, not surveyed.

skyline: 768 triangles, 75804 bytes, 1 draws; district: 2625 triangles, 228568 bytes, 5 draws; street: 5501 triangles, 506232 bytes, 5 draws; closeup: 6623 triangles, 603532 bytes, 5 draws. Initial skyline+district304372 bytes, below3MB phone and6MB laptop limits. Runtime levels use separate POSITION/NORMAL streams.

## Checks and accepted limits

Selected source and all four authored tiers pass finite attribute, Float32 degeneracy and normal/winding validation. Six GLBs have zero Khronos errors/warnings/images. Current source/runtime hashes match validated files; shared-material cache and unload checks pass. Detailed original geometry remains preserved in vaduz-castle-model.mjs; only its courtyard capture camera was raised. The independent derivative adjusts datum and foundations. No full repository build or npm audit was run.

Accepted bounded medium-fi exterior reconstructed from two actually inspected aerial pictures and standard viewer PMTiles. Covered south/open north roundels sign the retained map axis; model outline follows the cached compound geometry. Court10m above working ground and bounded skirts provide approximate seating on the coarse hillside. Individual walls, roofs, openings, shutters and floor heights remain reconstructed. No surveyed threshold accuracy, complete cliff contact, navigable interiors, ground cutout, forest or artificial hill is claimed. Roof overhangs and wing junctions are simplified; physical-device timing and continuous-motion shimmer remain pending.

## Pictures and map

- [Keep and valley facade aerial](https://fs.tonkosti.ru/sized/c800x800/68/ko/68koi8u4khogosg80wk80kows.jpg) and [compound aerial](https://i.pinimg.com/originals/31/32/86/3132863ff392dfd15cd608598e8993ac.jpg), actual pixels inspected; photos not redistributed.
- Standard viewer Protomaps20261008/Mapzen Terrarium PMTiles, retained fit controls/hashes in pmtiles-fit.json. ©OpenStreetMap contributors/ODbL; elevation attribution retained with the fit data.
