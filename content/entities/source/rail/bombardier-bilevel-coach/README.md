# Bombardier BiLevel Coach

Source bundle for `molen.entities.rail.bombardier_bilevel_coach` (bi-level commuter coach), part of the
[rail rolling stock](../../../RAIL.md) family. The name identifies what this polygonal
interpretation depicts; the geometry and livery carry no railroad or manufacturer marks, only
the fictional reporting mark `MLNX` with a plain number (see [NOTICE.md](../../../NOTICE.md)).

- Generator: `node packages/entities/scripts/generate-rail.mjs --ids=bombardier-bilevel-coach` (builder
  `bilevel` registered in `packages/entities/scripts/rail-models.mjs`; shared parts in
  `rail-geometry.mjs`). It writes `models/source.glb` and `entity.types.json`;
  `models/recipe.json` holds the dimensions and running data.
- Import: `node packages/tooling/dist/cli.mjs asset import content/entities/source/rail/bombardier-bilevel-coach/models/source.glb --id molen.entities.rail.bombardier_bilevel_coach --project content/entities/project.json --force`
  writes `assets/molen/entities/rail/bombardier_bilevel_coach/`.
- Envelope: 25.91 m over coupler faces, 25.3 m body, 2.97 m wide,
  4.84 m tall; truck centres 18.3 m; 36 in wheels. Authoring targets from
  public specification sheets, rounded; running data is gameplay tuning.
- Identity: The characteristic BiLevel section: vertical lower sides with the lower-level window row, inward-sloping upper sides carrying the upper-level windows, a low-floor lower level between the trucks and intermediate-level vestibules over them with one door per side at each end; flat ends with end doors, diaphragms and couplers; outboard-bearing passenger trucks with air springs.
- Paint: `rail-livery-body` takes `vehicle.color`; `rail-livery-stripe` is the second livery colour.
