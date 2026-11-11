# DOT-117 tank car

Source bundle for `molen.entities.rail.tank_car_dot117` (tank car), part of the
[rail rolling stock](../../../RAIL.md) family. The name identifies what this polygonal
interpretation depicts; the geometry and livery carry no railroad or manufacturer marks, only
the fictional reporting mark `MLNX` with a plain number (see [NOTICE.md](../../../NOTICE.md)).

- Generator: `node packages/entities/scripts/generate-rail.mjs --ids=tank-car-dot117` (builder
  `tank-car` registered in `packages/entities/scripts/rail-models.mjs`; shared parts in
  `rail-geometry.mjs`). It writes `models/source.glb` and `entity.types.json`;
  `models/recipe.json` holds the dimensions and running data.
- Import: `node packages/tooling/dist/cli.mjs asset import content/entities/source/rail/tank-car-dot117/models/source.glb --id molen.entities.rail.tank_car_dot117 --project content/entities/project.json --force`
  writes `assets/molen/entities/rail/tank_car_dot117/`.
- Envelope: 18.1 m over coupler faces, 17 m body, 3.2 m wide,
  4.6 m tall; truck centres 13.4 m; 36 in wheels. Authoring targets from
  public specification sheets, rounded; running data is gameplay tuning.
- Identity: A sloped-bottom jacketed shell with 2:1 heads under integral full-height head shields, girth seams, the top fittings protective housing on an operating platform, centre ladders curving over the shell, end platforms with low railings, a bottom outlet valve with its skid, placard holders and shell-conforming lettering.
- Paint: `rail-livery-body` takes `vehicle.color`.
