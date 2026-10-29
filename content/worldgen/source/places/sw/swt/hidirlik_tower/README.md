# Hıdırlık Tower

![Lit Molen preview](preview.png)

Antalya’s Roman monumental tower: measured square podium and broad circular drum in individual warm ashlar courses, moulded Roman cornices and modillions, northeast Ionic entrance with twelve fasces reliefs, blocked northwest doorway, rooftop pedestal and asymmetric surviving crenellations with southern defensive infill. Current national flag and stone terrace complete the exterior.

## Identity and geometry

Catalog hidirlik_tower, [Q218118](https://www.wikidata.org/wiki/Q218118). The municipal festival identifies a17.20×17.30 m podium. The Istanbul University thesis p84 (PDF105), citing Şebnem Alp’s2005 measured study, records the15.80 m drum diameter and1.55×2.05 m northeast entrance. The ambiguous7.95/7.97 m tourism figure is not used as a drum diameter. Published approximate14 m height, current2026 TRT photographs and geolocated first-hand2011/2014 photographs constrain the split between podium, drum and parapets. Individual stone lengths and eroded profiles are original proportional reconstructions; the southern infill and northern crenellations preserve the surviving asymmetry.

Center of the square podium, Y=0 at the exposed bottom plinth. Native +Z northeast toward the main Ionic doorway; +X northwest along the front facade; +Y is up. The geographic proposal identifies its anchor and orientation evidence separately from remaining terrain and azimuth uncertainty.

Source facts and measured references are recorded in spec.json. References: [1](https://www.kaleicioldtown.com/tr/tarihi-yerler/hidirlik-kulesi/4), [2](https://nek.istanbul.edu.tr/ekos/TEZ/47362.pdf), [3](https://www.antalya.bel.tr/tr/kaleici), [4](https://www.antalyaekspres.com.tr/hidirlik-kulesine-girdik), [5](https://commons.wikimedia.org/wiki/File:Antalya_H%C4%B1d%C4%B1rl%C4%B1k_Tower_in_2011_01.jpg), [6](https://commons.wikimedia.org/wiki/File:Antalya_H%C4%B1d%C4%B1rl%C4%B1k_Tower_in_2011_02.jpg), [7](https://commons.wikimedia.org/wiki/File:Antalya_H%C4%B1d%C4%B1rl%C4%B1k_Tower_in_2011_03.jpg), [8](https://commons.wikimedia.org/wiki/File:H%C4%B1d%C4%B1rl%C4%B1k_Tower_01.jpg), [9](https://www.trthaber.com/foto-galeri/antalyanin-yeni-bulusma-ve-toplanma-noktasi-hidirlik-kulesi/77988.html), [10](https://www.openstreetmap.org/way/110321832). Reference pages and images are not redistributed.

## Original source and shared materials

Geometry is authored in `packages/worldgen/scripts/hidirlik-tower-model.mjs`. Shared material graphs with metric repeat UV0 and original vertex tints; GLB PBR fallback remains self-contained. No per-model texture duplication. No third-party mesh or photograph is embedded.

77,044 triangles; 153,464 vertices; 4 material groups; 6,451,944 source bytes. Source hash: `sha256:11be190e693c630ea30f2d6485d6a89706be4a0a670bbb96f5af84c2a369edad`. Geometry validation checks finite Float32 coordinates, indices, triangle area and winding before export.

Regenerate with `node packages/worldgen/scripts/generate-heritage-towers.mjs hidirlik_tower`; add `--check` for reproducibility. The generator refuses to overwrite a master whose hash differs from source.json. Import uses `--no-optimize` to preserve facade recesses.

## Remaining detail and review

- Podium, drum and entrance use retained dimensional controls and exact mapped frame. Intermediate heights, courses, relief and erosion remain proportional reconstruction. Architectural height is approximately14m; the separate current flagpole reaches17.2m.
- Ground contact is the exposed plinth. Surrounding archaeological terrace, coastal cliff, excavated walls and contemporary glass decks remain host terrain/map features. The synthetic placement overlay does not verify native terrain clearance.
- Detailed source masters are preserved. Browser ashlar and tiny fittings aggregate with distance; the vector national flag retains the crescent and star on both sides. Vegetation, exact weathering, interiors and transient equipment are excluded. Physical-device timings remain pending.

Named near/far cameras are included for lit visual review. A valid export is not maximum-fidelity certification.
