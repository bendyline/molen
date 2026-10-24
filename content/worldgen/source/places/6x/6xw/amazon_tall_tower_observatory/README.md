# Amazon Tall Tower Observatory

![Lit Molen preview](preview.png)

Square 3 m research lattice with closed angle-section chords and X braces, visible bolt heads, red/white bands, 1500 grated treads and landings, safety rails, cable trays, 321 m top platform, 331 m lightning rod, six guy levels, external HighStep rails and a detailed stationary RoLi instrument carriage. Shared painted steel, stainless steel and concrete; repeated sections are GPU instances.

## Identity and geometry

Catalog amazon_tall_tower_observatory, [Q18109585](https://www.wikidata.org/wiki/Q18109585). MPI publishes a 3×3 m cross section, 325 m frame, 331 m tip and 1500 steps. The 2025 field report/drawing fixes the 321 m platform; the 2026 RoLi paper fixes the 202-degree lift corner, rail spacing and six guy heights. Bolted angles, stairs, top platform and instruments follow inspected operator photographs. Flange dimensions, paint-band boundaries, individual tread distribution and guy anchor radii are proportional reconstruction requiring further confirmation.

Main mapped tower center; Y0 standard viewer PMTiles working datum.. Native (-X,+Z) shaft corner carries the lift. At heading 23 degrees, that corner faces published azimuth 202 degrees; +Y is up.; +Y is up. The geographic proposal identifies its anchor and orientation evidence separately from remaining terrain and azimuth uncertainty.

Source facts and measured references are recorded in spec.json. References: [1](https://www.mpg.de/9365148/ATTO-Factsheet-Aug2015en.pdf), [2](https://www.bgc-jena.mpg.de/~csierra/blog/2025/02/08/Sampling-Heights/), [3](https://www.bgc-jena.mpg.de/5149255/atto), [4](https://amt.copernicus.org/articles/19/101/2026/amt-19-101-2026.html), [5](https://www.attoproject.org/media/gallery/), [6](https://www.attoproject.org/wp-content/uploads/2019/03/ATTO-Newsletter_2_Mar19.pdf), [7](https://www.openstreetmap.org/node/3215117056). Reference pages and images are not redistributed.

## Original source and shared materials

Geometry is authored in `packages/worldgen/scripts/atto-tower-model.mjs`. Shared material graphs with metric repeat UV0 and original vertex tints; GLB PBR fallback remains self-contained. No per-model texture duplication. No third-party mesh or photograph is embedded.

737,916 triangles; 1,334,976 vertices; 4 material groups; 13,746,540 source bytes. Source hash: `sha256:adb9523540d2773eb0d2b48be67b8d3cea0d24d7e0f0b283d9d5e0de6e91e134`. Geometry validation checks finite Float32 coordinates, indices, triangle area and winding before export.

Regenerate with `node packages/worldgen/scripts/generate-heritage-towers.mjs amazon_tall_tower_observatory`; add `--check` for reproducibility. The generator refuses to overwrite a master whose hash differs from source.json. Import uses `--no-optimize` to preserve facade recesses.

## Remaining detail and review

- Approximate main tall-tower exterior and PMTiles fit from two inspected pictures; no bespoke survey or full compound claim.
- Original detailed master and repeated mesh instances preserved. Independent browser tiers reduce brace/stair/instrument detail by view distance.
- Guy radii75/150/225m and paired topology are interpreted retained controls; new browser blocks and cable endpoints meet one coarse PMTiles field. Exact anchors, sag, restoration details and equipment inventory are approximate.
- Three shared painted-metal/stainless/concrete graphs; zero embedded images. Forest and natural ground remain host content.
- Separate80/81m companion towers and laboratory are outside this main-tower asset; interiors, collision and physical-device timing excluded. Footprint replacement remains off.

Named near/far cameras are included for lit visual review. A valid export is not maximum-fidelity certification.
