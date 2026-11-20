# Ìyá Mọòpó

This model represents the principal sculpture in the Sacred Potter Field at Osun-Osogbo
Grove. Three pairs of arms sweep from beneath the upturned head toward the clearing.
Two hornbills and the long trailing forms distinguish the exterior. Susanne Wenger and
Adebisi Akanji designed the sculpture.
The local origin sits below its torso, close to point 17 on the published grove map. The arms face southwest into the clearing and the long wrapper trails southeast.

The editable recipe confines the apron to the photographed paving around the torso. Native ground shows between the trailing forms. The viewer uses shared concrete, weathered stone and clay. The preview pose uses the survey point, overhead imagery and PMTiles road context. Sampled native terrain elevations guide the low trailing forms. The bearing and footprint remain approximate. [Overhead footage](https://www.youtube.com/watch?v=0hYfJeRnrqM&t=175s) · [Terrain and placement review](placement-report.json)

- [Adunni Olorisha Trust and Adunni Osun Foundation photographs](https://artsandculture.google.com/story/rgXhbJXdFehtIA)
- [Measured plan](https://artsandculture.google.com/asset/iya-moopo-the-dimensions/bwGYKYkH6Z55sA?hl=en)
- [CyArk field photograph](https://artsandculture.google.com/asset/iya-moopo-godess-of-women-s-occupations-cyark/SQFlbWzyygDi0w?hl=en)

```powershell
node content/worldgen/source/places/s1/s17/osun_grove_iya_mopo/models/generate-iya-mopo.mjs
node packages/worldgen/scripts/import-structure-models.mjs --ids=osun_grove_iya_mopo
node packages/tooling/scripts/generate-landmark-lods.mjs --ids=osun_grove_iya_mopo
```
