# Usoi Dam

This portable relief shows the 1911 landslide in Tajikistan's Pamir mountains, the adjacent
Lake Shadau and the western end of Lake Sarez. The source preserves north-aligned
48 m elevations, the mapped landslide and glacier outlines, and two independent lake
surfaces. Earth renders this site using its native terrain and water layers.
Near the landslide, a local shoreline correction preserves the separate Sarez and Shadau
stages in the world viewer. [Native preview and review](QA-REVIEW.md)

`models/landscape.json` records the standard Terrarium tiles, the Protomaps landslide
and glacier footprints, and the complete OpenStreetMap shoreline contours inside the
display crop. Each lake uses a representative static stage derived from the interior
elevations. The display crop blends terrain into the water at the shore.
The relief contains no submerged elevations or operational model. It uses shared
granite and gravel materials with simple colors for the glaciers and water.

- [NASA view of Usoi and the lakes](https://science.nasa.gov/earth/earth-observatory/lake-sarez-tajikistan-2077/)
- [USGS site description](https://www.usgs.gov/publications/usoi-landslide-dam-and-lake-sarez-pamir-mountains-tajikistan)
- [OpenStreetMap contributors and data license](https://www.openstreetmap.org/copyright)
- [Lake Sarez outline](https://www.openstreetmap.org/relation/1164875)
- [Lake Shadau outline](https://www.openstreetmap.org/relation/17406693)
- [Mapzen terrain attribution](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)

```powershell
node content/worldgen/source/places/tw/twg/usoi_dam/models/generate-usoi-dam.mjs
node packages/worldgen/scripts/import-structure-models.mjs --ids=usoi_dam
node packages/tooling/scripts/generate-landmark-lods.mjs --ids=usoi_dam
```
