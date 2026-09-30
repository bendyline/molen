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
// Pure, SES-free pose helpers for hosts that pose figures without the kernel figures systems
// (a main-thread world, where importing the kernel half would load the script host).
export type { FigureData, FigureStateData } from './kernel/components';
export { resolveFigureDescriptor } from './kernel/descriptor';
export { strideRateFor } from './kernel/gait';
export type { FigurePose, PoseEvalOptions } from './kernel/pose';
export { evaluatePose } from './kernel/pose';
export type { FigureRig } from './kernel/rig';
export { figureSeed } from './kernel/seed';
export type { FigureTier } from './kernel/skinned-mesh-builder';
export type { ResolvedFigureDescriptor } from './kernel/types';

// A browser page validates scenes before it mounts: registering here means importing the
// client half alone is enough for `validate('scene', ...)` to accept figures.
registerFiguresSchema();
