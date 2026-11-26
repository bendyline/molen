import { z } from 'zod';

// Camera tracks for machinima: keyframed poses over ticks. A track is its own document
// (molen/cameratrack@1) or rides inline in a scene as `cameraTrack`, so an answer that is a
// whole film is one document. The evaluator lives in @bendyline/molen-client/camera-track.

export interface CameraTrackKeyframe {
  tick: number;
  position: [number, number, number];
  lookAt: [number, number, number];
  /** Vertical field of view in degrees from this keyframe on (interpolated). */
  fov?: number;
  /** Jump to this pose at its tick instead of interpolating into it. */
  cut?: boolean;
  /** Entity id: position and lookAt are offsets from its position at playback time. */
  relativeTo?: string;
}

/** A camera track without its format envelope (the inline scene form). */
export interface SceneCameraTrack {
  easing: 'linear' | 'smooth';
  loop: boolean;
  keyframes: CameraTrackKeyframe[];
}

export interface CameraTrackDoc extends SceneCameraTrack {
  format: 'molen/cameratrack@1';
}

const vec3 = z.array(z.number()).length(3);

const keyframeSchema = z.strictObject({
  tick: z.number().nonnegative().describe('Tick at which this pose is reached (scene tickRate).'),
  position: vec3.describe(
    'Camera position [x, y, z] in meters (Y-up); an offset from relativeTo when that is set.',
  ),
  lookAt: vec3.describe(
    'Point [x, y, z] in meters the camera looks at; an offset from relativeTo when that is set.',
  ),
  fov: z
    .number()
    .min(1)
    .max(179)
    .describe('Vertical field of view in degrees (interpolated; default: the client camera).')
    .optional(),
  cut: z
    .boolean()
    .describe('Jump to this pose at its tick instead of interpolating from the previous one.')
    .optional(),
  relativeTo: z
    .string()
    .min(1)
    .describe(
      'Entity id: position and lookAt are offsets from its position at playback time (a tracking shot).',
    )
    .optional(),
});

const trackFields = {
  easing: z
    .enum(['linear', 'smooth'])
    .describe('Interpolation between keyframes: linear or smooth (smoothstep; default).')
    .default('smooth'),
  loop: z
    .boolean()
    .describe('Wrap the tick back to the first keyframe after the last one (default false).')
    .default(false),
  keyframes: z
    .array(keyframeSchema)
    .min(1)
    .describe('Camera poses over ticks (at least one; sorted by tick when evaluated).'),
};

// array().length(3) rather than tuples: the scene's emitted JSON Schema must carry min/maxItems
// (see rngStateSchema in formats.ts), so the fixed-arity types come from the interfaces above.
/** The inline form a scene carries as `cameraTrack` (no format envelope). */
export const sceneCameraTrackSchema: z.ZodType<SceneCameraTrack, unknown> = z.strictObject(
  trackFields,
) as unknown as z.ZodType<SceneCameraTrack, unknown>;

/** The standalone document, `molen/cameratrack@1`. */
export const cameraTrackSchema: z.ZodType<CameraTrackDoc, unknown> = z.strictObject({
  format: z
    .literal('molen/cameratrack@1')
    .describe("Format envelope; always 'molen/cameratrack@1'."),
  ...trackFields,
}) as unknown as z.ZodType<CameraTrackDoc, unknown>;
