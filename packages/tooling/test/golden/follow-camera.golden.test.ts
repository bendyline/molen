import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validate } from '@bendyline/molen-schema';
import { driveScene, exportFrames, screenshotScene } from '@bendyline/molen-tooling';
import { expect, it } from 'vitest';

it('shot, drive and frames resolve follow cameras at the captured simulation tick', async () => {
  const parsed = validate('scene', {
    format: 'molen/scene@3',
    name: 'follow-capture',
    camera: { mode: 'follow', entity: 'hero', offset: [0, 2, 8], lookOffset: [0, 0, 0] },
    entities: [
      {
        id: 'hero',
        components: {
          transform: { pos: [20, 0, 0], rot: [0, 0, 0, 1] },
          renderable: { kind: 'primitive', ref: 'box', materialRef: 'palette:#f6bd61' },
        },
      },
    ],
    scripts: [
      {
        id: 'move',
        checkpoint: 'state',
        code: "molen.on('tick', () => { const p = molen.get('hero','transform').pos; molen.patch('hero','transform',{ pos: [p[0]+1,0,0] }); });",
      },
    ],
  });
  if (!parsed.ok) throw new Error(parsed.formatted);
  const scene = parsed.value;
  const out = join(process.cwd(), '.artifacts/follow-camera');
  await mkdir(out, { recursive: true });
  const size: [number, number] = [320, 240];
  const shot = await screenshotScene({ scene, ticks: 5, size, outPath: join(out, 'follow.png') });
  expect(shot.ok, shot.error).toBe(true);
  const explicit = await screenshotScene({
    scene,
    ticks: 5,
    size,
    camera: { position: [25, 2, 8], lookAt: [25, 0, 0] },
    outPath: join(out, 'explicit.png'),
  });
  expect(explicit.ok, explicit.error).toBe(true);
  const sequence = await exportFrames({ scene, from: 5, to: 5, size, outDir: join(out, 'frames') });
  expect(sequence.ok, sequence.error).toBe(true);
  const driven = await driveScene({
    scene,
    actions: [{ at: 5, screenshot: 'driven' }],
    size,
    outDir: out,
  });
  expect(driven.ok, driven.error).toBe(true);
  const expected = await readFile(join(out, 'explicit.png'));
  for (const file of ['follow.png', 'frames/frame_0000.png', 'driven.png']) {
    expect((await readFile(join(out, file))).equals(expected), file).toBe(true);
  }
});
