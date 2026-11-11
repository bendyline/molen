# EMD GP38-2

Source bundle for `molen.entities.rail.emd_gp38_2` (four-axle road switcher), part of the
[rail rolling stock](../../../RAIL.md) family. The name identifies what this polygonal
interpretation depicts; the geometry and livery carry no railroad or manufacturer marks, only
the fictional reporting mark `MLN` with a plain number (see [NOTICE.md](../../../NOTICE.md)).

- Generator: `node packages/entities/scripts/generate-rail.mjs --ids=emd-gp38-2` (builder
  `gp38` registered in `packages/entities/scripts/rail-models.mjs`; shared parts in
  `rail-geometry.mjs`). It writes `models/source.glb` and `entity.types.json`;
  `models/recipe.json` holds the dimensions and running data.
- Import: `node packages/tooling/dist/cli.mjs asset import content/entities/source/rail/emd-gp38-2/models/source.glb --id molen.entities.rail.emd_gp38_2 --project content/entities/project.json --force`
  writes `assets/molen/entities/rail/emd_gp38_2/`.
- Envelope: 18.03 m over coupler faces, 17.3 m body, 3.13 m wide,
  4.7 m tall; truck centres 10.36 m; 40 in wheels. Authoring targets from
  public specification sheets, rounded; running data is gameplay tuning.
- Identity: A low short hood with the headlight and number boards on its nose; a standard cab with two front and three side windows per side; the carbody filter intake, dynamic-brake blister with its fan, engine-room doors, exhaust stack and two radiator fans over the rear radiator grilles; Blomberg B trucks; the rear headlight package on the long hood end.
- Paint: `rail-livery-body` takes `vehicle.color`; `rail-livery-stripe` is the second livery colour.
