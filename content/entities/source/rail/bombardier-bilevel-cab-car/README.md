# Bombardier BiLevel Cab Car

Source bundle for `molen.entities.rail.bombardier_bilevel_cab_car` (bi-level commuter cab car), part of the
[rail rolling stock](../../../RAIL.md) family. The name identifies what this polygonal
interpretation depicts; the geometry and livery carry no railroad or manufacturer marks, only
the fictional reporting mark `MLNX` with a plain number (see [NOTICE.md](../../../NOTICE.md)).

- Generator: `node packages/entities/scripts/generate-rail.mjs --ids=bombardier-bilevel-cab-car` (builder
  `bilevel` registered in `packages/entities/scripts/rail-models.mjs`; shared parts in
  `rail-geometry.mjs`). It writes `models/source.glb` and `entity.types.json`;
  `models/recipe.json` holds the dimensions and running data.
- Import: `node packages/tooling/dist/cli.mjs asset import content/entities/source/rail/bombardier-bilevel-cab-car/models/source.glb --id molen.entities.rail.bombardier_bilevel_cab_car --project content/entities/project.json --force`
  writes `assets/molen/entities/rail/bombardier_bilevel_cab_car/`.
- Envelope: 25.91 m over coupler faces, 25.3 m body, 2.97 m wide,
  4.84 m tall; truck centres 18.3 m; 36 in wheels. Authoring targets from
  public specification sheets, rounded; running data is gameplay tuning.
- Identity: The BiLevel coach with an operating cab at the front end: windscreen, headlights and ditch lights, number board, horn, end railings, and a driver desk with live throttle and brake handles beside the first vestibule.
- Paint: `rail-livery-body` takes `vehicle.color`; `rail-livery-stripe` is the second livery colour.
