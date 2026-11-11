# 73 ft centerbeam flatcar

Source bundle for `molen.entities.rail.centerbeam_flatcar` (centerbeam flatcar), part of the
[rail rolling stock](../../../RAIL.md) family. The name identifies what this polygonal
interpretation depicts; the geometry and livery carry no railroad or manufacturer marks, only
the fictional reporting mark `MLNX` with a plain number (see [NOTICE.md](../../../NOTICE.md)).

- Generator: `node packages/entities/scripts/generate-rail.mjs --ids=centerbeam-flatcar` (builder
  `centerbeam` registered in `packages/entities/scripts/rail-models.mjs`; shared parts in
  `rail-geometry.mjs`). It writes `models/source.glb` and `entity.types.json`;
  `models/recipe.json` holds the dimensions and running data.
- Import: `node packages/tooling/dist/cli.mjs asset import content/entities/source/rail/centerbeam-flatcar/models/source.glb --id molen.entities.rail.centerbeam_flatcar --project content/entities/project.json --force`
  writes `assets/molen/entities/rail/centerbeam_flatcar/`.
- Envelope: 23.3 m over coupler faces, 22.4 m body, 3.2 m wide,
  4.6 m tall; truck centres 18.6 m; 36 in wheels. Authoring targets from
  public specification sheets, rounded; running data is gameplay tuning.
- Identity: An open lattice centre partition between end bulkheads over a fishbelly centre sill, cross bunks sloping toward the beam, and five tiers of wrapped lumber bundles each side strapped to side-sill winches (node `load`, materials `load-lumber-wrap` and `load-lumber`).
- Paint: `rail-livery-body` takes `vehicle.color`.
