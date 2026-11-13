# Inferred building interiors

World explorer enables lazy interiors in the styled **Human** layer: choose **Walk**, approach
a building, and walk through its framed entrance. Near the entrance, the windows become
transparent and reveal the same interior you can enter.

`?interiors=0` disables this capability. `?synthetic=1&stores=1` provides a repeatable block of recognizable
stores; `test/visual/interiors.play.json` walks into and out of its fast-food restaurant and grocery store.
Use `?synthetic=1&houses=1` for a residential block with two-storey houses and a bungalow.
`test/visual/houses.play.json` walks through its entrance, climbs the stairs, and enters a bedroom.

These layouts are plausible procedural interpretations of building use, **not surveyed floor
plans**. Confirmed occupant categories take precedence over building labels, then surrounding
use. The selected exterior style supplies a final fallback hint, so weakly labeled homes receive
a domestic layout. Unrecognized uses receive a generic furnished hall. A multi-tenant building currently uses
one inferred ground-floor program; it does not infer individual leased premises.

## Reusable generation platform

The implementation lives in `@bendyline/molen-worldgen/kernel` and knows only metric polygons,
opaque identities and use labels. The Earth adapter supplies those labels from mapped businesses
without changing the exterior classification of towers. Source feature identities, or the
existing quantized location identity when absent, stabilize the result.

The interior catalog is content: the style pack names it (`"interiors"` in `stylepack.json`) and
the resolved pack carries it as `pack.interiors`. A pack without one generates no interiors.

1. `generateBuilding({ ..., interiors: catalog }, builder)` cuts a real entrance and frontage
   windows into the exterior. Homes also have bounded side/rear and upper-storey apertures. Its `record.interior` is an `InteriorSite`:
   canonical outline and courtyard holes, floor and ceiling, door/window apertures, access ramp,
   available storey heights, labels and identity. This stage generates **no floor plan or furniture**.
2. `generateInteriorPlan(site, { catalog })` returns a data-only `InteriorPlan`: rooms, fixtures,
   storeys, stair runs, reserved circulation strips, seed and work statistics.
3. `generateInteriorGeometry(plan, catalog)` produces structure, furniture, glass, visible
   stair-step and smooth stair-collision buffers. Structure includes floors, ceiling, interior-facing shell walls, room partitions
   with doorways, and an entrance ramp. Furniture is a merged vertex-color batch of structured
   low-poly models: stocked shelving, racks, counters/registers, tables/chairs, beds, desks,
   sofas and benches, plus fitted kitchens, bathroom fixtures, wardrobes, dressers, bookcases,
   rugs, coffee tables and plants.

```ts
import {
  generateInteriorPlan, generateInteriorGeometry, validateInteriorCatalog,
} from '@bendyline/molen-worldgen/kernel';

const catalog = pack.interiors ?? validateInteriorCatalog(myCatalogJson);
const plan = generateInteriorPlan(site, { catalog, maxFixtures: 160, maxCandidates: 1024 });
const buffers = generateInteriorGeometry(plan, catalog);
```

Both generation passes have `*Steps` variants that yield repeatedly. They run without a DOM or
three.js and can also be driven by a worker host. The shipped client drives these iterators
cooperatively on the main thread; exterior generation continues through the existing worker.

## Data-driven profiles and algorithms

`molen/interior-catalog@1` is a registered JSON format. Validate it with
`molen validate catalog.json`; discover its fields with `molen schema get interior-catalog`.
The default style pack's `interiors/catalog.json` (in the `molen.worldgen.default` content pack,
source [`content/worldgen/interiors/`](https://github.com/bendyline/molen/tree/main/content/worldgen/interiors)) is a complete
editable starting catalog with 26 profiles:

| Program | Algorithm and furnishings |
| --- | --- |
| Grocery | Long stocked shelf rows, 2.4 m aisles, front checkout |
| Fast food, restaurant, cafe | Tables and chairs with an entrance-side service counter |
| Pharmacy, retail, library | Smaller shelving modules and generous access strips |
| Mall | A galleria with a void, shops on every storey, escalators and an anchor store; see [Malls](#malls) |
| House | Connected hallway, living room, kitchen, bathrooms, bedrooms, and stairs to an upper floor when it fits |
| Office, skyscraper, civic | Open-plan desk bays around a lift core, every storey; see [Towers and lifts](#towers-and-lifts) |
| Apartments, hotel | Rooms off corridors on every storey, with a lobby and lifts |
| School, hospital | Classrooms or wards off wide corridors, on every storey |
| Clinic | Room pods with beds |
| Warehouse | Tall storage racks and 3 m handling aisles |
| Parking garage | Drive aisles, stalls, ramps and parked cars on every deck; see [Car parks](#car-parks) |
| Theatre, cinema, place of worship | Rows down a central aisle, facing a screen or an altar |
| Museum | A central walk with galleries off it: a plinth and a picture in each |
| Sports hall | A marked court with hoops, and bleachers where there is room |
| Station | Ticket windows, a gate line and waiting benches |
| Fire station | Engines nose to the doors, and lockers along the back wall |
| Assembly | Bench rows with a central aisle |
| Generic | Furnished hall with seating |

Each profile supplies an id/version, ordered label matches, algorithm family, furniture type,
module dimensions, aisle width, placement density and floor/wall/wood/accent colors. Catalog
validation rejects duplicate ids, missing fallbacks, invalid colors and unsafe metric ranges.
The reusable layout families are `aisles`, `dining`, `rooms`, `workplace`, `storage`, `hall`,
`residential`, `parking`, `tower`, `atrium`, `auditorium`, `court`, `concourse`, `gallery` and
`apparatus`.
Add or tune a profile in JSON to vary these families; extend the typed algorithm union and
generator when a new topology is necessary. The optional `residential` profile settings control
whether upstairs is allowed, clear stair width, run per meter of rise, and minimum room width.

The seed is `interior1|<identity>|<profile.id>@<profile.version>`. Named coordinate draws make
placements independent of request order, frame timing, floating-origin shifts and unrelated
profile edits. Smaller fixture caps preserve the prefix of the full layout. A profile version
bump intentionally rerolls that profile. No global random state is consumed.

Placement reserves the entrance spine, front circulation and cross aisles before furnishing.
Whole-rectangle tests include polygon edges and enclosed courtyard holes, so checking only
corners cannot accidentally place furniture across a concavity. Room furniture sits at the
back, leaving the doorway and turning space clear. Conservative placement can leave irregular
wings sparsely furnished; the generated floor still follows the complete outline and holes.

## Residential rooms and stairs

The residential algorithm fits two banks of rooms beside an entrance-connected hallway, then
assigns domestic uses instead of repeating beds. Single-storey homes get living, kitchen,
bedroom and bathroom spaces. When the envelope and footprint fit a safe stair run and a 1.5 m
landing, bedrooms move upstairs. Room records carry a purpose, storey index and hall-facing
1.16 m doorway. Partitions include headers, door casing and skirting; fixtures reserve turning
space at each door. House identity determines room proportions, bedding size, upholstery and
decor colors. Kitchens include cupboards, worktops, a sink/faucet, hob and oven. Bathrooms have
a shower, toilet and vanity. Furniture remains deliberately low-poly.

This first vertical topology supports ground plus one upper floor. Stair rise is divided into
steps no higher than 18 cm, with a default horizontal run of 1.65 m per meter of rise. The run
is removed from both the lower ceiling and upper floor. Guard walls and handrail trim protect
the upper opening; the landing leads directly back to the hallway. Insufficient width, depth
or headroom produces a single usable floor, rather than inaccessible upstairs rooms. Irregular
wings retain conservative placement and can remain sparsely furnished.

## Towers and lifts

A profile with `algorithm: "tower"` fills every storey the exterior shows. Its `tower` block picks a
`plate`: `open` for desk bays, or `guest`, `flat`, `ward` or `class` for partitioned rooms. It also
sets the number of `elevators`, and the depth of a ground-floor `lobby` kept free of rooms.
`moduleWidth` and `moduleDepth` size a room, and `aisleWidth` a corridor.

The plate is built from the door's frame: a spine straight in from the entrance, crossed by
corridors a double row of rooms apart, with lift cars beside the spine near the middle of the plate.
A plate too narrow to cross puts rooms on the spine. A plate with no room for a lift keeps only its
ground floor, since upper storeys could then be seen but never reached.

A tower is built around whoever is in it. `generateInteriorPlan(site, { focus })` covers the ground
floor and the storeys around `focus`, so a sixty-storey tower costs what a four-storey one does.
`plan.tower.levels` lists them, and `plan.storeys` holds the same storeys.

A lift is a host's to operate, because only the host can move a viewer:

```ts
const stop = interiors.elevatorAt([x, y, z]);
if (stop) {
  // Keep asking each frame. It stays false until that storey is built.
  if (interiors.requestStorey(stop.identity, level)) feet.y = stop.floors[level];
}
```

Upper-storey windows are in the interior's own walls. The exterior shell is single-sided, so from
inside it is simply not there, and the view out needs no holes in the facade. From outside, the
facade stays opaque above the ground floor.

## Malls

A profile with `algorithm: "atrium"` lays a galleria straight in from the entrance, a cross galleria
where one fits, shops down both sides on every storey, and an anchor store closing the far end.
`aisleWidth` is the galleria's width, and `moduleWidth` and `moduleDepth` size a shop. Three storeys
at most are built.

Above the ground floor the middle of the galleria is a void. Escalators climb it in wells split by
bridges, because each run has to land on a floor and the next has to start from one.

## Car parks

Set `parking: { levels, entrances }` on a `BuildingRequest` to model a multi-storey car park instead
of rooms. `levels` counts the storeys below the roof deck, which is parked on too. `entrances` are
mapped vehicle entrances near the footprint, in local meters. The building needs a flat-roofed style
and a catalog profile labeled `parking_garage` that uses the `parking` algorithm, whose
`moduleWidth`, `moduleDepth` and `aisleWidth` set the stall and aisle sizes and `density` the
occupancy of the ground deck.

The layout is plausible, not surveyed. It is decided with the exterior, because the top ramp comes
up through the roof: `generateBuilding` picks doors, aisles and a ramp position, and leaves the
stalls to the lazy plan.

- **Aisles** run along the longer side of the door's frame, with stalls either side, and link at
  their ends. Every storey shares one plate.
- **Ramps** are a scissor. Each lane takes a stall row either side of one aisle, and climbs back the
  way the last came, so a driver U-turns across the aisle at every level. Lanes climb one meter in
  seven, or as steeply as one in five where the plate is tight.
- **Doors** sit on the walls with mapped entrances, or else the walls easiest to reach from the
  ground. A door may line up with the first ramp lane, so a driver goes straight in and up.
- **Walls** open in bays between piers on every storey. Openings use the `open` kind, which has no
  glass and no frame, and a dark cover stands in for them until the interior loads.
- **Cars** come from named coordinate draws, as `plan.parking.cars`, thinning with height. A stall
  keeps its car however low `maxParkedCars` is set, up to 3,000 across a garage.

`InteriorStreamingOptions.furnish` receives each plan as it is published, which is how a host adds
content such as cars. The Earth view draws every car from one instanced mesh per body size and makes
only the 48 nearest real vehicles, so you can board one and drive it down the ramp. Vehicles sit on
the deck they are driving on because `groundHeight(x, z, y)` passes their height: see
[Vehicles](vehicles.md).

A footprint too small for a ramp and a turnaround at each end keeps its decks and cars, but they
cannot be reached. A plate under about 1,300 m² has room for a ramp or for stalls but hardly both,
and real ones that size use car lifts or sloped floors, which this does not model. Storeys are flat
and stacked, with no split levels, and footbridges mapped into a garage end at its wall.

## Streaming, rendering and collision

`InteriorStreamer` from `@bendyline/molen-worldgen/client` accepts groups of sites and a metric
origin. Call `register(root, sites, [originX, originZ])` after creating a region's exterior,
`update([cameraX, cameraY, cameraZ])` before collision, and `unregister(root)` on disposal.
The supplied root must be attached to a visible scene hierarchy.

`new InteriorStreamer({ catalog })` takes the same catalog. The Earth renderer wires
registration/disposal automatically when created with `interiors: true` or streaming options,
using the style pack's catalog (and generating no interiors when the pack has none). The host calls
`renderers.updateInteriors(cameraPosition)` each frame. Only complete buildings at the finest
semantic level receive sites; coarse representations retain the cheap exterior path.

Defaults are a 65 m load distance, 90 m release distance, 12 resident interiors and a 16 MiB
resident geometry cap. Distance is measured to the footprint (including courtyard boundaries)
and vertically to the available storey envelope, so a large building remains resident while you are inside
and a high fly camera does not request rooms underneath it. Selection checks region bounds,
then prioritizes nearby buildings and deduplicates source identities. Plans cap at 1,024
candidate modules and 160 fixtures (hard ceilings 4,096 and 512). The work budget is 3 ms and
64 iterator steps per frame, with at most one completed upload per frame. This is a cooperative
budget, not a hard deadline: triangulation and final buffer upload are indivisible operations.

One opaque portal batch covers unready entrances/windows per region. Publication attaches the
complete interior and removes those covers atomically. Eviction restores covers and disposes
owned geometry; shared materials survive until streamer disposal. Hidden layers, region
disposal and moving out of range cancel pending work. There is no unbounded interior cache:
returning regenerates the same plan. Cached exterior descriptors count toward the existing
tile cache budget. The HUD reports available/resident interiors, pending generation, memory
and failures.

Structure, furnishings and glass share materials across interiors. Four shared 256² detail maps
supply wood grain/boards, ceramic grout, fabric weave and plaster grain, using metric UVs and
mipmaps. These neutral maps combine with household vertex colors; no texture is allocated per
building. Their fixed shared memory is separate from the resident geometry counter. Room surfaces
return under half the daylight that reaches them (a room sees only the sky its windows frame),
so from outside they read dimmer than the day, as real rooms do, not as pale smudges behind
the glass. Furniture is merged instead
of spawning one scene object per shelf product. Ceilings use simple bright fixture geometry;
there are no per-building dynamic lights or additional shadow maps. Interior structure and the
opaque portal covers cast the sun's shadow like the walls around them (furniture and glass do
not), so a building's shadow stays solid where its windows line up. The walking octree uses
the same published geometry, except that visible stair steps are skipped (`walkIgnore`) and
a closed wedge supplies smooth stair collision. The published proxy is marked
`walkCollisionOnly` and has rendering layers disabled. Hosts using the kernel buffers directly
should likewise omit `steps` from physics and add `collision` to their collision scene. Portal index changes invalidate collision, and window glass is
solid from either side. Doorways remain open without an interaction key or door animation.

## Current limits and next extensions

This release covers ground floors, a connected upper floor for suitable homes, every storey of a
tower or mall, and every deck of a car park, in complete, non-elevated polygon buildings that fit the
exterior geometry budget and have room for human-scale access. It does not promise entry into
every mapped fragment: clipped footprints, elevated parts, very low/narrow structures,
budget-boxed and omitted buildings lack a site. Additional storeys, switchback stairs, elevators,
animated doors, tenant subdivision and persistent object edits remain future extensions.

Ground-floor platforms use the highest sampled perimeter height and an entrance ramp. Very
steep sites, terrain protruding inside a large footprint, adjacent buildings obstructing a
door, or missing street-access metadata can still need a site-specific access solution. Window
transparency applies to generated apertures; homes have upper windows where the envelope
allows them. An aperture above an unused storey stays backed by an opaque surface. Interior objects are viewer-local geometry, not persistent ECS
entities. Extend the plan contract with gameplay state before allowing movable furnishings.

Regression coverage includes every profile, deterministic regeneration, translated origins,
courtyard/concave containment, work/memory caps, streaming cleanup, and walking through the
actual shell both before and after publication, plus ascending stairs, entering an upstairs
bedroom, descending and exiting with the real capsule controller. The browser playback scenario checks the
visible world-view path alongside those headless checks.
