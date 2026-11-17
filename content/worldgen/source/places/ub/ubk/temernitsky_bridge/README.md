# Temernitsky Bridge

The named Don highway crossing has two three-lane carriageways, outer sidewalks, continuous box girders, paired concrete pier shafts, red-brown perimeter rails and hooked streetlights. It joins the two mapped elevated viaducts and runs parallel to the separate railway lift bridge.

Run `node packages/worldgen/scripts/generate-temernitsky-bridge.mjs` to rebuild the detailed master. The landmark LOD generator exports four detail levels. The road, concrete and steel use three shared graph materials.

Protomaps supplies the carriageway and sidewalk lines and the Don banks. The bridge profile, bearings and pier spacing are reconstructed from photographs. The terrain fixture replaces three implausible elevation samples with local values. The viewer keeps the neighboring railway crossing and approach viaducts as independent features.
