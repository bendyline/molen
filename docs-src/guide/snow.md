# Snow cover

Snow lying on the ground is part of the [weather](weather.md): a `snowCover` block on the
singleton `weather` component names a snow line, and everything above it is under snow. The
ground whitens, roofs and trees take a dusting, people wade, cars lose their grip and bog down,
and skis, a snowboard and a snowmobile come into their own. One value drives the simulation and
the picture, so they agree.

```json
{
  "id": "conditions",
  "components": {
    "weather": {
      "snowCover": { "level": 1000 }
    }
  }
}
```

Lying snow is independent of falling snow. `precipitation.kind: "snow"` draws flakes in the air;
`snowCover` is what is on the ground, on a clear day as much as in a storm. Leave `snowCover`
out and the ground is bare.

## The snow line and the depth

| Field | Meaning |
| --- | --- |
| `level` | The snow line: absolute world Y in meters where lying snow begins. In an Earth view world Y is meters above sea level. Required. |
| `transition` | Height above the line over which cover builds from none to complete; default 150 m. Zero is a hard line. |
| `depth` | Depth where cover becomes complete, at the top of the transition; default 0.15 m. |
| `depthGain` | Extra depth for each 1000 m of height above that; default 0.6 m. |
| `maxDepth` | Greatest depth at any height; default 1.5 m. |

With the defaults and a line at 1000 m, ground at 1075 m is half covered and 7 cm deep, ground
at 1150 m is covered 15 cm deep, and at 2150 m the snow is 75 cm deep. A line below the lowest
ground with `transition: 0` covers everything evenly.

`snowCoverAt(cover, altitude)` from `@bendyline/molen-schema` returns `{ coverage, depth }` at a
height, `resolveSnowCover` fills in the defaults, and `resolveWeather(data).snowCover` is present
only while snow lies. The function uses arithmetic alone, so the kernel, a script and a renderer
get the same answer bit for bit:

```ts
import { snowCoverAt } from '@bendyline/molen-schema';

const { coverage, depth } = snowCoverAt({ level: 1000 }, 1400);
// coverage 1, depth 0.3
```

A script changes it like any weather: `molen.patch('conditions', 'weather', { snowCover: { level: 600 } })`.
It is in state hashes, checkpoints and replays with the rest of the component.

## What it does to movement

### On foot

`snowWalkingPace(depth)` is the share of a person's pace left in snow that deep: all of it up
to boot-sole depth, about 70% at 30 cm, 40% from 60 cm on. `WalkController.paceAt` takes
a function of the feet's position and applies it to walking and running (never swimming):

```ts
import { snowCoverAt, snowWalkingPace } from '@bendyline/molen-schema';

walker.paceAt = (_x, y) => snowWalkingPace(snowCoverAt(weather.snowCover, y).depth);
```

[Ambient pedestrians](ambient-life.md) slow the same way from the world's weather, on half the
depth: a footway is trodden down. In an Earth view the walker and the host's actors are wired
already (see [below](#in-an-earth-view)).

### On wheels

`installVehicles` reads the world's weather, so a car needs nothing more. Under snow:

- **Grip** falls toward the `snow` surface's 0.35 of dry pavement as cover builds (`looseSurfaceGrip`
  wins some back). Snow falling onto lying snow costs at most 15% more.
- **Depth drags.** Within a few centimeters it is the rolling resistance of any soft ground.
  Deeper, the wheels plough and the floor drags: the drag grows with the square of the depth
  against the wheel's size, about 3 m/s² where the snow reaches 60% of the wheel's radius.
  `snowDrag(depth, wheelRadius, tread)` returns both parts.
- **A car can be stuck.** Below a crawl, what the tires and the slope give has to beat the whole
  of that drag, or the car stays where it is: `vehicleState.stuck` is true while the driver is
  asking for drive and getting none. On untouched snow the stock sedan is held at 13 cm, the
  all-wheel-drive SUV at 22 cm and the off-roader on its tread at 33 cm; on a ploughed road the
  sedan keeps going until the snow beside it is 40 cm deep. A car that leaves the road at speed
  ploughs on for a few lengths first.
- **Roads are ploughed.** A [surface](vehicles.md#surfaces) may say how much of the snow it
  keeps: `VehicleSurface.snow`, 0.3 for the paved stock surfaces (`asphalt`, `concrete`, `paved`,
  `stone`, `wood`, `metal`) and 1 for open ground and for a world with no surface callback.

`vehicleState.snowDepth` is the depth under the vehicle, absent on bare ground, and
`vehicleState.surfaceGrip` reports the grip whether or not a host names surfaces.

### On runners

`vehicle.spec.runners` is for what slides: skis, a snowboard, a snowmobile's skis and track.

```json
"runners": { "friction": 0.05, "bareDrag": 3.5, "pushSpeed": 4.5, "flat": true }
```

| Field | Meaning |
| --- | --- |
| `friction` | Sliding friction coefficient on snow; it resists as `friction` × g. About 0.05 for waxed skis, 0.12 for a snowmobile's track. |
| `bareDrag` | Resistance in m/s² off the snow, where runners scrape bare ground; default 3. |
| `pushSpeed` | Fastest the rider's own pushing drives it; gravity may take it on to `maxSpeed`. Absent, `engineForce` works up to `maxSpeed`. |
| `flat` | A cycle whose runners stay flat on the snow in a turn (a pair of skis) instead of banking as one plank (a snowboard). The lean stays in `vehicleState.bodyRoll` for the rider's pose. |

On lying snow a vehicle with runners keeps its full `grip` (edges and paddles bite), floats over
any depth, and is never stuck. Friction is Coulomb friction: it holds the vehicle on a slope too
gentle to beat it (about 3° for skis) and lets go on a steeper one, so skis pointed downhill
start by themselves unless the brake is on, accelerate under gravity along the slope, and settle
at the speed where air drag and friction balance it. Across the slope the edges hold a traverse.
Off the snow, runners scrape to a stop.

A cycle on runners also lies on the slope across it, where a wheeled cycle balances upright on
its tire line: `vehicleState.roll` follows the ground under the skis, and the standing rider's
pose stays plumb over them.

## The three rides

The `molen.entities` pack carries three types, drivable through `installVehicles` like any
[vehicle](vehicles.md):

| Type | What it is | Controls |
| --- | --- | --- |
| `molen.entities.cycle.skis` | A pair of 1.70 m all-mountain skis with bindings and two poles. The rider stands over them with a hand on each pole. | Point downhill to slide. Steering carves. Brake, or back on the throttle, stops on the edges. Throttle poles along the flat to 4.5 m/s. |
| `molen.entities.cycle.snowboard` | A 1.56 m twin-tip board with strap bindings. The rider stands across it, left foot forward. | As skis; the board banks into its turns, and throttle skates it along the flat to 3.5 m/s. |
| `molen.entities.vehicle.snowmobile` | A two-up trail sled: a lugged track, two steered skis, handlebars, a headlamp. | Throttle and brake as a car, reverse included. It floats over snow a car is stuck in, and drags on bare ground. |

On a 25° slope the skis reach about 105 km/h; their hard limit is `maxSpeed`, 38 m/s. The poles
stand planted at rest and swing back in the hands once moving. None of the three joins traffic
or parks on streets.

## Rendering

The renderer needs only the weather. `renderer.setWeather(data)` (the normal client mirrors the
component by itself) hands the snow line to every material that takes snow, on WebGL and WebGPU,
and changing or clearing it never rebuilds a shader.

- **Marked materials** take a dusting on what faces the sky: `enableSnowCover(material, amount,
  facing)` from `@bendyline/molen-client/snow` marks a lit material once. `amount` (0–1) thins
  the dusting, and `facing` is the range of the surface normal's up component over which a
  face goes from bare to dusted: by default `[0.3, 0.75]`, so flat roofs are white and walls
  stay clean. The `@bendyline/molen-worldgen` material sets mark generated buildings (roofs,
  ledges and sills whiten, glass does not), landmark models, and the scatter material for
  trees, shrubs and props, where the dusting is thinner so foliage still shows and reaches
  down steeper faces (`[-0.05, 0.55]`), so a conifer's tiers carry snow. Parked cars and the
  painted shell of a car you drive are marked too. Mark your own models the same way; leave
  out anything that moves through the weather, such as an aircraft or a person.
- **Terrain ground and paving** draw their own snow. `setTerrainGroundSnow(material, snowCover,
  worldOriginY)` from `@bendyline/molen-terrain/client` works on the materials from
  `createTerrainGroundMaterialAsync` and `createTerrainPavementMaterialAsync`: open ground
  whitens in patches through the transition and completely above it, faces steeper than about
  58° shed it and show rock, and roads keep worn, greyer snow with the paving showing through.
  Up close the snow surface has wind drifts a few meters long, which the sun and the sky's
  light model: crests bright, hollows a little bluer.

The line is one function of world position on every surface, so a roof and the ground under it
agree on where the snow begins. It wanders by up to a third of the transition with broad noise,
so it does not follow a contour like a tide mark; the simulation uses the smooth line.

Trees do not stop at the snow line; they stop at the tree line. The Earth tile adapter thins
mountain forest out over the last 350 m below a latitude-dependent alpine tree line (about
2,250 m at Mount Rainier, 3,900 m in the tropics, lower in the southern hemisphere), so glaciers
and summits are bare whatever the snow level. See [regional world content](regional-world.md).

## In an Earth view

`mountEarthView` takes the weather at mount and changes it at once:

```ts
const view = await mountEarthView({
  canvas,
  terrain,
  baseUrl,
  content,
  weather: { snowCover: { level: 2000 } },
});

view.setWeather({ ...view.weather, snowCover: { level: 500 } }); // a winter storm reaches town
view.setWeather(undefined);                                       // clear skies, bare ground
```

That one call reaches the sky, the view's simulation (so cars slip and bog down and runners
glide), its ground and paving materials, the walker's pace and the pace of the host's
[actors](earth-view.md#actors-companions-and-npcs). On mapped roads and footways the walker and
cars meet the ploughed depth; off them, and where the map is empty, the full depth.
`view.vehicleStatus()` adds `snowDepth` and `stuck` for a car, and `EarthVehicles.snow` reports
the same for a host composing its own view, where `createSnowPace` builds the walker's
`paceAt`.

Put the viewer on skis as on any ride:

```ts
view.setMode('drive', { vehicle: 'molen.entities.cycle.skis', force: true });
```

## World explorer

The Weather panel has a **Snow level** list: no snow, everywhere, sea level, and lines from
250 m to 4,000 m. `?snow=1500` sets a line in meters, `?snow=all` covers everything and
`?snow=off` clears it. Each region can open on a line of its own: the Seattle region, which
reaches east over the Cascade crest and south past Mount Rainier (4,392 m), opens with snow
above 2,000 m, as the mountain's glaciers keep it all year.

On foot on lying snow, **P** takes skis, then a snowboard, then a snowmobile from the bag (on
bare ground it is still the skateboard and scooter). `?ride=skis` starts on them, so this link
drops you onto the Muir Snowfield pointed downhill:

```text
https://molen.dev/play/world-explorer/?lat=46.822&lon=-121.728&yaw=1.57&navigation=walk&ride=skis&mode=human&weather=sunny
```

The status line shows the snow depth under the ride and says when a car is stuck.

## Limits

- Snow does not fall and build up, melt, drift or avalanche. The cover is authored: move the
  line to change it.
- The depth depends on height alone. Aspect, wind and forest shelter do not change it, and
  only the surface under a vehicle or walker tells a ploughed road from open ground.
- A stuck car stays stuck: step out and walk, or bring a snowmobile. There is no digging out,
  no chains and no winter tires beyond `looseSurfaceGrip`.
- Lakes do not freeze, and no tracks are left in the snow.
- The dusting on marked materials follows the surface's facing, not what overhangs it: a
  covered porch floor whitens with the roof above it.
- Skiing is a grounded glide: no jumps, falls, moguls or lifts. Ambient traffic drives on at
  its usual pace.
- World Explorer draws no rider (it has no avatar), so its skis run without a skier in the
  chase view; an Earth view with a walker avatar draws one.
