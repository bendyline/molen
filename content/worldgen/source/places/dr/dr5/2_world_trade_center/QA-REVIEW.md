# 2 World Trade Center design review

The proposed exterior reads as a tiered blue-grey glass tower with a silver-finned podium, a tall glazed lobby, alternating planted corner recesses and a three-part crown. The vertical mullion seam remains visible from the memorial-facing side. The upper setbacks, terrace dimensions and glazing details are visual estimates from the developer renderings. [Tower preview](preview.png) · [Corner garden](garden-preview.webp)

The six GLBs passed Khronos validation with zero errors, warnings or embedded images. All four viewer levels retain the six open corner gardens. The first two levels total 280,228 bytes. Shared material resolution and zero geometry remaining after unload were verified. [QA record](qa.json)

The 200 Greenwich Street anchor and heading agree with the mapped project outline and the Church and Fulton Street sides. All four viewer levels were rendered on the retained PMTiles and terrain. Three signed footprint corners matched the mapped placement, and the tower retained its published 373.6848 m height. The design and terrain fit represent the announced scheme. Upper geometry and final pavement grades remain estimates. [Mapped site frame](site-frame.json) · [Placement review](placement-report.json)

Selecting `2.world.trade.center` loads just the design model at the site. The default and dated views load the applicable construction snapshots. In the failed-load trial, the mapped footprint stayed visible. All loaded geometry was released when the tile unloaded. [Developer reference](https://wtc.com/developments/2-world-trade-center/)
