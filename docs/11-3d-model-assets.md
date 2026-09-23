# 11 — 3D model assets

This document proposes a straightforward prompt-to-runtime model asset workflow based on the
weathered red-barn end-to-end test. It is a design plan. The workflow that exists today is
documented in `docs-src/guide/3d-model-assets.md`, and the shipped implementation remains
authoritative.

## Outcome

An agent should be able to start with “build me a weathered red barn” and finish with one reviewable
asset workspace containing:

- reproducible geometry and texture sources;
- a canonical imported GLB plus validated `molen/asset@1` sidecar;
- project registration and optional type registration;
- suitable collision data;
- neutral turntable previews and an in-scene Molen screenshot with shadows;
- an `asset-build-report.json` containing prompts, provenance, hashes, statistics, warnings, and
  exact verification results.

One command should be able to rerun the deterministic part of this pipeline. Image or model
generation may remain an explicit upstream step because availability, cost, and authorization vary.

## What the red-barn test proved

The shipped pieces already compose successfully:

1. A generated base-color texture can be saved in the project.
2. Deterministic code can derive normal and metallic/roughness maps and embed them in a GLB.
3. `molen asset import` normalizes the GLB, extracts bounds and collision hulls, writes a sidecar,
   and registers it in `project.json`.
4. `asset inspect --verify`, scene validation, simulation assertions, and `molen shot` can verify
   the same asset without a human browser session.
5. A lit Molen scene renders the model, PBR texture response, and real-time cast shadow correctly.

The checked-in library asset is `assets/structures/red-barn/`.

## Friction observed

### No stable source workspace or build contract

The imported `assets/<id>/` layout is clear, but source geometry, prompts, texture inputs,
conversion scripts, previews, and reports have no standard home. Every agent must invent one.

### Geometry authoring is outside Molen

This is a reasonable architecture boundary—Molen consumes glTF—but simple deterministic geometry
still needs a supported authoring surface. The prototype script reached into another package's
private `node_modules` for PNG encoding, which is acceptable evidence but not a durable recipe.

### Texture preparation is manual

There is no first-party command for deterministic resizing, color-space checks, normal derivation,
or glTF metallic/roughness/AO channel packing. Image-generation output dimensions may also be
non-power-of-two and much larger than a runtime asset needs.

### Asset preview is separate from scene-quality preview

`asset shot` frames the imported bounds well, but it has no configurable ground plane or standard
shadow rig. A second hand-authored scene is currently required to judge contact shadows and final
material response.

### Browser staging is implicit

The URL provider's conventional `assets/<dotted/id>/model.glb` path is simple, but projects lack a
tool that stages imported assets into a browser build and emits an id-to-URL index when the layout
is nonstandard.

### Discoverability has small inconsistencies

The importer accepts `.gltf` as well as `.glb`, and CLI parsing accepts `--project` and `--out-dir`,
but some help/operation text only advertises `.glb` and omits those useful flags.

## Proposed workflow

### 1. `molen asset new`

Add a scaffold command:

```sh
molen asset new barn.weathered --kind model
```

Suggested output:

```text
asset-src/barn/weathered/
  asset-source.json
  README.md
  geometry/
  textures/
  scripts/build.mjs
  previews/
```

The scaffold should not assume Blender, an image model, or a particular geometry generator. It
should establish paths, naming, a build hook, prompt/provenance fields, and validation targets.

### 2. `molen asset build`

Add an orchestrating operation, mirrored by MCP:

```sh
molen asset build asset-src/barn/weathered/asset-source.json
```

It should:

1. run an optional declared local generator/export command;
2. validate the resulting glTF;
3. normalize and pack declared textures;
4. call the existing import operation rather than duplicate it;
5. inspect and verify the imported files;
6. render configured preview angles and an optional shadow-ground view;
7. write `asset-build-report.json` with content hashes and tool output.

The build operation should not silently call paid or remote generation services. Those remain
explicit inputs unless the user authorizes and configures a provider.

### 3. Deterministic texture preparation

Add a focused command such as:

```sh
molen texture prepare material-source.png \
  --size 1024 --derive-normal 0.7 --roughness roughness.png \
  --out-dir build/textures
```

The exact interface needs design, but the implementation should support:

- deterministic resize and mip-safe edge handling;
- sRGB versus linear slot validation;
- normal-map validation and optional height-to-normal conversion;
- glTF ORM packing (occlusion R, roughness G, metalness B);
- alpha-mode diagnostics;
- texel-density and aggregate texture-memory warnings;
- PNG output first, with optional KTX2 only after capture and browser decoder hosting are turnkey.

### 4. Improve `asset shot`

Give the asset preview a stable studio environment with options for a ground plane, shadow tier, sun
direction, clear color, and camera overrides. Emit the environment and render statistics into a
preview manifest so CI can reproduce the image.

### 5. Add browser staging/index generation

Add either:

```sh
molen asset stage --project project.json --out-dir dist
```

or a public build helper that copies registered runtime files and emits an id-to-URL JSON/module.
This should use sidecar `files.main` rather than re-derive paths, preserve content hashes, and fail
on missing or stale files.

### 6. Provide a supported deterministic authoring helper

For simple code-authored geometry, expose stable helpers from a public package or tooling subpath:
buffers/accessors, primitives, named materials, texture embedding, GLB writing, and bounds checks.
Do not make general mesh modeling part of the kernel or client. Complex modeling stays in DCC or
specialized generation tools.

## Suggested order

| Priority | Change | Why |
| --- | --- | --- |
| P0 | Shipped guide plus repo-local skill | Stops agents from rediscovering the current workflow |
| P1 | `asset new`, corrected CLI help, build report | Standardizes source layout and makes results auditable |
| P1 | Ground/shadow mode in `asset shot` | Removes the hand-authored preview scene for most props |
| P2 | Deterministic texture preparation/packing | Eliminates fragile one-off PBR scripts and oversized maps |
| P2 | Browser staging/index operation | Makes deployment match headless project resolution |
| P3 | Public geometry-authoring helpers | Makes simple generated props sustainable without adding a DCC |
| P3 | Optional KTX2/LOD pipeline | Reduces runtime weight after decoder hosting and QA are turnkey |

## Acceptance criteria

- Starting from an existing source GLB and texture set, one command produces the imported asset,
  report, and preview images.
- The operation is available through both CLI and MCP and appears in `molen describe`.
- Repeating the local build with unchanged inputs produces identical runtime hashes and preview
  metadata.
- No example imports dependencies from another package's private `node_modules`.
- The report records prompts/provenance without requiring remote generation at build time.
- Asset previews expose UV, scale, clipping, missing texture, and shadow errors visually.
- A browser build can consume the same registered id used by `molen shot` without a handwritten
  mapping.
