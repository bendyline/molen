# Al-Askari Shrine

![Molen preview](preview.png)

Individual medium-fi Al-Askari historic shrine core:raw mapped main outline,12m flat-roofed body,gold bulb dome on blue drum,twin gold single-balcony minarets,open marble portico and tall blue-bordered pointed golden iwan. Surrounding expansion,courtyard structures and other shrine buildings remain host content. Picture-proportioned dome differs from an unresolved68m map part tag;all vertical subdivisions and fine details are estimates. Shared materials,four browser LODs,no unique tile art or furnished interior.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:%D8%B6%D8%B1%D9%8A%D8%AD_%D8%A7%D9%84%D8%A7%D9%85%D8%A7%D9%85%D9%8A%D9%86_%D8%A7%D9%84%D8%B9%D8%B3%D9%83%D8%B1%D9%8A%D9%8A%D9%86.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Golden_Dome_and_Two_Minarets_of_Al-Askari_Shrine_-_Jan_3,_2021_01.jpg)

Six existing shared256² sandstone,marble,cast-bronze,mosaic,lime-plaster and wood graphs serve seven merged roles. Metric UVs,linear tints,no embedded images or unique facade art. Gold leaf uses a warm tint on shared neutral cast bronze. Simple nested facets abstract the gilded iwan;fine tile/calligraphy and temporary construction are omitted.

## Model and axes

9,445 triangles; 28,335 vertices; 7 material groups; 1,137,620 bytes. Native bounds: -28.398, -1.805, -27.644 to 28.334, 35.666, 27.692. Source hash: `sha256:b5f3de6d622267dcf794b8659e7e015e4d769d7fd9cdadbb4d462ddde1b70626`.

{"x":"ENE across shrine","y":"up","z":"SSE marble portico and forecourt"}

Normal viewer DEM datum83.47183983893558m;floor-0.33405444613394764m is median of118 outside-perimeter samples every2m at1m offset plus0.25m. 719 raw footprint samples range-1.4503527652346406..1.0631131244933698m. Preview terrain seats the footprint and1.5m margin;the source footing follows the retained perimeter. Exact marble paving,steps,thresholds,roof reconstruction,current construction state and host terrain joins remain unverified.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=al_askari_shrine` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact way1188251537/Q309484 is current viewer building35185560340369. Its12 raw outline vertices and12m body height,original anchor and heading remain unchanged. Current building parts locate the central dome and two front minarets. PositiveX ENE across the shrine;positiveZ SSE toward the projecting marble portico and forecourt. The northern expansion,other domes,galleries and city remain separate host buildings. Current tile properties omit the QID;retained exact identity supplies the binding.
- Mapped body height12m is retained. Current minaret parts carry36m and their tips use36m above the review floor. The dome part carries68m;this conflicts with picture-proportioned heights of the bulb and twin minarets and is retained as an unresolved map-height claim,not silently treated as a measured dome. This visualization estimates a12–17m blue drum,17–33m gold bulb and2.5m finial,35.5m overall;all subdivisions and dome height remain estimates requiring better map/reference reconciliation. Portico frame18m,canopy roof12m,window/door rhythm and gilded recess profiles are picture estimates. Temporary construction scaffolds,light strings,banners,fine tile/calligraphy and unseen interiors are omitted.
- Normal viewer DEM datum83.47183983893558m;floor-0.33405444613394764m is median of118 outside-perimeter samples every2m at1m offset plus0.25m. 719 raw footprint samples range-1.4503527652346406..1.0631131244933698m. Preview terrain seats the footprint and1.5m margin;the source footing follows the retained perimeter. Exact marble paving,steps,thresholds,roof reconstruction,current construction state and host terrain joins remain unverified.
- Individual core only. Rear expansion,other domes and surrounding court buildings remain host content. Main mapped12m body and36m minaret heights retained;68m dome tag remains unresolved and is not represented as a surveyed height. Visualized dome35.5m is a picture estimate. No fine artwork,current construction-phase fidelity,furnished interiors,exact thresholds or engineering claim. Physical-device timings pending.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
