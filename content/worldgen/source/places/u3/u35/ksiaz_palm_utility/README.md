# Lubiechów Palm House utility building

![Shared Molen preview](preview.png)

Both connected mapped ranges, long tiled roof, half-timbered upper east band, taller polygonal south end, boarded gable, dormers and square brick chimney.

Independent component of [Książ Castle and park complex](../ksiaz_castle_and_park_complex/README.md). See the [render and map review](QA-REVIEW.md).

## Sources and reconstruction

- [Reference](https://eli.gov.pl/api/acts/DU/2025/1089/text.pdf)
- [Reference](https://zabytek.pl/en/obiekty/g-259452)
- [Reference](https://zabytek.pl/en/obiekty/g-259452/dokumenty/PL.1.9.ZIPOZ.NID_N_02_EN.224655/1)
- [Reference](https://www.openstreetmap.org/way/396950371)

Original authored geometry under repository license. Mapped outline © OpenStreetMap contributors,ODbL-1.0;linked research photographs are not redistributed.

The own mapped footprint and historic façade orientation set the placement. The fitted plinth and recessed entrance use retained PMTiles terrain. Original exterior interpretation follows the individual NID cards and ensemble plan. Dimensions and present condition are estimates.

## Build

Run node content/worldgen/source/places/u3/u35/ksiaz-palm-services/models/generate-ksiaz-palm-services.mjs --ids=KSI_L03 (or --check).

3653 triangles;442524 source bytes;7 merged material groups. Six shared graphs for plaster, tile, rubble, sandstone, brick and timber use metric UVs and linear palette tints. Flat muted glazing adds one material. Runtime LODs are separate generated outputs.

Source hash: sha256:dc7646a9fb943ee4184f424c6d46a3b5e6da2b117b83417aa91527e72c7323ad
