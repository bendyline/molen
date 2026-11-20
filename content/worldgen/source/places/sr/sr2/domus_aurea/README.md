# Domus Aurea

This model represents the public visitor circuit beneath the Oppian Hill in Rome. The western retaining wall and 2024 entrance meet the park path. Visitors descend the steel stair into Gallery XXIV, pass four painted rooms, and turn past the northern passage and the pentagonal court on the way to the Octagonal Hall. The hall retains its eight lintelled sides, shaped vault, circular oculus and five radial chambers. [Plan and photograph observations](reference-observations.json)

The interior follows the archaeological park's plan. The model uses the photographed western doorway and the matching curved wall in PMTiles. Scoped terrain grades leave the route covered and the stair opening clear. Some heights, wall finishes, and minor openings are approximated. [Model review](QA-REVIEW.md) · [Viewer preview](route-preview.png)

Run `node content/worldgen/source/places/sr/sr2/domus_aurea/models/generate-domus-aurea.mjs` to build the master from source. Add `--check` to verify its bytes. Run the standard model import and detail-level generator with `--ids=domus_aurea` to produce the four viewer tiers.
