# 2 World Trade Center construction · October 2026

The site model records the construction layout in the aerial dated October 6, 2026. It includes the open concrete core, plywood access decks, scaffold frames, lattice crane, ventilation equipment and temporary hoarding. The model uses Molen’s shared construction surfaces and adds no embedded images. [Dated aerial](https://www.reddit.com/r/skyscrapers/comments/1xpoai5/2_world_trade_center_octoberearly_november/) · [Port Authority timeline](https://www.explorewtc.com/en/local/learn-about-wtc/t2-construction.html)

Church, Fulton, Greenwich and Vesey streets fix the signed map frame. Above-ground details are photo estimates. The separate [finished-tower design](../2_world_trade_center/README.md) represents the announced project.

World Explorer uses this snapshot for October 6–30, 2026. The [October 31 snapshot](../2_world_trade_center_construction_2026_10_31/README.md) follows it in the dated view and is the latest modeled phase in the default view. Once the construction model loads, it replaces the planned tower encoded in the map tiles.

```powershell
node content/worldgen/source/places/dr/dr5/2_world_trade_center_construction_2026/models/generate-construction.mjs
node packages/worldgen/scripts/import-structure-models.mjs --ids=2_world_trade_center_construction_2026
node packages/tooling/scripts/generate-landmark-lods.mjs --ids=2_world_trade_center_construction_2026
```
