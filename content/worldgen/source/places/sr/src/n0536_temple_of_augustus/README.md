# Temple of Augustus

![Molen preview](preview.png)

Specific standing Temple of Augustus in Pula: narrow rectangular rubble-stone cella, six smooth grey Corinthian columns (four front and two side), engaged antae, a true deep portico, recessed timber cella door, raised stone podium/centered stairs with cheeks, layered entablature, plain triangular pediment and projecting dentil/modillion cornices, simple tiled gable roof and open-column timber ceiling. Adjacent City Hall and independent urban buildings remain host context. No complete museum interior, copied readable inscription or narrative sculpture.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Augustus_temple_Pula.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Side_Wall,_Temple_of_Roma_and_Augustus_(Pula).jpg)

A deterministic recipe and reusable original Corinthian helper build the specific Pula temple, six smooth shafts/leafy capitals, rubble-stone cella, deep portico, plain pediment/cornices and tiled gable roof. Five shared256-square graphs, metric UVs, linear tints, four browser levels and no embedded images.

## Model and axes

10,732 triangles; 32,196 vertices; 5 material groups; 1,291,248 bytes. Native bounds: -9.419, -1.128, -9.567 to 6.717, 13.563, 11.493. Source hash: `sha256:ddd7f377f5723b6d55138b16418d254e6580606eec661f0edc7730fce0b599b2`.

{"x":"east","y":"up","z":"south"}

The geographic proposal uses exact-QID OpenStreetMap evidence. Map-derived orientation and estimated architectural details require real-site visual review; preview eligibility is distinct from geographic/fidelity approval. Map attribution: © OpenStreetMap contributors, ODbL-1.0.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0536` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Specific standing Temple of Augustus in Pula: narrow rectangular rubble-stone cella, six smooth grey Corinthian columns (four front and two side), engaged antae, a true deep portico, recessed timber cella door, raised stone podium/centered stairs with cheeks, layered entablature, plain triangular pediment and projecting dentil/modillion cornices, simple tiled gable roof and open-column timber ceiling. Adjacent City Hall and independent urban buildings remain host context. No complete museum interior, copied readable inscription or narrative sculpture.
- Exact-QID Q770030/way119102927 and standard named building/POI35184491191759 fix the19.804x9.354m temple envelope beside the distinct City Hall35184491191751. Root heading0; local+z follows the long axis toward the southeast Forum, internal local+x angle-.441743326094rad from native east. Body origin[-1.17138,.92686]m relative to candidate anchor; it shifts the modeled podium/short stairs within the mapped overall envelope. Six-column/door/anta allocations are picture-led approximations.
- Approximate picture-led column height8.2m, entablature/cornice about1.8m, plain pediment/roof rise1.9m above that and podium about1m above retained local grade. Roof about17.65x8.9m, podium17.25x8.5m with short centered stairs. Cella/portico split, rear treatment, cap mouldings and roof construction are exterior approximations, not surveyed construction dimensions.
- Retain original standard6m Mapzen urban terrain, water and every independent building. A small locally level temple podium has grade-buried bottom edges; short central stairs descend toward local ground, with solid stone cheeks. Do not flatten the Forum or cut ground/water. Coarse urban DEM does not resolve exact paved Forum level, podium steps or thresholds.
- Column/door/anta stations, heights, mouldings, rear treatment and roof construction are ordinary-picture/map approximations. No copied readable inscription, narrative sculpture or complete museum interior. Preserve adjacent City Hall and independent buildings.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain.
