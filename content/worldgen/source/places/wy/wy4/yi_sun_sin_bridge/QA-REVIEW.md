# Yi Sun-sin Bridge — reviewed medium-fi exterior

Reviewed2026-10-12. **70 final rendered views inspected.**

Inspected all18 final source views: bay overview, four turntables, elevation, tower/foot/head, twin box soffits, wind slot, cable band/socket, road barriers, end pier, both anchorages and lamp. The H towers, suspension arrangement and twin roads match the inspected VisitKorea picture. The complete crossing and open central slot remain visible; fine inspection hardware is simplified.

Inspected all18 shared-viewer images, including north-up mapped placement. Three canonical concrete, stainless and painted-metal graphs reuse the shared library without embedded images. Bounded selection, full geometry, retained sea-level placement, road replacement, graph cache and unload passed. Geographic flat staging is separate from the PMTiles bay fixture.

Inspected all34 final browser light/LOD images. Skyline retains the whole silhouette with merged deck/end supports and two-sided suspension ribbons. District restores the twin decks and wind slot; street and closeup add cylindrical cables, with paired hangers, bands and sockets at close range. Tower feet and both unequal anchorages remain intact. Distant large-water-plane aliasing in a few far views is a recorded preview limitation.

## Placement and runtime

One inspected VisitKorea picture confirms the tall inclined H towers, suspension line, narrow twin roadway and shoreline context. Standard viewer PMTiles paired bridge roads and bay agree with the retained near-north/south foundation-centred frame. Retain2260m suspended deck,1545m central span and2545m cable anchorage spacing; longer3794.742m map approach extent is separate. Source sea-level0m agrees with coarse mapped bay samples. Deck height/vertical curve, foundation pads, tides and terminal joins remain approximate; adjoining mainland/Myodo approach roads are supplied by the viewer and are outside this model.

skyline: 920 triangles, 90296 bytes, 1 draws; district: 3200 triangles, 256320 bytes, 4 draws; street: 13668 triangles, 1253904 bytes, 5 draws; closeup: 51996 triangles, 4615132 bytes, 5 draws. Initial skyline+district 346616 bytes, below3MB phone/6MB laptop limits. Separate POSITION/NORMAL streams; physical-device timings remain unmeasured.

## Checks and accepted limits

Six GLBs validate with zero errors, zero warnings and zero embedded images. Original1331812-triangle,99412424-byte master reproduced exactly at sha256:b09eae200f884d6443d31bdb85514245a2a161e590ab5a4405749bcf1e4579b9. Detailed recipe and geometric map controls are preserved. Independent compact source51996triangles; browser920/3200/13668/51996meet1k/4k/16k/64k. Initial346616bytes. Current hashes and graph bindings verified.

Accepted medium-fi exterior and approximate picture/PMTiles fit. Retain2260m deck,1545m main span and2545m anchorage spacing, distinct from the longer mapped approach. Retained sea-level0m agrees with coarse bay samples; tides, vertical curve, exact foundation pads and end joins remain unverified. Approach viaducts are separate viewer roads. Formwork joints, saddle shrouds, foundation rails, inspection fixtures and bolts are simplified; low-tier ribbons and stepped foundation invert are deliberate approximations. Physical-device timing remains pending.

## Pictures and map

- [Inspected picture 1](https://tong.visitkorea.or.kr/cms/resource/22/2796022_image2_1.jpg) — actual pixels inspected; image not redistributed.
- Standard viewer Protomaps20261008/Mapzen Terrarium PMTiles; controls/hashes retained in pmtiles-fit.json. ©OpenStreetMap contributors/ODbL, elevation attribution retained with the fit data.
