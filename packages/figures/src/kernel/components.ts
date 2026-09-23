/**
 * The figures component vocabulary. Four components mirror the kernel's vehicle triad:
 * `figure` (what it is + facing config), `figureIntent` (optional authored control),
 * `figureState` (kernel-owned locomotion state, never written by scripts), and
 * `figureAttachment` (on child entities: which socket of the parent figure to follow).
 * The typed handles live here (they need the kernel's `defineComponent`); the schema
 * registration lives in `./schema` so the client half can register it too.
 */

import { type ComponentType, defineComponent } from '@bendyline/molen-kernel';
import type { JsonObject, Quat, Vec3 } from '@bendyline/molen-schema';
import {
  FIGURE_ATTACHMENT_COMPONENT,
  FIGURE_COMPONENT,
  FIGURE_INTENT_COMPONENT,
  FIGURE_STATE_COMPONENT,
  registerFiguresSchema,
} from './schema';
import type {
  FigureAnchor,
  FigureDescriptor,
  FigureGait,
  FigureIkEffector,
  FigureMode,
} from './types';

export { FIGURE_EXAMPLE, FIGURE_FILE_EXAMPLE, FIGURE_FORMAT, FIGURE_MODES } from './schema';
export type { FigureAnchor, FigureGait, FigureIkEffector, FigureMode } from './types';

export interface FigureData extends FigureDescriptor {
  /** How the figure turns: toward its velocity (default) or left to whoever writes `transform.rot`. */
  facing?: 'velocity' | 'manual';
  /** Max turn rate in rad/s for `facing: 'velocity'` (default 10). */
  turnRate?: number;
  /** Where speed comes from: movers/velocities ('auto', default), transform deltas, or nothing. */
  speedSource?: 'auto' | 'transform' | 'none';
  /** Ticks to blend between modes (default 12). */
  blendTicks?: number;
}

export interface FigureIntentData extends JsonObject {
  /** Force a mode instead of deriving it from motion. */
  mode?: FigureMode;
  /** Aim the head at a world point or another entity. */
  lookAt?: { pos: Vec3 } | { entity: string };
  /** Joint-local rotations by canonical joint name, replacing the gait for those joints. */
  overrides?: Record<string, Quat>;
  /** Figure-local effector goals solved by two-bone IK after the gait. */
  ik?: Partial<Record<FigureIkEffector, Vec3>>;
  /** Plant feet on the ground field (opt-in; both halves must sample the same ground). */
  footIk?: boolean;
}

/** Kernel-owned, piecewise-constant: written only when motion changes, never per tick. */
export interface FigureStateData extends JsonObject {
  mode: FigureMode;
  gait?: FigureGait;
  /** Planar speed, m/s, quantized. */
  speed: number;
  /** Travel direction relative to facing, radians (absent = forward). */
  travel?: number;
  /** Gait cycles per second. */
  strideRate: number;
  /** Gait phase [0, 1) at `phaseAtTick`; phase(t) = frac(phaseAt + strideRate * (t - phaseAtTick) / tickRate). */
  phaseAt: number;
  phaseAtTick: number;
  /** Tick the current mode began (blend start). */
  modeAtTick: number;
  prevMode?: FigureMode;
  /** Tick the look-at target last changed (aim blend start). */
  lookAtTick?: number;
}

export interface FigureAttachmentData extends JsonObject {
  /** Socket name on the parent figure, e.g. 'head.top', 'hand.r', 'back', 'saddle'. */
  socket: string;
  /** Extra socket-local offset. */
  offset?: { pos?: Vec3; rot?: Quat };
  /** Which point of the attached entity sits on the socket (default origin). */
  anchor?: FigureAnchor;
}

export const Figure: ComponentType<FigureData> = defineComponent<FigureData>(FIGURE_COMPONENT);
export const FigureIntent: ComponentType<FigureIntentData> =
  defineComponent<FigureIntentData>(FIGURE_INTENT_COMPONENT);
export const FigureState: ComponentType<FigureStateData> =
  defineComponent<FigureStateData>(FIGURE_STATE_COMPONENT);
export const FigureAttachment: ComponentType<FigureAttachmentData> =
  defineComponent<FigureAttachmentData>(FIGURE_ATTACHMENT_COMPONENT);

/** Register the figures components, renderable kind, and file format (idempotent). */
export function registerFiguresComponents(): void {
  registerFiguresSchema();
}
