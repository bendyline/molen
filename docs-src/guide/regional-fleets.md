# Regional vehicle fleets

Earth traffic and parked cars share a small fleet catalog. It assigns relative weights to existing
vehicle type IDs and contains no models. China, Japan, Korea, several European, South American and
African markets, and North America have separate mixtures. These are visual approximations, not
sales or registration statistics. Unknown areas use a global fallback. Aircraft and ships keep
their independent global pools.

## Content and selection

Publish `molen/fleet-catalog@1` documents through `provides.fleet` in a content pack. The stock
catalog is `content/entities/fleets/road.json`. Each has `id`, integer `version`, `description`,
`fallback`, atlas `regions` bindings, and named `profiles` with `title`, optional `extends`, and
`weights`. All parents and bindings in a standalone document must resolve. Positive weights are
relative prevalence; zero excludes an inherited model. Missing models are filtered against the
loaded type library. Cycles and duplicate profile IDs or region bindings are rejected.

```json
{
  "format": "molen/fleet-catalog@1",
  "id": "example.fleet",
  "version": 1,
  "description": "Illustrative road mix",
  "fallback": "global",
  "regions": { "library.china": "china" },
  "profiles": [
    { "id": "global", "title": "Global", "weights": { "example.compact": 1 } },
    { "id": "china", "title": "China", "extends": "global", "weights": {
      "example.seagull": 12, "example.qin": 10, "example.compact": 0.5
    } }
  ]
}
```

`createFleetLibrary` from `@bendyline/molen-ambient/kernel` resolves inheritance and makes a stable
weighted shortlist: default 16 distinct models per profile, retaining the four most common types
and sampling the rest without replacement. The profile name seeds selection; camera movement,
download completion and property order do not change it. Paint palettes add variety without more
geometry. A model can appear in many profiles through the same asset ID.

`loadEarthContent` reads fleet metadata and the Earth atlas even when architectural styling is
disabled. `createEarthFleet` from `@bendyline/molen-earth` resolves only fleet-bound atlas regions,
so a local architectural overlay cannot hide its country's fleet. Moving traffic chooses at its
spawn position. Parking chooses at the terrain tile center and passes weighted specifications and
colors into both synchronous and worker generation; border parking follows the tile's profile.
Existing traffic changes naturally through despawning, without replacing a car being watched.

`mountEarthView` wires this automatically. Set `fleet: { maxModels: 12 }` for a smaller shortlist
(valid range 1–128). Custom hosts pass `fleet.carsAt` to `EarthAmbient`/`installAmbient`, and
`fleet.parkedAt` as the third argument of `createTerrainSurfaceRenderer`. Hosts without fleet
content retain their original behavior.

## Downloads and residency

World Explorer builds an entity archive for distribution and a versioned directory manifest for
browser use. The index points to `molen-pack.json`, so even a static server without HTTP Range
downloads only requested GLBs. Opening the catalog fetches no GLBs; distant traffic and parking
use lightweight proxies with shaped hoods, sloped windows, painted roofs and visible wheels.
The shared car silhouette uses 148 triangles and one material, with no model download.
Explicit player selection may load any vehicle. Node pack hosting also accepts a hosted directory
index. Content hashes identify shared files in the Earth byte cache.

Directory reads share transfers. Cancelling one reader preserves another reader's request; when
the last reader cancels, queued or active work is aborted. Failed/aborted reads can retry. The
directory pack's byte cache defaults to 16 MiB with least-recently-used eviction. Browser HTTP and
IndexedDB storage are separate from decoded Three.js models.

The ambient detailed vehicle pool defaults to four idle instances, two concurrent loads and
32 MiB of estimated geometry/decoded-texture buffers. Active count also respects `detailedCars`.
Cars and boats have separate bounded pools. Idle instances are evicted least recently used first;
a model that would exceed the byte budget stays a proxy. Eviction disposes geometry, material
clones and textures; late loads after cancellation or disposal are discarded. GPU bookkeeping,
JS object overhead and temporary decoding allocations are outside this estimate, so it is a
residency budget rather than a process-wide memory ceiling.

Configure `idleVehicleModels`, `vehicleModelBytes`, and `vehicleLoads` on `EarthAmbientSettings`
or `AmbientRenderBudget`. Zero idle retention is supported. Parking independently loads at most
eight nearby detailed cars with two background requests. Both parking and traffic request full
car models within 45 metres and retain selected models out to 65 metres, subject to their count
and residency budgets. This hysteresis prevents repeated swaps at the approach threshold.
Driven cars retain simulation state but release their model outside the near set. The mounted car
and explicitly host-owned cars are
exceptions, owned until removal. Aircraft keep their existing budget.

## Coverage and authoring

The initial expansion adds 24 shared models, predominantly 2024 plus the 2025 four-door Wuling
Hongguang MINI EV. Profiles also reuse older and US-market models. Country-specific trim,
steering variants, fleet age distributions and local commercial coverage remain approximate.
The atlas groups the Korean peninsula; that fleet profile primarily represents South Korea.
Some shared models use export-market bodies or steering layouts. Road driving side comes from
Earth's country sign geography, shared by traffic, markings and signals; an explicit ambient
`drivingSide` overrides it. Fleet prevalence does not change traffic rules. Unbound regions fall back.

Add a model once and reference its ID in appropriate profiles. Preserve older cars and several
body classes. Every drivable model follows [Medium-fi](medium-fi.md) close-view requirements:
clear driver sightlines, modeled cabin and controls, named moving wheels/steering, glazing,
coherent lamps and panel details. Keep bulk captures local. The entities pack's
`REGIONAL-VEHICLES.md` and `regional-vehicles-review.json` hold the roster and hash-bound review.
