# Książ forge

![Shared Molen preview](shots/shared/angle-0.png)

L-shaped service building with rubble stone walls, brick upper band, two arched timber double doors, shallow roof and a tall masonry chimney.

Independently placed component of [Książ Castle and park complex](../ksiaz_castle_and_park_complex/README.md). See the [placement review](QA-REVIEW.md) for the ground fit.

## Sources and reconstruction

- [Reference](https://eli.gov.pl/api/acts/DU/2025/1089/text.pdf)
- [Reference](https://www.flickr.com/photos/124589265@N07/14185032925/)
- [Reference](https://www.openstreetmap.org/way/281941091)

Original authored geometry under repository license. Mapped outline © OpenStreetMap contributors,ODbL-1.0;linked research photographs are not redistributed.

Own map footprint; native Y0 is estimated local ground contact. Heights, roof profiles, openings and unseen elevations are interpretations. Only the mausoleum has a mapped independent Wikidata identity. Entry azimuth and actual geographic fit remain pending.

## Build

Run node content/worldgen/source/places/u3/u35/ksiaz-park-structures/models/generate-ksiaz-park-structures.mjs --ids=KSI_P02 (or --check).

612 triangles;78016 source bytes;8 merged material groups;no embedded images. Shared plaster, tile, sandstone, rubble, brick, timber and metal use metric UVs and linear palette tints as appropriate to each building. Runtime LODs are separate generated outputs.

Source hash: sha256:18e75918d7084a083569323e0d5fc877d4b72d5e97698a5b811d76d5600d9a9d
