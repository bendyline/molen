/**
 * @bendyline/molen-figures/client — the three.js half: the `figure` renderable kind (procedural
 * skinned bodies posed by the shared kernel evaluator), plus the upload helpers hosts can use to
 * draw a body outside the entity pipeline.
 */

import { registerFiguresSchema } from './kernel/schema';

export type { CachedFigureGeometry } from './client/geometry-cache';
export { FigureGeometryCache } from './client/geometry-cache';
export type { FigureKindOptions } from './client/kind';
export { figureKind } from './client/kind';
export type { FigureMesh } from './client/upload';
export { applyPose, figureBodyToSkinnedMesh, figureGeometry } from './client/upload';

// A browser page validates scenes before it mounts: registering here means importing the
// client half alone is enough for `validate('scene', ...)` to accept figures.
registerFiguresSchema();
