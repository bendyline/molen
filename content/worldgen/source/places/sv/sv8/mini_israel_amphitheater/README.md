# Mini Israel outdoor amphitheater

The full-size venue at the southeast edge of the park has an open truss stage, three stepped seating sections and stone retaining walls. The aerial photos guide the stage outline and the uneven terrace perimeter. The model uses shared stone, concrete and painted metal. Individual seats draw at close range. Seating dimensions, temporary stage equipment and the exact ground heights are approximate. [Park venue listing](https://www.minisrael.co.il/) · [Oblique aerial photograph](https://www.the7eye.org.il/460149)

The stage faces northeast into the audience terraces. The terrain fit uses the existing park PMTiles and standard Terrarium elevation. The model leaves the visitor paths, land cover and other park exhibits in place. [Map fit](map-frame.json)

```powershell
node content/worldgen/source/places/sv/sv8/mini_israel_amphitheater/models/generate-amphitheater.mjs
node packages/worldgen/scripts/import-structure-models.mjs --ids=mini_israel_amphitheater
node packages/tooling/scripts/generate-landmark-lods.mjs --ids=mini_israel_amphitheater
```
