# Pivnichnyi Bridge — unfinished authoring draft

Work was stopped at the user's request to close the current creation round.

**No source GLB, runtime asset, placement approval or visual approval exists for this draft. It does not count as an authored or completed candidate.**

Preserved work:

- `map-frame.json` and `mapped-features.json`: current OpenStreetMap road extent, directed axis and tower-leg location.
- `packages/worldgen/scripts/pivnichnyi-bridge-model.mjs`: draft original mesh authoring code, excluded from the production bridge generator until validation and review are complete.
- Research artifacts in `.artifacts/pivnichnyi-research`: primary2018/2020 engineering publications, public photograph review screenshots and map request. These are working evidence, not an asset dependency.

## Findings to carry forward

The [Ukrainian steel-construction institute's2018 paper](https://urdisc.com.ua/media/21-22%272018.pdf), pages20–22/figure18, specifies eight structural spans, west to east:42+63+63+63+63.65+63.65+300+84.51=742.81m. The mapped deck includes additional approaches, totaling789.95m; the816m nominal total is a separate extent. The [2020 monograph](https://urdisc.com.ua/media/Shymanovsky_Narisi_pozaklasnih_mostiv_2020.pdf), section1.9, repeats the structural account.

Distinctive geometry includes six9m circularly pierced wall piers, two steel box girders, one open A pylon, three cable tiers in two planes, individual rope bundles, eight lanes, crescent light arms, trolley wires and narrow sidewalks. The paper places the A opening's crown53m above the road. The city's119m pylon height and the institute's125m height conflict and require datum/scope reconciliation. Provisional native heights are not geographic evidence.

Direct2019 photographs show the stripped summit shield rim and exposed mounting frame. The complete historical copper emblem is unsuitable for the current model. The district's [2020 notice](https://desn.kyivcity.gov.ua/news/pivnichniy-mist-otrimav-imennu-tablichku) documents replacement bridge-name plates. A photograph uploaded under a2025 filename was actually taken in2021; retain EXIF/description dates when choosing references. The separate Desenka bridge appears in some category photographs and must not be confused with this crossing.

## Before promotion

1. Validate the draft mesh, including winding, concave extrusion caps, cable galleries and thin members after Float32 conversion.
2. Reconcile pylon elevations and both road approaches with independent terrain data.
3. Generate and import through the standard pipeline, then inspect every portable and shared-material capture.
4. Add reviewed metadata and current-hash QA; only then add the study to the production bridge generator.
