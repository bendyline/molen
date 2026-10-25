# Temple of Peace

![Molen preview](preview.png)

Temple of Peace present-day visible ruins: seven mapped re-erected plain pink granite shafts on white stepped bases/stylobate, roofless low brick/concrete court traces, fallen drums and fragments, patchy paving in the exposed western court, and eight low mapped eastern relics. The intervening native terrain is preserved. Keep the independent Santi Cosma e Damiano church, later structures, Basilica of Maxentius, Nerva and neighboring Roman Forum. No intact Roman roof, entablature or lost superstructure is reconstructed.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:2016_Temple_of_Peace_(Rome)_02.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:2016_Temple_of_Peace_(Rome)_03.jpg)

Two registered recipes build the specific exposed columns and roofless ruins with shared 256² material graphs, metric UVs and linear tints. No embedded images or unique atlas.

## Model and axes

5,236 triangles; 15,708 vertices; 5 material groups; 631,728 bytes. Native bounds: -106.317, -5.570, -61.092 to 50.938, 7.067, 31.776. Source hash: `sha256:2e30d2bd3fac28cef8a9ef4169991dd892ee1734103141de532a31374edcae15`.

{"x":"east","y":"up","z":"south"}

The geographic proposal uses exact-QID OpenStreetMap evidence. Map-derived orientation and estimated architectural details require real-site visual review; preview eligibility is distinct from geographic/fidelity approval. Map attribution: © OpenStreetMap contributors, ODbL-1.0.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=temple_of_peace` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Temple of Peace present-day visible ruins: seven mapped re-erected plain pink granite shafts on white stepped bases/stylobate, roofless low brick/concrete court traces, fallen drums and fragments, patchy paving in the exposed western court, and eight low mapped eastern relics. The intervening native terrain is preserved. Keep the independent Santi Cosma e Damiano church, later structures, Basilica of Maxentius, Nerva and neighboring Roman Forum. No intact Roman roof, entablature or lost superstructure is reconstructed.
- Q1456939/relation1841167 identifies three separated archaeological areas, not a solid building. Seven individual pinned PMTiles column footprints determine the standing row. Its own measured map axis controls the internal architecture, rather than applying the broad precinct bounding-box axis to every shaft. Eight small eastern mapped remnants are low fragment treatments. Native+X east/+Z south and runtime heading0. Only the visible western court has an authored ground surface. Other archaeological boundary polygons do not imply invented building masses or paved platforms. Later neighboring footprints stay independent.
- Two ordinary current-state photographs guide approximate shafts6.8m tall above the white bases, a1.35m stepped stylobate and low0.35–2.2m broken walls. No capitals/entablature are invented. Fallen drums, paving patches, low court rectangles, small fragment height and erosion are picture-led visualization estimates, not surveyed inventories.
- Reused pinned temple_of_portunus standard Rome PMTiles/Mapzen extract. Only the photographed western court receives a shallow visualization pavement above its local coarse grid, with buried retaining foundations and stepped colonnade. Unverified intervening/southeastern precinct surfaces stay native; eight eastern mapped remnants sit locally on the original terrain. No ground or water opening. Exact excavated depths and street retaining levels remain approximate.
- Mapped column centers and low eastern relics retain approximate placement. Court traces, fragments, erosion and exact excavated levels are picture-led estimates. The independent church and neighboring Forum monuments remain separate; no intact ancient temple or navigable interior is claimed.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain.
