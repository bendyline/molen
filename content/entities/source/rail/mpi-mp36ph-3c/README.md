# MPI MP36PH-3C

Source bundle for `molen.entities.rail.mpi_mp36ph_3c` (commuter passenger locomotive), part of the
[rail rolling stock](../../../RAIL.md) family. The name identifies what this polygonal
interpretation depicts; the geometry and livery carry no railroad or manufacturer marks, only
the fictional reporting mark `MLN` with a plain number (see [NOTICE.md](../../../NOTICE.md)).

- Generator: `node packages/entities/scripts/generate-rail.mjs --ids=mpi-mp36ph-3c` (builder
  `mp36` registered in `packages/entities/scripts/rail-models.mjs`; shared parts in
  `rail-geometry.mjs`). It writes `models/source.glb` and `entity.types.json`;
  `models/recipe.json` holds the dimensions and running data.
- Import: `node packages/tooling/dist/cli.mjs asset import content/entities/source/rail/mpi-mp36ph-3c/models/source.glb --id molen.entities.rail.mpi_mp36ph_3c --project content/entities/project.json --force`
  writes `assets/molen/entities/rail/mpi_mp36ph_3c/`.
- Envelope: 20.6 m over coupler faces, 19.8 m body, 3.2 m wide,
  4.75 m tall; truck centres 12.5 m; 40 in wheels. Authoring targets from
  public specification sheets, rounded; running data is gameplay tuning.
- Identity: A full-width cowl carbody with a short sloped nose, raked two-pane windscreen and visor number board; side cab doors with steps and grab irons; head-end-power and radiator grilles, upper intake louvres and roof fans; a commuter livery band (rail-livery-stripe) with a pinstripe (rail-livery-accent); Blomberg B trucks.
- Paint: `rail-livery-body` takes `vehicle.color`; `rail-livery-stripe` is the second livery colour.
