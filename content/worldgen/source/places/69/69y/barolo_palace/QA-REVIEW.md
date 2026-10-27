# Palacio Barolo — reviewed medium-fi exterior

Reviewed 2026-10-27. **73 current rendered views inspected.**

Inspected all19 final source views. Bow-window/balcony body, green mansards, pointed tower arch, layered cornices and glazed lantern/searchlight remain complete. Both H-plan courts and7.5x13.5m through passage stay open. Rear elevation and decorative relief remain reconstructions.

Inspected all19 final shared-viewer views including north-up placement. The31m authored frontage remains narrower than the contradictory60m mapped ring; this mismatch is visible and accepted for approximate named-place/street placement without footprint suppression. Three common concrete/marble/painted-metal graphs plus opaque windows/translucent lantern use no embedded images. Shared graph cache and unloading pass.

Inspected all 35 current lighting, detail and transition frames. Whole-building views contain base/lantern in all tiers. Skyline retains H-plan/open passage; district restores broad facade and mansard rhythm; street/closeup retain polygonal windows, balconies, cornices and lantern. Two redundant closeup camera entries were removed; the passage and courtyard views remain in the source camera list. Synthetic neighbors and local PMTiles contacts are approximate.

## Placement and runtime

Owner-directed picture/standard viewer PMTiles approximate fit. PMTiles named Palacio Barolo point[-58.38572770357132,-34.60966313520602] agrees within about0.5m with retained anchor[-58.38572525,-34.60965975]. Retain heading0.086139560133: native-Z faces Avenida de Mayo to the north, native+Z Hipólito Yrigoyen to the south. Existing100m tower,30.88x44.21m H-plan and7.5x13.5m through passage remain. Inspected aerial front picture supports tower, green mansards, bow windows and crowned lantern. The underlying60m mapped envelope contradicts the source width; accept approximate center/street fit, do not stretch source or suppress neighboring map buildings. Exact parcel sides, party walls, tower-to-parcel offset, doorway thresholds and elevations remain uncertain. Approximate PMTiles[-70,0] ground and bounded preview correction are separate from raw elevations.

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| Skyline | 550 | 42,140 | 1 |
| District | 3,820 | 293,784 | 5 |
| Street | 14,748 | 1,037,012 | 5 |
| Closeup | 59,140 | 4,711,400 | 5 |

Initial skyline plus district is 335,924 bytes, below the 3 MB phone / 6 MB laptop limits. POSITION and NORMAL use separate GPU streams; physical-device timings remain unmeasured.

## Checks and accepted limits

Six current GLBs validate with zero errors, warnings and embedded images. The current compact source reproduces at sha256:a4186fde8a136189b80ac258b7e1b9f1f72ccf17dc60788531f695e7a3ac3548 with 59,140 triangles / 5,614,140 bytes. Three existing geometry/reconstruction tests and actual 1k/4k/16k/64k LOD caps pass. Current source/runtime/LOD/map bindings are checked.

This is a fresh review of the current joined-path geometry. Historical recipe snapshots did not reconstruct the older input hash, so the earlier dense-source byte-preservation record is not asserted as a new result. The 38 freshly captured portable/shared images retain their inspection across the exact duplicate-camera cleanup: their pixels, six GLBs, source cameras, materials, scene and placement are unchanged. All 35 medium-fi frames were captured after cleanup; the compatibility proof is recorded in qa.json and the capture reports.

Accepted owner-directed medium-fi picture/PMTiles approximation. Current inspected aerial front picture supports tower and green mansard/bow-window vocabulary; prior source-local reference review supplies other detail. PMTiles named Palacio Barolo point agrees with retained center within about0.5m; front faces Avenida de Mayo north, rear Hipólito Yrigoyen south. Exact parcel sides and tower-to-parcel offsets remain uncertain because mapped60m envelope conflicts with30.88m source width. Source is not stretched and neighboring map buildings are not suppressed. PMTiles[-70,0]43.1881m contact approximate; raw heights preserved separately. Physical-device timing pending.

## Pictures and map

- [Inspected picture 1](https://elojodelarte.com/media/k2/galleries/665/000.jpg) — actual pixels inspected; image not redistributed.
- Standard viewer Protomaps20261008/Mapzen Terrarium PMTiles; controls/hashes retained in pmtiles-fit.json. ©OpenStreetMap contributors/ODbL, elevation attribution retained with the fit data.
