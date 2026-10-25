# Dendera Temple complex

![Molen preview](preview.png)

Dendera medium-fi complex: stepped Hathor temple with six front Hathor-headed columns and twenty-four-column hypostyle hall, roof kiosk/chapel rooms and stairs, roofed Roman mammisi, roofless older mammisi, Coptic basilica and sanatorium ruins, surviving Isis chamber/forecourt, dry sacred-lake basin, north stone portal and eroded mudbrick precinct. Exterior visualization from ordinary pictures and standard PMTiles; inner chambers, crypts, exact reliefs and surveyed archaeological levels are outside scope.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Dendera_7_977.PNG)
- [Reference](https://commons.wikimedia.org/wiki/File:Mudbrick_compound_walls.JPG)
- [Reference](https://commons.wikimedia.org/wiki/File:Dendera_roof_overview.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:26930-_Kiosk_on_the_roof_of_Temple_of_Hathor,_Dendera.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Roof_of_the_Hathor_Temple_at_Dendera_(IV).jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Roman_Mammisi_at_Dendera_(II).jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:26901-_Dendera_church_and_Mammisi_ruins.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Complesso_templare_di_Dendera.png)
- [Reference](https://commons.wikimedia.org/wiki/File:Sacred_Lake_at_Dendera_(I).jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:The_Temple_of_the_Birth_of_Isis_at_Dendera_(I).jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Dendera_Mammisi_Nektanebos_I._02.JPG)
- [Reference](https://commons.wikimedia.org/wiki/File:Dendera_Römisches_Mammisi_01.JPG)

Four registered recipes rebuild the complete exterior complex. Reused256-square material graphs, metric UVs and linear tints; no embedded images or unique atlas.

## Model and axes

22,832 triangles; 68,496 vertices; 4 material groups; 2,742,744 bytes. Native bounds: -140.000, -2.204, -189.750 to 150.250, 26.505, 115.250. Source hash: `sha256:4ead3f815f99a59c3588228ad00d1832e718998c34b44ace8a597523c027426a`.

{"x":"west-northwest across main facade","y":"up","z":"north-northeast toward main entrance"}

The geographic proposal uses exact-QID OpenStreetMap evidence. Map-derived orientation and estimated architectural details require real-site visual review; preview eligibility is distinct from geographic/fidelity approval. Map attribution: © OpenStreetMap contributors, ODbL-1.0.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=dendera_temple_complex` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Dendera medium-fi complex: stepped Hathor temple with six front Hathor-headed columns and twenty-four-column hypostyle hall, roof kiosk/chapel rooms and stairs, roofed Roman mammisi, roofless older mammisi, Coptic basilica and sanatorium ruins, surviving Isis chamber/forecourt, dry sacred-lake basin, north stone portal and eroded mudbrick precinct. Exterior visualization from ordinary pictures and standard PMTiles; inner chambers, crypts, exact reliefs and surveyed archaeological levels are outside scope.
- Q735254/way216932198 identifies the entire archaeological complex. PMTiles building35184538738193 provides the8-vertex Hathor temple footprint, and35185840606911 its front hall. The front opening follows the north-northeast end of the mapped outline and the ordinary frontal photograph. The large archaeological-site boundary is context, not a mudbrick wall line.
- Photographic proportions estimate the43.6m-wide front at approximately18.4m including its cavetto cornice, with a lower13.75m rear roof. The retained PMTiles tags8m for the main building and5m for its front part contradict the observed facade proportions; they remain recorded, not silently treated as measured architecture. Column heights, capitals, bays and tiers are draft estimates; no survey or archival source was pursued.
- Reviewed approximate exterior fit on the unchanged standard161-square/6m Mapzen grid. SourceY0 is the original raw-map anchor sample; the primary floor follows its front approach at sourceY7.1. Bounded openings beneath the primary stepped footprint and dry lake are covered by opaque geometry at all four levels. Other monument floors sit above their sampled local maximum, with retaining foundations. Seven mapped temple/roof/sanatorium records are selectively replaced; seven independent facilities/structures are preserved byte-for-byte in the retained site fixture. Numerical boundary remnants are below1e-7m². Failed loading restores all14 native records and original ground; eviction frees geometry. No native water is present or removed. No exact archaeological thresholds, excavated strata or terrain survey are claimed.
- Ancillary POIs constrain the Roman and older mammisi, basilica and sanatorium. The unmeasured ordinary visitor diagram provides relative axes and approximate dimensions; ordinary photographs show a roofed Roman mammisi, roofless older mammisi/basilica/sanatorium, partially roofed Isis chamber and dry sacred lake. Isis, lake, north portal and mudbrick wall positions remain visual estimates. The archaeological tourism boundary is not used as an ancient wall survey. The precinct is an eroded tapering mudbrick circuit with a north gate opening, not a clean extrusion of the managed-site boundary. Individual damage patterns, carved portraits and hieroglyphs are not reproduced.
- Exterior medium-fi visualization. Exact individual reliefs, inscriptions, damage patterns, inner chambers and crypts are not reconstructed. Current render and site checks are required before acceptance.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain.
