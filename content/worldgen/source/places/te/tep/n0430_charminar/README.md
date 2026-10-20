# Charminar

![Molen preview](preview.png)

Individual medium-fi Charminar exterior:four cream-stucco minarets with stacked open galleries/corbels/bulb caps,deep four-way pointed crossing arches,open upper facade gallery/four clock faces,closed small lower fields and clerestory,sparse parapet lattice/balcony bracket rhythm and western roof cupola. Four existing shared256² graphs,five merged groups,four browser levels. Exact current controls and conflicting height/dimension facts remain distinct. Unseen roofs,interiors,precise terrace/street joins,current finish and engineering omitted or unverified.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Charminar_(Four_Minarets).jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Charminar_in_Hyderabad,_Telangana,_India,_photographed_on_9_July_2026_01.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Charminar_-_Distant_view_of_the_main_facade_framed_by_bustling_historic_market_streets.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Charminar-front.jpg)

Four existing shared256² lime-plaster,limestone,sandstone and cast-bronze graphs;five merged groups. Pale stucco/wall,cream trim,sandstone paving/roof and sparse bronze finials;glass local. Metric UVs/linear tints,no embedded images,baked lighting,weathering or copied stucco art.

## Model and axes

52,109 triangles; 156,327 vertices; 5 material groups; 6,256,392 bytes. Native bounds: -14.828, -1.011, -15.043 to 15.228, 53.276, 14.665. Source hash: `sha256:6749aadddd555a2fb7e5f8f138ec5deef2a9c47cc49473e4689489d96c08bb26`.

{"x":"approximately ESE market facade,opposite WNW mosque/cupola","y":"up","z":"approximately SSW,opposite NNE"}

Standard viewer DEM datum507.946465m;outer perimeter-0.66..0.01m relative to anchor. Working floor0.276m is maximum bilinear sample across the lower footprint at1m spacing plus0.25m;not surveyed pavement. Raw DEM retained without cutout/flattening;foundations extend below it and crossY=0. Paving is restricted to the monument footprint. Through arches remain exterior voids;exact street/threshold/terrain joins,walking and absolute altitude unverified. Surrounding roads/market buildings remain host content.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0430` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact way/238186115 /Q1771696 matches current PMTiles lower building part35184610274947 (2^45+238186115). Earlier retained curved outer outline and current27-point lower outline are preserved separately. Seven current building/part controls locate lower structure,four minarets and the24–25m/25–29m upper plates. Anchor[78.47463907,17.361600401] and heading−0.187322426164rad unchanged. Native+X approximately east-southeast eastern market/clock facade,−X west-northwest mosque/cupola side;+Z south-southwest/opposite north-northeast. Four arch passages cross beneath the gallery. Native axes follow the mapped facades rather than exact cardinal directions. Four tower centers retain mapped footprints;other openings/gallery subdivision/roof cupola are picture-led estimates within about1.5m/facing about3°. Nearby market buildings,roads and public realm remain host content.
- Retained facts give48.7m height and20m nominal width/length;current map gives19m lower base,minaret parts min_height19m/height53m,and upper parts24–25m/25–29m. Preserve the4.3m height disagreement and nominal20m core dimension separately from current~28.46×28.05m overall tower footprint;no rescale to force agreement. Working model uses mapped53m tower tips and19m lower structure;large crossing vault apex17.3m,first open facade gallery19.4–24m,upper closed clerestory25–28.4m and parapet29–30.1m. Twin lower minaret galleries19.5–24.4m,higher galleries34.5–37.1m and44–46.7m,drums46.7–49.1m,caps49.1–52.2m/finials53m;western roof cupola30.1–37m. All untagged levels,profiles,clock/opening/bracket sizes,roof divisions and gallery layouts are picture estimates,not surveys. Current finish and enclosed interiors remain unverified.
- Standard viewer DEM datum507.946465m;outer perimeter-0.66..0.01m relative to anchor. Working floor0.276m is maximum bilinear sample across the lower footprint at1m spacing plus0.25m;not surveyed pavement. Raw DEM retained without cutout/flattening;foundations extend below it and crossY=0. Paving is restricted to the monument footprint. Through arches remain exterior voids;exact street/threshold/terrain joins,walking and absolute altitude unverified. Surrounding roads/market buildings remain host content.
- Individual medium-fi exterior from four inspected2012/2013/2026 photographs. Four crossing arches,stacked minaret galleries/caps,open first facade gallery,closed clerestory/side fields,four clock faces,sparse brackets/parapet lattice and western roof cupola. Skyline uses solid minaret balcony bands and closed gallery proxies;district opens galleries with coarse rectangular minaret slots;street/close add pointed arches and selected trim. Fine stucco rosettes/lattice,interior stairs/mosque rooms,precise upper terrace plans,current finish/fixture state,threshold/street joins and engineering omitted or unverified. The48.7m retained fact differs from current53m mapped minaret height;working model follows current map without erasing the conflict. No full enclosed-interior/free walking claim. City market/roads/wires/signs/vehicles remain host content. Physical-device timing unmeasured.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
