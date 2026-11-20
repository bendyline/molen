# Sanabria Lake

This source bundle depicts the glacial lake and its surrounding slopes in northwestern Spain.
The portable relief uses +X east, +Z south and +Y up, with the lake surface at local Y=0.
The Earth viewer draws the location through its standard terrain and water layers. Feature
`177168713` uses a common 1000 m visualization stage across its PMTiles fragments.

`models/lake-terrain.json` retains the union of the zoom 15 water fragments and nine
Mapzen Terrarium tile hashes. The regular 16 m terrain grid stores elevations to a centimeter
as a numeric encoding of the sampled DEM. The mapped shoreline is clipped into the terrain
mesh and blends terrain into the water level within two DEM samples of shore. All four runtime
levels preserve the mapped islands. Shared gravel and granite materials
give the slopes and exposed rock a coherent palette. The water is flat with a local base color.
The relief has no bathymetry or vegetation. The elevation stage represents a static visualization.

The shoreline data comes from Protomaps and OpenStreetMap contributors under the
[Open Database License](https://www.openstreetmap.org/copyright). The relief grid derives from
the [Mapzen terrain tile archive](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).
The lake and its glacial setting are documented by the
[Geological and Mining Institute of Spain](https://info.igme.es/ielig/LIGInfo.aspx?codigo=CI043)
and the [Spanish national hydrological reserve catalog](https://www.miteco.gob.es/es/agua/temas/delimitacion-y-restauracion-del-dominio-publico-hidraulico/catalogo-nacional-de-reservas-hidrologicas/informacion/duero/lago-sanabria.html).

```powershell
node content/worldgen/source/places/ez/ez7/sanabria_lake/models/generate-sanabria-lake.mjs
node packages/worldgen/scripts/import-structure-models.mjs --ids=sanabria_lake
node packages/tooling/scripts/generate-landmark-lods.mjs --ids=sanabria_lake
```
