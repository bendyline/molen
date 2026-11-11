# GE ES44AC

Source bundle for `molen.entities.rail.ge_es44ac` (six-axle freight locomotive), part of the
[rail rolling stock](../../../RAIL.md) family. The name identifies what this polygonal
interpretation depicts; the geometry and livery carry no railroad or manufacturer marks, only
the fictional reporting mark `MLN` with a plain number (see [NOTICE.md](../../../NOTICE.md)).

- Generator: `node packages/entities/scripts/generate-rail.mjs --ids=ge-es44ac` (builder
  `es44ac` registered in `packages/entities/scripts/rail-models.mjs`; shared parts in
  `rail-geometry.mjs`). It writes `models/source.glb` and `entity.types.json`;
  `models/recipe.json` holds the dimensions and running data.
- Import: `node packages/tooling/dist/cli.mjs asset import content/entities/source/rail/ge-es44ac/models/source.glb --id molen.entities.rail.ge_es44ac --project content/entities/project.json --force`
  writes `assets/molen/entities/rail/ge_es44ac/`.
- Envelope: 22.3 m over coupler faces, 21.4 m body, 3.12 m wide,
  4.72 m tall; truck centres 15.9 m; 42 in wheels. Authoring targets from
  public specification sheets, rounded; running data is gameplay tuning.
- Identity: A wide-nose safety cab over a tall nose with twin headlights and a front door; number boards at the top corners of the cab front; the dynamic-brake housing and an inertial intake on the long hood; the flared radiator wings and two fans at the rear; C-C Hi-Ad trucks with primary springs over each journal box; a deep fuel tank between the trucks; corner steps, walkway and end railings, pilots with snowplows, ditch lights, MU hoses.
- Paint: `rail-livery-body` takes `vehicle.color`; `rail-livery-stripe` is the second livery colour.
