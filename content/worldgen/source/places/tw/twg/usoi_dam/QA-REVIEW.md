# Usoi Dam relief review

The relief shows the dry landslide between two level lakes, the restored west basin shoreline, and the Pamir ridges. The mapped island in Lake Sarez stays above the water mask in all four levels. Shared granite and gravel resolve in the viewer. Color and surface finish are illustrative. [Model preview](preview.png)

The north-aligned relief covers the dam and western basin. The stock semantic water renderer held the sampled lake polygons at 3264 m for Sarez and 3262 m for Shadau across 225 clips at zooms 13–16. [Review record](qa.json)

The GLB master and four viewer levels passed validation with no errors, warnings or embedded images. The skyline and district meshes total 221,024 bytes. The heights come from the retained 48 m elevation grid.

The world viewer uses native terrain and water for this natural dam. In the Protomaps tiles, a generalized feature crossed both lakes near the landslide and produced conflicting water heights. A bounded correction uses the two retained OpenStreetMap shorelines in that area. I checked a north-up view and three oblique views with zoom 15 detail present. Twelve water probes, including four in the corrected areas, hit only their lake's stage. The Sarez island and two landslide probes stayed dry. The lake meshes cleared when leaving the area and returned with zero failed tiles. The stages are representative render settings. [World-viewer preview](native-preview.webp)
