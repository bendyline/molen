# Fallingwater

Crossed buff concrete cantilevers, stratified sandstone core, red window frames and hanging stream stair above Bear Run, with an uphill guest wing and covered curved connection.

![Molen preview](preview.png)

Authoring state: **review-in-qa.json**. Current completion evidence is in [qa.json](qa.json) and the [local 100 ledger](../../../../qualla-structures/batches/PROGRESS.md).

- [Fallingwater](https://qualla.com/fallingwater/)

Original medium-fi exterior based on two inspected Qualla originals, supplementary local layout images and generalized main-house/covered-walk/guest-wing map controls; not a measured architectural survey.

Crossing terrace axes, stone core, red glazing, hanging stair and clear underside are modeled. Exact room plans, hidden facades, guest-wing openings, structural repairs and roof drains are simplified interpretations.

The short static stream, cascade and rock ledges illustrate the house-waterfall relationship. They are not a hydrologic simulation, exact geological reconstruction or current water-level claim. Surrounding terrain is preserved rather than flattened.

Covered connection and guest wing follow mapped outlines at approximate relative elevations. Coarse terrain is not a surveyed floor datum; other host elevation datasets may require new placement review.

No interior furnishings, sculpture replica, surrounding forest or external image textures are included. Local reference photography remains outside runtime packs.

Build: `node packages/worldgen/scripts/generate-authored-places.mjs --ids=fallingwater`. Add `--check` to verify exact regeneration. 8096 triangles; 4 materials; no embedded photographs.
