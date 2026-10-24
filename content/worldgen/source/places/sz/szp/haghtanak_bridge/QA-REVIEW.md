# Haghtanak (Victory) Bridge — reviewed medium-fi exterior

Reviewed2026-10-12. **55 final rendered views inspected.**

Inspected all13 final source views: PMTiles approach/gorge overview, four isolated turntables, all three main arches, six spandrel openings per span, transverse vaults and piers, soffit, intersecting-circle lattice impression, globe lamps, four approach passages and six-lane deck. The two reference pictures support the basalt arch forms and decorative railing. Coarse outside terrain obscures some lower gorge in low portable views; isolated/shared views expose the complete geometry.

Inspected all13 final shared-viewer views including the retained mapped bridge outline overlay. Four canonical basalt, granite, concrete and painted-metal graphs reuse their library resources; no embedded images. Bounded selection, complete transformed geometry, separate approach-terrain reference, restored ground opening, graph cache and unload checks passed. Fixed a QA-only probe that previously tested unrotated native coordinates after bounded placement baked the transform; rendering code is unchanged.

Inspected all29 final medium-fi lighting/LOD views. Skyline preserves three main arches and deck; district adds open spandrels and simplified lamps, street restores transverse vaults and approach openings, closeup shows the denser circle-lattice railing, lamps and markings. The bounded reconstructed gorge fixture leaves surrounding PMTiles heights outside the corridor; real lower canyon terrain remains approximate.

## Placement and runtime

Inspected pictures confirm three main basalt arches, open spandrels, lattice iron railings and globe lamps. The retained mapped190×30m bridge outline and current standard viewer PMTiles named Victory Bridge roads establish the centre and southeast-facing native+X. Approximate nativebase929.3304m uses the western approach PMTiles sample963.3304m at road modelY34; the opposite approach differs1.4m. Coarse central terrain is about22m above that inferred base and does not resolve the lower gorge. A bounded ground opening below the interior bridge preserves visible vaults while the original PMTiles surroundings remain; this is an approximate visualization, not a surveyed canyon or road endpoint certification. The preview grades only a bounded under-bridge corridor to the inferred gorge base; raw terrain-review and pmtiles-fit samples remain preserved and this is not source bathymetry.

skyline: 696 triangles, 56328 bytes, 1 draws; district: 2784 triangles, 219952 bytes, 6 draws; street: 15216 triangles, 1227992 bytes, 6 draws; closeup: 52248 triangles, 6273020 bytes, 6 draws. Initial skyline+district 276280 bytes, below3MB phone/6MB laptop limits. Separate POSITION/NORMAL streams; physical-device timings remain unmeasured.

## Checks and accepted limits

Six GLBs validate with zero errors, zero warnings and zero embedded images. Original3448236-triangle,324374144-byte detailed master reproduced exactly at sha256:109c6fda8bcd1c3b88dfae06c79c4efb4832695beb39c4576507601c8d08b820 before authoring the independent52248-triangle medium-fi source. Original recipe/map inputs remain unchanged. Browser levels696/2784/15216/52248 satisfy1k/4k/16k/64k; initial skyline+district276280bytes. Source/runtime/LOD hashes, shared surfaces and placement bindings are current.

Accepted medium-fi exterior and approximate picture/PMTiles placement. Shared textures replace modeled masonry courses; circle-lattice impression omits exact four-petal castings, perforated borders and source fittings. District merges transverse vaults and approach blocks; closer models retain the openings. Western approach sample gives approximatebase929.3304m at roadmodelY34; eastern approach differs1.4m. Bounded gorge opening is a visualization approximation, not a surveyed canyon, river or exact host road join. Footprint replacement off; physical laptop/phone performance remains unmeasured.

## Pictures and map

- [Inspected picture 1](https://upload.wikimedia.org/wikipedia/commons/e/e8/Haghtanak_bridge_01.jpg) — actual pixels inspected; image not redistributed.
- [Inspected picture 2](https://upload.wikimedia.org/wikipedia/commons/3/30/Haghtanak_bridge_04.jpg) — actual pixels inspected; image not redistributed.
- Standard viewer Protomaps20261008/Mapzen Terrarium PMTiles; controls/hashes retained in pmtiles-fit.json. ©OpenStreetMap contributors/ODbL, elevation attribution retained with the fit data.
