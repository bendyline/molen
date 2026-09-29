/// <reference types="node" />
import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { CameraTrackDoc } from '@bendyline/molen-client/camera-track';
import { evaluateCameraTrack } from '@bendyline/molen-client/camera-track';
import { diffImages, exportFrames, frameStats, screenshotScene } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';
import trackDoc from '../../camera-track.json';
import sceneDoc from '../../scene.json';
import { setup } from '../../src/viz';

const DIR = join(process.cwd(), 'test', 'golden');
const OUT = join(DIR, '__output__');
const track = trackDoc as CameraTrackDoc;

describe('golden: data-viz', () => {
  it('renders the grown bar chart from the camera track', async () => {
    await mkdir(OUT, { recursive: true });
    const candidate = join(OUT, 'viz.png');

    // Render at tick 40 (bars grown) from the camera-track pose at that tick.
    const pose = evaluateCameraTrack(track, 40);
    const r = await screenshotScene({
      scene: sceneDoc as Record<string, unknown>,
      setup,
      ticks: 40,
      size: [512, 320],
      camera: { position: pose.position, ...(pose.lookAt ? { lookAt: pose.lookAt } : {}) },
      clearColor: '#10131a',
      outPath: candidate,
    });
    expect(r.ok, r.error).toBe(true);
    expect(r.renderStats?.entitiesRendered ?? 0).toBe(7); // one bar per datum

    // Seven grown bars cover about a tenth of the dark frame, in 20-odd shades of their palette.
    const stats = await frameStats(candidate);
    expect(stats.coverage).toBeGreaterThan(0.04);
    expect(stats.colors).toBeGreaterThanOrEqual(10);
  });

  it('export_frames produces a machinima sequence following the track', async () => {
    const dir = join(OUT, 'frames');
    await rm(dir, { recursive: true, force: true });
    const r = await exportFrames({
      scene: sceneDoc as Record<string, unknown>,
      setup,
      from: 0,
      to: 60,
      step: 30,
      track,
      size: [256, 160],
      clearColor: '#10131a',
      outDir: dir,
    });
    expect(r.ok).toBe(true);
    expect(r.frameCount).toBe(3);
    const files = (await readdir(dir)).filter((f) => f.endsWith('.png')).sort();
    expect(files).toHaveLength(3);
    // The bars grow and the camera moves along the track, so the first and last frames differ.
    const first = join(dir, files[0] as string);
    const last = join(dir, files[2] as string);
    const moved = await diffImages(first, last, join(OUT, 'frames.diff.png'));
    expect(moved.match).toBe(false);
  });
});
