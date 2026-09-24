---
layout: home

hero:
  name: Molen
  text: An AI-legible 3D experience engine
  tagline: A deterministic headless kernel, a three.js client, and a dev loop an agent can drive end to end — no human in the middle.
  actions:
    - theme: brand
      text: Quickstart
      link: /guide/quickstart
    - theme: alt
      text: Play the samples
      link: https://molen.dev/play/
    - theme: alt
      text: Browse samples
      link: /samples/
    - theme: alt
      text: API reference
      link: /api/

features:
  - title: Deterministic by construction
    details: Same seed, same commands, same state hash — on any machine. Randomness routes through the world RNG and math through dmath, so a replay mismatch localizes the exact diverging tick.
    link: /guide/agent-loop
    linkText: The agent loop
  - title: Data first, code optional
    details: A complete game can be a scene manifest plus scene scripts. Entities, prefabs, commands, input bindings, camera and physics are all declared JSON, validated with pinpointed errors.
    link: /guide/scripting
    linkText: Scripting
  - title: Headless from the start
    details: Validate, simulate, assert and screenshot without a browser. Every sample is simultaneously a demo and a regression fixture, so correctness is checkable in CI.
    link: /reference/cli
    linkText: CLI reference
  - title: Built for agents
    details: Every operation is exposed on the CLI and over MCP with the same I/O contract, and describe_op returns it at runtime — an agent learns the surface without reading engine source.
    link: /reference/mcp
    linkText: MCP server
---

## Zero to running

Everything runs from the published npm packages; Node 22.13 or newer.

```sh
npx @bendyline/molen-tooling new my-experience   # scene, scripts, setup, checks, a Vite app
cd my-experience && npm install
```

Or start from one of the samples: `new my-game --template skybound` copies it into a project of
your own (`npx @bendyline/molen-tooling templates` lists them). Then run the inner loop — cheap
checks first, pixels last:

```sh
npx molen validate scenes/main.scene.json                   # constantly; errors are precise
npx molen sim run main --ticks 30 --commands cmds.json --assert checks.json --hash
npx molen shot main --ticks 30 --out shot.png
npm run dev                                                 # the same scene in the browser
```

Shared content (models, the default building styles, Earth catalogs, stars) comes as content
packs: `npx molen pack fetch https://molen.dev/packs/index.json` adds them to a project.

## What each section is

| | |
|---|---|
| **[Guides](/guide/quickstart)** | How the engine is meant to be used, written for a reader building something. Start with the [quickstart](/guide/quickstart), then [the agent loop](/guide/agent-loop) and [scripting](/guide/scripting). |
| **[Samples](/samples/)** | Nine runnable experiences, from ~50 spinning cubes to three complete games. Each is a browser demo and a headless test — the intended copy-and-modify starting points. [Play them all](https://molen.dev/play/) in the browser, or copy one with `--template`. |
| **[API reference](/api/)** | Every exported symbol of every published package, generated from the built `.d.mts` files that npm actually ships. |
| **[Schemas](/schemas/)** | Every `molen/<kind>@n` format with its JSON Schema and a valid example, generated from the registry that `molen validate` checks against. |
| **[CLI](/reference/cli) & [MCP](/reference/mcp)** | The `molen` command and the MCP server that mirrors it 1:1, generated from the shipped op catalog. |

## For agents

The whole documentation bundle is available as a flat, version-locked markdown set indexed by
**[llms.txt](/llms.txt)**. The same bundle ships inside `@bendyline/molen-tooling`
(`node_modules/@bendyline/molen-tooling/dist/docs-src/llms.txt` in a project) and is searchable
offline:

```sh
npx molen docs search "camera track"
npx molen describe                    # every op and its I/O contract
npx molen schema list                 # every format
npx molen components                  # the component vocabulary
```
