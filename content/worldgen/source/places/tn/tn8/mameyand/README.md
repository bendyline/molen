# Mameyand Bridge

![Mameyand Bridge rendered with Molen's shared brick and stone materials](shared-preview.png)

The model follows the approximately 23 m bridge near Mameyand, Iran. It has three open pointed vaults, two pale ashlar piers, four tapered marker towers, and a humped, stone-paved deck. The photo-based arch stations, tower courses, and ramp slopes are approximate. [Reference photograph](https://commons.wikimedia.org/wiki/File:%D9%85%D9%85%DB%8C%D9%86%D8%AF.jpg) · [Published dimensions](https://www.gunaz.tv/fa/post/57729)

The November 11, 2026 Protomaps PMTiles show the Gadar River and the village approaches. The inspected level-15 tiles supply no road crossing or bridge record in the search area. Live placement remains pending confirmation of the actual crossing, heading, and abutment elevations. [Reference and map notes](reference-observations.json)

Rebuild and import the detailed original and four authored detail levels from the repository root.

```sh
node packages/worldgen/scripts/generate-mameyand-bridge.mjs --ids=mameyand
node packages/worldgen/scripts/import-structure-models.mjs --ids=mameyand
node packages/tooling/scripts/generate-landmark-lods.mjs --ids=mameyand
```

The six generated GLBs passed geometry and Khronos glTF checks. The four detail levels preserve the three openings, four towers, and deck slope. The skyline and district downloads total 111,256 bytes. The 39 reviewed frames use isolated fixtures. [Review](qa.json)
