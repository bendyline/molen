---
name: molen-3d-model-assets
description: Build, texture, import, host, and visually verify prompt-driven glTF/GLB model assets for Molen. Use for creating a new 3D asset, integrating an existing model, or diagnosing a Molen model asset pipeline. Do not use for primitive-only scene composition or material-only work that does not produce a model.
---

# Molen 3D model assets

Read `docs-src/guide/3d-model-assets.md` completely before acting. Treat `docs-src/` and
`packages/` as shipped truth; `docs/` is the design plan.

## Required outcome

Deliver a real glTF 2.0 model registered through Molen's normal asset sidecar and project index,
plus inspectable source material, a Molen-rendered preview, and reproducible validation evidence.
Do not substitute concept art or a screenshot for model geometry.

## Workflow

1. Turn the prompt into an asset brief: dimensions in meters, visual style, silhouette, required
   views/details, texture style, animation, collision, and a practical geometry/texture budget.
2. Choose the simplest capable geometry path. Use a deterministic generator for simple
   hard-surface or parametric assets; use an available modeling tool for organic or sculpted work;
   preserve user-supplied glTF/GLB sources. Keep source files separate from imported runtime files.
3. For generated bitmap materials, request flat, evenly lit, orthographic base color without cast
   shadows or highlights. Derive or author normal, roughness, metalness, and AO as data maps with
   the correct glTF channel and color-space semantics. Save every project-consumed image inside
   the workspace.
4. Export one self-contained GLB when possible. Use meter scale, +Y up, stable node/material
   names, UVs, normals, and a ground-aligned origin appropriate to the asset.
5. Import with `molen asset import`, then run `asset inspect --verify`. Use the surrounding
   `project.json`; reserve a namespace before choosing a dotted asset id.
6. Render turntable views with `molen asset shot`. Also place the model in a small Molen scene
   with explicit environment lighting, a shadow-receiving ground plane, and an intentional camera;
   validate, simulate, and capture it with `molen shot`.
7. Inspect the images. Iterate on framing, normals, UVs, materials, scale, clipping, and shadows
   until the visible result matches the prompt. Render statistics alone are not visual QA.
8. Report final paths, the texture-generation prompt and method, model/texture statistics, hashes,
   exact checks run, warnings, and remaining limitations.

Prefer the CLI/MCP operations over source inspection. If a durable generator would need imports
from another package's private `node_modules`, record that as missing authoring infrastructure
instead of presenting the dependency as a stable public workflow.
