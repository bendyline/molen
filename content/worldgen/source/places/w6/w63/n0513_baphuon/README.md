# Baphuon

![Molen preview](preview.png)

Baphuon present-day medium-fi exterior: three steep sandstone terraces, cardinal stair flights, open roofless galleries, surviving pointed entrance crowns, open upper sanctuary platform, west-wall reclining Buddha relief, four outlying cruciform pavilions, eastern gopura and the long raised cross-shaped eastern causeway on stone supports. No intact lost central tower, detailed bas-relief inventory or neighboring royal palace is reconstructed.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:20191210_Baphuon_Temple_exterior-6.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:20191210_Baphuon_Temple_reclining_Buddha-4.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:20191210_Baphuon_Temple_walkway-1.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Baphuon_(6201946101).jpg)

Two registered recipes build the specific surviving temple mountain, reclining Buddha and raised approach with shared 256² material graphs, metric UVs and linear tints. No embedded images or unique atlas.

## Model and axes

18,148 triangles; 54,444 vertices; 3 material groups; 2,180,268 bytes. Native bounds: -54.081, -13.630, -47.907 to 307.468, 33.684, 41.054. Source hash: `sha256:e7bab795971b39b0557f1313c2a14f085240caa34ee65ed26e9ddacd935d6358`.

{"x":"east","y":"up","z":"south"}

The geographic proposal uses exact-QID OpenStreetMap evidence. Map-derived orientation and estimated architectural details require real-site visual review; preview eligibility is distinct from geographic/fidelity approval. Map attribution: © OpenStreetMap contributors, ODbL-1.0.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0513` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Baphuon present-day medium-fi exterior: three steep sandstone terraces, cardinal stair flights, open roofless galleries, surviving pointed entrance crowns, open upper sanctuary platform, west-wall reclining Buddha relief, four outlying cruciform pavilions, eastern gopura and the long raised cross-shaped eastern causeway on stone supports. No intact lost central tower, detailed bas-relief inventory or neighboring royal palace is reconstructed.
- Q790118/way240141751 identifies the main temple. Nine pinned standard PMTiles records fix the main mound, upper sanctuary and entrance part, four cruciform outer pavilions, eastern gopura and long cross-shaped causeway. Raw +X east and +Z south at heading0 retain its slight mapped axis rotation; the east entrance/causeway resolves the facing direction. Bayon to the southeast, Phimeanakas to the north and the Terrace of the Elephants east/northeast remain independent.
- Ordinary 2019 exterior pictures guide the three steep terraces, open galleries, steep stairs, surviving gopura crowns and missing upper sanctuary. About27m to the open summit terrace and34m at its surviving entrance crown; lower terrace rise7.5m and middle rise9m are visualization estimates, not surveyed levels. The causeway follows its mapped footprint with three rows of stone supports, about1.6m above the coarse native ground. Secondary pavilion roofs and damage are broad picture-led estimates.
- Reused unmodified nearby N0497 Bayon standard PMTiles/Mapzen extract. Main terrace foundations and outer pavilions extend into the native terrain; the causeway deck is segmented along the coarse native ground with supports seated at each segment. This intentionally accommodates the noisy standard DEM rather than claiming surveyed level causeway elevations. Ground and mapped water remain native; no ground or water cutout.
- Mapped components retain their plan positions. Terrace heights, lost roof edges, Buddha relief anatomy and support inventories are visualization estimates. The missing central sanctuary tower is not reconstructed. No navigable interior is claimed.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain.
