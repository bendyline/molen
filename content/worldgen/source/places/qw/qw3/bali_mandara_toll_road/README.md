# Bali Mandara Toll Road

The eleven sections cover the named elevated carriageways, motorcycle lanes and elevated links across Benoa Bay. Each section has independent world coordinates and four runtime levels.

Rebuild the detailed sources with `node packages/worldgen/scripts/generate-bali-mandara.mjs`. The source uses the shared board-formed concrete, plain concrete and painted steel graphs.

The road lines come from Protomaps PMTiles. Deck heights and pile spacing are visual estimates from reference photographs, with shoreline elevations sampled directly from Terrarium. The airport section passes the deck heights to the connected approach roads so the four lanes meet the generated pavement.

The World Viewer loads sections by geographic extent. All eleven skyline and district models total 1.84 MB before transfer compression. The viewer uses the same three material graphs for every section.

[Viewer preview](site-preview.png) · [Placement and road fit](native-fit-report.json)

[Interchange photograph](https://tirto.id/tol-bali-mandara-8VV)
