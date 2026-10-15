# The Ritz Hotel, London

Historic main hotel: open fifteen-axis Piccadilly arcade, stone facades, three mansard pavilions, copper roof ribs, five-bay Green Park end and lower Arlington entrance with canopy.

![Molen preview](preview.png)

Authoring state: **review-in-qa.json**. Current completion evidence is in [qa.json](qa.json) and the [local 100 ledger](../../../../qualla-structures/batches/PROGRESS.md).

- [The Ritz Hotel, London](https://qualla.com/the-ritz-hotel-london/)

Original medium-fi exterior of the historic main Ritz hotel, based on individually inspected local 2015–2017 photographs, original plans/elevations and Purcell 2021 condition survey. Later 22 Arlington extension and William Kent House are excluded.

Dated model scope does not claim to reproduce all current roof/construction changes. No temporary scaffolding, crowds, Christmas decorations or interiors.

Footprint is mapped; vertical dimensions, upper court geometry, rear windows, equipment and fine sculptural profiles are approximations. Main arcade remains open and rear court is not filled to full height.

Original simplified ironwork, stone balustrades and roof ornament; no copied photograph textures, hotel crest or exact lettering.

Independent terrain is unchanged. Deep foundation accommodates the rearward slope; exact contact can differ on another host DEM.

Build: `node packages/worldgen/scripts/generate-authored-places.mjs --ids=ritz_london`. Add `--check` to verify exact regeneration. 54267 triangles; 7 materials; no embedded photographs.
