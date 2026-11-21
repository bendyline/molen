# Ọ̀ṣun Búsanyìn Shrine

This exterior reconstruction depicts the standing riverside shrine photographed in
2015. The bird-shaped roof rises toward the river, with shallow corrugated wings,
a narrow pointed porch, and a tapered tower behind it. Shaped openings in the concrete
walls and carved timber posts frame a low curved step at the approach. The viewer shows
the reconstructed shrine when the viewing date is in 2015. The 2019 flood severely
damaged the shrine, and its current restoration state remains unverified.

The checked-in recipe rebuilds the master and four viewer levels. Five shared
materials cover the roof, lining, timber, molded concrete and weathered stone. The model
uses interpreted dimensions and opening profiles from the exterior photographs.
The conservation survey and walls visible from above establish where the shrine stood
and how its porch faced the river. The model's width and depth follow the published plan.
The height is estimated from photos. The historical grade uses the viewer terrain datum.
[Placement report](placement-report.json) · [Conservation survey](https://artsandculture.google.com/asset/busanyin-shrine-flood-and-erosion-study-cdr-engineering/RAEgf5BAIoI1FA)

- [2015 photograph](https://artsandculture.google.com/asset/ZgEWgPJKkHDImg)
- [Shrine photographs and restoration history](https://artsandculture.google.com/story/iwUR-yMsjP088g)
- [Conservation report](https://whc.unesco.org/document/224880)

```powershell
node content/worldgen/source/places/s1/s17/osun_grove_busanyin_shrine/models/generate-busanyin.mjs
node packages/worldgen/scripts/import-structure-models.mjs --ids=osun_grove_busanyin_shrine
node packages/tooling/scripts/generate-landmark-lods.mjs --ids=osun_grove_busanyin_shrine
```
