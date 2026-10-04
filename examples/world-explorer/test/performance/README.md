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
node examples/world-explorer/test/performance/review-lods.mjs --ids=n0229_istanbul_sapphire,n0001_stari_most,n0695_mordovia_arena,sr_520_floating_bridge
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
