import { expect, it } from 'vitest';
import { validate } from '../src/index';

it('validates platformer and follow-camera authoring, with actionable conflict errors', () => {
  const doc = {
    format: 'molen/scene@3',
    name: 'platform',
    physics: { engine: 'platformer' },
    camera: { mode: 'follow', entity: 'player', offset: [0, 2, 10], lookOffset: [0, 0, 0] },
    entities: [
      {
        id: 'player',
        components: {
          transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
          platformBody: { halfExtents: [0.4, 0.6] },
          platformIntent: { move: 1 },
        },
      },
    ],
  };
  expect(validate('scene', doc).ok).toBe(true);
  const conflict = validate('scene', {
    ...doc,
    physics: { engine: 'platformer', character: true },
  });
  expect(conflict.ok).toBe(false);
  if (!conflict.ok) expect(conflict.issues.some((i) => i.path === '/physics/character')).toBe(true);
  const camera = validate('scene', { ...doc, camera: { ...doc.camera, offset: [0, 0, 0] } });
  expect(camera.ok).toBe(false);
  if (!camera.ok) expect(camera.issues.some((i) => i.path === '/camera/lookOffset')).toBe(true);
});
