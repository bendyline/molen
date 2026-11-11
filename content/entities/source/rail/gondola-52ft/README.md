# 52 ft mill gondola

Source bundle for `molen.entities.rail.gondola_52ft` (gondola), part of the
[rail rolling stock](../../../RAIL.md) family. The name identifies what this polygonal
interpretation depicts; the geometry and livery carry no railroad or manufacturer marks, only
the fictional reporting mark `MLNX` with a plain number (see [NOTICE.md](../../../NOTICE.md)).

- Generator: `node packages/entities/scripts/generate-rail.mjs --ids=gondola-52ft` (builder
  `gondola` registered in `packages/entities/scripts/rail-models.mjs`; shared parts in
  `rail-geometry.mjs`). It writes `models/source.glb` and `entity.types.json`;
  `models/recipe.json` holds the dimensions and running data.
- Import: `node packages/tooling/dist/cli.mjs asset import content/entities/source/rail/gondola-52ft/models/source.glb --id molen.entities.rail.gondola_52ft --project content/entities/project.json --force`
  writes `assets/molen/entities/rail/gondola_52ft/`.
- Envelope: 17 m over coupler faces, 16 m body, 3.2 m wide,
  2.6 m tall; truck centres 12.7 m; 36 in wheels. Authoring targets from
  public specification sheets, rounded; running data is gameplay tuning.
- Identity: Exterior-post sides with a top chord, fixed ends with horizontal ribs, a steel floor, short corner ladders, and a heaped scrap load (node `load`, materials `load-scrap` and `load-scrap-steel`) that a host can hide.
- Paint: `rail-livery-body` takes `vehicle.color`.
