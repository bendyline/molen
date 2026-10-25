# Dragon Bridge, Da Nang — reviewed medium-fi exterior

Reviewed2026-10-12. **70 final rendered views inspected.**

Inspected all18 final source views: river overview, four turntables, both elevations, arch/connector, dorsal plates, head from three sides, tail, lower arch, deck wings, walk/lights and eastern approaches. The yellow arches, layered head and fan tail are complete and recognizable against the inspected elevated picture. Small plate contours remain a stylized reconstruction.

Inspected all18 shared-viewer views, including north-up mapped placement. Four canonical painted metal, stainless metal, concrete and fired-clay graphs reuse the library without embedded images. Bounded selection, full geometry, west terrain reference, road replacement, graph cache and unload passed. Flat geographic staging is distinct from the PMTiles river fixture in the source/browser views.

Inspected all34 browser lighting and detail-level views. Skyline and district use merged tube/head silhouettes; street and closeup restore the five-tube bundles, folded cheek plates, horns and fan tail. The full deck remains continuous. Fewer rails, hangers, connectors and simple lights maintain readable detail without the dense hardware inventory.

## Placement and runtime

Inspected one elevated daytime picture: three yellow tube arches, folded scales, layered east-facing head, broad road deck and side promenades. Standard viewer PMTiles confirms the east/west crossing across Han River. Retain666m authored extent and the existing provisional38.3m westward origin correction; the coarse760.74m map polygon includes extra approaches and is not used to stretch the bridge. West/east PMTiles approaches4.0784/7.8028m give approximatebase-3.1216m and browser deck endpoints7.2/10.9244m; a5m rise between them is reconstructed. River surface0m and submerged pier bases are approximate. Exact tide, engineering vertical curve, terminal joins and head plate outlines remain unverified.

skyline: 480 triangles, 52624 bytes, 1 draws; district: 3900 triangles, 372696 bytes, 5 draws; street: 15836 triangles, 1514736 bytes, 7 draws; closeup: 54172 triangles, 5354568 bytes, 7 draws. Initial skyline+district 425320 bytes, below3MB phone/6MB laptop limits. Separate POSITION/NORMAL streams; physical-device timings remain unmeasured.

## Checks and accepted limits

Six GLBs validate with zero errors, zero warnings and zero embedded images. Original817800-triangle,64532088-byte detailed master reproduced exactly at sha256:4525f7bb77f20b95ef1eda5abfaf0ea482e00c94eb939754574ddd2e00c7a92e. Its original recipe and map-frame snapshot remain preserved. Separate compact source54172triangles; browser480/3900/15836/54172meet1k/4k/16k/64k. Initial425320bytes; current source/runtime hashes and graph bindings verified.

Accepted medium-fi picture/PMTiles fit. Retain666m length and prior38.3m westward support-origin correction; do not stretch to the760.74m coarse map polygon. PMTiles approach heights fit browser endpoints with a reconstructed5m deck rise and approximatebase-3.1216m. Approximate river0m is not a tidal survey; exact terminal joins, current water level and engineering profile remain uncertain. Decorative plate contours, bolts, triple rods, rail infill and lamp curls are simplified. Footprint replacement off; physical-device timing remains pending.

## Pictures and map

- [Inspected picture 1](https://statics.vinpearl.com/dragon-bridge-2_1664459711.jpeg) — actual pixels inspected; image not redistributed.
- Standard viewer Protomaps20261008/Mapzen Terrarium PMTiles; controls/hashes retained in pmtiles-fit.json. ©OpenStreetMap contributors/ODbL, elevation attribution retained with the fit data.
