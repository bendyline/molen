# Chameleon Gate at Ẹbu Ìyá Mọòpó

This model depicts the gateway to the Sacred Potter Field at Ọ̀ṣun–Òṣogbo. The sculpted arch has an open passage, asymmetrical roots, hollow recesses and a tall tapering tail. The adjoining walls include clay flower bowls and a perforated upright. The recipe uses two shared materials with vertex color for earth tones and moss. Dimensions and details are interpreted from photographs. [Trust photographs](https://artsandculture.google.com/story/rgXhbJXdFehtIA) · [2024 entrance photograph](https://commons.wikimedia.org/wiki/File:Osun-Osogbo_Sacred_Grove_Camelon_entrance.jpg)

The piers flare into the ground. Three nearer detail levels show the projecting lips and recesses at different heights on the two faces. The skyline tier retains the flared silhouette. [Visual and geometry review](QA-REVIEW.md)

The gate now faces the mapped access road at about 93° true. Its approach is visible through the arch in the 2013 geotagged photograph. The setback and bearing are approximate. Extended foundations sit on the sampled terrain, with all entrance steps exposed. [Geotagged photograph](https://www.flickr.com/photos/jbdodane/10688988383/) · [Placement review](placement-report.json)

```powershell
node content/worldgen/source/places/s1/s17/osun_grove_chameleon_gate/models/generate-chameleon-gate.mjs
node packages/worldgen/scripts/import-structure-models.mjs --ids=osun_grove_chameleon_gate
node packages/tooling/scripts/generate-landmark-lods.mjs --ids=osun_grove_chameleon_gate
```
