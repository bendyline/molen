# Temple of Baalshamin

![Molen preview](preview.png)

Dated 2010 surviving Temple of Baalshamin: roofless rectangular ashlar cella, six free-standing Corinthian porch shafts with projecting brackets, open side windows with pedimented surrounds and attached pilasters, tall gated doorway, continuous surviving upper stone beams/cornice, low stepped podium and a small selection of fallen stone/drum fragments. This is the photographed pre-destruction ruin, not a reconstruction of its complete ancient roof or today’s damaged remains.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Temple_of_Baal-Shamin_in_Palmyra_2010.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Palmyra_-_Temple_of_Baal-Shamin_from_north.jpg)

Two registered recipes build the specific roofless cella, six-column bracketed porch, open windows and surviving beams with shared 256² material graphs, metric UVs and linear tints. No embedded images or unique atlas.

## Model and axes

8,676 triangles; 26,028 vertices; 3 material groups; 1,043,628 bytes. Native bounds: -9.524, -0.863, -9.237 to 8.643, 8.706, 9.905. Source hash: `sha256:f689dbb119bf26cd8488bbcee87077b4b044cb20a205506a92e1d52e35edf178`.

{"x":"east","y":"up","z":"south"}

The geographic proposal uses exact-QID OpenStreetMap evidence. Map-derived orientation and estimated architectural details require real-site visual review; preview eligibility is distinct from geographic/fidelity approval. Map attribution: © OpenStreetMap contributors, ODbL-1.0.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=temple_of_baalshamin` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Dated 2010 surviving Temple of Baalshamin: roofless rectangular ashlar cella, six free-standing Corinthian porch shafts with projecting brackets, open side windows with pedimented surrounds and attached pilasters, tall gated doorway, continuous surviving upper stone beams/cornice, low stepped podium and a small selection of fallen stone/drum fragments. This is the photographed pre-destruction ruin, not a reconstruction of its complete ancient roof or today’s damaged remains.
- Q20871005 and way389978856 identify the broad archaeological precinct, not a 140m solid building. Use the Wikidata reference anchor for the small temple; the precinct axis guides rotation, with the porch toward its northeast end from the ordinary north-side photograph. The approximately16m by9m podium, cella subdivisions, exact origin and signed facing are picture-led estimates; no surviving mapped temple footprint resolves them. Preserve all independent current map buildings and the host precinct terrain.
- Human-scaled ordinary 2010 pictures guide a roughly7.8m surviving wall/capital elevation and8.5m cornice above the stepped podium. Shaft proportions, brackets, window pediments, ashlar courses, broken edges and scattered fragment inventory are medium-fi estimates. No original roof/pediment, full courtyard colonnade, fine inscriptions, sculpture or navigable interior is reconstructed.
- Reuse pinned standard temple_of_bel Palmyra PMTiles/Mapzen data. The small podium floor is above the maximum nearby native grade, with a buried base and shallow front treads. Preserve native terrain/water without cutouts. Current DEM/map context is explicitly an approximate setting for a dated historical exterior, not a reconstructed 2010 streetscape or surveyed archaeological pavement.
- Historical2010 exterior only. Cella dimensions, bracket details, masonry damage, fragment placement and signed facing remain photo-led approximations. Explicit viewingDate inside the source interval is required; this model is excluded from today’s world.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain.
