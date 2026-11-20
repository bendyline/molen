# 2 World Trade Center

This is a model of the announced 2026 Foster + Partners design for 200 Greenwich Street.
The design establishes a height of 1,226 feet, a glazed lobby, tiered silver curtain walls,
outdoor terraces and six corner gardens. The proposal is under construction and the project
team expects to open in 2031.

The mapped ground envelope, Church Street and Fulton Street sign the model's +X and +Z axes.
The base retains the mapped shape. Upper setbacks, vertical break points, window rhythm
and planting are reconstructed from the published views. The model uses shared Molen glazing,
stainless steel, limestone and concrete surfaces. In World Explorer with New York PMTiles and
terrain, add `?proposal=2.world.trade.center` to view the announced design at 200 Greenwich Street.
An Earth host can pass `structureProposal: '2.world.trade.center'` when mounting. [Placement review](placement-report.json)

World Explorer’s default view uses the [October 31, 2026 construction snapshot](../2_world_trade_center_construction_2026_10_31/README.md)
at this site. Dates from October 6–30 use the [earlier phase](../2_world_trade_center_construction_2026/README.md).

- [Developer design renderings and dimensions](https://wtc.com/developments/2-world-trade-center/)
- [Port Authority project overview](https://wtcprod.panynj.gov/en/local/learn-about-wtc/2-world-trade-center.html)
- [Groundbreaking announcement](https://www.governor.ny.gov/news/governor-hochul-celebrates-groundbreaking-new-american-express-global-headquarters-2-world)
- [Site frame and map attribution](site-frame.json)

```powershell
node content/worldgen/source/places/dr/dr5/2_world_trade_center/models/generate-2-world-trade-center.mjs
node packages/worldgen/scripts/import-structure-models.mjs --ids=2_world_trade_center
node packages/tooling/scripts/generate-landmark-lods.mjs --ids=2_world_trade_center
```
