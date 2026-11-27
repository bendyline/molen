# Night lighting

Earth views light occupied windows and street fixtures as the Sun sets. World Explorer and
`mountEarthView` share the same smooth transition: off above +2° solar altitude, fully on below
−6°. Date, location and time-of-day changes use the sky's Sun position, so a city's lights follow
its local night even when the controls display your own time zone.

## Buildings and existing models

Generated buildings already identify their glass as the `window` material slot. The client adds
a compact emission layer on those actual panes. About 55% illuminate, with a deterministic mix
of warm and neutral whites and brightness levels. Each whole pane stays either on or off;
the pattern does not flicker with time, material loading or floating-origin shifts. The same
layer follows all three resident building detail levels. Silhouette boxes without windows stay
unlit.

Authored static GLB structures opt in through material metadata. Existing
`extras.molenSurface.slot: "window"` bindings are recognized automatically. For glass or lamp
faces with other materials, add this to the glTF **material's** extras:

```json
{
  "molenNightLight": {
    "kind": "window",
    "occupancy": 0.55,
    "color": "#ffe4b0"
  }
}
```

Use `kind: "lamp"` for a permanently occupied fixture (default occupancy 1). `color` is optional;
omitting it gives the warm/neutral mix. An occupancy of 0 disables the layer. Model generators
should emit separate, disconnected glass panes for independent room occupancy. Connected glass
sheets illuminate as one surface. Mark only the emitting faces, not a combined wall-and-window
material. These tags also work on source-derived runtime LODs when those LODs retain the extras.

No window locations are guessed from a model's name, base colour or bounding box. Untagged
landmarks need a generator change to identify the intended glass or fixture faces. The light
layer follows the model's hierarchy, placement, clipping and lifetime; the original daytime
materials are retained.

## Roads and signals

Modern surfaces place lamps along paved streets with sidewalks and at intersections. Placement
is bounded, terrain-aware and avoids mapped buildings and water. Long blocks get fixtures at roughly 28 m intervals, alternating sides.
Arterials (motorways, trunk and primary roads, and any road of four or more lanes) get 7.4 m
mast arms whose heads hang over the carriageway; other streets get 5 m post-top lanterns at the
curb. A corner lamp is a mast arm when any road at its junction is an arterial.
Bridges, tunnels and unpaved roads do not receive inferred block lighting. Explicit
`tags.lit: "no"` disables block lamps. The existing surface style and `details.streetlights`
control whether fixtures are generated; historic and unlit styles keep their own choices.

Each surface tile batches illuminated lamp heads and soft pavement pools. Pools follow terrain
height, fade with dusk and share the fixtures' distance culling. In Earth hosts every lamp on
show within about 300 m of the camera (or 250 m of the ground it looks toward) also lights the
world around it: pavement, building walls, parked and moving cars and anything else with a lit
material, with the warm light and 42 m reach a street lamp's point light had. Lamps fade out
smoothly between 210 and 300 m, so none switches on as the camera approaches; past that they
keep their batched glow and pavement pools. From the air the lit lamps reach farther: 300 m plus
the camera's height above the ground, up to 900 m, fewer where a city has more than 1,024 lamps
in that reach. The light is diffuse only and casts no shadows;
walls do not occlude it.

The lamps do not become three lights. Three lights every lit pixel with every light in the scene,
so sixteen street lamps and eight headlight beams as point and spot lights cost a 1440x900 view
of a residential street 14 ms of GPU time and 5 ms of the main thread a frame, the whole price of
night. And as only the nearest sixteen could be lit, each lamp a driver approached switched on in
its turn, with the walls around it. Instead the renderer keeps a lamp field
(`Renderer.lampField`, [graphics performance](graphics-performance.md)): one small float texture
holding up to 1,024 lamps and a 48x48 grid over them, each cell listing the lamps (up to 16, the
nearest) whose reach touches it. A lit pixel reads its cell and adds those lamps' light, typically
a handful. Every lit shader carries the field from the start, so nightfall compiles nothing.

Traffic lenses remain self-lit in both daytime and nighttime and keep their simulation-driven
signal phases. After dark each lit lens also gets a soft glow in its own color, about a meter
across, which follows the phase from red to green (`surface:night-signal-glow`, one batch per
tile). Road signs light up too: their lettered faces fade in with the night factor, street
names at 85% as lit panels and the other boards at 60%, as retroreflective faces caught by
lamps and headlights. Each glow (`surface:night-street-names`, `surface:night-road-signs`)
draws its face mesh's own geometry, so it adds a draw call per tile, not memory; blank sign
backs and edges are a separate `surface:sign-backs` mesh and stay dark. Mapped props that
replace inferred fixtures still need their own model lighting metadata; arbitrary tagged model
lamps currently glow without lighting their surroundings.

## Cars

Active traffic and the driven car get white headlights and red tail lights, including when
stopped at a signal. Lenses follow vehicle dimensions and the full chassis rotation, through
proxy/model changes and floating-origin shifts. Braking brightens the rear lenses. Four nearby
cars also cast a pair of forward, downward-aimed beams, with the driven car taking priority.
They are a spot light's cone and falloff (60°, 55 m), evaluated beside the street lamps in the
lamp field rather than as three spot lights.
Each beam starts at its headlight lens and softly lights the road immediately ahead of the car.
Their beams illuminate pavement, walls and vehicles ahead. Parked, unoccupied cars keep their
lamps off and receive light from their surroundings. Hidden/despawned traffic loses its lights.

A driven vehicle whose type has a `headlights` actuator (**L** in the Earth view and World
Explorer) lights its beams only while that switch is on, and then also at dusk and by day, at a
little over a third of their night strength. Its own model shows the lit lenses. A driven vehicle
without that actuator, such as a bicycle, lights up at dusk like traffic.

Lenses and beams come from `vehicle.spec.headlamps` when a type gives it: model-space lens
centres, at most two, so a single-lamp auto-rickshaw or scooter casts one beam from its real lamp.
An empty list (a skateboard) lights nothing. Without it, a pair is placed from the body's width,
height and length.

Traffic lenses are two instanced batches, capped at 512 cars, and all artificial lighting fades
out at dawn. No light changes the deterministic simulation.

`details.maxStreetlightsPerTile` gives lamps their own budget (default
1.5 × `maxFixturesPerTile`, normally 240), so block lighting does not take parking spaces away.
Worker and direct surface generation produce the same placement and light pools. Fresh tiles
and style replacements inherit the current night factor immediately.

## Custom hosts

`createEarthWorldgen(...).setNightFactor(factor)` and
`TerrainSurfaceRenderer.setNightFactor(factor)` accept 0..1. Compute that factor with
`earthNightFactor(sunAltitudeDeg)` from `@bendyline/molen-earth/client`. Fixed daylight hosts
can leave the default 0. Direct surface objects use `updateTerrainStreetLights(object, factor)`.

Lower-level worldgen hosts can create `NightWindowLighting` from
`@bendyline/molen-worldgen/client`, assign it to their material set's `nightWindows`, and pass it
to `StructureModelLibrary` or `StructureLodStreamer` as `nightWindows`. Dispose the controller
after its building/model objects; model eviction retains the shared emission material.
Compose street lamp spill and traffic lighting with `EarthNightLighting` from
`@bendyline/molen-earth/client`. Construct it with
`{ root, world, surface, sampleHeight, lampField }`, where `root` uses absolute simulation
coordinates (normally the terrain stream object) and `lampField` is the renderer's
(`viewer.renderer.lampField`); without it, lamps and beams light nothing beyond their own glow,
pools and lenses. Pass `vehicleHeights` from the ambient content catalog for matching traffic
model heights. Call `update({ camera, direction, factor, drivenVehicleId })` each frame and
dispose it before its root. `TerrainSurfaceRenderer.visitStreetLights` exposes only attached,
visible source tiles.

The lamp field is the renderer's, for its lifetime: on WebGL a hook on three's lit shader chunks
(the one cloud shadows use) adds it to every standard, physical, Lambert, Phong and toon material;
on WebGPU a light node in the scene does. Any host can write to it: `setLamps(lamps, count,
fadeTo)` with x, y, z and strength per lamp measured from an anchor, `setView({ frame, anchor,
eye, focus, intensity })` each frame, `setBeams(beams)` after it, and `clear()`. `frame` is the
object the positions are in; the renderer places the anchor from its matrix just before drawing,
so a floating-origin shift never leaves the lamps a frame behind.
