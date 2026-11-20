# Summer Palace · Farming and Weaving Stele (2006)

Kallgan’s photograph from 29 March 2006 shows the stele in an open flagstone apron with bronze-toned rails on round feet. A dark interpretation panel stands behind the railing. The four detail tiers reuse the present model’s carved tablet and plinth. The rail spacing, paving dimensions and panel position are estimated from the photograph. [Archive photograph](https://commons.wikimedia.org/wiki/File:Yiheyuan_stele.jpg)

The archive version and the present sheltered version represent the same monument. The panel uses the photographed Chinese heading and the observed lines of Chinese and English text. The body copy and garden beyond the apron remain unresolved. [Present appearance](../summer_palace_farming_stele/README.md) · [Photo and map observations](reference-observations.json)

A separate photograph published in 2021 shows the bronze rails and the fieldstone wall behind the open apron. Its capture date is unknown. The March 2006 photograph dates the modeled appearance. [Photo comparison](../summer_palace_farming_stele/placement-report.json)

World Explorer places the model when the viewing date is 29 March 2006. Three aerial views support the approximate apron location immediately west of the garden path. The position and bearing are estimated from imagery. The viewer uses modern terrain and PMTiles. The paving stays visible at all four detail levels. [Placement review](placement-report.json)

```powershell
node content/worldgen/source/places/wx/wx4/summer_palace_farming_stele_2006/models/generate-open-apron.mjs
node packages/worldgen/scripts/import-structure-models.mjs --ids=summer_palace_farming_stele_2006
node packages/tooling/scripts/generate-landmark-lods.mjs --ids=summer_palace_farming_stele_2006
```
