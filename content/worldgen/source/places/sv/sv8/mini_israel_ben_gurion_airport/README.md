# Mini Israel · Ben Gurion Airport exhibit

The reconstruction follows the Mini Israel airport exhibit in the panorama published in May 2012. Seven miniature airliners stand on a pale apron with round parking marks, a guide track, and a visitor-side rail. The closest airliner has a blue belly and fin. A yellow DHL freighter sits on a stand. Aircraft types, dimensions, and partly hidden details are estimated from the photograph. [Archived panorama](https://virtualglobetrotting.com/map/mini-israel-airplane-models/view/google/) · [Photo-derived layout](archive-apron-layout.json)

All four levels use the shared painted metal and concrete graphs. The street and close-up levels add safety rails, windows, and lettering as geometry. The retained early model shows the El Al and Arkia Boeing 747 miniatures with raised upper decks, four engines, and recessed guide tracks. The generator's `--early` option rebuilds that source master byte for byte. [Early El Al photograph](https://jr.co.il/pictures/israel/mini-israel/mi046.htm) · [Early Arkia photograph](https://jr.co.il/pictures/israel/mini-israel/mi047.htm)

The recorded camera bearing places the apron west-southwest of the archive pin. A uniform 89% scale about that camera preserves the photographed view and gives the apron 2.77 m of clearance from the nearest mapped path. A shallow grade supports the apron in the 17 May 2012 view, the panorama’s publication date. The old platform dimensions and grade remain estimates. [Placement review](placement-report.json) · [Reference observations](reference-observations.json)

```powershell
node content/worldgen/source/places/sv/sv8/mini_israel_ben_gurion_airport/models/generate-ben-gurion-exhibit.mjs
node packages/worldgen/scripts/import-structure-models.mjs --ids=mini_israel_ben_gurion_airport
node packages/tooling/scripts/generate-landmark-lods.mjs --ids=mini_israel_ben_gurion_airport
```
