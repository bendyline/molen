# 50 ft high-cube boxcar

Source bundle for `molen.entities.rail.boxcar_50ft` (boxcar), part of the
[rail rolling stock](../../../RAIL.md) family. The name identifies what this polygonal
interpretation depicts; the geometry and livery carry no railroad or manufacturer marks, only
the fictional reporting mark `MLNX` with a plain number (see [NOTICE.md](../../../NOTICE.md)).

- Generator: `node packages/entities/scripts/generate-rail.mjs --ids=boxcar-50ft` (builder
  `boxcar` registered in `packages/entities/scripts/rail-models.mjs`; shared parts in
  `rail-geometry.mjs`). It writes `models/source.glb` and `entity.types.json`;
  `models/recipe.json` holds the dimensions and running data.
- Import: `node packages/tooling/dist/cli.mjs asset import content/entities/source/rail/boxcar-50ft/models/source.glb --id molen.entities.rail.boxcar_50ft --project content/entities/project.json --force`
  writes `assets/molen/entities/rail/boxcar_50ft/`.
- Envelope: 17.3 m over coupler faces, 16.2 m body, 3.25 m wide,
  5.18 m tall; truck centres 12.4 m; 36 in wheels. Authoring targets from
  public specification sheets, rounded; running data is gameplay tuning.
- Identity: A single 10 ft plug door with operating pipes and locking bars, exterior posts, corrugated ends, a peaked roof with panel seams, side and end ladders, and a high-mounted hand brake on the B (rear) end.
- Paint: `rail-livery-body` takes `vehicle.color`.
