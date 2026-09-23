/**
 * The figures vocabulary registration: the four components, the `figure` renderable kind, and
 * the molen/figure@1 file format. Kernel-free (schema + zod only) so BOTH halves register it on
 * import: a browser page validates scenes with the client half alone, the tooling and Workers
 * with the kernel half.
 */

import {
  getSchema,
  type JsonValue,
  registerComponent,
  registerRenderableKind,
  registerSchema,
} from '@bendyline/molen-schema';
import { z } from 'zod';
import { figureDescriptorFields } from './descriptor';
import type { FigureMode } from './types';

export const FIGURE_COMPONENT: 'figure' = 'figure';
export const FIGURE_INTENT_COMPONENT: 'figureIntent' = 'figureIntent';
export const FIGURE_STATE_COMPONENT: 'figureState' = 'figureState';
export const FIGURE_ATTACHMENT_COMPONENT: 'figureAttachment' = 'figureAttachment';
export const FIGURE_FORMAT: 'molen/figure@1' = 'molen/figure@1';

export const FIGURE_MODES: readonly FigureMode[] = [
  'idle',
  'walk',
  'run',
  'jump',
  'fall',
  'sit',
  'custom',
];

const num = z.number();
const vec3 = z.array(num).length(3);
const quat = z.array(num).length(4);
const modeEnum = z.enum(['idle', 'walk', 'run', 'jump', 'fall', 'sit', 'custom']);

const figureSchema = z.strictObject({
  ...figureDescriptorFields,
  facing: z
    .enum(['velocity', 'manual'])
    .describe(
      "How the figure turns: 'velocity' (default) writes transform.rot toward the travel direction; 'manual' leaves rotation to whoever owns it.",
    )
    .optional(),
  turnRate: num
    .positive()
    .describe('Max turn rate in rad/s for velocity facing (default 10).')
    .optional(),
  speedSource: z
    .enum(['auto', 'transform', 'none'])
    .describe(
      "Where speed comes from: 'auto' (kinematicBody, character, platformBody, rapier velocity, else transform deltas), 'transform', or 'none'.",
    )
    .optional(),
  blendTicks: z
    .int()
    .nonnegative()
    .describe('Ticks to blend between modes (default 12).')
    .optional(),
});

const figureIntentSchema = z.strictObject({
  mode: modeEnum.describe('Force a mode instead of deriving it from motion.').optional(),
  lookAt: z
    .union([
      z.strictObject({ pos: vec3.describe('World point [x, y, z] to look at.') }),
      z.strictObject({ entity: z.string().min(1).describe('Entity id to look at.') }),
    ])
    .describe('Aim the head at a world point or another entity.')
    .optional(),
  overrides: z
    .record(z.string().min(1), quat)
    .describe('Joint-local rotations [x, y, z, w] by canonical joint name, replacing the gait.')
    .optional(),
  ik: z
    .partialRecord(z.enum(['hand.l', 'hand.r', 'foot.l', 'foot.r']), vec3)
    .describe('Figure-local effector goals solved by two-bone IK after the gait.')
    .optional(),
  footIk: z.boolean().describe('Plant feet on the ground field (opt-in).').optional(),
});

const figureStateSchema = z.strictObject({
  mode: modeEnum.describe('Current locomotion mode.'),
  gait: z
    .enum(['walk', 'trot', 'gallop'])
    .describe('Quadruped gait for walk/run modes.')
    .optional(),
  speed: num.nonnegative().describe('Planar speed in m/s (quantized).'),
  travel: num
    .describe('Travel direction relative to facing, radians (absent = forward).')
    .optional(),
  strideRate: num.nonnegative().describe('Gait cycles per second.'),
  phaseAt: num.min(0).max(1).describe('Gait phase [0, 1) at phaseAtTick.'),
  phaseAtTick: z.int().nonnegative().describe('Tick the phase was anchored at.'),
  modeAtTick: z.int().nonnegative().describe('Tick the current mode began (blend start).'),
  prevMode: modeEnum.describe('Mode being blended out of.').optional(),
  lookAtTick: z.int().nonnegative().describe('Tick the look-at target last changed.').optional(),
});

const figureAttachmentSchema = z.strictObject({
  socket: z
    .string()
    .min(1)
    .describe("Socket name on the parent figure: 'head.top', 'hand.r', 'back', 'saddle', ..."),
  offset: z
    .strictObject({
      pos: vec3.describe('Socket-local position offset in meters.').optional(),
      rot: quat.describe('Socket-local rotation offset [x, y, z, w].').optional(),
    })
    .describe('Extra socket-local offset.')
    .optional(),
  anchor: z
    .enum(['origin', 'pelvis', 'eye'])
    .describe("Which point of the attached entity sits on the socket (default 'origin').")
    .optional(),
});

export const FIGURE_EXAMPLE: JsonValue = {
  preset: 'human.adult',
  height: 1.7,
  palette: { top: '#3b6ea5', bottom: '#2f2f38' },
};

const figureFileSchema = z.strictObject({
  format: z.literal(FIGURE_FORMAT).describe("Format envelope; always 'molen/figure@1'."),
  ...figureDescriptorFields,
});

export const FIGURE_FILE_EXAMPLE: JsonValue = {
  format: FIGURE_FORMAT,
  preset: 'horse',
  height: 1.6,
  palette: { skin: '#3b2a1e', markings: '#f0ead6' },
};

let registered = false;

/** Register the figures components, the `figure` renderable kind, and molen/figure@1 (idempotent). */
export function registerFiguresSchema(): void {
  if (registered) return;
  registered = true;
  const owner = 'figures';
  const docsRef = 'guide/figures.md';
  registerComponent(
    FIGURE_COMPONENT,
    figureSchema,
    {
      description:
        'What a figure is: a preset plus descriptor overrides (height, build, proportions, features, palette) and how it faces its motion. Pair with renderable.kind "figure".',
      owner,
      examples: [FIGURE_EXAMPLE, { preset: 'dog', palette: { skin: '#3a3a3a' }, facing: 'manual' }],
      docsRef,
    },
    { override: true },
  );
  registerComponent(
    FIGURE_INTENT_COMPONENT,
    figureIntentSchema,
    {
      description:
        'Optional authored control of a figure: a forced mode, a look-at target, joint overrides, and IK goals.',
      owner,
      examples: [{ mode: 'sit' }, { lookAt: { entity: 'player' } }],
      docsRef,
    },
    { override: true },
  );
  registerComponent(
    FIGURE_STATE_COMPONENT,
    figureStateSchema,
    {
      description:
        'Kernel-owned locomotion state of a figure (mode, quantized speed, tick-anchored gait phase). Read it; the figures systems write it.',
      owner,
      examples: [
        {
          mode: 'walk',
          speed: 1.4,
          strideRate: 1.09,
          phaseAt: 0.37,
          phaseAtTick: 1200,
          modeAtTick: 1180,
          prevMode: 'idle',
        },
      ],
      docsRef,
    },
    { override: true },
  );
  registerComponent(
    FIGURE_ATTACHMENT_COMPONENT,
    figureAttachmentSchema,
    {
      description:
        'Follow a named socket of the parent figure (with `parent`): the figures systems write localTransform from the evaluated pose each tick.',
      owner,
      examples: [{ socket: 'head.top' }, { socket: 'hand.r', offset: { rot: [0, 1, 0, 0] } }],
      docsRef,
    },
    { override: true },
  );
  registerRenderableKind('figure', {
    description: 'a procedural skinned figure body from the entity `figure` component',
    owner,
    // The client half reads `renderable.lod` to pin a body tier (see client/kind.ts `lodOf`).
    // `renderable` is strict, so the field has to be declared here or a figure entity that pins
    // its tier would be rejected as a typo.
    fields: {
      lod: z
        .union([z.literal('auto'), z.literal(0), z.literal(1), z.literal(2)])
        .describe(
          'Figure body detail tier: 0 (full), 1 (medium), 2 (far), or "auto" to pick by distance.',
        ),
    },
  });
  if (getSchema('figure') === undefined) {
    registerSchema('figure', figureFileSchema, {
      id: FIGURE_FORMAT,
      title: 'Figure descriptor',
      description:
        'A figure descriptor document: a preset plus overrides, the same shape as the `figure` component. Preview it with `molen figure preview`, bake it with `molen figure bake`.',
      examples: [FIGURE_FILE_EXAMPLE],
      docsRef,
    });
  }
}
