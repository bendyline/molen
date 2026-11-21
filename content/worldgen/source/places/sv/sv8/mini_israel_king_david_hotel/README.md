# Mini Israel · King David Hotel exhibit

The source models the miniature at Latrun with projecting end pavilions, stacked balconies, thirteen canvas awnings and a curved garden rotunda. The panorama published in 2012 fixes the façade proportions and shows the pool to the left and tennis court to the right, viewed from the garden. The 2003 photos identify the exhibit and show the garden in detail. The 2022 flyover shows the roof and site layout. Absolute dimensions and rear façade details remain estimated. [2003 photographs](https://jr.co.il/pictures/israel/mini-israel/index2.htm) · [Archived panorama](https://virtualglobetrotting.com/map/mini-israel-king-david-hotel/view/google/) · [2022 flyover](https://www.youtube.com/watch?v=7Zerh5_QLVA&t=306s)

The model uses six shared Worldgen materials across four distance tiers. The original hotel footprint and the park’s published 1:25 scale give an estimated miniature width of 3.615 m. [Placement report](placement-report.json)

The World Explorer reconstruction appears when the host sets the viewing date to `2012-05-17`, the publication date of the archived panorama. The footprint is about 1.73 m inside the photographed planting island and its nearest edge clears the nominal PMTiles path by 0.29 m. A grade active on that date exposes the lower garden, pool and tennis court. The original platform coordinates and current display condition remain unresolved. Coarse host terrain can partly cover the lower garden. [Archived panorama](https://virtualglobetrotting.com/map/mini-israel-king-david-hotel/view/google/) · [Placement report](placement-report.json)

```powershell
node content/worldgen/source/places/sv/sv8/mini_israel_king_david_hotel/models/generate-king-david-exhibit.mjs
node packages/worldgen/scripts/import-structure-models.mjs --ids=mini_israel_king_david_hotel
node packages/tooling/scripts/generate-landmark-lods.mjs --ids=mini_israel_king_david_hotel
```
