# Pont de Normandie — reviewed medium-fi exterior

Reviewed2026-10-12. **52 final rendered views inspected.**

Inspected12 final portable views: full asymmetric crossing, inverted-Y pylons, paired stay fans, blue cornices, road margins/markings, cable/anchor hardware and26approach piers remain present. Standard PMTiles terrain/water preview has clean depth separation; the bounded water-contact bases reach below the working sea plane.

Inspected12 final shared/geographic views using the explicit bounded-placement fixture. Runtime index places the original crossing at the mapped main-span midpoint and signed southward+X heading. Independently transformed full bounds, north-up outline, local-only selection, shared texture reads and unload pass. Shared fixture is a flat-stage placement test, not proof of tidal heights or connected road joins.

Inspected all28 final browser views across lighting/quality, silhouette, near detail and four matched tiers after removing preview water depth fighting. Authored944-triangle skyline retains two pylons, representative fans and approach piers. Authored3392-triangle district retains184paired stays; street and closeup retain source shape through bounded reductions. Fine rails/hardware/markings simplify on lower tiers; full architecture and blue/cream identity remain.

## Placement and runtime

The inspected aerial picture supports pale inverted-Y pylons, stay fans, thin blue-edged roadway and approach piers. Retained mapped outline and current standard PMTiles Pont de Normandie bridge roads confirm the main-span midpoint, southward native+X, longer northern approach, width and full crossing length. Mapped main spacing860m is close to source856m and total2141m. A deliberately approximate-4.4m translation adapts the legacy CMH-authored height to a global sea-plane visualization; this is not a certified IGN69/EGM/tidal conversion. Bounded pylon/pier bases extend below the working water plane; mapped PMTiles water masks form the preview shoreline and raw surrounding terrain is retained. Approach road heights remain source reconstructions, with connected host road fitting requested.

skyline: 944 triangles, 81052 bytes, 1 draws; district: 3392 triangles, 331804 bytes, 4 draws; street: 14945 triangles, 1436688 bytes, 4 draws; closeup: 63049 triangles, 6598808 bytes, 4 draws. Initial skyline+district 412856 bytes, below3MB phone/6MB laptop limits. Separate POSITION/NORMAL streams; physical-device timings remain unmeasured.

## Checks and accepted limits

Six GLBs validate with zero errors/warnings/images. Browser944/3392/14945/63049triangles satisfy strict ceilings; initial download412856bytes. Reviewed shared source178724triangles adds336bounded base triangles to the original geometry and applies the explicit-4.4m shift. Original178388-triangle master reproduces13591668bytes and sha256:7393ab5b3d1dd8e832bc549b2f7af9fd3bd4aabf2f04330b7353b94dd7009a0e from its unchanged builder. Current selected source --check and separate GPU streams verified.

Accepted picture/standard PMTiles approximate crossing fit. Horizontal map and PMTiles bridge roads establish identity, dimensions, midpoint and signed heading. The-4.4m legacy-CMH/global-sea adaptation is deliberately approximate; no certified vertical/tidal conversion. Pylon/pier base blocks are bounded contact proxies. Host road replacement requests connected approach fitting, while exact endpoint joins, surrounding shore grade and tides remain unverified. Recessed mapped-water bed is preview-only; raw PMTiles are retained. Original inactive placement is preserved in placement-history.json. Toll/traffic/hidden foundations excluded; footprint replacement off and physical-device timings unmeasured.

## Pictures and map

- [Inspected picture 1](https://en.normandie-tourisme.fr/app/uploads/2022/04/pont-normandie-valentin-pacaut-the-explorers-1536x1024.jpg) — actual pixels inspected; image not redistributed.
- Standard viewer Protomaps20261008/Mapzen Terrarium PMTiles; controls/hashes retained in pmtiles-fit.json. ©OpenStreetMap contributors/ODbL, elevation attribution retained with the fit data.
