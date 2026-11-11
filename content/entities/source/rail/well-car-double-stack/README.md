# 53 ft double-stack well car

Source bundle for `molen.entities.rail.well_car_double_stack` (double-stack well car), part of the
[rail rolling stock](../../../RAIL.md) family. The name identifies what this polygonal
interpretation depicts; the geometry and livery carry no railroad or manufacturer marks, only
the fictional reporting mark `MLNX` with a plain number (see [NOTICE.md](../../../NOTICE.md)).

- Generator: `node packages/entities/scripts/generate-rail.mjs --ids=well-car-double-stack` (builder
  `well-car` registered in `packages/entities/scripts/rail-models.mjs`; shared parts in
  `rail-geometry.mjs`). It writes `models/source.glb` and `entity.types.json`;
  `models/recipe.json` holds the dimensions and running data.
- Import: `node packages/tooling/dist/cli.mjs asset import content/entities/source/rail/well-car-double-stack/models/source.glb --id molen.entities.rail.well_car_double_stack --project content/entities/project.json --force`
  writes `assets/molen/entities/rail/well_car_double_stack/`.
- Envelope: 22.9 m over coupler faces, 21.8 m body, 3 m wide,
  6.14 m tall; truck centres 19.1 m; 36 in wheels. Authoring targets from
  public specification sheets, rounded; running data is gameplay tuning.
- Identity: Deep side girders that step down into the well between the trucks, container guides at the well corners, and two unbranded 53 ft high-cube containers with corrugated sides, corner castings and rear doors with locking bars (node `load`; materials `container-lower` and `container-upper`).
- Paint: `rail-livery-body` takes `vehicle.color`.
