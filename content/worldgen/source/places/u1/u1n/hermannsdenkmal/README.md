# Hermannsdenkmal

![Lit Molen preview](preview.png)

The ten-pier Osning sandstone monument with open round arcade, circular viewing gallery, masonry cupola and a fully modeled copper Arminius: winged helmet, folded cape, raised sword, bent leg, long shield and broken Roman standards.

## Identity and geometry

Catalog hermannsdenkmal, [Q664245](https://www.wikidata.org/wiki/Q664245). The operator publishes the complete vertical dimension chain and a historical construction elevation/plan. Concentric mapped foundation, arcade and cupola outlines constrain their diameters. Current operator photographs determine statue pose, folded clothing, winged helmet, shield and sandstone/copper colors; the western facing is explicitly described by the regional cultural authority.

Center of the mapped circular ground plinth, Y=0 at the lower sandstone foundation. +Z faces west, as the statue and raised sword do in the published regional account; +Y is up. The geographic proposal identifies its anchor and orientation evidence separately from remaining terrain and azimuth uncertainty.

Source facts and measured references are recorded in spec.json. References: [1](https://www.hermannsdenkmal.de/wissenswertes/zahlen-und-fakten/), [2](https://www.hermannsdenkmal.de/wp-content/uploads/sites/4/2023/04/Flyer-HD-Fremdsprachen-2023.pdf), [3](https://www.hermannsdenkmal.de/wp-content/uploads/sites/4/2017/05/hermannsdenkmal_historie_skizze.jpg), [4](https://www.westfalen-regional.de/de/hermann_externsteine/), [5](https://www.openstreetmap.org/way/207366382). Reference pages and images are not redistributed.

## Original source and shared materials

Geometry is authored in `packages/worldgen/scripts/final-heritage-tower-models.mjs`. Shared material graphs with metric repeat UV0 and original vertex tints; GLB PBR fallback remains self-contained. No per-model texture duplication. No third-party mesh or photograph is embedded.

49,504 triangles; 102,892 vertices; 2 material groups; 4,300,164 source bytes. Source hash: `sha256:264f7e08afb2495462a08c8d7bb6f2f2a0a13839fc52ebd50867554b39815323`. Geometry validation checks finite Float32 coordinates, indices, triangle area and winding before export.

Regenerate with `node packages/worldgen/scripts/generate-heritage-towers.mjs hermannsdenkmal`; add `--check` for reproducibility. The generator refuses to overwrite a master whose hash differs from source.json. Import uses `--no-optimize` to preserve facade recesses.

## Remaining detail and review

- The statue preserves the published height and standing pose. The sculpted face, clothing folds, inscriptions, capitals and fittings use original polygonal approximations.
- The staircase follows the aerial photographs and its mapped paths. Stair counts, base grading and hidden construction are interpreted from standard viewer terrain.

Named near/far cameras are included for lit visual review. A valid export is not maximum-fidelity certification.
