import { registerSchema } from '@bendyline/molen-schema';
import { z } from 'zod';
import { lerp3 } from './math';
import type { CameraPose } from './three/renderer';

// Camera tracks for machinima (docs/08 P3): keyframed poses over ticks, interpolated. Pure
// (no three.js) so it runs in Node (export_frames) and the browser (live playback). Exported
// from the three-free './camera-track' subpath.

export interface CameraTrackKeyframe {
  tick: number;
  position: [number, number, number];
  lookAt: [number, number, number];
}

export interface CameraTrackDoc {
  format: 'molen/cameratrack@1';
  easing: 'linear' | 'smooth';
  loop: boolean;
  keyframes: CameraTrackKeyframe[];
}

const trackSchema = z.strictObject({
  format: z
    .literal('molen/cameratrack@1')
    .describe("Format envelope; always 'molen/cameratrack@1'."),
  easing: z
    .enum(['linear', 'smooth'])
    .describe('Interpolation between keyframes: linear or smooth (smoothstep; default).')
    .default('smooth'),
  loop: z
    .boolean()
    .describe('Wrap the tick back to the first keyframe after the last one (default false).')
    .default(false),
  keyframes: z
    .array(
      z.strictObject({
        tick: z
          .number()
          .nonnegative()
          .describe('Tick at which this pose is reached (scene tickRate).'),
        position: z
          .tuple([z.number(), z.number(), z.number()])
          .describe('Camera position [x, y, z] in meters (Y-up).'),
        lookAt: z
          .tuple([z.number(), z.number(), z.number()])
          .describe('Point [x, y, z] in meters the camera looks at.'),
      }),
    )
    .min(1)
    .describe('Camera poses over ticks (at least one; sorted by tick when evaluated).'),
});

let registered = false;
/** Register the camera-track schema into the shared registry (idempotent). */
export function registerCameraTrackSchema(): void {
  if (registered) return;
  registered = true;
  registerSchema('cameratrack', trackSchema, {
    id: 'molen/cameratrack@1',
    title: 'Camera track',
    description: 'Keyframed camera poses over ticks for scripted playback (machinima).',
    examples: [
      {
        format: 'molen/cameratrack@1',
        easing: 'smooth',
        keyframes: [
          { tick: 0, position: [0, 20, 40], lookAt: [0, 0, 0] },
          { tick: 120, position: [40, 20, 0], lookAt: [0, 0, 0] },
        ],
      },
    ],
    docsRef: 'schemas/cameratrack.md',
  });
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Interpolated camera pose at a given tick along a (validated) track. */
export function evaluateCameraTrack(doc: CameraTrackDoc, tick: number): CameraPose {
  const kfs = [...doc.keyframes].sort((a, b) => a.tick - b.tick);
  const first = kfs[0] as CameraTrackKeyframe;
  const last = kfs[kfs.length - 1] as CameraTrackKeyframe;
  const span = last.tick - first.tick;

  let t = tick;
  if (doc.loop && span > 0) {
    t = first.tick + ((((tick - first.tick) % span) + span) % span);
  }
  if (t <= first.tick) return { position: first.position, lookAt: first.lookAt };
  if (t >= last.tick) return { position: last.position, lookAt: last.lookAt };

  let a = first;
  let b = last;
  for (let i = 0; i < kfs.length - 1; i++) {
    const lo = kfs[i] as CameraTrackKeyframe;
    const hi = kfs[i + 1] as CameraTrackKeyframe;
    if (t >= lo.tick && t <= hi.tick) {
      a = lo;
      b = hi;
      break;
    }
  }
  let f = b.tick > a.tick ? (t - a.tick) / (b.tick - a.tick) : 0;
  if (doc.easing === 'smooth') f = smoothstep(f);
  return { position: lerp3(a.position, b.position, f), lookAt: lerp3(a.lookAt, b.lookAt, f) };
}
