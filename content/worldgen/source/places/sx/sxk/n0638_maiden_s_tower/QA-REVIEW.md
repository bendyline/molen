# N0638 — Maiden’s Tower review

Reviewed2026-10-09 against current source/import/browser hashes.

## Source and placement

Actual OSM shaft398210643 sets the mean-corner center[29.004089875,41.021059] and6.4m square. The shaft part has no QID; it lies inside exact-Q848397 island103821246. Actual historic fort103821245, east court398210642 and west pavilion/wall398303919 fix the ensemble plan. Heading1.721295251 sends native+X north-northwest and+Z east-northeast; the pavilion falls west and the Fatih doorway east, consistent with Ministry restoration text. The dated2026-07-28 OSM snapshot contains older roof tags, used as plan controls rather than recreated roofs. Terrain contact uses host island elevation; no water offset or footprint replacement.

Primary references: [operator restoration diary](https://kizkulesi.gov.tr/en/restoration-diary), [restoration scope](https://kizkulesi.gov.tr/en/restoration-scope), [Ministry opening report](https://basin.ktb.gov.tr/TR-342457/bakan-ersoy-kiz-kulesi-bu-aksam-210039den-itibaren-isik-ve-lazer-sovuyla-aciliyor.html). Official illustrations are research references, not model textures or measured surveys.

## Actual image review

Inspected all11 final portable views: whole ensemble from four sides, upper octagonal room and dome, courtyard, pavilion side, full mast and the new east Fatih doorway and timber wall walks. The restored court stays open; its recessed arched door and upper north entry stair remain visible. Courtyard walks have continuous decks and rails. The new timber stair is partly occluded by the perimeter wall in the whole-court camera; the focused geometry test checks its top tread joins the4.1m deck. The west pavilion facade is partly screened by its historic outer wall; it is not interpreted as missing geometry.

Inspected all11 final shared-material views including north-up actual shaft/fort/island controls. Six canonical256px graphs supply ashlar, lime plaster, ceramic tile, painted metal, timber and granite; every graph is read once and unload leaves zero live model geometries. No embedded images or copied reference textures. The open courtyard, doorway curvature and inset pane remain readable. Flat terrain is a placement inspection surface; host island terrain and water are separate.

Inspected all26 final medium-fi frames: noon and late light, economy/high quality, synthetic cottage context, six source detail cameras, separate district ensemble/street courtyard/east-door views and all four transitions. Every level retains the complete square tower, octagonal room, curved cap, mast, crenellated court and west pavilion. District simplifies railing cross ornaments, window trim and roof seams while retaining recessed openings and timber walks. Skyline averages materials and simplifies cap profiles; distant detail is intentionally reduced. Near surfaces remain consistent under reflected sky lighting, with no missing primary mass or transition loss.

## Source and browser budgets

The reviewed detailed source is1450636bytes and18588triangles; import1450004bytes. Four complete browser levels contain908/3856/11396/18588triangles within1000/4000/16000/64000caps and8draws. Skyline+district total377480bytes; close-up1319212bytes is fetched separately. Shared materials have no embedded image duplication. Initial transfer meets3MB phone/6MB laptop budgets; physical-device timing remains separate work.

Six current Khronos GLB validations report zero errors, zero warnings and no embedded images. Three focused tests pass: exact original master hash and real mapped identity/signed placement; complete mast and pavilion at every level with recessed east door and top timber tread connected to deck; byte-deterministic four-level regeneration, strict triangle/draw/download caps, six shared graphs and separate12-byte position streams. All regeneration finished before final capture, so reports bind the stable final files.

## Accepted reconstruction limits

Primary operator restoration diary/scope and the Ministry May11,2023 opening report establish the one-storey western pavilion, removed1990s steel courtyard roof/mezzanine, reconstructed timber upper room/cone, wooden courtyard walks and reopened east Fatih-era door. Official homepage exterior/courtyard images were inspected; the courtyard image is an architectural illustration, not a survey photograph. The original buildMaiden master reproduces its exact historical hash; a separate reviewed source corrects fort/pavilion placement and adds arches, walks and twelve connected timber treads. The32.5m mast envelope, arch/window heights, coping and railing motifs are proportional reconstructions. Exact masonry, curved gate profile, full visitor/internal navigation, flag cloth, laser show and underground reinforcement are outside this static medium-fi exterior scope.

Current GLB, pixel, recipe, material, map and placement hashes are bound in qa.json. Synthetic cottages and flat ground are review context.
