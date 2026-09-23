# Design plan (historical)

> **This folder is Molen's original design plan, not its documentation.** It was written before
> the code, is not maintained alongside it, and may lag it: some pieces were built differently,
> renamed or never built. For example, releases use semantic-release rather than changesets, and
> there is no `@bendyline/molen-docs` package. The shipped truth is [`docs-src/`](../docs-src) and
> [`packages/`](../packages), published at [molen.dev](https://molen.dev). When they disagree with
> this folder, trust them.

The plan is kept because it records the reasoning behind the architecture: why the kernel and
client are split, how determinism and snapshots were designed, and what was deliberately left out.
Citations such as "brief §4" refer to the original project brief, which is not part of this
repository.

| File | Covers |
|---|---|
| [01-architecture.md](01-architecture.md) | System overview, responsibilities, message flow and tick timing |
| [02-packages-and-apis.md](02-packages-and-apis.md) | Package boundaries and public API sketches |
| [03-data-formats.md](03-data-formats.md) | Data format specs |
| [04-kernel-design.md](04-kernel-design.md) | ECS, tick model, commands, snapshots, determinism and scripting |
| [05-client-design.md](05-client-design.md) | three.js layer, state sync, cameras, terrain streaming and headless screenshots |
| [06-materials-and-assets.md](06-materials-and-assets.md) | Materials and the asset pipeline |
| [07-tooling-and-testing.md](07-tooling-and-testing.md) | Tooling, build, testing and docs |
| [08-phase-plan.md](08-phase-plan.md) | The phased milestone plan |
| [09-questions-and-risks.md](09-questions-and-risks.md) | Open questions and risks |
| [10-earth-terrain.md](10-earth-terrain.md) | Earth terrain mode |
| [10-networking-design.md](10-networking-design.md) | Networking (design only) |
| [11-3d-model-assets.md](11-3d-model-assets.md) | 3D model assets |

`molen docs search` leaves this folder out by default. Pass `--design` to include it; its hits are
tagged as design-plan results.
