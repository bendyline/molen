# 89 ft enclosed bi-level autorack

Source bundle for `molen.entities.rail.autorack_enclosed` (autorack), part of the
[rail rolling stock](../../../RAIL.md) family. The name identifies what this polygonal
interpretation depicts; the geometry and livery carry no railroad or manufacturer marks, only
the fictional reporting mark `MLNX` with a plain number (see [NOTICE.md](../../../NOTICE.md)).

- Generator: `node packages/entities/scripts/generate-rail.mjs --ids=autorack-enclosed` (builder
  `autorack` registered in `packages/entities/scripts/rail-models.mjs`; shared parts in
  `rail-geometry.mjs`). It writes `models/source.glb` and `entity.types.json`;
  `models/recipe.json` holds the dimensions and running data.
- Import: `node packages/tooling/dist/cli.mjs asset import content/entities/source/rail/autorack-enclosed/models/source.glb --id molen.entities.rail.autorack_enclosed --project content/entities/project.json --force`
  writes `assets/molen/entities/rail/autorack_enclosed/`.
- Envelope: 28 m over coupler faces, 27.2 m body, 3.25 m wide,
  5.94 m tall; truck centres 19.5 m; 36 in wheels. Authoring targets from
  public specification sheets, rounded; running data is gameplay tuning.
- Identity: An 89 ft flatcar with a fishbelly centre sill under a fully enclosed rack: posts, perforated side panels (`rail-perforated-panel`) between a kick plate and the lettered fascia, an arched ribbed roof and two-leaf end doors with locking bars.
- Paint: `rail-livery-body` takes `vehicle.color`.
