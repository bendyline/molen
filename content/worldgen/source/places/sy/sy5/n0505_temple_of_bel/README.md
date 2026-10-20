# Temple of Bel

![Molen preview](preview.png)

Surviving Temple of Bel ruin at Palmyra: approximately200m enclosed temenos with fortified west gate, selected perimeter columns/stumps, exposed central cella podium, standing monumental cella doorway and a field of fallen blocks/drums. The cella roof, walls and complete surrounding temple colonnade destroyed in2015 remain absent. Independent Palmyra monuments and modern visitor buildings remain native.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Palmyra_after_freedom_(4).jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Palmyra_13970826_12.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Gate_of_the_fortified_Temple_of_Bel_Palmyra_Syria.jpg)

Two registered recipes rebuild the surviving precinct and cella doorway. Three common256-square material graphs, metric UVs and linear tints; no embedded images or unique atlas.

## Model and axes

10,734 triangles; 32,202 vertices; 3 material groups; 1,290,540 bytes. Native bounds: -110.557, -5.892, -109.687 to 117.862, 15.512, 110.661. Source hash: `sha256:8eed10c5b52758af9d52869040ea7b5c853f9cd2f886b29e43014d640f7c04ba`.

{"x":"east","y":"up","z":"south"}

The geographic proposal uses exact-QID OpenStreetMap evidence. Map-derived orientation and estimated architectural details require real-site visual review; preview eligibility is distinct from geographic/fidelity approval. Map attribution: © OpenStreetMap contributors, ODbL-1.0.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0505` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Surviving Temple of Bel ruin at Palmyra: approximately200m enclosed temenos with fortified west gate, selected perimeter columns/stumps, exposed central cella podium, standing monumental cella doorway and a field of fallen blocks/drums. The cella roof, walls and complete surrounding temple colonnade destroyed in2015 remain absent. Independent Palmyra monuments and modern visitor buildings remain native.
- Q797481/way226891786 identifies the complete temenos boundary. Its original16 vertices are retained at the mapped anchor, with a4.589-degree internal rotation and west gate on the western boundary. PMTiles building35184675160368 supplies four original central cella/podium corners. That coarse generic building record is replaced by the surviving ruin, not extruded into the lost temple. Standing cella doorway position follows the west long side; exact doorway offset and surviving perimeter column positions are picture-guided estimates.
- The ordinary article gives15m for the original temple and describes the cella destruction with surviving doorway, fortified gate and outer walls.2016/2018 pictures show the isolated rectangular doorway above rubble. The modeled doorway cornice rises11.15m above the conservative podium datum, horns12.1m. The west gate is approximately12.2m above adjacent coarse grade, most outer walls5.7m and west walls7.3–10m. Perimeter standing columns7.6m and stumps1.2–3.15m are schematic. Exact damage, block positions, temple heights and column survival were not surveyed.
- The original161-square/6m Mapzen/USGS grid remains unchanged. Only the small mapped central cella footprint has an opaque podium floor; its top clears every original rendered grid-cell vertex in its bounds by0.2m. Outer walls, gate, perimeter stumps and scattered rubble use local standard DEM grade and extend slightly below it. No ground or water cutout is needed; the open court keeps its original terrain. Gate threshold and individual stones remain approximate.
- Post-destruction exterior only. Perimeter column positions, standing sections, damaged profiles, rubble and exact thresholds are picture/map-guided approximations. The lost cella walls, roof and complete surrounding temple colonnade remain absent. The west-gate form uses a pre-destruction photo; exact current damage remains uncertain. Current acceptance is recorded in qa.json.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain.
