# 3-bay 5,161 cu ft covered hopper

Source bundle for `molen.entities.rail.covered_hopper` (covered hopper), part of the
[rail rolling stock](../../../RAIL.md) family. The name identifies what this polygonal
interpretation depicts; the geometry and livery carry no railroad or manufacturer marks, only
the fictional reporting mark `MLNX` with a plain number (see [NOTICE.md](../../../NOTICE.md)).

- Generator: `node packages/entities/scripts/generate-rail.mjs --ids=covered-hopper` (builder
  `covered-hopper` registered in `packages/entities/scripts/rail-models.mjs`; shared parts in
  `rail-geometry.mjs`). It writes `models/source.glb` and `entity.types.json`;
  `models/recipe.json` holds the dimensions and running data.
- Import: `node packages/tooling/dist/cli.mjs asset import content/entities/source/rail/covered-hopper/models/source.glb --id molen.entities.rail.covered_hopper --project content/entities/project.json --force`
  writes `assets/molen/entities/rail/covered_hopper/`.
- Envelope: 18 m over coupler faces, 16.9 m body, 3.2 m wide,
  4.6 m tall; truck centres 13.3 m; 36 in wheels. Authoring targets from
  public specification sheets, rounded; running data is gameplay tuning.
- Identity: Exterior-post side sheets whose lower corners follow the sloped end sheets, three hopper bays converging on outlet gates with capstans, a continuous roof trough hatch with eight covers, end platforms under the slopes with end ladders, and the hand brake on the B end.
- Paint: `rail-livery-body` takes `vehicle.color`.
