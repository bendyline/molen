# Grand Inga Dam, 2014 proposal

This source-built relief depicts the Bundi barrage and six proposed Inga 3–8 stations
shown in the 2014 SNEL concept reproduced in JICA Figure 3-3.9. The mapped Congo
River remains visually distinct from the proposed Bundi reservoir and channels. The
station exteriors, channel grades and reservoir edge are schematic interpretations.
The standalone view includes the full relief. With regional PMTiles and terrain loaded,
add `?proposal=grand.inga.dam` in World Explorer to see the 2014 design at its planned
location. An Earth host can pass `structureProposal: 'grand.inga.dam'` on mount.
The default Earth view uses the host terrain, river and mapped structures. [Placement review](placement-report.json)

The editable model uses the retained PMTiles river shape and a 150 m grid of
Terrarium elevations. Concrete, sandstone and painted metal use shared materials.
The Earth levels draw the proposed works and reservoir over the host landscape.
The Inga 8 intake stays on the mapped west bank, and the Congo remains visible
throughout the scene. The locations, channel grades and reservoir elevation represent
the concept at an approximate site fit. [Map frame](site-frame.json) · [Native terrain preview](proposal-preview.webp)

- [JICA reproduction of the 2014 plan](https://openjicareport.jica.go.jp/pdf/12363990.pdf#page=72)
- [Feasibility concept reproduced by the Royal Academy](https://www.kaowarsom.be/documents/PUBLICATIONS/SUSTAINABLE_ENERGY_AFRICA.pdf#page=83)
- [World Bank Inga 3 development program](https://www.worldbank.org/en/news/press-release/2025/06/03/new-inga-3-development-program-to-start-with-investments-in-local-afe-congolese-communities)
- [September 2026 Inga 3 procurement plan](https://documents.worldbank.org/en/publication/documents-reports/documentdetail/099091726135010776)

```powershell
node content/worldgen/source/places/kr/kr1/grand_inga_dam/models/generate-grand-inga.mjs
node packages/worldgen/scripts/import-structure-models.mjs --ids=grand_inga_dam
node packages/tooling/scripts/generate-landmark-lods.mjs --ids=grand_inga_dam
```
