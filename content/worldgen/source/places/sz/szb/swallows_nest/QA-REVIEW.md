# Swallow's Nest — reviewed medium-fi exterior

Reviewed2026-10-12. **49 final rendered views inspected.**

All49 final views inspected:11 portable,11 shared-material/map-placement and27 medium-fi comparisons. Stepped limestone hall, eastern round tower, four crown spires, four lower pinnacles, projecting balcony and perimeter terrace retain the two inspected aerial pictures' character. The overextended smooth concrete support was replaced by a faceted weathered-rock apron beneath the immediate terrace. It is a bounded approximation connecting the building to coarse PMTiles ground, not a reconstruction of the whole cliff.

All11 final shared-loader images inspected. Common limestone, weathered limestone, painted metal and wood graphs supply reusable stone, rock, railing and door detail; glass uses local opaque PBR. Each graph loads once; unload releases geometry. Skyline bakes actual shared linear means in one draw; other levels use five draws. Six GLBs contain zero embedded bitmap textures.

All27 final lighting/LOD images inspected.720-triangle skyline retains the stepped hall, tower, balcony mass, four crown spires and bounded rock support.2911 district adds openings and broad parapets;8835 street and9435 close-up add arches, corbels, railings, flags and coarse carved bands. Matched tiers and transitions pass the four triangle ceilings. PMTiles supplies approximate terrain fit; Italian neighbors and flat shared-loader ground are diagnostic.

## Placement and runtime

Two inspected aerial pictures show the stepped limestone hall, eastern round tower, balcony and four crown spires. Cached exact building outline and standard viewer PMTiles set orientation/location. Reconstructed terrace6.4m above the working anchor sample clears the coarse hillside; bounded foundations seat it against the sampled ground. Exact cliff edge and balcony clearances remain approximate. Anchor 34.128585443,44.430632946; heading 0.347692146382; standard PMTiles datum 21.217927594329787m. Floors are reconstructed and foundations extend below the coarse sampled ground. The former smooth support is replaced by a faceted weathered-limestone apron beneath the immediate terrace. Rock apron dimensions are approximate.

skyline: 720 triangles, 74608 bytes, 1 draws; district: 2911 triangles, 263812 bytes, 5 draws; street: 8835 triangles, 752028 bytes, 5 draws; closeup: 9435 triangles, 803792 bytes, 5 draws. Initial skyline+district 338420 bytes, below3MB phone/6MB laptop limits. Separate POSITION/NORMAL streams; physical-device timings remain unmeasured.

## Checks and accepted limits

Changed master and all four authored tiers pass finite attribute, Float32 degeneracy and normal/winding checks. Six GLBs have zero Khronos errors/warnings/images and current source/runtime hashes. Shared cache/unload checks pass. Detailed original architectural geometry remains unchanged in swallows-nest-model.mjs. Optional per-model camera overrides keep the reviewed view above the adjusted floor without altering original geometry or duplicating cameras; unchanged Conwy source passes generator --check. No full repository rebuild or dependency audit was run.

Accepted bounded medium-fi exterior from two actual aerial pictures and standard viewer PMTiles. Signed eastern tower and cached exact building outline set the retained axis. Terrace6.4m above the coarse working sample and a faceted immediate rock apron provide approximate seating; dimensions, opening rhythm, flag shape, carved bands, balusters and rock shape remain reconstructed. The extended smooth support was rejected during review. The sheer cliff, long approach, sea surface, exact balcony clearance, vegetation and navigable interiors are outside this model's scope. No survey accuracy or ground cutout is claimed. Physical-device timings and continuous-motion shimmer remain pending.

## Pictures and map

- [Inspected picture 1](https://has-cdn.aa.com.tr/Arsiv/Fotograf/Thumb/2022/02/18/52224685/20220218_2_52224685_73801292_Thumb.jpg) — actual pixels inspected; image not redistributed.
- [Inspected picture 2](https://www.dronestagr.am/wp-content/uploads/2017/03/DJI_0229_1600.jpg) — actual pixels inspected; image not redistributed.
- Standard viewer Protomaps20261008/Mapzen Terrarium PMTiles; controls/hashes retained in pmtiles-fit.json. ©OpenStreetMap contributors/ODbL, elevation attribution retained with the fit data.
