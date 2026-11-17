# Lubiechów Palm House boiler and north service range

![Shared Molen preview](preview.png)

Own north service range with low flanking wings, central timbered boiler gable, polygonal stair oriel, red tile roof and two square brick stacks.

Independent component of [Książ Castle and park complex](../ksiaz_castle_and_park_complex/README.md). See the [render and map review](QA-REVIEW.md).

## Sources and reconstruction

- [Reference](https://eli.gov.pl/api/acts/DU/2025/1089/text.pdf)
- [Reference](https://zabytek.pl/en/obiekty/g-268933)
- [Reference](https://zabytek.pl/en/obiekty/g-268933/dokumenty/PL.1.9.ZIPOZ.NID_N_02_EN.224644/1)
- [Reference](https://www.openstreetmap.org/way/263010002)

Original authored geometry under repository license. Mapped outline © OpenStreetMap contributors,ODbL-1.0;linked research photographs are not redistributed.

The own mapped footprint and historic façade orientation set the placement. The fitted plinth and recessed entrance use retained PMTiles terrain. Original exterior interpretation follows the individual NID cards and ensemble plan. Dimensions and present condition are estimates.

## Build

Run node content/worldgen/source/places/u3/u35/ksiaz-palm-services/models/generate-ksiaz-palm-services.mjs --ids=KSI_L05 (or --check).

4271 triangles;516712 source bytes;7 merged material groups. Six shared graphs for plaster, tile, rubble, sandstone, brick and timber use metric UVs and linear palette tints. Flat muted glazing adds one material. Runtime LODs are separate generated outputs.

Source hash: sha256:57d3c6609840c4f0dd5c0b7e537434b5ecfa51f6c243135fcf2e5774ca62b6f1
