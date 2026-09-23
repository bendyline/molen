# Molen

An AI-legible 3D experience engine: a deterministic headless simulation kernel, a three.js
rendering client, and a development loop an agent can drive end to end without a browser.

Molen is not a game. It is a kernel plus capability layers you build games, visualizations and
interactive experiences on top of. Its design constraint is that an agent can author, validate,
simulate, assert and screenshot a complete experience entirely through text.

```sh
molen validate scene.json                                     # cheap, run it constantly
molen sim run scene.json --ticks 30 --assert checks.json --hash
molen shot scene.json --ticks 30 --camera 0,6,16 --out shot.png
```

## Try it

The packages are not on npm yet, so build from a clone:

```sh
pnpm install && pnpm -r build     # packages consume each other's dist
node packages/tooling/dist/cli.mjs new my-experience
```

That scaffolds a runnable project: a scene manifest, two scene scripts, a setup module, an
entity type registry, assertions and a Vite app. From inside it, the whole inner loop works with
no install and no browser:

```sh
molen validate scenes/main.scene.json   # ✓ scenes/main.scene.json is a valid scene
molen types check                       # ✓ types check passed
molen scripts check                     # ✓ 2 scripts type-check clean
molen sim run main --ticks 30 --commands cmds.json --assert checks.json --hash
                                        # ✓ 4/4 assertions passed
molen shot main --ticks 30 --out shot.png
pnpm dev                                # the same scene in the browser
```

Every one of those commands is also an MCP tool with the same input and output contract, so an
agent drives the engine without reading its source. `molen describe` prints the contracts,
`molen docs search <query>` searches the shipped guides offline.

To see finished experiences instead, `pnpm dev` from the repository root opens a gallery of nine
samples, including three complete games.

## What makes it different

**Determinism is a tested contract, not a slogan.** Same seed, same commands and same build
produce the same state hash. Randomness routes through a seeded world RNG and math through a deterministic `dmath`,
enforced by a lint over kernel code. A recorded replay does not just say "something changed"; it
names the first tick that diverged.

**A complete game can be data.** Entities, prefabs, commands with their own JSON Schema payloads,
input bindings, camera and physics are declared JSON, validated with pinpointed errors and
did-you-mean suggestions. Game rules are scene scripts in the manifest. The Skybound platformer
sample's entire rule set is 119 lines.

**Headless from the start.** Validate, simulate, assert and screenshot without a browser. Every
sample is simultaneously a demo and a regression fixture, so behaviour is checkable in CI.

**The simulation is separated from rendering by a message boundary.** The kernel has no DOM and no
three.js, runs in a Worker in the browser and in Node for tests, and speaks to the client over a
documented protocol.

## How it fits together

| Package | What it is |
|---|---|
| [`@bendyline/molen-schema`](packages/schema) | Data formats, validator, error formatter, component vocabulary. Depends on nothing. |
| [`@bendyline/molen-kernel`](packages/kernel) | Deterministic ECS, script host, snapshots, replay and state hashing. No DOM, no three.js. |
| [`@bendyline/molen-client`](packages/client) | three.js renderer, Worker protocol, interpolation, `mountExperience`. |
| [`@bendyline/molen-materials`](packages/materials) | Pixel grids, SVG rasterizing, procedural material graphs. CPU only. |
| [`@bendyline/molen-tooling`](packages/tooling) | The `molen` CLI and the MCP server over one shared ops library. |

Capability packages layer on top and are opt-in. Each splits into a deterministic `/kernel` half
and a render-only `/client` half: [terrain](packages/terrain),
[worldgen](packages/worldgen), [worldgen-earth](packages/worldgen-earth),
[figures](packages/figures), plus [physics-rapier](packages/physics-rapier),
[pathfinding](packages/pathfinding) and the [entities](packages/entities) asset library.

## Status

Molen is pre-release. Version 0.x, ESM only, Node 22.13 or newer, three.js pinned per release.

- **The formats are beta.** A breaking change bumps the version in the envelope
  (`molen/scene@3`) rather than shipping a migration.
- **Determinism has levels, and they are stated per subsystem.** The built-in kinematics and
  platformer physics are cross-platform deterministic. Rapier rigid-body physics is deterministic
  on the same build and platform only, so a replay recorded on one machine may diverge on another.
  Vehicles, aircraft and figures reach transcendental math, which makes them same-JS-engine.
  Materials, worldgen geometry and rendering never enter the state hash at all. The full table,
  with what breaks each level and what is *not* promised, is in
  [the determinism guide](docs-src/guide/determinism.md).
- **Upgrading does not invalidate your saves unless the state format changed.** Keyframe
  compatibility and the state hash gate on a `STATE_FORMAT` constant, not on the package version,
  which rides along as metadata. See
  [Upgrades and save files](docs-src/guide/determinism.md#upgrades-and-save-files).
- **Scene scripts run with the authority of their host process.** The script sandbox exists to
  make simulation deterministic, not to contain hostile code. Treat a scene manifest like source
  code: only run manifests you would run as a program. See
  [the scripting guide](docs-src/guide/scripting.md).
- The five packages in the table above are the engine. The capability packages are younger and
  their surfaces are more likely to move.

## Documentation

- **[Quickstart](docs-src/guide/quickstart.md)** — zero to cubes, in Node and in the browser.
- **[The agent loop](docs-src/guide/agent-loop.md)** — author, validate, simulate, assert,
  screenshot, with copy-paste commands.
- **[Scripting](docs-src/guide/scripting.md)** — game logic as scene data, the verb set, and the
  determinism rules.
- **[Determinism](docs-src/guide/determinism.md)** — what reproduces and at what level, what
  breaks it, what `STATE_FORMAT` means for saves, and what is not promised.
- **[Browser mount](docs-src/guide/browser-mount.md)** — the kernel in a Worker, the page on top.
- **[Schema reference](docs-src/schemas/README.md)** — every format with its JSON Schema and a
  valid example, generated from the registry the validator uses.
- **[llms.txt](docs-src/llms.txt)** — the whole documentation bundle as a flat, version-locked
  index for agents. It also ships inside the tooling package and is searchable offline.

## Contributing

Code contributions are not accepted. We do welcome issue reports and proposal-only pull requests:
read [Contributing](CONTRIBUTING.md) and the [`specs/` guide](specs/README.md) before opening one.
Participation is subject to the [Code of Conduct](CODE_OF_CONDUCT.md). For help, see
[Support](SUPPORT.md); report vulnerabilities privately through the
[Security Policy](SECURITY.md).

To build it yourself, start at [AGENTS.md](AGENTS.md) for the architecture and
[CONVENTIONS.md](CONVENTIONS.md) for the house rules.

One invariant matters more than the rest: **build before you typecheck or test**, because packages
consume each other's `dist`. The root scripts encode it.

```sh
pnpm verify        # lint, typecheck, docs:check, test:unit, production audit — also the release gate
pnpm test:golden   # browser and image tests
pnpm all           # everything above, in order, from a clean install
```

Use [Conventional Commits](https://www.conventionalcommits.org/) for release notes and version
bumps. See [Releases](CONTRIBUTING.md#releases) for the publishing flow. Generated files — the
schema docs, the site, script declarations — come from generators; change the source and regenerate
rather than editing them.

## License

MIT, © Bendyline LLC. See [LICENSE](LICENSE).

The repository also carries third-party data and assets that are **not** MIT: OpenStreetMap-derived
map tiles under ODbL, public-domain elevation data with a required courtesy line, and source
business-identification data that refers to names belonging to their respective owners. Their
licenses and required attribution are
recorded in [NOTICE](NOTICE.md). If you redistribute this repository or the sample data in it, those
terms travel with the data.
