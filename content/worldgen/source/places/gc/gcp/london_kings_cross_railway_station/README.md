# London King's Cross railway station

![Lit Molen preview](preview.png)

Individual twin barrel train sheds, stock-brick clock facade and glazed arches, separately articulated eastern/western ranges, suburban shed and three-circle western concourse shell with funnel and diagrid. Roof ribs and facade bays reuse mesh buffers across glTF nodes.

## Identity and geometry

Catalog london_kings_cross_railway_station, [Q219867](https://www.wikidata.org/wiki/Q219867). The engineering report fixes the 36 m clock tower, 138 m concourse roof diameter and 65 m platform bridge. Train spans and range proportions follow the inspected scaled sections. Roof meridian radii fit the documented three-tangent-circle construction and remain provisional.

Approximate combined station and concourse plan centre, at platform approach ground level. +Z is the southern clock facade; +X is east; +Y is up; +Y is up. The geographic proposal identifies its anchor and orientation evidence separately from remaining terrain and azimuth uncertainty.

Source facts and measured references are recorded in spec.json. References: [1](https://www.arup.com/globalassets/downloads/arup-journal/the-arup-journal-2012-issue-2.pdf), [2](https://historicengland.org.uk/listing/the-list/list-entry/1078328), [3](https://www.networkrail.co.uk/who-we-are/our-history/iconic-infrastructure/the-history-of-london-kings-cross-station/), [4](https://www.openstreetmap.org/way/260720558). Reference pages and images are not redistributed.

## Original source and shared materials

Geometry is authored in `packages/worldgen/scripts/kings-cross-station-model.mjs`. Shared material graphs with metric repeat UV0 and original vertex tints; GLB PBR fallback remains self-contained. No per-model texture duplication. No third-party mesh or photograph is embedded.

540,926 triangles; 1,021,198 vertices; 7 material groups; 10,838,624 source bytes. Source hash: `sha256:243fb45927fe51ccf98c6d1dc18ad7acd1bab563e0010b03cb187f115ccddac5`. Geometry validation checks finite Float32 coordinates, indices, triangle area and winding before export.

Regenerate with `node packages/worldgen/scripts/generate-heritage-towers.mjs london_kings_cross_railway_station`; add `--check` for reproducibility. The generator refuses to overwrite a master whose hash differs from source.json. Import uses `--no-optimize` to preserve facade recesses.

## Remaining detail and review

- Approximate picture/standard PMTiles placement and exterior fit. Bespoke surveys and prior precise member-elevation research holds are superseded by the approved medium-fi scope.
- Detailed original source assembly/hash/recipe preserved; skyline is separately authored and closer levels use bounded reductions.
- The twin roof/clock facade, western concourse/funnel and distinct range/shed volumes carry identity. Clock ticks stand for numerals; facade modules, diagrid pattern, glazing and platforms are interpretations rather than exact restoration inventories.
- Shared procedural textures; no duplicated embedded images. Underground spaces, adjacent hotel/trains and exact station furniture/sign lettering are excluded. Reversible inset floor cutout leaves raw surrounding terrain; footprint replacement off; physical-device timing unmeasured.

Named near/far cameras are included for lit visual review. A valid export is not maximum-fidelity certification.
