# Electric hatchback

Original brief: add diverse cars, motorcycles, bicycles, boats, cargo ships and ferries to Molen.

Editable recipe: models/recipe.json. Shared engine authoring capability: packages/entities/scripts/fleet-geometry.mjs. Regenerate in the engine repository with `node packages/entities/scripts/generate-fleet.mjs --ids=electric-hatchback`. The recipe owns all concrete values; no sibling bundle supplies data.

Dimensions: 4.1 m long × 1.8 m wide × 1.55 m nominal height. +Y up, +Z forward; tires contact Y=0. Bright polygonal medium-fi style, flat PBR colors, no image textures or image-generation prompts. Static pieces merge by material; wheel groups preserve named spin pivots. Convex collision is derived by the importer. Geometry is a stylized generic design, not a licensed make.

Uses the existing driving solver.
