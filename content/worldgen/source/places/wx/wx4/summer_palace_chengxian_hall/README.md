# Summer Palace · Hall of Freshness and Clarity

Chengxian Hall (澄鮮堂) sits beside the pond in the Garden of Farming and Weaving. The model follows the photographed red timber frame, green lattice windows, dark plaque with gold characters, and grey ceramic roof. The open center bay frames the round opening in the rear wall. The unphotographed exterior and overall dimensions are estimates. [Park guide](https://summerpalace.net.cn/guide_map.html) · [Visitor photographs](https://www.sohu.com/a/495036451_100157110)

The roof, wood, brick, stone, plaster and window surfaces reuse Worldgen material graphs. The plaque lettering is geometry. The hall streams on the pond’s east bank with its front facing west-southwest. Two nearby mapped pavilions align the aerial view, and the modeled plinth and steps fit the sloping bank. The footprint and absolute coordinates are approximate. [Placement review](placement-report.json)

The first two detail levels total 77,972 bytes. Six GLBs passed Khronos validation. All four levels keep the footings in the terrain and the paving above it. The viewer released all model geometry on unload. [Site preview](site-preview.png) · [Review](qa.json)

Rebuild the master and viewer detail levels from the repository root.

```powershell
node content/worldgen/source/places/wx/wx4/summer_palace_chengxian_hall/models/generate-chengxian-hall.mjs
node packages/worldgen/scripts/import-structure-models.mjs --ids=summer_palace_chengxian_hall
node packages/tooling/scripts/generate-landmark-lods.mjs --one=content/worldgen/assets/places/wx/wx4/summer_palace_chengxian_hall/asset.json
```
