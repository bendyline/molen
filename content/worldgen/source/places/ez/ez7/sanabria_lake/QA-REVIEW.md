# Sanabria Lake relief review

The portable relief shows both connected basins, the glacial shoreline and the surrounding relief. The surface stays flat in oblique views. The shape and slopes come from the retained PMTiles and Terrarium source data. Color is schematic. [Model preview](preview.png)

The stock water mesh used a common 1000 m stage for the 53 clipped Sanabria Lake polygons tested at zooms 12–16. That change targets the mapped lake feature without changing the adjacent river. The portable relief has a registered, signed geographic frame. Earth draws the lake through native water and terrain. [Review record](qa.json)

The GLB master and four runtime levels passed validation with no errors, warnings or embedded images. The skyline and district files total 152,020 bytes. All levels preserve the three mapped islands. The model shows the water surface and dry terrain only.

The world viewer streamed real Protomaps vector tiles and Mapzen elevations for the north-up and two oblique views. With zoom 15 detail present, three probes in the two basins hit the same 1000 m water surface and all three mapped island probes were dry. Leaving the region cleared the water meshes. Returning restored the same coverage with zero failed tiles. Coarser maps can simplify the smallest islands. [World-viewer preview](native-preview.webp)
