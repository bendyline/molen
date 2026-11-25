# Performance evaluation

## Scoreboard

`run-scoreboard.mjs` measures one settled view and one flight in the real explorer and checks
them against `scoreboard-budgets.json`:

```sh
node test/performance/run-scoreboard.mjs --label=main
```

The settled view (900 m over Bellevue, Balanced detail, 1440 x 900) reports what a frame is made
of: draws, triangles, visible geometry memory, land cover's memory and triangles and how many
tiles draw it as a texture, and plant triangles (`sceneComposition` in the explorer's flight
report). The flight (laps at 250 m/s) reports long frames, main-thread work, rebuilt tiles,
evictions, ground that coarsened in view, peak visible memory, heap, the level drawn within
2 km, and how long background preparation waited.

What a view is made of is the same on every run with the same window (three runs gave identical
counts), so those budgets fail the run. Times depend on the machine and on what else it is
doing; their budgets are marked `advisory` and fail only with `--strict`. `--report-only` never
fails; `--tier`, `--seconds` and `--params` change the scenario, and `--budgets` names another
file. Budgets sit about a quarter above the numbers measured when they were set (2026-11-09, AMD
Radeon AI PRO R9700): move them deliberately, with the change that earns it. Results and a
screenshot go to the ignored `.artifacts/scoreboard/<label>/`. It needs an installed Chrome, like
the flight probe below (`--channel=msedge` uses Edge where Chrome does not launch). It has been
run on that workstation and on one laptop (below): an integrated GPU and a 120 Hz display are the
missing rows.

### WebGL and WebGPU

`--params=backend=webgpu` runs the same scoreboard on WebGPU. The budgets are WebGL's; what a view
is made of fits them on both backends. Measured 2026-11-12 on an NVIDIA RTX Spark N1X laptop
(Windows on ARM, 20 cores) in headless Edge, at the default tier:

| | WebGL | WebGPU |
| --- | ---: | ---: |
| Settled view: main-thread work a frame | 8.5 ms | 15.1 ms |
| Settled view: triangles / shown memory | 2.66 M / 284 MiB | 2.39 M / 305 MiB |
| Circle: mean / 95th percentile work | 9.2 / 16.1 ms | 12.9 / 22.0 ms |
| Circle: frames over 33 ms | 54 | 125 |
| Circle: heap | 1,931 MiB | 1,906 MiB |

The difference is main-thread work: by the explorer's own readout the settled view took 4 to 5 ms
of GPU time a frame on WebGPU against 6 to 7 on WebGL. Times moved by 1 to 2 ms between runs (the
settled WebGPU view read 12.6 to 15.1 ms over four), and by as much again with a test run or a
package build going on beside them, so run one scoreboard at a time. `&gpuOptimizations=0`
measured the same as WebGPU with its command caching. WebGPU's ambient occlusion is off in the
run above, as it is by default (see `selectedAmbientOcclusion` in `src/backend-options.ts`); with
`&ao=1` the circle had 198 frames over 33 ms.

## Streaming under flight

`run-flight-streaming.mjs` flies a scripted camera through the real explorer and reports what the
camera faces by distance band, and how many tile builds repeated work the cache should have kept:

```sh
node test/performance/run-flight-streaming.mjs --flight=circle --tier=3 --shots=0 --label=before
```

Each band's `drawnLevel` is how fine the ground drawn there is. `complete` is measured against a
selection that coarsens at speed, so it reads the same for coarse ground as for fine; compare
`drawnLevel` when a change moves detail, and look at the screenshots. `coarsenedInView` counts
ground on screen that stepped back to a coarser level during the flight, which reads as popping;
`refinedInView` counts detail arriving.

`--params=wave=0.35` swings the autopilot's speed 35% either side of `--speed` every 20 seconds
(`wavePeriod=`), as a pilot on the throttle does: a constant speed hides what speed changes do.

`--flight` is `circle` (over Bellevue, repeated laps) or `straight` (Bellevue across the lake into
Seattle). Results go to the ignored `.artifacts/flight-streaming/`. `--tier` holds one adaptive
tier so runs compare like with like; without it Auto can change tier mid-flight. `--profile=N`
records N seconds of main-thread CPU. Runs vary, so compare several and read the flight at the
same point on its path rather than one summary number.

It needs an installed Chrome, because Playwright's Chromium finds no WebGPU adapter headless. The
flights themselves are the explorer's `?autopilot=` URL parameter, which also works by hand:
`/?mode=human&autopilot=circle&speed=250&alt=900&radius=4000`.

`admittedMsPerSecond` is the main-thread time the frame queue spent publishing streamed work per
second of flight: beside the queue's waits (`admission-wait` in the stages) it says whether the
view is short of budget or of work. `--params=admissionMs=8` holds one budget a frame, and
`--params=cull=0` turns off the renderer's tile culling, for comparison. A profiled flight
(`--profile`) streams about a third less than an unprofiled one, so compare like with like.

### A low flight at High, 2026-11-15

A P-51's line out of Boeing Field over SODO at 149 m/s and 243 m, manual High, on the NVIDIA
laptop above in headless Edge (WebGL):

```sh
node test/performance/run-flight-streaming.mjs --flight=straight --lat=47.50 --lon=-122.288 \
  --yaw=-1.94668 --speed=149 --alt=243 --quality=high --seconds=100 --channel=msedge
```

| Streaming budget a frame | 2 ms (before) | held at 4 ms | held at 8 ms | grows with the backlog |
| --- | ---: | ---: | ---: | ---: |
| Ground within 2 km finished | 16% | 81% | 96% | 90% |
| 2 to 5 km finished | 0% | 38% | 74% | 63% |
| 5 to 10 km finished | 0% | 49% | 87% | 72% |
| Layers built in 100 s | 250 | 566 | 957 | 847 |
| Mean wait in the frame queue | 3.1 s | 0.6 s | 0.13 s | 0.44 s |
| Queue work a second | about 44 ms | 82 ms | 103 ms | 100 ms |
| Frames a second | 30 | 30 | 22 | 28 |
| Triangles drawn | 2.7 M | 6.3 M | 8.4 M | 7.5 M |

Ground that is not finished shows a coarser finished tile (`stale`) in the three right-hand
columns and bare ground before. At 2 ms the frames were always busy (19 ms of main-thread work
at High), so the queue never left its smallest budget, and even a view held still was loading
24 layers after 90 seconds. The frame rate lands on 30 or 20 here (two or three display
refreshes), which makes a single flight's rate a coarse reading: a change to what a frame costs
is better measured by switching it off and on every two seconds within one flight. Measured that
way, leaving tiles outside the view out of the scene walk took the main thread's time in a
frame's render from 17-22 ms to 12-13 ms over three flights, with the same draws (two of them
with other work loading the machine, which moves both figures but not their order).

A second pass the same day took three costs off the main thread in that flight: road earthworks
for a tile's ground and ground cutting for water and bores went to the elevation worker, and
parked cars stay out of the simulation under an aircraft. Other work was loading the machine that
afternoon, so the two worker moves were measured in pairs: sixty seconds of the flight four times
in turn, one build, with the elevation source's `gradeEarthworks` and `cutGround` taken away for
the first of each pair (both then run on the main thread as before).

| | main thread | worker | main thread | worker |
| --- | ---: | ---: | ---: | ---: |
| Ground within 2 km finished | 60% | 91% | 67% | 98% |
| 2 to 5 km finished | 33% | 61% | 38% | 82% |
| 5 to 10 km finished | 51% | 73% | 45% | 88% |
| 10 to 20 km finished | 73% | 85% | 64% | 92% |
| Layers built | 306 | 509 | 356 | 620 |
| Mean wait in the frame queue | 0.97 s | 0.25 s | 0.30 s | 0.25 s |
| Frames a second | 20 | 30 | 27 | 35 |

Main-thread shares, from 40 s profiles of the same flight (one before, four after):

| | before | after |
| --- | ---: | ---: |
| Road earthworks (`transformHeightfield`) | 3.9% | 0.4 to 0.6% |
| Ground cuts (`cutGround`) | 6.7% | 1.3 to 1.8% |
| Parked cars (`EarthVehicles.sync`) | 4.1% | 0.8 to 1.1% |

In the worker a tile's earthworks took 25 to 36 ms on average (108 to 177 ms at the 95th
percentile) and a cut 29 to 37 ms (79 to 113 ms).

The cuts were the larger part. A tile's land cover over a shoreline took 46 ms to cut, and at
4 ms a frame only 48 cuts finished in 50 seconds, so the main thread spent its cut budget every
frame and most ground the flight passed still stood waiting for its cut. The parked cars were a
pass with no observer, run each time a car's model loaded, that made an entity of every parked
car in every loaded tile. At Medium most cut meshes are under 5,000 vertices and are still cut
on the main thread, in the pass that shows them (43 of 61 in the settled SODO view; 2 of 101 at
High).

A cut ground mesh also kept its vertices twice, once in the grid it was cut from. Held over SODO
at High that second copy was 174 of 1,139 MiB on show; the two now share one, and the page's array
buffers (`Runtime.getHeapUsage`'s backing storage, after a collection) fell from 1,403 to
1,233 MiB with the same 3,799 meshes drawn. That is main memory: the grid's GPU buffers stay. The
flight itself still fills the 2 GiB cache, as a cache should, and a flight's peak on show (1.4 to
1.7 GiB) is no measure of this: ground standing in for finer ground counts with it, and the peak
rises as more ground is finished.

Not done, and what each costs on the main thread in that flight: bridge profiles
(`gradeTransportSeparationSteps`, 2.6%: a worker would need the tile's roads and its neighbors'
copied to it, most of them near no bridge) and three's matrix walk of each in-view tile's static
content (about 4%). In memory, land cover carries crop-row attributes in a city with no fields,
about 52 MiB of that view; dropping them needs a second material.

### Kyoto and Osaka at High, 2026-11-21

The Kyoto region opens at Osaka Itami, and at manual High it bogged down: slow frames standing
still, and bare ground in flight. Measured on the NVIDIA laptop above (20 cores) in headless Edge
on WebGL at 1440 x 900, with other sessions loading the machine throughout, so times are rough
and counts are exact.

What the start view is made of once it has settled (Itami from 1,400 m, High): 1,840 draws and
16.6 million triangles a frame, 3.9 million of them the sun's shadow pass; 77,500 buildings and
12,900 street lamps on show; land cover 6.8 million triangles, ground 4.1, buildings 3.9,
sidewalks and curbs 3.6, roads 2.2, and plants 1.7 million in 1,665 instanced batches. A tile's
buildings take a worker 1.2 to 1.5 s on average (about 0.5 s in the Seattle flights above), and
the three generation workers ran 98% busy while every other pool idled.

| The start view, held (daylight) | before | after |
| --- | ---: | ---: |
| First view finished | 120 s | 60 s |
| Settled: frames a second | 16-19 | 29-33 |
| Settled: main-thread work a frame | 43-58 ms | 32-34 ms |
| Settled: GPU time a frame | 30 ms | 20 ms |
| A tile's buildings, from request (mean / 95th) | 8.6 / 22 s | 4.4 / 11.7 s |
| Frames over 100 ms in the first 130 s | 122 | 21 |

| Itami to Osaka at 120 m/s and 300 m, at night | before | after |
| --- | ---: | ---: |
| Ground within 2 km finished | 9% | 91% |
| 2 to 5 km finished | 0% | 37% |
| Frames a second | 16.8 | 21.6 |
| Triangles drawn | 2.9 M | 9.5 M |
| Mean wait in the frame queue (95th) | 1.4 s (7.4 s) | 0.4 s (1.5 s) |
| Roads and buildings layer, from request (95th) | 30 s (86 s) | 6.2 s (13.5 s) |
| A cell of buildings assembled on the main thread | 20 ms | 3.4 ms |

The night flight is the region's default for a visitor in the Americas: the explorer opens at
noon in the visitor's own time zone, which is before dawn in Japan.

What changed, with what each was measured to cost before:

- The sun's focused shadow map stands between drawings while its texels are coarse, and all night
  (`holdShadows`, `?shadowHold=0`). From 1,400 m it was drawn every frame over a 10 km square: a
  frame's render took 48 ms of main thread with it and 24 ms without, GPU time 44 against 21 ms,
  compared in two runs a few minutes apart. At night it was drawn for a sun below the horizon,
  97 ms of each second of the flight.
- Five generation workers from 20 logical cores instead of three: the first view finished in 64 s
  instead of 93 s with nothing else changed, with fewer long frames.
- Night street lights are chosen from the lamps within reach four times a second, not from every
  lamp on show every frame (51 ms a second); traffic signal lenses advance ten times a second and
  only where they are drawn (17 ms a second).
- Lit window panes are grouped with integer arrays instead of a `Map` and a string per vertex
  (44 ms a second of building assembly, day or night, and its garbage).
- The terrain stream's visibility pass looks each displayed tile up once per pass instead of
  once per selected tile (110 ms a second in the flight, 40 after, with three times the ground
  on show).
- A slot of an invented street frontage that a mapped building already stands on is told before
  its street census (identical output on twelve Osaka and Kyoto tiles).

Then, the same day, bridge and viaduct grading moved to the elevation worker
(`TerrainPyramidHeightSource.gradeSeparations`). Osaka is full of both, and once the changes
above let streaming keep up, working their heights out on the main thread took 139 ms of each
second of the flight, in single steps of up to 260 ms. Now 8 ms a second is left there (cutting
the roads to their tiles and packing them). The flight flown four times in turn with one build,
the grading sent back to the main thread for the first of each pair:

| | main thread | worker | main thread | worker |
| --- | ---: | ---: | ---: | ---: |
| Frames a second, in three stretches of flight | 23 / 21 / 20 | 25 / 24 / 24 | 22 / 23 / 21 | 24 / 23 / 24 |
| Ground 2 to 5 km ahead finished | 46 / 48 / 32% | 51 / 54 / 39% | 36 / 32 / 12% | 50 / 58 / 39% |
| Roads and buildings layer, from request | 5.8 s | 5.3 s | 5.8 s | 5.1 s |
| Water layer, from request (waits for the ground) | 1.1 s | 1.1 s | 1.3 s | 1.1 s |

The worker graded 270 to 300 tiles a flight at 70 ms each (210 ms at the 95th percentile),
beside 260 tiles of earthworks at 60 to 70 ms: ground tiles came no later for it. On 54 tiles
of Osaka and Kyoto interchanges the profiles are the same to the last bit as before, on the
main thread and through the worker (276,223 samples), once the blend along tile edges sums the
tiles around in a fixed order: it summed them in the order their gradings finished, which moved
a height by a rounding error from one visit to the next.

### Second pass, 2026-11-22

Measured again with the machine quiet (the numbers above were taken with other work loading it),
same views, WebGL at 1440 x 900 and a pixel ratio of 1, which is what the explorer's manual
qualities draw at on this laptop's 2880 x 1800 panel. Timings without a profiler attached: with
one, three's scene walk reads three to five times its real cost.

| Where it stood | |
| --- | ---: |
| Start view, first view finished | 41-47 s |
| Start view, settled | 20-21 ms a frame (48-50 a second) |
| of which the main thread's render / the GPU | 16.3 / 15.2 ms |
| Central Osaka from 300 m, held | 24 ms a frame (42-45 a second) |
| Itami to Osaka at 120 m/s, 300 m, daylight | 30 frames a second |
| Workers in that flight (busiest of each pool) | generation 46%, roads 68%, elevation 33% |
| Main thread in that flight | 92% busy, 57% of it rendering |

The workers have room now; the main thread is what a flight waits on. Two things changed.

**Plant sets that draw nothing leave the scene walk.** Of the 11,600 objects three walked for
the start view, 4,700 were plant batches that could draw nothing from there: ground cover, which
is most of a garden's species and draws only within about 165 m. Each hid its own mesh, and was
still visited every frame to do it again. A set now decides for its batches, and the group a
tile's sets stand in decides for the sets (`PlacementSetGroup`), so they cost the walk nothing.
What is drawn is the same (1,388 draws, 12.6 million triangles either way).

| Start view, settled | before | after |
| --- | ---: | ---: |
| Objects walked a frame | 11,632 | 6,945 |
| Main thread's render | 16.3 ms | 13.6-15.0 ms |
| Frame | 19.8-21.0 ms | 17.2-18.8 ms |

**Ground behind the aircraft gives up its detail before memory runs over.** Detail already
drawn is kept on ground the camera has left, so that a look back finds it, and nothing let it
go: the flight ended with 104 of the finest tiles out of view holding 2.7 GiB, 3.9 GiB of
geometry in all against a 2 GiB budget, where arriving at the same spot fresh holds 1.4 GiB.
With what is on show over its budget the stream stops preparing ground ahead. Now, past 85% of
the budget, ground out of view gives that detail up, the farthest first.

| The flight | before | after both |
| --- | ---: | ---: |
| Frames a second | 30.0 | 32.4, 34.6 |
| Frames over 100 ms | 23 | 12 |
| Ground 2 to 5 km ahead finished, mean over the flight | 57%, 61% | 69%, 70% |
| Buffers on show at the end | 3.5-3.8 GiB | 1.5-1.7 GiB |
| Geometry resident at the end | 3.9 GiB | 1.9-2.0 GiB |
| Preparing ahead suspended for memory | from 40 s in | never |

A 3 km circle over Osaka looks the same with and without it (frames compared at the same
moments), ends with 2.0 GiB resident instead of 2.7 GiB and climbing, and evicts fewer tiles
(577 against 675).

**Evicted tiles were never collected.** The page's script heap still read 5.8 GiB after either
flight, and 2.6 GiB after a collection forced from outside a frame. That was not the browser
being slow: traced, the main thread ran eighteen major collections in a 150 s flight and the
page's typed arrays grew through all of them by exactly what the stream had evicted (4.7 GiB),
to 6.9 GiB with 2.0 GiB resident. Lists of weak references that are walked every frame kept
them: `deref()` keeps its target until the current job ends, a frame here is busy enough that
collections finish inside its job, and one object keeps its whole tile through `parent`. A page
that drops a 1 MiB buffer twice a frame shows it alone: walked with `deref()` every frame, none
of 5,522 were ever collected; never walked, or walked every 2 s, all but the latest were. The
renderer walked every render group ever made, the ground cuts every ground mesh and opening,
and the decoded-tile cache every older tile on each load. Now the renderer holds only groups
that have a parent, disposed terrain content leaves the terrain's lists at once
(`retireTerrainObjects`), and the tile cache prunes itself with a `FinalizationRegistry`.

| The flight, 150 s | before | after |
| --- | ---: | ---: |
| Evicted tiles the browser collected by itself | none (arrays grew by all 4.7 GiB evicted) | 312 of 368 |
| Typed arrays at the end (2.0 GiB resident) | 6.9 GiB | 3.6 GiB |
| Typed arrays after the first minute | 4.3 to 6.9 GiB, rising | 2.9 to 4.0 GiB, level |
| Longest frame | 500 ms | 242 ms |

What is left between collections is ordinary: a major collection every 20 to 30 s, and up to
2 GiB evicted in between. Four minutes round a 3 km circle evicted 753 tiles (5.3 GiB of their
own buffers); the browser had collected 665 of them by the end, and the typed arrays stayed
between 2.6 and 4.0 GiB throughout.

Measured and left, largest first:

- Plants that do draw: 730 draws of 46 instances each on average in the start view, one batch
  for each species in each tile (or quarter of a finest tile). With every plant hidden the
  render is 8 ms instead of 14 and the GPU 10.7 ms instead of 16. Fewer, larger batches for the
  far levels, where every batch of a tile draws the same level.
- Triangles: the start view draws 12.7 million onto 1.3 million pixels. Land cover is 6.8 million
  of what is resident (79,000 a tile) and 5.7 ms of the GPU's 16; sidewalks and curbs 3.6 million,
  kilometers out. Each is built at its tile's full resolution whatever the distance. This is what
  bounds a view drawn at the panel's own pixel ratio, as the Earth view draws High: at
  2880 x 1800 the same view is 24.7 ms a frame, the GPU 24.0 ms.
- The flight's main thread besides rendering: streamed work admitted to frames 99 ms a second,
  the stream's visibility passes 83, copying requests to workers 30 (a tile's features cloned
  for the generation worker), garbage collection 22, and content hashes for the generation
  cache 17.
- WebGPU: the same start view takes 51 ms of main thread a frame (15 a second) against 16 on
  WebGL.
- First view: 41-47 s to finish the start view at High, nearly all of it building generation.
- WebGL draws with logarithmic depth where the canvas depth buffer is fixed point (for depth
  fighting on distant roads). On a 400 m view toward Osaka the GPU's best frame was 32 and 46 ms
  with it and 27 and 28 ms with reversed depth, in two pairs of runs under load: hidden fragments
  are no longer rejected before they are shaded. Not measured again this pass.
- Zoom-14 tiles here carry few mapped buildings (the basemap drops small ones), so street
  frontage infill invents about 1,500 a tile, which the mapped ones replace on approach: a
  second of worker time a tile.
- In a sustained flight the coarse tile that should take over behind the aircraft never gets
  its water built (out-of-view layers start last, and there is always work ahead), so the trail
  of fine tiles stays until memory presses. Harmless below the limit above, apart from the tiles
  it keeps in every pass.

### Auto's steps under a piloted flight, 2026-11-24

A P-51 over Seattle and Bellevue at Auto (253-285 kt, 60-300 m above the ground) drew box shells
with no roads beneath the aircraft, and ground already detailed gave way to coarser tiles and was
built again. A camera flown along the same lines, and through turns, descents and speed changes
(a north-east-west sortie over Seattle and Bellevue, and three full turns over downtown), showed
what it was.

- It was not tile throughput. With the level unchanged, the ground in view within 1 km of the
  camera was at its selected detail (the finest level) throughout, at 140-160 m/s, on a quiet
  machine and with other work using 7 to 12 of its 20 cores; from 1 to 1.5 km it was too, but for
  the seconds after a turn began (73% of it at worst). On straight legs most finest tiles were
  built before the view selected them; in the turns one took 1.4 s from selected to shown (2.8 s
  at the 90th percentile).
- It was Auto. Frames under 30 a second for ten seconds lowered a level, and another did half a
  minute later. At Low the view itself asks for level 13 of 15 near the aircraft (its 24 tiles
  cannot reach further), which is box shells and no roads; the stream calls that finished, and a
  minute of calm brings the levels back to be built again. The slow frames came from the
  machine, not the place: the explorer wants about 15 threads while it streams.
- The same two steps with the world held (see
  [Adaptive rendering performance](../../../../docs-src/guide/adaptive-performance.md)): ground
  within 1.5 km at the finest level throughout. The frame rate went from 25-28 to 41-50 a second
  over the two steps, with the other work on the machine easing over the same minute (12 cores
  to 8), so not all of that is the steps.
- Turning over one place rebuilds it. Three full turns over downtown Seattle at Balanced built
  480 tiles, 209 of them again and 190 within a minute of their eviction: a lap's ground is more
  than the warm cache's half of the budget holds (about 1 GiB hidden, with 1.1-1.5 GiB resident
  against a budget of 2.0). The building output cache answered half the building requests; land cover, road
  surfaces and graded ground have no such cache and were made again. The near ground stayed
  finished throughout, so this no longer counts as streaming strain; it is still two fifths of
  the stream's work in a turn.
- Zoom-14 tiles are generated in full and replaced on approach: 74 s of building generation
  against 166 s for the zoom-15 tiles in the same 150 s of flight.
- A tile's layer waited for its prop sets one frame's turn at a time. Each set of street props or
  plants was queued for the frame only after the last had run (about 5,300 such jobs in 150 s of
  flight, a quarter of all the frame queue's, each 0.3 ms of work after 130 ms of waiting), so a
  layer whose workers had finished in two seconds spent as long again waiting in line, and a
  minute or two when the queue ran seconds behind: buildings layers reached the 120 s deadline
  with all their geometry made. Queued together (`instancedProps`), the same sortie under similar
  load built a buildings layer in 1.7 s on average instead of 2.6 (3.8 s instead of 7.2 at the
  95th percentile) and a land-cover layer in 1.3 s instead of 3.2 (3.1 s instead of 11.1), and
  none reached the deadline. The worker pools were also a third quicker in the second flight, so
  part of that is the machine.

Measuring it took more care than the change. A browser without a window is a background process
to the system: on battery every worker job ran 20 to 100 times slower (a tile's ground 22 s, its
buildings 21 s) while frames held 45-65 a second, and the first view never finished. Run flights
on mains power, look at what else the machine is doing first, and do not compare runs across
either. `run-flight-streaming.mjs` now asks the browser not to treat its page as a background one.

# Landmark performance evaluation

**Decision, 2026-10-03:** keep the high-detail source masters, but develop separately
streamable runtime LODs before continuing bulk authoring. Ordinary laptops and
phones/tablets are the target. Full-detail masters are currently too expensive to
be the default representation for a downtown view. Model creation remains paused.

## What was measured

This section records the full-master baseline taken before runtime streaming was added.
The implementation and follow-up measurements are described under **Runtime rollout** below.

The audit selects Istanbul Sapphire plus the 40 other built skyscraper assets
closest to 10,000,000 bytes. This is a synthetic mixed-city stress scene, not an
actual city's skyline. The other 40 average **17.8 MB**; this is heavier than the
user's hypothetical 40 × 10 MB plus an 80 MB landmark. File sizes below use decimal MB.

| Workload | Raw GLBs | gzip level 6 | Brotli quality 5 | Expanded scene triangles |
| --- | ---: | ---: | ---: | ---: |
| Sapphire | 79.53 MB | 16.75 MB | 8.46 MB | 1.55 million |
| Sapphire + 8 towers | 153.62 MB | 33.97 MB | 20.05 MB | 4.88 million |
| Sapphire + 40 towers | 791.66 MB | 176.56 MB | 119.29 MB | 13.17 million |

These compression sizes were measured from the actual files. They do not imply
that the current HTTP host serves compressed GLBs. ZIP/tar release packs for
developer restoration and individually streamed runtime assets are different things.

At an ideal **25 Mbps**, the 41-model group takes 253 seconds raw, **56.5 seconds
gzip**, or **38.2 seconds Brotli** just to transfer. At 100 Mbps, those compressed
transfers still take 14.1 and 9.5 seconds. Latency, competing downloads,
decompression and GPU preparation add time. The hypothetical 480 MB raw group
takes 153.6 seconds at 25 Mbps or 38.4 seconds at 100 Mbps.

### Browser pilot: useful diagnostic, not device certification

Hardware: Windows, **AMD Radeon AI PRO R9700**, Chromium 153, ANGLE Direct3D11,
1440 × 900 at device scale 1. The browser reports 32 logical processors and 32 GB
device memory. This is a workstation, not our target laptop or phone. The runner
rejects SwiftShader/software renderers; its initial software run was stopped.

The fixture uses Molen's actual `StructureModelLibrary`, shared material resolver,
and GLTFLoader. It loads two models concurrently, uses two material workers and
shows fallback materials while they bake. Only used surfaces are prepared.
Downloads are uncompressed **loopback HTTP**, with cold browser requests and warm
OS file caches. There is no terrain, traffic, atmosphere, reflection map or tile
scheduler. A 30-frame warm-up precedes each 120-frame sample. GPU duration uses
disjoint timer queries; CPU submission duration and RAF intervals are separate.

| Metric, progressive materials, no shadows | Sapphire | Sapphire + 40 |
| --- | ---: | ---: |
| First model attached to scene | 191 ms | 61 ms |
| All geometry attached / loading loop complete | 390 ms | 2,247 ms |
| Used shared materials ready | 3,176 ms | 7,358 ms |
| CPU backing buffers for scene geometry | 79.50 MB | 792.41 MB |
| Estimated GPU attribute buffers for scene geometry | 147.62 MB | 1,487.18 MB |
| Draw calls, skyline color pass | 116 | 426 |
| Rendered triangles, including transparent extra passes and ground | 1.57 million | 13.20 million |
| GPU frame duration median / p95 | 0.41 / 0.42 ms | 2.61 / 3.42 ms |
| CPU render submission p95 | 1.0 ms | 2.3 ms |
| GPU texture count | 14 | 28 |

The workstation sustained approximately 60 Hz. This is **not evidence that mobile
will sustain 60 Hz**. GPU buffer bytes are calculated from distinct Three.js
attribute/interleaved-buffer objects; they are not a driver VRAM reading. CPU
bytes count unique backing ArrayBuffers. Neither includes all parser temporaries,
JS objects, textures, render targets, the rest of the world or driver overhead.

With one 2048-pixel directional shadow map, the 41-model workload rose to **816
draw calls and 26.38 million rendered triangles** across the shadow and color
passes. GPU time was 4.78 ms median / 4.79 ms p95 before the pan, versus 2.61 /
3.42 ms without shadows. The p95 after the pan was 6.29 ms. These are short single
runs; use repeated physical-device runs for release acceptance.

The retained [measurement snapshot](./measurements-2026-10-03.json) includes model
IDs/hashes, compressed sizes, device metadata, timing summaries and disposal
results. The fixture screenshot and full raw runs remain in the local artifact
directory below.

A 20-degree camera pan caused zero new loads in this resident-scene fixture. All
390 model geometries were disposed on release, leaving one ground geometry.
This verifies the library's basic retention/disposal behavior. It does **not**
reproduce or resolve the previously reported Earth tile-selection churn.

The blocking, in-thread material path used by the existing review fixture took
5.17 seconds for Sapphire and 12.63 seconds for 41 models, with startup frame gaps
up to 1.68 seconds. The progressive worker pilot reduced geometry startup and
long tasks substantially. Do not attribute the blocking review timings to the
worker-enabled Earth viewer: it already supports progressive materials.

## Baseline implementation findings

1. **The baseline had no runtime LOD selection for geographic models.**
   `packages/worldgen-earth/src/client/renderers.ts` acquires the full geographic
   asset through `StructureModelLibrary`. Tile level gating is not model LOD.
   The procedural/`builtin:` landmark LOD path is separate. Merely storing LODs
   inside the same large GLB would still download that large file.
2. **GPU buffers are larger than GLB size.** Our mixed Float32/Uint8 interleaved
   vertex layout makes Three's GLTFLoader construct separate interleaved buffers
   per component type. WebGL uploads both. Separate color storage or compatible
   layouts can remove this duplication without losing architectural detail.
   Confirmed in the installed Three 0.184 loader and WebGLAttributes implementation.
3. **Memory pressure is partly accounted for already.** The terrain pyramid
   traverses tile mesh attributes and deduplicates CPU backing buffers, including
   attached landmarks. It does not measure the duplicated GPU buffers above or
   texture allocations. `StructureModelLibrary` has reference counts but no
   independent byte budget, LOD scheduler or global load-concurrency budget.
4. **Shared surfaces help, but geometry dominates these models.** Sapphire has
   no embedded images. It has 947,096 stored triangles and 1,547,192 triangles
   after instancing. Tiny seals, frames and layered glazing are still drawn when
   most are subpixel. Existing sidecar vertex totals also overcount shared
   accessors; use deduplicated counts and expanded draw counts separately.
5. **Unloading and downloading are separate policies.** The URL asset provider
   fetches whole selected GLBs. The pack reader has a bounded decoded-byte cache
   (16 MiB default). Neither automatically turns a full-resolution asset into a
   small initial download. The view should retain useful nearby LODs across pans
   while canceling obsolete detail upgrades.

## Proposed initial budgets

These are **engineering targets to validate on physical devices**, not measured
device capabilities. The implemented limits are recorded below. MB budgets use decimal
bytes. Landmark allocations below leave room for terrain, roads, vegetation,
textures, the application and temporary loading allocations.

| Budget | Phones/tablets | Ordinary laptops |
| --- | ---: | ---: |
| Steady full-view target | 30 fps; p95 frame ≤33.3 ms | 60 fps; p95 frame ≤16.7 ms |
| First useful skyline, 25 Mbps / 80 ms RTT | ≤3 seconds | ≤3 seconds |
| Initial landmark transfer for a view | ≤3 MB compressed | ≤6 MB compressed |
| Resident landmark GPU attributes | ≤64 MB | ≤192 MB |
| Resident landmark CPU backing buffers | ≤64 MB | ≤192 MB |
| Shared architectural texture working set | ≤32 MB | ≤64 MB |
| Visible landmark color-pass triangles | ≤350,000 | ≤1,000,000 |
| Landmark color-pass draw calls | ≤100 | ≤200 |
| Total world color-pass triangles, starting target | ≤1.5 million | ≤4 million |
| Simultaneous detail fetches / upload allowance per frame | 2 / 2 ms | 4 / 4 ms |

Evaluate complete GPU frame time with shadows and transparency; color-pass
triangle counts alone are insufficient. Upgrade only within byte, triangle and
frame-time budgets. A single large landmark cannot consume the whole view budget.

### Source-derived runtime representations

| Representation | Typical triangle target per model | Typical compressed transfer | Use |
| --- | ---: | ---: | --- |
| Skyline | 200–1,500 | 10–50 KB | First visible silhouette, roof and signature features |
| District | 2,000–8,000 | 50–200 KB | Recognizable facade rhythm and major setbacks |
| Street | 10,000–40,000 | 0.2–0.8 MB | Nearby architecture and entrances |
| Close-up | 60,000–150,000 | 0.8–3 MB | Selected/very close landmark, budget permitting |
| Source master | Preserve the authored detail | Not automatically streamed | Generation, inspection, future stronger devices |

Use screen-space error and hysteresis rather than hardcoded distance alone.
Preserve a building's silhouette, crown, bridges and distinctive openings at each
LOD. Replace subpixel frames/seals with shared material detail, instance genuinely
repeated elements, and simplify overlapping glass at distance. Compression does
not remove triangles or solve transparent overdraw. Optional mesh compression
requires configured runtime decoders and separate decoded-memory validation.

## Runtime rollout

The default Earth viewer now uses `StructureLodStreamer` and four independent files per
registered structure: skyline, district, street and closeup. The source masters remain intact.
The asset build derives these files after importing the masters, and the normal lock/release
workflow pins them. Runtime sidecars record measured costs and source/recipe hashes.

The streamer prioritizes nearby placements, reserves geometry memory, cancels obsolete loads,
applies screen-space selection with hysteresis, and keeps visible instances until replacements
are prepared. A five-second warm cache helps revisits. Transform, elevation and bridge clipping
are reapplied to every level. Pure camera rotation does not change distance-based priority.

| Enforced allowance | Phone/tablet preset | Laptop preset |
| --- | ---: | ---: |
| Resident skyline payloads, raw bytes | 3 MB | 6 MB |
| Geometry CPU / estimated GPU buffers | 64 / 64 MB | 192 / 192 MB |
| Shared worldgen texture estimate, including mipmaps | 16 MB | 48 MB |
| Triangles / draw calls, with 2× nominal cost reserved | 350,000 / 100 | 1,000,000 / 200 |
| Concurrent model loads | 2 | 4 |
| Cooperative preparation time | 2 ms/frame | 4 ms/frame |

The payload allowance covers the active skyline set, not cumulative travel downloads, pack
metadata or later upgrades. It is conservative for hosts that compress HTTP responses.
The two geometry pools exclude transport caches, parser temporaries, JavaScript objects, driver
overhead, textures and the rest of the world. Texture accounting is an estimate, not a driver
reading. Preparation yields between instances; one indivisible parse or GPU upload can exceed
the time allowance. These limits are not frame-rate certification.

Skyline meshes use local convex source pieces and vertex colors without textures. They are
coarse silhouettes: fine openings, roof details and slender parts can be lost. More detailed
levels use conservative source reduction and retain shared material references. Their triangle
targets are advisory. Forcing every disconnected architectural mesh down to the original target
damaged facades in comparison renders, so the recipe keeps extra geometry when needed. Some
large stadiums remain expensive and will stay coarse on constrained devices. Source-authored
LODs remain the route to higher detail for those cases; this rollout does not certify every
model's four levels as visually finished.

All runtime variants use separate attribute streams. This fixes the mixed Float32/Uint8 upload
duplication without changing the canonical imports. Detailed levels contain shared material
references; embedded portable fallback images are removed only from these derived files.

### Follow-up measurements, 2026-10-03

The same 41-model synthetic scene now uses the actual streamer with each device preset.
These runs used the workstation described above, with unthrottled loopback HTTP, no shadows
and two material workers. Other repository checks ran concurrently, so timing numbers are
diagnostic single samples. They are not measurements of phone or laptop hardware.

| Metric | Phone/tablet preset | Laptop preset |
| --- | ---: | ---: |
| Initial skyline GLBs, raw bytes | **0.591 MB** | **0.591 MB** |
| Initial geometry attached / loading loop complete | 446 ms | 443 ms |
| Settled geometry CPU buffers | 8.59 MB | 43.79 MB |
| Settled geometry GPU buffer estimate | 8.59 MB | 43.79 MB |
| Shared texture estimate after the pan | 3.50 MB | 6.29 MB |
| Settled levels | 39 skyline + 2 district | 34 skyline + 7 district |
| Rendered triangles / draws, including ground and transparency | 158,377 / 52 | 497,344 / 77 |
| Additional model loads during a 20° rotation in place | **0** | **0** |
| Model geometries disposed at cleanup | 62 / 62 | 119 / 119 |

Initial GLB payload is below both download targets even without HTTP compression. Sidecars,
pack metadata and subsequent upgrades are additional traffic. The pan retained the same model
levels and geometry allocations. These results exercise model retention in this fixture;
Earth terrain/tile churn and extended travel still require the acceptance runs below.

The retained [streaming measurement snapshot](./streaming-measurements-2026-10-03.json) records
the source and derivative hashes, device details, timing percentiles,
geometry accounting and cleanup results. The original full-master snapshot remains separate.

The retrofit covers **343 registered structures and 1,372 runtime GLBs**. All derivatives passed
Khronos validation with **zero errors and zero warnings**, plus source/recipe/file hash checks,
shared-material checks and vertex-layout checks. A source rebuild reproduced all **774 existing
GLBs** unchanged before adding the derivatives. The final source/LOD lock is
`assets-e7d2334ddbf528a5`; outputs remain generated files outside Git.

The largest skyline file is **49.2 KB**. The largest district, street and close-up files are still
**60.57 MB, 98.12 MB and 126.84 MB**, respectively. **570 tier outputs exceed advisory triangle
targets**. The loader admits upgrades only within its budgets; source-specific reductions are
still needed to make the expensive tiers practical on smaller devices. Selected comparison
renders checked Space Needle, Sapphire, Stari Most, SR-520 and Mordovia Arena; they do not
constitute complete visual approval of the catalog.

### Remaining acceptance work

1. Review additional silhouettes and author tighter district/street levels for models that
   exceed their advisory targets. Compare source, silhouette, materials and nearby views.
2. Run this fixture on an integrated-GPU laptop, a representative Android phone,
   and Safari on an iPhone/iPad. Then run the full Earth viewer with terrain,
   traffic, reflections and shadows: cold/warm start, 20-degree pan, travel across
   tiles, revisit, and ten minutes of movement. Measure memory plateaus and thermal
   behavior. A smaller desktop viewport or CPU throttling is not a phone GPU test.
3. Resume bulk authoring after the source-to-LOD path meets those budgets. Require
   silhouette/material comparisons and startup/residency checks at batch milestones.

This follows the per-pixel memory budgeting and explicit resource management
approach in [MDN's WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices).

## Reproduce without regenerating models

Use the existing package builds and generated assets. No model generation,
repository-wide verification or npm audit is part of this experiment.

```powershell
node examples/world-explorer/test/performance/audit-landmarks.mjs
$env:PLAYWRIGHT_BROWSERS_PATH = 'D:/gh/molen/.artifacts/playwright'
node examples/world-explorer/test/performance/run-landmarks.mjs
node examples/world-explorer/test/performance/run-landmarks.mjs --counts=41 --shadows
node examples/world-explorer/test/performance/run-landmarks.mjs --counts=41 --streaming=phone
node examples/world-explorer/test/performance/run-landmarks.mjs --counts=41 --streaming=laptop
node examples/world-explorer/test/performance/review-lods.mjs --ids=istanbul_sapphire,stari_most,mordovia_arena,sr_520_floating_bridge
```

`--sync-materials` reproduces the blocking review path. `--small-viewport` uses
960 × 540 but does not emulate mobile hardware. The optional `--counts=1,9,41`
selects workloads. The audit rejects outputs whose sidecar hashes are stale.
Reports and screenshots go to `.artifacts/landmark-performance/`.

For a physical device on your trusted LAN, explicitly opt into LAN serving:

```powershell
node examples/world-explorer/test/performance/run-landmarks.mjs --serve --host=0.0.0.0
```

Visit `http://<this-computer-LAN-address>:5239/landmarks.html?count=1`, then 9 and
41 if smaller cases fit the device. Add `&streaming=phone` or `&streaming=laptop` to test
the actual scheduler, or `&lod=skyline` for a fixed level. `&shadows=1` adds shadows. The page
has a finish button followed by a download button for JSON measurements. Stop
the server with Ctrl+C. The default host is loopback only; do not expose this
development server to the public internet.

Targeted harness checks:

```powershell
pnpm --filter @bendyline/molen-examples-world-explorer exec tsc -p test/performance/tsconfig.json
pnpm exec biome check examples/world-explorer/test/performance
```
