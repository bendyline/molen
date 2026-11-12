# Snow vehicles

This batch adds three original, generic rides for lying snow (`weather.snowCover`): a pair of
alpine skis, a snowboard and a snowmobile. All three are drivable; none joins traffic or parks on
streets. The engine side is in the [snow guide](../../docs-src/guide/snow.md).

| Type id | Name | Class | Size | Rider |
| --- | --- | --- | --- | --- |
| `molen.entities.cycle.skis` | Bendy Skis | Alpine skis | A pair of 1.70 m skis, 84 mm at the waist, 0.26 m apart; two 1.07 m poles | Standing, a hand on each pole |
| `molen.entities.cycle.snowboard` | Bendy Snowboard | Snowboard | 1.56 m twin tip, 250 mm at the waist; bindings 0.52 m apart, +15° and -9° | Sideways, left foot forward |
| `molen.entities.vehicle.snowmobile` | Bendy Sled | Trail snowmobile | 2.9 × 1.15 × 1.1 m; 0.38 m track, 1.0 m between ski spindles | Driver on a saddle with handlebars; one passenger |

Dimensions follow the common machines of each class (an all-mountain ski, a twin-tip all-mountain
board, a two-up trail sled). The geometry is original and generic: no maker's graphic, styling,
name or emblem. Each bundle's README records its parts.

## Construction

`packages/entities/scripts/snow-vehicles.mjs` builds the three from the cycle tools of
`fleet-geometry.mjs` and registers them with the light vehicles (`LIGHT_VEHICLES` in
`light-vehicles.mjs`), so each has a frame that `cycleGeometry()` reads and the rider contacts in
its `entity.types.json` come from the same place as the geometry. Regenerate one in the engine
repository with `node packages/entities/scripts/generate-fleet.mjs --ids=skis` (or `snowboard`,
`snowmobile`), import it with `molen asset import … --force`, and run `generate-models.mjs`.

- **Skis.** Each plank is lofted from width and camber sections with a turned-up tip, and carries
  a binding on a riser plate: toe piece, anti-friction pad, heel piece with its lever, and brake
  arms. The poles (`pole-left`, `pole-right`) hang from the `handlebar` group, so they follow the
  steering; an animation binding on speed stands them planted at rest and swings them back once
  the skis move.
- **Snowboard.** One plank with both ends turned up, two strap bindings (baseplate, heel cup,
  highback, ankle and toe straps) and a stomp pad. `binding-front` and `binding-rear` are named
  nodes.
- **Snowmobile.** A lugged track loop under a tunnel with running boards, a seat for two, a cowl
  with a headlamp, a windscreen, handlebars, and two skis (`ski-left`, `ski-right`) on double
  wishbones with coil-over shocks, which turn with the steering. Its `headlights` actuator
  drives a lit lens (`headlights-lit`). It has no wipers; the animation coverage check asks a
  vehicle on runners for headlights only.

Source GLBs are 2,900–7,800 triangles each (skis 3,656, snowboard 2,948, snowmobile 7,824), with
flat PBR materials and no textures. Each type has two liveries whose paints were studied from
linked Wikimedia Commons photographs ([source/liveries.json](source/liveries.json)): black and
white topsheets for the skis, white and black decks for the board, trail red and trail blue for
the sled. The sled's first default was a yellow that reads as one maker's colour; it was changed
to the red of a public-domain photograph.

## Riding

`vehicle.spec.runners` is what makes them slide: sliding friction on snow (0.05 for the skis,
0.055 for the board, 0.12 for the sled's track), a drag off the snow, and for the two the rider
pushes, a `pushSpeed` (4.5 m/s poling, 3.5 m/s skating). The skis set `flat`: they lie on the snow
through a turn and the lean stays in `vehicleState.bodyRoll`, where the board banks as one plank.
A vehicle with runners needs no wheel nodes; the `vehicle` component still requires at least one
for anything else.

`cycle.stance` places the rider: `standing` over the skis, `sideways` across the board, with
`cycle.kick` skating it along the flat. The sled is on the car solver with `spec.handlebar`, as
the auto-rickshaw is. A cycle on runners takes the ground's slope across it, and the standing
rider's pose stays plumb over the skis (`riding.level`).

Both sliding cycles set `pitchStiffness: 0`. At speed, air drag moves load onto the front contact
of the bicycle model; with any pitch stiffness the skis oversteered and spun at about 65 km/h on
a steady slope. With none they hold a straight line to their 38 m/s limit.

## Checks

- `packages/entities/test/snow-vehicles.test.ts`: the three types validate, slide from a stand on
  a slope, hold on a gentle one, reach their terminal speed (skis about 104 km/h on 25°), carve,
  stop on the brake, pole along the flat and scrape to a stop on bare ground.
- `packages/entities/test/fleet.test.ts` and `test/cycles.test.ts` cover them with the rest of
  the fleet, with snow lying for the types on runners.
- `packages/kernel/test/vehicle-snow.test.ts` covers the solver: grip, depth drag, cars held by
  deep snow, ploughed roads, runners.
- Seen with a rider in the Earth view example on Mount Rainier's north-east side
  (`?package=terrain/seattle-bellevue-sammamish/terrain-package.json&lat=46.8785&lon=-121.708&snow=2000`,
  then Drive with each of the three selected).

## Not done

- No livery preview sheet or gallery entry was captured for the three.
- The asset pipeline's lock and hashes were not refreshed (`pnpm assets:check` reports no asset
  bundle installed in this checkout).
- Skis and board leave no tracks, and the models do not sink into the drawn snow: its depth is
  a simulation value, and the ground is drawn at its bare height.
