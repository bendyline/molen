/**
 * @bendyline/molen-figures/kernel — stylized human, biped and quadruped figures: descriptors and
 * presets, canonical rigs and sockets, deterministic gait/pose evaluation, locomotion state, and
 * socket attachments. Three-free; every number goes through dmath.
 */

export { attachmentLocal } from './kernel/attach';
export type { FigureBody, FigureBounds } from './kernel/body';
export { figureBodyKey, generateFigureBody, rigInverseBind } from './kernel/body';
export type { RGB } from './kernel/color';
export { parseColor, scaleColor } from './kernel/color';
export type {
  FigureAnchor,
  FigureAttachmentData,
  FigureData,
  FigureGait,
  FigureIkEffector,
  FigureIntentData,
  FigureMode,
  FigureStateData,
} from './kernel/components';
export {
  FIGURE_EXAMPLE,
  FIGURE_FILE_EXAMPLE,
  FIGURE_FORMAT,
  FIGURE_MODES,
  Figure,
  FigureAttachment,
  FigureIntent,
  FigureState,
  registerFiguresComponents,
} from './kernel/components';
export {
  descriptorKey,
  figureDescriptorFields,
  figureDescriptorSchema,
  resolveFigureDescriptor,
} from './kernel/descriptor';
export {
  bipedRunFor,
  froude,
  GRAVITY,
  idleThresholds,
  quadrupedGaitFor,
  strideRateFor,
} from './kernel/gait';
export type { TwoBoneSolution } from './kernel/ik';
export { solveTwoBoneIk } from './kernel/ik';
export type { FiguresHandle, FiguresOptions } from './kernel/install';
export { figuresOf, installFigures } from './kernel/install';
export type { LocomotionMemory, LocomotionOptions } from './kernel/locomotion';
export type { FigurePose, PoseEvalOptions } from './kernel/pose';
export {
  evaluatePose,
  figurePhase,
  figureToWorld,
  jointTransform,
  poseModelSpace,
  socketTransform,
  worldToFigure,
} from './kernel/pose';
export type { PoseBuffer } from './kernel/pose-buffer';
export type { FigurePreset } from './kernel/presets';
export { FIGURE_PRESETS, figurePreset } from './kernel/presets';
export type { FigureMetrics } from './kernel/proportions';
export { deriveMetrics } from './kernel/proportions';
export type { FigureJoint, FigureRig, FigureSocket } from './kernel/rig';
export {
  BIPED_JOINT_NAMES,
  BIPED_SOCKET_NAMES,
  deriveRig,
  figureMountable,
  mirrorName,
  QUADRUPED_JOINT_NAMES,
  QUADRUPED_SOCKET_NAMES,
  rigBindModel,
  socketBindPosition,
} from './kernel/rig';
export type { FigureEntry, FigureRuntime } from './kernel/runtime';
export { createFigureRuntime } from './kernel/runtime';
export {
  FIGURE_ATTACHMENT_COMPONENT,
  FIGURE_COMPONENT,
  FIGURE_INTENT_COMPONENT,
  FIGURE_STATE_COMPONENT,
  registerFiguresSchema,
} from './kernel/schema';
export { figuresScriptApi } from './kernel/script-api';
export { figureSeed, fmix32, unit01 } from './kernel/seed';
export type {
  FigureMeshGroup,
  FigureRegion,
  FigureTier,
  RingRef,
  Skin,
  SkinnedMeshBuffers,
} from './kernel/skinned-mesh-builder';
export { FIGURE_REGIONS, SkinnedMeshBuilder } from './kernel/skinned-mesh-builder';
export type {
  FigureAge,
  FigureArchetype,
  FigureDescriptor,
  FigureEarStyle,
  FigureFeatures,
  FigureFootStyle,
  FigureHairStyle,
  FigureHandStyle,
  FigureHornStyle,
  FigureLegwearStyle,
  FigurePalette,
  FigurePresetId,
  FigureProportions,
  FigureSleeveStyle,
  FigureSpecies,
  FigureTailStyle,
  ResolvedFigureDescriptor,
} from './kernel/types';
export { FIGURE_PRESET_IDS } from './kernel/types';

import { registerFiguresComponents } from './kernel/components';

// Register the figures components, renderable kind, and file format on import so tooling can
// validate scenes and documents that use them.
registerFiguresComponents();
