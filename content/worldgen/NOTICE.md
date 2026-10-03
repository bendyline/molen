# molen.worldgen.default notice

This pack (architectural styles, material graphs, scatter rules, props, landmarks, structures and
the interior catalog) is Molen's own authored or procedurally generated work, licensed under the
MIT License with the rest of the Molen repository.

## Geographic reference data

Mapped landmark plans and placement coordinates include data from
[OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under ODbL 1.0.
The corresponding source bundles identify the map features used.

The Pont del Diable model (`molen.worldgen.structure.n0031_pont_del_diable`) uses deck and
roof elevations derived from data of the **Institut Cartogràfic i Geològic de Catalunya
(ICGC)**, under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
The source is the [ICGC territorial elevation service](https://www.icgc.cat/ca/Geoinformacio-i-mapes/Geoinformacio-en-linia-Geoserveis/WMS-i-WCS-Elevacions/WMS-Elevacions-territorial):
2021–2023 terrain LiDAR, 2022 AMB surface LiDAR, and 2024 surface photogrammetry.
Molen sampled these datasets, rounded selected deck elevations, interpolated the occluded
summit walkway, and reconstructed the visible architecture. These changes and the retained
measurements are documented in the model's `terrain-profile.json`; this is not an ICGC survey
or endorsement of the reconstruction.

The Rembrandt Tower (`molen.worldgen.structure.n0623_rembrandt_tower`) and Montevideo
(`molen.worldgen.structure.n0619_montevideo`) models use ground
footprint and roof-height evidence from **© 3DBAG by tudelft3d and 3DGI**, under
[CC BY 4.0](https://docs.3dbag.nl/en/copyright/). The 2023 Rembrandt and 2022 Montevideo
source responses and attribution are retained in `bag-source.json` in each source bundle.
Molen converts the horizontal
coordinates from RD New to WGS84, extracts roof elevations, regularizes architectural
modules, and creates an original procedural facade. These changes and the source quality
flags are recorded in `map-frame.json`, `roof-envelope.json`, and `spec.json`. The rendered
model is a reconstruction, not the source survey mesh or an endorsement by its producers.

## Storefronts and trademarks

The landmark models are generic: their IDs, titles and wordmarks are descriptors such as
`mart_store` and `taco_place`, and every business emblem is formed from the descriptor's
initials, not from any company's logo. Some color palettes are inspired by real businesses and
remain as visual variants. Real company names appear only in the separate `molen.earth` business
catalog, which uses them to recognize mapped places and route them to these generic models.

All product names, company names, logos, color schemes and other trade dress referred to in this
pack are the property of their respective owners. Molen and Bendyline LLC are not affiliated with,
endorsed by, sponsored by or approved by any of them, and no such relationship is implied. The MIT
License grants rights in this pack's software and data only; it grants no right in any third
party's trademark, service mark, trade name or trade dress. A redistributor's use of these marks
is that redistributor's own.
